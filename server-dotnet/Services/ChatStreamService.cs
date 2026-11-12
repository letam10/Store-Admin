using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using StoreApi.Data;
using StoreApi.Models;

namespace StoreApi.Services;

public sealed class ChatStreamService(StoreDb db, AiChatService ai, IHostApplicationLifetime lifetime, ILogger<ChatStreamService> logger)
{
    private readonly ConcurrentDictionary<string, byte> _active = new(StringComparer.OrdinalIgnoreCase);

    public async Task RunAsync(HttpContext http, ChatStreamRequest request, string owner, string kind, CancellationToken cancellationToken)
    {
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, lifetime.ApplicationStopping);
        var ct = linked.Token;
        var message = (request.Message ?? "").Trim();
        var requestId = string.IsNullOrWhiteSpace(request.RequestId) ? Guid.NewGuid().ToString("N") : request.RequestId.Trim();
        if (message.Length is < 1 or > 2000 || !ValidId(requestId))
        {
            await Error(http, "INVALID_CHAT_REQUEST", 400, false, ct);
            return;
        }
        var existing = db.FindChatRequest(owner, requestId);
        var conversation = string.IsNullOrWhiteSpace(request.ConversationId)
            ? existing?.ConversationId ?? kind + "-" + Guid.NewGuid().ToString("N") : request.ConversationId.Trim();
        if (!ValidId(conversation))
        {
            await Error(http, "INVALID_CONVERSATION", 400, false, ct);
            return;
        }
        var conversationGate = "conversation:" + conversation;
        var requestGate = "request:" + owner + ":" + requestId;
        if (!_active.TryAdd(conversationGate, 0))
        {
            await Error(http, "CONVERSATION_BUSY", 409, false, ct);
            return;
        }
        if (!_active.TryAdd(requestGate, 0))
        {
            _active.TryRemove(conversationGate, out _);
            await Error(http, "CONVERSATION_BUSY", 409, false, ct);
            return;
        }
        var text = new StringBuilder();
        AiContext? facts = null;
        var started = false;
        var completed = false;
        try
        {
            existing = db.FindChatRequest(owner, requestId);
            if (existing is not null && (existing.ConversationId != conversation || existing.Kind != kind || existing.UserContent != message))
                throw new AiChatException("IDEMPOTENCY_CONFLICT");
            if (existing?.Status == "completed")
            {
                Start(http);
                await Write(http, new { type = "conversation", conversationId = conversation }, ct);
                await Write(http, new { type = "sources", sources = JsonSerializer.Deserialize<object>(existing.SourcesJson) }, ct);
                if (existing.ReportJson != "null") await Write(http, new { type = "report", report = JsonSerializer.Deserialize<object>(existing.ReportJson) }, ct);
                await Write(http, new { type = "delta", content = existing.AssistantContent }, ct);
                await Write(http, new { type = "done", conversationId = conversation }, ct);
                return;
            }
            var history = db.GetChatTurns(conversation, owner, kind).Where(t => t.RequestId != requestId).ToArray();
            db.SaveChatTurn(conversation, owner, kind, requestId, message, "", "running", null, null, false);
            started = true;
            Start(http);
            await Write(http, new { type = "conversation", conversationId = conversation }, ct);
            facts = ai.Context(message, history, kind == "admin");
            await Write(http, new { type = "sources", sources = facts.Sources }, ct);
            await ai.StreamAsync(message, history, facts, kind == "admin", async chunk =>
            {
                text.Append(chunk);
                await Write(http, new { type = "delta", content = chunk }, ct);
            }, status => Write(http, new { type = "status", status }, ct), ct);
            ct.ThrowIfCancellationRequested();
            db.SaveChatTurn(conversation, owner, kind, requestId, message, text.ToString(), "completed", facts.Sources, facts.Report, false);
            completed = true;
            if (facts.Report is not null) await Write(http, new { type = "report", report = facts.Report }, ct);
            await Write(http, new { type = "done", conversationId = conversation }, ct);
        }
        catch (Exception ex)
        {
            // Không đánh dấu hoàn tất khi model ngắt giữa chừng hoặc DB chưa lưu được.
            var code = ex is AiChatException ? ex.Message : ex is OperationCanceledException ? "CHAT_STOPPED"
                : ex is InvalidOperationException && ex.Message is "CONVERSATION_NOT_FOUND" or "IDEMPOTENCY_CONFLICT" or "CONVERSATION_BUSY" ? ex.Message : "CHAT_FAILED";
            if (started && !completed)
            {
                try { db.SaveChatTurn(conversation, owner, kind, requestId, message, text.ToString(), ct.IsCancellationRequested ? "stopped" : "failed", facts?.Sources, facts?.Report, false); }
                catch (Exception saveError) { logger.LogError(saveError, "Không lưu được trạng thái chat {RequestId}", requestId); }
            }
            if (code == "CHAT_FAILED") logger.LogError(ex, "Lượt chat thất bại {RequestId}", requestId);
            if (!http.RequestAborted.IsCancellationRequested)
                await Error(http, code, code == "CONVERSATION_NOT_FOUND" ? 404 : 409, text.Length > 0, http.RequestAborted);
        }
        finally
        {
            _active.TryRemove(requestGate, out _);
            _active.TryRemove(conversationGate, out _);
        }
    }

    private static bool ValidId(string value) => Regex.IsMatch(value, @"^[A-Za-z0-9_.:-]{1,128}$");
    private static void Start(HttpContext http)
    {
        http.Response.ContentType = "application/x-ndjson; charset=utf-8";
        http.Response.Headers.CacheControl = "no-cache";
        http.Response.Headers["X-Accel-Buffering"] = "no";
    }
    private static async Task Write(HttpContext http, object data, CancellationToken ct)
    {
        await http.Response.WriteAsync(JsonSerializer.Serialize(data) + "\n", ct);
        await http.Response.Body.FlushAsync(ct);
    }
    private static async Task Error(HttpContext http, string code, int status, bool partial, CancellationToken ct)
    {
        if (http.Response.HasStarted) await Write(http, new { type = "error", code, partial, incomplete = partial }, ct);
        else
        {
            http.Response.StatusCode = status;
            await http.Response.WriteAsJsonAsync(new { error = code }, ct);
        }
    }
}
