using Microsoft.AspNetCore.Mvc;
using StoreApi.Data;
using StoreApi.Models;
using StoreApi.Security;
using StoreApi.Services;

namespace StoreApi.Controllers;

[ApiController]
[Route("api/support")]
public sealed class SupportController(StoreDb db, AiChatService ai, ChatStreamService chat) : ControllerBase
{
    private const string Cookie = "store_customer_session";

    [HttpGet("status")]
    public async Task<IActionResult> Status(CancellationToken cancellationToken)
    {
        var status = await ai.GetProviderStatusAsync(cancellationToken);
        return Ok(new { ok = true, service = "support", provider = status.Provider, model = status.Model, reachable = status.Reachable, modelAvailable = status.ModelAvailable });
    }

    [HttpGet("conversations/{conversationId}")]
    public IActionResult Conversation(string conversationId)
    {
        var owner = Owner();
        if (owner is null) return Unauthorized(new { error = "LOGIN_REQUIRED" });
        if (!db.OwnsConversation(conversationId, owner, "support")) return NotFound(new { error = "CONVERSATION_NOT_FOUND" });
        return Ok(new { conversationId, messages = db.GetChatHistory(conversationId, owner, "support"), compactStatus = "not_needed" });
    }

    [HttpPost("chat")]
    public async Task<IActionResult> Chat(ChatStreamRequest request, CancellationToken cancellationToken)
    {
        var owner = Owner();
        if (owner is null) return Unauthorized(new { error = "LOGIN_REQUIRED" });
        var raw = Request.Cookies[Cookie]!;
        if (!Request.Headers.TryGetValue("x-csrf-token", out var token) || token != Tokens.Sha256("customer-csrf:" + raw))
            return StatusCode(403, new { error = "CSRF_INVALID" });
        await chat.RunAsync(HttpContext, request, owner, "support", cancellationToken);
        return new EmptyResult();
    }

    private string? Owner()
    {
        var raw = Request.Cookies[Cookie];
        var customer = string.IsNullOrWhiteSpace(raw) ? null : db.FindCustomerBySession(Tokens.Sha256(raw));
        return customer is null ? null : "customer:" + customer.Value.Id;
    }
}
