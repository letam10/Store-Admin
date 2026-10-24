/*
 * Tệp: server-dotnet/Data/ConsoleMenu.cs
 * Mục đích: Bảng menu tương tác quản lý hệ thống trên Console ASP.NET Core (giao diện chuẩn, căn lề thẳng hàng 100%).
 */
using System.Diagnostics;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using Microsoft.AspNetCore.Builder;
using StoreApi.Security;

namespace StoreApi.Data;

public static class ConsoleMenu
{
    private static int? _storeFrontendCmdPid;
    private static int? _adminFrontendCmdPid;

    public static async Task RunAsync(StoreDb db, WebApplication app)
    {
        Console.OutputEncoding = System.Text.Encoding.UTF8;
        Console.InputEncoding = System.Text.Encoding.UTF8;

        bool apiHostWasStopped = false;
        bool IsApiRunning() => IsPortInUse(5000);

        // Tien ich ve khung – gon, can le, khong dau de hien thi dep tren moi console.
        const int W = 64;
        string Line(char c) => new string(c, W);
        void Hr() { Console.ForegroundColor = ConsoleColor.DarkCyan; Console.WriteLine(" " + Line('─')); Console.ResetColor(); }
        void TitleBar()
        {
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine(" ┌" + Line('─') + "┐");
            Console.WriteLine(" │" + Center("STORE ECOSYSTEM  •  1 CUA SO DIEU KHIEN TAT CA", W) + "│");
            Console.WriteLine(" │" + Center("API :5000  •  Store :5173  •  Admin :5174", W) + "│");
            Console.WriteLine(" └" + Line('─') + "┘");
            Console.ResetColor();
        }
        string Center(string s, int w)
        {
            if (s.Length >= w) return s.Substring(0, w);
            int p = (w - s.Length) / 2;
            return new string(' ', p) + s + new string(' ', w - s.Length - p);
        }

        void StatusRow(string name, bool live, string detail)
        {
            Console.Write("  ");
            Console.ForegroundColor = ConsoleColor.DarkGray;
            Console.Write(name + " : ");
            Console.ResetColor();
            Console.ForegroundColor = live ? ConsoleColor.Green : ConsoleColor.DarkGray;
            Console.Write(live ? "[ON ] " : "[OFF] ");
            Console.ResetColor();
            Console.ForegroundColor = ConsoleColor.Gray;
            Console.WriteLine(detail);
            Console.ResetColor();
        }
        void DbRow(string detail)
        {
            Console.Write("  ");
            Console.ForegroundColor = ConsoleColor.DarkGray;
            Console.Write("DB Store : ");
            Console.ResetColor();
            bool ok = detail.StartsWith("OK");
            Console.ForegroundColor = ok ? ConsoleColor.Green : ConsoleColor.Red;
            Console.WriteLine(detail);
            Console.ResetColor();
        }
        void PrintTwoCol((string k, string t) left, (string k, string t) right)
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.Write($"  [{left.k}] ");
            Console.ForegroundColor = ConsoleColor.White;
            Console.Write(left.t.PadRight(22));
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.Write($"[{right.k}] ");
            Console.ForegroundColor = ConsoleColor.White;
            Console.WriteLine(right.t);
            Console.ResetColor();
        }
        void OpenUrl(string url)
        {
            try { Process.Start(new ProcessStartInfo { FileName = url, UseShellExecute = true }); } catch { }
        }
        async Task WaitForPortsAsync(IEnumerable<int> ports, TimeSpan timeout)
        {
            var sw = System.Diagnostics.Stopwatch.StartNew();
            var target = ports.ToHashSet();
            while (sw.Elapsed < timeout)
            {
                var listening = GetListeningPorts();
                if (target.All(p => listening.Contains(p))) return;
                await Task.Delay(100);
            }
        }
        async Task StartAllAsync()
        {
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("\n[+] DANG KHOI DONG TOAN BO HE THONG (API + Store + Admin)...");
            Console.ResetColor();

            var database = db.EnsureReady();
            DbRow(database.Ok ? "OK  -  database đã sẵn sàng" : $"LOI - {database.Message}");

            var current = GetListeningPorts();

            // 1. API 5000
            try
            {
                if (!current.Contains(5000))
                {
                    if (apiHostWasStopped)
                    {
                        StartApiConsole();
                    }
                    else
                    {
                        await app.StartAsync();
                    }
                    Console.WriteLine("  [1/3] API :5000          -> Dang khoi dong...");
                }
                else
                {
                    Console.WriteLine("  [1/3] API :5000          -> Da chay san.");
                }
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine($"  [1/3] API :5000 gap loi ({ex.Message}), thu mo cua so console moi...");
                Console.ResetColor();
                StartApiConsole();
            }

            // 2. Store 5173
            if (!current.Contains(5173))
            {
                LaunchStoreProcess();
                Console.WriteLine("  [2/3] Store Frontend :5173 -> Dang khoi dong...");
            }
            else
            {
                Console.WriteLine("  [2/3] Store Frontend :5173 -> Da chay san.");
            }

            // 3. Admin 5174
            if (!current.Contains(5174))
            {
                LaunchAdminProcess();
                Console.WriteLine("  [3/3] Admin Dashboard :5174-> Dang khoi dong...");
            }
            else
            {
                Console.WriteLine("  [3/3] Admin Dashboard :5174-> Da chay san.");
            }

            // Cho ca 3 cong san sang dong thoi (toi da 12s)
            await WaitForPortsAsync(new[] { 5000, 5173, 5174 }, TimeSpan.FromSeconds(12));

            var ready = GetListeningPorts();
            if (ready.Contains(5000)) OpenUrl("http://127.0.0.1:5000/swagger");
            if (ready.Contains(5173)) OpenUrl("http://127.0.0.1:5173");
            if (ready.Contains(5174)) OpenUrl("http://127.0.0.1:5174");

            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("\n[OK] DA BAT TOAN BO HE THONG VA MO 3 TRANG WEB!");
            Console.ResetColor();
            WaitKey();
        }

