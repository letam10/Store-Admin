using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using StoreApi.Data;
using StoreApi.Security;
using StoreApi.Services;

var output = args.FirstOrDefault(value => !value.StartsWith("--", StringComparison.Ordinal))
    ?? Path.Combine(Path.GetTempPath(), "StoreVietnameseAudit", DateTime.UtcNow.ToString("yyyyMMddHHmmss"));
Directory.CreateDirectory(output);
if (args.Contains("--ai-current")) { await CurrentAiAudit.RunAsync(output); return; }
var database = Environment.GetEnvironmentVariable("STORE_AUDIT_DATABASE")
    ?? "StoreVietnameseQA_" + DateTime.UtcNow.ToString("yyyyMMddHHmmss");
if (!database.StartsWith("StoreVietnameseQA", StringComparison.Ordinal) || !Regex.IsMatch(database, "^[A-Za-z0-9_]+$"))
    throw new InvalidOperationException("QA_DATABASE_REQUIRED");
var connectionString = $"Server=(localdb)\\MSSQLLocalDB;Database={database};Integrated Security=true;TrustServerCertificate=true;Encrypt=false;MultipleActiveResultSets=true";
var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
{
    ["ConnectionStrings:StoreDb"] = connectionString, ["SEPAY_ENABLED"] = "false", ["SEPAY_API_TOKEN"] = "",
    ["OLLAMA_HOST"] = "http://127.0.0.1:11434", ["OLLAMA_MODEL"] = "qwen3.5:4b",
    ["AI_CONTEXT_SIZE"] = "32768", ["AI_THINKING"] = "medium",
    ["ADMIN_NOTIFICATION_EMAILS"] = "admin1@example.invalid,admin2@example.invalid"
}).Build();
using (var context = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connectionString).Options))
    context.Database.EnsureCreated();
var db = new StoreDb(configuration);
db.SeedDefaultProducts();
object? Sql(string query, params (string Name, object Value)[] parameters)
{
    using var connection = new SqlConnection(connectionString);
    connection.Open();
    using var command = connection.CreateCommand();
    command.CommandText = query;
    foreach (var (name, value) in parameters) command.Parameters.AddWithValue(name, value);
    return command.ExecuteScalar();
}
var checks = new List<string>();
void Check(bool condition, string label)
{
    if (!condition) throw new Exception("FAIL: " + label);
    checks.Add(label);
}
string Fingerprint(string select) => (string)Sql($"SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',CAST(({select} FOR JSON PATH) AS nvarchar(max))),2)")!;
string MoneyFingerprint() => string.Join(':', new[]
{
    Fingerprint("SELECT id,price,stock_count,discount_percent,category,image FROM catalog_products ORDER BY id"),
    Fingerprint("SELECT * FROM customer_orders ORDER BY id"),
    Fingerprint("SELECT id,points,paid_goods_total,spin_credits FROM customers ORDER BY id"),
    Fingerprint("SELECT Id,Price,Category,Image FROM Products ORDER BY Id")
});
var patchPath = Path.Combine(AppContext.BaseDirectory, "shared", "catalog-vietnamese-update.json");
Check(File.Exists(patchPath), "catalog migration included in build output");
using var plan = JsonDocument.Parse(File.ReadAllText(patchPath));
var patches = plan.RootElement.GetProperty("products").EnumerateArray().ToDictionary(item => item.GetProperty("id").GetString()!);
// Chỉ trên database QA: đưa văn bản về trước nâng cấp để thử cả máy mới và máy có dữ liệu cũ.
Sql("DELETE FROM settings WHERE [key]=@key", ("@key", "catalog.vietnamese." + plan.RootElement.GetProperty("version").GetString()));
foreach (var (id, patch) in patches)
    Sql("UPDATE catalog_products SET name=@name,description=@description,features_json=@features WHERE id=@id",
        ("@id", id), ("@name", patch.GetProperty("oldName").GetString()!), ("@description", patch.GetProperty("oldDescription").GetString()!),
        ("@features", patch.GetProperty("oldFeatures").GetRawText()));
Sql("UPDATE catalog_products SET description=N'Mô tả riêng cần giữ' WHERE id='2'; UPDATE catalog_products SET name=N'Tên riêng người quản trị đã sửa' WHERE id='3'");
var before = MoneyFingerprint();
var migrated = db.ApplyVietnameseCatalogText();
Check(migrated.Renamed > 490, "old catalog names migrated");
Check(migrated.PreservedCustomText == 1, "custom description preserved");
Check(migrated.SkippedCustomNames == 1, "custom product name preserved");
Check(MoneyFingerprint() == before, "all IDs prices stocks images categories orders and customer balances unchanged");
Check(db.Catalog().Single(item => item.Id == "2").Description == "Mô tả riêng cần giữ", "saved custom description survives migration");
Check(db.Catalog().Single(item => item.Id == "3").Name == "Tên riêng người quản trị đã sửa", "saved custom name survives migration");
Check(db.ApplyVietnameseCatalogText().Renamed == 0, "migration idempotent");
// Khôi phục hai dữ liệu thử về bản tiếng Việt để kiểm tra giao diện cùng catalog mong muốn.
foreach (var id in new[] { "2", "3" })
    Sql("UPDATE catalog_products SET name=@name,description=@description,features_json=@features WHERE id=@id",
        ("@id", id), ("@name", patches[id].GetProperty("name").GetString()!), ("@description", patches[id].GetProperty("description").GetString()!),
        ("@features", patches[id].GetProperty("features").GetRawText()));
