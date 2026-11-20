/*

  FILE NOTE

  - Mục đích: Tạo file báo cáo Excel (.xlsx) chuẩn Office OpenXML trực tiếp từ .NET (hỗ trợ đầy đủ tiếng Việt UTF-8, header tô đậm xanh ngọc, auto-filter, đóng băng dòng tiêu đề, không cần NuGet ngoài).

  - Liên kết trực tiếp: Store-Admin/server-dotnet/Controllers/AdminSocialController.cs, Store-Admin/server-dotnet/Models/SocialAutomationModels.cs

*/



using System.Globalization;

using System.IO.Compression;

using System.Security;

using System.Text;

using StoreApi.Models;



namespace StoreApi.Services;



public static class SocialExcelExport

{

    public static byte[] BuildPostsWorkbook(IEnumerable<SocialAutoPost> posts)

    {

        var list = posts.ToList();

        using var ms = new MemoryStream();

        using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))

        {

            WriteEntry(zip, "[Content_Types].xml", """

                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>

                <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">

                  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>

                  <Default Extension="xml" ContentType="application/xml"/>

                  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>

                  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>

                  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>

                </Types>

                """);



            WriteEntry(zip, "_rels/.rels", """

                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>

                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">

                  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>

                </Relationships>

                """);



            WriteEntry(zip, "xl/workbook.xml", """

                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>

                <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">

                  <sheets>

                    <sheet name="BaoCaoDangBaiMXH" sheetId="1" r:id="rId1"/>

                  </sheets>

                </workbook>

                """);



            WriteEntry(zip, "xl/_rels/workbook.xml.rels", """

                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>

                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">

                  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>

                  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>

                </Relationships>

                """);



            WriteEntry(zip, "xl/styles.xml", """

                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>

                <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">

                  <fonts count="2">

                    <font><sz val="11"/><color rgb="FF111827"/><name val="Calibri"/></font>

                    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>

                  </fonts>

                  <fills count="3">

                    <fill><patternFill patternType="none"/></fill>

                    <fill><patternFill patternType="gray125"/></fill>

                    <fill><patternFill patternType="solid"><fgColor rgb="FF184D35"/><bgColor indexed="64"/></patternFill></fill>

                  </fills>

                  <borders count="2">

                    <border><left/><right/><top/><bottom/><diagonal/></border>

                    <border>

                      <left style="thin"><color rgb="FFD1D5DB"/></left>

                      <right style="thin"><color rgb="FFD1D5DB"/></right>

                      <top style="thin"><color rgb="FFD1D5DB"/></top>

                      <bottom style="thin"><color rgb="FFD1D5DB"/></bottom>

                    </border>

                  </borders>

                  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>

                  <cellXfs count="3">

                    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>

                    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>

                    <xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf>

                  </cellXfs>

                </styleSheet>

                """);



            WriteEntry(zip, "xl/worksheets/sheet1.xml", BuildWorksheetXml(list));

        }



        return ms.ToArray();

    }



    private static string BuildWorksheetXml(IReadOnlyList<SocialAutoPost> posts)

    {

        var headers = new[]

        {

            "ID Bài Đăng", "Mã Sản Phẩm", "Tên Sản Phẩm", "Giá (VNĐ)", "Kênh",

            "Trạng Thái", "Quyền Riêng Tư", "Tiêu Đề Bài Viết", "Vị Trí / Nhóm",

            "Lượt Thích", "Lượt Chia Sẻ", "Bình Luận", "Thời Gian Kích Hoạt",

            "Thời Gian Xuất Bản", "Link Bài Viết Thật", "Ghi Chú / Lỗi"

        };



        var widths = new[] { 20, 16, 30, 15, 12, 20, 15, 42, 26, 12, 12, 12, 22, 22, 48, 34 };

        var sb = new StringBuilder(16384);

        sb.Append("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>""");

        sb.Append("""<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">""");

        sb.Append("""<sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>""");



        sb.Append("<cols>");

        for (int i = 0; i < widths.Length; i++)

        {

            sb.Append($"<col min=\"{i + 1}\" max=\"{i + 1}\" width=\"{widths[i]}\" customWidth=\"1\"/>");

        }

        sb.Append("</cols><sheetData>");



        // Header row

        sb.Append("<row r=\"1\" ht=\"26\" customHeight=\"1\">");

        for (int c = 0; c < headers.Length; c++)

        {

            AppendStringCell(sb, c, 1, headers[c], styleIndex: 1);

        }

        sb.Append("</row>");



        for (int i = 0; i < posts.Count; i++)

        {

            var p = posts[i];

            int rowIdx = i + 2;

            sb.Append($"<row r=\"{rowIdx}\">");

            AppendStringCell(sb, 0, rowIdx, p.Id);

            AppendStringCell(sb, 1, rowIdx, p.ProductId ?? "");

            AppendStringCell(sb, 2, rowIdx, p.ProductName);

            AppendNumberCell(sb, 3, rowIdx, p.ProductPrice);

            AppendStringCell(sb, 4, rowIdx, p.Platform.ToUpperInvariant());

            AppendStringCell(sb, 5, rowIdx, TranslateStatus(p.Status));

            AppendStringCell(sb, 6, rowIdx, p.Privacy == "public" ? "Công khai" : "Chỉ mình tôi");

            AppendStringCell(sb, 7, rowIdx, p.Title);

            AppendStringCell(sb, 8, rowIdx, p.TargetGroup ?? "Trang cá nhân đang đăng nhập");

            AppendNumberCell(sb, 9, rowIdx, p.LikesCount);

            AppendNumberCell(sb, 10, rowIdx, p.SharesCount);

            AppendNumberCell(sb, 11, rowIdx, p.CommentsCount);

            AppendStringCell(sb, 12, rowIdx, FormatVnDate(p.TriggerTime));

            AppendStringCell(sb, 13, rowIdx, FormatVnDate(p.PublishedTime));

            AppendStringCell(sb, 14, rowIdx, p.PostUrl ?? "");

            AppendStringCell(sb, 15, rowIdx, p.ErrorMessage ?? "");

            sb.Append("</row>");

        }



        sb.Append("</sheetData>");

        sb.Append($"<autoFilter ref=\"A1:{ColLetter(headers.Length - 1)}{Math.Max(1, posts.Count + 1)}\"/>");

        sb.Append("</worksheet>");

        return sb.ToString();

    }



    private static string TranslateStatus(string? status) => status switch

    {

        "published" => "Đã đăng (Xác minh)",

        "pending_review" => "Đang chờ duyệt (2-5p)",

        "pending_approval" => "Chờ Admin duyệt",

        "internal_draft" => "Bản nháp",

        "ready_for_publish" or "ready_for_api" => "Chờ xuất bản",

        "unverified" => "Chưa xác minh",

        "failed" => "Thất bại",

        _ => status ?? ""

    };



    private static string FormatVnDate(string? iso)

    {

        if (string.IsNullOrWhiteSpace(iso)) return "";

        if (DateTimeOffset.TryParse(iso, out var dto))

            return dto.ToOffset(TimeSpan.FromHours(7)).ToString("dd/MM/yyyy HH:mm:ss", CultureInfo.InvariantCulture);

        return iso;

    }



    private static void AppendStringCell(StringBuilder sb, int colIdx, int rowIdx, string? value, int styleIndex = 0)

    {

        var cellRef = $"{ColLetter(colIdx)}{rowIdx}";

        var escaped = SecurityElement.Escape(SanitizeXml(value ?? "")) ?? "";

        sb.Append($"<c r=\"{cellRef}\" t=\"inlineStr\" s=\"{styleIndex}\"><is><t xml:space=\"preserve\">{escaped}</t></is></c>");

    }



    private static void AppendNumberCell(StringBuilder sb, int colIdx, int rowIdx, decimal value)

    {

        var cellRef = $"{ColLetter(colIdx)}{rowIdx}";

        sb.Append($"<c r=\"{cellRef}\" t=\"n\" s=\"2\"><v>{value.ToString(CultureInfo.InvariantCulture)}</v></c>");

    }



    private static string SanitizeXml(string input)

    {

        var sb = new StringBuilder(input.Length);

        foreach (char ch in input)

        {

            if (ch == '\t' || ch == '\n' || ch == '\r' || (ch >= 0x20 && ch <= 0xD7FF) || (ch >= 0xE000 && ch <= 0xFFFD))

                sb.Append(ch);

        }

        return sb.ToString();

    }



    private static string ColLetter(int colIdx)

    {

        var sb = new StringBuilder();

        int n = colIdx + 1;

        while (n > 0)

        {

            n--;

            sb.Insert(0, (char)('A' + (n % 26)));

            n /= 26;

        }

        return sb.ToString();

    }



    private static void WriteEntry(ZipArchive zip, string path, string content)

    {

        var entry = zip.CreateEntry(path, CompressionLevel.Optimal);

        using var writer = new StreamWriter(entry.Open(), new UTF8Encoding(false));

        writer.Write(content);

    }

}
