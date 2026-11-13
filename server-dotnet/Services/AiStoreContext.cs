using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using StoreApi.Data;
using StoreApi.Models;

namespace StoreApi.Services;

public sealed record AiContext(string Json, IReadOnlyList<object> Sources, object? Report);

public static class AiStoreContext
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    public static string Normalize(string text)
    {
        var decomposed = text.ToLowerInvariant().Replace('đ', 'd').Normalize(NormalizationForm.FormD);
        return new string(decomposed.Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark).ToArray());
    }

    public static long SalePrice(CatalogProduct item) => (long)decimal.Round(
        item.Price * (100 - item.DiscountPercent) / 1000m, 0, MidpointRounding.ToEven) * 10;

    private static object Product(CatalogProduct item) => new
    {
        item.Id, item.Name, category = VietnameseLabels.Category(item.Category), originalPriceVnd = item.Price, priceVnd = SalePrice(item),
        item.DiscountPercent, item.StockCount, stockUnit = "sản phẩm", url = "/products/" + Uri.EscapeDataString(item.Id),
        description = item.Description.Length <= 350 ? item.Description : item.Description[..350]
    };

    private static CatalogProduct[] MentionedProducts(IReadOnlyList<CatalogProduct> catalog, string query)
    {
        var wantsCase = Regex.IsMatch(query, @"\bop\b");
        var scored = catalog.Where(product => !wantsCase || Normalize(product.Name).StartsWith("op ", StringComparison.Ordinal))
            .Select(product => new { Product = product, Score = MentionScore(product, query, wantsCase) }).Where(item => item.Score > 0).ToArray();
        if (scored.Length == 0) return [];
        var highest = scored.Max(item => item.Score);
        return scored.Where(item => item.Score == highest).Select(item => item.Product).ToArray();
    }

    private static int MentionScore(CatalogProduct product, string query, bool includeCompatibility)
    {
        var aliases = new List<string> { product.Name };
        var lines = product.Description.Split('\n', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        var brandLine = lines.FirstOrDefault(line => line.StartsWith("Thương hiệu:", StringComparison.Ordinal));
        var brand = brandLine is null ? "" : brandLine[(brandLine.IndexOf(':') + 1)..].Trim().TrimEnd('.');
        foreach (var line in lines)
        {
            if (!line.StartsWith("Mã hoặc tên mẫu:", StringComparison.Ordinal)
                && !(includeCompatibility && line.StartsWith("Thiết bị tương thích:", StringComparison.Ordinal))) continue;
            var alias = line[(line.IndexOf(':') + 1)..].Trim().TrimEnd('.');
            aliases.Add(alias);
            if (brand.Length > 0 && alias.StartsWith(brand + " ", StringComparison.OrdinalIgnoreCase)) aliases.Add(alias[(brand.Length + 1)..]);
        }
        return aliases.Select(Normalize).Where(alias => alias.Length >= 3 && query.Contains(alias, StringComparison.Ordinal))
            .Select(alias => alias.Length).DefaultIfEmpty(0).Max();
    }

    public static AiContext Build(string message, IReadOnlyList<ChatTurnData> history, StoreDb db, bool admin)
    {
        // Lỗi DB phải báo lỗi, không biến thành thông tin sai rằng cửa hàng không còn sản phẩm.
        var catalog = db.Catalog();
        var appearance = db.Appearance();
        var vouchers = db.PublicAiVouchers();
        var online = db.OnlineSupportStaff();
        var bankSync = JsonSerializer.SerializeToElement(db.SePayStatus());
        var now = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7));
        var query = Normalize(message);
        var nextMonthOnly = (query.Contains("thang sau") || query.Contains("thang sao"))
            && !query.Contains("thang nay") && !query.Contains("hien tai");
        var stockQuestion = query.Contains("het hang") || query.Contains("het kho");
        var mentioned = MentionedProducts(catalog, query);
        var namedProduct = mentioned.Length == 1 ? mentioned[0] : null;
        var categories = catalog.Select(p => p.Category).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var selectedCategory = categories.OrderByDescending(c => c.Length)
            .FirstOrDefault(c => query.Contains(Normalize(c), StringComparison.Ordinal));
        if (query.Contains("may tinh xach tay", StringComparison.Ordinal) && categories.Contains("Laptop")) selectedCategory = "Laptop";
        var onSale = query.Contains("giam gia") || query.Contains("sale");
        var cheapest = query.Contains("thap nhat") || query.Contains("re nhat");
        var expensive = query.Contains("cao nhat") || query.Contains("dat nhat") || query.Contains("mac nhat");
        var similar = query.Contains("tuong tu") || query.Contains("thay the");
        var countMatch = Regex.Match(query, @"\b(\d{1,2})\s+(san pham|mat hang|mon)\b");
        var count = countMatch.Success ? Math.Clamp(int.Parse(countMatch.Groups[1].Value), 1, 12) : cheapest || expensive ? 1 : 6;
        IEnumerable<CatalogProduct> matches = mentioned.Length > 1 ? mentioned : catalog;
        if (selectedCategory is not null) matches = matches.Where(p => p.Category.Equals(selectedCategory, StringComparison.OrdinalIgnoreCase));
        if (onSale) matches = matches.Where(p => p.DiscountPercent > 0 && p.StockCount > 0);

        CatalogProduct? anchor = null;
        if (similar)
        {
            // Ưu tiên sản phẩm được khách gọi tên; chỉ dùng lượt trước khi khách nói tiếp về sản phẩm đó.
            var referenceText = new[] { message }.Concat(history.Reverse().SelectMany(t => new[] { t.UserContent, t.AssistantContent }));
            foreach (var text in referenceText)
            {
                var normalized = Normalize(text);
                var candidates = MentionedProducts(catalog, normalized);
                anchor = candidates.Length == 1 ? candidates[0] : null;
                if (anchor is not null) break;
            }
            if (anchor is null) matches = [];
            else
            {
                var words = Regex.Matches(Normalize(anchor.Name), @"[a-z0-9]+").Select(m => m.Value).ToArray();
                var generic = new HashSet<string>("cho voi cua mau size nam nu mot va hang loai".Split(' '));
                var pairs = words.Zip(words.Skip(1), (a, b) => a + " " + b)
                    .Where(pair => !pair.Split(' ').Any(generic.Contains)).ToArray();
                var candidates = catalog.Where(p => p.Id != anchor.Id && p.StockCount > 0)
                    .Select(p => new { Item = p, Score = pairs.Count(pair => Normalize(p.Name).Contains(pair, StringComparison.Ordinal)) }).ToArray();
                var functionalMatches = candidates.Where(p => p.Score > 0).ToArray();
                matches = (functionalMatches.Length > 0 ? functionalMatches : candidates.Where(p => p.Item.Category == anchor.Category))
                    .OrderByDescending(p => p.Score).ThenBy(p => Math.Abs(SalePrice(p.Item) - SalePrice(anchor))).Select(p => p.Item);
            }
        }
        else if (cheapest || expensive)
            matches = cheapest ? matches.OrderBy(SalePrice).ThenBy(p => p.Id) : matches.OrderByDescending(SalePrice).ThenBy(p => p.Id);
        else if (namedProduct is not null) matches = [namedProduct];
        else
        {
            var ignored = new HashSet<string>("toi minh ban cho voi cua la co va hay nhung cac mot ve nay nao giup xin hoi store san pham hien tai hang hoa dang bao nhieu tim vai giam gia nhat".Split(' '));
            var terms = Regex.Matches(query, @"[a-z0-9]+").Select(m => m.Value).Where(t => t.Length > 1 && !ignored.Contains(t)).Distinct().ToArray();
            var scored = matches.Select(p => new { Item = p, Score = terms.Count(t => Regex.IsMatch(Normalize(p.Name + " " + p.Category + " " + p.Description), @"\b" + Regex.Escape(t) + @"\b")) }).ToArray();
            if (scored.Any(p => p.Score > 0) && selectedCategory is null && !onSale)
                matches = scored.Where(p => p.Score > 0).OrderByDescending(p => p.Item.Id == namedProduct?.Id)
                    .ThenByDescending(p => p.Score).ThenByDescending(p => p.Item.StockCount > 0).Select(p => p.Item);
            else if (onSale) matches = matches.OrderByDescending(p => p.DiscountPercent).ThenBy(SalePrice);
            else matches = matches.OrderByDescending(p => p.StockCount > 0).ThenBy(p => p.Id);
        }
        var matching = matches.ToArray();
        var selected = matching.Take(count).ToArray();
        var contactKeys = new[] { "brandName", "contactAddress", "contactPhone", "contactEmail", "contactHours" };
        var contact = contactKeys.ToDictionary(key => key, key => appearance.TryGetValue(key, out var value) ? value : null);
        object? report = null;
        if (admin && new[] { "doanh thu", "bao cao", "thong ke", "loi nhuan" }.Any(query.Contains))
            report = db.CalculateAdminRevenue(now.AddDays(-30).ToString("yyyy-MM-dd"), now.ToString("yyyy-MM-dd"));
        var facts = new
        {
            observedAt = now.ToString("O"), today = now.ToString("dd/MM/yyyy"), timeZone = "Asia/Ho_Chi_Minh", currency = "VND",
            assistant = new { name = "Trợ lý AI của Store", canBrowseWithoutPurchase = true,
                purchaseObligation = "Khách được xem website, hỏi tư vấn và rời đi mà không bắt buộc mua hàng", canExecuteTransactions = false },
            contact,
            catalog = new
            {
                total = catalog.Count, available = catalog.Count(p => p.StockCount > 0), outOfStock = catalog.Count(p => p.StockCount == 0),
                categories = catalog.GroupBy(p => p.Category).Select(g => new { name = VietnameseLabels.Category(g.Key), count = g.Count(), available = g.Count(p => p.StockCount > 0) }),
                saleCount = catalog.Count(p => p.DiscountPercent > 0 && p.StockCount > 0),
                minimum = catalog.OrderBy(SalePrice).Take(1).Select(Product), maximum = catalog.OrderByDescending(SalePrice).Take(1).Select(Product),
                query = new { selectedCategory, onSale, cheapest, expensive, similar, requestedCount = count, ambiguousProductName = mentioned.Length > 1,
                    matchingCount = matching.Length, needsProductName = similar && anchor is null },
                referenceProduct = anchor is null ? null : Product(anchor),
                products = stockQuestion && namedProduct is null ? [] : selected.Select(Product),
                restockSchedule = (string?)null,
                stockPolicy = new { checkoutRequiresAvailableStock = true, reserveOutOfStockSupported = false,
                    similarProductSearchAvailable = true, restockInquiryPage = "/contact", restockDateGuaranteed = false }
            },
            publicVouchers = new { activeCount = vouchers.Count, items = vouchers, scope = "Mã công khai còn hạn, không gồm mã riêng của khách" },
            promotions = new { month = now.ToString("MM/yyyy"),
                requestedMonth = (query.Contains("thang sau") || query.Contains("thang sao") ? now.AddMonths(1) : now).ToString("MM/yyyy"),
                availableNowSaleProducts = catalog.Count(p => p.DiscountPercent > 0 && p.StockCount > 0),
                availableNowPublicVouchers = vouchers.Count, scheduledMonthlyCampaigns = (object?)null, nextMonthCampaigns = (object?)null },
            support = new { onlineCount = online.Count, people = online, presenceSeconds = StoreDb.PresenceWindowSeconds,
                contactPage = "/contact", instantReplyGuaranteed = false },
            payment = new { methods = new[] { "Chuyển khoản VietQR", "Tiền mặt tại cửa hàng khi nhận trực tiếp", "COD khi giao hàng" },
                transferExpiryMinutes = 2, automaticBankDetection = bankSync.GetProperty("configured").GetBoolean(),
                bankSyncHealthy = bankSync.GetProperty("healthy").GetBoolean(), bankSyncIntervalSeconds = SePayClient.IntervalSeconds,
                confirmationPolicy = new
                {
                    mode = bankSync.GetProperty("configured").GetBoolean() ? "Hệ thống tự động xác nhận giao dịch ngân hàng khớp đơn" : "Cửa hàng đối soát thủ công",
                    matchedTransferConditions = "Đúng tài khoản nhận, mã đơn, số tiền và thời hạn thanh toán; đơn còn hợp lệ và đủ tồn kho",
                    confirmationEvidence = "Giao dịch tiền vào do SePay cung cấp, không lấy lời khách báo làm bằng chứng đã nhận tiền",
                    automaticResult = "Đơn chuyển sang đã thanh toán; điểm, biên nhận và thông báo được cập nhật một lần",
                    reviewRequiredFor = "Tiền thiếu hoặc dư, nội dung không khớp, chuyển ngoài hạn, đơn đã hủy hoặc không còn đủ hàng",
                    timing = "Có độ trễ đồng bộ, không phải ngay tại thời điểm ứng dụng ngân hàng báo thành công"
                },
                reportTransferIsNotConfirmation = true,
                savedQrCannotBlockBankTransferAfterExpiry = true, paidOrdersOnlyInPurchaseHistory = true,
                zeroDueAfterVouchers = "Đơn 0đ được xác nhận ngay bằng voucher, không cần chuyển tiền hoặc QR",
                lateOrIncorrectTransferRequiresStoreReview = true },
            afterSales = new { limits = AfterSalesPolicy.Description, methods = "Cả online và offline đều được yêu cầu đổi/trả từ tài khoản > đơn đã thanh toán > dịch vụ sau mua",
                returnDeadline = $"Chỉ trong vòng tối đa {AfterSalesPolicy.ReturnDays} ngày kể từ khi giao thành công. Quá hạn thì không được gửi yêu cầu đổi/trả; không phải chờ đủ 7 ngày",
                cancelBeforeShipping = true,
                returnRefund = "Tiền hàng; không hoàn phí giao ban đầu. Khách thanh toán cước gửi trả cho đơn vị vận chuyển",
                exchange = "Đổi sang sản phẩm khác; bù/hoàn chênh lệch = giá hàng thay thế + cước giao thay thế - tiền hàng cũ. Nhận tại cửa hàng không có cước giao",
                merchantFault = "Hoàn số tiền thực đã trả còn lại, miễn phí lỗi cửa hàng", feesFromOrderQuote = true },
            loyalty = LoyaltyPolicy.Description, adminReport = report
        };
        var sources = new List<object> { new { id = "store-facts", label = "Dữ liệu và chính sách Store tại thời điểm hỏi" } };
        sources.AddRange(selected.Select(p => (object)new { id = "catalog-" + p.Id, label = p.Name }));
        // Chỉ đưa nhóm dữ kiện liên quan vào lượt hỏi; không bắt model phân tích cả cửa hàng khi chỉ hỏi voucher/ngày giờ.
        bool Has(params string[] words) => words.Any(query.Contains);
        var fields = new HashSet<string> { "observedAt", "today", "timeZone", "currency", "assistant" };
        if (Has("san pham", "hang hoa", "mat hang", "gia", "tuong tu", "het hang", "dien tu", "laptop") || selectedCategory is not null || mentioned.Length > 0)
            fields.Add("catalog");
        if (Has("voucher", "ma giam", "uu dai", "khuyen mai")) fields.Add("publicVouchers");
        if (Has("uu dai", "khuyen mai", "thang")) fields.Add("promotions");
        if (Has("nhan vien", "online", "cham soc", "ho tro", "lien he", "het hang")) fields.Add("support");
        if (Has("lien he", "cham soc", "dia chi", "o dau", "truc tiep", "dien thoai", "email", "gio mo", "het hang")) fields.Add("contact");
        if (Has("thanh toan", "qr", "chuyen khoan", "chuyen tien", "cod")) fields.Add("payment");
        if (Has("tra hang", "doi hang", "doi tra", "hoan tien", "huy don", "doi lich", "phi")) fields.Add("afterSales");
        if (Has("diem", "thanh vien", "hang vang", "kim cuong", "luot quay")) fields.Add("loyalty");
        if (report is not null) fields.Add("adminReport");
        if (!fields.Contains("catalog")) sources.RemoveRange(1, sources.Count - 1);
        var snapshot = JsonSerializer.SerializeToElement(facts, JsonOptions);
        var relevant = snapshot.EnumerateObject().Where(p => fields.Contains(p.Name)).ToDictionary(p => p.Name, p => p.Value);
        if (nextMonthOnly)
        {
            // Chương trình tương lai chưa công bố khác với số ưu đãi đang hoạt động hôm nay.
            relevant["promotions"] = JsonSerializer.SerializeToElement(new
            {
                requestedMonth = now.AddMonths(1).ToString("MM/yyyy"), publishedCampaigns = (object?)null,
                publishedVoucherCodes = (object?)null, sourceStatus = "Chưa có lịch ưu đãi được công bố cho tháng được hỏi"
            }, JsonOptions);
            relevant.Remove("publicVouchers");
        }
        return new(JsonSerializer.Serialize(relevant, JsonOptions), sources, report);
    }
}
