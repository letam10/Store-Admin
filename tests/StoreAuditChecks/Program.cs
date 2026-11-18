/*
  FILE NOTE
  - Mục đích: Chương trình kiểm thử tự động (Audit Checks) cho tiếng Việt, DB QA và AI local.
  - Liên kết trực tiếp: CurrentAiAudit.cs, Services/AiChatService.cs, Data/StoreDb.cs
  - Vùng ảnh hưởng khi sửa: Bộ kiểm thử và báo cáo kiểm tra tự động của hệ thống.
*/
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using StoreApi.Data;
using StoreApi.Models;
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
    ["AI_CONTEXT_SIZE"] = "16384", ["AI_THINKING"] = "off",
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
string Fingerprint(string select) => (string?)Sql($"SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',CAST(ISNULL(({select} FOR JSON PATH), '[]') AS nvarchar(max))),2)") ?? "";
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
    "Địa chỉ kiểm tra", "delivery", "bank_transfer", [new("Túi vải Canvas mini đựng phụ kiện", 1, 5000, 5000)],
    5000, 250, 0, 4750, "diamond", "2026-11-13T02:25:41Z", "2026-11-14T02:23:00Z");
var html = EmailTemplates.BuildInvoiceEmailHtml(receipt, "http://localhost:5197");
Check(html.Contains("4.750 ₫") && html.Contains("09:25 · 13/11/2026"), "receipt formats Vietnamese money and UTC+7 dates");
Check(!html.Contains("0912345678") && !html.Contains("STORE MINI MART") && !html.Contains("store.local"), "receipt removes fictional bank and support details");
Check(html.Contains("không cần chuyển thêm tiền") && html.Contains("checkout?order=QA-RECEIPT-4750"), "paid receipt confirms payment and links exact order");
var unsafeHtml = EmailTemplates.BuildInvoiceEmailHtml(receipt with { Recipient = "<script>alert(1)</script>" }, "http://localhost:5197");
Check(!unsafeHtml.Contains("<script>"), "receipt escapes customer supplied markup");
Directory.CreateDirectory(Path.Combine(output, "preview"));
File.WriteAllText(Path.Combine(output, "preview", "invoice.html"), html);

// Kiểm tra dữ liệu sản phẩm và kế thừa ngữ cảnh hội thoại đa lượt trong AI Store Context
var manualPatch = patches["manual-e6573516"];
Check(manualPatch.GetProperty("name").GetString() == "Túi vải Canvas mini đựng phụ kiện", "manual patch has real product name");
Check(!manualPatch.GetProperty("description").GetString()!.Contains("thử thanh toán") && !manualPatch.GetProperty("description").GetString()!.Contains("kiểm tra quy trình"), "manual patch removes test phrases");

var testProduct = db.Catalog().FirstOrDefault(p => p.Id == "manual-e6573516");
if (testProduct is not null)
{
    Check(testProduct.Name == "Túi vải Canvas mini đựng phụ kiện" && testProduct.Price == 5000, "manual-e6573516 updated to real store product");
    Check(!testProduct.Description.Contains("thử thanh toán") && !testProduct.Description.Contains("kiểm tra quy trình"), "manual-e6573516 removes test phrases");
}

var singleFacts = JsonDocument.Parse(AiStoreContext.Build("Cho tôi thông tin về iPhone 13 Pro", [], db, false).Json);
var iPhoneObj = singleFacts.RootElement.GetProperty("catalog").GetProperty("products")[0];
Check(iPhoneObj.TryGetProperty("id", out _) && iPhoneObj.TryGetProperty("name", out _)
    && iPhoneObj.TryGetProperty("price", out _) && iPhoneObj.TryGetProperty("salePrice", out _)
    && iPhoneObj.TryGetProperty("discountPercent", out _) && iPhoneObj.TryGetProperty("stockCount", out _)
    && iPhoneObj.TryGetProperty("category", out _) && iPhoneObj.TryGetProperty("image", out var img)
    && !string.IsNullOrWhiteSpace(img.GetString()) && iPhoneObj.TryGetProperty("description", out _), "product facts contain complete details including image and prices");

var cheapestFacts = JsonDocument.Parse(AiStoreContext.Build("Giá thấp nhất", [], db, false).Json);
var cheapestProducts = cheapestFacts.RootElement.GetProperty("catalog").GetProperty("products");
Check(cheapestProducts.GetArrayLength() >= 5 && cheapestProducts.GetArrayLength() <= 10, "cheapest query returns top products list");

