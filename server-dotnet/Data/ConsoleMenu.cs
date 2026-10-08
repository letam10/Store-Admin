/*
 * Tệp: server-dotnet/Data/ConsoleMenu.cs
 * Mục đích: Bảng menu tương tác quản lý hệ thống trên Console ASP.NET Core (giao diện chuẩn, căn lề thẳng hàng 100%).
 */
using System.Diagnostics;
using Microsoft.AspNetCore.Builder;
using StoreApi.Security;

namespace StoreApi.Data;

public static class ConsoleMenu
{
    public static async Task RunAsync(StoreDb db, WebApplication app)
    {
        Console.OutputEncoding = System.Text.Encoding.UTF8;
        Console.InputEncoding = System.Text.Encoding.UTF8;

        bool isServerRunning = false;

        while (true)
        {
            Console.Clear();
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("============================================================");
            Console.WriteLine("        STORE MANAGEMENT SYSTEM - ASP.NET CORE (C#)         ");
            Console.WriteLine("============================================================");
            Console.ResetColor();

            if (isServerRunning)
            {
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine("  Trạng thái API   : [ 🟢 ĐANG CHẠY - http://127.0.0.1:5000 ]");
                Console.WriteLine("  Tài liệu Swagger : http://localhost:5000/swagger");
                Console.ResetColor();
                Console.WriteLine("------------------------------------------------------------");
                PrintMenuItem("1", "Dừng Web API Server", ConsoleColor.Yellow);
            }
            else
            {
                Console.ForegroundColor = ConsoleColor.DarkGray;
                Console.WriteLine("  Trạng thái API   : [ ⚪ ĐÃ TẮT ]");
                Console.ResetColor();
                Console.WriteLine("------------------------------------------------------------");
                PrintMenuItem("1", "Khởi chạy Web API (Mở cổng 5000 & Swagger)", ConsoleColor.Green);
            }

            PrintMenuItem("2", "Tạo tài khoản Admin mới");
            PrintMenuItem("3", "Đổi mật khẩu tài khoản Admin");
            PrintMenuItem("4", "Tạo nhanh tài khoản Khách hàng mẫu (Test Data)");
            PrintMenuItem("5", "Nạp lại dữ liệu Sản phẩm mẫu (Seed Products)");
            PrintMenuItem("6", "Xem thống kê hệ thống (SP, Khách hàng, Admin)");
            PrintMenuItem("7", "Làm sạch & Reset Database về mặc định");
            Console.WriteLine("------------------------------------------------------------");
            PrintMenuItem("8", "Bật Giao diện Store Khách hàng (React - Cổng 5173)");
            PrintMenuItem("9", "Bật Giao diện Admin Dashboard (React - Cổng 5174)");
            PrintMenuItem("0", "Thoát chương trình", ConsoleColor.DarkGray);

            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("============================================================");
            Console.ResetColor();
            Console.Write("👉 Nhập lựa chọn của bạn [0-9]: ");

            var choice = Console.ReadLine()?.Trim();
            switch (choice)
            {
                case "1":
                    if (!isServerRunning)
                    {
                        Console.ForegroundColor = ConsoleColor.Green;
                        Console.WriteLine("\n[+] Đang khởi động Web API Server...");
                        Console.ResetColor();
                        try
                        {
                            await app.StartAsync();
                            isServerRunning = true;
                            Console.ForegroundColor = ConsoleColor.Green;
                            Console.WriteLine("✅ Server đã bật thành công tại http://127.0.0.1:5000!");
                            Console.WriteLine("👉 Web API đang chạy ngầm, bạn có thể chọn tiếp [8] hoặc [9] để mở web ngay!");
                            Console.ResetColor();
                        }
                        catch (Exception ex)
                        {
                            Console.ForegroundColor = ConsoleColor.Red;
                            Console.WriteLine($"❌ Lỗi khởi động server: {ex.Message}");
                            Console.ResetColor();
                        }
                    }
                    else
                    {
                        Console.ForegroundColor = ConsoleColor.Yellow;
                        Console.WriteLine("\n[-] Đang dừng Web API Server...");
                        Console.ResetColor();
                        try
                        {
                            await app.StopAsync();
                            isServerRunning = false;
                            Console.ForegroundColor = ConsoleColor.Green;
                            Console.WriteLine("✅ Đã dừng Web API Server.");
                            Console.ResetColor();
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"❌ Lỗi dừng server: {ex.Message}");
                        }
                    }
                    WaitKey();
                    break;

                case "2":
                    CreateAdmin(db);
                    break;

                case "3":
                    UpdateAdminPassword(db);
                    break;

                case "4":
                    CreateSampleCustomer(db);
                    break;

                case "5":
                    SeedProducts(db);
                    break;

                case "6":
                    ShowStats(db);
                    break;

                case "7":
                    ResetDatabase(db);
                    break;

                case "8":
                    StartFrontendStore();
                    break;

                case "9":
                    StartFrontendAdmin();
                    break;

                case "0":
                    if (isServerRunning)
                    {
                        try { await app.StopAsync(); } catch { }
                    }
                    Console.WriteLine("\nĐã thoát chương trình.");
                    Environment.Exit(0);
                    return;

                default:
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Console.WriteLine("\nLựa chọn không hợp lệ! Vui lòng thử lại.");
                    Console.ResetColor();
                    WaitKey();
                    break;
            }
        }
    }

    private static void PrintMenuItem(string key, string text, ConsoleColor? color = null)
    {
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.Write($"  [{key}] ");
        if (color.HasValue) Console.ForegroundColor = color.Value;
        else Console.ResetColor();
        Console.WriteLine(text);
        Console.ResetColor();
    }

    private static void StartFrontendStore()
    {
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine("\n[+] Đang mở cửa sổ chạy Frontend Store (http://localhost:5173)...");
        Console.ResetColor();
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = "/k cd /d \"D:\\Web\\Store\" && npm run dev",
                UseShellExecute = true
            });
            try { Process.Start(new ProcessStartInfo { FileName = "http://localhost:5173", UseShellExecute = true }); } catch { }
            Console.WriteLine("✅ Đã mở Frontend Store thành công!");
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"❌ Lỗi mở Store: {ex.Message}");
            Console.ResetColor();
        }
        WaitKey();
    }

    private static void StartFrontendAdmin()
    {
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine("\n[+] Đang mở cửa sổ chạy Admin Dashboard (http://localhost:5174)...");
        Console.ResetColor();
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = "/k cd /d \"D:\\Web\\Store-Admin\" && npm run dev",
                UseShellExecute = true
            });
            try { Process.Start(new ProcessStartInfo { FileName = "http://localhost:5174", UseShellExecute = true }); } catch { }
            Console.WriteLine("✅ Đã mở Admin Dashboard thành công!");
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"❌ Lỗi mở Admin Dashboard: {ex.Message}");
            Console.ResetColor();
        }
        WaitKey();
    }

    private static void CreateAdmin(StoreDb db)
    {
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine("\n--- [2] TẠO TÀI KHOẢN ADMIN MỚI ---");
        Console.ResetColor();

        Console.Write("Nhập Tên đăng nhập Admin: ");
        var username = Console.ReadLine()?.Trim();
        if (string.IsNullOrWhiteSpace(username))
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine("Tên đăng nhập không được để trống!");
            Console.ResetColor();
            WaitKey();
            return;
        }

        Console.Write("Nhập Mật khẩu: ");
        var password = Console.ReadLine()?.Trim();
        if (string.IsNullOrWhiteSpace(password) || password.Length < 4)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine("Mật khẩu phải có ít nhất 4 ký tự!");
            Console.ResetColor();
            WaitKey();
            return;
        }

        try
        {
            db.CreateAdmin(username, password);
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine($"\n✅ Đã tạo tài khoản Admin thành công! (Username: {username})");
            Console.ResetColor();
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"\n❌ Lỗi tạo Admin: {ex.Message}");
            Console.ResetColor();
        }
        WaitKey();
    }

    private static void UpdateAdminPassword(StoreDb db)
    {
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine("\n--- [3] ĐỔI MẬT KHẨU TÀI KHOẢN ADMIN ---");
        Console.ResetColor();

        var admins = db.ListAdmins();
        if (admins.Count == 0)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine("Chưa có tài khoản Admin nào trong hệ thống! Hãy chọn [2] để tạo mới.");
            Console.ResetColor();
            WaitKey();
            return;
        }

        Console.WriteLine("Danh sách Admin hiện có:");
        foreach (var (u, _) in admins) Console.WriteLine($" - {u}");

        Console.Write("\nNhập Tên đăng nhập Admin cần đổi: ");
        var username = Console.ReadLine()?.Trim();
        if (string.IsNullOrWhiteSpace(username) || db.FindAdmin(username) is null)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine("Tài khoản không tồn tại!");
            Console.ResetColor();
            WaitKey();
            return;
        }

        Console.Write("Nhập Mật khẩu mới: ");
        var password = Console.ReadLine()?.Trim();
        if (string.IsNullOrWhiteSpace(password) || password.Length < 4)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine("Mật khẩu phải có ít nhất 4 ký tự!");
            Console.ResetColor();
            WaitKey();
            return;
        }

        db.CreateAdmin(username, password);
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine($"\n✅ Đã đổi mật khẩu cho Admin [{username}] thành công!");
        Console.ResetColor();
        WaitKey();
    }

    private static void CreateSampleCustomer(StoreDb db)
    {
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine("\n--- [4] TẠO TÀI KHOẢN KHÁCH HÀNG MẪU (TEST DATA) ---");
        Console.ResetColor();

        Console.Write("Nhập Tên người dùng (Mặc định: khachhang1): ");
        var username = Console.ReadLine()?.Trim();
        if (string.IsNullOrWhiteSpace(username)) username = "khachhang1";

        Console.Write("Nhập Email (Mặc định: khachhang1@store.vn): ");
        var email = Console.ReadLine()?.Trim();
        if (string.IsNullOrWhiteSpace(email)) email = $"{username}@store.vn";

        Console.Write("Nhập Mật khẩu (Mặc định: 123456): ");
        var password = Console.ReadLine()?.Trim();
        if (string.IsNullOrWhiteSpace(password)) password = "123456";

        var (salt, hash) = Tokens.HashPassword(password);
        try
        {
            db.CreateCustomer(username, email, salt, hash, points: 500, spinCredits: 3);
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine($"\n✅ Đã tạo Khách hàng mẫu thành công!");
            Console.WriteLine($"   - Username: {username}");
            Console.WriteLine($"   - Email: {email}");
            Console.WriteLine($"   - Mật khẩu: {password}");
            Console.WriteLine($"   - Điểm thưởng có sẵn: 500 điểm");
            Console.ResetColor();
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"\n❌ Lỗi tạo Khách hàng (có thể đã tồn tại): {ex.Message}");
            Console.ResetColor();
        }
        WaitKey();
    }

    private static void SeedProducts(StoreDb db)
    {
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine("\n--- [5] NẠP LẠI DỮ LIỆU SẢN PHẨM MẪU (SEED PRODUCTS) ---");
        Console.ResetColor();

        try
        {
            db.SeedDefaultProducts();
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("\n✅ Đã nạp thành công các sản phẩm mẫu vào bảng Products và catalog_products trong SQL Server!");
            Console.ResetColor();
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"\n❌ Lỗi nạp dữ liệu: {ex.Message}");
            Console.ResetColor();
        }
        WaitKey();
    }

    private static void ShowStats(StoreDb db)
    {
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine("\n--- [6] THỐNG KÊ HỆ THỐNG HIỆN TẠI (SQL SERVER) ---");
        Console.ResetColor();

        try
        {
            var productCount = db.ProductCount();
            var customerCount = db.CustomerCount();
            var adminCount = db.AdminCount();
            var orderCount = db.OrderCount();
            var totalViews = db.TotalViews();

            Console.WriteLine($" 📦 Tổng số sản phẩm trong bảng Products: {productCount}");
            Console.WriteLine($" 👤 Tổng số khách hàng:                  {customerCount}");
            Console.WriteLine($" 🛡️  Tổng số tài khoản Admin:             {adminCount}");
            Console.WriteLine($" 🛒 Tổng số đơn hàng:                     {orderCount}");
            Console.WriteLine($" 👁️  Tổng lượt xem sản phẩm:              {totalViews}");

            var admins = db.ListAdmins();
            if (admins.Count > 0)
            {
                Console.WriteLine("\n Danh sách Admins:");
                foreach (var (u, d) in admins) Console.WriteLine($"   - {u} (Tạo lúc: {d})");
            }

            var customers = db.ListCustomers();
            if (customers.Count > 0)
            {
                Console.WriteLine("\n Danh sách Khách hàng gần nhất:");
                foreach (var (u, e, p) in customers) Console.WriteLine($"   - {u} ({e}) | {p} điểm");
            }
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"\n❌ Lỗi truy vấn thống kê: {ex.Message}");
            Console.ResetColor();
        }
        WaitKey();
    }

    private static void ResetDatabase(StoreDb db)
    {
        Console.ForegroundColor = ConsoleColor.Red;
        Console.WriteLine("\n--- [7] CẢNH BÁO: LÀM SẠCH & RESET TOÀN BỘ DATABASE ---");
        Console.ResetColor();
        Console.Write("Bạn có chắc chắn muốn xóa hết dữ liệu và khôi phục mặc định? (y/N): ");
        var confirm = Console.ReadLine()?.Trim().ToLowerInvariant();
        if (confirm != "y" && confirm != "yes")
        {
            Console.WriteLine("Đã hủy thao tác reset.");
            WaitKey();
            return;
        }

        try
        {
            db.ResetDatabase();
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("\n✅ Đã reset toàn bộ Database về trạng thái ban đầu sạch sẽ!");
            Console.ResetColor();
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"\n❌ Lỗi reset database: {ex.Message}");
            Console.ResetColor();
        }
        WaitKey();
    }

    private static void WaitKey()
    {
        Console.WriteLine("\n👉 Nhấn phím bất kỳ để quay lại Menu...");
        Console.ReadKey();
    }
}
