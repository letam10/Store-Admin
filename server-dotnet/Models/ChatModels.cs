namespace StoreApi.Models;

public sealed record ChatTurnData(
    string RequestId,
    string UserContent,
    string AssistantContent,
    string Status,
    string SourcesJson,
    string ReportJson,
    string VerifiedJson);