        async Task StopAllCoreAsync()
        {
            // 1. Dung API in-process neu dang chay
            if (IsApiRunning())
            {
                try
                {
                    await app.StopAsync();
                    apiHostWasStopped = true;
                }
                catch { }
            }

            // 2 & 3. Giai phong toan bo port 5000, 5173, 5174 va tat ca cay tien trinh CMD/Node trong 1 lenh duy nhat
            StopPorts(5000, 5173, 5174);

            // Cho toi da 1s de tat ca cac port dong hoan toan
            var sw = System.Diagnostics.Stopwatch.StartNew();
            while (sw.ElapsedMilliseconds < 1000)
            {
                var ports = GetListeningPorts();
                if (!ports.Contains(5000) && !ports.Contains(5173) && !ports.Contains(5174))
                    break;
                await Task.Delay(50);
            }

            var finalCheck = GetListeningPorts();
            Console.WriteLine(finalCheck.Contains(5000)
                ? "  [1/3] API :5000          -> Chua tat hoan toan."
                : "  [1/3] API :5000          -> Da tat.");
            Console.WriteLine(finalCheck.Contains(5173)
                ? "  [2/3] Store Frontend :5173 -> Chua tat hoan toan."
                : "  [2/3] Store Frontend :5173 -> Da tat.");
            Console.WriteLine(finalCheck.Contains(5174)
                ? "  [3/3] Admin Dashboard :5174-> Chua tat hoan toan."
                : "  [3/3] Admin Dashboard :5174-> Da tat.");
        }
        while (true)
        {
            try { Console.Clear(); } catch { }
            TitleBar();

            // Panel trang thai live: API / Store / Admin / DB – kiem tra port nhanh tu bang kernel Windows (< 1ms).
            var livePorts = GetListeningPorts();
            bool apiLive = livePorts.Contains(5000);
            bool s5173 = livePorts.Contains(5173);
            bool s5174 = livePorts.Contains(5174);
            string dbLine;
            try
            {
                var health = db.TryCheckHealth();
                if (health.Ok)
                {
                    long pc = 0; try { pc = db.ProductCount(); } catch { }
                    dbLine = $"OK  -  {db.DatabaseName} ({pc} sp)";
                }
                else dbLine = $"LOI - {health.Message}";
            }
            catch (Exception ex) { dbLine = $"LOI - {ex.Message}"; }

            Console.ForegroundColor = ConsoleColor.White;
            Console.WriteLine(" TRANG THAI HE THONG (live)");
            Console.ResetColor();
            StatusRow("API 5000 ", apiLive, apiLive ? "http://127.0.0.1:5000/swagger" : "dang tat");
            StatusRow("Store 5173", s5173, s5173 ? "http://127.0.0.1:5173" : "dang tat");
            StatusRow("Admin 5174", s5174, s5174 ? "http://127.0.0.1:5174" : "dang tat");
            DbRow(dbLine);
            Hr();

            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine(" ▶ DIEU KHIEN HE THONG");
            Console.ResetColor();
            PrintMenuItem("1 ", "★ BAT TOAN BO  (API :5000 + Store :5173 + Admin :5174 + Mo Web)", ConsoleColor.Green);
            PrintMenuItem("2 ", "■ TAT TOAN BO  (Dung API :5000 + Dong ca hai Frontend)", ConsoleColor.Red);
            PrintMenuItem("W ", "Mo lai Web     (Swagger / Store / Admin / Health)");
            Hr();

            Console.ForegroundColor = ConsoleColor.DarkGray;
            Console.WriteLine(" ⚙ QUAN TRI DU LIEU");
            Console.ResetColor();
            PrintTwoCol(("3", "Tao Admin"), ("4", "Doi pass Admin"));
            PrintTwoCol(("5", "Tao KH mau"), ("6", "Seed san pham"));
            PrintTwoCol(("7", "Thong ke DB"), ("R", "Reset Database"));
            PrintMenuItem("0 ", "Thoat (Tat toan bo he thong va dong)", ConsoleColor.DarkGray);

            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine(" └" + Line('─') + "┘");
            Console.ResetColor();
            Console.Write("Chon [1/2/W/3-7/R/0]: ");

            var choice = (Console.ReadLine()?.Trim() ?? "").ToUpperInvariant();
            switch (choice)
            {
                case "1":
                case "F":
                    await StartAllAsync();
                    break;

                case "2":
                case "10":
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Console.WriteLine("\n[-] Dang tat toan bo he thong...");
                    Console.ResetColor();
                    await StopAllCoreAsync();
                    Console.ForegroundColor = ConsoleColor.Green;
                    Console.WriteLine("\n[OK] Da tat toan bo he thong thanh cong!");
                    Console.ResetColor();
                    WaitKey();
                    break;

                case "W":
                    OpenUrl("http://127.0.0.1:5000/swagger");
                    OpenUrl("http://127.0.0.1:5000/api/health/db");
                    OpenUrl("http://127.0.0.1:5173");
                    OpenUrl("http://127.0.0.1:5174");
                    Console.ForegroundColor = ConsoleColor.Green;
                    Console.WriteLine("\nDa mo 4 tab: Swagger :5000 / HealthDB / Store :5173 / Admin :5174.");
                    Console.ResetColor();
                    WaitKey();
                    break;

                case "3":
                    CreateAdmin(db);
                    break;

                case "4":
                    UpdateAdminPassword(db);
                    break;

                case "5":
                    CreateSampleCustomer(db);
                    break;

                case "6":
                    SeedProducts(db);
                    break;

                case "7":
                    ShowStats(db);
                    break;

                case "R":
                    ResetDatabase(db);
                    break;

                case "8":
                case "9":
                    Console.ForegroundColor = ConsoleColor.Cyan;
                    Console.WriteLine("\n[!] Phím [8] & [9] đã bỏ! Bấm [1] để chạy cả 3 hoặc [2] để tắt cả 3.");
                    Console.ResetColor();
                    WaitKey();
                    break;

                case "0":
                    Console.WriteLine("\n[-] Đang tắt toàn bộ hệ thống trước khi thoát...");
                    await StopAllCoreAsync();
                    Console.WriteLine("\nĐã tắt toàn bộ. Hẹn gặp lại!");
                    Environment.Exit(0);
                    return;

                default:
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Console.WriteLine("\nLựa chọn không hợp lệ! Vui lòng chọn [1/2/W/3-7/R/0].");
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

    private static HashSet<int> GetListeningPorts()
    {
        try
        {
            var listeners = IPGlobalProperties.GetIPGlobalProperties().GetActiveTcpListeners();
            return new HashSet<int>(listeners.Select(ep => ep.Port));
        }
        catch
        {
            return new HashSet<int>();
        }
    }

    private static bool IsPortInUse(int port)
    {
        try
        {
            return GetListeningPorts().Contains(port);
        }
        catch
        {
            return false;
        }
    }

    private static string GetWorkspaceRoot()
    {
        foreach (var baseDir in new[] { Directory.GetCurrentDirectory(), AppContext.BaseDirectory })
        {
            var cur = new DirectoryInfo(baseDir);
            while (cur != null)
            {
                if (Directory.Exists(Path.Combine(cur.FullName, "Store")) && Directory.Exists(Path.Combine(cur.FullName, "Store-Admin")))
                {
                    return cur.FullName;
                }
                cur = cur.Parent;
            }
        }
        return @"D:\Web";
    }

    private static void StartApiConsole()
    {
        if (IsPortInUse(5000))
        {
            Console.WriteLine("API :5000 dang chay roi - khong mo them console moi.");
            return;
        }

        try
        {
            var root = GetWorkspaceRoot();
            var proj = Path.Combine(root, "Store-Admin", "server-dotnet", "server-dotnet.csproj");
            Process.Start(new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = $"/k title API :5000 && dotnet run --project \"{proj}\" --urls http://127.0.0.1:5000",
                UseShellExecute = true
            });
            Console.WriteLine("Da mo cua so API moi cho http://127.0.0.1:5000.");
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"LOI - Khong mo duoc API console moi: {ex.Message}");
            Console.ResetColor();
        }
    }

