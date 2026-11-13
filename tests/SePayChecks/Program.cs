using System.Globalization;
using System.Net;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using StoreApi.Data;
using StoreApi.Models;
using StoreApi.Security;
using StoreApi.Services;

var output = args.LastOrDefault(arg => !arg.StartsWith("--", StringComparison.Ordinal));
var database = "StoreSePayQA_" + DateTime.UtcNow.ToString("yyyyMMdd_HHmmss") + "_" + Guid.NewGuid().ToString("N")[..6];
var connectionString = $"Server=(localdb)\\MSSQLLocalDB;Database={database};Integrated Security=true;TrustServerCertificate=true;Encrypt=false;MultipleActiveResultSets=true";
var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
{
    ["ConnectionStrings:StoreDb"] = connectionString, ["SEPAY_ENABLED"] = "true", ["SEPAY_API_TOKEN"] = "qa-only-never-sent-to-network",
    ["ADMIN_NOTIFICATION_EMAILS"] = "admin1@example.invalid,admin2@example.invalid"
}).Build();
using (var context = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connectionString).Options))
    context.Database.EnsureCreated();
var db = new StoreDb(config);
var bank = new BankAccount("MBBank", "970422", "000012345678", "STORE QA");
db.SavePaymentSettings("manual", bank.BankName, bank.BankBin, bank.AccountNumber, bank.AccountName);
db.CreateCatalogProduct("qa-a", "Hàng QA", "QA", 5000, "QA", "/products/bag.svg", [], "", "", "", 500);
db.CreateCatalogProduct("qa-z", "Hàng QA thay thế", "QA", 10000, "QA", "/products/bag.svg", [], "", "", "", 500);
var checks = new List<string>();
long nextTransaction = 100;
void Check(bool condition, string name)
{
    if (!condition) throw new Exception("FAIL: " + name);
    checks.Add(name);
}
object? Sql(string sql, params (string Name, object Value)[] values)
{
    using var connection = new SqlConnection(connectionString);
    connection.Open();
    using var command = connection.CreateCommand();
    command.CommandText = sql;
    foreach (var (name, value) in values) command.Parameters.AddWithValue(name, value);
    return command.ExecuteScalar();
}
long Count(string sql, params (string Name, object Value)[] values) => Convert.ToInt64(Sql(sql, values));
void Reject(Action action, string expected)
{
    try { action(); throw new Exception("Did not reject " + expected); }
    catch (InvalidOperationException ex) { Check(ex.Message == expected, "reject " + expected); }
}
(string Id, long Customer) NewOrder(BankAccount? target = null, bool twoItems = false)
{
    var suffix = Guid.NewGuid().ToString("N");
    var customer = db.CreateCustomer("qa_" + suffix, suffix + "@example.invalid", "QA", "QA");
    var total = twoItems ? 15000 : 5000;
    var items = new List<CheckoutLine> { new("qa-a", "Hàng QA", 1, 5000) };
    if (twoItems) items.Add(new("qa-z", "Hàng QA thay thế", 1, 10000));
    var id = db.CreateCheckout(new(customer, suffix, suffix, items, "Khách QA", "0900000000", "", "pickup", "hcm", 0, 1,
        total, 0, total, 0, total, [], "bronze", "bank_transfer", DateTimeOffset.UtcNow.AddDays(1).ToString("O"), target ?? bank));
    return (id, customer);
}
SePayTransfer Transfer(string id, long amount = 5000, DateTimeOffset? received = null)
{
    var number = Interlocked.Increment(ref nextTransaction);
    var row = JsonSerializer.SerializeToElement(new
    {
        id = number.ToString(), bank_brand_name = "MBBank", account_number = bank.AccountNumber,
        transaction_date = (received ?? DateTimeOffset.UtcNow).ToOffset(TimeSpan.FromHours(7)).ToString("yyyy-MM-dd HH:mm:ss"),
        amount_in = amount.ToString(CultureInfo.InvariantCulture) + ".00", amount_out = "0.00",
        transaction_content = "IBFT " + id + " chuyen tien", reference_number = "QA-FT-" + number
    });
    return SePayClient.Parse(row);
}
var order = NewOrder();
var transfer = Transfer(order.Id);
Check(db.ImportSePayTransfer(transfer, bank) == "paid", "correct transfer settles order");
Check(db.FindCheckout(order.Id)!.State == "paid", "paid persisted");
Check(Count("SELECT points FROM customers WHERE id=@id", ("@id", order.Customer)) == 5, "points once");
Check(Count("SELECT COUNT(*) FROM notification_outbox WHERE job_key LIKE @key", ("@key", "invoice:%:" + order.Id + "%")) == 3, "customer and two admin outbox jobs");
await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => Task.Run(() => db.ImportSePayTransfer(transfer, bank))));
Check(Count("SELECT COUNT(*) FROM sepay_transactions WHERE transaction_id=@id", ("@id", transfer.Id)) == 1, "concurrent duplicate imported once");
Check(Count("SELECT points FROM customers WHERE id=@id", ("@id", order.Customer)) == 5, "parallel retry no duplicate points");
Reject(() => db.ImportSePayTransfer(transfer with { Amount = 1 }, bank), "SEPAY_TRANSACTION_CONFLICT");
Check(db.ImportSePayTransfer(Transfer(order.Id), bank) == "review", "second actual transfer needs review");
Check(db.FindCheckout(order.Id)!.State == "paid", "duplicate money does not cancel paid order");
var wrong = NewOrder();
Check(db.ImportSePayTransfer(Transfer(wrong.Id, 4999), bank) == "review", "wrong amount held for review");
Check(db.FindCheckout(wrong.Id)!.State == "needs_review", "customer sees review state");
Check(Count("SELECT points FROM customers WHERE id=@id", ("@id", wrong.Customer)) == 0, "wrong amount no points");
var untouched = NewOrder();
Check(db.ImportSePayTransfer(Transfer(untouched.Id) with { Incoming = false }, bank) == "ignored", "outgoing ignored");
Check(db.ImportSePayTransfer(Transfer(untouched.Id) with { Account = "999999999" }, bank) == "ignored", "foreign account ignored");
Check(db.ImportSePayTransfer(Transfer(untouched.Id) with { Bank = "ACB" }, bank) == "ignored", "foreign bank ignored");
Check(db.FindCheckout(untouched.Id)!.State == "pending", "ignored transfer cannot pay");
Check(db.ImportSePayTransfer(Transfer("KHONG-CO-MA"), bank) == "review", "unidentified money retained");
Check(db.ImportSePayTransfer(Transfer(order.Id + " " + untouched.Id), bank) == "review", "ambiguous order codes rejected");
var cancelled = NewOrder();
db.CancelCheckout(cancelled.Id);
Check(db.ImportSePayTransfer(Transfer(cancelled.Id), bank) == "review", "explicitly cancelled order not reopened");
var otherBank = NewOrder(bank with { AccountNumber = "999999999" });
Check(db.ImportSePayTransfer(Transfer(otherBank.Id), bank) == "review", "locked bank snapshot enforced");
var second = NewOrder();
Check(db.ImportSePayTransfer(Transfer(second.Id) with { Reference = transfer.Reference }, bank) == "review", "bank reference cannot pay two orders");
DateTimeOffset Expire((string Id, long Customer) entry)
{
    var start = DateTimeOffset.UtcNow.AddMinutes(-10);
    Sql("UPDATE customer_orders SET created_at=@start WHERE id=@id; UPDATE checkout_intents SET expires_at=@end WHERE order_id=@id",
        ("@start", start.ToString("O")), ("@end", start.AddMinutes(2)), ("@id", entry.Id));
    db.ExpireCheckouts();
    return start.AddMinutes(1);
}
var delayed = NewOrder();
var onTime = Expire(delayed);
Check(db.FindCheckout(delayed.Id)!.State == "expired", "expiry releases unpaid session");
Check(db.ImportSePayTransfer(Transfer(delayed.Id, 5000, onTime), bank) == "paid", "delayed sync accepts money received within window");
var late = NewOrder();
Expire(late);
Check(db.ImportSePayTransfer(Transfer(late.Id), bank) == "review", "late bank receipt not mistaken for on-time");
var exhausted = NewOrder(twoItems: true);
var exhaustedTime = Expire(exhausted);
Sql("UPDATE catalog_products SET stock_count=0 WHERE id='qa-z'");
var beforeStock = Count("SELECT stock_count FROM catalog_products WHERE id='qa-a'");
Check(db.ImportSePayTransfer(Transfer(exhausted.Id, 15000, exhaustedTime), bank) == "review", "missing stock preserves real money for review");
Check(Count("SELECT stock_count FROM catalog_products WHERE id='qa-a'") == beforeStock, "partial stock reservation rolled back");
Check(Count("SELECT COUNT(*) FROM bank_payment_receipts WHERE order_id=@id", ("@id", exhausted.Id)) == 0, "failed settlement leaves no false receipt");
Sql("UPDATE catalog_products SET stock_count=500 WHERE id='qa-z'");
var manuallyPaid = NewOrder();
var manualProof = Transfer(manuallyPaid.Id);
db.SettleCheckout(manuallyPaid.Id, new(manualProof.Reference, null, true, 5000, manualProof.ReceivedAt.ToString("O")));
Check(db.ImportSePayTransfer(manualProof, bank) == "paid", "manual then automatic same receipt stays idempotent");
Check(Count("SELECT points FROM customers WHERE id=@id", ("@id", manuallyPaid.Customer)) == 5, "manual and auto do not duplicate reward");

