using System.Globalization;
using StoreApi.Models;

namespace StoreApi.Data;

public sealed partial class StoreDb
{
    private sealed record ReportOrder(string Id, string Status, long Total, long Refund, DateOnly? Day, bool Demo);

    public SalesReport CalculateAdminRevenue(string from, string to)
    {
        if (!DateOnly.TryParseExact(from, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var start)
            || !DateOnly.TryParseExact(to, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var end) || start > end)
            throw new InvalidOperationException("INVALID_REPORT_RANGE");
        var orders = new List<ReportOrder>();
        var customerIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        using var connection = Open();
        using (var command = connection.CreateCommand())
        {
            command.CommandText = "SELECT id,status,CAST(total AS BIGINT)+extra_paid,refund_amount,paid_at,created_at FROM customer_orders";
            using var reader = command.ExecuteReader();
            while (reader.Read())
            {
                var id = reader.GetString(0);
                customerIds.Add(id);
                var time = reader.IsDBNull(4) ? reader.GetString(5) : reader.GetString(4);
                orders.Add(new(id, reader.GetString(1), Convert.ToInt64(reader.GetValue(2)), Convert.ToInt64(reader.GetValue(3)), BusinessDay(time), false));
            }
        }
        using (var command = connection.CreateCommand())
        {
            command.CommandText = "SELECT id,status,total_amount,refund_amount,business_date,is_demo FROM orders";
            using var reader = command.ExecuteReader();
            while (reader.Read())
            {
                var id = reader.GetString(0);
                // Một đơn đồng bộ sang bảng cũ không được cộng doanh thu lần thứ hai.
                if (customerIds.Contains(id)) continue;
                orders.Add(new(id, reader.GetString(1), Convert.ToInt64(reader.GetValue(2)), Convert.ToInt64(reader.GetValue(3)), BusinessDay(reader.GetString(4)), Convert.ToInt32(reader.GetValue(5)) != 0));
            }
        }
        var period = orders.Where(order => order.Day >= start && order.Day <= end).ToList();
        var real = period.Where(order => !order.Demo).ToList();
        var paid = real.Where(order => order.Status is "paid" or "completed" or "delivered" or "refunded").ToList();
        var daily = paid.GroupBy(order => order.Day!.Value).OrderBy(group => group.Key)
            .Select(group => new SalesDay(group.Key.ToString("yyyy-MM-dd"), group.LongCount(), group.Sum(order => order.Total),
                group.Sum(order => order.Refund), group.Sum(order => order.Total - order.Refund))).ToList();
        return new(from, to, real.Count, paid.Count, paid.Sum(order => order.Total), paid.Sum(order => order.Refund),
            paid.Sum(order => order.Total - order.Refund), period.Count(order => order.Demo), orders.Count(order => order.Day is null),
            daily, real.GroupBy(order => order.Status).Select(group => new SalesStatus(group.Key, group.LongCount())).ToList());
    }

    private static DateOnly? BusinessDay(string value)
    {
        if (DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var day)) return day;
        if (DateTime.TryParseExact(value, "dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var legacy))
            return DateOnly.FromDateTime(legacy);
        if (DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var instant))
            return DateOnly.FromDateTime(instant.ToOffset(TimeSpan.FromHours(7)).DateTime);
        return null;
    }
}
