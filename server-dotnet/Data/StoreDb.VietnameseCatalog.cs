using System.Text.Json;

namespace StoreApi.Data;

public sealed partial class StoreDb
{
    private sealed record CatalogTextUpdate(string Id, string OldName, string Name, string OldDescription,
        string Description, string[] OldFeatures, string[] Features);
    private sealed record CatalogTextPlan(string Version, CatalogTextUpdate[] Products);

    public (int Renamed, int PreservedCustomText, int SkippedCustomNames) ApplyVietnameseCatalogText()
    {
        var candidates = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "shared", "catalog-vietnamese-update.json"),
            Path.Combine(Directory.GetCurrentDirectory(), "shared", "catalog-vietnamese-update.json"),
            Path.Combine(Directory.GetCurrentDirectory(), "..", "shared", "catalog-vietnamese-update.json"),
        };
        var path = candidates.FirstOrDefault(File.Exists);
        if (path is null) return (0, 0, 0);
        var plan = JsonSerializer.Deserialize<CatalogTextPlan>(File.ReadAllText(path), CheckoutJson)
            ?? throw new InvalidOperationException("INVALID_CATALOG_TEXT_PLAN");
        if (plan.Products.Length == 0 || plan.Products.Select(item => item.Id).Distinct().Count() != plan.Products.Length
            || plan.Products.Any(item => string.IsNullOrWhiteSpace(item.Name) || item.Name.Length > 64))
            throw new InvalidOperationException("INVALID_CATALOG_TEXT_PLAN");
        var marker = "catalog.vietnamese." + plan.Version;
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        LockCheckout(connection, transaction);
        using (var check = CheckoutCommand(connection, transaction, "SELECT [value] FROM settings WHERE [key]=@key", ("@key", marker)))
            if (check.ExecuteScalar() is not null) { transaction.Commit(); return (0, 0, 0); }
        var renamed = 0;
        var preserved = 0;
        var skipped = 0;
        foreach (var item in plan.Products)
        {
            string currentName;
            string currentDescription;
            string currentFeatures;
            using (var read = CheckoutCommand(connection, transaction,
                "SELECT name,description,features_json FROM catalog_products WHERE id=@id", ("@id", item.Id)))
            using (var reader = read.ExecuteReader())
            {
                if (!reader.Read()) continue;
                currentName = reader.GetString(0);
                currentDescription = reader.IsDBNull(1) ? "" : reader.GetString(1);
                currentFeatures = reader.IsDBNull(2) ? "[]" : reader.GetString(2);
            }
            if (currentName == item.Name) continue;
            if (currentName != item.OldName) { skipped++; continue; }
            var description = currentDescription == item.OldDescription ? item.Description : currentDescription;
            if (description != item.Description) preserved++;
            var features = currentFeatures;
            try
            {
                if ((JsonSerializer.Deserialize<string[]>(currentFeatures) ?? []).SequenceEqual(item.OldFeatures))
                    features = JsonSerializer.Serialize(item.Features);
            }
            catch (JsonException) { preserved++; }
            // Chỉ đổi nội dung: không ghi lại giá, ưu đãi, tồn kho, ảnh hoặc JSON chứng từ đã mua.
            using var update = CheckoutCommand(connection, transaction, """
                UPDATE catalog_products SET name=@name,description=@description,features_json=@features WHERE id=@id;
                UPDATE Products SET Name=@name,
                  Description=CASE WHEN Description=@oldDescription THEN @description ELSE Description END
                WHERE Name=@oldName;
                """, ("@name", item.Name), ("@description", description), ("@features", features), ("@id", item.Id),
                ("@oldName", item.OldName), ("@oldDescription", item.OldDescription));
            update.ExecuteNonQuery();
            renamed++;
        }
        using var done = CheckoutCommand(connection, transaction,
            "INSERT INTO settings([key],[value],updated_at) VALUES(@key,@value,@now)",
            ("@key", marker), ("@value", JsonSerializer.Serialize(new { renamed, preserved, skipped })), ("@now", DateTimeOffset.UtcNow.ToString("O")));
        done.ExecuteNonQuery();
        transaction.Commit();
        return (renamed, preserved, skipped);
    }
}