db.AdvanceFulfillment(order.Id, "ready");
db.AdvanceFulfillment(order.Id, "delivered");
var createdCase = JsonSerializer.SerializeToElement(db.CreateAfterSalesCase(order.Customer, order.Id,
    new("exchange", "Đổi hàng kiểm thử SePay", null, [new("qa-z", 1)])), new JsonSerializerOptions(JsonSerializerDefaults.Web));
var caseId = createdCase.GetProperty("id").GetString()!;
AfterSalesActionRequest Action(string action, bool? received = null) => new(action, null, null, received, null, null, null);
db.CustomerAfterSalesAction(order.Customer, caseId, Action("confirm"));
var actor = new StoreDb.AdminActor(1, "QA", "admin");
db.AdminAfterSalesAction(actor, caseId, Action("approve"));
db.AdminAfterSalesAction(actor, caseId, Action("receive_return", true));
var feeWindow = JsonSerializer.SerializeToElement(db.AfterSalesPaymentWindow(caseId, order.Customer));
var feeAmount = feeWindow.GetProperty("amount").GetInt64();
var fee = Transfer(caseId, feeAmount);
Check(db.ImportSePayTransfer(fee, bank) == "paid", "exchange fee automatically settled");
Check(db.ImportSePayTransfer(fee, bank) == "paid", "exchange retry safe");
Check(Count("SELECT extra_paid FROM customer_orders WHERE id=@id", ("@id", order.Id)) == feeAmount, "exchange extra payment once");
Check(db.ImportSePayTransfer(Transfer(caseId, feeAmount), bank) == "review", "second exchange transfer retained");