var saleFacts = JsonDocument.Parse(AiStoreContext.Build("Sản phẩm giảm giá", [], db, false).Json);
var saleProducts = saleFacts.RootElement.GetProperty("catalog").GetProperty("products");
Check(saleProducts.GetArrayLength() >= 5 && saleProducts.GetArrayLength() <= 10, "sale query returns top products list");

var turnSale = new ChatTurnData("req-1", "Cửa hàng có sản phẩm nào giảm giá không?", "Có nhiều sản phẩm đang giảm giá.", "completed", "[]", "null", "null");
var multiSale = JsonDocument.Parse(AiStoreContext.Build("Giá thấp nhất", [turnSale], db, false).Json);
Check(multiSale.RootElement.GetProperty("catalog").GetProperty("query").GetProperty("onSale").GetBoolean(), "multi-turn preserves onSale context");

var turnCat = new ChatTurnData("req-2", "Shop có laptop không?", "Shop có các mẫu laptop sau.", "completed", "[]", "null", "null");
var multiCat = JsonDocument.Parse(AiStoreContext.Build("Còn hàng không?", [turnCat], db, false).Json);
Check(multiCat.RootElement.GetProperty("catalog").GetProperty("query").GetProperty("selectedCategory").GetString() == "Laptop", "multi-turn preserves selectedCategory context");

var turnProduct = new ChatTurnData("req-3", "Cho tôi thông tin về iPhone 13 Pro", "Dạ iPhone 13 Pro là mẫu máy...", "completed", "[]", "null", "null");
var multiProduct = JsonDocument.Parse(AiStoreContext.Build("Có màu gì?", [turnProduct], db, false).Json);
var multiProducts = multiProduct.RootElement.GetProperty("catalog").GetProperty("products");
Check(multiProducts.GetArrayLength() == 1 && multiProducts[0].GetProperty("id").GetString() == "dummyjson-123", "multi-turn preserves namedProduct for detail follow-up");

var multiUnrelated = JsonDocument.Parse(AiStoreContext.Build("Thời tiết hôm nay thế nào?", [turnCat], db, false).Json);
Check(!multiUnrelated.RootElement.TryGetProperty("catalog", out _), "multi-turn does not leak catalog into unrelated questions");

var multiMath = JsonDocument.Parse(AiStoreContext.Build("1 + 1 bằng mấy?", [turnCat], db, false).Json);
Check(!multiMath.RootElement.TryGetProperty("catalog", out _), "multi-turn does not leak catalog into math questions");

var todaySaleFacts = JsonDocument.Parse(AiStoreContext.Build("Hôm nay có sản phẩm nào giảm giá không?", [], db, false).Json);
Check(todaySaleFacts.RootElement.TryGetProperty("catalog", out var todaySaleCatalog) && todaySaleCatalog.GetProperty("products").GetArrayLength() > 0, "today query does not block catalog for sale questions");

var todayFollowUpFacts = JsonDocument.Parse(AiStoreContext.Build("Sản phẩm này hôm nay giá bao nhiêu?", [turnProduct], db, false).Json);
Check(todayFollowUpFacts.RootElement.TryGetProperty("catalog", out var todayFollowUpCatalog) && todayFollowUpCatalog.GetProperty("products")[0].GetProperty("id").GetString() == "dummyjson-123", "today follow-up preserves namedProduct context");

var paymentWithProductFacts = JsonDocument.Parse(AiStoreContext.Build("Tôi muốn thanh toán chuyển khoản cho tai nghe Everyday", [], db, false).Json);
Check(paymentWithProductFacts.RootElement.TryGetProperty("catalog", out _) && paymentWithProductFacts.RootElement.TryGetProperty("payment", out _), "payment query with product preserves both catalog and payment");

var allSaleFacts = JsonDocument.Parse(AiStoreContext.Build("Cho tôi xem toàn bộ sản phẩm giảm giá", [], db, false).Json);
Check(allSaleFacts.RootElement.TryGetProperty("catalog", out var allSaleCatalog) && allSaleCatalog.GetProperty("products").GetArrayLength() >= 5, "all sale query returns full sale products");

var turnCheapest = new ChatTurnData("req-cheap-1", "Sản phẩm rẻ nhất hiện nay là gì?", "Sản phẩm rẻ nhất là Túi vải Canvas...", "completed", "[{\"id\":\"catalog-manual-e6573516\",\"label\":\"Túi vải Canvas mini đựng phụ kiện\"}]", "null", "null");

