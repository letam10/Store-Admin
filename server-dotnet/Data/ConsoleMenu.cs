/*
 * Tệp: server-dotnet/Data/ConsoleMenu.cs
 * Mục đích: Bảng menu tương tác quản lý hệ thống trên Console ASP.NET Core (giao diện chuẩn, căn lề thẳng hàng 100%).
 */
using System.Diagnostics;
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

        bool isServerRunning = false;
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
        async Task WaitForPortAsync(int port, TimeSpan timeout)
        {
            var sw = System.Diagnostics.Stopwatch.StartNew();
            while (sw.Elapsed < timeout)
            {
                if (IsPortInUse(port)) return;
                await Task.Delay(400);
            }
        }
        async Task WaitForPortClosedAsync(int port, TimeSpan timeout)
        {
            var sw = System.Diagnostics.Stopwatch.StartNew();
            while (sw.Elapsed < timeout)
            {
                if (!IsPortInUse(port)) return;
                await Task.Delay(400);
            }
        }
        async Task StartFullstackAsync(WebApplication webApp)
        {
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("\n[+] FULLSTACK: API :5000 -> Store :5173 -> Admin :5174 ...");
            Console.ResetColor();
            try
            {
                if (!IsApiRunning())
                {
                    await webApp.StartAsync();
                    isServerRunning = true;
                    Console.WriteLine("  [1/3] API :5000 OK - http://127.0.0.1:5000/swagger");
                }
                else
                {
                    isServerRunning = true;
                    Console.WriteLine("  [1/3] API :5000 da chay - bo qua.");
                }
            }
            catch (Exception ex) { Console.WriteLine($"  [1/3] API loi: {ex.Message}"); }
            if (!IsPortInUse(5173)) StartFrontendStore(); else Console.WriteLine("  [2/3] Store :5173 da chay - bo qua.");
            if (!IsPortInUse(5174)) StartFrontendAdmin(); else Console.WriteLine("  [3/3] Admin :5174 da chay - bo qua.");
            await WaitForPortAsync(5000, TimeSpan.FromSeconds(12));
            OpenUrl("http://127.0.0.1:5000/swagger");
            OpenUrl("http://127.0.0.1:5173");
            OpenUrl("http://127.0.0.1:5174");
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("[OK] Mo 3 web: Swagger / Store / Admin. Kiem tra /api/health/db neu frontend bao loi fetch.");
            Console.ResetColor();
            WaitKey();
        }
        while (true)
        {
            Console.Clear();
            TitleBar();

            // Panel trang thai live: API / Store / Admin / DB – kiem tra port that, khong phu thuoc flag.
            bool apiLive = IsApiRunning();
            bool s5173 = IsPortInUse(5173);
            bool s5174 = IsPortInUse(5174);
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
            StatusRow("API 5000 ", apiLive, apiLive ? "http://127.0.0.1:5000/swagger" : "dang tat – bam [1] de bat");
            StatusRow("Store 5173", s5173, s5173 ? "http://127.0.0.1:5173" : "dang tat – bam [8] de bat");
            StatusRow("Admin 5174", s5174, s5174 ? "http://127.0.0.1:5174" : "dang tat – bam [9] de bat");
            DbRow(dbLine);
            Hr();

            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine(" ▶ DIEU KHIEN (bat API truoc → bat 5173/5174 → mo web)");
            Console.ResetColor();
            PrintMenuItem("F ", "★ Chay FULLSTACK 1-click (API + 2 Frontend + mo 3 web)", ConsoleColor.Green);
            if (!apiLive)
                PrintMenuItem("1 ", "Bat Web API Server :5000 (mo Swagger)", ConsoleColor.Green);
            else
                PrintMenuItem("1 ", "Tat Web API Server :5000", ConsoleColor.Yellow);
            PrintMenuItem("8 ", s5173 ? "Tat / Khoi dong lai Store Khach hang :5173" : "Bat Giao dien Store Khach hang :5173");
            PrintMenuItem("9 ", s5174 ? "Tat / Khoi dong lai Admin Dashboard :5174" : "Bat Giao dien Admin Dashboard :5174");
            PrintMenuItem("W ", "Mo nhanh Web (Swagger / Store / Admin / Health)");
            PrintMenuItem("10", "Tat ca hai Frontend (5173 + 5174)", ConsoleColor.Red);
            Hr();

            Console.ForegroundColor = ConsoleColor.DarkGray;
            Console.WriteLine(" QUAN TRI DU LIEU");
            Console.ResetColor();
            // In 2 cot cho gon: 2/3/4 tren 1 dong, 5/6/7 tren 1 dong.
            PrintTwoCol(("2", "Tao Admin"), ("3", "Doi pass Admin"));
            PrintTwoCol(("4", "Tao KH mau"), ("5", "Seed san pham"));
            PrintTwoCol(("6", "Thong ke"), ("7", "Reset DB"));
            PrintMenuItem("0 ", "Thoat (tu tat Frontend + dung API)", ConsoleColor.DarkGray);

            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine(" └" + Line('─') + "┘");
            Console.ResetColor();
            Console.Write("Chon [F/W/0-10]: ");

            var choice = (Console.ReadLine()?.Trim() ?? "").ToUpperInvariant();
            switch (choice)
            {
                case "F":
                    await StartFullstackAsync(app);
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

                case "1":
                    if (IsApiRunning())
                    {
                        Console.ForegroundColor = ConsoleColor.Yellow;
                        Console.WriteLine("\n[-] Dang dung Web API Server :5000...");
                        Console.ResetColor();
                        try
                        {
                            await app.StopAsync();
                            isServerRunning = false;
                            apiHostWasStopped = true;
                            await WaitForPortClosedAsync(5000, TimeSpan.FromSeconds(5));

                            if (IsApiRunning())
                            {
                                Console.ForegroundColor = ConsoleColor.Yellow;
                                Console.WriteLine("CANH BAO - StopAsync xong nhung port 5000 van mo. Dang kill process giu port 5000...");
                                Console.ResetColor();
                                StopPort(5000);
                                await WaitForPortClosedAsync(5000, TimeSpan.FromSeconds(5));
                            }

                            Console.ForegroundColor = IsApiRunning() ? ConsoleColor.Red : ConsoleColor.Green;
                            Console.WriteLine(IsApiRunning()
                                ? "LOI - Port 5000 van ON. Hay chay CMD Admin: netstat -ano | findstr :5000  roi taskkill /PID <PID> /T /F"
                                : "OK - Da dung Web API Server, port 5000 da OFF.");
                            Console.ResetColor();
                        }
                        catch (Exception ex)
                        {
                            isServerRunning = IsPortInUse(5000);
                            Console.ForegroundColor = ConsoleColor.Red;
                            Console.WriteLine($"LOI - Khong dung duoc API: {ex.Message}");
                            Console.ResetColor();
                        }
                    }
                    else
                    {
                        Console.ForegroundColor = ConsoleColor.Green;
                        Console.WriteLine("\n[+] Dang khoi dong Web API Server :5000...");
                        Console.ResetColor();
                        try
                        {
                            if (apiHostWasStopped)
                            {
                                StartApiConsole();
                                await WaitForPortAsync(5000, TimeSpan.FromSeconds(15));
                                isServerRunning = IsApiRunning();
                            }
                            else
                            {
                                await app.StartAsync();
                                isServerRunning = true;
                                await WaitForPortAsync(5000, TimeSpan.FromSeconds(10));
                            }

                            Console.ForegroundColor = IsApiRunning() ? ConsoleColor.Green : ConsoleColor.Yellow;
                            Console.WriteLine(IsApiRunning()
                                ? "OK - Server da bat tai http://127.0.0.1:5000/swagger"
                                : "CANH BAO - Da mo console API moi nhung port 5000 chua ON. Hay xem cua so API moi de biet loi.");
                            Console.WriteLine("Ban co the bam [8] Store, [9] Admin hoac [W] mo web nhanh.");
                            Console.ResetColor();
                        }
                        catch (OperationCanceledException)
                        {
                            StartApiConsole();
                            await WaitForPortAsync(5000, TimeSpan.FromSeconds(15));
                            isServerRunning = IsApiRunning();
                            Console.ForegroundColor = IsApiRunning() ? ConsoleColor.Green : ConsoleColor.Yellow;
                            Console.WriteLine(IsApiRunning()
                                ? "OK - Host cu da bi huy, da mo API bang console moi tai :5000."
                                : "CANH BAO - Da mo console API moi nhung port 5000 chua ON. Hay xem cua so API moi de biet loi.");
                            Console.ResetColor();
                        }
                        catch (InvalidOperationException ex) when (ex.Message.Contains("already started", StringComparison.OrdinalIgnoreCase))
                        {
                            isServerRunning = true;
                            Console.ForegroundColor = ConsoleColor.Yellow;
                            Console.WriteLine("API thuc te da dang chay. Da dong bo trang thai, khong khoi dong lai.");
                            Console.ResetColor();
                        }
                        catch (Exception ex)
                        {
                            isServerRunning = IsPortInUse(5000);
                            Console.ForegroundColor = ConsoleColor.Red;
                            Console.WriteLine($"LOI - Khoi dong API that bai: {ex.Message}");
                            Console.ResetColor();
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

                case "10":
                    StopFrontends();
                    break;

                case "0":
                    StopFrontendsCore();
                    if (IsApiRunning())
                    {
                        try { await app.StopAsync(); } catch { }
                        isServerRunning = false;
                        await WaitForPortClosedAsync(5000, TimeSpan.FromSeconds(3));
                        if (IsApiRunning()) StopPort(5000);
                    }
                    Console.WriteLine("\nDa tat Frontend + dung API. Hen gap lai!");
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

    private static bool IsPortInUse(int port)
    {
        try
        {
            using var client = new TcpClient();
            var result = client.BeginConnect("127.0.0.1", port, null, null);
            var success = result.AsyncWaitHandle.WaitOne(TimeSpan.FromMilliseconds(500));
            if (!success) return false;
            client.EndConnect(result);
            return true;
        }
        catch
        {
            return false;
        }
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
            Process.Start(new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = "/k cd /d \"D:\\Web\\Store-Admin\" && dotnet run --project server-dotnet\\server-dotnet.csproj --urls http://127.0.0.1:5000",
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

    private static void StartFrontendStore()
    {
        if (IsPortInUse(5173))
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("Cong 5173 dang chay Vite roi - mo lai trinh duyet thay vi khoi dong moi.");
            Console.ResetColor();
            try { Process.Start(new ProcessStartInfo { FileName = "http://localhost:5173", UseShellExecute = true }); } catch { }
            Console.WriteLine("Da mo lai Frontend Store.");
            WaitKey();
            return;
        }
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine("\n[+] Đang mở cửa sổ chạy Frontend Store (http://localhost:5173)...");
        Console.ResetColor();
        try
        {
            var cmd = Process.Start(new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = "/k cd /d \"D:\\Web\\Store\" && npm.cmd run dev",
                UseShellExecute = true
            });
            if (cmd != null) _storeFrontendCmdPid = cmd.Id;
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
        if (IsPortInUse(5174))
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("Cong 5174 dang chay Vite roi - mo lai trinh duyet thay vi khoi dong moi.");
            Console.ResetColor();
            try { Process.Start(new ProcessStartInfo { FileName = "http://localhost:5174", UseShellExecute = true }); } catch { }
            Console.WriteLine("Da mo lai Admin Dashboard.");
            WaitKey();
            return;
        }
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine("\n[+] Đang mở cửa sổ chạy Admin Dashboard (http://localhost:5174)...");
        Console.ResetColor();
        try
        {
            var cmd = Process.Start(new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = "/k cd /d \"D:\\Web\\Store-Admin\" && npm.cmd run dev",
                UseShellExecute = true
            });
            if (cmd != null) _adminFrontendCmdPid = cmd.Id;
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

    private static void StopFrontends()
    {
        StopFrontendsCore();
        WaitKey();
    }

    private static void StopFrontendsCore()
    {
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine("\n[-] Dang tat ca hai Frontend (5173 & 5174) va dong cua so CMD Vite...");
        Console.ResetColor();

        KillProcessTree(_storeFrontendCmdPid, "Store CMD :5173");
        KillProcessTree(_adminFrontendCmdPid, "Admin CMD :5174");
        _storeFrontendCmdPid = null;
        _adminFrontendCmdPid = null;

        // Fallback: neu PID cua so cmd khong con luu duoc, kill process dang giu port.
        StopPort(5173);
        StopPort(5174);
    }

    private static void KillProcessTree(int? pid, string label)
    {
        if (pid is null or <= 0)
        {
            Console.WriteLine($"  {label}: khong co PID cua so CMD da luu - se fallback theo port.");
            return;
        }

        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "taskkill",
                Arguments = $"/PID {pid.Value} /T /F",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using var p = Process.Start(psi);
            p?.WaitForExit(5000);
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine($"  {label}: da dong cua so CMD va cay tien trinh PID {pid.Value}.");
            Console.ResetColor();
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine($"  {label}: khong kill duoc PID {pid.Value} ({ex.Message}) - se fallback theo port.");
            Console.ResetColor();
        }
    }

    private static void StopPort(int port)
    {
        try
        {
            var pids = GetPidsByPort(port);
            if (pids.Count == 0)
            {
                Console.WriteLine($"  Cong {port}: hien dang trong - khong can tat.");
                return;
            }
            Console.WriteLine($"  Cong {port}: tim thay PID {string.Join(", ", pids)} - dang tat...");
            foreach (var pid in pids)
            {
                try
                {
                    // /T = kill ca cay tien trinh con (cmd -> npm -> node/vite), /F = bat buoc
                    var psi = new ProcessStartInfo
                    {
                        FileName = "taskkill",
                        Arguments = $"/PID {pid} /T /F",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    };
                    using var p = Process.Start(psi);
                    if (p != null)
                    {
                        p.WaitForExit(5000);
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"  Cong {port} PID {pid}: khong tat duoc ({ex.Message})");
                }
            }
            System.Threading.Thread.Sleep(800);
            if (!IsPortInUse(port))
            {
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine($"  Cong {port}: da tat thanh cong!");
                Console.ResetColor();
            }
            else
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine($"  Cong {port}: van con tien trinh giu cong. Thu mo CMD chay: netstat -ano | findstr :{port}  roi taskkill /PID <PID> /F");
                Console.ResetColor();
            }
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"  Cong {port}: loi {ex.Message}");
            Console.ResetColor();
        }
    }

    private static List<int> GetPidsByPort(int port)
    {
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
            p.WaitForExit(5000);
            int selfPid = Environment.ProcessId;
            foreach (var rawLine in output.Split('\n'))
            {
                var line = rawLine.Trim();
                if (!line.StartsWith("TCP", StringComparison.OrdinalIgnoreCase)) continue;
                if (!line.Contains("LISTENING", StringComparison.OrdinalIgnoreCase)) continue;
                // Khop chinh xac ":5173 " de tranh nham ":51730"
                if (!line.Contains($":{port} ", StringComparison.Ordinal)) continue;
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
