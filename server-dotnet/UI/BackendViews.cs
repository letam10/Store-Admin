/*
 * Tệp: server-dotnet/UI/BackendViews.cs
 * Mục đích: Giao diện HTML tự hiển thị do Backend phục vụ (trang gốc /, trang lỗi 404 HTML).
 */

namespace StoreApi.UI;

public static class BackendViews
{
    public static string RenderRootDashboardHtml() => """
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OmniCart Backend API - Sẵn sàng</title>
    <style>
        :root {
            --bg: #0b1710;
            --surface: #12261b;
            --surface-hover: #173324;
            --border: #234d35;
            --accent: #10b981;
            --accent-glow: rgba(16, 185, 129, 0.22);
            --text: #ecfdf3;
            --muted: #88af95;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background-color: var(--bg);
            color: var(--text);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
        }
        .container {
            width: 100%;
            max-width: 680px;
            background: linear-gradient(145deg, #12261b 0%, #0d1e15 100%);
            border: 1.5px solid var(--border);
            border-radius: 24px;
            padding: 40px;
            box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45), 0 0 40px var(--accent-glow);
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        .container::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 4px;
            background: linear-gradient(90deg, #059669, #10b981, #34d399);
        }
        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(16, 185, 129, 0.14);
            border: 1px solid rgba(16, 185, 129, 0.35);
            padding: 6px 16px;
            border-radius: 999px;
            font-size: 13px;
            font-weight: 700;
            color: #34d399;
            margin-bottom: 20px;
        }
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #10b981;
            box-shadow: 0 0 10px #10b981;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        h1 {
            font-size: 32px;
            font-weight: 900;
            letter-spacing: -0.5px;
            margin-bottom: 10px;
            background: linear-gradient(135deg, #ffffff 0%, #a7f3d0 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        p.subtitle {
            color: var(--muted);
            font-size: 15px;
            line-height: 1.6;
            margin-bottom: 30px;
        }
        .grid-info {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 14px;
            margin-bottom: 30px;
            text-align: left;
        }
        @media (max-width: 580px) {
            .grid-info { grid-template-columns: 1fr; }
        }
        .info-card {
            background: rgba(18, 38, 27, 0.6);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 16px;
        }
        .info-card small {
            display: block;
            color: var(--muted);
            font-size: 11px;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }
        .info-card strong {
            font-size: 14.5px;
            color: #edf7ef;
        }
        .actions {
            display: flex;
            gap: 12px;
            justify-content: center;
            flex-wrap: wrap;
        }
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 12px 24px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 750;
            text-decoration: none;
            transition: all 180ms ease;
            cursor: pointer;
        }
        .btn-primary {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: #042415;
            box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
        }
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 22px rgba(16, 185, 129, 0.5);
        }
        .btn-secondary {
            background: var(--surface);
            border: 1px solid var(--border);
            color: #a7f3d0;
        }
        .btn-secondary:hover {
            background: var(--surface-hover);
            border-color: var(--accent);
            color: #ffffff;
            transform: translateY(-2px);
        }
        footer {
            margin-top: 30px;
            font-size: 12px;
            color: var(--muted);
            border-top: 1px dashed var(--border);
            padding-top: 18px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="status-badge">
            <span class="status-dot"></span>
            <span>Hệ Thống Đang Hoạt Động (Operational)</span>
        </div>
        <h1>OmniCart Backend API</h1>
        <p class="subtitle">Dịch vụ API trung tâm phục vụ Storefront khách hàng và Trang quản trị OmniCart Store-Admin.</p>
        <div class="grid-info">
            <div class="info-card">
                <small>Framework</small>
                <strong>.NET 8.0 / Kestrel</strong>
            </div>
            <div class="info-card">
                <small>Database</small>
                <strong>SQL Server (StoreDb)</strong>
            </div>
            <div class="info-card">
                <small>Environment</small>
                <strong>Development</strong>
            </div>
        </div>
        <div class="actions">
            <a href="/swagger" class="btn btn-primary">📖 Tài Liệu Swagger</a>
            <a href="/health" class="btn btn-secondary">🩺 Kiểm Tra /health</a>
            <a href="/api/health/db" class="btn btn-secondary">🗄️ Trạng Thái Database</a>
        </div>
        <footer>
            OmniCart E-Commerce Platform &bull; ASP.NET Core Web API &bull; Cổng 5000
        </footer>
    </div>
</body>
</html>
""";

    public static string RenderNotFoundHtml(string path)
    {
        var encodedPath = System.Net.WebUtility.HtmlEncode(path);
        return string.Format("""
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>404 - Không Tìm Thấy Trang | OmniCart API</title>
    <style>
        body {{ background: #0b1710; color: #ecfdf3; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; margin: 0; }}
        .box {{ max-width: 520px; background: #12261b; border: 1.5px solid #234d35; border-radius: 20px; padding: 36px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.4); }}
        h1 {{ font-size: 56px; color: #34d399; margin: 0 0 10px; font-weight: 900; }}
        h2 {{ font-size: 20px; margin: 0 0 12px; color: #edf7ef; }}
        p {{ color: #88af95; font-size: 14px; line-height: 1.5; margin: 0 0 24px; word-break: break-all; }}
        code {{ background: #1c3829; color: #a7f3d0; padding: 2px 6px; border-radius: 6px; font-size: 13px; }}
        a {{ display: inline-block; padding: 10px 22px; border-radius: 10px; background: #10b981; color: #042415; text-decoration: none; font-weight: 700; font-size: 14px; }}
        a:hover {{ background: #34d399; }}
    </style>
</head>
<body>
    <div class="box">
        <h1>404</h1>
        <h2>Đường dẫn không tồn tại</h2>
        <p>Máy chủ API không tìm thấy tài nguyên tại <code>{0}</code>.</p>
        <a href="/">← Quay lại Trang Chủ API</a>
    </div>
</body>
</html>
""", encodedPath);
    }
}
