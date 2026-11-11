using System.Globalization;
using System.Text.Json;

namespace StoreApi.Services;

public static class OrderEmailService
{
    public static OrderInvoiceData BuildInvoice(string customerEmail, object order)
    {
        // Dựng lại hóa đơn từ bản ghi đã lưu để mọi nhánh thanh toán dùng cùng mẫu email.
        using var document = JsonDocument.Parse(JsonSerializer.Serialize(order));
        var root = document.RootElement;
        var items = new List<OrderInvoiceItem>();

        if (root.TryGetProperty("items", out var itemArray) && itemArray.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in itemArray.EnumerateArray())
            {
                var name = Text(item, "name");
                if (string.IsNullOrWhiteSpace(name)) name = Text(item, "id");
                var quantity = Math.Max(1, Number(item, "quantity"));
                var price = Number64(item, "price");
                items.Add(new OrderInvoiceItem(name, quantity, price, price * quantity));
            }
        }

        var orderId = Text(root, "id");
        var createdAt = Text(root, "createdAt");
        var scheduledAt = Text(root, "scheduledAt");
        return new OrderInvoiceData(
            orderId,
            customerEmail,
            Text(root, "recipient"),
            Text(root, "phone"),
            Text(root, "address"),
            Text(root, "fulfillment"),
            Text(root, "paymentMethod"),
            items,
            Number(root, "subtotal"),
            Math.Max(0, Number(root, "subtotal") - Number(root, "goodsTotal")),
            Number(root, "shippingFee"),
            Number(root, "total"),
            Text(root, "tier"),
            createdAt,
            string.IsNullOrWhiteSpace(scheduledAt) ? null : scheduledAt);
    }

    private static string Text(JsonElement element, string property)
    {
        return element.TryGetProperty(property, out var value) && value.ValueKind != JsonValueKind.Null
            ? value.ToString()
            : string.Empty;
    }

    private static int Number(JsonElement element, string property)
    {
        return (int)Math.Clamp(Number64(element, property), int.MinValue, int.MaxValue);
    }

    private static long Number64(JsonElement element, string property)
    {
        if (!element.TryGetProperty(property, out var value)) return 0;
        if (value.TryGetInt64(out var integer)) return integer;
        return long.TryParse(value.ToString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed) ? parsed : 0;
    }
}
