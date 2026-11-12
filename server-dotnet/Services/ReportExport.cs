using System.Globalization;
using System.IO.Compression;
using System.Net;
using System.Xml.Linq;
using StoreApi.Models;

namespace StoreApi.Services;

public static class ReportExport
{
    private static readonly XNamespace SheetNs = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    private static readonly CultureInfo Vi = CultureInfo.GetCultureInfo("vi-VN");

    private static List<object[]> Summary(SalesReport report) =>
    [
        ["BÁO CÁO DOANH THU STORE", "VND"],
        ["Từ ngày", report.From], ["Đến ngày", report.To], ["Múi giờ", report.Timezone],
        ["Tổng đơn trong kỳ", report.AllOrders], ["Đơn đã thanh toán", report.IncludedOrders],
        ["Doanh thu gộp", report.GrossRevenue], ["Hoàn tiền đã ghi nhận", report.Refunds], ["Doanh thu ròng", report.NetRevenue],
        ["Bản ghi mô phỏng được loại", report.ExcludedDemoOrders], ["Bản ghi thiếu ngày hợp lệ (toàn bộ dữ liệu)", report.UndatedOrders],
        ["Cách tính", report.Basis]
    ];

    public static byte[] Excel(SalesReport report)
    {
        var daily = new List<object[]> { new object[] { "Ngày", "Đơn đã thanh toán", "Doanh thu gộp (VND)", "Hoàn tiền (VND)", "Doanh thu ròng (VND)" } };
        daily.AddRange(report.RevenueByDay.Select(day => new object[] { day.Date, day.Orders, day.GrossRevenue, day.Refunds, day.Revenue }));
        return Workbook([("Tổng hợp", Summary(report), [70, 100]), ("Theo ngày", daily, [18, 22, 28, 28, 28])]);
    }

    public static byte[] ExcelTable(string name, List<object[]> rows, int[] widths) => Workbook([(name, rows, widths)]);

