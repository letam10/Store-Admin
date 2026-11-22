/*
  FILE NOTE
  - Mục đích: Cầu nối thông minh trích xuất dữ liệu SQL Server thực tế cho AI Local qwen3.5:4b (Admin: đơn hàng, sản phẩm trong đơn, bán chạy, thống kê đa kỳ, tồn kho, khách hàng; Khách: tìm theo ngân sách, so sánh nhiều sản phẩm, bán chạy/đánh giá cao, đơn hàng cá nhân).
  - Liên kết trực tiếp: Store-Admin/server-dotnet/Data/StoreDb.AiFacts.cs, Store-Admin/server-dotnet/Services/AiChatService.cs, Store-Admin/server-dotnet/Services/ChatStreamService.cs
  - Vùng ảnh hưởng khi sửa: Logic trích xuất ngữ cảnh thời gian thực cho mọi câu hỏi AI của Quản trị viên và Khách hàng.
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

    private static readonly Dictionary<string, string[]> SemanticSynonyms = new(StringComparer.OrdinalIgnoreCase)
    {
        ["dien thoai"] = ["iphone", "samsung", "oppo", "vivo", "realme", "smartphone", "dien thoai"],
        ["smartphone"] = ["iphone", "samsung", "oppo", "vivo", "realme", "dien thoai"],
        ["may tinh"] = ["laptop", "macbook", "pc", "ban phim", "chuot"],
        ["nghe nhac"] = ["tai nghe", "loa", "headphone", "earphone", "bluetooth"],
        ["am thanh"] = ["tai nghe", "loa", "bluetooth"],
        ["lam dep"] = ["son", "phan", "kem", "nuoc hoa", "my pham", "cham soc da"],
        ["nha bep"] = ["noi", "chao", "bep", "ly", "coc", "binh", "gia dung"],
        ["qua tang"] = ["dong ho", "tui", "trang suc", "nuoc hoa", "vong", "nhan", "day chuyen"],
        ["thoi trang"] = ["ao", "quan", "vay", "giay", "dep", "tui", "trang phuc"],
        ["mua nhieu"] = ["ban chay", "pho bien", "best seller"]
    };

    public static string Normalize(string text)
    {
        var decomposed = text.ToLowerInvariant().Replace('đ', 'd').Normalize(NormalizationForm.FormD);
        return new string(decomposed.Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark).ToArray());
    }

    public static long SalePrice(CatalogProduct item) => (long)decimal.Round(
        item.Price * (100 - item.DiscountPercent) / 1000m, 0, MidpointRounding.ToEven) * 10;

    private static object Product(
        CatalogProduct item,
        int? rank = null,
        IReadOnlyDictionary<string, StoreDb.AiProductRatingFact>? ratings = null,
        IReadOnlyDictionary<string, int>? soldMap = null)
    {
        StoreDb.AiProductRatingFact? r = null;
        ratings?.TryGetValue(item.Id, out r);
        int sold = soldMap is not null && soldMap.TryGetValue(item.Id, out var s) ? s : 0;
        return new
        {
            id = item.Id,
            rank,
            name = item.Name,
            price = item.Price,
            originalPriceVnd = item.Price,
            salePrice = SalePrice(item),
            priceVnd = SalePrice(item),
            discountPercent = item.DiscountPercent,
            stockCount = item.StockCount,
            stockUnit = "sản phẩm",
            viewCount = item.ViewCount,
            soldCount = sold,
            averageRating = r?.AverageRating,
            reviewCount = r?.ReviewCount ?? 0,
            category = VietnameseLabels.Category(item.Category),
            image = item.Image,
            url = "/products/" + Uri.EscapeDataString(item.Id),
            description = item.Description.Length <= 350 ? item.Description : item.Description[..350]
        };
    }

    private static CatalogProduct[] MentionedProducts(IReadOnlyList<CatalogProduct> catalog, string query, bool multiCompare)
    {
        var wantsCase = Regex.IsMatch(query, @"\bop\b");
        var scored = catalog.Where(product => !wantsCase || Normalize(product.Name).StartsWith("op ", StringComparison.Ordinal))
            .Select(product => new { Product = product, Score = MentionScore(product, query, wantsCase) })
            .Where(item => item.Score > 0)
            .OrderByDescending(item => item.Score)
            .ToArray();
        if (scored.Length == 0) return [];
        if (multiCompare)
            return scored.Take(6).Select(item => item.Product).ToArray();
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

    // Phân tích khoảng giá tiếng Việt: "dưới 500k", "trên 1 triệu", "từ 200k đến 800k", "tầm 300k"
    private static (long? MinVnd, long? MaxVnd) ParsePriceBudget(string query)
    {
        static long ParseUnitAmount(string numRaw, string unitRaw)
        {
            if (!decimal.TryParse(numRaw.Replace(',', '.'), NumberStyles.Number, CultureInfo.InvariantCulture, out var num)) return 0;
            var u = unitRaw.Trim().ToLowerInvariant();
            if (u is "tr" or "trieu" or "m") return (long)(num * 1_000_000m);
            if (u is "k" or "nghin" or "ngan") return (long)(num * 1_000m);
            return (long)num;
        }

        const string amtPat = @"(\d+(?:[.,]\d+)?)\s*(trieu|tr|nghin|ngan|k|d|vnd)?";
        var between = Regex.Match(query, $@"tu\s+{amtPat}\s+(?:den|toi|-)\s+{amtPat}");
        if (between.Success)
        {
            var lo = ParseUnitAmount(between.Groups[1].Value, between.Groups[2].Value);
            var hi = ParseUnitAmount(between.Groups[3].Value, between.Groups[4].Value);
            if (lo > 0 && hi >= lo) return (lo, hi);
        }
        var under = Regex.Match(query, $@"(?:duoi|khong qua|toi da|it hon|<)\s+{amtPat}");
        if (under.Success)
        {
            var hi = ParseUnitAmount(under.Groups[1].Value, under.Groups[2].Value);
            if (hi >= 1000) return (null, hi);
        }
        var over = Regex.Match(query, $@"(?:tren|tu|it nhat|hon|>)\s+{amtPat}");
        if (over.Success)
        {
            var lo = ParseUnitAmount(over.Groups[1].Value, over.Groups[2].Value);
            if (lo >= 1000) return (lo, null);
        }
        var around = Regex.Match(query, $@"(?:tam|khoang|quanh)\s+{amtPat}");
        if (around.Success)
        {
            var mid = ParseUnitAmount(around.Groups[1].Value, around.Groups[2].Value);
            if (mid >= 1000) return ((long)(mid * 0.7), (long)(mid * 1.3));
        }
        return (null, null);
    }

    // Phân tích khoảng ngày báo cáo từ câu hỏi tiếng Việt cho Admin
    private static (string From, string To, string Label) ParseAdminReportPeriod(string query, DateTimeOffset now)
    {
        var today = now.ToString("yyyy-MM-dd");
        if (query.Contains("hom nay")) return (today, today, "Hôm nay");
        if (query.Contains("hom qua"))
        {
            var y = now.AddDays(-1).ToString("yyyy-MM-dd");
            return (y, y, "Hôm qua");
        }
        if (query.Contains("7 ngay") || query.Contains("tuan nay"))
            return (now.AddDays(-6).ToString("yyyy-MM-dd"), today, "7 ngày gần đây");
        if (query.Contains("thang truoc"))
        {
            var prev = now.AddMonths(-1);
            var first = new DateTime(prev.Year, prev.Month, 1);
            var last = first.AddMonths(1).AddDays(-1);
            return (first.ToString("yyyy-MM-dd"), last.ToString("yyyy-MM-dd"), $"Tháng {prev.Month}/{prev.Year}");
        }
        var monthMatch = Regex.Match(query, @"thang\s*(\d{1,2})(?:\s*(?:nam|\/)\s*(\d{4}))?");
        if (monthMatch.Success && int.TryParse(monthMatch.Groups[1].Value, out var m) && m is >= 1 and <= 12)
        {
            var yr = monthMatch.Groups[2].Success && int.TryParse(monthMatch.Groups[2].Value, out var parsedYr) ? parsedYr : now.Year;
            var first = new DateTime(yr, m, 1);
            var last = first.AddMonths(1).AddDays(-1);
            return (first.ToString("yyyy-MM-dd"), last.ToString("yyyy-MM-dd"), $"Tháng {m}/{yr}");
        }
        if (query.Contains("thang nay"))
            return (new DateTime(now.Year, now.Month, 1).ToString("yyyy-MM-dd"), today, $"Tháng {now.Month}/{now.Year}");
        if (query.Contains("nam nay"))
            return ($"{now.Year}-01-01", today, $"Năm {now.Year}");
        if (query.Contains("tat ca") || query.Contains("toan bo") || query.Contains("tong doanh thu"))
            return ("2020-01-01", today, "Toàn thời gian");
        return (now.AddDays(-30).ToString("yyyy-MM-dd"), today, "30 ngày gần đây");
    }

    public static AiContext Build(string message, IReadOnlyList<ChatTurnData> history, StoreDb db, bool admin, long? customerId = null)
    {
        var catalog = db.Catalog();
        var appearance = db.Appearance();
        var vouchers = db.PublicAiVouchers();
        var online = db.OnlineSupportStaff();
        var bankSync = JsonSerializer.SerializeToElement(db.SePayStatus());
        var topSold = db.AiTopSellingProducts(15);
        var soldMap = topSold.ToDictionary(x => x.ProductId, x => x.QuantitySold, StringComparer.OrdinalIgnoreCase);
        var ratingsMap = db.AiProductRatingsMap();
        var now = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7));
        var query = Normalize(message);

        var nextMonthOnly = (query.Contains("thang sau") || query.Contains("thang sao"))
            && !query.Contains("thang nay") && !query.Contains("hien tai");
        var stockQuestion = query.Contains("het hang") || query.Contains("het kho") || query.Contains("con hang") || query.Contains("con khong") || query.Contains("ton kho");
        var isPriceComparison = query.Contains("so sanh") || query.Contains("bang gia") || query.Contains(" vs ")
            || query.Contains("chenh lech gia") || query.Contains("xep hang gia")
            || query.Contains("thu tu gia") || query.Contains("danh sach gia") || query.Contains("nen mua cai nao");
        var mentioned = MentionedProducts(catalog, query, multiCompare: isPriceComparison);
        var namedProduct = mentioned.Length == 1 ? mentioned[0] : null;
        var categories = catalog.Select(p => p.Category).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var selectedCategory = categories.OrderByDescending(c => c.Length)
            .FirstOrDefault(c => query.Contains(Normalize(c), StringComparison.Ordinal));
        if (query.Contains("may tinh xach tay", StringComparison.Ordinal) && categories.Contains("Laptop")) selectedCategory = "Laptop";
        var onSale = query.Contains("giam gia") || query.Contains("sale");
        var (budgetMin, budgetMax) = ParsePriceBudget(query);
        var hasBudget = budgetMin.HasValue || budgetMax.HasValue;

        var wantsBestSelling = query.Contains("mua nhieu") || query.Contains("ban chay") || query.Contains("pho bien")
            || query.Contains("best seller") || query.Contains("duoc mua") || query.Contains("hot nhat");
        var wantsTopViewed = query.Contains("xem nhieu") || query.Contains("luot xem");
        var wantsTopFavorited = query.Contains("yeu thich") || query.Contains("duoc thich");
        var wantsTopRated = query.Contains("danh gia cao") || query.Contains("nhieu sao") || query.Contains("tot nhat") || query.Contains("review");

        var ordinalMatch = Regex.Match(query, @"\bthu\s*(\d{1,2}|nhat|mot|hai|nhi|ba|tu|bon|nam|sau|bay|tam|chin|muoi)\b"
            + @"|\b(re|thap|cao|dat|mac)\s+(nhat|nhi|ba|tu|bon|nam)\b"
            + @"|\b(hang|dung|xep|ve)\s+(nhat|nhi|ba)\b");
        var hasOrdinalTerm = ordinalMatch.Success
            || query.Contains("tiep theo") || query.Contains("ke tiep")
            || query.Contains("sau do") || query.Contains("dung sau") || query.Contains("dung truoc");

        var rankNumber = 0;
        if (ordinalMatch.Success)
        {
            var m = ordinalMatch.Value;
            if (m.Contains("1") || m.Contains("nhat") || m.Contains("mot")) rankNumber = 1;
            else if (m.Contains("2") || m.Contains("hai") || m.Contains("nhi")) rankNumber = 2;
            else if (m.Contains("3") || m.Contains("ba")) rankNumber = 3;
            else if (m.Contains("4") || m.Contains("tu") || m.Contains("bon")) rankNumber = 4;
            else if (m.Contains("5") || m.Contains("nam")) rankNumber = 5;
            else if (m.Contains("6") || m.Contains("sau")) rankNumber = 6;
            else if (m.Contains("7") || m.Contains("bay")) rankNumber = 7;
            else if (m.Contains("8") || m.Contains("tam")) rankNumber = 8;
            else if (m.Contains("9") || m.Contains("chin")) rankNumber = 9;
            else if (m.Contains("10") || m.Contains("muoi")) rankNumber = 10;
            else if (ordinalMatch.Groups[1].Success && int.TryParse(ordinalMatch.Groups[1].Value, out var n)) rankNumber = n;
        }
        else if (hasOrdinalTerm)
        {
            rankNumber = 2;
        }

        var priceLowKeywords = new[]
        {
            "thap nhat", "re nhat", "gia thap", "gia re", "re hon", "thap hon", "it tien nhat", "it tien", "re nhe",
            "thap thu", "re thu", "thap nhi", "re nhi", "thap ba", "re ba", "gia thap thu", "gia re thu"
        };
        var hasPriceLow = priceLowKeywords.Any(query.Contains);

        var priceHighKeywords = new[]
        {
            "cao nhat", "dat nhat", "mac nhat", "gia cao", "gia dat", "gia mac", "cao hon", "dat hon", "mac hon",
            "nhieu tien nhat", "nhieu tien", "cao thu", "dat thu", "mac thu", "cao nhi", "dat nhi", "mac nhi",
            "cao ba", "dat ba", "mac ba", "gia cao thu", "gia dat thu", "gia mac thu"
        };
        var hasPriceHigh = priceHighKeywords.Any(query.Contains);

        var completedTurns = history.Where(t => t.Status == "completed").ToList();
        var recentTurns = (completedTurns.Count > 0 ? completedTurns : history.Where(t => !string.IsNullOrWhiteSpace(t.UserContent)).ToList())
            .TakeLast(5).Reverse().ToList();

        var prevHadPriceLow = false;
        var prevHadPriceHigh = false;
        foreach (var turn in recentTurns)
        {
            var prevNorm = Normalize(turn.UserContent + " " + (turn.AssistantContent ?? ""));
            if (priceLowKeywords.Any(prevNorm.Contains) || prevNorm.Contains("re nhat") || prevNorm.Contains("thap nhat") || prevNorm.Contains("gia re") || prevNorm.Contains("gia thap") || prevNorm.Contains("it tien"))
            {
                prevHadPriceLow = true;
                break;
            }
            if (priceHighKeywords.Any(prevNorm.Contains) || prevNorm.Contains("cao nhat") || prevNorm.Contains("dat nhat") || prevNorm.Contains("mac nhat") || prevNorm.Contains("gia cao") || prevNorm.Contains("gia dat") || prevNorm.Contains("gia mac") || prevNorm.Contains("nhieu tien"))
            {
                prevHadPriceHigh = true;
                break;
            }
        }

        var isPriceRankingLow = hasPriceLow || (hasOrdinalTerm && prevHadPriceLow)
            || ((query.Contains("khac") || query.Contains("nua") || query.Contains("con")) && prevHadPriceLow);
        var isPriceRankingHigh = hasPriceHigh || (hasOrdinalTerm && prevHadPriceHigh)
            || ((query.Contains("khac") || query.Contains("nua") || query.Contains("con")) && prevHadPriceHigh);

        var cheapest = isPriceRankingLow || query.Contains("thap nhat") || query.Contains("re nhat");
        var expensive = (!cheapest) && (isPriceRankingHigh || query.Contains("cao nhat") || query.Contains("dat nhat") || query.Contains("mac nhat"));
        if (!expensive && (hasOrdinalTerm || (isPriceComparison && mentioned.Length <= 1)) && !cheapest)
            cheapest = true;

        var isRankingOrComparison = cheapest || expensive || isPriceComparison || hasOrdinalTerm;
        var similar = query.Contains("tuong tu") || query.Contains("thay the");

        bool Has(params string[] phrases) => phrases.Any(p => Regex.IsMatch(query, @"(?<![a-z0-9])" + Regex.Escape(p) + @"(?![a-z0-9])"));

        var hasExplicitProductIntent = Has(
            "san pham", "hang hoa", "mat hang", "gia", "gia ca", "tuong tu", "het hang", "con hang", "ton kho", "dien tu", "laptop",
            "may tinh xach tay", "mua", "co ban", "ban chay", "danh muc", "co gi", "shop co", "cua hang co", "tim", "kiem",
            "tu van", "goi y", "phu hop", "mau sac", "kich thuoc", "thiet bi", "phu kien", "anh", "hinh", "hinh anh", "top", "danh sach",
            "xem them", "chi tiet", "thong so", "sale", "giam gia", "re nhat", "thap nhat", "cao nhat", "dat nhat",
            "con khong", "cai nay", "mon nay", "em nay", "san pham nay", "san pham do", "cai do", "mon do", "em do",
            "bao nhieu tien", "gia bao nhieu", "bao hanh", "so sanh", "bang gia", "xep hang", "thu tu", "mua nhieu", "xem nhieu", "yeu thich"
        ) || selectedCategory is not null || mentioned.Length > 0 || onSale || cheapest || expensive || similar
          || isRankingOrComparison || hasOrdinalTerm || hasBudget || wantsBestSelling || wantsTopViewed || wantsTopFavorited || wantsTopRated;

        var isMathQuery = query.Contains("1 + 1") || query.Contains("1+1")
            || Regex.IsMatch(query, @"\b\d+\s*[\+\-\*\/\:xX×÷]\s*\d+\b")
            || (query.Contains("=") && Regex.IsMatch(query, @"\d+"));

        var isOffTopicOrStorePolicyOnly = query.Contains("thoi tiet")
            || (isMathQuery && !hasExplicitProductIntent)
            || ((query.Contains("ngay may") || query.Contains("thu may") || query.Contains("may gio")) && !hasExplicitProductIntent)
            || ((query.Contains("dia chi") || query.Contains("gio mo cua") || query.Contains("so dien thoai") || query.Contains("hotline")
                || query.Contains("doi tra") || query.Contains("tra hang") || query.Contains("hoan tien") || query.Contains("huy don")
                || query.Contains("chuyen khoan") || query.Contains("stk") || query.Contains("thanh toan") || query.Contains("ngan hang"))
                && !hasExplicitProductIntent);

        var isBroadQuery = query.Contains("tat ca") || query.Contains("toan bo") || query.Contains("nhung mat hang gi")
            || query.Contains("co nhung gi") || query.Contains("danh muc") || query.Contains("cac loai hang");

        if (!isOffTopicOrStorePolicyOnly && recentTurns.Count > 0)
        {
            if (selectedCategory is null && !isBroadQuery)
            {
                foreach (var turn in recentTurns)
                {
                    var prevNorm = Normalize(turn.UserContent);
                    var prevCat = categories.OrderByDescending(c => c.Length)
                        .FirstOrDefault(c => prevNorm.Contains(Normalize(c), StringComparison.Ordinal));
                    if (prevNorm.Contains("may tinh xach tay", StringComparison.Ordinal) && categories.Contains("Laptop"))
                        prevCat = "Laptop";
                    if (prevCat is not null) { selectedCategory = prevCat; break; }
                }
            }

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

            if (namedProduct is null && !cheapest && !expensive && !isBroadQuery && !isRankingOrComparison && !hasOrdinalTerm && !hasBudget && !wantsBestSelling)
            {
                var isDetailInquiry = (stockQuestion || query.Contains("con hang") || query.Contains("con khong")
                    || query.Contains("mau gi") || query.Contains("mau sac") || query.Contains("size") || query.Contains("kich thuoc")
                    || query.Contains("gia bao nhieu") || query.Contains("bao nhieu tien") || query.Contains("gia ca")
                    || query.Contains("anh") || query.Contains("hinh") || query.Contains("thong so") || query.Contains("cau hinh")
                    || query.Contains("chi tiet") || query.Contains("mo ta") || query.Contains("xuat xu") || query.Contains("bao hanh")
                    || query.Contains("san pham nay") || query.Contains("san pham do") || query.Contains("cai nay") || query.Contains("cai do")
                    || query.Contains("mon nay") || query.Contains("mon do") || query.Contains("em nay") || query.Contains("em do")
                    || (query.Length <= 30 && (query.Contains("gia") || query.Contains("mau") || query.Contains("con"))))
                    && !hasOrdinalTerm && !isRankingOrComparison;

                if (isDetailInquiry)
                {
                    foreach (var turn in recentTurns)
                    {
                        var prevMentioned = MentionedProducts(catalog, Normalize(turn.UserContent), multiCompare: false);
                        if (prevMentioned.Length == 1) { namedProduct = prevMentioned[0]; break; }
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
                                        if (found is not null) { namedProduct = found; break; }
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
            : isRankingOrComparison
                ? Math.Clamp(Math.Max(10, rankNumber + 4), 10, 20)
                : (cheapest || expensive || onSale || selectedCategory is not null || hasBudget || wantsBestSelling) ? 10 : 8;

        IEnumerable<CatalogProduct> matches = (namedProduct is not null && !cheapest && !expensive && !isRankingOrComparison && !hasBudget)
            ? [namedProduct]
            : mentioned.Length > 1 ? mentioned : catalog;

        if (namedProduct is null || isRankingOrComparison || hasBudget)
        {
            if (selectedCategory is not null) matches = matches.Where(p => p.Category.Equals(selectedCategory, StringComparison.OrdinalIgnoreCase));
            if (onSale) matches = matches.Where(p => p.DiscountPercent > 0 && p.StockCount > 0);
            if (budgetMin.HasValue) matches = matches.Where(p => SalePrice(p) >= budgetMin.Value);
            if (budgetMax.HasValue) matches = matches.Where(p => SalePrice(p) <= budgetMax.Value);
        }

        var ignored = new HashSet<string>("toi minh ban cho voi cua la co va hay nhung cac mot ve nay nao giup xin hoi store san pham hien tai hang hoa dang bao nhieu tim vai giam gia nhat chao alo hello hi oi nhe nha da vang ok cam on tam biet lam sao the nao xem them nua top danh sach re thap cao dat mac bao ton kho chi tiet mo ta mau anh hinh thoi tiet hom nay may gio thu chuc vui tot ngay thang nam khong duoc chua gi the sao bang muon can biet toan bo tat ca het day du liet ke duoi tren tu den tam khoang trieu nghin ngan phu hop goi y".Split(' '));
        var baseTerms = Regex.Matches(query, @"[a-z0-9]+").Select(m => m.Value).Where(t => t.Length > 1 && !ignored.Contains(t)).Distinct().ToList();
        var expandedTerms = new HashSet<string>(baseTerms, StringComparer.OrdinalIgnoreCase);
        foreach (var (phrase, syns) in SemanticSynonyms)
        {
            if (query.Contains(phrase, StringComparison.Ordinal))
                foreach (var syn in syns) expandedTerms.Add(syn);
        }
        var terms = expandedTerms.ToArray();

        var termMatched = false;
        CatalogProduct? anchor = null;
        if (similar)
        {
            var referenceText = new[] { message }.Concat(history.Reverse().SelectMany(t => new[] { t.UserContent, t.AssistantContent }));
            foreach (var text in referenceText)
            {
                var normalized = Normalize(text);
                var candidates = MentionedProducts(catalog, normalized, multiCompare: false);
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
        else if (isPriceComparison && mentioned.Length > 1)
            matches = mentioned;
        else if (wantsBestSelling)
            matches = matches.OrderByDescending(p => soldMap.GetValueOrDefault(p.Id, 0)).ThenByDescending(p => p.ViewCount).ThenBy(p => p.Id);
        else if (wantsTopViewed)
            matches = matches.OrderByDescending(p => p.ViewCount).ThenBy(p => p.Id);
        else if (wantsTopRated)
            matches = matches.OrderByDescending(p => ratingsMap.TryGetValue(p.Id, out var r) ? r.AverageRating : 0).ThenByDescending(p => ratingsMap.TryGetValue(p.Id, out var r) ? r.ReviewCount : 0).ThenBy(p => p.Id);
        else if (cheapest || expensive)
            matches = cheapest ? matches.OrderBy(SalePrice).ThenBy(p => p.Id) : matches.OrderByDescending(SalePrice).ThenBy(p => p.Id);
        else if (namedProduct is not null && !isRankingOrComparison && !hasBudget) matches = [namedProduct];
        else
        {
            var scored = matches.Select(p => new
            {
                Item = p,
                Score = terms.Count(t => Normalize(p.Name + " " + p.Category + " " + p.Description).Contains(t, StringComparison.Ordinal))
            }).ToArray();
            termMatched = scored.Any(p => p.Score > 0);
            if (termMatched)
            {
                var termMatches = scored.Where(p => p.Score > 0);
                if (onSale)
                    matches = termMatches.OrderByDescending(p => p.Score).ThenByDescending(p => p.Item.DiscountPercent).ThenBy(p => SalePrice(p.Item)).Select(p => p.Item);
                else
                    matches = termMatches.OrderByDescending(p => p.Score).ThenByDescending(p => p.Item.StockCount > 0).ThenByDescending(p => soldMap.GetValueOrDefault(p.Item.Id, 0)).ThenBy(p => p.Item.Id).Select(p => p.Item);
            }
            else if (onSale) matches = matches.OrderByDescending(p => p.DiscountPercent).ThenBy(SalePrice);
            else matches = matches.OrderByDescending(p => p.StockCount > 0).ThenByDescending(p => soldMap.GetValueOrDefault(p.Id, 0)).ThenBy(p => p.Id);
        }

        var matching = matches.ToArray();
        var selected = matching.Take(count).ToArray();
        var contactKeys = new[] { "brandName", "contactAddress", "contactPhone", "contactEmail", "contactHours" };
        var contact = contactKeys.ToDictionary(key => key, key => appearance.TryGetValue(key, out var value) ? value : null);

        // =========================================================================
        // DỮ LIỆU CHUYÊN SÂU CHO QUẢN TRỊ VIÊN (ĐƠN HÀNG, SẢN PHẨM TRONG ĐƠN, THỐNG KÊ, VẬN HÀNH)
        // =========================================================================
        object? report = null;
        object? adminOrders = null;
        object? adminOperations = null;
        object? adminMultiPeriodStats = null;

        if (admin)
        {
            var (fromDate, toDate, periodLabel) = ParseAdminReportPeriod(query, now);
            var wantsStats = Has("doanh thu", "bao cao", "thong ke", "loi nhuan", "hoan tien", "ban hang", "tong quan", "tinh hinh", "doanh so");
            var wantsOrders = Has("don hang", "don", "mua gi", "trong don", "dat hang", "hoa don", "thanh toan", "giao hang", "khach mua")
                || Regex.IsMatch(message, @"\bST[A-Z0-9]{4,}\b", RegexOptions.IgnoreCase);
            var wantsOps = Has("khach hang", "ton kho", "sap het", "het hang", "danh gia", "doi tra", "cskh", "ho tro", "voucher", "ban chay", "mua nhieu", "xem nhieu", "yeu thich", "tong quan", "tinh hinh");

            var specificOrderMatch = Regex.Match(message, @"\b(ST[A-Z0-9]{4,})\b", RegexOptions.IgnoreCase);
            var orderFilter = specificOrderMatch.Success ? specificOrderMatch.Groups[1].Value : null;

            if (wantsStats || wantsOrders || wantsOps || !isOffTopicOrStorePolicyOnly)
            {
                var primaryReport = db.CalculateAdminRevenue(fromDate, toDate);
                if (wantsStats) report = primaryReport;

                var monthStart = new DateTime(now.Year, now.Month, 1).ToString("yyyy-MM-dd");
                var todayStr = now.ToString("yyyy-MM-dd");
                adminMultiPeriodStats = new
                {
                    requestedPeriod = new { label = periodLabel, report = primaryReport },
                    todaySummary = db.CalculateAdminRevenue(todayStr, todayStr),
                    thisMonthSummary = db.CalculateAdminRevenue(monthStart, todayStr),
                    allTimeSummary = db.CalculateAdminRevenue("2020-01-01", todayStr)
                };
            }

            if (wantsOrders || wantsStats || wantsOps || !isOffTopicOrStorePolicyOnly)
            {
                var recentOrders = db.AiRecentOrdersDetail(limit: 20, customerId: null, orderIdOrQuery: orderFilter);
                // Nếu lọc theo mã cụ thể không ra thì fallback lấy 20 đơn mới nhất để AI vẫn đối chiếu được
                if (recentOrders.Count == 0 && orderFilter is not null)
                    recentOrders = db.AiRecentOrdersDetail(limit: 20);
                adminOrders = new
                {
                    totalMatched = recentOrders.Count,
                    filterUsed = orderFilter,
                    orders = recentOrders
                };
            }

            if (wantsOps || wantsStats || wantsBestSelling || wantsTopViewed || wantsTopFavorited || wantsTopRated)
            {
                adminOperations = db.AiAdminOperationsSnapshot();
            }
        }

        // =========================================================================
        // DỮ LIỆU CÁ NHÂN AN TOÀN CHO KHÁCH HÀNG ĐÃ ĐĂNG NHẬP (CÔ LẬP THEO customerId)
        // =========================================================================
        object? customerAccount = null;
        if (!admin && customerId.HasValue && Has("don hang", "don cua toi", "toi da mua", "lich su mua", "diem cua toi", "hang thanh vien", "voucher cua toi", "ma cua toi", "luot quay", "yeu thich cua toi", "tai khoan"))
        {
            customerAccount = db.AiCustomerPersonalSnapshot(customerId.Value);
        }

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
            assistant = new { name = admin ? "Trợ lý AI Quản trị Store" : "Trợ lý AI của Store", canBrowseWithoutPurchase = true,
                purchaseObligation = "Khách được xem website, hỏi tư vấn và rời đi mà không bắt buộc mua hàng", canExecuteTransactions = false },
            contact,
            catalog = new
            {
                total = catalog.Count, available = catalog.Count(p => p.StockCount > 0), outOfStock = catalog.Count(p => p.StockCount == 0),
                categories = catalog.GroupBy(p => p.Category).Select(g => new { name = VietnameseLabels.Category(g.Key), count = g.Count(), available = g.Count(p => p.StockCount > 0) }),
                saleCount = catalog.Count(p => p.DiscountPercent > 0 && p.StockCount > 0),
                minimum = catalog.OrderBy(SalePrice).Take(1).Select(p => Product(p, 1, ratingsMap, soldMap)),
                maximum = catalog.OrderByDescending(SalePrice).Take(1).Select(p => Product(p, 1, ratingsMap, soldMap)),
                query = new { selectedCategory, onSale, cheapest, expensive, similar, isRankingOrComparison, requestedCount = count,
                    budgetMinVnd = budgetMin, budgetMaxVnd = budgetMax,
                    ambiguousProductName = mentioned.Length > 1 && !isPriceComparison,
                    matchingCount = matching.Length, needsProductName = similar && anchor is null },
                priceRanking = isRankingOrComparison ? new
                {
                    sorted = true,
                    order = cheapest ? "ascending (thấp đến cao)" : "descending (cao đến thấp)",
                    description = cheapest
                        ? "Danh sách products đã được sắp xếp từ giá thấp nhất đến cao hơn. Sản phẩm có rank=1 là giá thấp nhất (hạng 1), rank=2 là giá thấp thứ 2..."
                        : "Danh sách products đã được sắp xếp từ giá cao nhất đến thấp hơn. Sản phẩm có rank=1 là giá cao nhất (hạng 1), rank=2 là giá cao thứ 2..."
                } : null,
                referenceProduct = anchor is null ? null : Product(anchor, null, ratingsMap, soldMap),
                products = isRankingOrComparison
                    ? selected.Select((p, idx) => Product(p, idx + 1, ratingsMap, soldMap))
                    : (stockQuestion && namedProduct is null && !onSale && selectedCategory is null && !cheapest && !expensive && !hasBudget) ? []
                    : selected.Select(p => Product(p, null, ratingsMap, soldMap)),
                bestSellingProducts = topSold.Take(10).ToArray(),
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
            loyalty = LoyaltyPolicy.ToDescription(db.GetMembershipPolicy()),
            adminReport = report,
            adminMultiPeriodStats,
            adminOrders,
            adminOperations,
            customerAccount
        };

        var sources = new List<object> { new { id = "store-facts", label = "Dữ liệu trực tiếp SQL Server StoreDb" } };
        sources.AddRange(selected.Select(p => (object)new { id = "catalog-" + p.Id, label = p.Name }));

        var fields = new HashSet<string> { "observedAt", "today", "dayOfWeek", "timeZone", "currency", "assistant" };
        if (!isOffTopicOrStorePolicyOnly && (hasExplicitProductIntent || selectedCategory is not null || mentioned.Length > 0 || namedProduct is not null || onSale || cheapest || expensive || similar || termMatched || hasBudget || wantsBestSelling))
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
        if (adminMultiPeriodStats is not null) fields.Add("adminMultiPeriodStats");
        if (adminOrders is not null) fields.Add("adminOrders");
        if (adminOperations is not null) fields.Add("adminOperations");
        if (customerAccount is not null) fields.Add("customerAccount");

        if (!fields.Contains("catalog")) sources.RemoveRange(1, sources.Count - 1);
        var snapshot = JsonSerializer.SerializeToElement(facts, JsonOptions);
        var relevant = snapshot.EnumerateObject().Where(p => fields.Contains(p.Name)).ToDictionary(p => p.Name, p => p.Value);

        if (nextMonthOnly)
        {
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