var rank2Facts = JsonDocument.Parse(AiStoreContext.Build("còn sản phẩm giá thấp thứ 2?", [turnCheapest], db, false).Json);
Check(rank2Facts.RootElement.TryGetProperty("catalog", out var rank2Catalog)
    && rank2Catalog.GetProperty("products").GetArrayLength() >= 10
    && rank2Catalog.GetProperty("products")[0].GetProperty("rank").GetInt32() == 1
    && rank2Catalog.GetProperty("products")[1].GetProperty("rank").GetInt32() == 2
    && rank2Catalog.GetProperty("products")[1].GetProperty("salePrice").GetInt64() >= rank2Catalog.GetProperty("products")[0].GetProperty("salePrice").GetInt64(),
    "second lowest price query returns full ranked list with rank 2");

var rank3Facts = JsonDocument.Parse(AiStoreContext.Build("còn sản phẩm thấp thứ 3?", [turnCheapest], db, false).Json);
Check(rank3Facts.RootElement.TryGetProperty("catalog", out var rank3Catalog)
    && rank3Catalog.GetProperty("products").GetArrayLength() >= 10
    && rank3Catalog.GetProperty("products")[2].GetProperty("rank").GetInt32() == 3
    && rank3Catalog.GetProperty("products")[2].GetProperty("salePrice").GetInt64() >= rank3Catalog.GetProperty("products")[1].GetProperty("salePrice").GetInt64(),
    "third lowest price query returns full ranked list with rank 3 and at least 10 items");

var clarify3Facts = JsonDocument.Parse(AiStoreContext.Build("ý tôi là sản phẩm thấp thứ 3 không phải thấp thứ hai hay nhất?", [turnCheapest], db, false).Json);
Check(clarify3Facts.RootElement.TryGetProperty("catalog", out var clarify3Catalog)
    && clarify3Catalog.GetProperty("products").GetArrayLength() >= 10
    && clarify3Catalog.GetProperty("products")[2].GetProperty("rank").GetInt32() == 3,
    "clarification query for third lowest price returns full ranked list");

// Edge case 1: Khách hỏi kiểm tra tồn kho kèm thứ bậc giá "sản phẩm thấp thứ 3 còn không?"
var rank3StockFacts = JsonDocument.Parse(AiStoreContext.Build("sản phẩm thấp thứ 3 còn không?", [turnCheapest], db, false).Json);
Check(rank3StockFacts.RootElement.TryGetProperty("catalog", out var rank3StockCatalog)
    && rank3StockCatalog.GetProperty("products").GetArrayLength() >= 10
    && rank3StockCatalog.GetProperty("products")[2].GetProperty("rank").GetInt32() == 3,
    "rank query with stock phrase preserves full ranked product list");

// Edge case 2: Đa lượt hỏi thứ bậc liên tiếp (Turn 1 -> Turn 2 -> Turn 3 -> Turn 4 hỏi tiếp "còn sản phẩm thứ 4?")
var turnRank2 = new ChatTurnData("req-cheap-2", "còn sản phẩm giá thấp thứ 2?", "Sản phẩm giá thấp thứ 2 là...", "completed", "[]", "null", "null");
var turnRank3 = new ChatTurnData("req-cheap-3", "còn sản phẩm thứ 3?", "Sản phẩm đứng thứ 3 về giá là...", "completed", "[]", "null", "null");
var multiTurnRank4Facts = JsonDocument.Parse(AiStoreContext.Build("còn sản phẩm thứ 4?", [turnCheapest, turnRank2, turnRank3], db, false).Json);
Check(multiTurnRank4Facts.RootElement.TryGetProperty("catalog", out var rank4Catalog)
    && rank4Catalog.GetProperty("products").GetArrayLength() >= 10
    && rank4Catalog.GetProperty("products")[3].GetProperty("rank").GetInt32() == 4,
    "consecutive multi-turn ranking preserves price low order up to rank 4");

var mathFacts = JsonDocument.Parse(AiStoreContext.Build("100x100:10=", [], db, false).Json);
Check(!mathFacts.RootElement.TryGetProperty("catalog", out _), "arithmetic query with x and : does not leak catalog");

await RuntimeChecks.RunAsync(db, Check);

var fixture = new { database, username = customerName, customerId, admin = adminName, staff = staffName, password,
    api = "http://127.0.0.1:5097", orderId, context = 16384, model = "qwen3.5:4b" };
File.WriteAllText(Path.Combine(output, "qa-fixture.json"), JsonSerializer.Serialize(fixture));
File.WriteAllText(Path.Combine(output, "backend-results.json"), JsonSerializer.Serialize(new { database, passed = checks.Count, checks, migrated }, new JsonSerializerOptions { WriteIndented = true }));
Console.WriteLine(JsonSerializer.Serialize(new { database, passed = checks.Count, checks }));
if (args.Contains("--serve")) await AuditHost.RunAsync(db, configuration, output);