var handler = new FakeSePayHandler(bank.AccountNumber);
using var http = new HttpClient(handler);
var client = new SePayClient(http, config);
var worker = new SePayWorker(db, client, NullLogger<SePayWorker>.Instance);
var apiOrder = NewOrder();
var apiTransfer = Transfer(apiOrder.Id);
handler.Transfers = [apiTransfer];
await worker.SyncOnceAsync(CancellationToken.None);
Check(db.FindCheckout(apiOrder.Id)!.State == "paid", "worker API parser to SQL settlement end to end");
Check(JsonSerializer.SerializeToElement(db.SePayStatus()).GetProperty("healthy").GetBoolean(), "health after successful sync");
Check(handler.Requests == 2, "linked account checked before transactions");
Check(handler.AllRequestsAuthenticated, "all API calls have bearer token");
Check(handler.AllRequestsReadOnly, "integration only makes GET requests");
await worker.SyncOnceAsync(CancellationToken.None);
Check(Count("SELECT points FROM customers WHERE id=@id", ("@id", apiOrder.Customer)) == 5, "poll replay safe");
var checkpoint = db.GetSetting("sepay.sync." + bank.AccountNumber);
handler.Status = HttpStatusCode.Unauthorized;
try { await worker.SyncOnceAsync(CancellationToken.None); throw new Exception("Auth failure not raised"); }
catch (InvalidOperationException ex) { Check(ex.Message == "SEPAY_AUTH_FAILED", "bad API key rejected"); }
Check(db.GetSetting("sepay.sync." + bank.AccountNumber) == checkpoint, "failed API call cannot advance checkpoint");
handler.Status = HttpStatusCode.TooManyRequests;
try { await client.ReadAsync(bank.AccountNumber, DateTimeOffset.UtcNow, CancellationToken.None); throw new Exception("429 not raised"); }
catch (InvalidOperationException ex) { Check(ex.Message == "SEPAY_RATE_LIMIT", "rate limit surfaced"); }
var invalid = JsonSerializer.SerializeToElement(new { id = "1", amount_in = "1.5", amount_out = "0" });
Reject(() => SePayClient.Parse(invalid), "SEPAY_INVALID_AMOUNT");
Check(apiTransfer.ReceivedAt.Offset == TimeSpan.FromHours(7), "provider time uses Vietnam UTC+7");
Check(!AdminAccessFilter.StaffAllowed("SePayStatus", null, null), "bank feed stays admin-only");
Check(!new SePayClient(http, new ConfigurationBuilder().Build()).Enabled, "no credentials means disabled");
var aiContext = AiStoreContext.Build("Thanh toán", [], db, false).Json;
using (var facts = JsonDocument.Parse(aiContext))
    Check(facts.RootElement.GetProperty("payment").GetProperty("automaticBankDetection").GetBoolean(), "AI context reflects actual automatic payment configuration");
