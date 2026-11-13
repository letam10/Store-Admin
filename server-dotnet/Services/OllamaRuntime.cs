using System.Diagnostics;
using System.Net.Http.Json;
using System.Text.Json;

namespace StoreApi.Services;

public sealed record OllamaRuntimeStatus(bool ServerReady, bool ModelAvailable, bool ModelLoaded, string Model, string Message);

// Quản lý đúng tiến trình do menu mở; không tắt Ollama đang được ứng dụng khác dùng chung.
public sealed class OllamaRuntime(IConfiguration configuration, AiChatService ai) : IDisposable
{
    private readonly HttpClient http = new() { Timeout = Timeout.InfiniteTimeSpan };
    private Process? ownedServer;
    private string Config(string key, string fallback)
    {
        var value = Environment.GetEnvironmentVariable(key);
        if (string.IsNullOrWhiteSpace(value)) value = configuration[key];
        return string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
    }
    public string Host => Config("OLLAMA_HOST", "http://127.0.0.1:11434").TrimEnd('/');
    public string Model => ai.ModelName;

    public string? FindExecutable()
    {
        var specified = Config("OLLAMA_EXECUTABLE", "");
        if (specified.Length > 0) return File.Exists(specified) ? specified : null;
        var file = OperatingSystem.IsWindows() ? "ollama.exe" : "ollama";
        var candidates = (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator)
            .Where(path => !string.IsNullOrWhiteSpace(path)).Select(path => Path.Combine(path.Trim('"'), file));
        if (OperatingSystem.IsWindows()) candidates = candidates.Prepend(Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Ollama", file));
        return candidates.FirstOrDefault(File.Exists);
    }

    public async Task<OllamaRuntimeStatus> StatusAsync(CancellationToken cancellationToken = default)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(2));
        try
        {
            using var tags = await http.GetFromJsonAsync<JsonDocument>(Host + "/api/tags", timeout.Token);
            var available = tags!.RootElement.GetProperty("models").EnumerateArray()
                .Any(item => item.GetProperty("name").GetString() == Model);
            if (!available) return new(true, false, false, Model, "Chưa tải mô hình " + Model);
            using var running = await http.GetFromJsonAsync<JsonDocument>(Host + "/api/ps", timeout.Token);
            var loaded = running!.RootElement.GetProperty("models").EnumerateArray()
                .Any(item => item.GetProperty("name").GetString() == Model);
            return new(true, true, loaded, Model, loaded ? "Đã nạp mô hình, sẵn sàng trả lời" : "Đã có mô hình; chưa nạp vào bộ nhớ");
        }
        catch (Exception ex) when (ex is HttpRequestException or OperationCanceledException or JsonException or KeyNotFoundException or InvalidOperationException)
        {
            cancellationToken.ThrowIfCancellationRequested();
            return new(false, false, false, Model, "Chưa kết nối được Ollama tại " + Host);
        }
    }

    public async Task<OllamaRuntimeStatus> StartAsync(Action<string> progress, CancellationToken cancellationToken = default)
    {
        var status = await StatusAsync(cancellationToken);
        if (!status.ServerReady)
        {
            if (!Uri.TryCreate(Host, UriKind.Absolute, out var endpoint) || !endpoint.IsLoopback)
                return status with { Message = "Địa chỉ Ollama không phải máy này; hãy khởi động dịch vụ tại " + Host };
            var executable = FindExecutable();
            if (executable is null)
                return status with { Message = "Chưa tìm thấy Ollama. Cài từ https://ollama.com/download/windows rồi bấm phím 1 lại." };
            progress("Đang khởi động dịch vụ Ollama...");
            try
            {
                if (ownedServer is null || ownedServer.HasExited)
                {
                    var start = new ProcessStartInfo(executable)
                    {
                        UseShellExecute = false, CreateNoWindow = true,
                        RedirectStandardOutput = true, RedirectStandardError = true
                    };
                    start.ArgumentList.Add("serve");
                    start.Environment["OLLAMA_HOST"] = endpoint.Authority;
                    ownedServer = Process.Start(start);
                    ownedServer?.BeginOutputReadLine();
                    ownedServer?.BeginErrorReadLine();
                }
                for (var attempt = 0; attempt < 30; attempt++)
                {
                    await Task.Delay(500, cancellationToken);
                    status = await StatusAsync(cancellationToken);
                    if (status.ServerReady) break;
                    if (ownedServer?.HasExited == true) break;
                }
            }
            catch (Exception ex) when (ex is System.ComponentModel.Win32Exception or InvalidOperationException)
            {
                return status with { Message = "Không khởi động được Ollama. Chạy lệnh ollama serve để kiểm tra dịch vụ." };
            }
        }
        if (!status.ServerReady || !status.ModelAvailable) return status;
        progress($"Đang nạp {Model}, ngữ cảnh {ai.ContextSize:N0} đơn vị văn bản...");
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(120));
        try
        {
            // Yêu cầu trống chỉ nạp mô hình, không tạo câu trả lời mẫu hoặc hội thoại giả.
            using var response = await http.PostAsJsonAsync(Host + "/api/generate",
                new { model = Model, stream = false, keep_alive = "10m", options = new { num_ctx = ai.ContextSize } }, timeout.Token);
            if (!response.IsSuccessStatusCode)
                return status with { ModelLoaded = false, Message = "Không nạp được mô hình. Kiểm tra bộ nhớ và cấu hình Ollama." };
            var loaded = await StatusAsync(cancellationToken);
            return loaded.ModelLoaded ? loaded : loaded with { Message = "Ollama chưa xác nhận mô hình đã nạp; bấm 1 để kiểm tra lại." };
        }
        catch (Exception ex) when (ex is HttpRequestException or OperationCanceledException or JsonException)
        {
            cancellationToken.ThrowIfCancellationRequested();
            return status with { ModelLoaded = false, Message = "Nạp mô hình chưa hoàn tất. Máy có thể thiếu bộ nhớ hoặc cần thêm thời gian." };
        }
    }

    public async Task<bool> DownloadAsync(Action<string> progress, CancellationToken cancellationToken = default)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromMinutes(30));
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, Host + "/api/pull")
                { Content = JsonContent.Create(new { model = Model, stream = true }) };
            using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
            if (!response.IsSuccessStatusCode) return false;
            using var reader = new StreamReader(await response.Content.ReadAsStreamAsync(timeout.Token));
            var lastPercent = -1;
            var success = false;
            while (await reader.ReadLineAsync(timeout.Token) is { } line)
            {
                if (string.IsNullOrWhiteSpace(line)) continue;
                using var json = JsonDocument.Parse(line);
                var item = json.RootElement;
                if (item.TryGetProperty("error", out _)) return false;
                success |= item.TryGetProperty("status", out var state) && state.GetString() == "success";
                if (item.TryGetProperty("total", out var total) && total.TryGetInt64(out var size) && size > 0
                    && item.TryGetProperty("completed", out var completed) && completed.TryGetInt64(out var bytes))
                {
                    var percent = (int)Math.Min(100, bytes * 100.0 / size);
                    if (percent != lastPercent) { progress($"Đang tải mô hình: {percent}%"); lastPercent = percent; }
                }
            }
            return success;
        }
        catch (Exception ex) when (ex is HttpRequestException or OperationCanceledException or JsonException)
        {
            cancellationToken.ThrowIfCancellationRequested();
            return false;
        }
    }

    public void StopOwnedServer()
    {
        if (ownedServer is null) return;
        if (!ownedServer.HasExited) { ownedServer.Kill(entireProcessTree: true); ownedServer.WaitForExit(3000); }
        ownedServer.Dispose();
        ownedServer = null;
    }

    public void Dispose() { http.Dispose(); ownedServer?.Dispose(); }
}