    private static byte[] Workbook(IReadOnlyList<(string Name, List<object[]> Rows, int[] Widths)> sheets)
    {
        using var buffer = new MemoryStream();
        using (var archive = new ZipArchive(buffer, ZipArchiveMode.Create, true))
        {
            const string office = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
            XNamespace relationships = "http://schemas.openxmlformats.org/package/2006/relationships";
            XNamespace content = "http://schemas.openxmlformats.org/package/2006/content-types";
            Write(archive, "[Content_Types].xml", new XElement(content + "Types",
                new XElement(content + "Default", new XAttribute("Extension", "rels"), new XAttribute("ContentType", "application/vnd.openxmlformats-package.relationships+xml")),
                new XElement(content + "Default", new XAttribute("Extension", "xml"), new XAttribute("ContentType", "application/xml")),
                new XElement(content + "Override", new XAttribute("PartName", "/xl/workbook.xml"), new XAttribute("ContentType", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml")),
                new XElement(content + "Override", new XAttribute("PartName", "/xl/styles.xml"), new XAttribute("ContentType", "application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml")),
                Enumerable.Range(1, sheets.Count).Select(index => new XElement(content + "Override", new XAttribute("PartName", $"/xl/worksheets/sheet{index}.xml"), new XAttribute("ContentType", "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml")))));
            Write(archive, "_rels/.rels", new XElement(relationships + "Relationships",
                new XElement(relationships + "Relationship", new XAttribute("Id", "rId1"), new XAttribute("Type", office + "/officeDocument"), new XAttribute("Target", "xl/workbook.xml"))));
            Write(archive, "xl/workbook.xml", new XElement(SheetNs + "workbook", new XAttribute(XNamespace.Xmlns + "r", office),
                new XElement(SheetNs + "sheets", sheets.Select((sheet, index) => new XElement(SheetNs + "sheet",
                    new XAttribute("name", sheet.Name), new XAttribute("sheetId", index + 1), new XAttribute((XNamespace)office + "id", "rId" + (index + 1)))))));
            Write(archive, "xl/_rels/workbook.xml.rels", new XElement(relationships + "Relationships",
                Enumerable.Range(1, sheets.Count).Select(index => new XElement(relationships + "Relationship", new XAttribute("Id", "rId" + index), new XAttribute("Type", office + "/worksheet"), new XAttribute("Target", $"worksheets/sheet{index}.xml"))),
                new XElement(relationships + "Relationship", new XAttribute("Id", "rId" + (sheets.Count + 1)), new XAttribute("Type", office + "/styles"), new XAttribute("Target", "styles.xml"))));
            Write(archive, "xl/styles.xml", Styles());
            for (var index = 0; index < sheets.Count; index++)
                Write(archive, $"xl/worksheets/sheet{index + 1}.xml", Worksheet(sheets[index].Rows, sheets[index].Widths));
        }
        return buffer.ToArray();
    }

    private static XElement Worksheet(List<object[]> rows, int[] widths) => new(SheetNs + "worksheet",
        new XElement(SheetNs + "sheetViews", new XElement(SheetNs + "sheetView", new XAttribute("workbookViewId", 0),
            new XElement(SheetNs + "pane", new XAttribute("ySplit", 1), new XAttribute("topLeftCell", "A2"), new XAttribute("activePane", "bottomLeft"), new XAttribute("state", "frozen")))),
        new XElement(SheetNs + "cols", widths.Select((width, index) => new XElement(SheetNs + "col", new XAttribute("min", index + 1), new XAttribute("max", index + 1), new XAttribute("width", width), new XAttribute("customWidth", 1)))),
        new XElement(SheetNs + "sheetData", rows.Select((row, index) => new XElement(SheetNs + "row", new XAttribute("r", index + 1),
            row.Select((value, column) => Cell($"{(char)('A' + column)}{index + 1}", value, index == 0))))));

    private static XElement Cell(string reference, object value, bool header)
    {
        var numeric = value is int or long or decimal;
        var fractional = value is decimal number && number != decimal.Truncate(number);
        // Chuỗi luôn là inlineStr, không thể trở thành công thức Excel từ nội dung người dùng.
        return new(SheetNs + "c", new XAttribute("r", reference), new XAttribute("s", header ? 1 : numeric && !fractional ? 2 : 0),
            new XAttribute("t", numeric ? "n" : "inlineStr"), numeric
                ? new XElement(SheetNs + "v", Convert.ToString(value, CultureInfo.InvariantCulture))
                : new XElement(SheetNs + "is", new XElement(SheetNs + "t", value.ToString())));
    }

    private static XElement Styles() => XElement.Parse("""
        <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
          <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
          <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF235C46"/><bgColor indexed="64"/></patternFill></fill></fills>
          <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
          <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
          <cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
          <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
        </styleSheet>
        """);

    private static void Write(ZipArchive archive, string path, XElement element)
    {
        using var stream = archive.CreateEntry(path, CompressionLevel.Fastest).Open();
        new XDocument(new XDeclaration("1.0", "utf-8", "yes"), element).Save(stream);
    }

    public static string PrintableHtml(SalesReport report)
    {
        static string Escape(object value) => WebUtility.HtmlEncode(value is long number ? number.ToString("N0", Vi) : value.ToString() ?? "");
        var summary = string.Join("", Summary(report).Skip(1).Select(row => $"<tr><th>{Escape(row[0])}</th><td>{Escape(row[1])}</td></tr>"));
        var daily = string.Join("", report.RevenueByDay.Select(day => $"<tr><td>{day.Date}</td><td>{day.Orders}</td><td>{Escape(day.GrossRevenue)}</td><td>{Escape(day.Refunds)}</td><td>{Escape(day.Revenue)}</td></tr>"));
        if (report.RevenueByDay.Count == 0) daily = "<tr><td colspan='5'>Chưa có giao dịch đã thanh toán trong kỳ.</td></tr>";
        return $$$"""
            <!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Báo cáo doanh thu Store</title>
            <style>@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font:12px/1.5 Arial,sans-serif;color:#17382c;margin:24px auto;max-width:900px}h1{font-size:23px}h2{font-size:16px;margin-top:24px}table{border-collapse:collapse;width:100%;margin:12px 0}th,td{border:1px solid #b8c9bf;padding:7px 9px;text-align:right;overflow-wrap:anywhere}thead th{background:#edf4ef}th:first-child,td:first-child{text-align:left}.summary th{width:45%;font-weight:normal}.summary td{text-align:left}thead{display:table-header-group}tr{break-inside:avoid}button{padding:10px 16px;cursor:pointer}@media print{body{margin:0;max-width:none}button{display:none}}</style></head>
            <body><button onclick="window.print()">In / lưu PDF</button><h1>Báo cáo doanh thu Store</h1><p>{{{report.From}}} → {{{report.To}}} · Đơn vị: VND · Múi giờ Việt Nam</p>
            <table class="summary"><tbody>{{{summary}}}</tbody></table><h2>Chi tiết theo ngày thanh toán</h2><table><thead><tr><th>Ngày</th><th>Số đơn</th><th>Doanh thu gộp</th><th>Hoàn tiền</th><th>Doanh thu ròng</th></tr></thead><tbody>{{{daily}}}</tbody></table></body></html>
            """;
    }
}