Check(db.Catalog().All(item => item.Name.Length <= 64), "every active title is short");
Check(db.Catalog().All(item => !Regex.IsMatch(item.Name, "[\\u0400-\\u04ff\\u0900-\\u0dff\\u3040-\\u30ff\\u3400-\\u9fff]")), "no foreign script in visible titles");
Check(db.Catalog().Where(item => patches.ContainsKey(item.Id)).All(item => item.Name == patches[item.Id].GetProperty("name").GetString()), "all planned names match exact catalog IDs");
Check(db.CatalogPage(0, 100, "iPhone 13 Pro").Products.Any(item => item.Id == "dummyjson-123"), "admin search finds model kept in description");

var suffix = Guid.NewGuid().ToString("N")[..8];
var password = Tokens.RandomToken(20);
var customerName = "qa_vi_" + suffix;
var adminName = "qa_admin_vi_" + suffix;
var staffName = "qa_staff_vi_" + suffix;
var (salt, hash) = Tokens.HashPassword(password);
var customerId = db.CreateCustomer(customerName, customerName + "@example.invalid", salt, hash);
db.CreateAdmin(adminName, password);
db.SaveStaffAccount(null, staffName, "Nhân viên kiểm tra tiếng Việt", staffName + "@example.invalid", password, true);
db.SavePaymentSettings("manual", "MBBank", "970422", "000012345678", "CUA HANG KIEM THU");
var bank = BankPayment.ReadSettings(db.GetPaymentSettings());
var token = Guid.NewGuid().ToString("N");
var orderId = db.CreateCheckout(new(customerId, token, token, [new("2", "Túi vải đeo vai đa dụng", 1, 10000)],
    "Khách kiểm tra tiếng Việt", "0900000000", "", "pickup", "hcm", 0, 1, 10000, 0, 10000, 0, 10000, [],
    "bronze", "bank_transfer", DateTimeOffset.UtcNow.AddDays(1).ToString("O"), bank));
var proof = new StoreApi.Models.OrderPaidRequest("QA-VI-" + suffix, null, true, 10000, DateTimeOffset.UtcNow.ToString("O"));
db.SettleCheckout(orderId, proof);
db.SettleCheckout(orderId, proof);
var events = db.ReadAdminEvents(0);
Check(events.Count(item => item.Kind == "order:created" && item.Payload.Contains(orderId)) == 1, "new-order notification recorded once");
Check(events.Count(item => item.Kind == "order:paid" && item.Payload.Contains(orderId)) == 1, "confirmed-payment notification recorded once");
Check(events.Where(item => item.Payload.Contains(orderId)).All(item => JsonDocument.Parse(item.Payload).RootElement.TryGetProperty("occurredAt", out _)), "notification records actual timestamp");
db.UpsertProductReview("2", customerId, customerName, 5, "Sản phẩm tốt, tên và mô tả rõ ràng.");
var reviewCount = db.ReadAdminEvents(0).Count(item => item.Kind == "review:created");
db.UpsertProductReview("2", customerId, customerName, 5, "Sản phẩm tốt, tên và mô tả rõ ràng.");
Check(db.ReadAdminEvents(0).Count(item => item.Kind == "review:created") == reviewCount, "same review retry does not duplicate notification");
var firstEvent = events.First(item => item.Payload.Contains(orderId));
Check(db.ReadAdminEvents(firstEvent.Id).All(item => item.Id > firstEvent.Id), "notification reconnect cursor excludes previously delivered events");
Check(VietnameseLabels.Tier("diamond") == "Kim cương" && VietnameseLabels.Status("paid") == "Đã thanh toán"
    && VietnameseLabels.Payment("bank_transfer") == "Chuyển khoản ngân hàng", "export enum labels in Vietnamese");

var receipt = new OrderInvoiceData("QA-RECEIPT-4750", "customer@example.invalid", "Khách kiểm tra", "0900000000",
    "Địa chỉ kiểm tra", "delivery", "bank_transfer", [new("Sản phẩm thử thanh toán", 1, 5000, 5000)],
    5000, 250, 0, 4750, "diamond", "2026-11-13T02:25:41Z", "2026-11-14T02:23:00Z");
var html = EmailTemplates.BuildInvoiceEmailHtml(receipt, "http://localhost:5197");
Check(html.Contains("4.750 ₫") && html.Contains("09:25 · 13/11/2026"), "receipt formats Vietnamese money and UTC+7 dates");
Check(!html.Contains("0912345678") && !html.Contains("STORE MINI MART") && !html.Contains("store.local"), "receipt removes fictional bank and support details");
Check(html.Contains("không cần chuyển thêm tiền") && html.Contains("checkout?order=QA-RECEIPT-4750"), "paid receipt confirms payment and links exact order");
var unsafeHtml = EmailTemplates.BuildInvoiceEmailHtml(receipt with { Recipient = "<script>alert(1)</script>" }, "http://localhost:5197");
Check(!unsafeHtml.Contains("<script>"), "receipt escapes customer supplied markup");
Directory.CreateDirectory(Path.Combine(output, "preview"));
File.WriteAllText(Path.Combine(output, "preview", "invoice.html"), html);
await RuntimeChecks.RunAsync(db, Check);

var fixture = new { database, username = customerName, customerId, admin = adminName, staff = staffName, password,
    api = "http://127.0.0.1:5097", orderId, context = 32768, model = "qwen3.5:4b" };
File.WriteAllText(Path.Combine(output, "qa-fixture.json"), JsonSerializer.Serialize(fixture));
File.WriteAllText(Path.Combine(output, "backend-results.json"), JsonSerializer.Serialize(new { database, passed = checks.Count, checks, migrated }, new JsonSerializerOptions { WriteIndented = true }));
Console.WriteLine(JsonSerializer.Serialize(new { database, passed = checks.Count, checks }));
if (args.Contains("--serve")) await AuditHost.RunAsync(db, configuration, output);
