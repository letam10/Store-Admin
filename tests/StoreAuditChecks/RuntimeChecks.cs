using Microsoft.Extensions.Configuration;
using StoreApi.Data;
using StoreApi.Services;

internal static class RuntimeChecks
{
    public static async Task RunAsync(StoreDb db, Action<bool, string> check)
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["OLLAMA_HOST"] = "http://127.0.0.1:11536",
            ["OLLAMA_MODEL"] = "store-qa-model-not-installed:latest",
            ["OLLAMA_EXECUTABLE"] = Path.Combine(Path.GetTempPath(), "store-qa-no-ollama.exe")
        }).Build();
        using var client = new OllamaChatClient();
        var ai = new AiChatService(config, db, client);
        using (var missing = new OllamaRuntime(config, ai))
        {
            check(!(await missing.StatusAsync()).ServerReady, "QA Ollama port is initially unused");
            var state = await missing.StartAsync(_ => { });
            check(!state.ServerReady && state.Message.Contains("Chưa tìm thấy Ollama"), "missing installation reports explicit Vietnamese guidance");
        }
        config["OLLAMA_EXECUTABLE"] = "";
        using var runtime = new OllamaRuntime(config, ai);
        if (runtime.FindExecutable() is null) return;
        try
        {
            var state = await runtime.StartAsync(_ => { });
            check(state.ServerReady && !state.ModelAvailable, "menu runtime starts actual Ollama from stopped state and detects missing model");
            using var shared = new OllamaRuntime(config, ai);
            shared.StopOwnedServer();
            check((await shared.StatusAsync()).ServerReady, "non-owner runtime leaves shared Ollama running");
        }
        finally { runtime.StopOwnedServer(); }
        check(!(await runtime.StatusAsync()).ServerReady, "owner stops only the Ollama process it launched");
    }
}