    private static void LaunchStoreProcess()
    {
        try
        {
            var root = GetWorkspaceRoot();
            var dir = Path.Combine(root, "Store");
            var cmd = Process.Start(new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = $"/k title Store Frontend :5173 && cd /d \"{dir}\" && npm.cmd run dev",
                UseShellExecute = true
            });
            if (cmd != null) _storeFrontendCmdPid = cmd.Id;
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"  [Store] Loi mo tien trinh: {ex.Message}");
            Console.ResetColor();
        }
    }

    private static void LaunchAdminProcess()
    {
        try
        {
            var root = GetWorkspaceRoot();
            var dir = Path.Combine(root, "Store-Admin");
            var cmd = Process.Start(new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = $"/k title Admin Dashboard :5174 && cd /d \"{dir}\" && npm.cmd run dev",
                UseShellExecute = true
            });
            if (cmd != null) _adminFrontendCmdPid = cmd.Id;
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"  [Admin] Loi mo tien trinh: {ex.Message}");
            Console.ResetColor();
        }
    }

    private static void StopPort(int port)
    {
        StopPorts(port);
    }

    private static void StopPorts(params int[] ports)
    {
        try
        {
            var pidsToKill = new HashSet<int>();

            if (_storeFrontendCmdPid is > 0) pidsToKill.Add(_storeFrontendCmdPid.Value);
            if (_adminFrontendCmdPid is > 0) pidsToKill.Add(_adminFrontendCmdPid.Value);
            _storeFrontendCmdPid = null;
            _adminFrontendCmdPid = null;

            var portPids = GetPidsByPorts(ports);
            foreach (var pid in portPids)
            {
                pidsToKill.Add(pid);
            }

            if (pidsToKill.Count == 0) return;

            var args = "/F /T " + string.Join(" ", pidsToKill.Select(p => $"/PID {p}"));
            var psi = new ProcessStartInfo
            {
                FileName = "taskkill",
                Arguments = args,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using var p = Process.Start(psi);
            p?.WaitForExit(3000);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"  Loi khi tat tien trinh: {ex.Message}");
        }
    }

    private static List<int> GetPidsByPorts(IEnumerable<int> ports)
    {
        var targetPorts = ports.ToHashSet();
        var pids = new List<int>();
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "netstat",
                Arguments = "-ano -p TCP",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using var p = Process.Start(psi);
            if (p == null) return pids;
            string output = p.StandardOutput.ReadToEnd();
            p.WaitForExit(3000);
            int selfPid = Environment.ProcessId;

            foreach (var rawLine in output.Split('\n'))
            {
                var line = rawLine.Trim();
                if (!line.StartsWith("TCP", StringComparison.OrdinalIgnoreCase)) continue;
                if (!line.Contains("LISTENING", StringComparison.OrdinalIgnoreCase)) continue;

                bool matches = false;
                foreach (var port in targetPorts)
                {
                    if (line.Contains($":{port} ", StringComparison.Ordinal))
                    {
                        matches = true;
                        break;
                    }
                }
                if (!matches) continue;

                var parts = line.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length == 0) continue;
                if (int.TryParse(parts[^1], out int pid) && pid > 0 && pid != selfPid && !pids.Contains(pid))
                {
                    pids.Add(pid);
                }
            }
        }
        catch { }
        return pids;
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
            db.SeedDefaultProducts(force: true);
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
