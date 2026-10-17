using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using StoreApi.Data;
using StoreApi.Models;
using StoreApi.Services;

namespace StoreApi.Controllers;

[ApiController]
[Route("api/support")]
public sealed class SupportController(StoreDb db, AiChatService aiChatService) : ControllerBase
{
    private const string CustomerCookie = "store_customer_session";

    [HttpGet("status")]
    public async Task<IActionResult> Status(CancellationToken cancellationToken)
    {
        var status = await aiChatService.GetProviderStatusAsync(cancellationToken);
        return Ok(new { ok = true, service = "support", provider = status.Provider, model = status.Model, reachable = status.Reachable, modelAvailable = status.ModelAvailable });
    }

    [HttpGet("conversations/{conversationId}")]
    public IActionResult Conversation(string conversationId)
    {
        var id = (conversationId ?? "").Trim();
        if (string.IsNullOrWhiteSpace(id) || id.Length > 255) return BadRequest(new { error = "INVALID_CONVERSATION" });
        return Ok(new { conversationId = id, messages = Array.Empty<object>() });
    }

    [HttpPost("chat")]
    public async Task Chat(ChatStreamRequest request, CancellationToken cancellationToken)
    {
        var message = (request.Message ?? "").Trim();
        if (string.IsNullOrWhiteSpace(message))
        {
            Response.StatusCode = StatusCodes.Status400BadRequest;
            Response.ContentType = "application/json";
            await Response.WriteAsync("{\"error\":\"EMPTY_MESSAGE\"}", cancellationToken);
            return;
        }

        string? customerName = null;
        var raw = Request.Cookies[CustomerCookie];
        if (!string.IsNullOrWhiteSpace(raw))
        {
            var customer = db.FindCustomerBySession(Security.Tokens.Sha256(raw));
            if (customer != null) customerName = customer.Value.Username;
        }

        var convId = string.IsNullOrWhiteSpace(request.ConversationId)
            ? "supp-conv-" + Guid.NewGuid().ToString("N")[..8]
            : request.ConversationId.Trim();

        Response.ContentType = "application/x-ndjson; charset=utf-8";
        Response.Headers.CacheControl = "no-cache";
        Response.Headers.Append("X-Accel-Buffering", "no");

        // 1. conversation event
        await WriteNdjsonAsync(Response, new { type = "conversation", conversationId = convId }, cancellationToken);

        // 2. status event
        await WriteNdjsonAsync(Response, new { type = "status", status = "generating" }, cancellationToken);

        var chatRes = await aiChatService.ProcessCustomerChatAsync(message, db, customerName, cancellationToken);

        // 3. sources event
        if (chatRes.Sources.Count > 0)
        {
            await WriteNdjsonAsync(Response, new { type = "sources", sources = chatRes.Sources }, cancellationToken);
        }

        // 4. verified event
        await WriteNdjsonAsync(Response, new { type = "verified", verified = chatRes.Verified }, cancellationToken);

        // 5. delta chunks
        foreach (var chunk in chatRes.Chunks)
        {
            if (cancellationToken.IsCancellationRequested) break;
            await WriteNdjsonAsync(Response, new { type = "delta", content = chunk }, cancellationToken);
            await Task.Delay(20, cancellationToken);
        }

        // 6. done event
        await WriteNdjsonAsync(Response, new { type = "done", conversationId = convId }, cancellationToken);
    }

    private static async Task WriteNdjsonAsync(HttpResponse response, object data, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(data);
        await response.WriteAsync(json + "\n", ct);
        await response.Body.FlushAsync(ct);
    }
}