Check(!aiContext.Contains("qa-only-never-sent-to-network", StringComparison.Ordinal), "AI context cannot disclose provider token");

Console.WriteLine(JsonSerializer.Serialize(new { passed = checks.Count, checks, database }));
if (output is not null)
{
    Directory.CreateDirectory(output);
    File.WriteAllText(Path.Combine(output, "backend-results.json"), JsonSerializer.Serialize(new { passed = checks.Count, checks, database }, new JsonSerializerOptions { WriteIndented = true }));
}
if (args.Contains("--serve")) await QaHost.RunAsync(db, config, bank, output ?? throw new Exception("QA output directory required"));

public sealed class FakeSePayHandler(string account) : HttpMessageHandler
{
    public IReadOnlyList<SePayTransfer> Transfers { get; set; } = [];
    public HttpStatusCode Status { get; set; } = HttpStatusCode.OK;
    public int Requests { get; private set; }
    public bool AllRequestsAuthenticated { get; private set; } = true;
    public bool AllRequestsReadOnly { get; private set; } = true;
    public string? FeedPath { get; set; }
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Requests++;
        AllRequestsAuthenticated &= request.Headers.Authorization?.Scheme == "Bearer";
        AllRequestsReadOnly &= request.Method == HttpMethod.Get && request.RequestUri?.Host == "my.sepay.vn";
        object payload;
        if (request.RequestUri!.AbsolutePath.Contains("bankaccounts", StringComparison.Ordinal))
            payload = new { status = 200, bankaccounts = new[] { new { account_number = account, bank_bin = "970422", active = "1" } } };
        else if (FeedPath is not null && File.Exists(FeedPath))
            return Task.FromResult(new HttpResponseMessage(Status) { Content = new StringContent(File.ReadAllText(FeedPath)) });
        else payload = new { status = 200, transactions = Transfers.Select(item => new
        {
            id = item.Id.ToString(), bank_brand_name = item.Bank, account_number = item.Account, transaction_content = item.Content,
            reference_number = item.Reference, amount_in = item.Incoming ? item.Amount.ToString() + ".00" : "0.00",
            amount_out = item.Incoming ? "0.00" : item.Amount.ToString() + ".00",
            transaction_date = item.ReceivedAt.ToOffset(TimeSpan.FromHours(7)).ToString("yyyy-MM-dd HH:mm:ss")
        }) };
        return Task.FromResult(new HttpResponseMessage(Status) { Content = new StringContent(JsonSerializer.Serialize(payload)) });
    }
}
