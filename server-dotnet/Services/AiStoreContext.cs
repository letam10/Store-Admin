/*
  FILE NOTE
  - Mục đích: Trích xuất và xây dựng ngữ cảnh dữ liệu thực tế (sản phẩm, giá gốc/giảm, tồn kho, ảnh, ưu đãi, đa lượt hội thoại) từ StoreDb để cung cấp cho AI.
  - Liên kết trực tiếp: AiChatService.cs, StoreDb.cs, StoreDb.AiFacts.cs
  - Vùng ảnh hưởng khi sửa: Dữ liệu JSON facts gửi cho mô hình AI, nguồn tham khảo (sources) hiển thị trên UI.
*/
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
        id = item.Id,
        name = item.Name,
        price = item.Price,
        originalPriceVnd = item.Price,
        salePrice = SalePrice(item),
        priceVnd = SalePrice(item),
        discountPercent = item.DiscountPercent,
        stockCount = item.StockCount,
        stockUnit = "sản phẩm",
        category = VietnameseLabels.Category(item.Category),
        image = item.Image,
        url = "/products/" + Uri.EscapeDataString(item.Id),
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
        var stockQuestion = query.Contains("het hang") || query.Contains("het kho") || query.Contains("con hang") || query.Contains("con khong");
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

        bool Has(params string[] phrases) => phrases.Any(p => Regex.IsMatch(query, @"(?<![a-z0-9])" + Regex.Escape(p) + @"(?![a-z0-9])"));

        // Xác định rõ câu hỏi có ý định về sản phẩm, giá cả, mua sắm hoặc danh mục cửa hàng hay không
        var hasExplicitProductIntent = Has(
            "san pham", "hang hoa", "mat hang", "gia", "gia ca", "tuong tu", "het hang", "con hang", "dien tu", "laptop",
            "may tinh xach tay", "mua", "co ban", "ban chay", "danh muc", "co gi", "shop co", "cua hang co", "tim", "kiem",
            "tu van", "mau sac", "kich thuoc", "thiet bi", "phu kien", "anh", "hinh", "hinh anh", "top", "danh sach",
            "xem them", "chi tiet", "thong so", "sale", "giam gia", "re nhat", "thap nhat", "cao nhat", "dat nhat",
            "con khong", "cai nay", "mon nay", "em nay", "san pham nay", "san pham do", "cai do", "mon do", "em do",
            "bao nhieu tien", "gia bao nhieu", "bao hanh"
        ) || selectedCategory is not null || mentioned.Length > 0 || onSale || cheapest || expensive || similar;

        // Câu hỏi hoàn toàn ngoài lề (thời tiết, toán học, hỏi giờ/thứ đơn thuần không dính sản phẩm)
        // hoặc câu hỏi thuần chính sách/liên hệ mà không kèm tên/ngữ cảnh sản phẩm
        var isOffTopicOrStorePolicyOnly = query.Contains("thoi tiet")
            || query.Contains("1 + 1") || query.Contains("1+1")
            || Regex.IsMatch(query, @"\b\d+\s*[\+\-\*\/]\s*\d+\b")
            || ((query.Contains("ngay may") || query.Contains("thu may") || query.Contains("may gio")) && !hasExplicitProductIntent)
            || ((query.Contains("dia chi") || query.Contains("gio mo cua") || query.Contains("so dien thoai") || query.Contains("hotline")
                || query.Contains("doi tra") || query.Contains("tra hang") || query.Contains("hoan tien") || query.Contains("huy don")
                || query.Contains("chuyen khoan") || query.Contains("stk") || query.Contains("thanh toan") || query.Contains("ngan hang"))
                && !hasExplicitProductIntent);

        // Đa lượt hội thoại (Multi-turn Context): Duyệt lại 1-2 lượt chat gần nhất để kế thừa ngữ cảnh
        var completedTurns = history.Where(t => t.Status == "completed").ToList();
        var recentTurns = (completedTurns.Count > 0 ? completedTurns : history.Where(t => !string.IsNullOrWhiteSpace(t.UserContent)).ToList())
            .TakeLast(2).Reverse().ToList();

        var isBroadQuery = query.Contains("tat ca") || query.Contains("toan bo") || query.Contains("nhung mat hang gi")
            || query.Contains("co nhung gi") || query.Contains("danh muc") || query.Contains("cac loai hang");

        if (!isOffTopicOrStorePolicyOnly && recentTurns.Count > 0)
        {
            // 1. Kế thừa danh mục (selectedCategory)
            if (selectedCategory is null && !isBroadQuery)
            {
                foreach (var turn in recentTurns)
                {
                    var prevNorm = Normalize(turn.UserContent);
                    var prevCat = categories.OrderByDescending(c => c.Length)
                        .FirstOrDefault(c => prevNorm.Contains(Normalize(c), StringComparison.Ordinal));
                    if (prevNorm.Contains("may tinh xach tay", StringComparison.Ordinal) && categories.Contains("Laptop"))
                        prevCat = "Laptop";
                    if (prevCat is not null)
                    {
                        selectedCategory = prevCat;
                        break;
                    }
                }
            }

            // 2. Kế thừa trạng thái giảm giá (onSale)
            if (!onSale && !isBroadQuery && !query.Contains("khong giam") && !query.Contains("khong sale"))
            {
                var isFollowUp = cheapest || expensive || stockQuestion || query.Contains("con khong")
                    || query.Contains("xem them") || query.Contains("con gi") || query.Contains("mau gi")
                    || query.Contains("gia") || query.Contains("danh sach") || query.Contains("top")
                    || query.Contains("nhung san pham") || query.Contains("cac san pham")
                    || query.Contains("cai nay") || query.Contains("cai do") || query.Contains("mon nay")
                    || query.Length <= 40;

                if (isFollowUp)
                {
                    foreach (var turn in recentTurns)
                    {
                        var prevNorm = Normalize(turn.UserContent);
                        if (prevNorm.Contains("giam gia") || prevNorm.Contains("sale") || prevNorm.Contains("khuyen mai") || prevNorm.Contains("uu dai"))
                        {
                            onSale = true;
                            break;
                        }
                    }
                }
            }

            // 3. Kế thừa sản phẩm cụ thể (namedProduct)
            if (namedProduct is null && !cheapest && !expensive && !isBroadQuery)
            {
                var isDetailInquiry = stockQuestion || query.Contains("con hang") || query.Contains("con khong")
                    || query.Contains("mau gi") || query.Contains("mau sac") || query.Contains("size") || query.Contains("kich thuoc")
                    || query.Contains("gia bao nhieu") || query.Contains("bao nhieu tien") || query.Contains("gia ca")
                    || query.Contains("anh") || query.Contains("hinh") || query.Contains("thong so") || query.Contains("cau hinh")
                    || query.Contains("chi tiet") || query.Contains("mo ta") || query.Contains("xuat xu") || query.Contains("bao hanh")
                    || query.Contains("san pham nay") || query.Contains("san pham do") || query.Contains("cai nay") || query.Contains("cai do")
                    || query.Contains("mon nay") || query.Contains("mon do") || query.Contains("em nay") || query.Contains("em do")
                    || (query.Length <= 30 && (query.Contains("gia") || query.Contains("mau") || query.Contains("con")));

                if (isDetailInquiry)
                {
                    foreach (var turn in recentTurns)
                    {
                        var prevMentioned = MentionedProducts(catalog, Normalize(turn.UserContent));
                        if (prevMentioned.Length == 1)
                        {
                            namedProduct = prevMentioned[0];
                            break;
                        }
                        if (!string.IsNullOrWhiteSpace(turn.SourcesJson))
                        {
                            try
                            {
                                using var doc = JsonDocument.Parse(turn.SourcesJson);
                                if (doc.RootElement.ValueKind == JsonValueKind.Array)
                                {
                                    var catalogIds = doc.RootElement.EnumerateArray()
                                        .Where(e => e.TryGetProperty("id", out var idProp) && idProp.GetString()?.StartsWith("catalog-") == true)
                                        .Select(e => e.GetProperty("id").GetString()![8..])
                                        .ToList();
                                    if (catalogIds.Count == 1)
                                    {
                                        var found = catalog.FirstOrDefault(p => p.Id == catalogIds[0]);
                                        if (found is not null)
                                        {
                                            namedProduct = found;
                                            break;
                                        }
                                    }
                                }
                            }
                            catch { }
                        }
                    }
                }
            }
        }

        var wantsAll = query.Contains("toan bo") || query.Contains("tat ca") || query.Contains("het");
        var countMatch = Regex.Match(query, @"\b(\d{1,2})\s+(san pham|mat hang|mon|cai|item)\b");
        var count = countMatch.Success
            ? Math.Clamp(int.Parse(countMatch.Groups[1].Value), 1, 50)
            : wantsAll || (onSale && query.Contains("toan bo")) || (selectedCategory is not null && wantsAll) ? 30
            : (cheapest || expensive || onSale || selectedCategory is not null) ? 10 : 8;

        IEnumerable<CatalogProduct> matches = (namedProduct is not null && !cheapest && !expensive) ? [namedProduct] : mentioned.Length > 1 ? mentioned : catalog;
        if (namedProduct is null)
        {
            if (selectedCategory is not null) matches = matches.Where(p => p.Category.Equals(selectedCategory, StringComparison.OrdinalIgnoreCase));
            if (onSale) matches = matches.Where(p => p.DiscountPercent > 0 && p.StockCount > 0);
        }

        var ignored = new HashSet<string>("toi minh ban cho voi cua la co va hay nhung cac mot ve nay nao giup xin hoi store san pham hien tai hang hoa dang bao nhieu tim vai giam gia nhat chao alo hello hi oi nhe nha da vang ok cam on tam biet lam sao the nao xem them nua top danh sach re thap cao dat mac bao ton kho chi tiet mo ta mau anh hinh thoi tiet hom nay may gio thu chuc vui tot ngay thang nam khong duoc chua gi the sao bang muon can biet toan bo tat ca het day du liet ke".Split(' '));
        var terms = Regex.Matches(query, @"[a-z0-9]+").Select(m => m.Value).Where(t => t.Length > 1 && !ignored.Contains(t)).Distinct().ToArray();
        var termMatched = false;
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
            var scored = matches.Select(p => new { Item = p, Score = terms.Count(t => Regex.IsMatch(Normalize(p.Name + " " + p.Category + " " + p.Description), @"\b" + Regex.Escape(t) + @"\b")) }).ToArray();
            termMatched = scored.Any(p => p.Score > 0);
            if (termMatched)
            {
                var termMatches = scored.Where(p => p.Score > 0);
                if (onSale)
                    matches = termMatches.OrderByDescending(p => p.Score).ThenByDescending(p => p.Item.DiscountPercent).ThenBy(p => SalePrice(p.Item)).Select(p => p.Item);
                else
                    matches = termMatches.OrderByDescending(p => p.Score).ThenByDescending(p => p.Item.StockCount > 0).ThenBy(p => p.Item.Id).Select(p => p.Item);
            }
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
        var dayOfWeek = now.DayOfWeek switch
        {
            DayOfWeek.Monday => "Thứ Hai",
            DayOfWeek.Tuesday => "Thứ Ba",
            DayOfWeek.Wednesday => "Thứ Tư",
            DayOfWeek.Thursday => "Thứ Năm",
            DayOfWeek.Friday => "Thứ Sáu",
            DayOfWeek.Saturday => "Thứ Bảy",
            _ => "Chủ Nhật"
        };
        var facts = new
        {
            observedAt = now.ToString("O"), today = now.ToString("dd/MM/yyyy"), dayOfWeek, timeZone = "Asia/Ho_Chi_Minh", currency = "VND",
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
                returnDeadline = $"Khách hàng được yêu cầu đổi/trả bất kỳ lúc nào trong vòng {AfterSalesPolicy.ReturnDays} ngày kể từ ngày đơn hàng giao thành công (không cần chờ đến hết {AfterSalesPolicy.ReturnDays} ngày). Sau {AfterSalesPolicy.ReturnDays} ngày (quá hạn) hệ thống sẽ không tiếp nhận đổi/trả.",
                cancelBeforeShipping = true,
                returnRefund = "Tiền hàng; không hoàn phí giao ban đầu. Khách thanh toán cước gửi trả cho đơn vị vận chuyển",
                exchange = "Đổi sang sản phẩm khác; bù/hoàn chênh lệch = giá hàng thay thế + cước giao thay thế - tiền hàng cũ. Nhận tại cửa hàng không có cước giao",
                merchantFault = "Hoàn số tiền thực đã trả còn lại, miễn phí lỗi cửa hàng", feesFromOrderQuote = true },
            loyalty = LoyaltyPolicy.Description, adminReport = report
        };
        var sources = new List<object> { new { id = "store-facts", label = "Dữ liệu và chính sách Store tại thời điểm hỏi" } };
        sources.AddRange(selected.Select(p => (object)new { id = "catalog-" + p.Id, label = p.Name }));
        // Chỉ đưa nhóm dữ kiện liên quan vào lượt hỏi; không bắt model phân tích cả cửa hàng khi chỉ hỏi voucher/ngày giờ.
        var fields = new HashSet<string> { "observedAt", "today", "dayOfWeek", "timeZone", "currency", "assistant" };
        if (!isOffTopicOrStorePolicyOnly && (hasExplicitProductIntent || selectedCategory is not null || mentioned.Length > 0 || namedProduct is not null || onSale || cheapest || expensive || similar || termMatched))
            fields.Add("catalog");
        else if (isOffTopicOrStorePolicyOnly && hasExplicitProductIntent)
            fields.Add("catalog");
        if (Has("voucher", "ma giam", "uu dai", "khuyen mai", "giam gia", "sale", "discount")) fields.Add("publicVouchers");
        if (Has("uu dai", "khuyen mai", "thang", "giam gia", "sale", "chuong trinh")) fields.Add("promotions");
        if (Has("nhan vien", "online", "cham soc", "ho tro", "lien he", "het hang", "tu van")) fields.Add("support");
        if (Has("lien he", "cham soc", "dia chi", "o dau", "truc tiep", "dien thoai", "email", "gio mo", "het hang", "hotline", "so dien thoai")) fields.Add("contact");
        if (Has("thanh toan", "qr", "chuyen khoan", "chuyen tien", "cod", "ngan hang", "stk", "so tai khoan")) fields.Add("payment");
        if (Has("tra hang", "doi hang", "doi tra", "hoan tien", "huy don", "doi lich", "phi", "bao hanh")) fields.Add("afterSales");
        if (Has("diem", "thanh vien", "hang vang", "kim cuong", "luot quay", "tich diem", "vong quay")) fields.Add("loyalty");
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
