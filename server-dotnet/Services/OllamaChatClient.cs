using System.Net.Http.Json;
using System.Text.Json;

namespace StoreApi.Services;

public sealed class AiChatException(string code) : Exception(code);
public sealed record AiMessage(string Role, string Content);

// Một model dùng chung GPU; chờ lượt có giới hạn và hủy được khi khách rời trang.
public sealed class OllamaChatClient : IDisposable
{
    private readonly HttpClient _http = new() { Timeout = Timeout.InfiniteTimeSpan };
    private readonly SemaphoreSlim _gate = new(1, 1);

    public async Task StreamAsync(string host, string model, IReadOnlyList<AiMessage> messages,
        int contextSize, string thinkingMode, int timeoutSeconds, Func<string, Task> delta,
        Func<string, Task> status, CancellationToken cancellationToken)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(timeoutSeconds));
        var acquired = false;
        try
        {
            await status("queued");
            await _gate.WaitAsync(timeout.Token);
            acquired = true;
            await status("generating");
            var payload = new
            {
                model, messages = messages.Select(item => new { role = item.Role, content = item.Content }),
                stream = true, think = thinkingMode != "off", keep_alive = "10m",
                // Giữ sampling mặc định của model; temperature quá thấp có thể làm suy luận lặp đến hết ngân sách.
                options = new { num_ctx = contextSize, num_predict = thinkingMode == "high" ? 8192 : 4096 }
            };
            using var request = new HttpRequestMessage(HttpMethod.Post, host + "/api/chat") { Content = JsonContent.Create(payload) };
            using var response = await _http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
            if (!response.IsSuccessStatusCode) throw new AiChatException("AI_UNAVAILABLE");
            using var stream = await response.Content.ReadAsStreamAsync(timeout.Token);
            using var reader = new StreamReader(stream);
            var hasContent = false;
            while (await reader.ReadLineAsync(timeout.Token) is { } line)
            {
                if (string.IsNullOrWhiteSpace(line)) continue;
                using var document = JsonDocument.Parse(line);
                var root = document.RootElement;
                if (root.TryGetProperty("error", out _)) throw new AiChatException("AI_PROVIDER_ERROR");
                // Không gửi message.thinking về trình duyệt hay lưu vào lịch sử.
                if (root.TryGetProperty("message", out var message) && message.TryGetProperty("content", out var content)
                    && content.GetString() is { Length: > 0 } text)
                {
                    hasContent |= !string.IsNullOrWhiteSpace(text);
                    await delta(text);
                }
                if (!root.TryGetProperty("done", out var done) || !done.GetBoolean()) continue;
                if (root.TryGetProperty("done_reason", out var reason) && reason.GetString() != "stop")
                    throw new AiChatException("AI_OUTPUT_LIMIT");
                if (!hasContent) throw new AiChatException("AI_EMPTY_RESPONSE");
                return;
            }
            throw new AiChatException("INCOMPLETE_STREAM");
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new AiChatException("AI_TIMEOUT");
        }
        catch (HttpRequestException) { throw new AiChatException("AI_UNAVAILABLE"); }
        catch (JsonException) { throw new AiChatException("AI_PROVIDER_ERROR"); }
        finally { if (acquired) _gate.Release(); }
    }

    public async Task<AiProviderStatus> StatusAsync(string host, string model, CancellationToken cancellationToken)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(2));
        try
        {
            using var response = await _http.GetAsync(host + "/api/tags", timeout.Token);
            if (!response.IsSuccessStatusCode) return new("ollama", model, false, false);
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(timeout.Token));
            var available = document.RootElement.GetProperty("models").EnumerateArray()
                .Any(item => item.GetProperty("name").GetString() == model);
            return new("ollama", model, true, available);
        }
        catch (Exception ex) when (ex is HttpRequestException or OperationCanceledException or JsonException or KeyNotFoundException)
        {
            return new("ollama", model, false, false);
        }
    }

    public void Dispose()
    {
        _http.Dispose();
        _gate.Dispose();
    }
}
