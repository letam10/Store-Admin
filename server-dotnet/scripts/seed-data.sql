-- =========================================================
-- Store & Store-Admin - Database Seed / Sync Data
-- Exported on: 2026-11-14 21:20:51
-- =========================================================
USE [StoreDb];
GO

-- Tam thoi tat kiem tra khoa ngoai de nap du lieu an toan
EXEC sp_MSforeachtable 'ALTER TABLE ? NOCHECK CONSTRAINT ALL';
GO

-- Table: admins (3 rows)
SET IDENTITY_INSERT [admins] ON;
INSERT INTO [admins] ([id], [username], [password_salt], [password_hash], [created_at], [role], [display_name], [email], [active])
SELECT src.[id], src.[username], src.[password_salt], src.[password_hash], src.[created_at], src.[role], src.[display_name], src.[email], src.[active]
FROM (VALUES
  (1, N'admin', N'2e6e763bb6d4f0e00b4a6daf7693ae7f', N'985dbf9b044016dd9bdade7500ceb6750d9dc360f5376cf8ecbdb52b883bbb52b6a613e73118f91dde156600b8670a3bf594c8bbfd13e34705bc76882c311052', N'2026-10-12T17:03:32.1279731+00:00', N'admin', N'', N'', 1),
  (2, N'admin_test', N'5b09471aa952454809f24520b7fa76e7', N'df45f64d771d26ff60e98521b4b57ebe528c517e6cc3f7b2c6c40ef2ddd40d5345c957a4587eacbaf1a8cce6ae812b62734701de8727ccb1fc19904e4ea790ba', N'2026-10-18T04:55:10.2111791+00:00', N'admin', N'', N'', 1),
  (4, N'Tam', N'119aecf1deea4388898230798e65e146', N'9dff35e18faeff23d5ecbc185376573c49e3fe17f714bef6f73cc2bc9483722330dfbd862181a5d7fc02c079ee8600d1eab19fe77beb64261adaadbce41dfb98', N'2026-11-12T10:55:10.0063145+00:00', N'staff', N'LeTam', N'ledominhtam1998@gmail.com', 1)
) AS src([id], [username], [password_salt], [password_hash], [created_at], [role], [display_name], [email], [active])
WHERE NOT EXISTS (SELECT 1 FROM [admins] target WHERE target.[id] = src.[id]);
GO
SET IDENTITY_INSERT [admins] OFF;
GO

-- Table: settings (40 rows)
INSERT INTO [settings] ([key], [value], [updated_at])
SELECT src.[key], src.[value], src.[updated_at]
FROM (VALUES
  (N'appearance.accentColor', N'#4f8b67', N'2026-11-12T10:56:11.1956626+00:00'),
  (N'appearance.adminTheme', N'{"schemaVersion":1,"defaultMode":"light","presetId":"olive","light":{"colors":{"page":"#f5f3e8","surface":"#fffdf7","surfaceAlt":"#eaebd9","text":"#303725","muted":"#6f765b","border":"#d8dcc1","accent":"#7d8651","accentStrong":"#596133","accentSoft":"#e3e7c9","control":"#fffdf7","controlActive":"#e8ebcf","danger":"#a84f45","success":"#3f7c55"},"radius":{"card":16,"control":10,"panel":20},"shadowStrength":22},"dark":{"colors":{"page":"#171b12","surface":"#242b1a","surfaceAlt":"#343d25","text":"#f2f5df","muted":"#b7c092","border":"#56633a","accent":"#a8b66b","accentStrong":"#c3d58a","accentSoft":"#3b4726","control":"#2b341f","controlActive":"#53652f","danger":"#ee8b83","success":"#75c995"},"radius":{"card":16,"control":10,"panel":20},"shadowStrength":28}}', N'2026-11-12T10:56:11.1384645+00:00'),
  (N'appearance.bannerLabel', N'STORE EVERYDAY', N'2026-11-12T10:56:11.1976752+00:00'),
  (N'appearance.brandName', N'store', N'2026-11-12T10:56:11.1406916+00:00'),
  (N'appearance.brandTagline', N'EVERYDAY', N'2026-11-12T10:56:11.1426081+00:00'),
  (N'appearance.contactAddress', N'123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', N'2026-11-12T10:56:11.1997938+00:00'),
  (N'appearance.contactEmail', N'support@store.vn', N'2026-11-12T10:56:11.2041075+00:00'),
  (N'appearance.contactHours', N'08:00 - 21:00 mỗi ngày', N'2026-11-12T10:56:11.2065862+00:00'),
  (N'appearance.contactPhone', N'0901234567', N'2026-11-12T10:56:11.2020443+00:00'),
  (N'appearance.footerAccount', N'Tài khoản của bạn', N'2026-11-12T10:56:11.1908155+00:00'),
  (N'appearance.footerCart', N'Giỏ hàng', N'2026-11-12T10:56:11.1801878+00:00'),
  (N'appearance.footerContact', N'Địa chỉ & liên hệ', N'2026-11-12T10:56:11.1885321+00:00'),
  (N'appearance.footerCopyright', N'© 2026 Store', N'2026-11-12T10:56:11.1933216+00:00'),
  (N'appearance.footerInfo', N'Giá và ưu đãi được cập nhật tại cửa hàng. Điểm thành viên được cộng sau khi xác nhận thanh toán.', N'2026-11-12T10:56:11.1725256+00:00'),
  (N'appearance.footerInfoTitle', N'Thông tin', N'2026-11-12T10:56:11.1911694+00:00'),
  (N'appearance.footerMembership', N'Thành viên', N'2026-11-12T10:56:11.1821383+00:00'),
  (N'appearance.footerProducts', N'Hàng hóa', N'2026-11-12T10:56:11.1776157+00:00'),
  (N'appearance.footerRewards', N'Vòng quay may mắn', N'2026-11-12T10:56:11.1841729+00:00'),
  (N'appearance.footerShopTitle', N'Mua sắm', N'2026-11-12T10:56:11.1749142+00:00'),
  (N'appearance.footerSupport', N'Đội ngũ Store luôn sẵn sàng hỗ trợ bạn.', N'2026-11-12T10:56:11.1703784+00:00'),
  (N'appearance.footerSupportTitle', N'Hỗ trợ', N'2026-11-12T10:56:11.1862562+00:00'),
  (N'appearance.footerText', N'Những điều nhỏ, cho một ngày tốt hơn.', N'2026-11-12T10:56:11.1680803+00:00'),
  (N'appearance.headerSearchPlaceholder', N'Tìm sản phẩm, danh mục…', N'2026-11-12T10:56:11.1448138+00:00'),
  (N'appearance.heroButton', N'Khám phá cửa hàng', N'2026-11-12T10:56:11.1658429+00:00'),
  (N'appearance.heroDescription', N'Khám phá sản phẩm nổi bật, ưu đãi và các nhóm hàng dễ tìm.', N'2026-11-12T10:56:11.1634460+00:00'),
  (N'appearance.heroTitle', N'Chọn món bạn yêu. Sống theo cách riêng.', N'2026-11-12T10:56:11.1612688+00:00'),
  (N'appearance.navContact', N'Địa chỉ & liên hệ', N'2026-11-12T10:56:11.1591024+00:00'),
  (N'appearance.navFavorites', N'Yêu thích', N'2026-11-12T10:56:11.1528281+00:00'),
  (N'appearance.navHome', N'Trang chủ', N'2026-11-12T10:56:11.1471775+00:00'),
  (N'appearance.navMembership', N'Thành viên', N'2026-11-12T10:56:11.1569278+00:00'),
  (N'appearance.navProducts', N'Hàng hóa', N'2026-11-12T10:56:11.1498963+00:00'),
  (N'appearance.navRewards', N'May mắn', N'2026-11-12T10:56:11.1549208+00:00'),
  (N'appearance.theme', N'{"schemaVersion":1,"defaultMode":"light","presetId":"terracotta","light":{"colors":{"page":"#f7f1e9","surface":"#fffdf7","surfaceAlt":"#f4e6dd","text":"#3f2925","muted":"#76645d","border":"#e2cec4","accent":"#b85f43","accentStrong":"#8f402d","accentSoft":"#f2d7cd","control":"#fffdf7","controlActive":"#f5ded4","danger":"#a84f45","success":"#3f7c55"},"radius":{"card":16,"control":10,"panel":20},"shadowStrength":22},"dark":{"colors":{"page":"#1e1613","surface":"#2b1d18","surfaceAlt":"#3a2820","text":"#fff2ea","muted":"#d0a99a","border":"#68483a","accent":"#e08a6b","accentStrong":"#f0a487","accentSoft":"#5a3026","control":"#34231d","controlActive":"#6b3b2d","danger":"#ee8b83","success":"#75c995"},"radius":{"card":16,"control":10,"panel":20},"shadowStrength":28}}', N'2026-11-12T10:56:11.1357335+00:00'),
  (N'catalog.manifest.backfill.v1', N'completed', N'2026-10-18T02:52:51.4800141+00:00'),
  (N'catalog.manifest.selectedCount', N'500', N'2026-11-11T12:25:47.9585900+00:00'),
  (N'catalog.vietnamese.20261113-v1', N'{"renamed":501,"preserved":0,"skipped":0}', N'2026-11-13T04:06:22.7760875+00:00'),
  (N'payment_settings', N'{"mode":"manual","bankName":"MBBank","bankBin":"970422","accountNumber":"0862129776","accountName":"L\u00CA \u0110\u1ED6 MINH T\u00C2M"}', N'2026-11-11T12:34:56.2266657+00:00'),
  (N'sepay.last_error', N'', N'2026-11-14T13:53:54.3083163+00:00'),
  (N'sepay.sync.0862129776', N'2026-11-14T13:53:54.0967358+00:00', N'2026-11-14T13:53:54.3079846+00:00'),
  (N'storefront_appearance', N'{"brandName":"store","brandTagline":"EVERYDAY","headerSearchPlaceholder":"T\u00ECm s\u1EA3n ph\u1EA9m, danh m\u1EE5c\u2026","navHome":"Trang ch\u1EE7","navProducts":"H\u00E0ng h\u00F3a","navFavorites":"Y\u00EAu th\u00EDch","navRewards":"May m\u1EAFn","navMembership":"Th\u00E0nh vi\u00EAn","navContact":"\u0110\u1ECBa ch\u1EC9 \u0026 li\u00EAn h\u1EC7","heroTitle":"Ch\u1ECDn m\u00F3n b\u1EA1n y\u00EAu. S\u1ED1ng theo c\u00E1ch ri\u00EAng.","heroDescription":"Kh\u00E1m ph\u00E1 s\u1EA3n ph\u1EA9m n\u1ED5i b\u1EADt, \u01B0u \u0111\u00E3i v\u00E0 c\u00E1c nh\u00F3m h\u00E0ng d\u1EC5 t\u00ECm.","heroButton":"Kh\u00E1m ph\u00E1 c\u1EEDa h\u00E0ng","footerText":"Nh\u1EEFng \u0111i\u1EC1u nh\u1ECF, cho m\u1ED9t ng\u00E0y t\u1ED1t h\u01A1n.","footerSupport":"\u0110\u1ED9i ng\u0169 Store lu\u00F4n s\u1EB5n s\u00E0ng h\u1ED7 tr\u1EE3 b\u1EA1n.","footerInfo":"Gi\u00E1 v\u00E0 \u01B0u \u0111\u00E3i \u0111\u01B0\u1EE3c c\u1EADp nh\u1EADt t\u1EA1i c\u1EEDa h\u00E0ng. \u0110i\u1EC3m th\u00E0nh vi\u00EAn \u0111\u01B0\u1EE3c c\u1ED9ng sau khi x\u00E1c nh\u1EADn thanh to\u00E1n.","footerShopTitle":"Mua s\u1EAFm","footerProducts":"H\u00E0ng h\u00F3a","footerCart":"Gi\u1ECF h\u00E0ng","footerMembership":"Th\u00E0nh vi\u00EAn","footerRewards":"V\u00F2ng quay may m\u1EAFn","footerSupportTitle":"H\u1ED7 tr\u1EE3","footerContact":"\u0110\u1ECBa ch\u1EC9 \u0026 li\u00EAn h\u1EC7","footerAccount":"T\u00E0i kho\u1EA3n c\u1EE7a b\u1EA1n","footerInfoTitle":"Th\u00F4ng tin","footerCopyright":"\u00A9 2026 Store","accentColor":"#4f8b67","bannerLabel":"STORE EVERYDAY","contactAddress":"123 Nguy\u1EC5n Hu\u1EC7, Ph\u01B0\u1EDDng B\u1EBFn Ngh\u00E9, Qu\u1EADn 1, TP. H\u1ED3 Ch\u00ED Minh","contactPhone":"0901234567","contactEmail":"support@store.vn","contactHours":"08:00 - 21:00 m\u1ED7i ng\u00E0y"}', N'2026-11-12T10:56:11.1294954+00:00')
) AS src([key], [value], [updated_at])
WHERE NOT EXISTS (SELECT 1 FROM [settings] target WHERE target.[key] = src.[key]);
GO

-- Table: catalog_products (501 rows)
INSERT INTO [catalog_products] ([id], [source], [source_id], [name], [category], [price], [description], [image], [features_json], [tone], [symbol], [label], [source_url], [source_price_cents], [source_currency], [imported_at], [discount_percent], [stock_count])
SELECT src.[id], src.[source], src.[source_id], src.[name], src.[category], src.[price], src.[description], src.[image], src.[features_json], src.[tone], src.[symbol], src.[label], src.[source_url], src.[source_price_cents], src.[source_currency], src.[imported_at], src.[discount_percent], src.[stock_count]
FROM (VALUES
  (N'1', N'store-designed', N'1', N'Tai nghe gọn nhẹ dùng hằng ngày', N'Tự Thiết Kế', 890000, N'Tai nghe gọn nhẹ dùng hằng ngày là mẫu thiết kế gọn nhẹ dành cho nhu cầu nghe hằng ngày. Kiểu dáng tối giản giúp tập trung vào trải nghiệm sử dụng và các thao tác điều khiển trực quan.
Mẫu sản phẩm hướng tới việc mang theo và sử dụng thường xuyên trong sinh hoạt. Trước khi chọn mua, cần xác nhận kiểu kết nối và khả năng tương thích với thiết bị của bạn; dữ liệu mẫu hiện chưa công bố các thông số này.

Mã hoặc tên mẫu: Everyday.', N'/products/ai-generated-500/0001-1.webp', N'["Thi\u1EBFt k\u1EBF g\u1ECDn nh\u1EB9, thu\u1EADn ti\u1EC7n mang theo","\u0110i\u1EC1u khi\u1EC3n tr\u1EF1c quan, t\u1EADp trung v\u00E0o thao t\u00E1c th\u01B0\u1EDDng d\u00F9ng","Ki\u1EC3u d\u00E1ng t\u1ED1i gi\u1EA3n cho sinh ho\u1EA1t h\u1EB1ng ng\u00E0y"]', N'green', N'🎧', N'Được yêu thích', N'', 0, N'VND', N'2026-11-11T12:25:46.4768578+00:00', 0, 20),
  (N'2', N'store-designed', N'2', N'Túi vải đeo vai đa dụng', N'Tự Thiết Kế', 10000, N'Everyday Tote là mẫu túi tối giản để mang theo đồ dùng cá nhân khi đi học, đi làm hoặc mua sắm ngắn ngày. Khoang chính rộng và phong cách trung tính giúp sắp xếp đồ dùng theo nhu cầu thường nhật.
Kiểu dáng dễ phối với nhiều trang phục. Hãy đối chiếu kích thước vật dụng định mang theo trước khi chọn mua; chất liệu, kích thước và tải trọng cụ thể chưa được công bố trong dữ liệu mẫu.

Mã hoặc tên mẫu: Everyday Tote.', N'/products/ai-generated-500/0002-2.webp', N'["Khoang ch\u00EDnh r\u1ED9ng \u0111\u1EC3 s\u1EAFp x\u1EBFp \u0111\u1ED3 d\u00F9ng c\u00E1 nh\u00E2n","Phong c\u00E1ch trung t\u00EDnh, d\u1EC5 ph\u1ED1i trang ph\u1EE5c","Ph\u00F9 h\u1EE3p \u0111i h\u1ECDc, \u0111i l\u00E0m ho\u1EB7c mua s\u1EAFm ng\u1EAFn ng\u00E0y"]', N'sand', N'👜', N'Mới', N'', 0, N'VND', N'2026-11-11T12:25:46.4774172+00:00', 0, 20),
  (N'3', N'store-designed', N'3', N'Đồng hồ đeo tay mặt số tối giản', N'Tự Thiết Kế', 1290000, N'Đồng hồ đeo tay mặt số tối giản tập trung vào mặt hiển thị rõ ràng và phong cách tối giản. Thiết kế dễ đọc giờ, dễ kết hợp với trang phục thường ngày và phù hợp nhiều hoàn cảnh sử dụng.
Mẫu đồng hồ ưu tiên sự đơn giản về hình thức. Loại bộ máy, kích thước mặt, chất liệu dây và khả năng chống nước chưa được công bố; cần xác nhận các thông số này trước khi sử dụng trong môi trường đặc biệt.

Mã hoặc tên mẫu: Minimal.', N'/products/ai-generated-500/0003-3.webp', N'["M\u1EB7t s\u1ED1 r\u00F5 r\u00E0ng, thu\u1EADn ti\u1EC7n xem gi\u1EDD","Thi\u1EBFt k\u1EBF t\u1ED1i gi\u1EA3n, \u00EDt chi ti\u1EBFt r\u01B0\u1EDDm r\u00E0","Phong c\u00E1ch linh ho\u1EA1t cho trang ph\u1EE5c h\u1EB1ng ng\u00E0y"]', N'blue', N'⌚', N'Tối giản', N'', 0, N'VND', N'2026-11-11T12:25:46.4774485+00:00', 0, 20),
  (N'4', N'store-designed', N'4', N'Ly đựng cà phê và trà', N'Tự Thiết Kế', 159000, N'Ly Morning được thiết kế cho cà phê, trà và đồ uống nóng trong sinh hoạt hằng ngày. Kiểu dáng đơn giản ưu tiên cảm giác cầm thoải mái và sự thuận tiện khi vệ sinh sau mỗi lần dùng.
Sản phẩm phù hợp với góc làm việc hoặc bàn ăn theo phong cách tối giản. Dữ liệu mẫu chưa nêu dung tích, chất liệu hay khả năng dùng trong lò vi sóng và máy rửa bát; hãy kiểm tra hướng dẫn của sản phẩm trước khi sử dụng các thiết bị này.

Mã hoặc tên mẫu: Morning.', N'/products/ai-generated-500/0004-4.webp', N'["D\u00E0nh cho c\u00E0 ph\u00EA, tr\u00E0 v\u00E0 \u0111\u1ED3 u\u1ED1ng h\u1EB1ng ng\u00E0y","Ki\u1EC3u d\u00E1ng \u0111\u01A1n gi\u1EA3n, thu\u1EADn ti\u1EC7n c\u1EA7m n\u1EAFm","D\u1EC5 v\u1EC7 sinh sau khi s\u1EED d\u1EE5ng"]', N'rose', N'☕', N'Mỗi ngày', N'', 0, N'VND', N'2026-11-11T12:25:46.4774636+00:00', 0, 20),
  (N'abo-more-00334c87-c532-4d61-bc9c-71889fb9a3ca', N'amazon-berkeley-objects', N'00334c87-c532-4d61-bc9c-71889fb9a3ca', N'Ốp điện thoại dẻo họa tiết sao', N'Điện tử', 163275000, N'Ốp điện thoại dẻo họa tiết sao.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10516-SL40507.
Thiết bị tương thích: Micromax Canvas 2 Q4310.
Chất liệu: Silicôn.
Kiểu dáng: Họa tiết trang trí.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0005-abo-more-00334c87-c532-4d61-bc9c-71889fb9a3ca.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Micromax Canvas 2 Q4310","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Ki\u1EC3u d\u00E1ng: H\u1ECDa ti\u1EBFt trang tr\u00ED","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/00334c87-c532-4d61-bc9c-71889fb9a3ca', 653100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-008bcbb6-09ea-7e2d-0a07-1367f5888a7f', N'amazon-berkeley-objects', N'008bcbb6-09ea-7e2d-0a07-1367f5888a7f', N'Màng ép nhiệt bảo vệ tài liệu', N'Điện tử', 71075000, N'Màng ép nhiệt bảo vệ tài liệu.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: LS80-50.', N'/products/ai-generated-500/0013-abo-more-008bcbb6-09ea-7e2d-0a07-1367f5888a7f.webp', N'["M\u00E0ng \u00E9p nhi\u1EC7t b\u1EA3o v\u1EC7 t\u00E0i li\u1EC7u"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/008bcbb6-09ea-7e2d-0a07-1367f5888a7f', 284300, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-00b7a8e0-9cc4-bcaa-d081-b70707550dad', N'amazon-berkeley-objects', N'00b7a8e0-9cc4-bcaa-d081-b70707550dad', N'Ốp điện thoại cứng họa tiết giọt nước', N'Điện tử', 105800000, N'Ốp điện thoại cứng họa tiết giọt nước.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8406-SL40330.
Thiết bị tương thích: Vivo Y53.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0019-abo-more-00b7a8e0-9cc4-bcaa-d081-b70707550dad.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Vivo Y53","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/00b7a8e0-9cc4-bcaa-d081-b70707550dad', 423200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-00e3ad7e-1526-d7de-1ad4-45a0a7f2d213', N'amazon-berkeley-objects', N'00e3ad7e-1526-d7de-1ad4-45a0a7f2d213', N'Ốp điện thoại dẻo họa tiết đôi tình nhân', N'Điện tử', 297275000, N'Ốp điện thoại dẻo họa tiết đôi tình nhân.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10823-SL40744.
Thiết bị tương thích: Vivo Z1x.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0027-abo-more-00e3ad7e-1526-d7de-1ad4-45a0a7f2d213.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Vivo Z1x","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/00e3ad7e-1526-d7de-1ad4-45a0a7f2d213', 1189100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-00f52ff7-2da6-6e12-03bd-2b797171ee25', N'amazon-berkeley-objects', N'00f52ff7-2da6-6e12-03bd-2b797171ee25', N'Ốp điện thoại cứng họa tiết đôi tình nhân', N'Điện tử', 384875000, N'Ốp điện thoại cứng họa tiết đôi tình nhân.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8744-SL40744.
Thiết bị tương thích: Oppo A9.
Chất liệu: Nhựa.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0033-abo-more-00f52ff7-2da6-6e12-03bd-2b797171ee25.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Oppo A9","Ch\u1EA5t li\u1EC7u: Nh\u1EF1a","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/00f52ff7-2da6-6e12-03bd-2b797171ee25', 1539500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-00f71423-e729-3917-6367-2e01a4aa1b46', N'amazon-berkeley-objects', N'00f71423-e729-3917-6367-2e01a4aa1b46', N'Giày thể thao nữ họa tiết trái tim', N'Trang sức', 300225000, N'Giày thể thao nữ họa tiết trái tim.

Thương hiệu: The Fix.
Mã hoặc tên mẫu: The Fix.', N'/products/ai-generated-500/0011-abo-more-00f71423-e729-3917-6367-2e01a4aa1b46.webp', N'["Gi\u00E0y th\u1EC3 thao n\u1EEF h\u1ECDa ti\u1EBFt tr\u00E1i tim"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/00f71423-e729-3917-6367-2e01a4aa1b46', 1200900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-01019afa-3d95-1677-7bc5-e5c4dfc3fc6e', N'amazon-berkeley-objects', N'01019afa-3d95-1677-7bc5-e5c4dfc3fc6e', N'Ốp điện thoại dẻo họa tiết trang trí', N'Điện tử', 63550000, N'Ốp điện thoại dẻo họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10302-SL13027.
Thiết bị tương thích: Coolpad Note 5 Lite.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0039-abo-more-01019afa-3d95-1677-7bc5-e5c4dfc3fc6e.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Coolpad Note 5 Lite","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/01019afa-3d95-1677-7bc5-e5c4dfc3fc6e', 254200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-01175485-e11a-de41-f961-cc9221b78232', N'amazon-berkeley-objects', N'01175485-e11a-de41-f961-cc9221b78232', N'Ốp điện thoại cứng vân đá cẩm thạch', N'Điện tử', 579375000, N'Ốp điện thoại cứng vân đá cẩm thạch.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8578-SL40511.
Thiết bị tương thích: Samsung Galaxy J2 Core.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0045-abo-more-01175485-e11a-de41-f961-cc9221b78232.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Samsung Galaxy J2 Core","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/01175485-e11a-de41-f961-cc9221b78232', 2317500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-01496544-006e-7fbf-ee62-3025846ff6f2', N'amazon-berkeley-objects', N'01496544-006e-7fbf-ee62-3025846ff6f2', N'Ốp điện thoại dẻo họa tiết hoa', N'Điện tử', 213650000, N'Ốp điện thoại dẻo họa tiết hoa.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10203-SL13651.
Thiết bị tương thích: Huawei Honor 8 Smart.
Chất liệu: Silicôn.
Kiểu dáng: Nữ tính.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0051-abo-more-01496544-006e-7fbf-ee62-3025846ff6f2.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Huawei Honor 8 Smart","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Ki\u1EC3u d\u00E1ng: N\u1EEF t\u00EDnh","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/01496544-006e-7fbf-ee62-3025846ff6f2', 854600, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0171713d-b8b5-eff8-298a-6eb44871dd0a', N'amazon-berkeley-objects', N'0171713d-b8b5-eff8-298a-6eb44871dd0a', N'Lắc tay bạc mạ vàng đính đá hình chữ X', N'Trang sức', 199575000, N'Lắc tay bạc mạ vàng đính đá hình chữ X.

Thương hiệu: Amazon Collection.
Mã hoặc tên mẫu: ESH99243-AM.
Khối lượng: 0,01 kg.', N'/products/ai-generated-500/0017-abo-more-0171713d-b8b5-eff8-298a-6eb44871dd0a.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,01 kg"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0171713d-b8b5-eff8-298a-6eb44871dd0a', 798300, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-01812399-3b25-eac2-3ffe-9785c7e9d93b', N'amazon-berkeley-objects', N'01812399-3b25-eac2-3ffe-9785c7e9d93b', N'Sữa tắm bơ hạt mỡ và sữa hạnh nhân', N'Làm đẹp', 578900000, N'Sữa tắm bơ hạt mỡ và sữa hạnh nhân.

Thương hiệu: Solimo.
Mã hoặc tên mẫu: 60000867.
Chiều cao: 19,90 cm.
Chiều dài: 17,00 cm.
Chiều rộng: 14,00 cm.', N'/products/ai-generated-500/0007-abo-more-01812399-3b25-eac2-3ffe-9785c7e9d93b.webp', N'["Chi\u1EC1u cao: 19,90 cm","Chi\u1EC1u d\u00E0i: 17,00 cm","Chi\u1EC1u r\u1ED9ng: 14,00 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/01812399-3b25-eac2-3ffe-9785c7e9d93b', 2315600, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-01847aee-47fd-8bfd-7664-c8879d8072f3', N'amazon-berkeley-objects', N'01847aee-47fd-8bfd-7664-c8879d8072f3', N'Ốp điện thoại cứng họa tiết ngân hà', N'Điện tử', 232275000, N'Ốp điện thoại cứng họa tiết ngân hà.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8529-SL13014.
Thiết bị tương thích: Samsung Galaxy A6 Plus.
Chất liệu: Nhựa.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0057-abo-more-01847aee-47fd-8bfd-7664-c8879d8072f3.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Samsung Galaxy A6 Plus","Ch\u1EA5t li\u1EC7u: Nh\u1EF1a","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/01847aee-47fd-8bfd-7664-c8879d8072f3', 929100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-019f92a1-0685-f1e4-05f1-d52c817d95f3', N'amazon-berkeley-objects', N'019f92a1-0685-f1e4-05f1-d52c817d95f3', N'Giày thể thao nam vải lưới xanh dương', N'Trang phục', 562675000, N'Giày thể thao nam vải lưới xanh dương.

Thương hiệu: Amazon Brand - Symbol.
Mã hoặc tên mẫu: AZ-IK-0013B.
Chất liệu: Sợi tổng hợp.
Kiểu dáng: Giày thể thao.', N'/products/ai-generated-500/0010-abo-more-019f92a1-0685-f1e4-05f1-d52c817d95f3.webp', N'["Ch\u1EA5t li\u1EC7u: S\u1EE3i t\u1ED5ng h\u1EE3p","Ki\u1EC3u d\u00E1ng: Gi\u00E0y th\u1EC3 thao"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/019f92a1-0685-f1e4-05f1-d52c817d95f3', 2250700, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-01cc74ef-dcfb-1807-99d3-f68bd9f74797', N'amazon-berkeley-objects', N'01cc74ef-dcfb-1807-99d3-f68bd9f74797', N'Ốp điện thoại cứng họa tiết lông vũ', N'Điện tử', 253050000, N'Ốp điện thoại cứng họa tiết lông vũ.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8241-SL40677.
Thiết bị tương thích: LG V20.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0070-abo-more-01cc74ef-dcfb-1807-99d3-f68bd9f74797.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: LG V20","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/01cc74ef-dcfb-1807-99d3-f68bd9f74797', 1012200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-01e1bf39-d2ae-da32-6e93-037887ef11fc', N'amazon-berkeley-objects', N'01e1bf39-d2ae-da32-6e93-037887ef11fc', N'Dây chuyền vàng đính mặt đá tròn', N'Trang sức', 139500000, N'Dây chuyền vàng đính mặt đá tròn.

Thương hiệu: Amazon Collection.
Mã hoặc tên mẫu: MCP3241W-14GRN.
Chất liệu: Kim loại.
Khối lượng: 0,01 kg.', N'/products/ai-generated-500/0025-abo-more-01e1bf39-d2ae-da32-6e93-037887ef11fc.webp', N'["Ch\u1EA5t li\u1EC7u: Kim lo\u1EA1i","Kh\u1ED1i l\u01B0\u1EE3ng: 0,01 kg"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/01e1bf39-d2ae-da32-6e93-037887ef11fc', 558000, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-01e4a9cc-69e4-dace-97b5-a040ca2991be', N'amazon-berkeley-objects', N'01e4a9cc-69e4-dace-97b5-a040ca2991be', N'Ốp điện thoại dẻo họa tiết hoa', N'Điện tử', 439350000, N'Ốp điện thoại dẻo họa tiết hoa.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10359-SL13651.
Thiết bị tương thích: Samsung Galaxy J1 Ace.
Chất liệu: Silicôn.
Kiểu dáng: Nữ tính.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0081-abo-more-01e4a9cc-69e4-dace-97b5-a040ca2991be.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Samsung Galaxy J1 Ace","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Ki\u1EC3u d\u00E1ng: N\u1EEF t\u00EDnh","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/01e4a9cc-69e4-dace-97b5-a040ca2991be', 1757400, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-01e598a4-863e-7ff4-5d9a-4bacdadeca62', N'amazon-berkeley-objects', N'01e598a4-863e-7ff4-5d9a-4bacdadeca62', N'Mũ len nam màu xám than', N'Trang phục', 519050000, N'Mũ len nam màu xám than.

Thương hiệu: Thirty Five Kent.', N'/products/ai-generated-500/0016-abo-more-01e598a4-863e-7ff4-5d9a-4bacdadeca62.webp', N'["M\u0169 len nam m\u00E0u x\u00E1m than"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/01e598a4-863e-7ff4-5d9a-4bacdadeca62', 2076200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-01f7e0f1-52b2-040b-3329-507dc268f660', N'amazon-berkeley-objects', N'01f7e0f1-52b2-040b-3329-507dc268f660', N'Giày vải bé trai màu be', N'Trang phục', 120750000, N'Giày vải bé trai màu be.

Thương hiệu: RED WAGON.
Mã hoặc tên mẫu: K0075A.
Kiểu dáng: Giày thể thao cổ thấp.
Năm mẫu: 2017.', N'/products/ai-generated-500/0024-abo-more-01f7e0f1-52b2-040b-3329-507dc268f660.webp', N'["Ki\u1EC3u d\u00E1ng: Gi\u00E0y th\u1EC3 thao c\u1ED5 th\u1EA5p","N\u0103m m\u1EABu: 2017"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/01f7e0f1-52b2-040b-3329-507dc268f660', 483000, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-01fa3cde-8946-3c53-6911-cb0a1ee401e1', N'amazon-berkeley-objects', N'01fa3cde-8946-3c53-6911-cb0a1ee401e1', N'Ốp điện thoại cứng kẻ sọc vàng', N'Trang sức', 195325000, N'Ốp điện thoại cứng kẻ sọc vàng.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8075-SL40425.
Thiết bị tương thích: Micromax Canvas Xpress 2 E313.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0031-abo-more-01fa3cde-8946-3c53-6911-cb0a1ee401e1.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Micromax Canvas Xpress 2 E313","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/01fa3cde-8946-3c53-6911-cb0a1ee401e1', 781300, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-02311407-2df3-0364-a48b-65ed7dcb5e88', N'amazon-berkeley-objects', N'02311407-2df3-0364-a48b-65ed7dcb5e88', N'Bộ sáu bìa còng hồ sơ màu trắng', N'Trang sức', 119700000, N'Bộ sáu bìa còng hồ sơ màu trắng.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: AZ363-13W6.
Màu sắc: Trắng.
Khối lượng: 0,42 kg.
Chiều cao: 29,49 cm.
Chiều dài: 24,89 cm.
Chiều rộng: 3,05 cm.', N'/products/ai-generated-500/0037-abo-more-02311407-2df3-0364-a48b-65ed7dcb5e88.webp', N'["M\u00E0u s\u1EAFc: Tr\u1EAFng","Kh\u1ED1i l\u01B0\u1EE3ng: 0,42 kg","Chi\u1EC1u cao: 29,49 cm","Chi\u1EC1u d\u00E0i: 24,89 cm"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/02311407-2df3-0364-a48b-65ed7dcb5e88', 478800, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-02503c5f-e333-f8f4-3a6a-c361d07f6d25', N'amazon-berkeley-objects', N'02503c5f-e333-f8f4-3a6a-c361d07f6d25', N'Túi đeo chéo nữ có quai xách màu nâu nhạt', N'Trang sức', 375800000, N'Túi đeo chéo nữ có quai xách màu nâu nhạt.

Thương hiệu: The Drop.
Mã hoặc tên mẫu: Diana.', N'/products/ai-generated-500/0043-abo-more-02503c5f-e333-f8f4-3a6a-c361d07f6d25.webp', N'["T\u00FAi \u0111eo ch\u00E9o n\u1EEF c\u00F3 quai x\u00E1ch m\u00E0u n\u00E2u nh\u1EA1t"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/02503c5f-e333-f8f4-3a6a-c361d07f6d25', 1503200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-02721867-4a9d-ef31-7ffa-234c5fa4ed06', N'amazon-berkeley-objects', N'02721867-4a9d-ef31-7ffa-234c5fa4ed06', N'Ốp điện thoại dẻo họa tiết trang trí', N'Điện tử', 364475000, N'Ốp điện thoại dẻo họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10835-SL40465.
Thiết bị tương thích: Mi Redmi 8A.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0086-abo-more-02721867-4a9d-ef31-7ffa-234c5fa4ed06.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Mi Redmi 8A","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/02721867-4a9d-ef31-7ffa-234c5fa4ed06', 1457900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0285bff7-947d-ff5d-1514-c5234a1ba1b2', N'amazon-berkeley-objects', N'0285bff7-947d-ff5d-1514-c5234a1ba1b2', N'Ốp điện thoại dẻo họa tiết trái tim', N'Điện tử', 477875000, N'Ốp điện thoại dẻo họa tiết trái tim.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10030-SL40404.
Thiết bị tương thích: Lava Iris X8.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0089-abo-more-0285bff7-947d-ff5d-1514-c5234a1ba1b2.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Lava Iris X8","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0285bff7-947d-ff5d-1514-c5234a1ba1b2', 1911500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0285f3df-5c55-b0ac-cffa-4061e4487204', N'amazon-berkeley-objects', N'0285f3df-5c55-b0ac-cffa-4061e4487204', N'Ốp điện thoại cứng họa tiết trang trí', N'Điện tử', 180500000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8198-SL40319.
Thiết bị tương thích: Microsoft Lumia 650.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0094-abo-more-0285f3df-5c55-b0ac-cffa-4061e4487204.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Microsoft Lumia 650","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0285f3df-5c55-b0ac-cffa-4061e4487204', 722000, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-02cbef62-9093-6261-aee3-1e40c7d1734d', N'amazon-berkeley-objects', N'02cbef62-9093-6261-aee3-1e40c7d1734d', N'Ốp điện thoại cứng họa tiết trang trí', N'Điện tử', 99775000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8595-SL40514.
Thiết bị tương thích: Asus Zenfone Max Pro M1 ZB601KL.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0097-abo-more-02cbef62-9093-6261-aee3-1e40c7d1734d.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Asus Zenfone Max Pro M1 ZB601KL","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/02cbef62-9093-6261-aee3-1e40c7d1734d', 399100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-02f25725-bfb6-89e6-2fbf-31423149525b', N'amazon-berkeley-objects', N'02f25725-bfb6-89e6-2fbf-31423149525b', N'Mũ trùm đầu giữ ấm che mặt và cổ', N'Trang phục', 572275000, N'Mũ trùm đầu giữ ấm che mặt và cổ.

Thương hiệu: Jeff & Aimy.', N'/products/ai-generated-500/0042-abo-more-02f25725-bfb6-89e6-2fbf-31423149525b.webp', N'["M\u0169 tr\u00F9m \u0111\u1EA7u gi\u1EEF \u1EA5m che m\u1EB7t v\u00E0 c\u1ED5"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/02f25725-bfb6-89e6-2fbf-31423149525b', 2289100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-02f9d357-b1cd-4db6-1ceb-2c9b570ba6d5', N'amazon-berkeley-objects', N'02f9d357-b1cd-4db6-1ceb-2c9b570ba6d5', N'Ốp điện thoại dẻo họa tiết trang trí', N'Điện tử', 613300000, N'Ốp điện thoại dẻo họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10585-SL40440.
Thiết bị tương thích: Itel A21.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0104-abo-more-02f9d357-b1cd-4db6-1ceb-2c9b570ba6d5.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Itel A21","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/02f9d357-b1cd-4db6-1ceb-2c9b570ba6d5', 2453200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-03049087-d405-7177-9cfc-e52e996fda48', N'amazon-berkeley-objects', N'03049087-d405-7177-9cfc-e52e996fda48', N'Ốp điện thoại cứng họa tiết mặt cười', N'Điện tử', 109275000, N'Ốp điện thoại cứng họa tiết mặt cười.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8610-SL40754.
Thiết bị tương thích: Oppo A7.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0107-abo-more-03049087-d405-7177-9cfc-e52e996fda48.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Oppo A7","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/03049087-d405-7177-9cfc-e52e996fda48', 437100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-030dead8-54dd-0d72-15db-615fda1bd400', N'amazon-berkeley-objects', N'030dead8-54dd-0d72-15db-615fda1bd400', N'Bộ bìa phân trang hồ sơ tám màu', N'Điện tử', 486950000, N'Bộ bìa phân trang hồ sơ tám màu.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: PAD-12.
Khối lượng: 0,02 kg.
Chiều dài: 27,94 cm.
Chiều rộng: 21,59 cm.', N'/products/ai-generated-500/0112-abo-more-030dead8-54dd-0d72-15db-615fda1bd400.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,02 kg","Chi\u1EC1u d\u00E0i: 27,94 cm","Chi\u1EC1u r\u1ED9ng: 21,59 cm"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/030dead8-54dd-0d72-15db-615fda1bd400', 1947800, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-032567df-b81f-c6be-94bf-587c992c861f', N'amazon-berkeley-objects', N'032567df-b81f-c6be-94bf-587c992c861f', N'Ốp điện thoại cứng họa tiết hổ', N'Điện tử', 283075000, N'Ốp điện thoại cứng họa tiết hổ.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8179-SL40332.
Thiết bị tương thích: Lenovo Vibe K5.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0121-abo-more-032567df-b81f-c6be-94bf-587c992c861f.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Lenovo Vibe K5","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/032567df-b81f-c6be-94bf-587c992c861f', 1132300, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-035b0d94-3837-e741-5cd9-c6a6fd0d90db', N'amazon-berkeley-objects', N'035b0d94-3837-e741-5cd9-c6a6fd0d90db', N'Ốp điện thoại cứng họa tiết trang trí', N'Trang phục', 614925000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8605-SL40414.
Thiết bị tương thích: Asus ZenFone Max Pro M2.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0054-abo-more-035b0d94-3837-e741-5cd9-c6a6fd0d90db.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Asus ZenFone Max Pro M2","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/035b0d94-3837-e741-5cd9-c6a6fd0d90db', 2459700, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-036ada59-19f1-5c4b-00fe-a2b3af592f0c', N'amazon-berkeley-objects', N'036ada59-19f1-5c4b-00fe-a2b3af592f0c', N'Ốp điện thoại cứng họa tiết cú mèo', N'Điện tử', 448700000, N'Ốp điện thoại cứng họa tiết cú mèo.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8465-SL40434.
Thiết bị tương thích: Xiaomi Redmi Y1 Lite.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0124-abo-more-036ada59-19f1-5c4b-00fe-a2b3af592f0c.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Xiaomi Redmi Y1 Lite","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/036ada59-19f1-5c4b-00fe-a2b3af592f0c', 1794800, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-037a5a4d-1ef1-9cc9-de48-43d57c023623', N'amazon-berkeley-objects', N'037a5a4d-1ef1-9cc9-de48-43d57c023623', N'Ốp điện thoại cứng họa tiết trang trí', N'Điện tử', 417400000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: SOLVIVOY933DM373.
Thiết bị tương thích: Vivo Y93.
Chất liệu: Nhựa.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0131-abo-more-037a5a4d-1ef1-9cc9-de48-43d57c023623.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Vivo Y93","Ch\u1EA5t li\u1EC7u: Nh\u1EF1a","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/037a5a4d-1ef1-9cc9-de48-43d57c023623', 1669600, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-03947e4f-c242-4f73-86c4-0395b9f2b8d5', N'amazon-berkeley-objects', N'03947e4f-c242-4f73-86c4-0395b9f2b8d5', N'Hộp mực in tái chế thay thế', N'Điện tử', 88875000, N'Hộp mực in tái chế thay thế.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: 127C052101.
Khối lượng: 0,04 kg.
Chiều cao: 3,81 cm.
Chiều dài: 7,62 cm.
Chiều rộng: 2,03 cm.', N'/products/ai-generated-500/0134-abo-more-03947e4f-c242-4f73-86c4-0395b9f2b8d5.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,04 kg","Chi\u1EC1u cao: 3,81 cm","Chi\u1EC1u d\u00E0i: 7,62 cm","Chi\u1EC1u r\u1ED9ng: 2,03 cm"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/03947e4f-c242-4f73-86c4-0395b9f2b8d5', 355500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-03c98ce5-ced6-ce02-c5a6-3b8f5f43a177', N'amazon-berkeley-objects', N'03c98ce5-ced6-ce02-c5a6-3b8f5f43a177', N'Ốp điện thoại cứng họa tiết trang trí', N'Điện tử', 449900000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8103-SL40389.
Thiết bị tương thích: Apple iPhone 4 / 4S.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0142-abo-more-03c98ce5-ced6-ce02-c5a6-3b8f5f43a177.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Apple iPhone 4 / 4S","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/03c98ce5-ced6-ce02-c5a6-3b8f5f43a177', 1799600, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-03ee58ff-468e-5f15-455c-e61d9dd5628a', N'amazon-berkeley-objects', N'03ee58ff-468e-5f15-455c-e61d9dd5628a', N'Giày bốt nữ kiểu cao bồi màu bạc', N'Trang phục', 201675000, N'Giày bốt nữ kiểu cao bồi màu bạc.

Thương hiệu: find..
Mã hoặc tên mẫu: LYLE-01W4_002.
Năm mẫu: 2020.', N'/products/ai-generated-500/0067-abo-more-03ee58ff-468e-5f15-455c-e61d9dd5628a.webp', N'["N\u0103m m\u1EABu: 2020"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/03ee58ff-468e-5f15-455c-e61d9dd5628a', 806700, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-04092ba5-d60c-cabc-159d-e28b8423f856', N'amazon-berkeley-objects', N'04092ba5-d60c-cabc-159d-e28b8423f856', N'Ốp điện thoại cứng họa tiết trang trí', N'Điện tử', 204550000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8736-SL40738.
Thiết bị tương thích: Oppo Reno 2.
Chất liệu: Nhựa.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0145-abo-more-04092ba5-d60c-cabc-159d-e28b8423f856.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Oppo Reno 2","Ch\u1EA5t li\u1EC7u: Nh\u1EF1a","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/04092ba5-d60c-cabc-159d-e28b8423f856', 818200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-043b6074-bdb4-e7ea-a5fc-06d9eb229ff0', N'amazon-berkeley-objects', N'043b6074-bdb4-e7ea-a5fc-06d9eb229ff0', N'Ốp điện thoại cứng họa tiết trang trí', N'Điện tử', 115200000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8367-SL40536.
Thiết bị tương thích: Vivo V5 Plus.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0151-abo-more-043b6074-bdb4-e7ea-a5fc-06d9eb229ff0.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Vivo V5 Plus","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/043b6074-bdb4-e7ea-a5fc-06d9eb229ff0', 460800, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-04480ed4-7529-494d-94e2-c0dc78ab8bc6', N'amazon-berkeley-objects', N'04480ed4-7529-494d-94e2-c0dc78ab8bc6', N'Giày thể thao nữ màu xám', N'Trang phục', 395350000, N'Giày thể thao nữ màu xám.

Thương hiệu: Concept 3 by Skechers.
Mã hoặc tên mẫu: Concept 3.', N'/products/ai-generated-500/0075-abo-more-04480ed4-7529-494d-94e2-c0dc78ab8bc6.webp', N'["Gi\u00E0y th\u1EC3 thao n\u1EEF m\u00E0u x\u00E1m"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/04480ed4-7529-494d-94e2-c0dc78ab8bc6', 1581400, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0462a949-ce42-8d89-5fd6-0d3277e5dfd8', N'amazon-berkeley-objects', N'0462a949-ce42-8d89-5fd6-0d3277e5dfd8', N'Ốp điện thoại cứng họa tiết trang trí', N'Điện tử', 414875000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8380-SL40311.
Thiết bị tương thích: Asus Zenfone 3S Max.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0156-abo-more-0462a949-ce42-8d89-5fd6-0d3277e5dfd8.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Asus Zenfone 3S Max","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0462a949-ce42-8d89-5fd6-0d3277e5dfd8', 1659500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-046e5da0-fc66-6d40-8653-9ce92355a77a', N'amazon-berkeley-objects', N'046e5da0-fc66-6d40-8653-9ce92355a77a', N'Ốp điện thoại dẻo họa tiết trang trí', N'Điện tử', 368025000, N'Ốp điện thoại dẻo họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10015-SL40465.
Thiết bị tương thích: Oppo Neo 5.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0160-abo-more-046e5da0-fc66-6d40-8653-9ce92355a77a.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Oppo Neo 5","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/046e5da0-fc66-6d40-8653-9ce92355a77a', 1472100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-046eebc0-49f1-c7f1-0588-191d99c75f04', N'amazon-berkeley-objects', N'046eebc0-49f1-c7f1-0588-191d99c75f04', N'Khăn che mặt có quai tai màu xanh dương', N'Trang sức', 355750000, N'Khăn che mặt có quai tai màu xanh dương.

Thương hiệu: WXXM.
Mã hoặc tên mẫu: KX01ZYWB053-1V.', N'/products/ai-generated-500/0055-abo-more-046eebc0-49f1-c7f1-0588-191d99c75f04.webp', N'["Kh\u0103n che m\u1EB7t c\u00F3 quai tai m\u00E0u xanh d\u01B0\u01A1ng"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/046eebc0-49f1-c7f1-0588-191d99c75f04', 1423000, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0476b626-36ea-297b-a1b1-8d9de90eaacb', N'amazon-berkeley-objects', N'0476b626-36ea-297b-a1b1-8d9de90eaacb', N'Ba lô thể thao đa dụng', N'Trang sức', 128100000, N'Ba lô thể thao đa dụng.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: AMSP19010.
Khối lượng: 0,39 kg.
Chiều cao: 51,99 cm.
Chiều dài: 32,00 cm.
Chiều rộng: 14,50 cm.', N'/products/ai-generated-500/0062-abo-more-0476b626-36ea-297b-a1b1-8d9de90eaacb.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,39 kg","Chi\u1EC1u cao: 51,99 cm","Chi\u1EC1u d\u00E0i: 32,00 cm","Chi\u1EC1u r\u1ED9ng: 14,50 cm"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0476b626-36ea-297b-a1b1-8d9de90eaacb', 512400, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-04996511-08f0-52ea-935e-5f4a60b9883d', N'amazon-berkeley-objects', N'04996511-08f0-52ea-935e-5f4a60b9883d', N'Ốp điện thoại dẻo ô vuông nhiều màu', N'Điện tử', 88200000, N'Ốp điện thoại dẻo ô vuông nhiều màu.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10256-SL40496.
Thiết bị tương thích: Samsung Galaxy A5.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0164-abo-more-04996511-08f0-52ea-935e-5f4a60b9883d.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Samsung Galaxy A5","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/04996511-08f0-52ea-935e-5f4a60b9883d', 352800, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-049f8982-9131-185c-e984-469ac34a31ae', N'amazon-berkeley-objects', N'049f8982-9131-185c-e984-469ac34a31ae', N'Ốp điện thoại cứng họa tiết trang trí', N'Điện tử', 190625000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8026-SL40697.
Thiết bị tương thích: Motorola Moto G 3rd Generation.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0166-abo-more-049f8982-9131-185c-e984-469ac34a31ae.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Motorola Moto G 3rd Generation","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/049f8982-9131-185c-e984-469ac34a31ae', 762500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-04a22b8d-5274-3f9b-6fba-dc363f8c7978', N'amazon-berkeley-objects', N'04a22b8d-5274-3f9b-6fba-dc363f8c7978', N'Rèm cuốn cản sáng phủ màu', N'Trang sức', 263375000, N'Rèm cuốn cản sáng phủ màu.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: TEX-17701-7.
Chất liệu: Vải.
Khối lượng: 0,54 kg.
Chiều cao: 3,05 cm.
Chiều dài: 80,01 cm.
Chiều rộng: 3,05 cm.', N'/products/ai-generated-500/0068-abo-more-04a22b8d-5274-3f9b-6fba-dc363f8c7978.webp', N'["Ch\u1EA5t li\u1EC7u: V\u1EA3i","Kh\u1ED1i l\u01B0\u1EE3ng: 0,54 kg","Chi\u1EC1u cao: 3,05 cm","Chi\u1EC1u d\u00E0i: 80,01 cm"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/04a22b8d-5274-3f9b-6fba-dc363f8c7978', 1053500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-04bc16b5-303e-ee0e-6159-656e057f835f', N'amazon-berkeley-objects', N'04bc16b5-303e-ee0e-6159-656e057f835f', N'Ốp điện thoại dẻo chống trầy họa tiết ngân hà', N'Điện tử', 383100000, N'Ốp điện thoại dẻo chống trầy họa tiết ngân hà.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: SOLSNOTE10LTPU0095.
Thiết bị tương thích: Samsung Galaxy Note 10 Lite.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0175-abo-more-04bc16b5-303e-ee0e-6159-656e057f835f.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Samsung Galaxy Note 10 Lite","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/04bc16b5-303e-ee0e-6159-656e057f835f', 1532400, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-04cb9220-27f2-4ecf-7de6-9e7bdaa366b7', N'amazon-berkeley-objects', N'04cb9220-27f2-4ecf-7de6-9e7bdaa366b7', N'Ốp điện thoại cứng họa tiết sư tử', N'Điện tử', 379400000, N'Ốp điện thoại cứng họa tiết sư tử.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8233-SL40795.
Thiết bị tương thích: Motorola Moto G4 Plus.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0183-abo-more-04cb9220-27f2-4ecf-7de6-9e7bdaa366b7.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Motorola Moto G4 Plus","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/04cb9220-27f2-4ecf-7de6-9e7bdaa366b7', 1517600, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-04d02ff9-5899-61e3-4812-ac87419d3d29', N'amazon-berkeley-objects', N'04d02ff9-5899-61e3-4812-ac87419d3d29', N'Ốp điện thoại cứng họa tiết trái tim', N'Điện tử', 101275000, N'Ốp điện thoại cứng họa tiết trái tim.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: SOLIP6S3DM47.
Thiết bị tương thích: Apple iPhone 6s.
Chất liệu: Nhựa.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0187-abo-more-04d02ff9-5899-61e3-4812-ac87419d3d29.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Apple iPhone 6s","Ch\u1EA5t li\u1EC7u: Nh\u1EF1a","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/04d02ff9-5899-61e3-4812-ac87419d3d29', 405100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-04d53306-a4f9-ce14-65c1-0a87151eb6e7', N'amazon-berkeley-objects', N'04d53306-a4f9-ce14-65c1-0a87151eb6e7', N'Ốp điện thoại chống va đập họa tiết trang trí', N'Điện tử', 240825000, N'Ốp điện thoại chống va đập họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: 1101516.
Thiết bị tương thích: Redmi Note 5 Pro.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0188-abo-more-04d53306-a4f9-ce14-65c1-0a87151eb6e7.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Redmi Note 5 Pro","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/04d53306-a4f9-ce14-65c1-0a87151eb6e7', 963300, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-04f15ebc-7b30-164f-72a8-a1d8d069e05f', N'amazon-berkeley-objects', N'04f15ebc-7b30-164f-72a8-a1d8d069e05f', N'Ốp máy nghe nhạc cứng họa tiết lá', N'Điện tử', 533525000, N'Ốp máy nghe nhạc cứng họa tiết lá.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8108-SL40575.
Thiết bị tương thích: Apple iPod Touch 5th Generation.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0189-abo-more-04f15ebc-7b30-164f-72a8-a1d8d069e05f.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Apple iPod Touch 5th Generation","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/04f15ebc-7b30-164f-72a8-a1d8d069e05f', 2134100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0580055c-a6de-4a2c-1568-d4f2082936f9', N'amazon-berkeley-objects', N'0580055c-a6de-4a2c-1568-d4f2082936f9', N'Ốp điện thoại cứng họa tiết trang trí', N'Điện tử', 485150000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8645-SL40490.
Thiết bị tương thích: Xiaomi Redmi Note 7 Pro.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0203-abo-more-0580055c-a6de-4a2c-1568-d4f2082936f9.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Xiaomi Redmi Note 7 Pro","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0580055c-a6de-4a2c-1568-d4f2082936f9', 1940600, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-058cb4ac-2241-f84e-2549-de888dd91122', N'amazon-berkeley-objects', N'058cb4ac-2241-f84e-2549-de888dd91122', N'Ốp điện thoại cứng họa tiết trang trí', N'Điện tử', 286475000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8227-SL40752.
Thiết bị tương thích: Motorola Moto G4 Play.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0208-abo-more-058cb4ac-2241-f84e-2549-de888dd91122.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Motorola Moto G4 Play","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/058cb4ac-2241-f84e-2549-de888dd91122', 1145900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-05f36430-c98b-b708-38ff-5609f5d3b230', N'amazon-berkeley-objects', N'05f36430-c98b-b708-38ff-5609f5d3b230', N'Ốp điện thoại cứng họa tiết trang trí', N'Điện tử', 420050000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8270-SL40661.
Thiết bị tương thích: HTC One M8.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0216-abo-more-05f36430-c98b-b708-38ff-5609f5d3b230.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: HTC One M8","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/05f36430-c98b-b708-38ff-5609f5d3b230', 1680200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0606e9c1-3c12-73cb-6729-009509b7ad4d', N'amazon-berkeley-objects', N'0606e9c1-3c12-73cb-6729-009509b7ad4d', N'Ốp điện thoại cứng họa tiết trang trí', N'Điện tử', 411625000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8245-SL40311.
Thiết bị tương thích: Micromax Canvas Sliver 5 Q450.
Chất liệu: Vải bố.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0219-abo-more-0606e9c1-3c12-73cb-6729-009509b7ad4d.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Micromax Canvas Sliver 5 Q450","Ch\u1EA5t li\u1EC7u: V\u1EA3i b\u1ED1","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0606e9c1-3c12-73cb-6729-009509b7ad4d', 1646500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-062990ac-ba19-b539-08b3-7bfab9ce9023', N'amazon-berkeley-objects', N'062990ac-ba19-b539-08b3-7bfab9ce9023', N'Ốp điện thoại dẻo họa tiết gấu trúc', N'Điện tử', 206325000, N'Ốp điện thoại dẻo họa tiết gấu trúc.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10028-SL40408.
Thiết bị tương thích: Lava Iris X1 Mini.
Chất liệu: Silicôn.
Kiểu dáng: Họa tiết trang trí.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0224-abo-more-062990ac-ba19-b539-08b3-7bfab9ce9023.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Lava Iris X1 Mini","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Ki\u1EC3u d\u00E1ng: H\u1ECDa ti\u1EBFt trang tr\u00ED","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/062990ac-ba19-b539-08b3-7bfab9ce9023', 825300, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-06349d12-c7a9-7284-47a5-4c3c47872a0c', N'amazon-berkeley-objects', N'06349d12-c7a9-7284-47a5-4c3c47872a0c', N'Giày buộc dây họa tiết đục lỗ màu xám', N'Trang sức', 454325000, N'Giày buộc dây họa tiết đục lỗ màu xám.

Thương hiệu: find..
Mã hoặc tên mẫu: FELIX-1W1-112.
Kiểu dáng: Giày đục lỗ trang trí.
Năm mẫu: 2018.', N'/products/ai-generated-500/0092-abo-more-06349d12-c7a9-7284-47a5-4c3c47872a0c.webp', N'["Ki\u1EC3u d\u00E1ng: Gi\u00E0y \u0111\u1EE5c l\u1ED7 trang tr\u00ED","N\u0103m m\u1EABu: 2018"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/06349d12-c7a9-7284-47a5-4c3c47872a0c', 1817300, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0652fccd-1d33-9914-e536-e95be9974947', N'amazon-berkeley-objects', N'0652fccd-1d33-9914-e536-e95be9974947', N'Viên nén dược phẩm 325 mg', N'Điện tử', 407050000, N'Viên nén dược phẩm 325 mg.

Thương hiệu: Basic Care.
Mã hoặc tên mẫu: S0051AN.
Khối lượng: 0,25 kg.
Chiều cao: 11,71 cm.
Chiều dài: 6,35 cm.
Chiều rộng: 6,35 cm.
Hoạt chất theo nguồn: Aspirin 325 mg. Quy cách theo nguồn: 500 viên.', N'/products/ai-generated-500/0226-abo-more-0652fccd-1d33-9914-e536-e95be9974947.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,25 kg","Chi\u1EC1u cao: 11,71 cm","Chi\u1EC1u d\u00E0i: 6,35 cm","Chi\u1EC1u r\u1ED9ng: 6,35 cm"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0652fccd-1d33-9914-e536-e95be9974947', 1628200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-065fa914-81d1-7029-8596-be825ad65b61', N'amazon-berkeley-objects', N'065fa914-81d1-7029-8596-be825ad65b61', N'Giày cao gót nữ bít mũi màu be', N'Trang phục', 622975000, N'Giày cao gót nữ bít mũi màu be.

Thương hiệu: find..
Mã hoặc tên mẫu: RUTH-S-SH-1-2.
Màu sắc: Be.
Năm mẫu: 2020.', N'/products/ai-generated-500/0087-abo-more-065fa914-81d1-7029-8596-be825ad65b61.webp', N'["M\u00E0u s\u1EAFc: Be","N\u0103m m\u1EABu: 2020"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/065fa914-81d1-7029-8596-be825ad65b61', 2491900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-06bf67ae-93b7-ce43-e6f8-5abce8fe74f1', N'amazon-berkeley-objects', N'06bf67ae-93b7-ce43-e6f8-5abce8fe74f1', N'Ốp điện thoại cứng họa tiết trang trí', N'Điện tử', 108250000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8204-SL40720.
Thiết bị tương thích: Lenovo Vibe X3.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0232-abo-more-06bf67ae-93b7-ce43-e6f8-5abce8fe74f1.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Lenovo Vibe X3","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/06bf67ae-93b7-ce43-e6f8-5abce8fe74f1', 433000, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-06f9c294-1628-042c-5070-083a6c29429a', N'amazon-berkeley-objects', N'06f9c294-1628-042c-5070-083a6c29429a', N'Lắc tay vàng kiểu dáng thanh mảnh', N'Trang sức', 137825000, N'Lắc tay vàng kiểu dáng thanh mảnh.

Thương hiệu: AJC Collection(AJC.
Mã hoặc tên mẫu: 5501-1541-0015-0000.
Kiểu dáng: Vòng tay.
Khối lượng: 0,12 kg.', N'/products/ai-generated-500/0102-abo-more-06f9c294-1628-042c-5070-083a6c29429a.webp', N'["Ki\u1EC3u d\u00E1ng: V\u00F2ng tay","Kh\u1ED1i l\u01B0\u1EE3ng: 0,12 kg"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/06f9c294-1628-042c-5070-083a6c29429a', 551300, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0747b033-6656-eb41-f153-8ae74af1d651', N'amazon-berkeley-objects', N'0747b033-6656-eb41-f153-8ae74af1d651', N'Ốp điện thoại dẻo trong suốt họa tiết trang trí', N'Điện tử', 268025000, N'Ốp điện thoại dẻo trong suốt họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: 1101652.
Thiết bị tương thích: Oppo K1.
Kiểu dáng: Chuyên dụng.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0239-abo-more-0747b033-6656-eb41-f153-8ae74af1d651.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Oppo K1","Ki\u1EC3u d\u00E1ng: Chuy\u00EAn d\u1EE5ng","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0747b033-6656-eb41-f153-8ae74af1d651', 1072100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0755bfc1-076c-83b0-3891-d7877760e310', N'amazon-berkeley-objects', N'0755bfc1-076c-83b0-3891-d7877760e310', N'Ốp điện thoại cứng họa tiết trang trí', N'Điện tử', 463450000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8140-SL40618.
Thiết bị tương thích: Micromax Canvas Nitro 2 E311.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0243-abo-more-0755bfc1-076c-83b0-3891-d7877760e310.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Micromax Canvas Nitro 2 E311","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0755bfc1-076c-83b0-3891-d7877760e310', 1853800, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-07768498-d09c-2ead-38a3-98cf354f187e', N'amazon-berkeley-objects', N'07768498-d09c-2ead-38a3-98cf354f187e', N'Ốp điện thoại cứng họa tiết trang trí', N'Điện tử', 447875000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8349-SL40513.
Thiết bị tương thích: Gionee Elife S7.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0247-abo-more-07768498-d09c-2ead-38a3-98cf354f187e.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Gionee Elife S7","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/07768498-d09c-2ead-38a3-98cf354f187e', 1791500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-078a2386-d898-473a-b754-af30115e3a81', N'amazon-berkeley-objects', N'078a2386-d898-473a-b754-af30115e3a81', N'Giày thể thao nữ co giãn màu hồng', N'Trang phục', 83500000, N'Giày thể thao nữ co giãn màu hồng.

Thương hiệu: find..
Mã hoặc tên mẫu: Walsh.
Năm mẫu: 2017.
Chiều cao: 2,50 cm.
Chiều dài: 0,30 cm.
Chiều rộng: 2,60 cm.', N'/products/ai-generated-500/0101-abo-more-078a2386-d898-473a-b754-af30115e3a81.webp', N'["N\u0103m m\u1EABu: 2017","Chi\u1EC1u cao: 2,50 cm","Chi\u1EC1u d\u00E0i: 0,30 cm","Chi\u1EC1u r\u1ED9ng: 2,60 cm"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/078a2386-d898-473a-b754-af30115e3a81', 334000, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-07939b66-17d4-73a4-2d25-3120b0812205', N'amazon-berkeley-objects', N'07939b66-17d4-73a4-2d25-3120b0812205', N'Ốp điện thoại dẻo họa tiết trang trí', N'Điện tử', 542575000, N'Ốp điện thoại dẻo họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10067-SL40751.
Thiết bị tương thích: Panasonic Eluga Ray Max.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0251-abo-more-07939b66-17d4-73a4-2d25-3120b0812205.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Panasonic Eluga Ray Max","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/07939b66-17d4-73a4-2d25-3120b0812205', 2170300, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-07ad2279-14c2-8d0f-f5cb-2423027d4ecc', N'amazon-berkeley-objects', N'07ad2279-14c2-8d0f-f5cb-2423027d4ecc', N'Ốp điện thoại dẻo chữ trang trí', N'Điện tử', 564725000, N'Ốp điện thoại dẻo chữ trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10864-SL13014.
Thiết bị tương thích: Vivo Y19.
Chất liệu: Silicôn.
Kiểu dáng: Trang trí chữ.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0253-abo-more-07ad2279-14c2-8d0f-f5cb-2423027d4ecc.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Vivo Y19","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Ki\u1EC3u d\u00E1ng: Trang tr\u00ED ch\u1EEF","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/07ad2279-14c2-8d0f-f5cb-2423027d4ecc', 2258900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-07bd21da-5382-2e75-59a2-454d5767edde', N'amazon-berkeley-objects', N'07bd21da-5382-2e75-59a2-454d5767edde', N'Ốp điện thoại dẻo họa tiết ngân hà', N'Điện tử', 377400000, N'Ốp điện thoại dẻo họa tiết ngân hà.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10121-SL13027.
Thiết bị tương thích: Samsung Galaxy J2.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0256-abo-more-07bd21da-5382-2e75-59a2-454d5767edde.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Samsung Galaxy J2","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/07bd21da-5382-2e75-59a2-454d5767edde', 1509600, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-07d5da78-86e8-18fa-23f0-a2f311d9e80b', N'amazon-berkeley-objects', N'07d5da78-86e8-18fa-23f0-a2f311d9e80b', N'Ốp điện thoại dẻo chống trầy họa tiết trang trí', N'Điện tử', 466825000, N'Ốp điện thoại dẻo chống trầy họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: SOLOPPOF15TPU0313.
Thiết bị tương thích: Oppo F15.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0263-abo-more-07d5da78-86e8-18fa-23f0-a2f311d9e80b.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Oppo F15","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/07d5da78-86e8-18fa-23f0-a2f311d9e80b', 1867300, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-07e5f7f7-8a24-01d5-fe8b-b8953252abed', N'amazon-berkeley-objects', N'07e5f7f7-8a24-01d5-fe8b-b8953252abed', N'Ốp điện thoại cứng họa tiết trang trí', N'Điện tử', 539050000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8228-SL40764.
Thiết bị tương thích: Oppo F1 Plus.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0268-abo-more-07e5f7f7-8a24-01d5-fe8b-b8953252abed.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Oppo F1 Plus","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/07e5f7f7-8a24-01d5-fe8b-b8953252abed', 2156200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-08349aa7-e36a-62b3-1748-e8970f9e529c', N'amazon-berkeley-objects', N'08349aa7-e36a-62b3-1748-e8970f9e529c', N'Ốp điện thoại dẻo chống trầy họa tiết tình yêu', N'Điện tử', 426600000, N'Ốp điện thoại dẻo chống trầy họa tiết tình yêu.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: SOLH9XTPU0080.
Thiết bị tương thích: Huawei Honor 9X.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0270-abo-more-08349aa7-e36a-62b3-1748-e8970f9e529c.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Huawei Honor 9X","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/08349aa7-e36a-62b3-1748-e8970f9e529c', 1706400, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0854623d-a6ba-e692-4d7d-4fe87aa9385d', N'amazon-berkeley-objects', N'0854623d-a6ba-e692-4d7d-4fe87aa9385d', N'Ốp điện thoại cứng họa tiết chó con', N'Điện tử', 342175000, N'Ốp điện thoại cứng họa tiết chó con.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8606-SL40358.
Thiết bị tương thích: Nokia 3.1 Plus.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0280-abo-more-0854623d-a6ba-e692-4d7d-4fe87aa9385d.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Nokia 3.1 Plus","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0854623d-a6ba-e692-4d7d-4fe87aa9385d', 1368700, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0867080d-9f65-cd74-dd22-041d3bd142b2', N'amazon-berkeley-objects', N'0867080d-9f65-cd74-dd22-041d3bd142b2', N'Sáp thơm xe hơi hương vỏ cam', N'Làm đẹp', 340375000, N'Sáp thơm xe hơi hương vỏ cam.

Thương hiệu: Amazon Brand - Solimo.', N'/products/ai-generated-500/0021-abo-more-0867080d-9f65-cd74-dd22-041d3bd142b2.webp', N'["S\u00E1p th\u01A1m xe h\u01A1i h\u01B0\u01A1ng v\u1ECF cam"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0867080d-9f65-cd74-dd22-041d3bd142b2', 1361500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-08ced3e0-319c-df68-0682-b899b1f94079', N'amazon-berkeley-objects', N'08ced3e0-319c-df68-0682-b899b1f94079', N'Ốp điện thoại cứng họa tiết gấu trúc', N'Điện tử', 80900000, N'Ốp điện thoại cứng họa tiết gấu trúc.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8717-SL40408.
Thiết bị tương thích: OnePlus 7T Pro.
Chất liệu: Nhựa.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0287-abo-more-08ced3e0-319c-df68-0682-b899b1f94079.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: OnePlus 7T Pro","Ch\u1EA5t li\u1EC7u: Nh\u1EF1a","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/08ced3e0-319c-df68-0682-b899b1f94079', 323600, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-09431169-e93e-303c-e64e-9a814ac3a375', N'amazon-berkeley-objects', N'09431169-e93e-303c-e64e-9a814ac3a375', N'Ốp điện thoại cứng họa tiết trang trí', N'Điện tử', 328675000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8262-SL40500.
Thiết bị tương thích: Samsung Z3.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0293-abo-more-09431169-e93e-303c-e64e-9a814ac3a375.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Samsung Z3","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/09431169-e93e-303c-e64e-9a814ac3a375', 1314700, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0950302a-1bb3-ccfe-74e9-e858b21b8ed9', N'amazon-berkeley-objects', N'0950302a-1bb3-ccfe-74e9-e858b21b8ed9', N'Ốp điện thoại cứng họa tiết lá', N'Điện tử', 195975000, N'Ốp điện thoại cứng họa tiết lá.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8315-SL40395.
Thiết bị tương thích: Gionee Marathon M5 Plus.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0296-abo-more-0950302a-1bb3-ccfe-74e9-e858b21b8ed9.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Gionee Marathon M5 Plus","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0950302a-1bb3-ccfe-74e9-e858b21b8ed9', 783900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0954ab5a-0e51-fddf-977f-99c4eeca1636', N'amazon-berkeley-objects', N'0954ab5a-0e51-fddf-977f-99c4eeca1636', N'Ốp điện thoại dẻo họa tiết trang trí', N'Điện tử', 569175000, N'Ốp điện thoại dẻo họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10865-SL40451.
Thiết bị tương thích: LG W30 Pro.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0300-abo-more-0954ab5a-0e51-fddf-977f-99c4eeca1636.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: LG W30 Pro","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0954ab5a-0e51-fddf-977f-99c4eeca1636', 2276700, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0981ce9d-7a6f-80db-84e8-bb4c1e018213', N'amazon-berkeley-objects', N'0981ce9d-7a6f-80db-84e8-bb4c1e018213', N'Ốp điện thoại cứng vân đá cẩm thạch', N'Điện tử', 389900000, N'Ốp điện thoại cứng vân đá cẩm thạch.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8074-SL40511.
Thiết bị tương thích: Micromax Canvas Selfie Lens Q345.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0305-abo-more-0981ce9d-7a6f-80db-84e8-bb4c1e018213.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Micromax Canvas Selfie Lens Q345","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0981ce9d-7a6f-80db-84e8-bb4c1e018213', 1559600, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-09e44a9a-83cc-eaa2-f95f-f05ed9d1c938', N'amazon-berkeley-objects', N'09e44a9a-83cc-eaa2-f95f-f05ed9d1c938', N'Ốp điện thoại chống va đập họa tiết hoa', N'Điện tử', 565500000, N'Ốp điện thoại chống va đập họa tiết hoa.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: 1101515.
Thiết bị tương thích: Xiaomi Redmi Note 5.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0308-abo-more-09e44a9a-83cc-eaa2-f95f-f05ed9d1c938.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Xiaomi Redmi Note 5","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/09e44a9a-83cc-eaa2-f95f-f05ed9d1c938', 2262000, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0aa5255f-7923-cf78-5ef9-19d709726180', N'amazon-berkeley-objects', N'0aa5255f-7923-cf78-5ef9-19d709726180', N'Bông tai vàng trắng đính kim cương tròn', N'Trang sức', 365625000, N'Bông tai vàng trắng đính kim cương tròn.

Thương hiệu: Amazon Collection.
Mã hoặc tên mẫu: ERBWG400CD.', N'/products/ai-generated-500/0115-abo-more-0aa5255f-7923-cf78-5ef9-19d709726180.webp', N'["B\u00F4ng tai v\u00E0ng tr\u1EAFng \u0111\u00EDnh kim c\u01B0\u01A1ng tr\u00F2n"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0aa5255f-7923-cf78-5ef9-19d709726180', 1462500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0b43fbd2-ea11-f62a-d6bb-6578c1a09105', N'amazon-berkeley-objects', N'0b43fbd2-ea11-f62a-d6bb-6578c1a09105', N'Ốp điện thoại dẻo họa tiết trang trí', N'Điện tử', 614350000, N'Ốp điện thoại dẻo họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10004-SL40417.
Thiết bị tương thích: Gionee P7 Max.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0333-abo-more-0b43fbd2-ea11-f62a-d6bb-6578c1a09105.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Gionee P7 Max","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0b43fbd2-ea11-f62a-d6bb-6578c1a09105', 2457400, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0ba820e9-edb6-6ba3-625b-fb589bf7d2d7', N'amazon-berkeley-objects', N'0ba820e9-edb6-6ba3-625b-fb589bf7d2d7', N'Ốp điện thoại dẻo trong suốt họa tiết trang trí', N'Điện tử', 369175000, N'Ốp điện thoại dẻo trong suốt họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: 71068.
Thiết bị tương thích: Honor 8X.
Màu sắc: Đen.
Kiểu dáng: Chuyên dụng.
Khối lượng: 0,02 kg.', N'/products/ai-generated-500/0343-abo-more-0ba820e9-edb6-6ba3-625b-fb589bf7d2d7.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Honor 8X","M\u00E0u s\u1EAFc: \u0110en","Ki\u1EC3u d\u00E1ng: Chuy\u00EAn d\u1EE5ng","Kh\u1ED1i l\u01B0\u1EE3ng: 0,02 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0ba820e9-edb6-6ba3-625b-fb589bf7d2d7', 1476700, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0bbbb44c-c2b6-8d53-1673-71b871294422', N'amazon-berkeley-objects', N'0bbbb44c-c2b6-8d53-1673-71b871294422', N'Ốp điện thoại dẻo họa tiết trang trí', N'Điện tử', 216475000, N'Ốp điện thoại dẻo họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10334-SL12462.
Thiết bị tương thích: Motorola Moto E5 Plus.
Chất liệu: Silicôn.
Kiểu dáng: Họa tiết trang trí.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0348-abo-more-0bbbb44c-c2b6-8d53-1673-71b871294422.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Motorola Moto E5 Plus","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Ki\u1EC3u d\u00E1ng: H\u1ECDa ti\u1EBFt trang tr\u00ED","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0bbbb44c-c2b6-8d53-1673-71b871294422', 865900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0bf90c17-e8f5-5d96-b9a7-ccbf3c6c6753', N'amazon-berkeley-objects', N'0bf90c17-e8f5-5d96-b9a7-ccbf3c6c6753', N'Dép quai hậu thể thao đệm êm', N'Trang phục', 212600000, N'Dép quai hậu thể thao đệm êm.

Thương hiệu: Amazon Essentials.
Mã hoặc tên mẫu: Sox.', N'/products/ai-generated-500/0128-abo-more-0bf90c17-e8f5-5d96-b9a7-ccbf3c6c6753.webp', N'["D\u00E9p quai h\u1EADu th\u1EC3 thao \u0111\u1EC7m \u00EAm"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0bf90c17-e8f5-5d96-b9a7-ccbf3c6c6753', 850400, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0c20156a-43bf-2ace-f8bb-b3777935bf12', N'amazon-berkeley-objects', N'0c20156a-43bf-2ace-f8bb-b3777935bf12', N'Ốp điện thoại dẻo họa tiết trang trí', N'Điện tử', 447150000, N'Ốp điện thoại dẻo họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10234-SL11074.
Thiết bị tương thích: Lyf Water 7S.
Chất liệu: Silicôn.
Kiểu dáng: Họa tiết xe.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0365-abo-more-0c20156a-43bf-2ace-f8bb-b3777935bf12.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Lyf Water 7S","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Ki\u1EC3u d\u00E1ng: H\u1ECDa ti\u1EBFt xe","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0c20156a-43bf-2ace-f8bb-b3777935bf12', 1788600, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0c3074a9-d173-a357-bd56-2dce0dd2f9cf', N'amazon-berkeley-objects', N'0c3074a9-d173-a357-bd56-2dce0dd2f9cf', N'Ốp điện thoại dẻo họa tiết trang trí', N'Điện tử', 252300000, N'Ốp điện thoại dẻo họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10270-SL40749.
Thiết bị tương thích: Vivo V5.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0368-abo-more-0c3074a9-d173-a357-bd56-2dce0dd2f9cf.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Vivo V5","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0c3074a9-d173-a357-bd56-2dce0dd2f9cf', 1009200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0c4fb24d-a4d5-e266-443b-c6165f5733a1', N'amazon-berkeley-objects', N'0c4fb24d-a4d5-e266-443b-c6165f5733a1', N'Giày tây nam da màu đen', N'Trang phục', 324050000, N'Giày tây nam da màu đen.

Thương hiệu: Burwood.
Mã hoặc tên mẫu: BW 397.', N'/products/ai-generated-500/0139-abo-more-0c4fb24d-a4d5-e266-443b-c6165f5733a1.webp', N'["Gi\u00E0y t\u00E2y nam da m\u00E0u \u0111en"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0c4fb24d-a4d5-e266-443b-c6165f5733a1', 1296200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0cc85b23-5b16-6982-20f9-ee0c11a19799', N'amazon-berkeley-objects', N'0cc85b23-5b16-6982-20f9-ee0c11a19799', N'Nhíp tỉa lông mày', N'Làm đẹp', 44450000, N'Nhíp tỉa lông mày.

Thương hiệu: Amazon Brand - Solimo.', N'/products/ai-generated-500/0034-abo-more-0cc85b23-5b16-6982-20f9-ee0c11a19799.webp', N'["Nh\u00EDp t\u1EC9a l\u00F4ng m\u00E0y"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0cc85b23-5b16-6982-20f9-ee0c11a19799', 177800, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0cdaeade-1a45-3e63-eb12-19ba9c7708d3', N'amazon-berkeley-objects', N'0cdaeade-1a45-3e63-eb12-19ba9c7708d3', N'Ốp điện thoại cứng họa tiết trang trí', N'Điện tử', 30600000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8186-SL40584.
Thiết bị tương thích: Vivo V1 Max.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0374-abo-more-0cdaeade-1a45-3e63-eb12-19ba9c7708d3.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Vivo V1 Max","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0cdaeade-1a45-3e63-eb12-19ba9c7708d3', 122400, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0ce694b1-0308-4731-a19d-b85eb7ee7f29', N'amazon-berkeley-objects', N'0ce694b1-0308-4731-a19d-b85eb7ee7f29', N'Trang sức bạc mạ vàng hình trái tim đính đá', N'Trang sức', 89375000, N'Trang sức bạc mạ vàng hình trái tim đính đá.

Thương hiệu: Amazon Collection.
Mã hoặc tên mẫu: ESW4264WTCAM.
Chất liệu: Kim loại.
Khối lượng: 0,01 kg.
Chiều cao: 1,50 cm.
Chiều dài: 9,70 cm.
Chiều rộng: 9,40 cm.', N'/products/ai-generated-500/0125-abo-more-0ce694b1-0308-4731-a19d-b85eb7ee7f29.webp', N'["Ch\u1EA5t li\u1EC7u: Kim lo\u1EA1i","Kh\u1ED1i l\u01B0\u1EE3ng: 0,01 kg","Chi\u1EC1u cao: 1,50 cm","Chi\u1EC1u d\u00E0i: 9,70 cm"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0ce694b1-0308-4731-a19d-b85eb7ee7f29', 357500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0d44edf3-6f43-f112-2e53-8c4a53157db8', N'amazon-berkeley-objects', N'0d44edf3-6f43-f112-2e53-8c4a53157db8', N'Ốp điện thoại cứng họa tiết đôi tình nhân', N'Điện tử', 556400000, N'Ốp điện thoại cứng họa tiết đôi tình nhân.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8048-SL40744.
Thiết bị tương thích: Samsung Galaxy Grand 2 G7102 / G7105.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0383-abo-more-0d44edf3-6f43-f112-2e53-8c4a53157db8.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Samsung Galaxy Grand 2 G7102 / G7105","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0d44edf3-6f43-f112-2e53-8c4a53157db8', 2225600, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0d495fa1-b127-8add-8ef3-30df53d1029f', N'amazon-berkeley-objects', N'0d495fa1-b127-8add-8ef3-30df53d1029f', N'Củ sạc tường sáu cổng màu đen', N'Điện tử', 136600000, N'Củ sạc tường sáu cổng màu đen.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: UTC6061UK-BK.
Màu sắc: Đen.
Kiểu dáng: Sáu cổng.
Khối lượng: 0,29 kg.
Chiều cao: 2,79 cm.
Chiều dài: 9,91 cm.
Chiều rộng: 7,01 cm.', N'/products/ai-generated-500/0385-abo-more-0d495fa1-b127-8add-8ef3-30df53d1029f.webp', N'["M\u00E0u s\u1EAFc: \u0110en","Ki\u1EC3u d\u00E1ng: S\u00E1u c\u1ED5ng","Kh\u1ED1i l\u01B0\u1EE3ng: 0,29 kg","Chi\u1EC1u cao: 2,79 cm"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0d495fa1-b127-8add-8ef3-30df53d1029f', 546400, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0e144c82-2ac8-f23c-55d8-2511102dcfec', N'amazon-berkeley-objects', N'0e144c82-2ac8-f23c-55d8-2511102dcfec', N'Dung dịch rửa tay khô lô hội và tinh dầu chanh', N'Làm đẹp', 116375000, N'Dung dịch rửa tay khô lô hội và tinh dầu chanh.

Thương hiệu: Amazon Brand - Solimo.
Chiều cao: 8,00 cm.
Chiều dài: 4,00 cm.
Chiều rộng: 3,00 cm.', N'/products/ai-generated-500/0040-abo-more-0e144c82-2ac8-f23c-55d8-2511102dcfec.webp', N'["Chi\u1EC1u cao: 8,00 cm","Chi\u1EC1u d\u00E0i: 4,00 cm","Chi\u1EC1u r\u1ED9ng: 3,00 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0e144c82-2ac8-f23c-55d8-2511102dcfec', 465500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0e207d4e-3475-7abb-adb3-167845f42c23', N'amazon-berkeley-objects', N'0e207d4e-3475-7abb-adb3-167845f42c23', N'Giày bốt nữ cổ chân màu đỏ rượu', N'Trang phục', 593500000, N'Giày bốt nữ cổ chân màu đỏ rượu.

Thương hiệu: Sixth & Love.
Mã hoặc tên mẫu: Quilted Ankle.', N'/products/ai-generated-500/0153-abo-more-0e207d4e-3475-7abb-adb3-167845f42c23.webp', N'["Gi\u00E0y b\u1ED1t n\u1EEF c\u1ED5 ch\u00E2n m\u00E0u \u0111\u1ECF r\u01B0\u1EE3u"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0e207d4e-3475-7abb-adb3-167845f42c23', 2374000, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0e399ff8-897f-73f1-3340-6bba5a1cc47b', N'amazon-berkeley-objects', N'0e399ff8-897f-73f1-3340-6bba5a1cc47b', N'Găng tay len nữ màu tự nhiên', N'Trang sức', 136125000, N'Găng tay len nữ màu tự nhiên.

Thương hiệu: NORTH ELEVEN.', N'/products/ai-generated-500/0129-abo-more-0e399ff8-897f-73f1-3340-6bba5a1cc47b.webp', N'["G\u0103ng tay len n\u1EEF m\u00E0u t\u1EF1 nhi\u00EAn"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0e399ff8-897f-73f1-3340-6bba5a1cc47b', 544500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0e3c1639-b002-368e-3f93-18610d4c72dd', N'amazon-berkeley-objects', N'0e3c1639-b002-368e-3f93-18610d4c72dd', N'Túi đóng gói niêm phong vận chuyển', N'Điện tử', 523450000, N'Túi đóng gói niêm phong vận chuyển.

Thương hiệu: AmazonBasics.', N'/products/ai-generated-500/0393-abo-more-0e3c1639-b002-368e-3f93-18610d4c72dd.webp', N'["T\u00FAi \u0111\u00F3ng g\u00F3i ni\u00EAm phong v\u1EADn chuy\u1EC3n"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0e3c1639-b002-368e-3f93-18610d4c72dd', 2093800, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0e824eb6-a7ef-76f5-f9b4-ce1256858173', N'amazon-berkeley-objects', N'0e824eb6-a7ef-76f5-f9b4-ce1256858173', N'Bột đạm sữa vị bạc hà và sô cô la', N'Làm đẹp', 543925000, N'Bột đạm sữa vị bạc hà và sô cô la.

Thương hiệu: Amfit Nutrition.
Mã hoặc tên mẫu: 5.40061E+12.
Kiểu dáng: Đạm từ sữa.
Khối lượng: 0,99 kg.
Chiều cao: 29,00 cm.
Chiều dài: 24,00 cm.
Chiều rộng: 2,00 cm.', N'/products/ai-generated-500/0047-abo-more-0e824eb6-a7ef-76f5-f9b4-ce1256858173.webp', N'["Ki\u1EC3u d\u00E1ng: \u0110\u1EA1m t\u1EEB s\u1EEFa","Kh\u1ED1i l\u01B0\u1EE3ng: 0,99 kg","Chi\u1EC1u cao: 29,00 cm","Chi\u1EC1u d\u00E0i: 24,00 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0e824eb6-a7ef-76f5-f9b4-ce1256858173', 2175700, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0e883598-21e1-c948-cc49-1235b6d978a7', N'amazon-berkeley-objects', N'0e883598-21e1-c948-cc49-1235b6d978a7', N'Ốp điện thoại cứng họa tiết trang trí', N'Làm đẹp', 409875000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8170-SL40347.
Thiết bị tương thích: Coolpad Note 3 Lite.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0052-abo-more-0e883598-21e1-c948-cc49-1235b6d978a7.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Coolpad Note 3 Lite","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0e883598-21e1-c948-cc49-1235b6d978a7', 1639500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0e9e7db6-c255-30ae-55ae-9faa9e28b220', N'amazon-berkeley-objects', N'0e9e7db6-c255-30ae-55ae-9faa9e28b220', N'Giày thể thao trẻ em vải dệt kim', N'Trang sức', 231000000, N'Giày thể thao trẻ em vải dệt kim.

Thương hiệu: Amazon Essentials.
Mã hoặc tên mẫu: AMZA19R0579D-2.', N'/products/ai-generated-500/0132-abo-more-0e9e7db6-c255-30ae-55ae-9faa9e28b220.webp', N'["Gi\u00E0y th\u1EC3 thao tr\u1EBB em v\u1EA3i d\u1EC7t kim"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0e9e7db6-c255-30ae-55ae-9faa9e28b220', 924000, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0ee9899d-3010-1a4b-fd9e-79c553dd571e', N'amazon-berkeley-objects', N'0ee9899d-3010-1a4b-fd9e-79c553dd571e', N'Ốp điện thoại dẻo họa tiết trang trí', N'Điện tử', 356925000, N'Ốp điện thoại dẻo họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10793-SL40440.
Thiết bị tương thích: Vivo S1 / Vivo Z1x.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0404-abo-more-0ee9899d-3010-1a4b-fd9e-79c553dd571e.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Vivo S1 / Vivo Z1x","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0ee9899d-3010-1a4b-fd9e-79c553dd571e', 1427700, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0ef1d27e-9d8f-09fb-9e45-e4fe632f39b0', N'amazon-berkeley-objects', N'0ef1d27e-9d8f-09fb-9e45-e4fe632f39b0', N'Ốp điện thoại dẻo họa tiết trang trí', N'Điện tử', 562925000, N'Ốp điện thoại dẻo họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10251-SL40421.
Thiết bị tương thích: Motorola Moto E3 Power.
Chất liệu: Silicôn.
Kiểu dáng: Họa tiết trang trí.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0409-abo-more-0ef1d27e-9d8f-09fb-9e45-e4fe632f39b0.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Motorola Moto E3 Power","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Ki\u1EC3u d\u00E1ng: H\u1ECDa ti\u1EBFt trang tr\u00ED","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0ef1d27e-9d8f-09fb-9e45-e4fe632f39b0', 2251700, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0f15c76c-54a5-b51d-63bb-051ecb70b9d7', N'amazon-berkeley-objects', N'0f15c76c-54a5-b51d-63bb-051ecb70b9d7', N'Ốp điện thoại dẻo họa tiết trang trí', N'Điện tử', 158275000, N'Ốp điện thoại dẻo họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10195-SL11038.
Thiết bị tương thích: Gionee X1.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0411-abo-more-0f15c76c-54a5-b51d-63bb-051ecb70b9d7.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Gionee X1","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0f15c76c-54a5-b51d-63bb-051ecb70b9d7', 633100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-0fe23e47-1dee-bb5a-7e0c-b6c0b953602d', N'amazon-berkeley-objects', N'0fe23e47-1dee-bb5a-7e0c-b6c0b953602d', N'Ốp điện thoại chống va đập họa tiết trái tim', N'Điện tử', 359950000, N'Ốp điện thoại chống va đập họa tiết trái tim.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: 1101586.
Thiết bị tương thích: điện thoại.
Chất liệu: Nhựa.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0427-abo-more-0fe23e47-1dee-bb5a-7e0c-b6c0b953602d.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: \u0111i\u1EC7n tho\u1EA1i","Ch\u1EA5t li\u1EC7u: Nh\u1EF1a","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/0fe23e47-1dee-bb5a-7e0c-b6c0b953602d', 1439800, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-1024efa6-46b9-d39a-c760-cd351ae4439d', N'amazon-berkeley-objects', N'1024efa6-46b9-d39a-c760-cd351ae4439d', N'Ốp điện thoại cứng họa tiết hoa', N'Điện tử', 457150000, N'Ốp điện thoại cứng họa tiết hoa.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8162-SL40472.
Thiết bị tương thích: LG G4 Stylus.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0429-abo-more-1024efa6-46b9-d39a-c760-cd351ae4439d.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: LG G4 Stylus","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/1024efa6-46b9-d39a-c760-cd351ae4439d', 1828600, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-1025af6f-2072-08e6-ad49-702fc8ef211c', N'amazon-berkeley-objects', N'1025af6f-2072-08e6-ad49-702fc8ef211c', N'Pin dự phòng kèm cáp sạc màu đen', N'Trang sức', 353375000, N'Pin dự phòng kèm cáp sạc màu đen.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: 2,000 mAh.', N'/products/ai-generated-500/0140-abo-more-1025af6f-2072-08e6-ad49-702fc8ef211c.webp', N'["Pin d\u1EF1 ph\u00F2ng k\u00E8m c\u00E1p s\u1EA1c m\u00E0u \u0111en"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/1025af6f-2072-08e6-ad49-702fc8ef211c', 1413500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-1028ce60-3c05-78c5-03af-c3b2c360d512', N'amazon-berkeley-objects', N'1028ce60-3c05-78c5-03af-c3b2c360d512', N'Ví cầm tay nữ màu hồng và be', N'Trang sức', 492725000, N'Ví cầm tay nữ màu hồng và be.

Thương hiệu: Nia & Nicole.
Mã hoặc tên mẫu: BNS 2450BPK.
Chất liệu: Vật liệu khác.
Kiểu dáng: Ví cầm tay.
Khối lượng: 0,20 kg.
Chiều cao: 11,00 cm.
Chiều dài: 19,00 cm.
Chiều rộng: 3,00 cm.', N'/products/ai-generated-500/0143-abo-more-1028ce60-3c05-78c5-03af-c3b2c360d512.webp', N'["Ch\u1EA5t li\u1EC7u: V\u1EADt li\u1EC7u kh\u00E1c","Ki\u1EC3u d\u00E1ng: V\u00ED c\u1EA7m tay","Kh\u1ED1i l\u01B0\u1EE3ng: 0,20 kg","Chi\u1EC1u cao: 11,00 cm"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/1028ce60-3c05-78c5-03af-c3b2c360d512', 1970900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-10606515-d04e-2dba-7928-1f7a52d64f57', N'amazon-berkeley-objects', N'10606515-d04e-2dba-7928-1f7a52d64f57', N'Bông tai nụ màu vàng', N'Trang sức', 380025000, N'Bông tai nụ màu vàng.

Thương hiệu: Amazon Collection.
Mã hoặc tên mẫu: JEE14072_5NNCL00A100.', N'/products/ai-generated-500/0149-abo-more-10606515-d04e-2dba-7928-1f7a52d64f57.webp', N'["B\u00F4ng tai n\u1EE5 m\u00E0u v\u00E0ng"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/10606515-d04e-2dba-7928-1f7a52d64f57', 1520100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-106592ba-8da2-44d5-cd10-c72c2944e6c3', N'amazon-berkeley-objects', N'106592ba-8da2-44d5-cd10-c72c2944e6c3', N'Nhẫn mạ bạch kim đính năm viên đá', N'Trang sức', 501975000, N'Nhẫn mạ bạch kim đính năm viên đá.

Thương hiệu: Amazon Collection.', N'/products/ai-generated-500/0154-abo-more-106592ba-8da2-44d5-cd10-c72c2944e6c3.webp', N'["Nh\u1EABn m\u1EA1 b\u1EA1ch kim \u0111\u00EDnh n\u0103m vi\u00EAn \u0111\u00E1"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/106592ba-8da2-44d5-cd10-c72c2944e6c3', 2007900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-10d49f53-6b13-c89a-2fab-6ebb35ba8700', N'amazon-berkeley-objects', N'10d49f53-6b13-c89a-2fab-6ebb35ba8700', N'Ốp điện thoại cứng họa tiết trang trí', N'Điện tử', 178050000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: SOLCPNOTE53DM141.
Thiết bị tương thích: Coolpad Note 5.
Chất liệu: Nhựa.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0438-abo-more-10d49f53-6b13-c89a-2fab-6ebb35ba8700.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Coolpad Note 5","Ch\u1EA5t li\u1EC7u: Nh\u1EF1a","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/10d49f53-6b13-c89a-2fab-6ebb35ba8700', 712200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-111bc9da-5c3a-771c-80a8-0200edb50f84', N'amazon-berkeley-objects', N'111bc9da-5c3a-771c-80a8-0200edb50f84', N'Khay đựng xà phòng bằng thép màu đen', N'Làm đẹp', 520225000, N'Khay đựng xà phòng bằng thép màu đen.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: 023822-040-A60.
Chất liệu: Thép không gỉ.
Khối lượng: 0,10 kg.
Chiều cao: 2,54 cm.
Chiều dài: 13,97 cm.
Chiều rộng: 8,89 cm.', N'/products/ai-generated-500/0059-abo-more-111bc9da-5c3a-771c-80a8-0200edb50f84.webp', N'["Ch\u1EA5t li\u1EC7u: Th\u00E9p kh\u00F4ng g\u1EC9","Kh\u1ED1i l\u01B0\u1EE3ng: 0,10 kg","Chi\u1EC1u cao: 2,54 cm","Chi\u1EC1u d\u00E0i: 13,97 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/111bc9da-5c3a-771c-80a8-0200edb50f84', 2080900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-1163de18-9578-a2fd-a3e2-4e8c620b9776', N'amazon-berkeley-objects', N'1163de18-9578-a2fd-a3e2-4e8c620b9776', N'Ốp điện thoại cứng họa tiết máy ảnh', N'Điện tử', 401775000, N'Ốp điện thoại cứng họa tiết máy ảnh.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8329-SL40525.
Thiết bị tương thích: Sony Xperia XZ Dual.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0447-abo-more-1163de18-9578-a2fd-a3e2-4e8c620b9776.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Sony Xperia XZ Dual","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/1163de18-9578-a2fd-a3e2-4e8c620b9776', 1607100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-116a6c88-aa58-f037-c15a-2fadd5ccd2f2', N'amazon-berkeley-objects', N'116a6c88-aa58-f037-c15a-2fadd5ccd2f2', N'Dép nữ quai chéo màu hồng tím', N'Trang phục', 52025000, N'Dép nữ quai chéo màu hồng tím.

Thương hiệu: The Drop.
Mã hoặc tên mẫu: Bristol.
Khối lượng: 0,18 kg.', N'/products/ai-generated-500/0172-abo-more-116a6c88-aa58-f037-c15a-2fadd5ccd2f2.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,18 kg"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/116a6c88-aa58-f037-c15a-2fadd5ccd2f2', 208100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-116b0971-7aee-6af8-0a5a-66bdd4d831a7', N'amazon-berkeley-objects', N'116b0971-7aee-6af8-0a5a-66bdd4d831a7', N'Ốp điện thoại cứng họa tiết bướm', N'Điện tử', 92225000, N'Ốp điện thoại cứng họa tiết bướm.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: SOLRM2PRO3DM36.
Thiết bị tương thích: RealMe 2 Pro.
Chất liệu: Nhựa.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0449-abo-more-116b0971-7aee-6af8-0a5a-66bdd4d831a7.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: RealMe 2 Pro","Ch\u1EA5t li\u1EC7u: Nh\u1EF1a","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/116b0971-7aee-6af8-0a5a-66bdd4d831a7', 368900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-11bd1eaf-c70b-2a2f-f78c-1e994b2b6d18', N'amazon-berkeley-objects', N'11bd1eaf-c70b-2a2f-f78c-1e994b2b6d18', N'Giày lười nam màu đỏ rượu đậm', N'Trang phục', 225725000, N'Giày lười nam màu đỏ rượu đậm.

Thương hiệu: find..
Mã hoặc tên mẫu: Maximum Leather.
Năm mẫu: 2020.', N'/products/ai-generated-500/0178-abo-more-11bd1eaf-c70b-2a2f-f78c-1e994b2b6d18.webp', N'["N\u0103m m\u1EABu: 2020"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/11bd1eaf-c70b-2a2f-f78c-1e994b2b6d18', 902900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-120f0ca8-b426-9cc4-0a41-77fa038c32df', N'amazon-berkeley-objects', N'120f0ca8-b426-9cc4-0a41-77fa038c32df', N'Ốp điện thoại dẻo họa tiết trang trí', N'Điện tử', 438075000, N'Ốp điện thoại dẻo họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10871-SL12023.
Thiết bị tương thích: Oppo Reno Ace/Realme X2 Pro.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0453-abo-more-120f0ca8-b426-9cc4-0a41-77fa038c32df.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Oppo Reno Ace/Realme X2 Pro","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/120f0ca8-b426-9cc4-0a41-77fa038c32df', 1752300, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-121e3d39-a01f-5f65-eccb-78c00826c86b', N'amazon-berkeley-objects', N'121e3d39-a01f-5f65-eccb-78c00826c86b', N'Ốp điện thoại cứng họa tiết chó con', N'Điện tử', 260275000, N'Ốp điện thoại cứng họa tiết chó con.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8256-SL40358.
Thiết bị tương thích: Micromax Canvas Selfie 2 Q340.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0457-abo-more-121e3d39-a01f-5f65-eccb-78c00826c86b.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Micromax Canvas Selfie 2 Q340","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/121e3d39-a01f-5f65-eccb-78c00826c86b', 1041100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-126a8a0f-240d-90ee-2cf5-5c2772a8df91', N'amazon-berkeley-objects', N'126a8a0f-240d-90ee-2cf5-5c2772a8df91', N'Ốp điện thoại dẻo họa tiết trang trí', N'Điện tử', 226050000, N'Ốp điện thoại dẻo họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10624-SL40413.
Thiết bị tương thích: Lephone W2.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0468-abo-more-126a8a0f-240d-90ee-2cf5-5c2772a8df91.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Lephone W2","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/126a8a0f-240d-90ee-2cf5-5c2772a8df91', 904200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-12888439-7cfa-7d9b-c3f7-1538b1240854', N'amazon-berkeley-objects', N'12888439-7cfa-7d9b-c3f7-1538b1240854', N'Bột đạm sữa vị bánh sô cô la', N'Làm đẹp', 597150000, N'Bột đạm sữa vị bánh sô cô la.

Thương hiệu: OWN PWR.
Khối lượng: 2,52 kg.
Chiều cao: 28,19 cm.
Chiều dài: 20,32 cm.
Chiều rộng: 20,32 cm.', N'/products/ai-generated-500/0065-abo-more-12888439-7cfa-7d9b-c3f7-1538b1240854.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 2,52 kg","Chi\u1EC1u cao: 28,19 cm","Chi\u1EC1u d\u00E0i: 20,32 cm","Chi\u1EC1u r\u1ED9ng: 20,32 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/12888439-7cfa-7d9b-c3f7-1538b1240854', 2388600, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-128c1d9a-3c10-8cdb-ea2f-6b6943980b2e', N'amazon-berkeley-objects', N'128c1d9a-3c10-8cdb-ea2f-6b6943980b2e', N'Ốp điện thoại dẻo chống trầy họa tiết trang trí', N'Điện tử', 362300000, N'Ốp điện thoại dẻo chống trầy họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: SOLPOCOX2TPU0009.
Thiết bị tương thích: Poco X2 / Xiaomi Redmi K30.
Kiểu dáng: Nữ tính.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0474-abo-more-128c1d9a-3c10-8cdb-ea2f-6b6943980b2e.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Poco X2 / Xiaomi Redmi K30","Ki\u1EC3u d\u00E1ng: N\u1EEF t\u00EDnh","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/128c1d9a-3c10-8cdb-ea2f-6b6943980b2e', 1449200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-12b83251-5e60-c324-8b91-568f4cc22ebb', N'amazon-berkeley-objects', N'12b83251-5e60-c324-8b91-568f4cc22ebb', N'Ốp điện thoại dẻo họa tiết lá', N'Điện tử', 147200000, N'Ốp điện thoại dẻo họa tiết lá.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10346-SL40528.
Thiết bị tương thích: Mi Redmi Y1.
Chất liệu: Silicôn.
Kiểu dáng: Họa tiết trang trí.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0480-abo-more-12b83251-5e60-c324-8b91-568f4cc22ebb.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Mi Redmi Y1","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Ki\u1EC3u d\u00E1ng: H\u1ECDa ti\u1EBFt trang tr\u00ED","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/12b83251-5e60-c324-8b91-568f4cc22ebb', 588800, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-12d53aab-d951-688e-4abb-52f2264b240d', N'amazon-berkeley-objects', N'12d53aab-d951-688e-4abb-52f2264b240d', N'Ốp điện thoại chống va đập họa tiết ngân hà', N'Điện tử', 245275000, N'Ốp điện thoại chống va đập họa tiết ngân hà.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: 1101814.
Thiết bị tương thích: Samsung Galaxy J6 2018 / Samsung Galaxy On6.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0483-abo-more-12d53aab-d951-688e-4abb-52f2264b240d.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Samsung Galaxy J6 2018 / Samsung Galaxy On6","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/12d53aab-d951-688e-4abb-52f2264b240d', 981100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-13253ba0-17ff-89c5-7f82-5eaa7ca9571e', N'amazon-berkeley-objects', N'13253ba0-17ff-89c5-7f82-5eaa7ca9571e', N'Giày cao gót nữ quai mảnh màu xanh ngọc', N'Trang phục', 455275000, N'Giày cao gót nữ quai mảnh màu xanh ngọc.

Thương hiệu: find..
Mã hoặc tên mẫu: R3092.
Năm mẫu: 2020.', N'/products/ai-generated-500/0181-abo-more-13253ba0-17ff-89c5-7f82-5eaa7ca9571e.webp', N'["N\u0103m m\u1EABu: 2020"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/13253ba0-17ff-89c5-7f82-5eaa7ca9571e', 1821100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-13295945-e7ec-b895-df83-55849e406436', N'amazon-berkeley-objects', N'13295945-e7ec-b895-df83-55849e406436', N'Ốp điện thoại cứng ô vuông nhiều màu', N'Điện tử', 303900000, N'Ốp điện thoại cứng ô vuông nhiều màu.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8481-SL40606.
Thiết bị tương thích: Apple iPhone X.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0485-abo-more-13295945-e7ec-b895-df83-55849e406436.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Apple iPhone X","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/13295945-e7ec-b895-df83-55849e406436', 1215600, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-134f7210-c496-b28e-d7aa-1dfabb489dd0', N'amazon-berkeley-objects', N'134f7210-c496-b28e-d7aa-1dfabb489dd0', N'Giày lười nữ dùng hằng ngày', N'Trang phục', 223875000, N'Giày lười nữ dùng hằng ngày.

Thương hiệu: find..
Mã hoặc tên mẫu: AMZ201.
Kiểu dáng: Giày xỏ chân.', N'/products/ai-generated-500/0185-abo-more-134f7210-c496-b28e-d7aa-1dfabb489dd0.webp', N'["Ki\u1EC3u d\u00E1ng: Gi\u00E0y x\u1ECF ch\u00E2n"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/134f7210-c496-b28e-d7aa-1dfabb489dd0', 895500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-1387aada-566b-a84f-9f49-37b848fdd5c4', N'amazon-berkeley-objects', N'1387aada-566b-a84f-9f49-37b848fdd5c4', N'Ốp điện thoại cứng họa tiết trang trí', N'Điện tử', 94075000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8582-SL40617.
Thiết bị tương thích: Realme C1.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0487-abo-more-1387aada-566b-a84f-9f49-37b848fdd5c4.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Realme C1","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/1387aada-566b-a84f-9f49-37b848fdd5c4', 376300, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-14023458-bece-8895-f12d-510a81150508', N'amazon-berkeley-objects', N'14023458-bece-8895-f12d-510a81150508', N'Ốp điện thoại cứng họa tiết trang trí', N'Điện tử', 433000000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8060-SL40638.
Thiết bị tương thích: LG Nexus 5X.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0491-abo-more-14023458-bece-8895-f12d-510a81150508.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: LG Nexus 5X","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/14023458-bece-8895-f12d-510a81150508', 1732000, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-14323dd4-0073-42e8-1a08-fe32edd61157', N'amazon-berkeley-objects', N'14323dd4-0073-42e8-1a08-fe32edd61157', N'Ốp điện thoại dẻo chống trầy họa tiết hoa', N'Điện tử', 114300000, N'Ốp điện thoại dẻo chống trầy họa tiết hoa.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: SOLRMC3TPU0061.
Thiết bị tương thích: Realme C3.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0499-abo-more-14323dd4-0073-42e8-1a08-fe32edd61157.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Realme C3","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌘', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/14323dd4-0073-42e8-1a08-fe32edd61157', 457200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-150e148e-6f7c-439b-c865-d34adaf15d1d', N'amazon-berkeley-objects', N'150e148e-6f7c-439b-c865-d34adaf15d1d', N'Bộ hai đôi lót giày nâng đỡ bàn chân nam', N'Trang phục', 339450000, N'Bộ hai đôi lót giày nâng đỡ bàn chân nam.

Thương hiệu: Trek Support.
Mã hoặc tên mẫu: 4344254630.
Chiều cao: 3,81 cm.
Chiều dài: 41,91 cm.
Chiều rộng: 17,78 cm.', N'/products/ai-generated-500/0191-abo-more-150e148e-6f7c-439b-c865-d34adaf15d1d.webp', N'["Chi\u1EC1u cao: 3,81 cm","Chi\u1EC1u d\u00E0i: 41,91 cm","Chi\u1EC1u r\u1ED9ng: 17,78 cm"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/150e148e-6f7c-439b-c865-d34adaf15d1d', 1357800, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-1595d9f1-dec9-023c-ab53-ab1d21db16b3', N'amazon-berkeley-objects', N'1595d9f1-dec9-023c-ab53-ab1d21db16b3', N'Dép nữ quai mảnh màu vàng', N'Trang phục', 81125000, N'Dép nữ quai mảnh màu vàng.

Thương hiệu: Amazon Essentials.
Mã hoặc tên mẫu: Shogun.
Năm mẫu: 2018.
Chiều cao: 25,53 cm.
Chiều dài: 18,62 cm.
Chiều rộng: 3,02 cm.', N'/products/ai-generated-500/0198-abo-more-1595d9f1-dec9-023c-ab53-ab1d21db16b3.webp', N'["N\u0103m m\u1EABu: 2018","Chi\u1EC1u cao: 25,53 cm","Chi\u1EC1u d\u00E0i: 18,62 cm","Chi\u1EC1u r\u1ED9ng: 3,02 cm"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/1595d9f1-dec9-023c-ab53-ab1d21db16b3', 324500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-160fb9e1-c652-5239-ec18-033bfeb3f0ef', N'amazon-berkeley-objects', N'160fb9e1-c652-5239-ec18-033bfeb3f0ef', N'Viên nang mềm bổ sung dưỡng chất', N'Làm đẹp', 498275000, N'Viên nang mềm bổ sung dưỡng chất.

Thương hiệu: Vita Essentials.
Chiều cao: 22,86 cm.
Chiều dài: 12,70 cm.
Chiều rộng: 17,78 cm.
Thành phần theo nguồn: Lecithin 1200 mg. Quy cách theo nguồn: 240 viên nang mềm.', N'/products/ai-generated-500/0072-abo-more-160fb9e1-c652-5239-ec18-033bfeb3f0ef.webp', N'["Chi\u1EC1u cao: 22,86 cm","Chi\u1EC1u d\u00E0i: 12,70 cm","Chi\u1EC1u r\u1ED9ng: 17,78 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/160fb9e1-c652-5239-ec18-033bfeb3f0ef', 1993100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-16300a6a-52d9-eb5b-c244-f1ebae36fe5a', N'amazon-berkeley-objects', N'16300a6a-52d9-eb5b-c244-f1ebae36fe5a', N'Cuộn giấy nhôm bọc thực phẩm', N'Làm đẹp', 267775000, N'Cuộn giấy nhôm bọc thực phẩm.

Thương hiệu: Amazon Brand - Solimo.
Kiểu dáng: Mẫu mới.
Khối lượng: 0,50 kg.
Chiều cao: 5,70 cm.
Chiều dài: 31,50 cm.
Chiều rộng: 5,70 cm.', N'/products/ai-generated-500/0077-abo-more-16300a6a-52d9-eb5b-c244-f1ebae36fe5a.webp', N'["Ki\u1EC3u d\u00E1ng: M\u1EABu m\u1EDBi","Kh\u1ED1i l\u01B0\u1EE3ng: 0,50 kg","Chi\u1EC1u cao: 5,70 cm","Chi\u1EC1u d\u00E0i: 31,50 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/16300a6a-52d9-eb5b-c244-f1ebae36fe5a', 1071100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-173633e9-6fb6-b9c3-60d1-9fe8b6a0b456', N'amazon-berkeley-objects', N'173633e9-6fb6-b9c3-60d1-9fe8b6a0b456', N'Gối tựa dài có quả bông trang trí', N'Trang sức', 288300000, N'Gối tựa dài có quả bông trang trí.

Thương hiệu: Stone & Beam.
Mã hoặc tên mẫu: 111683.
Chiều cao: 10,16 cm.
Chiều dài: 60,96 cm.
Chiều rộng: 30,48 cm.', N'/products/ai-generated-500/0174-abo-more-173633e9-6fb6-b9c3-60d1-9fe8b6a0b456.webp', N'["Chi\u1EC1u cao: 10,16 cm","Chi\u1EC1u d\u00E0i: 60,96 cm","Chi\u1EC1u r\u1ED9ng: 30,48 cm"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/173633e9-6fb6-b9c3-60d1-9fe8b6a0b456', 1153200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-1800d1df-fec8-2da5-1ab1-fb09b6c5d5be', N'amazon-berkeley-objects', N'1800d1df-fec8-2da5-1ab1-fb09b6c5d5be', N'Nhẫn bạc mạ bạch kim kiểu đan vòng', N'Trang sức', 268625000, N'Nhẫn bạc mạ bạch kim kiểu đan vòng.

Thương hiệu: Amazon Collection.', N'/products/ai-generated-500/0182-abo-more-1800d1df-fec8-2da5-1ab1-fb09b6c5d5be.webp', N'["Nh\u1EABn b\u1EA1c m\u1EA1 b\u1EA1ch kim ki\u1EC3u \u0111an v\u00F2ng"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/1800d1df-fec8-2da5-1ab1-fb09b6c5d5be', 1074500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-1871f308-dbe8-db84-bfa3-baa1b8644386', N'amazon-berkeley-objects', N'1871f308-dbe8-db84-bfa3-baa1b8644386', N'Nhẫn bạc đính kim cương ba hàng', N'Trang sức', 380275000, N'Nhẫn bạc đính kim cương ba hàng.

Thương hiệu: Amazon Collection.
Mã hoặc tên mẫu: 83626/STGSIL/DS/US8.
Màu sắc: Trắng.
Chất liệu: Kim loại.
Khối lượng: 0,01 kg.', N'/products/ai-generated-500/0186-abo-more-1871f308-dbe8-db84-bfa3-baa1b8644386.webp', N'["M\u00E0u s\u1EAFc: Tr\u1EAFng","Ch\u1EA5t li\u1EC7u: Kim lo\u1EA1i","Kh\u1ED1i l\u01B0\u1EE3ng: 0,01 kg"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/1871f308-dbe8-db84-bfa3-baa1b8644386', 1521100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-1905d94f-eb96-28ef-47e2-d53c97a105c5', N'amazon-berkeley-objects', N'1905d94f-eb96-28ef-47e2-d53c97a105c5', N'Giày bé gái quai cài họa tiết bướm màu đen', N'Trang phục', 178950000, N'Giày bé gái quai cài họa tiết bướm màu đen.

Thương hiệu: Red Wagon.
Mã hoặc tên mẫu: K0119.
Màu sắc: Đen.
Năm mẫu: 2017.', N'/products/ai-generated-500/0223-abo-more-1905d94f-eb96-28ef-47e2-d53c97a105c5.webp', N'["M\u00E0u s\u1EAFc: \u0110en","N\u0103m m\u1EABu: 2017"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/1905d94f-eb96-28ef-47e2-d53c97a105c5', 715800, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-194cb1c1-23a0-f52d-7b2f-ff7446744913', N'amazon-berkeley-objects', N'194cb1c1-23a0-f52d-7b2f-ff7446744913', N'Mũ len nữ lót nỉ màu xanh đậm', N'Trang sức', 225625000, N'Mũ len nữ lót nỉ màu xanh đậm.

Thương hiệu: Jeff & Aimy.
Mã hoặc tên mẫu: CMJ&A89220-2.', N'/products/ai-generated-500/0192-abo-more-194cb1c1-23a0-f52d-7b2f-ff7446744913.webp', N'["M\u0169 len n\u1EEF l\u00F3t n\u1EC9 m\u00E0u xanh \u0111\u1EADm"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/194cb1c1-23a0-f52d-7b2f-ff7446744913', 902500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-19dd6acf-91a7-d6f8-3e95-16f6be9e0686', N'amazon-berkeley-objects', N'19dd6acf-91a7-d6f8-3e95-16f6be9e0686', N'Nhẫn mạ bạch kim đính đá tròn và chữ nhật', N'Trang sức', 284325000, N'Nhẫn mạ bạch kim đính đá tròn và chữ nhật.

Thương hiệu: Amazon Collection.', N'/products/ai-generated-500/0194-abo-more-19dd6acf-91a7-d6f8-3e95-16f6be9e0686.webp', N'["Nh\u1EABn m\u1EA1 b\u1EA1ch kim \u0111\u00EDnh \u0111\u00E1 tr\u00F2n v\u00E0 ch\u1EEF nh\u1EADt"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/19dd6acf-91a7-d6f8-3e95-16f6be9e0686', 1137300, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-1aaeb292-08dc-9b8d-8eef-94b8d4649ad3', N'amazon-berkeley-objects', N'1aaeb292-08dc-9b8d-8eef-94b8d4649ad3', N'Khăn lụa cài túi áo màu xanh nhạt', N'Trang sức', 420925000, N'Khăn lụa cài túi áo màu xanh nhạt.

Thương hiệu: Buttoned Down.
Mã hoặc tên mẫu: MBD0003.', N'/products/ai-generated-500/0199-abo-more-1aaeb292-08dc-9b8d-8eef-94b8d4649ad3.webp', N'["Kh\u0103n l\u1EE5a c\u00E0i t\u00FAi \u00E1o m\u00E0u xanh nh\u1EA1t"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/1aaeb292-08dc-9b8d-8eef-94b8d4649ad3', 1683700, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-1b7ef773-1dd5-fca5-14c2-14b0e5605c11', N'amazon-berkeley-objects', N'1b7ef773-1dd5-fca5-14c2-14b0e5605c11', N'Dao cạo nữ năm lưỡi kèm bốn đầu thay', N'Làm đẹp', 233600000, N'Dao cạo nữ năm lưỡi kèm bốn đầu thay.

Thương hiệu: Solimo.
Mã hoặc tên mẫu: V301479100.
Chiều cao: 2,20 cm.
Chiều dài: 15,50 cm.
Chiều rộng: 23,40 cm.', N'/products/ai-generated-500/0099-abo-more-1b7ef773-1dd5-fca5-14c2-14b0e5605c11.webp', N'["Chi\u1EC1u cao: 2,20 cm","Chi\u1EC1u d\u00E0i: 15,50 cm","Chi\u1EC1u r\u1ED9ng: 23,40 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/1b7ef773-1dd5-fca5-14c2-14b0e5605c11', 934400, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-1c6d3698-d1d3-7c7d-2c55-9ec94b2849ee', N'amazon-berkeley-objects', N'1c6d3698-d1d3-7c7d-2c55-9ec94b2849ee', N'Bông tai bạc tròn chạm họa tiết tỏa sáng', N'Trang sức', 511750000, N'Bông tai bạc tròn chạm họa tiết tỏa sáng.

Thương hiệu: Amazon Collection.
Mã hoặc tên mẫu: T3020660.
Chất liệu: Kim loại.
Chiều cao: 1,78 cm.
Chiều dài: 12,70 cm.
Chiều rộng: 12,70 cm.', N'/products/ai-generated-500/0202-abo-more-1c6d3698-d1d3-7c7d-2c55-9ec94b2849ee.webp', N'["Ch\u1EA5t li\u1EC7u: Kim lo\u1EA1i","Chi\u1EC1u cao: 1,78 cm","Chi\u1EC1u d\u00E0i: 12,70 cm","Chi\u1EC1u r\u1ED9ng: 12,70 cm"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/1c6d3698-d1d3-7c7d-2c55-9ec94b2849ee', 2047000, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-1c7ff89d-544e-4830-1c58-ad6a6224a961', N'amazon-berkeley-objects', N'1c7ff89d-544e-4830-1c58-ad6a6224a961', N'Vòng tay bạc dạng kiềng hở', N'Trang sức', 501525000, N'Vòng tay bạc dạng kiềng hở.

Thương hiệu: Amazon Collection.
Mã hoặc tên mẫu: 536916.
Màu sắc: Bạc.
Chất liệu: Kim loại.
Khối lượng: 0,01 kg.
Chiều cao: 1,78 cm.
Chiều dài: 12,70 cm.
Chiều rộng: 12,70 cm.', N'/products/ai-generated-500/0206-abo-more-1c7ff89d-544e-4830-1c58-ad6a6224a961.webp', N'["M\u00E0u s\u1EAFc: B\u1EA1c","Ch\u1EA5t li\u1EC7u: Kim lo\u1EA1i","Kh\u1ED1i l\u01B0\u1EE3ng: 0,01 kg","Chi\u1EC1u cao: 1,78 cm"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/1c7ff89d-544e-4830-1c58-ad6a6224a961', 2006100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-1d9f372a-e6c2-8e39-704b-8e7bdd8e8fa4', N'amazon-berkeley-objects', N'1d9f372a-e6c2-8e39-704b-8e7bdd8e8fa4', N'Thắt lưng nam bề mặt vân da', N'Trang sức', 616950000, N'Thắt lưng nam bề mặt vân da.

Thương hiệu: find..
Mã hoặc tên mẫu: 171036-UN-995.
Chất liệu: Da.', N'/products/ai-generated-500/0210-abo-more-1d9f372a-e6c2-8e39-704b-8e7bdd8e8fa4.webp', N'["Ch\u1EA5t li\u1EC7u: Da"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/1d9f372a-e6c2-8e39-704b-8e7bdd8e8fa4', 2467800, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-1db5967e-40ba-e379-d759-f03b5eac7274', N'amazon-berkeley-objects', N'1db5967e-40ba-e379-d759-f03b5eac7274', N'Giày bốt nữ cao quá gối màu đen', N'Trang phục', 273475000, N'Giày bốt nữ cao quá gối màu đen.

Thương hiệu: The Fix.
Mã hoặc tên mẫu: Mia.
Năm mẫu: 2017.', N'/products/ai-generated-500/0245-abo-more-1db5967e-40ba-e379-d759-f03b5eac7274.webp', N'["N\u0103m m\u1EABu: 2017"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/1db5967e-40ba-e379-d759-f03b5eac7274', 1093900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-1e4b63cb-de4f-ce84-2b53-edb81d994d86', N'amazon-berkeley-objects', N'1e4b63cb-de4f-ce84-2b53-edb81d994d86', N'Giày lười nam công sở', N'Trang phục', 424025000, N'Giày lười nam công sở.

Thương hiệu: find..
Mã hoặc tên mẫu: Mocassino Uomo.
Kiểu dáng: Giày xỏ chân.', N'/products/ai-generated-500/0249-abo-more-1e4b63cb-de4f-ce84-2b53-edb81d994d86.webp', N'["Ki\u1EC3u d\u00E1ng: Gi\u00E0y x\u1ECF ch\u00E2n"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/1e4b63cb-de4f-ce84-2b53-edb81d994d86', 1696100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-1e6db8ca-2199-cb0b-7dfe-0e8c02bd80b8', N'amazon-berkeley-objects', N'1e6db8ca-2199-cb0b-7dfe-0e8c02bd80b8', N'Dây chuyền bạc chữ Y hình sao và trăng', N'Trang sức', 256250000, N'Dây chuyền bạc chữ Y hình sao và trăng.

Thương hiệu: Amazon Collection.
Mã hoặc tên mẫu: 461508.
Khối lượng: 0,00 kg.', N'/products/ai-generated-500/0213-abo-more-1e6db8ca-2199-cb0b-7dfe-0e8c02bd80b8.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,00 kg"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/1e6db8ca-2199-cb0b-7dfe-0e8c02bd80b8', 1025000, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-1f3261f0-ce49-1bb2-aea3-c342bccc27bc', N'amazon-berkeley-objects', N'1f3261f0-ce49-1bb2-aea3-c342bccc27bc', N'Bông tai ngọc trai nước ngọt đính đá', N'Trang sức', 477200000, N'Bông tai ngọc trai nước ngọt đính đá.

Thương hiệu: Amazon Collection.
Mã hoặc tên mẫu: SM7327PF2SZW-AM.', N'/products/ai-generated-500/0215-abo-more-1f3261f0-ce49-1bb2-aea3-c342bccc27bc.webp', N'["B\u00F4ng tai ng\u1ECDc trai n\u01B0\u1EDBc ng\u1ECDt \u0111\u00EDnh \u0111\u00E1"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/1f3261f0-ce49-1bb2-aea3-c342bccc27bc', 1908800, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-2089db13-9682-87d9-9b1f-e5b69e801555', N'amazon-berkeley-objects', N'2089db13-9682-87d9-9b1f-e5b69e801555', N'Viên bổ sung canxi và magiê', N'Làm đẹp', 450175000, N'Viên bổ sung canxi và magiê.

Thương hiệu: 365 by Whole Foods Market.
Mã hoặc tên mẫu: 228695.', N'/products/ai-generated-500/0109-abo-more-2089db13-9682-87d9-9b1f-e5b69e801555.webp', N'["Vi\u00EAn b\u1ED5 sung canxi v\u00E0 magi\u00EA"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/2089db13-9682-87d9-9b1f-e5b69e801555', 1800700, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-217c6e57-6bfb-8629-ec15-9a934c0a9e4f', N'amazon-berkeley-objects', N'217c6e57-6bfb-8629-ec15-9a934c0a9e4f', N'Đầu giường bọc nệm họa tiết xương cá', N'Trang sức', 489675000, N'Đầu giường bọc nệm họa tiết xương cá.

Thương hiệu: Stone & Beam.
Mã hoặc tên mẫu: Bridgewater Queen.
Chất liệu: Vải sợi tổng hợp pha lanh, mút đệm và khung gỗ ép.
Kiểu dáng: Đầu giường.
Khối lượng: 29,94 kg.
Chiều cao: 142,24 cm.
Chiều dài: 167,64 cm.
Chiều rộng: 10,16 cm.', N'/products/ai-generated-500/0229-abo-more-217c6e57-6bfb-8629-ec15-9a934c0a9e4f.webp', N'["Ch\u1EA5t li\u1EC7u: V\u1EA3i s\u1EE3i t\u1ED5ng h\u1EE3p pha lanh, m\u00FAt \u0111\u1EC7m v\u00E0 khung g\u1ED7 \u00E9p","Ki\u1EC3u d\u00E1ng: \u0110\u1EA7u gi\u01B0\u1EDDng","Kh\u1ED1i l\u01B0\u1EE3ng: 29,94 kg","Chi\u1EC1u cao: 142,24 cm"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/217c6e57-6bfb-8629-ec15-9a934c0a9e4f', 1958700, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-21d37bc0-5f1e-0bd2-9589-c084fc077d7f', N'amazon-berkeley-objects', N'21d37bc0-5f1e-0bd2-9589-c084fc077d7f', N'Giày nữ màu be', N'Trang phục', 95075000, N'Giày nữ màu be.

Thương hiệu: find..
Mã hoặc tên mẫu: SHANA-1A-58.
Năm mẫu: 2019.', N'/products/ai-generated-500/0261-abo-more-21d37bc0-5f1e-0bd2-9589-c084fc077d7f.webp', N'["N\u0103m m\u1EABu: 2019"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/21d37bc0-5f1e-0bd2-9589-c084fc077d7f', 380300, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-22963340-d0c2-9f06-a605-129feb2b8569', N'amazon-berkeley-objects', N'22963340-d0c2-9f06-a605-129feb2b8569', N'Giày bốt cổ ngắn đế cao su màu nâu', N'Trang phục', 377450000, N'Giày bốt cổ ngắn đế cao su màu nâu.

Thương hiệu: find..
Mã hoặc tên mẫu: 119AL0232.
Kiểu dáng: Giày bốt.
Năm mẫu: 2019.', N'/products/ai-generated-500/0274-abo-more-22963340-d0c2-9f06-a605-129feb2b8569.webp', N'["Ki\u1EC3u d\u00E1ng: Gi\u00E0y b\u1ED1t","N\u0103m m\u1EABu: 2019"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/22963340-d0c2-9f06-a605-129feb2b8569', 1509800, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-23346f6a-53b2-b306-64c8-5817cba21378', N'amazon-berkeley-objects', N'23346f6a-53b2-b306-64c8-5817cba21378', N'Bộ nhẫn bạc mạ bạch kim đính đá tròn', N'Trang sức', 342725000, N'Bộ nhẫn bạc mạ bạch kim đính đá tròn.

Thương hiệu: Amazon Collection.
Mã hoặc tên mẫu: R2973302_120_Blue7.
Khối lượng: 0,02 kg.', N'/products/ai-generated-500/0238-abo-more-23346f6a-53b2-b306-64c8-5817cba21378.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,02 kg"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/23346f6a-53b2-b306-64c8-5817cba21378', 1370900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-23a40f2f-fc71-11b5-8c34-596e14684702', N'amazon-berkeley-objects', N'23a40f2f-fc71-11b5-8c34-596e14684702', N'Giày nam da lộn màu đen', N'Trang phục', 313600000, N'Giày nam da lộn màu đen.

Thương hiệu: find..
Mã hoặc tên mẫu: ABBOTT.
Năm mẫu: 2019.', N'/products/ai-generated-500/0276-abo-more-23a40f2f-fc71-11b5-8c34-596e14684702.webp', N'["N\u0103m m\u1EABu: 2019"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/23a40f2f-fc71-11b5-8c34-596e14684702', 1254400, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-2400544a-1cda-dff3-ccd6-bc542050bc64', N'amazon-berkeley-objects', N'2400544a-1cda-dff3-ccd6-bc542050bc64', N'Thắt lưng nâu điều chỉnh được khóa bo tròn', N'Trang sức', 299450000, N'Thắt lưng nâu điều chỉnh được khóa bo tròn.

Thương hiệu: Amazon Essentials.
Mã hoặc tên mẫu: 13EZ120001.
Màu sắc: Nâu.', N'/products/ai-generated-500/0246-abo-more-2400544a-1cda-dff3-ccd6-bc542050bc64.webp', N'["M\u00E0u s\u1EAFc: N\u00E2u"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/2400544a-1cda-dff3-ccd6-bc542050bc64', 1197800, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-249773bb-d820-1d0a-1723-5c5342b4b5d4', N'amazon-berkeley-objects', N'249773bb-d820-1d0a-1723-5c5342b4b5d4', N'Dép nữ màu da', N'Trang sức', 68450000, N'Dép nữ màu da.

Thương hiệu: Flavia.
Mã hoặc tên mẫu: FL/245/NUD.
Chất liệu: Vật liệu tổng hợp.
Kiểu dáng: Quai cổ chân.', N'/products/ai-generated-500/0250-abo-more-249773bb-d820-1d0a-1723-5c5342b4b5d4.webp', N'["Ch\u1EA5t li\u1EC7u: V\u1EADt li\u1EC7u t\u1ED5ng h\u1EE3p","Ki\u1EC3u d\u00E1ng: Quai c\u1ED5 ch\u00E2n"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/249773bb-d820-1d0a-1723-5c5342b4b5d4', 273800, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-24d04d14-0c55-63ca-fe8c-a350b7c529db', N'amazon-berkeley-objects', N'24d04d14-0c55-63ca-fe8c-a350b7c529db', N'Giày buộc dây nam màu nâu sô cô la', N'Trang phục', 340900000, N'Giày buộc dây nam màu nâu sô cô la.

Thương hiệu: find..
Mã hoặc tên mẫu: Acton.
Năm mẫu: 2019.', N'/products/ai-generated-500/0279-abo-more-24d04d14-0c55-63ca-fe8c-a350b7c529db.webp', N'["N\u0103m m\u1EABu: 2019"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/24d04d14-0c55-63ca-fe8c-a350b7c529db', 1363600, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-250d49b6-b50d-8e70-449f-1b9532c7a41c', N'amazon-berkeley-objects', N'250d49b6-b50d-8e70-449f-1b9532c7a41c', N'Dép quai hậu nam màu đỏ sẫm', N'Trang phục', 74825000, N'Dép quai hậu nam màu đỏ sẫm.

Thương hiệu: Amazon Brand - Symbol.
Mã hoặc tên mẫu: AZ-KY-329B.
Chất liệu: Vật liệu tổng hợp.', N'/products/ai-generated-500/0284-abo-more-250d49b6-b50d-8e70-449f-1b9532c7a41c.webp', N'["Ch\u1EA5t li\u1EC7u: V\u1EADt li\u1EC7u t\u1ED5ng h\u1EE3p"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/250d49b6-b50d-8e70-449f-1b9532c7a41c', 299300, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-25264487-0018-60da-b89f-fe74935d1d1e', N'amazon-berkeley-objects', N'25264487-0018-60da-b89f-fe74935d1d1e', N'Giày bốt cổ chân màu đen', N'Trang phục', 302075000, N'Giày bốt cổ chân màu đen.

Thương hiệu: find..
Mã hoặc tên mẫu: Marco-03w4-002.
Kiểu dáng: Giày bốt cổ chân.
Năm mẫu: 2020.', N'/products/ai-generated-500/0286-abo-more-25264487-0018-60da-b89f-fe74935d1d1e.webp', N'["Ki\u1EC3u d\u00E1ng: Gi\u00E0y b\u1ED1t c\u1ED5 ch\u00E2n","N\u0103m m\u1EABu: 2020"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/25264487-0018-60da-b89f-fe74935d1d1e', 1208300, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-25c44f50-21e1-0580-2db3-90f93b220a93', N'amazon-berkeley-objects', N'25c44f50-21e1-0580-2db3-90f93b220a93', N'Giày cao gót nữ mũi nhọn phom rộng màu be', N'Trang phục', 97750000, N'Giày cao gót nữ mũi nhọn phom rộng màu be.

Thương hiệu: find..
Mã hoặc tên mẫu: DUBAI-W-2-17.
Màu sắc: Be.
Năm mẫu: 2019.', N'/products/ai-generated-500/0289-abo-more-25c44f50-21e1-0580-2db3-90f93b220a93.webp', N'["M\u00E0u s\u1EAFc: Be","N\u0103m m\u1EABu: 2019"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/25c44f50-21e1-0580-2db3-90f93b220a93', 391000, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-25f49ada-168e-f2ec-f0c7-ffecbc1a4679', N'amazon-berkeley-objects', N'25f49ada-168e-f2ec-f0c7-ffecbc1a4679', N'Nhẫn đính đá hình trái tim', N'Trang sức', 70225000, N'Nhẫn đính đá hình trái tim.

Thương hiệu: Amazon Collection.
Mã hoặc tên mẫu: 50767RDR-070.
Màu sắc: Hồng.
Chất liệu: Không áp dụng.
Khối lượng: 0,02 kg.', N'/products/ai-generated-500/0255-abo-more-25f49ada-168e-f2ec-f0c7-ffecbc1a4679.webp', N'["M\u00E0u s\u1EAFc: H\u1ED3ng","Ch\u1EA5t li\u1EC7u: Kh\u00F4ng \u00E1p d\u1EE5ng","Kh\u1ED1i l\u01B0\u1EE3ng: 0,02 kg"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/25f49ada-168e-f2ec-f0c7-ffecbc1a4679', 280900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-2688e791-f131-0367-c5b8-96cfba873aee', N'amazon-berkeley-objects', N'2688e791-f131-0367-c5b8-96cfba873aee', N'Bộ mũ và khăn len nam màu xanh', N'Trang sức', 283875000, N'Bộ mũ và khăn len nam màu xanh.

Thương hiệu: Thirty Five Kent.', N'/products/ai-generated-500/0262-abo-more-2688e791-f131-0367-c5b8-96cfba873aee.webp', N'["B\u1ED9 m\u0169 v\u00E0 kh\u0103n len nam m\u00E0u xanh"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/2688e791-f131-0367-c5b8-96cfba873aee', 1135500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-26ce5532-7f72-64d8-837c-488bb43f88f8', N'amazon-berkeley-objects', N'26ce5532-7f72-64d8-837c-488bb43f88f8', N'Nơ lụa nam màu tím', N'Trang sức', 34050000, N'Nơ lụa nam màu tím.

Thương hiệu: Franklin Tailored.
Mã hoặc tên mẫu: 3441.', N'/products/ai-generated-500/0264-abo-more-26ce5532-7f72-64d8-837c-488bb43f88f8.webp', N'["N\u01A1 l\u1EE5a nam m\u00E0u t\u00EDm"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/26ce5532-7f72-64d8-837c-488bb43f88f8', 136200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-27274d70-ca1e-aee5-a621-f7ec04e1fe47', N'amazon-berkeley-objects', N'27274d70-ca1e-aee5-a621-f7ec04e1fe47', N'Viên nang bổ sung axít béo liên hợp', N'Làm đẹp', 338750000, N'Viên nang bổ sung axít béo liên hợp.

Thương hiệu: OWN PWR.
Mã hoặc tên mẫu: 842379145407.
Khối lượng: 0,11 kg.
Chiều cao: 11,11 cm.
Chiều dài: 6,39 cm.
Chiều rộng: 6,39 cm.', N'/products/ai-generated-500/0114-abo-more-27274d70-ca1e-aee5-a621-f7ec04e1fe47.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,11 kg","Chi\u1EC1u cao: 11,11 cm","Chi\u1EC1u d\u00E0i: 6,39 cm","Chi\u1EC1u r\u1ED9ng: 6,39 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/27274d70-ca1e-aee5-a621-f7ec04e1fe47', 1355000, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-279aaa0f-68b0-c8f2-e8c0-bed5c802b6df', N'amazon-berkeley-objects', N'279aaa0f-68b0-c8f2-e8c0-bed5c802b6df', N'Giày tây nam buộc dây màu đen', N'Trang phục', 354325000, N'Giày tây nam buộc dây màu đen.

Thương hiệu: Amazon Brand - Symbol.
Màu sắc: Đen.
Chất liệu: Vật liệu tổng hợp.', N'/products/ai-generated-500/0298-abo-more-279aaa0f-68b0-c8f2-e8c0-bed5c802b6df.webp', N'["M\u00E0u s\u1EAFc: \u0110en","Ch\u1EA5t li\u1EC7u: V\u1EADt li\u1EC7u t\u1ED5ng h\u1EE3p"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/279aaa0f-68b0-c8f2-e8c0-bed5c802b6df', 1417300, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-27fa4bfc-d96b-ce4c-d555-d07597325436', N'amazon-berkeley-objects', N'27fa4bfc-d96b-ce4c-d555-d07597325436', N'Dép nữ bít mũi', N'Trang phục', 69375000, N'Dép nữ bít mũi.

Thương hiệu: find..
Mã hoặc tên mẫu: Darling 1w3.', N'/products/ai-generated-500/0302-abo-more-27fa4bfc-d96b-ce4c-d555-d07597325436.webp', N'["D\u00E9p n\u1EEF b\u00EDt m\u0169i"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/27fa4bfc-d96b-ce4c-d555-d07597325436', 277500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-28d92836-624b-1921-cce5-5fe97f4017cc', N'amazon-berkeley-objects', N'28d92836-624b-1921-cce5-5fe97f4017cc', N'Bộ nước súc miệng trẻ em và túi đựng bánh', N'Làm đẹp', 265100000, N'Bộ nước súc miệng trẻ em và túi đựng bánh.

Thương hiệu: Solimo.', N'/products/ai-generated-500/0118-abo-more-28d92836-624b-1921-cce5-5fe97f4017cc.webp', N'["B\u1ED9 n\u01B0\u1EDBc s\u00FAc mi\u1EC7ng tr\u1EBB em v\u00E0 t\u00FAi \u0111\u1EF1ng b\u00E1nh"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/28d92836-624b-1921-cce5-5fe97f4017cc', 1060400, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-2924b98f-2e99-ad32-b2d7-9ddf54e75768', N'amazon-berkeley-objects', N'2924b98f-2e99-ad32-b2d7-9ddf54e75768', N'Vòng tay mạ bạc đính đá dây rút xám', N'Trang sức', 139800000, N'Vòng tay mạ bạc đính đá dây rút xám.

Thương hiệu: Amazon Collection.
Mã hoặc tên mẫu: 545868.', N'/products/ai-generated-500/0269-abo-more-2924b98f-2e99-ad32-b2d7-9ddf54e75768.webp', N'["V\u00F2ng tay m\u1EA1 b\u1EA1c \u0111\u00EDnh \u0111\u00E1 d\u00E2y r\u00FAt x\u00E1m"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/2924b98f-2e99-ad32-b2d7-9ddf54e75768', 559200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-29648298-796b-0899-6247-e323f1e9150b', N'amazon-berkeley-objects', N'29648298-796b-0899-6247-e323f1e9150b', N'Dầu gội chăm sóc da đầu có gàu', N'Làm đẹp', 188575000, N'Dầu gội chăm sóc da đầu có gàu.

Thương hiệu: Solimo.
Khối lượng: 0,00 kg.
Chiều cao: 21,29 cm.
Chiều dài: 4,47 cm.
Chiều rộng: 7,80 cm.', N'/products/ai-generated-500/0122-abo-more-29648298-796b-0899-6247-e323f1e9150b.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,00 kg","Chi\u1EC1u cao: 21,29 cm","Chi\u1EC1u d\u00E0i: 4,47 cm","Chi\u1EC1u r\u1ED9ng: 7,80 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/29648298-796b-0899-6247-e323f1e9150b', 754300, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-2a02800b-670a-0bb8-ee03-2f01f786aad0', N'amazon-berkeley-objects', N'2a02800b-670a-0bb8-ee03-2f01f786aad0', N'Dép nam lót lông họa tiết ô xanh', N'Trang phục', 90625000, N'Dép nam lót lông họa tiết ô xanh.

Thương hiệu: 206 Collective.
Mã hoặc tên mẫu: Union.
Khối lượng: 0,33 kg.', N'/products/ai-generated-500/0310-abo-more-2a02800b-670a-0bb8-ee03-2f01f786aad0.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,33 kg"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/2a02800b-670a-0bb8-ee03-2f01f786aad0', 362500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-2a5e6012-abec-1f77-136a-e5bc11f522e1', N'amazon-berkeley-objects', N'2a5e6012-abec-1f77-136a-e5bc11f522e1', N'Trạm hàn điện điều khiển kỹ thuật số', N'Trang sức', 573150000, N'Trạm hàn điện điều khiển kỹ thuật số.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: AMZ1803-US.
Khối lượng: 0,65 kg.
Chiều cao: 15,01 cm.
Chiều dài: 23,52 cm.
Chiều rộng: 8,51 cm.', N'/products/ai-generated-500/0283-abo-more-2a5e6012-abec-1f77-136a-e5bc11f522e1.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,65 kg","Chi\u1EC1u cao: 15,01 cm","Chi\u1EC1u d\u00E0i: 23,52 cm","Chi\u1EC1u r\u1ED9ng: 8,51 cm"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/2a5e6012-abec-1f77-136a-e5bc11f522e1', 2292600, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-2a7548e9-c89e-73f0-fdea-c1c6c09af03a', N'amazon-berkeley-objects', N'2a7548e9-c89e-73f0-fdea-c1c6c09af03a', N'Bộ năm túi chườm dạng gel có mặt vải', N'Làm đẹp', 116700000, N'Bộ năm túi chườm dạng gel có mặt vải.

Thương hiệu: Everone.
Mã hoặc tên mẫu: EVOGP01.
Khối lượng: 0,00 kg.
Chiều cao: 0,51 cm.
Chiều dài: 10,16 cm.
Chiều rộng: 10,16 cm.', N'/products/ai-generated-500/0127-abo-more-2a7548e9-c89e-73f0-fdea-c1c6c09af03a.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,00 kg","Chi\u1EC1u cao: 0,51 cm","Chi\u1EC1u d\u00E0i: 10,16 cm","Chi\u1EC1u r\u1ED9ng: 10,16 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/2a7548e9-c89e-73f0-fdea-c1c6c09af03a', 466800, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-2b87f31a-8958-6ea6-88fa-ab113a78d968', N'amazon-berkeley-objects', N'2b87f31a-8958-6ea6-88fa-ab113a78d968', N'Giày thể thao trẻ em buộc dây xám xanh', N'Trang sức', 221000000, N'Giày thể thao trẻ em buộc dây xám xanh.

Thương hiệu: Concept 3 by Skechers.
Mã hoặc tên mẫu: Concept 3 Splender-Top.', N'/products/ai-generated-500/0285-abo-more-2b87f31a-8958-6ea6-88fa-ab113a78d968.webp', N'["Gi\u00E0y th\u1EC3 thao tr\u1EBB em bu\u1ED9c d\u00E2y x\u00E1m xanh"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/2b87f31a-8958-6ea6-88fa-ab113a78d968', 884000, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-2b9cc897-2e65-1fd2-9e94-132643670049', N'amazon-berkeley-objects', N'2b9cc897-2e65-1fd2-9e94-132643670049', N'Giày thể thao nữ buộc dây đen ánh hồng', N'Trang phục', 395100000, N'Giày thể thao nữ buộc dây đen ánh hồng.

Thương hiệu: Concept 3 by Skechers.
Mã hoặc tên mẫu: Concept 3 Beyond Fresh.', N'/products/ai-generated-500/0317-abo-more-2b9cc897-2e65-1fd2-9e94-132643670049.webp', N'["Gi\u00E0y th\u1EC3 thao n\u1EEF bu\u1ED9c d\u00E2y \u0111en \u00E1nh h\u1ED3ng"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/2b9cc897-2e65-1fd2-9e94-132643670049', 1580400, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-2d56e693-c0b0-751f-e4fe-47e93b014a8b', N'amazon-berkeley-objects', N'2d56e693-c0b0-751f-e4fe-47e93b014a8b', N'Giày cao gót nữ màu xanh bạc hà', N'Trang phục', 569850000, N'Giày cao gót nữ màu xanh bạc hà.

Thương hiệu: Blink.
Mã hoặc tên mẫu: Blink Bvayenl.
Năm mẫu: 2016.', N'/products/ai-generated-500/0327-abo-more-2d56e693-c0b0-751f-e4fe-47e93b014a8b.webp', N'["N\u0103m m\u1EABu: 2016"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/2d56e693-c0b0-751f-e4fe-47e93b014a8b', 2279400, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-2d7fadfe-7c34-1528-b4d4-f1517a5fce79', N'amazon-berkeley-objects', N'2d7fadfe-7c34-1528-b4d4-f1517a5fce79', N'Ốp điện thoại dẻo chống trầy họa tiết trang trí', N'Trang phục', 583800000, N'Ốp điện thoại dẻo chống trầy họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: SOLPOCOX2TPU0345.
Thiết bị tương thích: Poco X2 / Xiaomi Redmi K30.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0332-abo-more-2d7fadfe-7c34-1528-b4d4-f1517a5fce79.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Poco X2 / Xiaomi Redmi K30","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/2d7fadfe-7c34-1528-b4d4-f1517a5fce79', 2335200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-2db0a703-6d3c-2e44-86e4-c0f6a559bf1e', N'amazon-berkeley-objects', N'2db0a703-6d3c-2e44-86e4-c0f6a559bf1e', N'Dép xỏ ngón nữ màu nâu nhạt', N'Trang phục', 176175000, N'Dép xỏ ngón nữ màu nâu nhạt.

Thương hiệu: Belini.
Mã hoặc tên mẫu: BS147TAN3.
Kiểu dáng: Dép xỏ ngón.
Khối lượng: 0,37 kg.
Chiều cao: 10,80 cm.
Chiều dài: 72,00 cm.
Chiều rộng: 10,80 cm.', N'/products/ai-generated-500/0334-abo-more-2db0a703-6d3c-2e44-86e4-c0f6a559bf1e.webp', N'["Ki\u1EC3u d\u00E1ng: D\u00E9p x\u1ECF ng\u00F3n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,37 kg","Chi\u1EC1u cao: 10,80 cm","Chi\u1EC1u d\u00E0i: 72,00 cm"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/2db0a703-6d3c-2e44-86e4-c0f6a559bf1e', 704700, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-2ebcc0b7-5f34-9200-7764-58e11e04dcce', N'amazon-berkeley-objects', N'2ebcc0b7-5f34-9200-7764-58e11e04dcce', N'Giày thể thao nữ buộc dây màu trắng', N'Trang phục', 571025000, N'Giày thể thao nữ buộc dây màu trắng.

Thương hiệu: Amazon Essentials.
Mã hoặc tên mẫu: Shelly.', N'/products/ai-generated-500/0336-abo-more-2ebcc0b7-5f34-9200-7764-58e11e04dcce.webp', N'["Gi\u00E0y th\u1EC3 thao n\u1EEF bu\u1ED9c d\u00E2y m\u00E0u tr\u1EAFng"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/2ebcc0b7-5f34-9200-7764-58e11e04dcce', 2284100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-2f17c1d1-f0e8-62f0-dc50-7993a924db2f', N'amazon-berkeley-objects', N'2f17c1d1-f0e8-62f0-dc50-7993a924db2f', N'Khăn ống che mặt màu trắng', N'Trang phục', 190650000, N'Khăn ống che mặt màu trắng.

Thương hiệu: Gmall.
Mã hoặc tên mẫu: GAWB038V.', N'/products/ai-generated-500/0339-abo-more-2f17c1d1-f0e8-62f0-dc50-7993a924db2f.webp', N'["Kh\u0103n \u1ED1ng che m\u1EB7t m\u00E0u tr\u1EAFng"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/2f17c1d1-f0e8-62f0-dc50-7993a924db2f', 762600, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-2f68caa5-ccd5-b04b-633f-eabd9349f03c', N'amazon-berkeley-objects', N'2f68caa5-ccd5-b04b-633f-eabd9349f03c', N'Ốp điện thoại dẻo họa tiết giày thể thao', N'Trang phục', 108500000, N'Ốp điện thoại dẻo họa tiết giày thể thao.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10701-SL40769.
Thiết bị tương thích: Mobiistar C1 Lite.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0342-abo-more-2f68caa5-ccd5-b04b-633f-eabd9349f03c.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Mobiistar C1 Lite","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/2f68caa5-ccd5-b04b-633f-eabd9349f03c', 434000, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-2f8b08ed-4eb2-0ab4-f71c-30abf838e4d6', N'amazon-berkeley-objects', N'2f8b08ed-4eb2-0ab4-f71c-30abf838e4d6', N'Giày búp bê nữ màu đen', N'Trang phục', 165950000, N'Giày búp bê nữ màu đen.

Thương hiệu: Amazon Essentials.
Mã hoặc tên mẫu: Belice.
Năm mẫu: 2018.
Khối lượng: 0,10 kg.
Chiều cao: 1,78 cm.
Chiều dài: 12,70 cm.
Chiều rộng: 12,70 cm.', N'/products/ai-generated-500/0346-abo-more-2f8b08ed-4eb2-0ab4-f71c-30abf838e4d6.webp', N'["N\u0103m m\u1EABu: 2018","Kh\u1ED1i l\u01B0\u1EE3ng: 0,10 kg","Chi\u1EC1u cao: 1,78 cm","Chi\u1EC1u d\u00E0i: 12,70 cm"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/2f8b08ed-4eb2-0ab4-f71c-30abf838e4d6', 663800, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-2fca7f91-4418-d0b1-f016-5e9c01418169', N'amazon-berkeley-objects', N'2fca7f91-4418-d0b1-f016-5e9c01418169', N'Bộ mười hai đôi găng tay lao động màu xám', N'Trang phục', 57975000, N'Bộ mười hai đôi găng tay lao động màu xám.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: 60689-12.
Màu sắc: Xám.
Khối lượng: 0,03 kg.
Chiều cao: 8,50 cm.
Chiều dài: 25,00 cm.
Chiều rộng: 1,98 cm.', N'/products/ai-generated-500/0352-abo-more-2fca7f91-4418-d0b1-f016-5e9c01418169.webp', N'["M\u00E0u s\u1EAFc: X\u00E1m","Kh\u1ED1i l\u01B0\u1EE3ng: 0,03 kg","Chi\u1EC1u cao: 8,50 cm","Chi\u1EC1u d\u00E0i: 25,00 cm"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/2fca7f91-4418-d0b1-f016-5e9c01418169', 231900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-2ff1d3d3-448d-de65-96b0-94a3b85c13a3', N'amazon-berkeley-objects', N'2ff1d3d3-448d-de65-96b0-94a3b85c13a3', N'Giày búp bê nữ dệt kim xanh đậm', N'Trang phục', 579400000, N'Giày búp bê nữ dệt kim xanh đậm.

Thương hiệu: Amazon Essentials.
Mã hoặc tên mẫu: Belice.', N'/products/ai-generated-500/0356-abo-more-2ff1d3d3-448d-de65-96b0-94a3b85c13a3.webp', N'["Gi\u00E0y b\u00FAp b\u00EA n\u1EEF d\u1EC7t kim xanh \u0111\u1EADm"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/2ff1d3d3-448d-de65-96b0-94a3b85c13a3', 2317600, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-303997d2-c178-a5ce-2918-aa88a88f550b', N'amazon-berkeley-objects', N'303997d2-c178-a5ce-2918-aa88a88f550b', N'Tủ gỗ sáu ngăn kéo', N'Trang phục', 407550000, N'Tủ gỗ sáu ngăn kéo.

Thương hiệu: Rivet.
Mã hoặc tên mẫu: Stark.
Màu sắc: Nâu.
Chất liệu: Kim loại.
Kiểu dáng: Tủ ngăn kéo.
Khối lượng: 47,17 kg.
Chiều cao: 81,28 cm.
Chiều dài: 45,72 cm.
Chiều rộng: 154,94 cm.', N'/products/ai-generated-500/0361-abo-more-303997d2-c178-a5ce-2918-aa88a88f550b.webp', N'["M\u00E0u s\u1EAFc: N\u00E2u","Ch\u1EA5t li\u1EC7u: Kim lo\u1EA1i","Ki\u1EC3u d\u00E1ng: T\u1EE7 ng\u0103n k\u00E9o","Kh\u1ED1i l\u01B0\u1EE3ng: 47,17 kg"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/303997d2-c178-a5ce-2918-aa88a88f550b', 1630200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-3277c326-4fa6-84cc-b85f-540488e08751', N'amazon-berkeley-objects', N'3277c326-4fa6-84cc-b85f-540488e08751', N'Cuộn giấy nhôm bọc thực phẩm dài 20 mét', N'Làm đẹp', 505425000, N'Cuộn giấy nhôm bọc thực phẩm dài 20 mét.

Thương hiệu: Amazon Brand - Solimo.', N'/products/ai-generated-500/0136-abo-more-3277c326-4fa6-84cc-b85f-540488e08751.webp', N'["Cu\u1ED9n gi\u1EA5y nh\u00F4m b\u1ECDc th\u1EF1c ph\u1EA9m d\u00E0i 20 m\u00E9t"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/3277c326-4fa6-84cc-b85f-540488e08751', 2021700, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-32c630d1-4c10-3f5a-3347-9341f5e3611f', N'amazon-berkeley-objects', N'32c630d1-4c10-3f5a-3347-9341f5e3611f', N'Bộ dây chuyền và bông tai ngọc trai', N'Trang sức', 194150000, N'Bộ dây chuyền và bông tai ngọc trai.

Thương hiệu: AJC Collection(AJC.
Mã hoặc tên mẫu: BA93395PP.
Kiểu dáng: Theo bộ.
Khối lượng: 0,06 kg.', N'/products/ai-generated-500/0295-abo-more-32c630d1-4c10-3f5a-3347-9341f5e3611f.webp', N'["Ki\u1EC3u d\u00E1ng: Theo b\u1ED9","Kh\u1ED1i l\u01B0\u1EE3ng: 0,06 kg"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/32c630d1-4c10-3f5a-3347-9341f5e3611f', 776600, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-32e386f3-5f41-2d38-975b-2ab8caac372f', N'amazon-berkeley-objects', N'32e386f3-5f41-2d38-975b-2ab8caac372f', N'Giày búp bê bé gái màu vàng kim tuyến', N'Trang sức', 539250000, N'Giày búp bê bé gái màu vàng kim tuyến.

Thương hiệu: Amazon Essentials.
Mã hoặc tên mẫu: Belina.
Khối lượng: 0,11 kg.', N'/products/ai-generated-500/0299-abo-more-32e386f3-5f41-2d38-975b-2ab8caac372f.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,11 kg"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/32e386f3-5f41-2d38-975b-2ab8caac372f', 2157000, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-337667c0-b945-69ba-e1b2-d03168525f65', N'amazon-berkeley-objects', N'337667c0-b945-69ba-e1b2-d03168525f65', N'Thắt lưng nam tết co giãn màu nâu nhạt', N'Trang sức', 91875000, N'Thắt lưng nam tết co giãn màu nâu nhạt.

Thương hiệu: Amazon Essentials.
Mã hoặc tên mẫu: 11ET03XZ01.
Năm mẫu: 2018.', N'/products/ai-generated-500/0304-abo-more-337667c0-b945-69ba-e1b2-d03168525f65.webp', N'["N\u0103m m\u1EABu: 2018"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/337667c0-b945-69ba-e1b2-d03168525f65', 367500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-34387fd0-3c74-1490-6545-b6f90a0af115', N'amazon-berkeley-objects', N'34387fd0-3c74-1490-6545-b6f90a0af115', N'Ốp điện thoại dẻo kèm miếng bảo vệ màn hình', N'Trang sức', 367450000, N'Ốp điện thoại dẻo kèm miếng bảo vệ màn hình.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: IPH5060115WDB.
Chất liệu: Nhựa dẻo nhiệt.
Năm mẫu: 2013.
Khối lượng: 0,02 kg.
Chiều cao: 1,02 cm.
Chiều dài: 12,45 cm.
Chiều rộng: 6,10 cm.', N'/products/ai-generated-500/0306-abo-more-34387fd0-3c74-1490-6545-b6f90a0af115.webp', N'["Ch\u1EA5t li\u1EC7u: Nh\u1EF1a d\u1EBBo nhi\u1EC7t","N\u0103m m\u1EABu: 2013","Kh\u1ED1i l\u01B0\u1EE3ng: 0,02 kg","Chi\u1EC1u cao: 1,02 cm"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/34387fd0-3c74-1490-6545-b6f90a0af115', 1469800, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-343e68a5-d8ed-9016-d64a-dd425136c936', N'amazon-berkeley-objects', N'343e68a5-d8ed-9016-d64a-dd425136c936', N'Giày bốt nam cổ lửng cổ điển', N'Trang phục', 93975000, N'Giày bốt nam cổ lửng cổ điển.

Thương hiệu: find..
Mã hoặc tên mẫu: AMZ140 01.
Kiểu dáng: Giày bốt cổ lửng.
Năm mẫu: 2018.', N'/products/ai-generated-500/0371-abo-more-343e68a5-d8ed-9016-d64a-dd425136c936.webp', N'["Ki\u1EC3u d\u00E1ng: Gi\u00E0y b\u1ED1t c\u1ED5 l\u1EEDng","N\u0103m m\u1EABu: 2018"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/343e68a5-d8ed-9016-d64a-dd425136c936', 375900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-34a53e11-d94d-dd00-bcb1-38eaa585b765', N'amazon-berkeley-objects', N'34a53e11-d94d-dd00-bcb1-38eaa585b765', N'Đèn thả trần đá cẩm thạch kèm bóng', N'Trang sức', 605000000, N'Đèn thả trần đá cẩm thạch kèm bóng.

Thương hiệu: Rivet.
Mã hoặc tên mẫu: 22646-000.
Màu sắc: Trắng.
Chất liệu: Kim loại.
Khối lượng: 0,73 kg.
Chiều cao: 167,64 cm.
Chiều dài: 12,70 cm.
Chiều rộng: 12,70 cm.', N'/products/ai-generated-500/0307-abo-more-34a53e11-d94d-dd00-bcb1-38eaa585b765.webp', N'["M\u00E0u s\u1EAFc: Tr\u1EAFng","Ch\u1EA5t li\u1EC7u: Kim lo\u1EA1i","Kh\u1ED1i l\u01B0\u1EE3ng: 0,73 kg","Chi\u1EC1u cao: 167,64 cm"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/34a53e11-d94d-dd00-bcb1-38eaa585b765', 2420000, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-356ee44f-f980-cb2d-f91b-2dd43f55d975', N'amazon-berkeley-objects', N'356ee44f-f980-cb2d-f91b-2dd43f55d975', N'Bộ bảy yếm vải cho bé gái', N'Trang sức', 376050000, N'Bộ bảy yếm vải cho bé gái.

Thương hiệu: Simple Joys by Carter''s.
Mã hoặc tên mẫu: 1I565310.', N'/products/ai-generated-500/0312-abo-more-356ee44f-f980-cb2d-f91b-2dd43f55d975.webp', N'["B\u1ED9 b\u1EA3y y\u1EBFm v\u1EA3i cho b\u00E9 g\u00E1i"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/356ee44f-f980-cb2d-f91b-2dd43f55d975', 1504200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-35d4bc64-1380-e717-79f8-712bef273642', N'amazon-berkeley-objects', N'35d4bc64-1380-e717-79f8-712bef273642', N'Ví da nam mỏng chống quét thẻ màu nâu', N'Trang sức', 299225000, N'Ví da nam mỏng chống quét thẻ màu nâu.

Thương hiệu: Traversible.
Màu sắc: Nâu.', N'/products/ai-generated-500/0314-abo-more-35d4bc64-1380-e717-79f8-712bef273642.webp', N'["M\u00E0u s\u1EAFc: N\u00E2u"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/35d4bc64-1380-e717-79f8-712bef273642', 1196900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-36a913fe-8364-3973-4f5f-da1487663690', N'amazon-berkeley-objects', N'36a913fe-8364-3973-4f5f-da1487663690', N'Bông tai bạc mạ vàng hồng hình vòng tròn', N'Trang sức', 519525000, N'Bông tai bạc mạ vàng hồng hình vòng tròn.

Thương hiệu: Amazon Collection.
Mã hoặc tên mẫu: T3030785RG.', N'/products/ai-generated-500/0318-abo-more-36a913fe-8364-3973-4f5f-da1487663690.webp', N'["B\u00F4ng tai b\u1EA1c m\u1EA1 v\u00E0ng h\u1ED3ng h\u00ECnh v\u00F2ng tr\u00F2n"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/36a913fe-8364-3973-4f5f-da1487663690', 2078100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-378e964d-474f-3d09-855b-3c0ec91effd9', N'amazon-berkeley-objects', N'378e964d-474f-3d09-855b-3c0ec91effd9', N'Bộ mũ và khăn giữ ấm cho bé gái', N'Trang sức', 244250000, N'Bộ mũ và khăn giữ ấm cho bé gái.

Thương hiệu: Spotted Zebra.
Mã hoặc tên mẫu: B07QV38XG12.', N'/products/ai-generated-500/0322-abo-more-378e964d-474f-3d09-855b-3c0ec91effd9.webp', N'["B\u1ED9 m\u0169 v\u00E0 kh\u0103n gi\u1EEF \u1EA5m cho b\u00E9 g\u00E1i"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/378e964d-474f-3d09-855b-3c0ec91effd9', 977000, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-37abf3b1-8efe-d043-3cb5-903f461bd1ee', N'amazon-berkeley-objects', N'37abf3b1-8efe-d043-3cb5-903f461bd1ee', N'Thắt lưng da nữ bản nhỏ màu nâu', N'Trang sức', 398225000, N'Thắt lưng da nữ bản nhỏ màu nâu.

Thương hiệu: Amazon Essentials.
Mã hoặc tên mẫu: 13EZ110001.', N'/products/ai-generated-500/0324-abo-more-37abf3b1-8efe-d043-3cb5-903f461bd1ee.webp', N'["Th\u1EAFt l\u01B0ng da n\u1EEF b\u1EA3n nh\u1ECF m\u00E0u n\u00E2u"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/37abf3b1-8efe-d043-3cb5-903f461bd1ee', 1592900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-3867377f-9a1a-065e-12e8-98301b9d28fa', N'amazon-berkeley-objects', N'3867377f-9a1a-065e-12e8-98301b9d28fa', N'Dép xỏ ngón nam quai dù xanh dương', N'Trang phục', 121825000, N'Dép xỏ ngón nam quai dù xanh dương.

Thương hiệu: Bourge.
Mã hoặc tên mẫu: Canton-5-07.
Kiểu dáng: Giày xỏ chân.', N'/products/ai-generated-500/0379-abo-more-3867377f-9a1a-065e-12e8-98301b9d28fa.webp', N'["Ki\u1EC3u d\u00E1ng: Gi\u00E0y x\u1ECF ch\u00E2n"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/3867377f-9a1a-065e-12e8-98301b9d28fa', 487300, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-391873a4-a207-5257-f773-43e0e6ce9b84', N'amazon-berkeley-objects', N'391873a4-a207-5257-f773-43e0e6ce9b84', N'Nhà cây cho mèo có hang trú màu be', N'Trang phục', 328000000, N'Nhà cây cho mèo có hang trú màu be.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: 804233.
Màu sắc: Be.
Khối lượng: 14,92 kg.
Chiều cao: 127,99 cm.
Chiều dài: 65,00 cm.
Chiều rộng: 61,01 cm.', N'/products/ai-generated-500/0382-abo-more-391873a4-a207-5257-f773-43e0e6ce9b84.webp', N'["M\u00E0u s\u1EAFc: Be","Kh\u1ED1i l\u01B0\u1EE3ng: 14,92 kg","Chi\u1EC1u cao: 127,99 cm","Chi\u1EC1u d\u00E0i: 65,00 cm"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/391873a4-a207-5257-f773-43e0e6ce9b84', 1312000, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-392f0971-25b4-2ecb-22dc-8d985d2908ff', N'amazon-berkeley-objects', N'392f0971-25b4-2ecb-22dc-8d985d2908ff', N'Ốp điện thoại cứng họa tiết ngân hà', N'Trang sức', 201575000, N'Ốp điện thoại cứng họa tiết ngân hà.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8095-SL40672.
Thiết bị tương thích: Samsung Galaxy S6 Edge Plus.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0328-abo-more-392f0971-25b4-2ecb-22dc-8d985d2908ff.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Samsung Galaxy S6 Edge Plus","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/392f0971-25b4-2ecb-22dc-8d985d2908ff', 806300, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-394e7b7d-f4c4-10d9-6b18-e1a1f5d31040', N'amazon-berkeley-objects', N'394e7b7d-f4c4-10d9-6b18-e1a1f5d31040', N'Giày búp bê nữ kiểu dáng nhẹ nhàng', N'Trang phục', 127475000, N'Giày búp bê nữ kiểu dáng nhẹ nhàng.

Thương hiệu: Amazon Essentials.
Mã hoặc tên mẫu: Belize.', N'/products/ai-generated-500/0384-abo-more-394e7b7d-f4c4-10d9-6b18-e1a1f5d31040.webp', N'["Gi\u00E0y b\u00FAp b\u00EA n\u1EEF ki\u1EC3u d\u00E1ng nh\u1EB9 nh\u00E0ng"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/394e7b7d-f4c4-10d9-6b18-e1a1f5d31040', 509900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-39d1549d-b4cd-212b-8817-1d964ac927ce', N'amazon-berkeley-objects', N'39d1549d-b4cd-212b-8817-1d964ac927ce', N'Giày tây bé trai họa tiết đục lỗ', N'Trang phục', 385750000, N'Giày tây bé trai họa tiết đục lỗ.

Thương hiệu: RED WAGON.
Mã hoặc tên mẫu: AMZ021/01.
Kiểu dáng: Giày xỏ chân.', N'/products/ai-generated-500/0386-abo-more-39d1549d-b4cd-212b-8817-1d964ac927ce.webp', N'["Ki\u1EC3u d\u00E1ng: Gi\u00E0y x\u1ECF ch\u00E2n"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/39d1549d-b4cd-212b-8817-1d964ac927ce', 1543000, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-3a0eddd9-c939-efb8-0fe0-809705d3f127', N'amazon-berkeley-objects', N'3a0eddd9-c939-efb8-0fe0-809705d3f127', N'Giày thể thao đi nước cho bé gái', N'Trang phục', 587100000, N'Giày thể thao đi nước cho bé gái.

Thương hiệu: Amazon Essentials.
Mã hoặc tên mẫu: Elijah.', N'/products/ai-generated-500/0387-abo-more-3a0eddd9-c939-efb8-0fe0-809705d3f127.webp', N'["Gi\u00E0y th\u1EC3 thao \u0111i n\u01B0\u1EDBc cho b\u00E9 g\u00E1i"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/3a0eddd9-c939-efb8-0fe0-809705d3f127', 2348400, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-3ac97acf-800b-6146-2b0a-ef78ebd5beba', N'amazon-berkeley-objects', N'3ac97acf-800b-6146-2b0a-ef78ebd5beba', N'Giày lười nam da lộn nâu đậm', N'Trang phục', 595000000, N'Giày lười nam da lộn nâu đậm.

Thương hiệu: find..
Mã hoặc tên mẫu: AMZ155.
Năm mẫu: 2020.', N'/products/ai-generated-500/0391-abo-more-3ac97acf-800b-6146-2b0a-ef78ebd5beba.webp', N'["N\u0103m m\u1EABu: 2020"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/3ac97acf-800b-6146-2b0a-ef78ebd5beba', 2380000, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-3ae5e986-8224-75a0-b9e4-50839906a9e0', N'amazon-berkeley-objects', N'3ae5e986-8224-75a0-b9e4-50839906a9e0', N'Giày thể thao nữ trắng xám', N'Trang phục', 341975000, N'Giày thể thao nữ trắng xám.

Thương hiệu: CARE OF by PUMA.
Mã hoặc tên mẫu: 374676.
Năm mẫu: 2019.', N'/products/ai-generated-500/0396-abo-more-3ae5e986-8224-75a0-b9e4-50839906a9e0.webp', N'["N\u0103m m\u1EABu: 2019"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/3ae5e986-8224-75a0-b9e4-50839906a9e0', 1367900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-3b3485e4-a1c0-d56d-b6b3-8ab45303873a', N'amazon-berkeley-objects', N'3b3485e4-a1c0-d56d-b6b3-8ab45303873a', N'Viên bổ sung dưỡng chất dạng hộp', N'Trang phục', 80800000, N'Viên bổ sung dưỡng chất dạng hộp.

Thương hiệu: Whole Foods Market.
Mã hoặc tên mẫu: 228734.
Khối lượng: 0,05 kg.
Chiều cao: 8,68 cm.
Chiều dài: 4,72 cm.
Chiều rộng: 4,72 cm.
Thành phần theo nguồn: Phosphatidyl Serine. Quy cách theo nguồn: 60 đơn vị.', N'/products/ai-generated-500/0397-abo-more-3b3485e4-a1c0-d56d-b6b3-8ab45303873a.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg","Chi\u1EC1u cao: 8,68 cm","Chi\u1EC1u d\u00E0i: 4,72 cm","Chi\u1EC1u r\u1ED9ng: 4,72 cm"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/3b3485e4-a1c0-d56d-b6b3-8ab45303873a', 323200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-3cb3375c-47a2-7b81-d2f3-650ac98a83bd', N'amazon-berkeley-objects', N'3cb3375c-47a2-7b81-d2f3-650ac98a83bd', N'Xốt trộn rau củ hữu cơ', N'Trang phục', 293050000, N'Xốt trộn rau củ hữu cơ.

Thương hiệu: 365 Everyday Value.
Khối lượng: 0,45 kg.
Chiều cao: 21,44 cm.
Chiều dài: 4,78 cm.
Chiều rộng: 10,16 cm.', N'/products/ai-generated-500/0407-abo-more-3cb3375c-47a2-7b81-d2f3-650ac98a83bd.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,45 kg","Chi\u1EC1u cao: 21,44 cm","Chi\u1EC1u d\u00E0i: 4,78 cm","Chi\u1EC1u r\u1ED9ng: 10,16 cm"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/3cb3375c-47a2-7b81-d2f3-650ac98a83bd', 1172200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-3e39f3bb-866d-1f2d-6461-4c868a61c966', N'amazon-berkeley-objects', N'3e39f3bb-866d-1f2d-6461-4c868a61c966', N'Giày tây nam họa tiết đục lỗ cổ điển', N'Trang phục', 151875000, N'Giày tây nam họa tiết đục lỗ cổ điển.

Thương hiệu: find..
Mã hoặc tên mẫu: Aaron.
Kiểu dáng: Giày đục lỗ trang trí.', N'/products/ai-generated-500/0412-abo-more-3e39f3bb-866d-1f2d-6461-4c868a61c966.webp', N'["Ki\u1EC3u d\u00E1ng: Gi\u00E0y \u0111\u1EE5c l\u1ED7 trang tr\u00ED"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/3e39f3bb-866d-1f2d-6461-4c868a61c966', 607500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-3e9194a2-6a89-e478-3163-5f20dd7ca9ef', N'amazon-berkeley-objects', N'3e9194a2-6a89-e478-3163-5f20dd7ca9ef', N'Mũ nam có băng thấm mồ hôi màu trắng', N'Trang phục', 71075000, N'Mũ nam có băng thấm mồ hôi màu trắng.

Thương hiệu: Starter.
Mã hoặc tên mẫu: ST2001.
Màu sắc: Trắng.', N'/products/ai-generated-500/0414-abo-more-3e9194a2-6a89-e478-3163-5f20dd7ca9ef.webp', N'["M\u00E0u s\u1EAFc: Tr\u1EAFng"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/3e9194a2-6a89-e478-3163-5f20dd7ca9ef', 284300, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-3e9caf39-ea81-0e22-5631-f608590c7239', N'amazon-berkeley-objects', N'3e9caf39-ea81-0e22-5631-f608590c7239', N'Găng tay nam da nhám màu xám than', N'Trang sức', 600750000, N'Găng tay nam da nhám màu xám than.

Thương hiệu: Franklin Tailored.
Mã hoặc tên mẫu: Shearling.', N'/products/ai-generated-500/0347-abo-more-3e9caf39-ea81-0e22-5631-f608590c7239.webp', N'["G\u0103ng tay nam da nh\u00E1m m\u00E0u x\u00E1m than"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/3e9caf39-ea81-0e22-5631-f608590c7239', 2403000, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-3ebcc97e-d608-8ca1-f335-7c614521066b', N'amazon-berkeley-objects', N'3ebcc97e-d608-8ca1-f335-7c614521066b', N'Túi xách nữ đính đinh tán ánh kim', N'Trang sức', 376350000, N'Túi xách nữ đính đinh tán ánh kim.

Thương hiệu: The Fix.
Mã hoặc tên mẫu: Zoe.
Năm mẫu: 2017.
Khối lượng: 0,39 kg.', N'/products/ai-generated-500/0353-abo-more-3ebcc97e-d608-8ca1-f335-7c614521066b.webp', N'["N\u0103m m\u1EABu: 2017","Kh\u1ED1i l\u01B0\u1EE3ng: 0,39 kg"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/3ebcc97e-d608-8ca1-f335-7c614521066b', 1505400, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-3f0a2d08-a3ba-0a3c-32f9-44ed7e9a3baa', N'amazon-berkeley-objects', N'3f0a2d08-a3ba-0a3c-32f9-44ed7e9a3baa', N'Túi đeo chéo nữ màu đất nung', N'Trang sức', 580125000, N'Túi đeo chéo nữ màu đất nung.

Thương hiệu: Amazon Brand - Eden & Ivy.
Mã hoặc tên mẫu: HRF4741.
Chất liệu: Da nhân tạo.
Chiều cao: 25,40 cm.
Chiều dài: 12,70 cm.
Chiều rộng: 12,70 cm.', N'/products/ai-generated-500/0357-abo-more-3f0a2d08-a3ba-0a3c-32f9-44ed7e9a3baa.webp', N'["Ch\u1EA5t li\u1EC7u: Da nh\u00E2n t\u1EA1o","Chi\u1EC1u cao: 25,40 cm","Chi\u1EC1u d\u00E0i: 12,70 cm","Chi\u1EC1u r\u1ED9ng: 12,70 cm"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/3f0a2d08-a3ba-0a3c-32f9-44ed7e9a3baa', 2320500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-3f3fac82-90ac-2b66-fe7d-4e393e737818', N'amazon-berkeley-objects', N'3f3fac82-90ac-2b66-fe7d-4e393e737818', N'Giày mọi da đi thuyền xanh đậm và nâu', N'Trang phục', 425500000, N'Giày mọi da đi thuyền xanh đậm và nâu.

Thương hiệu: find..
Mã hoặc tên mẫu: Boat Shoes.
Kiểu dáng: Giày bốt.
Năm mẫu: 2019.', N'/products/ai-generated-500/0417-abo-more-3f3fac82-90ac-2b66-fe7d-4e393e737818.webp', N'["Ki\u1EC3u d\u00E1ng: Gi\u00E0y b\u1ED1t","N\u0103m m\u1EABu: 2019"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/3f3fac82-90ac-2b66-fe7d-4e393e737818', 1702000, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-3fcc1e1b-4f8c-e31f-47c6-ae0545174a51', N'amazon-berkeley-objects', N'3fcc1e1b-4f8c-e31f-47c6-ae0545174a51', N'Giày tây nam da kiểu xỏ chân', N'Trang phục', 554850000, N'Giày tây nam da kiểu xỏ chân.

Thương hiệu: Amazon Brand - Symbol.
Mã hoặc tên mẫu: AZ-WS-126B.
Màu sắc: Đen.
Chất liệu: Da.', N'/products/ai-generated-500/0420-abo-more-3fcc1e1b-4f8c-e31f-47c6-ae0545174a51.webp', N'["M\u00E0u s\u1EAFc: \u0110en","Ch\u1EA5t li\u1EC7u: Da"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/3fcc1e1b-4f8c-e31f-47c6-ae0545174a51', 2219400, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-3fdffeb1-2766-215b-e57f-864634edf3fa', N'amazon-berkeley-objects', N'3fdffeb1-2766-215b-e57f-864634edf3fa', N'Dép bông nam đi trong nhà', N'Trang phục', 120350000, N'Dép bông nam đi trong nhà.

Thương hiệu: Amazon Essentials.
Mã hoặc tên mẫu: Kerry.
Khối lượng: 0,20 kg.', N'/products/ai-generated-500/0423-abo-more-3fdffeb1-2766-215b-e57f-864634edf3fa.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,20 kg"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/3fdffeb1-2766-215b-e57f-864634edf3fa', 481400, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-40e773b6-7cb3-5ba2-2755-c6d59bfc86b6', N'amazon-berkeley-objects', N'40e773b6-7cb3-5ba2-2755-c6d59bfc86b6', N'Giày bốt nữ phom bắp chân rộng màu nâu', N'Trang phục', 156450000, N'Giày bốt nữ phom bắp chân rộng màu nâu.

Thương hiệu: Amazon Essentials.
Mã hoặc tên mẫu: Volt.
Màu sắc: Nâu.
Khối lượng: 0,48 kg.', N'/products/ai-generated-500/0426-abo-more-40e773b6-7cb3-5ba2-2755-c6d59bfc86b6.webp', N'["M\u00E0u s\u1EAFc: N\u00E2u","Kh\u1ED1i l\u01B0\u1EE3ng: 0,48 kg"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/40e773b6-7cb3-5ba2-2755-c6d59bfc86b6', 625800, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-4197a62a-c7d9-59f8-5fe4-83a26bd8f5eb', N'amazon-berkeley-objects', N'4197a62a-c7d9-59f8-5fe4-83a26bd8f5eb', N'Ba lô công sở đựng máy tính xách tay', N'Laptop', 517450000, N'Ba lô công sở đựng máy tính xách tay.

Thương hiệu: AmazonBasics.', N'/products/ai-generated-500/0008-abo-more-4197a62a-c7d9-59f8-5fe4-83a26bd8f5eb.webp', N'["Ba l\u00F4 c\u00F4ng s\u1EDF \u0111\u1EF1ng m\u00E1y t\u00EDnh x\u00E1ch tay"]', N'blue', N'▣', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/4197a62a-c7d9-59f8-5fe4-83a26bd8f5eb', 2069800, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-42f548d5-57a3-ae0e-bae8-e779a3bcc209', N'amazon-berkeley-objects', N'42f548d5-57a3-ae0e-bae8-e779a3bcc209', N'Nhẫn vàng trắng đính đá chữ nhật', N'Trang sức', 51425000, N'Nhẫn vàng trắng đính đá chữ nhật.

Thương hiệu: Amazon Collection.', N'/products/ai-generated-500/0364-abo-more-42f548d5-57a3-ae0e-bae8-e779a3bcc209.webp', N'["Nh\u1EABn v\u00E0ng tr\u1EAFng \u0111\u00EDnh \u0111\u00E1 ch\u1EEF nh\u1EADt"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/42f548d5-57a3-ae0e-bae8-e779a3bcc209', 205700, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-436c61ae-4487-1d87-a8fa-3453d7005dfb', N'amazon-berkeley-objects', N'436c61ae-4487-1d87-a8fa-3453d7005dfb', N'Dây chuyền bạc mặt cây gia đình đính đá', N'Trang sức', 362375000, N'Dây chuyền bạc mặt cây gia đình đính đá.

Thương hiệu: Amazon Collection.
Mã hoặc tên mẫu: 461847.', N'/products/ai-generated-500/0367-abo-more-436c61ae-4487-1d87-a8fa-3453d7005dfb.webp', N'["D\u00E2y chuy\u1EC1n b\u1EA1c m\u1EB7t c\u00E2y gia \u0111\u00ECnh \u0111\u00EDnh \u0111\u00E1"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/436c61ae-4487-1d87-a8fa-3453d7005dfb', 1449500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-43a6d659-9b7f-7427-6ef1-c8b491e09c56', N'amazon-berkeley-objects', N'43a6d659-9b7f-7427-6ef1-c8b491e09c56', N'Giày bốt da nữ cổ chân màu nâu', N'Trang phục', 466075000, N'Giày bốt da nữ cổ chân màu nâu.

Thương hiệu: 206 Collective.
Mã hoặc tên mẫu: Aria.', N'/products/ai-generated-500/0430-abo-more-43a6d659-9b7f-7427-6ef1-c8b491e09c56.webp', N'["Gi\u00E0y b\u1ED1t da n\u1EEF c\u1ED5 ch\u00E2n m\u00E0u n\u00E2u"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/43a6d659-9b7f-7427-6ef1-c8b491e09c56', 1864300, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-44b3f94d-8383-5220-5576-e10d144a1547', N'amazon-berkeley-objects', N'44b3f94d-8383-5220-5576-e10d144a1547', N'Mẫu màu ghế dài xám kim loại', N'Trang sức', 621400000, N'Mẫu màu ghế dài xám kim loại.

Thương hiệu: Ravenna Home.
Mã hoặc tên mẫu: 25030038.
Màu sắc: Xám kim loại.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0370-abo-more-44b3f94d-8383-5220-5576-e10d144a1547.webp', N'["M\u00E0u s\u1EAFc: X\u00E1m kim lo\u1EA1i","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/44b3f94d-8383-5220-5576-e10d144a1547', 2485600, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-4509a0d9-6c3d-e590-f88e-c1b8a1ed5023', N'amazon-berkeley-objects', N'4509a0d9-6c3d-e590-f88e-c1b8a1ed5023', N'Tủ áo hai cánh trượt có gương và đèn', N'Trang phục', 116275000, N'Tủ áo hai cánh trượt có gương và đèn.

Thương hiệu: Movian.
Mã hoặc tên mẫu: Lahn.
Chiều cao: 218,00 cm.
Chiều dài: 250,00 cm.
Chiều rộng: 65,00 cm.', N'/products/ai-generated-500/0442-abo-more-4509a0d9-6c3d-e590-f88e-c1b8a1ed5023.webp', N'["Chi\u1EC1u cao: 218,00 cm","Chi\u1EC1u d\u00E0i: 250,00 cm","Chi\u1EC1u r\u1ED9ng: 65,00 cm"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/4509a0d9-6c3d-e590-f88e-c1b8a1ed5023', 465100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-456d3442-742e-0a7b-0afc-854785e8ad46', N'amazon-berkeley-objects', N'456d3442-742e-0a7b-0afc-854785e8ad46', N'Dây chuyền bạc mặt hộp trái tim chạm hoa', N'Trang sức', 46125000, N'Dây chuyền bạc mặt hộp trái tim chạm hoa.

Thương hiệu: Amazon Collection.
Mã hoặc tên mẫu: AMZ3102F.
Màu sắc: Trắng.
Chất liệu: Không áp dụng.
Khối lượng: 0,02 kg.', N'/products/ai-generated-500/0373-abo-more-456d3442-742e-0a7b-0afc-854785e8ad46.webp', N'["M\u00E0u s\u1EAFc: Tr\u1EAFng","Ch\u1EA5t li\u1EC7u: Kh\u00F4ng \u00E1p d\u1EE5ng","Kh\u1ED1i l\u01B0\u1EE3ng: 0,02 kg"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/456d3442-742e-0a7b-0afc-854785e8ad46', 184500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-45882f11-736c-4033-4f5d-e0a1598bdcb6', N'amazon-berkeley-objects', N'45882f11-736c-4033-4f5d-e0a1598bdcb6', N'Giày chạy bộ nam vải dệt xanh đậm', N'Trang phục', 603325000, N'Giày chạy bộ nam vải dệt xanh đậm.

Thương hiệu: Klepe.
Mã hoặc tên mẫu: KP0361/NVY.
Chất liệu: Vải lưới.
Kiểu dáng: Giày chạy bộ.', N'/products/ai-generated-500/0445-abo-more-45882f11-736c-4033-4f5d-e0a1598bdcb6.webp', N'["Ch\u1EA5t li\u1EC7u: V\u1EA3i l\u01B0\u1EDBi","Ki\u1EC3u d\u00E1ng: Gi\u00E0y ch\u1EA1y b\u1ED9"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/45882f11-736c-4033-4f5d-e0a1598bdcb6', 2413300, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-469d0b5a-6b37-b593-2349-7c69fb2829b7', N'amazon-berkeley-objects', N'469d0b5a-6b37-b593-2349-7c69fb2829b7', N'Giày cao gót nữ thấp mũi nhọn vân rắn', N'Trang phục', 112950000, N'Giày cao gót nữ thấp mũi nhọn vân rắn.

Thương hiệu: find..
Mã hoặc tên mẫu: Emily-S-1A-7.
Năm mẫu: 2019.', N'/products/ai-generated-500/0455-abo-more-469d0b5a-6b37-b593-2349-7c69fb2829b7.webp', N'["N\u0103m m\u1EABu: 2019"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/469d0b5a-6b37-b593-2349-7c69fb2829b7', 451800, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-46b090ed-a6c1-3b81-c87f-f5eb396f11fc', N'amazon-berkeley-objects', N'46b090ed-a6c1-3b81-c87f-f5eb396f11fc', N'Giày bốt nam cổ lửng màu nâu nhạt', N'Trang phục', 388050000, N'Giày bốt nam cổ lửng màu nâu nhạt.

Thương hiệu: find..
Mã hoặc tên mẫu: UM1527.
Năm mẫu: 2019.', N'/products/ai-generated-500/0459-abo-more-46b090ed-a6c1-3b81-c87f-f5eb396f11fc.webp', N'["N\u0103m m\u1EABu: 2019"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/46b090ed-a6c1-3b81-c87f-f5eb396f11fc', 1552200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-46d8c5b5-b483-b7b6-5e6c-9929608a65fb', N'amazon-berkeley-objects', N'46d8c5b5-b483-b7b6-5e6c-9929608a65fb', N'Giày bốt nam cổ chân màu xanh ô liu', N'Trang phục', 555975000, N'Giày bốt nam cổ chân màu xanh ô liu.

Thương hiệu: find..
Mã hoặc tên mẫu: AMZ135.
Chất liệu: Da.
Kiểu dáng: Giày bốt cổ chân.
Năm mẫu: 2019.', N'/products/ai-generated-500/0462-abo-more-46d8c5b5-b483-b7b6-5e6c-9929608a65fb.webp', N'["Ch\u1EA5t li\u1EC7u: Da","Ki\u1EC3u d\u00E1ng: Gi\u00E0y b\u1ED1t c\u1ED5 ch\u00E2n","N\u0103m m\u1EABu: 2019"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/46d8c5b5-b483-b7b6-5e6c-9929608a65fb', 2223900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-46e1afa1-be3f-fb23-ff6f-23f813b968c7', N'amazon-berkeley-objects', N'46e1afa1-be3f-fb23-ff6f-23f813b968c7', N'Dép quai dán cho bé màu nâu nhạt', N'Trang phục', 196275000, N'Dép quai dán cho bé màu nâu nhạt.

Thương hiệu: Amazon Essentials.
Mã hoặc tên mẫu: Arya.', N'/products/ai-generated-500/0464-abo-more-46e1afa1-be3f-fb23-ff6f-23f813b968c7.webp', N'["D\u00E9p quai d\u00E1n cho b\u00E9 m\u00E0u n\u00E2u nh\u1EA1t"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/46e1afa1-be3f-fb23-ff6f-23f813b968c7', 785100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-47946f3e-fb6f-1547-77ed-005f863f76a9', N'amazon-berkeley-objects', N'47946f3e-fb6f-1547-77ed-005f863f76a9', N'Khăn lụa cài túi áo họa tiết hồng', N'Trang sức', 102650000, N'Khăn lụa cài túi áo họa tiết hồng.

Thương hiệu: Buttoned Down.
Mã hoặc tên mẫu: MBD0003.', N'/products/ai-generated-500/0380-abo-more-47946f3e-fb6f-1547-77ed-005f863f76a9.webp', N'["Kh\u0103n l\u1EE5a c\u00E0i t\u00FAi \u00E1o h\u1ECDa ti\u1EBFt h\u1ED3ng"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/47946f3e-fb6f-1547-77ed-005f863f76a9', 410600, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-480a4969-4cd1-05a8-5598-6e016cfe6ae0', N'amazon-berkeley-objects', N'480a4969-4cd1-05a8-5598-6e016cfe6ae0', N'Dép cao gót nữ quai mảnh màu bạc', N'Trang phục', 611750000, N'Dép cao gót nữ quai mảnh màu bạc.

Thương hiệu: 206 Collective.
Mã hoặc tên mẫu: Eve.
Khối lượng: 0,16 kg.', N'/products/ai-generated-500/0467-abo-more-480a4969-4cd1-05a8-5598-6e016cfe6ae0.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,16 kg"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/480a4969-4cd1-05a8-5598-6e016cfe6ae0', 2447000, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-48b19393-c435-4fd1-b178-d04cf553a54a', N'amazon-berkeley-objects', N'48b19393-c435-4fd1-b178-d04cf553a54a', N'Găng tay dùng một lần màu đen không bột', N'Trang phục', 440975000, N'Găng tay dùng một lần màu đen không bột.

Thương hiệu: AmazonCommercial.
Mã hoặc tên mẫu: 32606BK240R2.
Màu sắc: Đen.
Khối lượng: 0,01 kg.
Chiều cao: 0,02 cm.
Chiều dài: 24,00 cm.
Chiều rộng: 8,50 cm.', N'/products/ai-generated-500/0471-abo-more-48b19393-c435-4fd1-b178-d04cf553a54a.webp', N'["M\u00E0u s\u1EAFc: \u0110en","Kh\u1ED1i l\u01B0\u1EE3ng: 0,01 kg","Chi\u1EC1u cao: 0,02 cm","Chi\u1EC1u d\u00E0i: 24,00 cm"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/48b19393-c435-4fd1-b178-d04cf553a54a', 1763900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-498c8798-ae35-812f-b14d-ba3024b657bf', N'amazon-berkeley-objects', N'498c8798-ae35-812f-b14d-ba3024b657bf', N'Giày cao gót nữ hở mũi xanh đậm', N'Trang phục', 28250000, N'Giày cao gót nữ hở mũi xanh đậm.

Thương hiệu: find..
Mã hoặc tên mẫu: Scuba-s-1a-5.
Năm mẫu: 2019.', N'/products/ai-generated-500/0478-abo-more-498c8798-ae35-812f-b14d-ba3024b657bf.webp', N'["N\u0103m m\u1EABu: 2019"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/498c8798-ae35-812f-b14d-ba3024b657bf', 113000, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-4adee84e-34ce-73e1-94b1-4f601497863e', N'amazon-berkeley-objects', N'4adee84e-34ce-73e1-94b1-4f601497863e', N'Bộ bốn màu thực phẩm', N'Trang sức', 67450000, N'Bộ bốn màu thực phẩm.

Thương hiệu: 365 by Whole Foods Market.
Chiều cao: 7,62 cm.
Chiều dài: 2,67 cm.
Chiều rộng: 8,26 cm.', N'/products/ai-generated-500/0392-abo-more-4adee84e-34ce-73e1-94b1-4f601497863e.webp', N'["Chi\u1EC1u cao: 7,62 cm","Chi\u1EC1u d\u00E0i: 2,67 cm","Chi\u1EC1u r\u1ED9ng: 8,26 cm"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/4adee84e-34ce-73e1-94b1-4f601497863e', 269800, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-4bee24bd-5679-0918-ba91-cf82d269646a', N'amazon-berkeley-objects', N'4bee24bd-5679-0918-ba91-cf82d269646a', N'Mũ trùm che mặt chống nắng mùa hè', N'Trang sức', 141550000, N'Mũ trùm che mặt chống nắng mùa hè.

Thương hiệu: TRAILSIDE SUPPLY CO..
Mã hoặc tên mẫu: 056-summer mask-grey.
Màu sắc: Xám.', N'/products/ai-generated-500/0398-abo-more-4bee24bd-5679-0918-ba91-cf82d269646a.webp', N'["M\u00E0u s\u1EAFc: X\u00E1m"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/4bee24bd-5679-0918-ba91-cf82d269646a', 566200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-4c1130cf-e8fe-12b7-95f1-2ebdea55db0e', N'amazon-berkeley-objects', N'4c1130cf-e8fe-12b7-95f1-2ebdea55db0e', N'Bột đạm thực vật vị dừa và hạnh nhân', N'Làm đẹp', 502975000, N'Bột đạm thực vật vị dừa và hạnh nhân.

Thương hiệu: Whole Foods Market.
Khối lượng: 0,93 kg.
Chiều cao: 21,97 cm.
Chiều dài: 15,24 cm.
Chiều rộng: 15,11 cm.', N'/products/ai-generated-500/0168-abo-more-4c1130cf-e8fe-12b7-95f1-2ebdea55db0e.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,93 kg","Chi\u1EC1u cao: 21,97 cm","Chi\u1EC1u d\u00E0i: 15,24 cm","Chi\u1EC1u r\u1ED9ng: 15,11 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/4c1130cf-e8fe-12b7-95f1-2ebdea55db0e', 2011900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-4daad88f-5d43-510d-3e2e-ea4f4e77a26e', N'amazon-berkeley-objects', N'4daad88f-5d43-510d-3e2e-ea4f4e77a26e', N'Bông tai vàng đính kim cương', N'Trang sức', 25200000, N'Bông tai vàng đính kim cương.

Thương hiệu: Amazon Collection.
Mã hoặc tên mẫu: 176267/G10Y/J1/EB95510Y/STD.
Chất liệu: Kim loại.', N'/products/ai-generated-500/0402-abo-more-4daad88f-5d43-510d-3e2e-ea4f4e77a26e.webp', N'["Ch\u1EA5t li\u1EC7u: Kim lo\u1EA1i"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/4daad88f-5d43-510d-3e2e-ea4f4e77a26e', 100800, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-4dbc480a-a72b-7f58-7882-aadd8e8242d1', N'amazon-berkeley-objects', N'4dbc480a-a72b-7f58-7882-aadd8e8242d1', N'Dép quai cổ chân nữ màu be', N'Trang phục', 231900000, N'Dép quai cổ chân nữ màu be.

Thương hiệu: Jenny.
Mã hoặc tên mẫu: Casablanca 2217914.
Năm mẫu: 2019.', N'/products/ai-generated-500/0495-abo-more-4dbc480a-a72b-7f58-7882-aadd8e8242d1.webp', N'["N\u0103m m\u1EABu: 2019"]', N'sand', N'✦', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/4dbc480a-a72b-7f58-7882-aadd8e8242d1', 927600, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-4e58a3f0-032e-a333-c27e-1111a5b51a53', N'amazon-berkeley-objects', N'4e58a3f0-032e-a333-c27e-1111a5b51a53', N'Bộ máy xịt thơm tự động hương hoa nhài', N'Làm đẹp', 457975000, N'Bộ máy xịt thơm tự động hương hoa nhài.

Thương hiệu: Amazon Brand - Solimo.', N'/products/ai-generated-500/0171-abo-more-4e58a3f0-032e-a333-c27e-1111a5b51a53.webp', N'["B\u1ED9 m\u00E1y x\u1ECBt th\u01A1m t\u1EF1 \u0111\u1ED9ng h\u01B0\u01A1ng hoa nh\u00E0i"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/4e58a3f0-032e-a333-c27e-1111a5b51a53', 1831900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-4e91521b-a68f-d275-ab3d-4c0f8a89a2f6', N'amazon-berkeley-objects', N'4e91521b-a68f-d275-ab3d-4c0f8a89a2f6', N'Bộ sáu chai dầu động cơ', N'Trang sức', 452050000, N'Bộ sáu chai dầu động cơ.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: AM0604P6.
Kiểu dáng: Tổng hợp hoàn toàn.
Khối lượng: 0,91 kg.
Chiều cao: 22,86 cm.
Chiều dài: 11,11 cm.
Chiều rộng: 6,03 cm.', N'/products/ai-generated-500/0403-abo-more-4e91521b-a68f-d275-ab3d-4c0f8a89a2f6.webp', N'["Ki\u1EC3u d\u00E1ng: T\u1ED5ng h\u1EE3p ho\u00E0n to\u00E0n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,91 kg","Chi\u1EC1u cao: 22,86 cm","Chi\u1EC1u d\u00E0i: 11,11 cm"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/4e91521b-a68f-d275-ab3d-4c0f8a89a2f6', 1808200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-4ebadff4-5a74-96b4-2f25-a95aecb0675e', N'amazon-berkeley-objects', N'4ebadff4-5a74-96b4-2f25-a95aecb0675e', N'Nơ lụa nam tự thắt họa tiết màu cam', N'Trang sức', 321525000, N'Nơ lụa nam tự thắt họa tiết màu cam.

Thương hiệu: Buttoned Down.
Mã hoặc tên mẫu: MBD0007.', N'/products/ai-generated-500/0408-abo-more-4ebadff4-5a74-96b4-2f25-a95aecb0675e.webp', N'["N\u01A1 l\u1EE5a nam t\u1EF1 th\u1EAFt h\u1ECDa ti\u1EBFt m\u00E0u cam"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/4ebadff4-5a74-96b4-2f25-a95aecb0675e', 1286100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-4eed0035-4466-ee7b-19a0-193258764d54', N'amazon-berkeley-objects', N'4eed0035-4466-ee7b-19a0-193258764d54', N'Mẫu màu ghế xanh đậm', N'Trang sức', 567950000, N'Mẫu màu ghế xanh đậm.

Thương hiệu: Stone & Beam.
Mã hoặc tên mẫu: 25020022.
Màu sắc: Xanh đậm.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0410-abo-more-4eed0035-4466-ee7b-19a0-193258764d54.webp', N'["M\u00E0u s\u1EAFc: Xanh \u0111\u1EADm","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/4eed0035-4466-ee7b-19a0-193258764d54', 2271800, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-5034bcfc-03ef-949e-5ab8-bbd618caa2e8', N'amazon-berkeley-objects', N'5034bcfc-03ef-949e-5ab8-bbd618caa2e8', N'Nước rửa chén đậm đặc hương cam chanh', N'Làm đẹp', 437325000, N'Nước rửa chén đậm đặc hương cam chanh.

Thương hiệu: Presto!.', N'/products/ai-generated-500/0173-abo-more-5034bcfc-03ef-949e-5ab8-bbd618caa2e8.webp', N'["N\u01B0\u1EDBc r\u1EEDa ch\u00E9n \u0111\u1EADm \u0111\u1EB7c h\u01B0\u01A1ng cam chanh"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/5034bcfc-03ef-949e-5ab8-bbd618caa2e8', 1749300, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-5060d7b8-2998-6ee6-8e77-f63a5424194c', N'amazon-berkeley-objects', N'5060d7b8-2998-6ee6-8e77-f63a5424194c', N'Bột rễ cây thảo dược hữu cơ', N'Làm đẹp', 509750000, N'Bột rễ cây thảo dược hữu cơ.

Thương hiệu: Vita Essentials.
Khối lượng: 0,45 kg.
Chiều cao: 27,94 cm.
Chiều dài: 17,78 cm.
Chiều rộng: 22,86 cm.', N'/products/ai-generated-500/0177-abo-more-5060d7b8-2998-6ee6-8e77-f63a5424194c.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,45 kg","Chi\u1EC1u cao: 27,94 cm","Chi\u1EC1u d\u00E0i: 17,78 cm","Chi\u1EC1u r\u1ED9ng: 22,86 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/5060d7b8-2998-6ee6-8e77-f63a5424194c', 2039000, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-50b8bce7-c00a-5e72-1b92-ac1714b3ceac', N'amazon-berkeley-objects', N'50b8bce7-c00a-5e72-1b92-ac1714b3ceac', N'Giá đỡ nhôm cho máy tính kèm quạt', N'Laptop', 388800000, N'Giá đỡ nhôm cho máy tính kèm quạt.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: AMZAALSWCF-SILVER.
Màu sắc: Bạc.
Khối lượng: 1,45 kg.
Chiều cao: 5,99 cm.
Chiều dài: 48,49 cm.
Chiều rộng: 27,51 cm.', N'/products/ai-generated-500/0015-abo-more-50b8bce7-c00a-5e72-1b92-ac1714b3ceac.webp', N'["M\u00E0u s\u1EAFc: B\u1EA1c","Kh\u1ED1i l\u01B0\u1EE3ng: 1,45 kg","Chi\u1EC1u cao: 5,99 cm","Chi\u1EC1u d\u00E0i: 48,49 cm"]', N'blue', N'▣', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/50b8bce7-c00a-5e72-1b92-ac1714b3ceac', 1555200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-5295fe58-9c8e-1dd8-2ce0-3e5bf9829d32', N'amazon-berkeley-objects', N'5295fe58-9c8e-1dd8-2ce0-3e5bf9829d32', N'Sáp thơm xe hơi hương biển', N'Trang sức', 584875000, N'Sáp thơm xe hơi hương biển.

Thương hiệu: Amazon Brand - Solimo.
Khối lượng: 0,04 kg.', N'/products/ai-generated-500/0418-abo-more-5295fe58-9c8e-1dd8-2ce0-3e5bf9829d32.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,04 kg"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/5295fe58-9c8e-1dd8-2ce0-3e5bf9829d32', 2339500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-540ac359-7929-67a0-6656-26283a680514', N'amazon-berkeley-objects', N'540ac359-7929-67a0-6656-26283a680514', N'Bông tai vàng móc gài đính đá tròn', N'Trang sức', 201325000, N'Bông tai vàng móc gài đính đá tròn.

Thương hiệu: Amazon Collection.
Mã hoặc tên mẫu: JEE00124_4NNCL00A100.
Màu sắc: Trong suốt.
Khối lượng: 0,00 kg.', N'/products/ai-generated-500/0421-abo-more-540ac359-7929-67a0-6656-26283a680514.webp', N'["M\u00E0u s\u1EAFc: Trong su\u1ED1t","Kh\u1ED1i l\u01B0\u1EE3ng: 0,00 kg"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/540ac359-7929-67a0-6656-26283a680514', 805300, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-55c4a56d-1386-e62a-c2d5-21fa0cbb8e85', N'amazon-berkeley-objects', N'55c4a56d-1386-e62a-c2d5-21fa0cbb8e85', N'Khăn choàng nữ tua rua ô kem và đen', N'Trang sức', 283300000, N'Khăn choàng nữ tua rua ô kem và đen.

Thương hiệu: Goodthreads.
Mã hoặc tên mẫu: GT19411640.', N'/products/ai-generated-500/0424-abo-more-55c4a56d-1386-e62a-c2d5-21fa0cbb8e85.webp', N'["Kh\u0103n cho\u00E0ng n\u1EEF tua rua \u00F4 kem v\u00E0 \u0111en"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/55c4a56d-1386-e62a-c2d5-21fa0cbb8e85', 1133200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-55e1e263-6ae3-5129-9cde-aec21668ddfc', N'amazon-berkeley-objects', N'55e1e263-6ae3-5129-9cde-aec21668ddfc', N'Ba lô đựng máy tính màu đen', N'Laptop', 62100000, N'Ba lô đựng máy tính màu đen.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: Sol_Lgge_69.
Màu sắc: Đen.
Chất liệu: Sợi tổng hợp.
Kiểu dáng: Ba lô.
Chiều cao: 47,00 cm.
Chiều dài: 31,00 cm.
Chiều rộng: 20,00 cm.', N'/products/ai-generated-500/0022-abo-more-55e1e263-6ae3-5129-9cde-aec21668ddfc.webp', N'["M\u00E0u s\u1EAFc: \u0110en","Ch\u1EA5t li\u1EC7u: S\u1EE3i t\u1ED5ng h\u1EE3p","Ki\u1EC3u d\u00E1ng: Ba l\u00F4","Chi\u1EC1u cao: 47,00 cm"]', N'blue', N'▣', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/55e1e263-6ae3-5129-9cde-aec21668ddfc', 248400, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-596f0136-d33c-a8fc-5be8-614e96977a3a', N'amazon-berkeley-objects', N'596f0136-d33c-a8fc-5be8-614e96977a3a', N'Dây chuyền bạc mặt bướm đính đá', N'Trang sức', 562000000, N'Dây chuyền bạc mặt bướm đính đá.

Thương hiệu: Amazon Collection.
Mã hoặc tên mẫu: 63A4GS13FW.
Chất liệu: Kim loại.
Chiều cao: 0,20 cm.
Chiều dài: 3,90 cm.
Chiều rộng: 2,80 cm.', N'/products/ai-generated-500/0431-abo-more-596f0136-d33c-a8fc-5be8-614e96977a3a.webp', N'["Ch\u1EA5t li\u1EC7u: Kim lo\u1EA1i","Chi\u1EC1u cao: 0,20 cm","Chi\u1EC1u d\u00E0i: 3,90 cm","Chi\u1EC1u r\u1ED9ng: 2,80 cm"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/596f0136-d33c-a8fc-5be8-614e96977a3a', 2248000, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-597e4b53-f06f-7f0f-c61c-fa0f1521ce43', N'amazon-berkeley-objects', N'597e4b53-f06f-7f0f-c61c-fa0f1521ce43', N'Sổ tay bìa da tổng hợp kẻ ô màu đỏ', N'Laptop', 593075000, N'Sổ tay bìa da tổng hợp kẻ ô màu đỏ.

Thương hiệu: Eono.
Khối lượng: 0,37 kg.
Chiều cao: 1,60 cm.
Chiều dài: 21,01 cm.
Chiều rộng: 14,30 cm.', N'/products/ai-generated-500/0029-abo-more-597e4b53-f06f-7f0f-c61c-fa0f1521ce43.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,37 kg","Chi\u1EC1u cao: 1,60 cm","Chi\u1EC1u d\u00E0i: 21,01 cm","Chi\u1EC1u r\u1ED9ng: 14,30 cm"]', N'blue', N'▣', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/597e4b53-f06f-7f0f-c61c-fa0f1521ce43', 2372300, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-5a521804-877b-006a-d290-975bf7f0c5df', N'amazon-berkeley-objects', N'5a521804-877b-006a-d290-975bf7f0c5df', N'Giày thể thao nữ xỏ chân màu xanh tím', N'Trang sức', 136675000, N'Giày thể thao nữ xỏ chân màu xanh tím.

Thương hiệu: Concept 3 by Skechers.
Mã hoặc tên mẫu: Concept 3 Evve.', N'/products/ai-generated-500/0434-abo-more-5a521804-877b-006a-d290-975bf7f0c5df.webp', N'["Gi\u00E0y th\u1EC3 thao n\u1EEF x\u1ECF ch\u00E2n m\u00E0u xanh t\u00EDm"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/5a521804-877b-006a-d290-975bf7f0c5df', 546700, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-5b171e24-276b-4ed0-6afd-a3bc73a831d4', N'amazon-berkeley-objects', N'5b171e24-276b-4ed0-6afd-a3bc73a831d4', N'Đèn chùm kim loại và thủy tinh', N'Trang sức', 504400000, N'Đèn chùm kim loại và thủy tinh.

Thương hiệu: Stone & Beam.
Mã hoặc tên mẫu: 96120CLOI/BUL.
Chất liệu: Kim loại.
Khối lượng: 0,91 kg.
Chiều cao: 19,05 cm.
Chiều dài: 12,07 cm.
Chiều rộng: 12,07 cm.', N'/products/ai-generated-500/0440-abo-more-5b171e24-276b-4ed0-6afd-a3bc73a831d4.webp', N'["Ch\u1EA5t li\u1EC7u: Kim lo\u1EA1i","Kh\u1ED1i l\u01B0\u1EE3ng: 0,91 kg","Chi\u1EC1u cao: 19,05 cm","Chi\u1EC1u d\u00E0i: 12,07 cm"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/5b171e24-276b-4ed0-6afd-a3bc73a831d4', 2017600, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-5b29e9c4-052f-7c6a-a1d4-caa017ecf684', N'amazon-berkeley-objects', N'5b29e9c4-052f-7c6a-a1d4-caa017ecf684', N'Ghế đôn xoay có bánh xe màu đỏ', N'Trang sức', 492225000, N'Ghế đôn xoay có bánh xe màu đỏ.

Thương hiệu: AmazonBasics.
Chiều cao: 36,50 cm.
Chiều dài: 38,00 cm.
Chiều rộng: 38,00 cm.', N'/products/ai-generated-500/0443-abo-more-5b29e9c4-052f-7c6a-a1d4-caa017ecf684.webp', N'["Chi\u1EC1u cao: 36,50 cm","Chi\u1EC1u d\u00E0i: 38,00 cm","Chi\u1EC1u r\u1ED9ng: 38,00 cm"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/5b29e9c4-052f-7c6a-a1d4-caa017ecf684', 1968900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-5c579d2f-dfc6-021d-9081-541d4677bbb3', N'amazon-berkeley-objects', N'5c579d2f-dfc6-021d-9081-541d4677bbb3', N'Bộ bốn ba lô đựng máy tính', N'Trang sức', 431375000, N'Bộ bốn ba lô đựng máy tính.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: NC1211147R1W4.
Năm mẫu: 2013.
Khối lượng: 3,12 kg.
Chiều cao: 79,20 cm.
Chiều dài: 36,09 cm.
Chiều rộng: 50,09 cm.', N'/products/ai-generated-500/0446-abo-more-5c579d2f-dfc6-021d-9081-541d4677bbb3.webp', N'["N\u0103m m\u1EABu: 2013","Kh\u1ED1i l\u01B0\u1EE3ng: 3,12 kg","Chi\u1EC1u cao: 79,20 cm","Chi\u1EC1u d\u00E0i: 36,09 cm"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/5c579d2f-dfc6-021d-9081-541d4677bbb3', 1725500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-5e4c184b-4c71-491f-12d1-3343999cd790', N'amazon-berkeley-objects', N'5e4c184b-4c71-491f-12d1-3343999cd790', N'Túi đeo hông du lịch màu đen', N'Làm đẹp', 231350000, N'Túi đeo hông du lịch màu đen.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: SOCABP151.
Chất liệu: Ni lông.
Khối lượng: 0,15 kg.
Chiều cao: 10,00 cm.
Chiều dài: 45,00 cm.
Chiều rộng: 35,00 cm.', N'/products/ai-generated-500/0190-abo-more-5e4c184b-4c71-491f-12d1-3343999cd790.webp', N'["Ch\u1EA5t li\u1EC7u: Ni l\u00F4ng","Kh\u1ED1i l\u01B0\u1EE3ng: 0,15 kg","Chi\u1EC1u cao: 10,00 cm","Chi\u1EC1u d\u00E0i: 45,00 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/5e4c184b-4c71-491f-12d1-3343999cd790', 925400, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-6149262a-49db-9443-9d5b-b187f7e4775f', N'amazon-berkeley-objects', N'6149262a-49db-9443-9d5b-b187f7e4775f', N'Mẫu màu ghế dài xanh lá đậm', N'Trang sức', 283450000, N'Mẫu màu ghế dài xanh lá đậm.

Thương hiệu: Rivet.
Mã hoặc tên mẫu: 25010096.
Màu sắc: Xanh lá đậm.
Kiểu dáng: Nhung.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0456-abo-more-6149262a-49db-9443-9d5b-b187f7e4775f.webp', N'["M\u00E0u s\u1EAFc: Xanh l\u00E1 \u0111\u1EADm","Ki\u1EC3u d\u00E1ng: Nhung","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/6149262a-49db-9443-9d5b-b187f7e4775f', 1133800, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-617301e4-1cc9-5008-c109-c547d4ea31f4', N'amazon-berkeley-objects', N'617301e4-1cc9-5008-c109-c547d4ea31f4', N'Nhẫn bạc mạ bạch kim đính ngọc trai trắng', N'Trang sức', 107525000, N'Nhẫn bạc mạ bạch kim đính ngọc trai trắng.

Thương hiệu: Amazon Collection.
Mã hoặc tên mẫu: R1595905_120_080.
Chất liệu: Ngọc trai.', N'/products/ai-generated-500/0460-abo-more-617301e4-1cc9-5008-c109-c547d4ea31f4.webp', N'["Ch\u1EA5t li\u1EC7u: Ng\u1ECDc trai"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/617301e4-1cc9-5008-c109-c547d4ea31f4', 430100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-627adf53-8dea-15b4-fb75-933a62ffcdeb', N'amazon-berkeley-objects', N'627adf53-8dea-15b4-fb75-933a62ffcdeb', N'Nhẫn bạc mạ đính đá đen và trong suốt', N'Trang sức', 463475000, N'Nhẫn bạc mạ đính đá đen và trong suốt.

Thương hiệu: Amazon Collection.', N'/products/ai-generated-500/0465-abo-more-627adf53-8dea-15b4-fb75-933a62ffcdeb.webp', N'["Nh\u1EABn b\u1EA1c m\u1EA1 \u0111\u00EDnh \u0111\u00E1 \u0111en v\u00E0 trong su\u1ED1t"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/627adf53-8dea-15b4-fb75-933a62ffcdeb', 1853900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-6459e83b-4ce9-4203-4f55-feacff4fdcf7', N'amazon-berkeley-objects', N'6459e83b-4ce9-4203-4f55-feacff4fdcf7', N'Bộ hộp đựng thực phẩm có nắp', N'Làm đẹp', 473225000, N'Bộ hộp đựng thực phẩm có nắp.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: 00842379159381.
Chất liệu: Nhựa.
Kiểu dáng: Dùng đựng súp và rau trộn.
Chiều cao: 30,18 cm.
Chiều dài: 37,62 cm.
Chiều rộng: 18,57 cm.', N'/products/ai-generated-500/0193-abo-more-6459e83b-4ce9-4203-4f55-feacff4fdcf7.webp', N'["Ch\u1EA5t li\u1EC7u: Nh\u1EF1a","Ki\u1EC3u d\u00E1ng: D\u00F9ng \u0111\u1EF1ng s\u00FAp v\u00E0 rau tr\u1ED9n","Chi\u1EC1u cao: 30,18 cm","Chi\u1EC1u d\u00E0i: 37,62 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/6459e83b-4ce9-4203-4f55-feacff4fdcf7', 1892900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-64b0c27f-680d-de4e-cba1-aeebd5081e74', N'amazon-berkeley-objects', N'64b0c27f-680d-de4e-cba1-aeebd5081e74', N'Bộ hai vali kéo đựng máy tính', N'Laptop', 160375000, N'Bộ hai vali kéo đựng máy tính.

Thương hiệu: Amazon Basics.
Mã hoặc tên mẫu: ZH1310215R3W2.
Khối lượng: 4,60 kg.
Chiều cao: 36,80 cm.
Chiều dài: 42,01 cm.
Chiều rộng: 38,00 cm.', N'/products/ai-generated-500/0035-abo-more-64b0c27f-680d-de4e-cba1-aeebd5081e74.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 4,60 kg","Chi\u1EC1u cao: 36,80 cm","Chi\u1EC1u d\u00E0i: 42,01 cm","Chi\u1EC1u r\u1ED9ng: 38,00 cm"]', N'blue', N'▣', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/64b0c27f-680d-de4e-cba1-aeebd5081e74', 641500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-65b699db-49be-aa03-1e4e-9b41d9ee69cb', N'amazon-berkeley-objects', N'65b699db-49be-aa03-1e4e-9b41d9ee69cb', N'Bộ núm kéo ngăn tủ tròn mạ bóng', N'Trang sức', 308150000, N'Bộ núm kéo ngăn tủ tròn mạ bóng.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: AB200-PC-25.
Khối lượng: 1,45 kg.
Chiều cao: 2,54 cm.
Chiều dài: 3,18 cm.
Chiều rộng: 3,18 cm.', N'/products/ai-generated-500/0473-abo-more-65b699db-49be-aa03-1e4e-9b41d9ee69cb.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 1,45 kg","Chi\u1EC1u cao: 2,54 cm","Chi\u1EC1u d\u00E0i: 3,18 cm","Chi\u1EC1u r\u1ED9ng: 3,18 cm"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/65b699db-49be-aa03-1e4e-9b41d9ee69cb', 1232600, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-663a8f0d-fe70-cfad-2ac3-3939ab014ee9', N'amazon-berkeley-objects', N'663a8f0d-fe70-cfad-2ac3-3939ab014ee9', N'Cuộn sợi nhựa in ba chiều ánh vàng', N'Trang sức', 68625000, N'Cuộn sợi nhựa in ba chiều ánh vàng.

Thương hiệu: EONO.', N'/products/ai-generated-500/0476-abo-more-663a8f0d-fe70-cfad-2ac3-3939ab014ee9.webp', N'["Cu\u1ED9n s\u1EE3i nh\u1EF1a in ba chi\u1EC1u \u00E1nh v\u00E0ng"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/663a8f0d-fe70-cfad-2ac3-3939ab014ee9', 274500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-668c2ef1-8fe1-4896-6532-f9e61030a3bb', N'amazon-berkeley-objects', N'668c2ef1-8fe1-4896-6532-f9e61030a3bb', N'Nước xả vải hương sương mai', N'Làm đẹp', 532025000, N'Nước xả vải hương sương mai.

Thương hiệu: Presto!.', N'/products/ai-generated-500/0195-abo-more-668c2ef1-8fe1-4896-6532-f9e61030a3bb.webp', N'["N\u01B0\u1EDBc x\u1EA3 v\u1EA3i h\u01B0\u01A1ng s\u01B0\u01A1ng mai"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/668c2ef1-8fe1-4896-6532-f9e61030a3bb', 2128100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-66ada467-c3d8-e65f-9b93-b46c2942f31e', N'amazon-berkeley-objects', N'66ada467-c3d8-e65f-9b93-b46c2942f31e', N'Nhẫn đính đá trong suốt giác cắt vuông', N'Trang sức', 231475000, N'Nhẫn đính đá trong suốt giác cắt vuông.

Thương hiệu: Amazon Collection.
Mã hoặc tên mẫu: JER00501_121CL06QD00.
Kiểu dáng: Nhẫn.
Khối lượng: 0,00 kg.', N'/products/ai-generated-500/0479-abo-more-66ada467-c3d8-e65f-9b93-b46c2942f31e.webp', N'["Ki\u1EC3u d\u00E1ng: Nh\u1EABn","Kh\u1ED1i l\u01B0\u1EE3ng: 0,00 kg"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/66ada467-c3d8-e65f-9b93-b46c2942f31e', 925900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-6721eeeb-d975-375a-87aa-e61297e8e838', N'amazon-berkeley-objects', N'6721eeeb-d975-375a-87aa-e61297e8e838', N'Tranh họa tiết lá vàng nổi', N'Trang sức', 89150000, N'Tranh họa tiết lá vàng nổi.

Thương hiệu: Rivet.
Mã hoặc tên mẫu: HPC8857C-3030-7.
Chất liệu: Vải bố.
Kiểu dáng: Hiện đại.', N'/products/ai-generated-500/0490-abo-more-6721eeeb-d975-375a-87aa-e61297e8e838.webp', N'["Ch\u1EA5t li\u1EC7u: V\u1EA3i b\u1ED1","Ki\u1EC3u d\u00E1ng: Hi\u1EC7n \u0111\u1EA1i"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/6721eeeb-d975-375a-87aa-e61297e8e838', 356600, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-675c8e13-e176-4297-434f-20b0e0a8146e', N'amazon-berkeley-objects', N'675c8e13-e176-4297-434f-20b0e0a8146e', N'Cọ trang điểm đầu tròn', N'Làm đẹp', 165725000, N'Cọ trang điểm đầu tròn.

Thương hiệu: find..
Mã hoặc tên mẫu: 5400606997127.
Chiều cao: 5,00 cm.
Chiều dài: 20,00 cm.
Chiều rộng: 20,00 cm.', N'/products/ai-generated-500/0197-abo-more-675c8e13-e176-4297-434f-20b0e0a8146e.webp', N'["Chi\u1EC1u cao: 5,00 cm","Chi\u1EC1u d\u00E0i: 20,00 cm","Chi\u1EC1u r\u1ED9ng: 20,00 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/675c8e13-e176-4297-434f-20b0e0a8146e', 662900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-68fa03fa-9f1c-c7e4-c672-807b0cf06544', N'amazon-berkeley-objects', N'68fa03fa-9f1c-c7e4-c672-807b0cf06544', N'Giày tây nam buộc dây đục lỗ màu nâu', N'Trang sức', 559075000, N'Giày tây nam buộc dây đục lỗ màu nâu.

Thương hiệu: find..
Mã hoặc tên mẫu: MPCTJH217MAR5.
Kiểu dáng: Giày đục lỗ trang trí.
Năm mẫu: 2017.', N'/products/ai-generated-500/0494-abo-more-68fa03fa-9f1c-c7e4-c672-807b0cf06544.webp', N'["Ki\u1EC3u d\u00E1ng: Gi\u00E0y \u0111\u1EE5c l\u1ED7 trang tr\u00ED","N\u0103m m\u1EABu: 2017"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/68fa03fa-9f1c-c7e4-c672-807b0cf06544', 2236300, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-68ffd55c-7b69-0e45-b983-926fc21ed2d0', N'amazon-berkeley-objects', N'68ffd55c-7b69-0e45-b983-926fc21ed2d0', N'Viên bổ sung canxi, magiê và vi chất', N'Làm đẹp', 162325000, N'Viên bổ sung canxi, magiê và vi chất.

Thương hiệu: Solimo.
Mã hoặc tên mẫu: 5.40061E+12.
Khối lượng: 0,04 kg.
Chiều cao: 8,00 cm.
Chiều dài: 23,00 cm.
Chiều rộng: 15,50 cm.', N'/products/ai-generated-500/0200-abo-more-68ffd55c-7b69-0e45-b983-926fc21ed2d0.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,04 kg","Chi\u1EC1u cao: 8,00 cm","Chi\u1EC1u d\u00E0i: 23,00 cm","Chi\u1EC1u r\u1ED9ng: 15,50 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/68ffd55c-7b69-0e45-b983-926fc21ed2d0', 649300, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-69103692-1f63-0036-27bb-444f53337209', N'amazon-berkeley-objects', N'69103692-1f63-0036-27bb-444f53337209', N'Bàn trà góc ghế viền kim loại vàng', N'Trang sức', 82200000, N'Bàn trà góc ghế viền kim loại vàng.

Thương hiệu: Rivet.
Mã hoặc tên mẫu: F10842XAM.
Chất liệu: Kim loại.
Khối lượng: 13,15 kg.
Chiều cao: 70,61 cm.
Chiều dài: 58,17 cm.
Chiều rộng: 52,58 cm.', N'/products/ai-generated-500/0496-abo-more-69103692-1f63-0036-27bb-444f53337209.webp', N'["Ch\u1EA5t li\u1EC7u: Kim lo\u1EA1i","Kh\u1ED1i l\u01B0\u1EE3ng: 13,15 kg","Chi\u1EC1u cao: 70,61 cm","Chi\u1EC1u d\u00E0i: 58,17 cm"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/69103692-1f63-0036-27bb-444f53337209', 328800, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-6947b3c7-8bb7-3a5d-dddf-968578886125', N'amazon-berkeley-objects', N'6947b3c7-8bb7-3a5d-dddf-968578886125', N'Bông tai bạc nữ dạng nụ', N'Trang sức', 89600000, N'Bông tai bạc nữ dạng nụ.

Thương hiệu: Amazon Collection.
Mã hoặc tên mẫu: E4084.
Màu sắc: Bạc.
Chất liệu: Kim loại.
Khối lượng: 0,01 kg.
Chiều cao: 1,02 cm.
Chiều dài: 13,21 cm.
Chiều rộng: 10,67 cm.', N'/products/ai-generated-500/0498-abo-more-6947b3c7-8bb7-3a5d-dddf-968578886125.webp', N'["M\u00E0u s\u1EAFc: B\u1EA1c","Ch\u1EA5t li\u1EC7u: Kim lo\u1EA1i","Kh\u1ED1i l\u01B0\u1EE3ng: 0,01 kg","Chi\u1EC1u cao: 1,02 cm"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/6947b3c7-8bb7-3a5d-dddf-968578886125', 358400, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-6a2fad89-ef21-392c-9b0b-1cda3b0476c0', N'amazon-berkeley-objects', N'6a2fad89-ef21-392c-9b0b-1cda3b0476c0', N'Ốp điện thoại dẻo họa tiết bướm', N'Trang sức', 58525000, N'Ốp điện thoại dẻo họa tiết bướm.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10103-SL12414.
Thiết bị tương thích: Gionee A1 Lite.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0500-abo-more-6a2fad89-ef21-392c-9b0b-1cda3b0476c0.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Gionee A1 Lite","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'rose', N'◇', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/6a2fad89-ef21-392c-9b0b-1cda3b0476c0', 234100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-77403fc0-4b75-b1b4-769d-d90b2b7d7062', N'amazon-berkeley-objects', N'77403fc0-4b75-b1b4-769d-d90b2b7d7062', N'Kẹo dẻo bổ sung vi chất từ thực vật', N'Làm đẹp', 506025000, N'Kẹo dẻo bổ sung vi chất từ thực vật.

Thương hiệu: Revly.
Khối lượng: 0,18 kg.
Chiều cao: 11,11 cm.
Chiều dài: 6,39 cm.
Chiều rộng: 6,39 cm.', N'/products/ai-generated-500/0212-abo-more-77403fc0-4b75-b1b4-769d-d90b2b7d7062.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,18 kg","Chi\u1EC1u cao: 11,11 cm","Chi\u1EC1u d\u00E0i: 6,39 cm","Chi\u1EC1u r\u1ED9ng: 6,39 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/77403fc0-4b75-b1b4-769d-d90b2b7d7062', 2024100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-7cd430bb-e0e5-9734-c557-9a5caca3cb15', N'amazon-berkeley-objects', N'7cd430bb-e0e5-9734-c557-9a5caca3cb15', N'Bộ túi lót thùng rác loại 10 lít', N'Làm đẹp', 486550000, N'Bộ túi lót thùng rác loại 10 lít.

Thương hiệu: Solimo.
Mã hoặc tên mẫu: 4513644.
Khối lượng: 0,58 kg.
Chiều cao: 6,00 cm.
Chiều dài: 18,00 cm.
Chiều rộng: 10,00 cm.', N'/products/ai-generated-500/0217-abo-more-7cd430bb-e0e5-9734-c557-9a5caca3cb15.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,58 kg","Chi\u1EC1u cao: 6,00 cm","Chi\u1EC1u d\u00E0i: 18,00 cm","Chi\u1EC1u r\u1ED9ng: 10,00 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/7cd430bb-e0e5-9734-c557-9a5caca3cb15', 1946200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-7d702a44-f2d9-870e-8ead-2c2ac44e4d81', N'amazon-berkeley-objects', N'7d702a44-f2d9-870e-8ead-2c2ac44e4d81', N'Tã em bé siêu khô cỡ bốn', N'Làm đẹp', 392200000, N'Tã em bé siêu khô cỡ bốn.

Thương hiệu: Mama Bear.
Mã hoặc tên mẫu: 5400606982666.
Khối lượng: 0,30 kg.
Chiều cao: 4,00 cm.
Chiều dài: 20,00 cm.
Chiều rộng: 10,00 cm.', N'/products/ai-generated-500/0221-abo-more-7d702a44-f2d9-870e-8ead-2c2ac44e4d81.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,30 kg","Chi\u1EC1u cao: 4,00 cm","Chi\u1EC1u d\u00E0i: 20,00 cm","Chi\u1EC1u r\u1ED9ng: 10,00 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/7d702a44-f2d9-870e-8ead-2c2ac44e4d81', 1568800, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-88079bbf-a1bc-d41d-6c86-7f34e1911e29', N'amazon-berkeley-objects', N'88079bbf-a1bc-d41d-6c86-7f34e1911e29', N'Viên bổ sung đa vi chất cho nữ', N'Làm đẹp', 150825000, N'Viên bổ sung đa vi chất cho nữ.

Thương hiệu: SOLIMO.
Khối lượng: 0,25 kg.
Chiều cao: 11,43 cm.
Chiều dài: 6,05 cm.
Chiều rộng: 6,05 cm.', N'/products/ai-generated-500/0225-abo-more-88079bbf-a1bc-d41d-6c86-7f34e1911e29.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,25 kg","Chi\u1EC1u cao: 11,43 cm","Chi\u1EC1u d\u00E0i: 6,05 cm","Chi\u1EC1u r\u1ED9ng: 6,05 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/88079bbf-a1bc-d41d-6c86-7f34e1911e29', 603300, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-8e4a9692-51ae-242b-a03f-6a5e10cbdfd4', N'amazon-berkeley-objects', N'8e4a9692-51ae-242b-a03f-6a5e10cbdfd4', N'Giá đỡ máy tính bằng nhôm gấp gọn', N'Laptop', 96700000, N'Giá đỡ máy tính bằng nhôm gấp gọn.

Thương hiệu: AmazonBasics.', N'/products/ai-generated-500/0041-abo-more-8e4a9692-51ae-242b-a03f-6a5e10cbdfd4.webp', N'["Gi\u00E1 \u0111\u1EE1 m\u00E1y t\u00EDnh b\u1EB1ng nh\u00F4m g\u1EA5p g\u1ECDn"]', N'blue', N'▣', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/8e4a9692-51ae-242b-a03f-6a5e10cbdfd4', 386800, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-8e6d5e31-69a7-a206-2859-8c51c9e76759', N'amazon-berkeley-objects', N'8e6d5e31-69a7-a206-2859-8c51c9e76759', N'Viên bổ sung vi chất trước sinh', N'Làm đẹp', 487125000, N'Viên bổ sung vi chất trước sinh.

Thương hiệu: Amazon Elements.
Khối lượng: 0,23 kg.
Chiều cao: 11,99 cm.
Chiều dài: 6,90 cm.
Chiều rộng: 6,90 cm.', N'/products/ai-generated-500/0230-abo-more-8e6d5e31-69a7-a206-2859-8c51c9e76759.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,23 kg","Chi\u1EC1u cao: 11,99 cm","Chi\u1EC1u d\u00E0i: 6,90 cm","Chi\u1EC1u r\u1ED9ng: 6,90 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/8e6d5e31-69a7-a206-2859-8c51c9e76759', 1948500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-90c92d98-d128-4ff5-2185-4d11e3ec7f73', N'amazon-berkeley-objects', N'90c92d98-d128-4ff5-2185-4d11e3ec7f73', N'Túi du lịch đựng mỹ phẩm màu tím', N'Làm đẹp', 504125000, N'Túi du lịch đựng mỹ phẩm màu tím.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: Sol_Lgge_113.
Chất liệu: Vải.
Khối lượng: 0,27 kg.
Chiều cao: 8,90 cm.
Chiều dài: 25,40 cm.
Chiều rộng: 21,00 cm.', N'/products/ai-generated-500/0233-abo-more-90c92d98-d128-4ff5-2185-4d11e3ec7f73.webp', N'["Ch\u1EA5t li\u1EC7u: V\u1EA3i","Kh\u1ED1i l\u01B0\u1EE3ng: 0,27 kg","Chi\u1EC1u cao: 8,90 cm","Chi\u1EC1u d\u00E0i: 25,40 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/90c92d98-d128-4ff5-2185-4d11e3ec7f73', 2016500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-90e3b073-e033-3907-ba8e-2155f70f710e', N'amazon-berkeley-objects', N'90e3b073-e033-3907-ba8e-2155f70f710e', N'Bộ viên bổ sung vi chất', N'Làm đẹp', 290500000, N'Bộ viên bổ sung vi chất.

Thương hiệu: Amazon Elements.', N'/products/ai-generated-500/0236-abo-more-90e3b073-e033-3907-ba8e-2155f70f710e.webp', N'["B\u1ED9 vi\u00EAn b\u1ED5 sung vi ch\u1EA5t"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/90e3b073-e033-3907-ba8e-2155f70f710e', 1162000, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-92448e57-692e-c744-5a2c-96311b0fdc8f', N'amazon-berkeley-objects', N'92448e57-692e-c744-5a2c-96311b0fdc8f', N'Nước giặt sinh học', N'Làm đẹp', 514875000, N'Nước giặt sinh học.

Thương hiệu: Presto!.', N'/products/ai-generated-500/0241-abo-more-92448e57-692e-c744-5a2c-96311b0fdc8f.webp', N'["N\u01B0\u1EDBc gi\u1EB7t sinh h\u1ECDc"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/92448e57-692e-c744-5a2c-96311b0fdc8f', 2059500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-939817e5-e8db-aa54-8589-f0e62241db98', N'amazon-berkeley-objects', N'939817e5-e8db-aa54-8589-f0e62241db98', N'Bột điện giải vị anh đào', N'Làm đẹp', 538875000, N'Bột điện giải vị anh đào.

Thương hiệu: Amazon Basic Care.
Khối lượng: 0,00 kg.
Chiều cao: 15,16 cm.
Chiều dài: 3,66 cm.
Chiều rộng: 7,47 cm.', N'/products/ai-generated-500/0244-abo-more-939817e5-e8db-aa54-8589-f0e62241db98.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,00 kg","Chi\u1EC1u cao: 15,16 cm","Chi\u1EC1u d\u00E0i: 3,66 cm","Chi\u1EC1u r\u1ED9ng: 7,47 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/939817e5-e8db-aa54-8589-f0e62241db98', 2155500, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-94e79bec-a9d0-de8b-5edf-1f12f42cd358', N'amazon-berkeley-objects', N'94e79bec-a9d0-de8b-5edf-1f12f42cd358', N'Viên dầu cá đậm đặc', N'Làm đẹp', 106150000, N'Viên dầu cá đậm đặc.

Thương hiệu: Solimo.
Mã hoặc tên mẫu: 5400606009585.
Khối lượng: 0,05 kg.
Chiều cao: 8,00 cm.
Chiều dài: 23,00 cm.
Chiều rộng: 15,50 cm.', N'/products/ai-generated-500/0248-abo-more-94e79bec-a9d0-de8b-5edf-1f12f42cd358.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg","Chi\u1EC1u cao: 8,00 cm","Chi\u1EC1u d\u00E0i: 23,00 cm","Chi\u1EC1u r\u1ED9ng: 15,50 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/94e79bec-a9d0-de8b-5edf-1f12f42cd358', 424600, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-a74f1254-419c-84aa-7ab0-8c5d277c8ecf', N'amazon-berkeley-objects', N'a74f1254-419c-84aa-7ab0-8c5d277c8ecf', N'Vali kéo đựng máy tính màu đen', N'Laptop', 256775000, N'Vali kéo đựng máy tính màu đen.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: ZH1310215R3.
Khối lượng: 2,29 kg.
Chiều cao: 19,05 cm.
Chiều dài: 41,91 cm.
Chiều rộng: 36,83 cm.', N'/products/ai-generated-500/0048-abo-more-a74f1254-419c-84aa-7ab0-8c5d277c8ecf.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 2,29 kg","Chi\u1EC1u cao: 19,05 cm","Chi\u1EC1u d\u00E0i: 41,91 cm","Chi\u1EC1u r\u1ED9ng: 36,83 cm"]', N'blue', N'▣', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/a74f1254-419c-84aa-7ab0-8c5d277c8ecf', 1027100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-a7bedecd-ee71-4847-33b3-c31f952260bb', N'amazon-berkeley-objects', N'a7bedecd-ee71-4847-33b3-c31f952260bb', N'Giấy vệ sinh hai lớp', N'Làm đẹp', 284000000, N'Giấy vệ sinh hai lớp.

Thương hiệu: Solimo.
Khối lượng: 0,87 kg.
Chiều cao: 20,32 cm.
Chiều dài: 33,66 cm.
Chiều rộng: 11,30 cm.', N'/products/ai-generated-500/0260-abo-more-a7bedecd-ee71-4847-33b3-c31f952260bb.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,87 kg","Chi\u1EC1u cao: 20,32 cm","Chi\u1EC1u d\u00E0i: 33,66 cm","Chi\u1EC1u r\u1ED9ng: 11,30 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/a7bedecd-ee71-4847-33b3-c31f952260bb', 1136000, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-ac73ad3c-3230-1e18-aad2-5f3042e96726', N'amazon-berkeley-objects', N'ac73ad3c-3230-1e18-aad2-5f3042e96726', N'Bộ ba đôi lót giày thoáng khí', N'Làm đẹp', 251775000, N'Bộ ba đôi lót giày thoáng khí.

Thương hiệu: Amazon Basic Care.
Mã hoặc tên mẫu: 5400606984059.
Khối lượng: 0,18 kg.
Chiều cao: 33,00 cm.
Chiều dài: 11,50 cm.
Chiều rộng: 2,30 cm.', N'/products/ai-generated-500/0266-abo-more-ac73ad3c-3230-1e18-aad2-5f3042e96726.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,18 kg","Chi\u1EC1u cao: 33,00 cm","Chi\u1EC1u d\u00E0i: 11,50 cm","Chi\u1EC1u r\u1ED9ng: 2,30 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/ac73ad3c-3230-1e18-aad2-5f3042e96726', 1007100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-af94e09c-f15a-c656-f20b-a776248afb5f', N'amazon-berkeley-objects', N'af94e09c-f15a-c656-f20b-a776248afb5f', N'Xịt thơm phòng hương hoa', N'Làm đẹp', 224275000, N'Xịt thơm phòng hương hoa.

Thương hiệu: Presto!.', N'/products/ai-generated-500/0271-abo-more-af94e09c-f15a-c656-f20b-a776248afb5f.webp', N'["X\u1ECBt th\u01A1m ph\u00F2ng h\u01B0\u01A1ng hoa"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/af94e09c-f15a-c656-f20b-a776248afb5f', 897100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-b06f190d-88f7-6e98-604a-7bc0570c4a2c', N'amazon-berkeley-objects', N'b06f190d-88f7-6e98-604a-7bc0570c4a2c', N'Khăn ướt dịu nhẹ cho em bé', N'Làm đẹp', 268850000, N'Khăn ướt dịu nhẹ cho em bé.

Thương hiệu: Mama Bear.
Mã hoặc tên mẫu: MB3AR_1.
Chiều cao: 29,70 cm.
Chiều dài: 28,50 cm.
Chiều rộng: 18,50 cm.', N'/products/ai-generated-500/0275-abo-more-b06f190d-88f7-6e98-604a-7bc0570c4a2c.webp', N'["Chi\u1EC1u cao: 29,70 cm","Chi\u1EC1u d\u00E0i: 28,50 cm","Chi\u1EC1u r\u1ED9ng: 18,50 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/b06f190d-88f7-6e98-604a-7bc0570c4a2c', 1075400, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-b8bcb0c1-d1a1-def6-c2fb-3d236f1723fb', N'amazon-berkeley-objects', N'b8bcb0c1-d1a1-def6-c2fb-3d236f1723fb', N'Bộ ba đầu bàn chải điện thay thế', N'Làm đẹp', 272025000, N'Bộ ba đầu bàn chải điện thay thế.

Thương hiệu: Solimo.
Khối lượng: 0,04 kg.
Chiều cao: 22,10 cm.
Chiều dài: 2,36 cm.
Chiều rộng: 6,05 cm.', N'/products/ai-generated-500/0281-abo-more-b8bcb0c1-d1a1-def6-c2fb-3d236f1723fb.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,04 kg","Chi\u1EC1u cao: 22,10 cm","Chi\u1EC1u d\u00E0i: 2,36 cm","Chi\u1EC1u r\u1ED9ng: 6,05 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/b8bcb0c1-d1a1-def6-c2fb-3d236f1723fb', 1088100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-be2c7cb1-646f-3566-a9f2-039e9ddca902', N'amazon-berkeley-objects', N'be2c7cb1-646f-3566-a9f2-039e9ddca902', N'Dung dịch cồn sát khuẩn 70%', N'Làm đẹp', 52350000, N'Dung dịch cồn sát khuẩn 70%.

Thương hiệu: Solimo.
Khối lượng: 0,84 kg.
Chiều cao: 20,42 cm.
Chiều dài: 8,20 cm.
Chiều rộng: 8,20 cm.', N'/products/ai-generated-500/0288-abo-more-be2c7cb1-646f-3566-a9f2-039e9ddca902.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,84 kg","Chi\u1EC1u cao: 20,42 cm","Chi\u1EC1u d\u00E0i: 8,20 cm","Chi\u1EC1u r\u1ED9ng: 8,20 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/be2c7cb1-646f-3566-a9f2-039e9ddca902', 209400, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-c218c002-ab6b-a089-9e95-9d1831fcbc91', N'amazon-berkeley-objects', N'c218c002-ab6b-a089-9e95-9d1831fcbc91', N'Tã quần người lớn cỡ vừa', N'Làm đẹp', 379575000, N'Tã quần người lớn cỡ vừa.

Thương hiệu: Amazon Brand - Solimo.
Chiều cao: 170,00 cm.
Chiều dài: 195,00 cm.
Chiều rộng: 140,00 cm.', N'/products/ai-generated-500/0291-abo-more-c218c002-ab6b-a089-9e95-9d1831fcbc91.webp', N'["Chi\u1EC1u cao: 170,00 cm","Chi\u1EC1u d\u00E0i: 195,00 cm","Chi\u1EC1u r\u1ED9ng: 140,00 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/c218c002-ab6b-a089-9e95-9d1831fcbc91', 1518300, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-d7efc328-255b-4659-b393-b1e91cd9a4c1', N'amazon-berkeley-objects', N'd7efc328-255b-4659-b393-b1e91cd9a4c1', N'Bộ ba cuộn giấy lau bếp khổ lớn', N'Làm đẹp', 271850000, N'Bộ ba cuộn giấy lau bếp khổ lớn.

Thương hiệu: Presto!.
Mã hoặc tên mẫu: 5400606000339.
Chiều cao: 66,04 cm.
Chiều dài: 92,71 cm.
Chiều rộng: 34,29 cm.', N'/products/ai-generated-500/0309-abo-more-d7efc328-255b-4659-b393-b1e91cd9a4c1.webp', N'["Chi\u1EC1u cao: 66,04 cm","Chi\u1EC1u d\u00E0i: 92,71 cm","Chi\u1EC1u r\u1ED9ng: 34,29 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/d7efc328-255b-4659-b393-b1e91cd9a4c1', 1087400, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-d819f5dd-f0db-d535-3f17-9db1384b1e08', N'amazon-berkeley-objects', N'd819f5dd-f0db-d535-3f17-9db1384b1e08', N'Khăn ướt đa dụng', N'Làm đẹp', 389225000, N'Khăn ướt đa dụng.

Thương hiệu: Amazon Elements.', N'/products/ai-generated-500/0311-abo-more-d819f5dd-f0db-d535-3f17-9db1384b1e08.webp', N'["Kh\u0103n \u01B0\u1EDBt \u0111a d\u1EE5ng"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/d819f5dd-f0db-d535-3f17-9db1384b1e08', 1556900, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-dca92271-f294-c0e4-783c-291f583beb62', N'amazon-berkeley-objects', N'dca92271-f294-c0e4-783c-291f583beb62', N'Kem chăm sóc tóc từ lá móng', N'Làm đẹp', 441100000, N'Kem chăm sóc tóc từ lá móng.

Thương hiệu: Amazon Brand - Solimo.
Khối lượng: 0,30 kg.', N'/products/ai-generated-500/0316-abo-more-dca92271-f294-c0e4-783c-291f583beb62.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,30 kg"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/dca92271-f294-c0e4-783c-291f583beb62', 1764400, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-de19cfe4-7567-2e94-ce4c-dce3fb48d12e', N'amazon-berkeley-objects', N'de19cfe4-7567-2e94-ce4c-dce3fb48d12e', N'Hộp tròn đựng cọ và mỹ phẩm cỡ lớn', N'Làm đẹp', 600550000, N'Hộp tròn đựng cọ và mỹ phẩm cỡ lớn.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: 021022-165-A60.
Kiểu dáng: Hình tròn.
Khối lượng: 0,40 kg.
Chiều cao: 12,32 cm.
Chiều dài: 31,24 cm.
Chiều rộng: 14,00 cm.', N'/products/ai-generated-500/0319-abo-more-de19cfe4-7567-2e94-ce4c-dce3fb48d12e.webp', N'["Ki\u1EC3u d\u00E1ng: H\u00ECnh tr\u00F2n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,40 kg","Chi\u1EC1u cao: 12,32 cm","Chi\u1EC1u d\u00E0i: 31,24 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/de19cfe4-7567-2e94-ce4c-dce3fb48d12e', 2402200, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-e785c346-98be-c364-c6b6-534b7e51f4ea', N'amazon-berkeley-objects', N'e785c346-98be-c364-c6b6-534b7e51f4ea', N'Giá đựng xà phòng thép không gỉ', N'Làm đẹp', 208025000, N'Giá đựng xà phòng thép không gỉ.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: sol_ut_29.
Màu sắc: Trắng.
Chất liệu: Thép không gỉ.', N'/products/ai-generated-500/0326-abo-more-e785c346-98be-c364-c6b6-534b7e51f4ea.webp', N'["M\u00E0u s\u1EAFc: Tr\u1EAFng","Ch\u1EA5t li\u1EC7u: Th\u00E9p kh\u00F4ng g\u1EC9"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/e785c346-98be-c364-c6b6-534b7e51f4ea', 832100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-edf6c2cc-9f85-d45e-d2f9-a0eb5f5aa170', N'amazon-berkeley-objects', N'edf6c2cc-9f85-d45e-d2f9-a0eb5f5aa170', N'Bộ sáu chai sữa tắm nam', N'Làm đẹp', 270600000, N'Bộ sáu chai sữa tắm nam.

Thương hiệu: Solimo.
Mã hoặc tên mẫu: 60000862.
Chiều cao: 19,90 cm.
Chiều dài: 16,30 cm.
Chiều rộng: 13,20 cm.', N'/products/ai-generated-500/0330-abo-more-edf6c2cc-9f85-d45e-d2f9-a0eb5f5aa170.webp', N'["Chi\u1EC1u cao: 19,90 cm","Chi\u1EC1u d\u00E0i: 16,30 cm","Chi\u1EC1u r\u1ED9ng: 13,20 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/edf6c2cc-9f85-d45e-d2f9-a0eb5f5aa170', 1082400, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-f04f8191-72d7-51e5-778e-30583aba1b51', N'amazon-berkeley-objects', N'f04f8191-72d7-51e5-778e-30583aba1b51', N'Bộ ba sổ lò xo có vách ngăn', N'Laptop', 505600000, N'Bộ ba sổ lò xo có vách ngăn.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: 583687.
Kiểu dáng: Có túi.
Khối lượng: 0,52 kg.
Chiều cao: 1,38 cm.
Chiều dài: 20,30 cm.
Chiều rộng: 26,75 cm.', N'/products/ai-generated-500/0053-abo-more-f04f8191-72d7-51e5-778e-30583aba1b51.webp', N'["Ki\u1EC3u d\u00E1ng: C\u00F3 t\u00FAi","Kh\u1ED1i l\u01B0\u1EE3ng: 0,52 kg","Chi\u1EC1u cao: 1,38 cm","Chi\u1EC1u d\u00E0i: 20,30 cm"]', N'blue', N'▣', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/f04f8191-72d7-51e5-778e-30583aba1b51', 2022400, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'abo-more-f5e4e47f-8c7b-6200-5554-6269b8ee6cc0', N'amazon-berkeley-objects', N'f5e4e47f-8c7b-6200-5554-6269b8ee6cc0', N'Đai nâng đỡ lưng điều chỉnh được', N'Làm đẹp', 260025000, N'Đai nâng đỡ lưng điều chỉnh được.

Thương hiệu: WellWear.
Chiều cao: 25,40 cm.
Chiều dài: 7,62 cm.
Chiều rộng: 8,89 cm.', N'/products/ai-generated-500/0338-abo-more-f5e4e47f-8c7b-6200-5554-6269b8ee6cc0.webp', N'["Chi\u1EC1u cao: 25,40 cm","Chi\u1EC1u d\u00E0i: 7,62 cm","Chi\u1EC1u r\u1ED9ng: 8,89 cm"]', N'green', N'✿', N'Nguồn mẫu', N'https://store.halukaksoy.dev/api/products/f5e4e47f-8c7b-6200-5554-6269b8ee6cc0', 1040100, N'USD', N'2026-09-27T08:05:08.615Z', 0, 20),
  (N'demo-00069c39-b796-4661-46fc-eae82c7ce998', N'mock-store-api', N'00069c39-b796-4661-46fc-eae82c7ce998', N'Ốp điện thoại dẻo trong suốt họa tiết trang trí', N'Linh kiện', 4978000, N'Ốp điện thoại dẻo trong suốt họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: Realme C2.
Thiết bị tương thích: Realme C2.
Chất liệu: Silicôn.
Kiểu dáng: Chuyên dụng.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0009-demo-00069c39-b796-4661-46fc-eae82c7ce998.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Realme C2","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Ki\u1EC3u d\u00E1ng: Chuy\u00EAn d\u1EE5ng","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/00069c39-b796-4661-46fc-eae82c7ce998', 19913, N'USD', N'2026-09-25T15:26:07.397Z', 0, 20),
  (N'demo-00b7e2ee-fdc8-7e6f-9606-00e220d26276', N'mock-store-api', N'00b7e2ee-fdc8-7e6f-9606-00e220d26276', N'Thảm nhà tắm chống trượt vân sóng', N'Đồ gia dụng', 5235000, N'Thảm nhà tắm chống trượt vân sóng.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: 1M0-065AG-7150/100-PARENT.', N'/products/ai-generated-500/0006-demo-00b7e2ee-fdc8-7e6f-9606-00e220d26276.webp', N'["Th\u1EA3m nh\u00E0 t\u1EAFm ch\u1ED1ng tr\u01B0\u1EE3t v\u00E2n s\u00F3ng"]', N'sand', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/00b7e2ee-fdc8-7e6f-9606-00e220d26276', 20938, N'USD', N'2026-09-24T16:36:14.871Z', 0, 20),
  (N'demo-01173e44-c0cd-f260-6d9f-a2f9f30d40a4', N'mock-store-api', N'01173e44-c0cd-f260-6d9f-a2f9f30d40a4', N'Giày búp bê nữ da bóng màu đen', N'Đồ gia dụng', 335000, N'Giày búp bê nữ da bóng màu đen.

Thương hiệu: Amazon Essentials.
Mã hoặc tên mẫu: Belina.
Khối lượng: 0,11 kg.', N'/products/ai-generated-500/0014-demo-01173e44-c0cd-f260-6d9f-a2f9f30d40a4.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,11 kg"]', N'green', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/01173e44-c0cd-f260-6d9f-a2f9f30d40a4', 1340, N'USD', N'2026-09-25T15:25:48.548Z', 0, 20),
  (N'demo-01a62fc7-2140-2416-375a-6f5abccde3b6', N'mock-store-api', N'01a62fc7-2140-2416-375a-6f5abccde3b6', N'Túi đeo chéo nhỏ ba ngăn khóa kéo', N'Đồ gia dụng', 4033000, N'Túi đeo chéo nhỏ ba ngăn khóa kéo.

Thương hiệu: The Fix.
Mã hoặc tên mẫu: Leah.
Năm mẫu: 2017.
Khối lượng: 0,28 kg.', N'/products/ai-generated-500/0020-demo-01a62fc7-2140-2416-375a-6f5abccde3b6.webp', N'["N\u0103m m\u1EABu: 2017","Kh\u1ED1i l\u01B0\u1EE3ng: 0,28 kg"]', N'green', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/01a62fc7-2140-2416-375a-6f5abccde3b6', 16130, N'USD', N'2026-09-25T15:25:27.887Z', 0, 20),
  (N'demo-01c20737-a521-f24c-8df2-ab997fd95215', N'mock-store-api', N'01c20737-a521-f24c-8df2-ab997fd95215', N'Ốp điện thoại dẻo ô vuông nhiều màu', N'Linh kiện', 4262000, N'Ốp điện thoại dẻo ô vuông nhiều màu.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10005-SL40496.
Thiết bị tương thích: Gionee Pioneer P4S.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0023-demo-01c20737-a521-f24c-8df2-ab997fd95215.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Gionee Pioneer P4S","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/01c20737-a521-f24c-8df2-ab997fd95215', 17046, N'USD', N'2026-09-25T15:27:17.278Z', 0, 20),
  (N'demo-02473c40-c149-5b73-8d29-6dd97ea882d1', N'mock-store-api', N'02473c40-c149-5b73-8d29-6dd97ea882d1', N'Tranh chú chó khung đen', N'Đồ gia dụng', 3829000, N'Tranh chú chó khung đen.

Thương hiệu: Rivet.
Mã hoặc tên mẫu: 6-17314-Parent.', N'/products/ai-generated-500/0028-demo-02473c40-c149-5b73-8d29-6dd97ea882d1.webp', N'["Tranh ch\u00FA ch\u00F3 khung \u0111en"]', N'sand', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/02473c40-c149-5b73-8d29-6dd97ea882d1', 15317, N'USD', N'2026-09-24T16:36:14.871Z', 0, 20),
  (N'demo-034fd4df-3ca6-be68-03f6-f1e6b5954ccd', N'mock-store-api', N'034fd4df-3ca6-be68-03f6-f1e6b5954ccd', N'Tủ giày ba cánh vân gỗ nâu nhạt', N'Đồ gia dụng', 2884000, N'Tủ giày ba cánh vân gỗ nâu nhạt.

Thương hiệu: Movian.
Mã hoặc tên mẫu: Inari.
Chất liệu: Gỗ.
Kiểu dáng: Tủ giày.
Khối lượng: 26,50 kg.
Chiều cao: 128,00 cm.
Chiều dài: 25,00 cm.
Chiều rộng: 75,00 cm.', N'/products/ai-generated-500/0046-demo-034fd4df-3ca6-be68-03f6-f1e6b5954ccd.webp', N'["Ch\u1EA5t li\u1EC7u: G\u1ED7","Ki\u1EC3u d\u00E1ng: T\u1EE7 gi\u00E0y","Kh\u1ED1i l\u01B0\u1EE3ng: 26,50 kg","Chi\u1EC1u cao: 128,00 cm"]', N'green', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/034fd4df-3ca6-be68-03f6-f1e6b5954ccd', 11536, N'USD', N'2026-09-25T15:25:35.979Z', 0, 20),
  (N'demo-0356e51b-615f-352a-e9b5-033779d41b18', N'mock-store-api', N'0356e51b-615f-352a-e9b5-033779d41b18', N'Ốp điện thoại dẻo họa tiết giày thể thao', N'Linh kiện', 3015000, N'Ốp điện thoại dẻo họa tiết giày thể thao.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10259-SL40769.
Thiết bị tương thích: Samsung Galaxy J2.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0030-demo-0356e51b-615f-352a-e9b5-033779d41b18.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Samsung Galaxy J2","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/0356e51b-615f-352a-e9b5-033779d41b18', 12061, N'USD', N'2026-09-25T15:25:35.979Z', 0, 20),
  (N'demo-04760672-8b39-755b-aa57-3688614e3387', N'mock-store-api', N'04760672-8b39-755b-aa57-3688614e3387', N'Chăn vải họa tiết dành cho giường đôi', N'Đồ gia dụng', 607000, N'Chăn vải họa tiết dành cho giường đôi.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: sol_pricomf_1.
Chất liệu: Sợi siêu mịn.', N'/products/ai-generated-500/0058-demo-04760672-8b39-755b-aa57-3688614e3387.webp', N'["Ch\u1EA5t li\u1EC7u: S\u1EE3i si\u00EAu m\u1ECBn"]', N'sand', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/04760672-8b39-755b-aa57-3688614e3387', 2427, N'USD', N'2026-09-24T03:32:05.226Z', 0, 20),
  (N'demo-049d7395-635a-e26e-dd5b-312f827805b5', N'mock-store-api', N'049d7395-635a-e26e-dd5b-312f827805b5', N'Giày bốt nam da lộn cổ lửng', N'Đồ gia dụng', 2565000, N'Giày bốt nam da lộn cổ lửng.

Thương hiệu: find..
Mã hoặc tên mẫu: Dax Suede.', N'/products/ai-generated-500/0064-demo-049d7395-635a-e26e-dd5b-312f827805b5.webp', N'["Gi\u00E0y b\u1ED1t nam da l\u1ED9n c\u1ED5 l\u1EEDng"]', N'green', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/049d7395-635a-e26e-dd5b-312f827805b5', 10260, N'USD', N'2026-09-25T15:26:41.581Z', 0, 20),
  (N'demo-04defbc6-6b4b-d01a-0c59-ba96a414c855', N'mock-store-api', N'04defbc6-6b4b-d01a-0c59-ba96a414c855', N'Bộ bốn hộp vải đựng đồ gấp gọn', N'Đồ gia dụng', 4984000, N'Bộ bốn hộp vải đựng đồ gấp gọn.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: STRBOXGRY-P.', N'/products/ai-generated-500/0071-demo-04defbc6-6b4b-d01a-0c59-ba96a414c855.webp', N'["B\u1ED9 b\u1ED1n h\u1ED9p v\u1EA3i \u0111\u1EF1ng \u0111\u1ED3 g\u1EA5p g\u1ECDn"]', N'sand', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/04defbc6-6b4b-d01a-0c59-ba96a414c855', 19934, N'USD', N'2026-09-24T16:36:14.871Z', 0, 20),
  (N'demo-05203ae1-90ee-e88b-ddf6-60ebd37ab196', N'mock-store-api', N'05203ae1-90ee-e88b-ddf6-60ebd37ab196', N'Xà đơn gắn cửa tập tại nhà', N'Đồ gia dụng', 4122000, N'Xà đơn gắn cửa tập tại nhà.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: IB1022.
Khối lượng: 0,32 kg.
Chiều cao: 19,10 cm.
Chiều dài: 50,80 cm.
Chiều rộng: 7,60 cm.', N'/products/ai-generated-500/0082-demo-05203ae1-90ee-e88b-ddf6-60ebd37ab196.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,32 kg","Chi\u1EC1u cao: 19,10 cm","Chi\u1EC1u d\u00E0i: 50,80 cm","Chi\u1EC1u r\u1ED9ng: 7,60 cm"]', N'blue', N'☀', N'Demo', N'https://store.halukaksoy.dev/api/products/05203ae1-90ee-e88b-ddf6-60ebd37ab196', 16486, N'USD', N'2026-09-24T03:32:05.226Z', 0, 20),
  (N'demo-06b64109-a82d-a7ba-83e1-cbb7cfa1a877', N'mock-store-api', N'06b64109-a82d-a7ba-83e1-cbb7cfa1a877', N'Rau trộn ngô và hạt diêm mạch kèm bò', N'Đồ gia dụng', 1088000, N'Rau trộn ngô và hạt diêm mạch kèm bò.

Thương hiệu: Amazon Kitchen.
Chiều cao: 7,72 cm.
Chiều dài: 17,67 cm.
Chiều rộng: 18,79 cm.', N'/products/ai-generated-500/0090-demo-06b64109-a82d-a7ba-83e1-cbb7cfa1a877.webp', N'["Chi\u1EC1u cao: 7,72 cm","Chi\u1EC1u d\u00E0i: 17,67 cm","Chi\u1EC1u r\u1ED9ng: 18,79 cm"]', N'green', N'✿', N'Demo', N'https://store.halukaksoy.dev/api/products/06b64109-a82d-a7ba-83e1-cbb7cfa1a877', 4350, N'USD', N'2026-09-24T16:36:14.871Z', 0, 20),
  (N'demo-06f15633-046b-f58b-c67b-9f8243a71694', N'mock-store-api', N'06f15633-046b-f58b-c67b-9f8243a71694', N'Khay xà phòng thép không gỉ', N'Đồ gia dụng', 4138000, N'Khay xà phòng thép không gỉ.

Thương hiệu: AmazonBasics.
Chất liệu: Thép không gỉ.', N'/products/ai-generated-500/0095-demo-06f15633-046b-f58b-c67b-9f8243a71694.webp', N'["Ch\u1EA5t li\u1EC7u: Th\u00E9p kh\u00F4ng g\u1EC9"]', N'sand', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/06f15633-046b-f58b-c67b-9f8243a71694', 16550, N'USD', N'2026-09-24T16:36:14.871Z', 0, 20),
  (N'demo-072129cf-4eaa-9854-728f-3a0230ec5927', N'mock-store-api', N'072129cf-4eaa-9854-728f-3a0230ec5927', N'Bộ hai ghế tựa có tay vịn', N'Đồ gia dụng', 5425000, N'Bộ hai ghế tựa có tay vịn.

Thương hiệu: Strathwood by Amazon.com.
Mã hoặc tên mẫu: LD5037-1.
Chất liệu: Nhôm.', N'/products/ai-generated-500/0098-demo-072129cf-4eaa-9854-728f-3a0230ec5927.webp', N'["Ch\u1EA5t li\u1EC7u: Nh\u00F4m"]', N'green', N'✿', N'Demo', N'https://store.halukaksoy.dev/api/products/072129cf-4eaa-9854-728f-3a0230ec5927', 21700, N'USD', N'2026-09-24T16:36:14.871Z', 0, 20),
  (N'demo-07b3e4c2-4b21-db86-19d3-c51633eda04e', N'mock-store-api', N'07b3e4c2-4b21-db86-19d3-c51633eda04e', N'Bộ ga giường trẻ em họa tiết bướm và chấm', N'Đồ gia dụng', 2656000, N'Bộ ga giường trẻ em họa tiết bướm và chấm.

Thương hiệu: Pinzon by Amazon.
Mã hoặc tên mẫu: KBFLS03.
Chất liệu: Vải bông.', N'/products/ai-generated-500/0108-demo-07b3e4c2-4b21-db86-19d3-c51633eda04e.webp', N'["Ch\u1EA5t li\u1EC7u: V\u1EA3i b\u00F4ng"]', N'sand', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/07b3e4c2-4b21-db86-19d3-c51633eda04e', 10625, N'USD', N'2026-09-24T16:36:14.871Z', 0, 20),
  (N'demo-0827f86b-de05-fbb7-61b8-5d6723daf9a3', N'mock-store-api', N'0827f86b-de05-fbb7-61b8-5d6723daf9a3', N'Dép xỏ ngón nữ xanh biển và xanh đậm', N'Đồ gia dụng', 3574000, N'Dép xỏ ngón nữ xanh biển và xanh đậm.

Thương hiệu: Bourge.
Mã hoặc tên mẫu: Gallery-19-08.
Kiểu dáng: Giày xỏ chân.
Khối lượng: 0,26 kg.
Chiều cao: 10,70 cm.
Chiều dài: 27,80 cm.
Chiều rộng: 10,50 cm.', N'/products/ai-generated-500/0113-demo-0827f86b-de05-fbb7-61b8-5d6723daf9a3.webp', N'["Ki\u1EC3u d\u00E1ng: Gi\u00E0y x\u1ECF ch\u00E2n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,26 kg","Chi\u1EC1u cao: 10,70 cm","Chi\u1EC1u d\u00E0i: 27,80 cm"]', N'green', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/0827f86b-de05-fbb7-61b8-5d6723daf9a3', 14295, N'USD', N'2026-09-25T15:24:49.496Z', 0, 20),
  (N'demo-0a0f628b-58a3-0c13-7688-4d0992e60a4d', N'mock-store-api', N'0a0f628b-58a3-0c13-7688-4d0992e60a4d', N'Dép nữ quai kẹp da màu vàng', N'Đồ gia dụng', 5754000, N'Dép nữ quai kẹp da màu vàng.

Thương hiệu: 206 Collective.
Mã hoặc tên mẫu: Cameron.
Khối lượng: 0,19 kg.', N'/products/ai-generated-500/0117-demo-0a0f628b-58a3-0c13-7688-4d0992e60a4d.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,19 kg"]', N'green', N'✿', N'Demo', N'https://store.halukaksoy.dev/api/products/0a0f628b-58a3-0c13-7688-4d0992e60a4d', 23017, N'USD', N'2026-09-24T03:32:05.226Z', 0, 20),
  (N'demo-0a2934ef-113e-6c8e-27c9-0b49d3c50e83', N'mock-store-api', N'0a2934ef-113e-6c8e-27c9-0b49d3c50e83', N'Ốp điện thoại dẻo họa tiết gấu trúc', N'Linh kiện', 3660000, N'Ốp điện thoại dẻo họa tiết gấu trúc.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10597-SL40408.
Thiết bị tương thích: Itel A22 Pro.
Chất liệu: Silicôn.
Kiểu dáng: Họa tiết trang trí.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0036-demo-0a2934ef-113e-6c8e-27c9-0b49d3c50e83.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Itel A22 Pro","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Ki\u1EC3u d\u00E1ng: H\u1ECDa ti\u1EBFt trang tr\u00ED","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/0a2934ef-113e-6c8e-27c9-0b49d3c50e83', 14639, N'USD', N'2026-09-25T15:25:35.979Z', 0, 20),
  (N'demo-0bd1a0c2-0418-079d-37fa-9a8089f62895', N'mock-store-api', N'0bd1a0c2-0418-079d-37fa-9a8089f62895', N'Ớt hun khói nghiền', N'Đồ gia dụng', 4427000, N'Ớt hun khói nghiền.

Thương hiệu: 365 Everyday Value.
Khối lượng: 0,20 kg.
Chiều cao: 10,67 cm.
Chiều dài: 5,33 cm.
Chiều rộng: 5,33 cm.', N'/products/ai-generated-500/0135-demo-0bd1a0c2-0418-079d-37fa-9a8089f62895.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,20 kg","Chi\u1EC1u cao: 10,67 cm","Chi\u1EC1u d\u00E0i: 5,33 cm","Chi\u1EC1u r\u1ED9ng: 5,33 cm"]', N'green', N'✿', N'Demo', N'https://store.halukaksoy.dev/api/products/0bd1a0c2-0418-079d-37fa-9a8089f62895', 17707, N'USD', N'2026-09-24T03:32:05.226Z', 0, 20),
  (N'demo-0c78b70c-de1f-2a50-9946-69ebf393bcb2', N'mock-store-api', N'0c78b70c-de1f-2a50-9946-69ebf393bcb2', N'Ốp điện thoại dẻo họa tiết trang trí', N'Linh kiện', 6248000, N'Ốp điện thoại dẻo họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10766-SL40639.
Thiết bị tương thích: Oppo A7.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0049-demo-0c78b70c-de1f-2a50-9946-69ebf393bcb2.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Oppo A7","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/0c78b70c-de1f-2a50-9946-69ebf393bcb2', 24991, N'USD', N'2026-09-25T15:25:17.437Z', 0, 20),
  (N'demo-0ce5157b-9230-5236-39bc-94a1fb039b70', N'mock-store-api', N'0ce5157b-9230-5236-39bc-94a1fb039b70', N'Khăn tập thể dục thấm mồ hôi', N'Đồ gia dụng', 4924000, N'Khăn tập thể dục thấm mồ hôi.

Thương hiệu: AmazonBasics.', N'/products/ai-generated-500/0148-demo-0ce5157b-9230-5236-39bc-94a1fb039b70.webp', N'["Kh\u0103n t\u1EADp th\u1EC3 d\u1EE5c th\u1EA5m m\u1ED3 h\u00F4i"]', N'blue', N'☀', N'Demo', N'https://store.halukaksoy.dev/api/products/0ce5157b-9230-5236-39bc-94a1fb039b70', 19696, N'USD', N'2026-09-24T03:32:05.226Z', 0, 20),
  (N'demo-0d0cef3e-7d49-e089-851e-86825f9ca7d2', N'mock-store-api', N'0d0cef3e-7d49-e089-851e-86825f9ca7d2', N'Thảm len thủ công họa tiết vườn hè', N'Đồ gia dụng', 996000, N'Thảm len thủ công họa tiết vườn hè.

Thương hiệu: Pinzon by Amazon.
Mã hoặc tên mẫu: 18095-FLOR-5X8.
Khối lượng: 11,11 kg.', N'/products/ai-generated-500/0152-demo-0d0cef3e-7d49-e089-851e-86825f9ca7d2.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 11,11 kg"]', N'sand', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/0d0cef3e-7d49-e089-851e-86825f9ca7d2', 3983, N'USD', N'2026-09-24T16:36:14.871Z', 0, 20),
  (N'demo-0e1a1d26-04ba-0158-684e-fe9bb80ea3ff', N'mock-store-api', N'0e1a1d26-04ba-0158-684e-fe9bb80ea3ff', N'Nước pha chế hữu cơ vị bưởi', N'Đồ gia dụng', 2632000, N'Nước pha chế hữu cơ vị bưởi.

Thương hiệu: Whole Foods Market.
Chiều cao: 13,72 cm.
Chiều dài: 11,05 cm.
Chiều rộng: 11,18 cm.', N'/products/ai-generated-500/0157-demo-0e1a1d26-04ba-0158-684e-fe9bb80ea3ff.webp', N'["Chi\u1EC1u cao: 13,72 cm","Chi\u1EC1u d\u00E0i: 11,05 cm","Chi\u1EC1u r\u1ED9ng: 11,18 cm"]', N'green', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/0e1a1d26-04ba-0158-684e-fe9bb80ea3ff', 10527, N'USD', N'2026-09-25T15:25:27.887Z', 0, 20),
  (N'demo-0e4d0251-e0cc-bc26-da3e-9466d403bf5e', N'mock-store-api', N'0e4d0251-e0cc-bc26-da3e-9466d403bf5e', N'Tạ gang có quai cầm', N'Đồ gia dụng', 1559000, N'Tạ gang có quai cầm.

Thương hiệu: Amazon Basics.
Mã hoặc tên mẫu: KB-70LB.
Khối lượng: 31,75 kg.
Chiều cao: 31,50 cm.
Chiều dài: 21,59 cm.
Chiều rộng: 21,59 cm.', N'/products/ai-generated-500/0161-demo-0e4d0251-e0cc-bc26-da3e-9466d403bf5e.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 31,75 kg","Chi\u1EC1u cao: 31,50 cm","Chi\u1EC1u d\u00E0i: 21,59 cm","Chi\u1EC1u r\u1ED9ng: 21,59 cm"]', N'blue', N'☀', N'Demo', N'https://store.halukaksoy.dev/api/products/0e4d0251-e0cc-bc26-da3e-9466d403bf5e', 6235, N'USD', N'2026-09-24T03:32:05.226Z', 0, 20),
  (N'demo-0fbd4521-13a3-6a2a-5625-a1c1d3c9d07d', N'mock-store-api', N'0fbd4521-13a3-6a2a-5625-a1c1d3c9d07d', N'Viên bổ sung bạch quả', N'Đồ gia dụng', 3091000, N'Viên bổ sung bạch quả.

Thương hiệu: Solimo.
Khối lượng: 0,06 kg.
Chiều cao: 8,81 cm.
Chiều dài: 4,80 cm.
Chiều rộng: 4,80 cm.', N'/products/ai-generated-500/0167-demo-0fbd4521-13a3-6a2a-5625-a1c1d3c9d07d.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,06 kg","Chi\u1EC1u cao: 8,81 cm","Chi\u1EC1u d\u00E0i: 4,80 cm","Chi\u1EC1u r\u1ED9ng: 4,80 cm"]', N'green', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/0fbd4521-13a3-6a2a-5625-a1c1d3c9d07d', 12365, N'USD', N'2026-09-25T15:24:49.496Z', 0, 20),
  (N'demo-0fd73147-ada0-ab7f-c06e-f69983513da4', N'mock-store-api', N'0fd73147-ada0-ab7f-c06e-f69983513da4', N'Khăn ống co giãn che mặt và cổ', N'Đồ gia dụng', 1117000, N'Khăn ống co giãn che mặt và cổ.

Thương hiệu: BINACL.
Mã hoặc tên mẫu: BAMZ1033VC.', N'/products/ai-generated-500/0170-demo-0fd73147-ada0-ab7f-c06e-f69983513da4.webp', N'["Kh\u0103n \u1ED1ng co gi\u00E3n che m\u1EB7t v\u00E0 c\u1ED5"]', N'green', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/0fd73147-ada0-ab7f-c06e-f69983513da4', 4468, N'USD', N'2026-09-25T15:25:05.568Z', 0, 20),
  (N'demo-106246a3-3e62-f259-be15-2863796a4752', N'mock-store-api', N'106246a3-3e62-f259-be15-2863796a4752', N'Ốp điện thoại chống va đập họa tiết trái tim', N'Linh kiện', 3306000, N'Ốp điện thoại chống va đập họa tiết trái tim.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: 1101511.
Thiết bị tương thích: Apple iPhone X/Xs.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0061-demo-106246a3-3e62-f259-be15-2863796a4752.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Apple iPhone X/Xs","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/106246a3-3e62-f259-be15-2863796a4752', 13224, N'USD', N'2026-09-25T15:24:54.798Z', 0, 20),
  (N'demo-10b451e6-6a9d-9adf-fedc-8b289c790786', N'mock-store-api', N'10b451e6-6a9d-9adf-fedc-8b289c790786', N'Bảng viết hai mặt có từ tính khung nhôm', N'Đồ gia dụng', 3851000, N'Bảng viết hai mặt có từ tính khung nhôm.

Thương hiệu: EONO.
Màu sắc: Trắng.
Chất liệu: Kim loại.
Khối lượng: 6,70 kg.', N'/products/ai-generated-500/0176-demo-10b451e6-6a9d-9adf-fedc-8b289c790786.webp', N'["M\u00E0u s\u1EAFc: Tr\u1EAFng","Ch\u1EA5t li\u1EC7u: Kim lo\u1EA1i","Kh\u1ED1i l\u01B0\u1EE3ng: 6,70 kg"]', N'green', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/10b451e6-6a9d-9adf-fedc-8b289c790786', 15404, N'USD', N'2026-09-25T15:26:33.858Z', 0, 20),
  (N'demo-11390d59-f29a-743c-595c-e585b53949d3', N'mock-store-api', N'11390d59-f29a-743c-595c-e585b53949d3', N'Mẫu màu xanh ngọc trầm', N'Đồ gia dụng', 2031000, N'Mẫu màu xanh ngọc trầm.

Thương hiệu: Stone & Beam.
Mã hoặc tên mẫu: 25020071-04.
Màu sắc: Xanh ngọc trầm.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0179-demo-11390d59-f29a-743c-595c-e585b53949d3.webp', N'["M\u00E0u s\u1EAFc: Xanh ng\u1ECDc tr\u1EA7m","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'sand', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/11390d59-f29a-743c-595c-e585b53949d3', 8124, N'USD', N'2026-09-24T16:36:14.871Z', 0, 20),
  (N'demo-13bcfe9e-f2a1-9be1-b0d6-5d8dd6ff3040', N'mock-store-api', N'13bcfe9e-f2a1-9be1-b0d6-5d8dd6ff3040', N'Mẫu màu xanh nhạt', N'Đồ gia dụng', 4465000, N'Mẫu màu xanh nhạt.

Thương hiệu: Rivet.
Mã hoặc tên mẫu: 25010030.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0184-demo-13bcfe9e-f2a1-9be1-b0d6-5d8dd6ff3040.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'green', N'✿', N'Demo', N'https://store.halukaksoy.dev/api/products/13bcfe9e-f2a1-9be1-b0d6-5d8dd6ff3040', 17858, N'USD', N'2026-09-24T03:32:05.226Z', 0, 20),
  (N'demo-1741bf22-88a8-c5a4-8be3-0bba00be5ac5', N'mock-store-api', N'1741bf22-88a8-c5a4-8be3-0bba00be5ac5', N'Ghế dài đôi bọc nệm', N'Đồ gia dụng', 3194000, N'Ghế dài đôi bọc nệm.

Thương hiệu: Rivet.
Mã hoặc tên mẫu: Brooker.
Khối lượng: 41,41 kg.
Chiều cao: 88,01 cm.
Chiều dài: 164,01 cm.
Chiều rộng: 97,00 cm.', N'/products/ai-generated-500/0204-demo-1741bf22-88a8-c5a4-8be3-0bba00be5ac5.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 41,41 kg","Chi\u1EC1u cao: 88,01 cm","Chi\u1EC1u d\u00E0i: 164,01 cm","Chi\u1EC1u r\u1ED9ng: 97,00 cm"]', N'green', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/1741bf22-88a8-c5a4-8be3-0bba00be5ac5', 12774, N'USD', N'2026-09-25T15:26:17.233Z', 0, 20),
  (N'demo-184ec795-042e-3e32-b6de-8c6199a5cc80', N'mock-store-api', N'184ec795-042e-3e32-b6de-8c6199a5cc80', N'Ốp điện thoại dẻo họa tiết mặt cười', N'Linh kiện', 1855000, N'Ốp điện thoại dẻo họa tiết mặt cười.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10403-SL13243.
Thiết bị tương thích: 10.or G.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0074-demo-184ec795-042e-3e32-b6de-8c6199a5cc80.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: 10.or G","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/184ec795-042e-3e32-b6de-8c6199a5cc80', 7420, N'USD', N'2026-09-25T15:25:35.980Z', 0, 20),
  (N'demo-1973ff21-2ab1-abf4-9901-259100a037a1', N'mock-store-api', N'1973ff21-2ab1-abf4-9901-259100a037a1', N'Kệ tivi hai cánh mở và một ngăn kéo', N'Đồ gia dụng', 3621000, N'Kệ tivi hai cánh mở và một ngăn kéo.

Thương hiệu: Movian.
Mã hoặc tên mẫu: Ljungan.
Chất liệu: Gỗ dăm với tay nắm và chân kim loại màu đen.
Kiểu dáng: Kệ tivi.
Khối lượng: 43,39 kg.
Chiều cao: 50,00 cm.
Chiều dài: 165,00 cm.
Chiều rộng: 40,00 cm.', N'/products/ai-generated-500/0209-demo-1973ff21-2ab1-abf4-9901-259100a037a1.webp', N'["Ch\u1EA5t li\u1EC7u: G\u1ED7 d\u0103m v\u1EDBi tay n\u1EAFm v\u00E0 ch\u00E2n kim lo\u1EA1i m\u00E0u \u0111en","Ki\u1EC3u d\u00E1ng: K\u1EC7 tivi","Kh\u1ED1i l\u01B0\u1EE3ng: 43,39 kg","Chi\u1EC1u cao: 50,00 cm"]', N'green', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/1973ff21-2ab1-abf4-9901-259100a037a1', 14485, N'USD', N'2026-09-25T15:25:11.511Z', 0, 20),
  (N'demo-19913b03-b428-c4cc-1f8f-657a53b0cb81', N'mock-store-api', N'19913b03-b428-c4cc-1f8f-657a53b0cb81', N'Đồ gia dụng chờ bổ sung thông tin', N'Đồ gia dụng', 4345000, N'Đồ gia dụng chờ bổ sung thông tin.

Thương hiệu: Stone & Beam.
Mã hoặc tên mẫu: PB5605VLVBR.
Màu sắc: Nhung đỏ rượu.
Khối lượng: 28,58 kg.
Chiều cao: 86,36 cm.
Chiều dài: 73,66 cm.
Chiều rộng: 73,66 cm.
Nguồn hiện chỉ có mã, màu và kích thước; chưa đủ thông tin xác định loại sản phẩm. Cần bổ sung thông tin trước khi chọn mua.', N'/products/ai-generated-500/0211-demo-19913b03-b428-c4cc-1f8f-657a53b0cb81.webp', N'["M\u00E0u s\u1EAFc: Nhung \u0111\u1ECF r\u01B0\u1EE3u","Kh\u1ED1i l\u01B0\u1EE3ng: 28,58 kg","Chi\u1EC1u cao: 86,36 cm","Chi\u1EC1u d\u00E0i: 73,66 cm"]', N'green', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/19913b03-b428-c4cc-1f8f-657a53b0cb81', 17378, N'USD', N'2026-09-25T15:26:07.397Z', 0, 20),
  (N'demo-19e31099-1db2-e944-e6d3-c9ee8a7ff39b', N'mock-store-api', N'19e31099-1db2-e944-e6d3-c9ee8a7ff39b', N'Thảm len dệt móc họa tiết sọc', N'Đồ gia dụng', 4618000, N'Thảm len dệt móc họa tiết sọc.

Thương hiệu: Pinzon by Amazon.
Mã hoặc tên mẫu: Nantucket Stripe.
Chất liệu: Len.', N'/products/ai-generated-500/0214-demo-19e31099-1db2-e944-e6d3-c9ee8a7ff39b.webp', N'["Ch\u1EA5t li\u1EC7u: Len"]', N'sand', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/19e31099-1db2-e944-e6d3-c9ee8a7ff39b', 18473, N'USD', N'2026-09-24T16:36:14.871Z', 0, 20),
  (N'demo-1a1fad0f-b701-f5b7-0f26-2f3dabe729b3', N'mock-store-api', N'1a1fad0f-b701-f5b7-0f26-2f3dabe729b3', N'Hạt điều rang vị dừa và đường thắng', N'Tự Thiết Kế', 5406000, N'Hạt điều rang vị dừa và đường thắng.

Thương hiệu: Wickedly Prime.
Khối lượng: 0,64 kg.
Chiều cao: 10,16 cm.
Chiều dài: 30,48 cm.
Chiều rộng: 27,94 cm.', N'/products/ai-generated-500/0012-demo-1a1fad0f-b701-f5b7-0f26-2f3dabe729b3.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,64 kg","Chi\u1EC1u cao: 10,16 cm","Chi\u1EC1u d\u00E0i: 30,48 cm","Chi\u1EC1u r\u1ED9ng: 27,94 cm"]', N'sand', N'✿', N'Demo', N'https://store.halukaksoy.dev/api/products/1a1fad0f-b701-f5b7-0f26-2f3dabe729b3', 21623, N'USD', N'2026-09-25T15:25:21.668Z', 0, 20),
  (N'demo-1a80c0a8-8cb8-a415-06f5-1532378c91a1', N'mock-store-api', N'1a80c0a8-8cb8-a415-06f5-1532378c91a1', N'Ốp điện thoại cứng họa tiết trang trí', N'Linh kiện', 4556000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8378-SL40626.
Thiết bị tương thích: LG K10.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0079-demo-1a80c0a8-8cb8-a415-06f5-1532378c91a1.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: LG K10","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/1a80c0a8-8cb8-a415-06f5-1532378c91a1', 18225, N'USD', N'2026-09-25T15:25:41.425Z', 0, 20),
  (N'demo-1ae9fd61-c685-7a5e-5f32-b698a7a53ee6', N'mock-store-api', N'1ae9fd61-c685-7a5e-5f32-b698a7a53ee6', N'Lõi lọc nước thay thế cho tủ lạnh', N'Đồ gia dụng', 1923000, N'Lõi lọc nước thay thế cho tủ lạnh.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: EFF-6007-1-A.', N'/products/ai-generated-500/0220-demo-1ae9fd61-c685-7a5e-5f32-b698a7a53ee6.webp', N'["L\u00F5i l\u1ECDc n\u01B0\u1EDBc thay th\u1EBF cho t\u1EE7 l\u1EA1nh"]', N'sand', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/1ae9fd61-c685-7a5e-5f32-b698a7a53ee6', 7693, N'USD', N'2026-09-24T16:36:14.871Z', 0, 20),
  (N'demo-1b1f768f-e407-8f43-d381-3c67d6989cf0', N'mock-store-api', N'1b1f768f-e407-8f43-d381-3c67d6989cf0', N'Khăn ướt em bé hương tươi mát', N'Đồ gia dụng', 4187000, N'Khăn ướt em bé hương tươi mát.

Thương hiệu: Amazon Elements.
Kiểu dáng: Hương tươi mát.
Chiều cao: 24,93 cm.
Chiều dài: 36,03 cm.
Chiều rộng: 22,06 cm.', N'/products/ai-generated-500/0227-demo-1b1f768f-e407-8f43-d381-3c67d6989cf0.webp', N'["Ki\u1EC3u d\u00E1ng: H\u01B0\u01A1ng t\u01B0\u01A1i m\u00E1t","Chi\u1EC1u cao: 24,93 cm","Chi\u1EC1u d\u00E0i: 36,03 cm","Chi\u1EC1u r\u1ED9ng: 22,06 cm"]', N'green', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/1b1f768f-e407-8f43-d381-3c67d6989cf0', 16746, N'USD', N'2026-09-25T15:27:13.515Z', 0, 20),
  (N'demo-1b2d6ed2-fe6a-5a9b-6f58-fd88d4ab749a', N'mock-store-api', N'1b2d6ed2-fe6a-5a9b-6f58-fd88d4ab749a', N'Quạt cửa sổ hai cánh đảo chiều gió', N'Đồ gia dụng', 2416000, N'Quạt cửa sổ hai cánh đảo chiều gió.

Thương hiệu: AmazonBasics.
Màu sắc: Trắng.
Kiểu dáng: Điều khiển bằng tay.
Khối lượng: 2,79 kg.
Chiều cao: 32,00 cm.
Chiều dài: 59,51 cm.
Chiều rộng: 13,59 cm.', N'/products/ai-generated-500/0228-demo-1b2d6ed2-fe6a-5a9b-6f58-fd88d4ab749a.webp', N'["M\u00E0u s\u1EAFc: Tr\u1EAFng","Ki\u1EC3u d\u00E1ng: \u0110i\u1EC1u khi\u1EC3n b\u1EB1ng tay","Kh\u1ED1i l\u01B0\u1EE3ng: 2,79 kg","Chi\u1EC1u cao: 32,00 cm"]', N'green', N'✿', N'Demo', N'https://store.halukaksoy.dev/api/products/1b2d6ed2-fe6a-5a9b-6f58-fd88d4ab749a', 9664, N'USD', N'2026-09-24T16:36:14.871Z', 0, 20),
  (N'demo-1bca51a0-9bac-58ac-471b-428fc362b824', N'mock-store-api', N'1bca51a0-9bac-58ac-471b-428fc362b824', N'Mũ len vải mềm màu đen', N'Linh kiện', 4159000, N'Mũ len vải mềm màu đen.

Thương hiệu: Goodthreads.
Mã hoặc tên mẫu: GT19411474.', N'/products/ai-generated-500/0084-demo-1bca51a0-9bac-58ac-471b-428fc362b824.webp', N'["M\u0169 len v\u1EA3i m\u1EC1m m\u00E0u \u0111en"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/1bca51a0-9bac-58ac-471b-428fc362b824', 16634, N'USD', N'2026-09-25T15:25:57.529Z', 0, 20),
  (N'demo-1d0a0a98-240b-86cc-a1ec-209d64474324', N'mock-store-api', N'1d0a0a98-240b-86cc-a1ec-209d64474324', N'Mũ lưỡi trai phẳng co giãn', N'Đồ gia dụng', 2561000, N'Mũ lưỡi trai phẳng co giãn.

Thương hiệu: Amazon Gear.
Mã hoặc tên mẫu: PTS20BS-P.', N'/products/ai-generated-500/0235-demo-1d0a0a98-240b-86cc-a1ec-209d64474324.webp', N'["M\u0169 l\u01B0\u1EE1i trai ph\u1EB3ng co gi\u00E3n"]', N'blue', N'☀', N'Demo', N'https://store.halukaksoy.dev/api/products/1d0a0a98-240b-86cc-a1ec-209d64474324', 10245, N'USD', N'2026-09-24T03:32:05.226Z', 0, 20),
  (N'demo-1f991b45-7f63-c850-4282-34068c23d431', N'mock-store-api', N'1f991b45-7f63-c850-4282-34068c23d431', N'Bộ bình và ca nước bằng đồng', N'Đồ gia dụng', 1671000, N'Bộ bình và ca nước bằng đồng.

Thương hiệu: Amazon Brand - Solimo.
Chất liệu: Đồng.', N'/products/ai-generated-500/0240-demo-1f991b45-7f63-c850-4282-34068c23d431.webp', N'["Ch\u1EA5t li\u1EC7u: \u0110\u1ED3ng"]', N'rose', N'✦', N'Demo', N'https://store.halukaksoy.dev/api/products/1f991b45-7f63-c850-4282-34068c23d431', 6682, N'USD', N'2026-09-24T03:32:05.226Z', 0, 20),
  (N'demo-20cc06a5-7fc6-c4b6-fdc4-f456cdd06696', N'mock-store-api', N'20cc06a5-7fc6-c4b6-fdc4-f456cdd06696', N'Ốp điện thoại dẻo họa tiết ngân hà', N'Linh kiện', 2885000, N'Ốp điện thoại dẻo họa tiết ngân hà.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10418-SL12174.
Thiết bị tương thích: Samsung Galaxy A8 Plus.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0091-demo-20cc06a5-7fc6-c4b6-fdc4-f456cdd06696.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Samsung Galaxy A8 Plus","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/20cc06a5-7fc6-c4b6-fdc4-f456cdd06696', 11539, N'USD', N'2026-09-25T15:24:59.274Z', 0, 20),
  (N'demo-21eee946-ae52-ddfa-91d7-63583f450bf2', N'mock-store-api', N'21eee946-ae52-ddfa-91d7-63583f450bf2', N'Sữa rửa mặt dịu nhẹ không hương liệu', N'Đồ gia dụng', 5154000, N'Sữa rửa mặt dịu nhẹ không hương liệu.

Thương hiệu: Solimo.
Khối lượng: 0,27 kg.
Chiều cao: 15,54 cm.
Chiều dài: 4,14 cm.
Chiều rộng: 8,69 cm.', N'/products/ai-generated-500/0257-demo-21eee946-ae52-ddfa-91d7-63583f450bf2.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,27 kg","Chi\u1EC1u cao: 15,54 cm","Chi\u1EC1u d\u00E0i: 4,14 cm","Chi\u1EC1u r\u1ED9ng: 8,69 cm"]', N'green', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/21eee946-ae52-ddfa-91d7-63583f450bf2', 20617, N'USD', N'2026-09-25T15:25:48.548Z', 0, 20),
  (N'demo-221c2abc-9355-322a-ac00-e181d6423738', N'mock-store-api', N'221c2abc-9355-322a-ac00-e181d6423738', N'Áo bọc ghế bằng nhung', N'Đồ gia dụng', 827000, N'Áo bọc ghế bằng nhung.

Thương hiệu: UMI.', N'/products/ai-generated-500/0259-demo-221c2abc-9355-322a-ac00-e181d6423738.webp', N'["\u00C1o b\u1ECDc gh\u1EBF b\u1EB1ng nhung"]', N'sand', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/221c2abc-9355-322a-ac00-e181d6423738', 3306, N'USD', N'2026-09-24T16:36:14.871Z', 0, 20),
  (N'demo-22f33e24-1434-831c-d8b5-b1a279baa61b', N'mock-store-api', N'22f33e24-1434-831c-d8b5-b1a279baa61b', N'Ga giường sợi mịn màu mận', N'Đồ gia dụng', 6146000, N'Ga giường sợi mịn màu mận.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: FLT-PLM-003.
Kiểu dáng: Ga giường.
Khối lượng: 0,90 kg.
Chiều cao: 5,69 cm.
Chiều dài: 22,83 cm.
Chiều rộng: 22,83 cm.', N'/products/ai-generated-500/0265-demo-22f33e24-1434-831c-d8b5-b1a279baa61b.webp', N'["Ki\u1EC3u d\u00E1ng: Ga gi\u01B0\u1EDDng","Kh\u1ED1i l\u01B0\u1EE3ng: 0,90 kg","Chi\u1EC1u cao: 5,69 cm","Chi\u1EC1u d\u00E0i: 22,83 cm"]', N'sand', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/22f33e24-1434-831c-d8b5-b1a279baa61b', 24582, N'USD', N'2026-09-24T16:36:14.871Z', 0, 20),
  (N'demo-23d07665-7c81-f6bd-1c5f-3d8f56015e1d', N'mock-store-api', N'23d07665-7c81-f6bd-1c5f-3d8f56015e1d', N'Tay nắm cửa màu đồng giả cổ', N'Đồ gia dụng', 5688000, N'Tay nắm cửa màu đồng giả cổ.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: Shelby.
Khối lượng: 0,76 kg.
Chiều cao: 6,48 cm.
Chiều dài: 10,29 cm.
Chiều rộng: 6,48 cm.', N'/products/ai-generated-500/0272-demo-23d07665-7c81-f6bd-1c5f-3d8f56015e1d.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,76 kg","Chi\u1EC1u cao: 6,48 cm","Chi\u1EC1u d\u00E0i: 10,29 cm","Chi\u1EC1u r\u1ED9ng: 6,48 cm"]', N'green', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/23d07665-7c81-f6bd-1c5f-3d8f56015e1d', 22752, N'USD', N'2026-09-25T15:25:41.425Z', 0, 20),
  (N'demo-241dc4b2-e2b0-dc93-0e39-9f3f7e76e671', N'mock-store-api', N'241dc4b2-e2b0-dc93-0e39-9f3f7e76e671', N'Nồi cơm điện dung tích 1,8 lít', N'Đồ gia dụng', 5677000, N'Nồi cơm điện dung tích 1,8 lít.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: MR-GM18SA.
Chất liệu: Nhựa và kim loại.
Chiều cao: 25,00 cm.
Chiều dài: 28,00 cm.
Chiều rộng: 28,00 cm.', N'/products/ai-generated-500/0277-demo-241dc4b2-e2b0-dc93-0e39-9f3f7e76e671.webp', N'["Ch\u1EA5t li\u1EC7u: Nh\u1EF1a v\u00E0 kim lo\u1EA1i","Chi\u1EC1u cao: 25,00 cm","Chi\u1EC1u d\u00E0i: 28,00 cm","Chi\u1EC1u r\u1ED9ng: 28,00 cm"]', N'rose', N'✦', N'Demo', N'https://store.halukaksoy.dev/api/products/241dc4b2-e2b0-dc93-0e39-9f3f7e76e671', 22708, N'USD', N'2026-09-24T03:32:05.226Z', 0, 20),
  (N'demo-255b69f6-f430-e77a-2b28-6373b58145d3', N'mock-store-api', N'255b69f6-f430-e77a-2b28-6373b58145d3', N'Ốp điện thoại cứng họa tiết ngân hà', N'Linh kiện', 5647000, N'Ốp điện thoại cứng họa tiết ngân hà.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8423-SL40662.
Thiết bị tương thích: Samsung Galaxy A9 Pro.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0100-demo-255b69f6-f430-e77a-2b28-6373b58145d3.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Samsung Galaxy A9 Pro","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/255b69f6-f430-e77a-2b28-6373b58145d3', 22587, N'USD', N'2026-09-25T15:27:17.278Z', 0, 20),
  (N'demo-258554a5-3cf7-1773-f9fb-5f74aaf1c41f', N'mock-store-api', N'258554a5-3cf7-1773-f9fb-5f74aaf1c41f', N'Ốp điện thoại cứng họa tiết trang trí', N'Linh kiện', 615000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8174-SL40662.
Thiết bị tương thích: Motorola Moto G4 Plus.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0105-demo-258554a5-3cf7-1773-f9fb-5f74aaf1c41f.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Motorola Moto G4 Plus","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/258554a5-3cf7-1773-f9fb-5f74aaf1c41f', 2458, N'USD', N'2026-09-25T15:27:13.516Z', 0, 20),
  (N'demo-25d28f1f-a1ac-9101-7a89-40ead9866b93', N'mock-store-api', N'25d28f1f-a1ac-9101-7a89-40ead9866b93', N'Ốp điện thoại cứng họa tiết vải màu cam', N'Linh kiện', 251000, N'Ốp điện thoại cứng họa tiết vải màu cam.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8746-SL40619.
Thiết bị tương thích: Vivo S1 Pro.
Chất liệu: Nhựa.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0110-demo-25d28f1f-a1ac-9101-7a89-40ead9866b93.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Vivo S1 Pro","Ch\u1EA5t li\u1EC7u: Nh\u1EF1a","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/25d28f1f-a1ac-9101-7a89-40ead9866b93', 1005, N'USD', N'2026-09-25T15:24:38.934Z', 0, 20),
  (N'demo-27519dbf-7d86-cb20-e729-d0bfbbfec624', N'mock-store-api', N'27519dbf-7d86-cb20-e729-d0bfbbfec624', N'Bộ hai rèm cản sáng cách nhiệt màu trắng', N'Đồ gia dụng', 3411000, N'Bộ hai rèm cản sáng cách nhiệt màu trắng.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: TEX-1736.
Chất liệu: Chưa nêu rõ.
Khối lượng: 1,07 kg.
Chiều cao: 4,32 cm.
Chiều dài: 33,02 cm.
Chiều rộng: 24,89 cm.', N'/products/ai-generated-500/0294-demo-27519dbf-7d86-cb20-e729-d0bfbbfec624.webp', N'["Ch\u1EA5t li\u1EC7u: Ch\u01B0a n\u00EAu r\u00F5","Kh\u1ED1i l\u01B0\u1EE3ng: 1,07 kg","Chi\u1EC1u cao: 4,32 cm","Chi\u1EC1u d\u00E0i: 33,02 cm"]', N'sand', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/27519dbf-7d86-cb20-e729-d0bfbbfec624', 13644, N'USD', N'2026-09-24T16:36:14.871Z', 0, 20),
  (N'demo-28cf804c-6f5b-5a57-32ad-f68b6ea2fc23', N'mock-store-api', N'28cf804c-6f5b-5a57-32ad-f68b6ea2fc23', N'Bông tai vàng đính đá tròn cắt ô', N'Đồ gia dụng', 1287000, N'Bông tai vàng đính đá tròn cắt ô.

Thương hiệu: Amazon Collection.
Mã hoặc tên mẫu: MCE2970Y-AMY.
Kiểu dáng: Vàng vàng.', N'/products/ai-generated-500/0301-demo-28cf804c-6f5b-5a57-32ad-f68b6ea2fc23.webp', N'["Ki\u1EC3u d\u00E1ng: V\u00E0ng v\u00E0ng"]', N'green', N'✿', N'Demo', N'https://store.halukaksoy.dev/api/products/28cf804c-6f5b-5a57-32ad-f68b6ea2fc23', 5149, N'USD', N'2026-09-24T03:32:05.226Z', 0, 20),
  (N'demo-2974110a-658c-c62c-15f8-becd2f3ca5be', N'mock-store-api', N'2974110a-658c-c62c-15f8-becd2f3ca5be', N'Khung giường điều chỉnh được', N'Đồ gia dụng', 3567000, N'Khung giường điều chỉnh được.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: AMZ-PB090-Q.
Màu sắc: Đen.
Khối lượng: 50,23 kg.
Chiều cao: 35,56 cm.
Chiều dài: 203,20 cm.
Chiều rộng: 152,40 cm.', N'/products/ai-generated-500/0303-demo-2974110a-658c-c62c-15f8-becd2f3ca5be.webp', N'["M\u00E0u s\u1EAFc: \u0110en","Kh\u1ED1i l\u01B0\u1EE3ng: 50,23 kg","Chi\u1EC1u cao: 35,56 cm","Chi\u1EC1u d\u00E0i: 203,20 cm"]', N'sand', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/2974110a-658c-c62c-15f8-becd2f3ca5be', 14266, N'USD', N'2026-09-24T03:32:05.226Z', 0, 20),
  (N'demo-2992207c-af68-e841-bb7d-fe214b44a306', N'mock-store-api', N'2992207c-af68-e841-bb7d-fe214b44a306', N'Ốp điện thoại cứng họa tiết lông vũ', N'Linh kiện', 4910000, N'Ốp điện thoại cứng họa tiết lông vũ.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8508-SL40683.
Thiết bị tương thích: Vivo V9 / V9 Pro.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0119-demo-2992207c-af68-e841-bb7d-fe214b44a306.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Vivo V9 / V9 Pro","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/2992207c-af68-e841-bb7d-fe214b44a306', 19641, N'USD', N'2026-09-25T15:25:25.341Z', 0, 20),
  (N'demo-2b8be8ea-e363-f0ad-bcd8-b124e5f4e294', N'mock-store-api', N'2b8be8ea-e363-f0ad-bcd8-b124e5f4e294', N'Kệ giày hai tầng màu vàng hồng', N'Đồ gia dụng', 1551000, N'Kệ giày hai tầng màu vàng hồng.

Thương hiệu: AmazonBasics.
Khối lượng: 0,84 kg.
Chiều cao: 67,95 cm.
Chiều dài: 22,23 cm.
Chiều rộng: 2,54 cm.', N'/products/ai-generated-500/0315-demo-2b8be8ea-e363-f0ad-bcd8-b124e5f4e294.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,84 kg","Chi\u1EC1u cao: 67,95 cm","Chi\u1EC1u d\u00E0i: 22,23 cm","Chi\u1EC1u r\u1ED9ng: 2,54 cm"]', N'sand', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/2b8be8ea-e363-f0ad-bcd8-b124e5f4e294', 6203, N'USD', N'2026-09-24T16:36:14.871Z', 0, 20),
  (N'demo-2e6bdd1a-c5fe-256d-4bc6-83ad554e5eea', N'mock-store-api', N'2e6bdd1a-c5fe-256d-4bc6-83ad554e5eea', N'Bộ miếng đánh dấu vị trí trên sàn', N'Đồ gia dụng', 813000, N'Bộ miếng đánh dấu vị trí trên sàn.

Thương hiệu: Amazon Basics.
Mã hoặc tên mẫu: VF97774.
Khối lượng: 0,17 kg.
Chiều cao: 1,60 cm.
Chiều dài: 18,01 cm.
Chiều rộng: 18,01 cm.', N'/products/ai-generated-500/0325-demo-2e6bdd1a-c5fe-256d-4bc6-83ad554e5eea.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,17 kg","Chi\u1EC1u cao: 1,60 cm","Chi\u1EC1u d\u00E0i: 18,01 cm","Chi\u1EC1u r\u1ED9ng: 18,01 cm"]', N'blue', N'☀', N'Demo', N'https://store.halukaksoy.dev/api/products/2e6bdd1a-c5fe-256d-4bc6-83ad554e5eea', 3251, N'USD', N'2026-09-24T03:32:05.226Z', 0, 20),
  (N'demo-2ebb8621-0780-be3b-198d-aecd04da162d', N'mock-store-api', N'2ebb8621-0780-be3b-198d-aecd04da162d', N'Bộ bốn khung ảnh trắng khổ giấy lớn', N'Đồ gia dụng', 6117000, N'Bộ bốn khung ảnh trắng khổ giấy lớn.

Thương hiệu: UMI.
Màu sắc: Trắng.', N'/products/ai-generated-500/0329-demo-2ebb8621-0780-be3b-198d-aecd04da162d.webp', N'["M\u00E0u s\u1EAFc: Tr\u1EAFng"]', N'sand', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/2ebb8621-0780-be3b-198d-aecd04da162d', 24467, N'USD', N'2026-09-24T16:36:14.871Z', 0, 20),
  (N'demo-2f1e9c44-d8ae-ac1c-5c59-70d641445963', N'mock-store-api', N'2f1e9c44-d8ae-ac1c-5c59-70d641445963', N'Đầu trang trí thanh rèm dạng lồng', N'Đồ gia dụng', 3318000, N'Đầu trang trí thanh rèm dạng lồng.

Thương hiệu: AmazonBasics.', N'/products/ai-generated-500/0335-demo-2f1e9c44-d8ae-ac1c-5c59-70d641445963.webp', N'["\u0110\u1EA7u trang tr\u00ED thanh r\u00E8m d\u1EA1ng l\u1ED3ng"]', N'sand', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/2f1e9c44-d8ae-ac1c-5c59-70d641445963', 13272, N'USD', N'2026-09-24T16:36:14.871Z', 0, 20),
  (N'demo-2f23d91c-b7d2-149e-8953-e3173a0aefe2', N'mock-store-api', N'2f23d91c-b7d2-149e-8953-e3173a0aefe2', N'Túi treo cửa đựng giày hai mươi bốn ngăn', N'Đồ gia dụng', 2164000, N'Túi treo cửa đựng giày hai mươi bốn ngăn.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: AQ-NON008.
Chiều cao: 163,32 cm.
Chiều dài: 46,23 cm.
Chiều rộng: 7,62 cm.', N'/products/ai-generated-500/0337-demo-2f23d91c-b7d2-149e-8953-e3173a0aefe2.webp', N'["Chi\u1EC1u cao: 163,32 cm","Chi\u1EC1u d\u00E0i: 46,23 cm","Chi\u1EC1u r\u1ED9ng: 7,62 cm"]', N'sand', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/2f23d91c-b7d2-149e-8953-e3173a0aefe2', 8655, N'USD', N'2026-09-24T03:32:05.226Z', 0, 20),
  (N'demo-30c3d618-0a6b-da3a-eff9-357adb320d67', N'mock-store-api', N'30c3d618-0a6b-da3a-eff9-357adb320d67', N'Kính hiển vi hai mắt', N'Đồ gia dụng', 2666000, N'Kính hiển vi hai mắt.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: BA1042B.
Chiều cao: 24,00 cm.
Chiều dài: 32,99 cm.
Chiều rộng: 48,01 cm.', N'/products/ai-generated-500/0340-demo-30c3d618-0a6b-da3a-eff9-357adb320d67.webp', N'["Chi\u1EC1u cao: 24,00 cm","Chi\u1EC1u d\u00E0i: 32,99 cm","Chi\u1EC1u r\u1ED9ng: 48,01 cm"]', N'green', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/30c3d618-0a6b-da3a-eff9-357adb320d67', 10664, N'USD', N'2026-09-25T15:25:05.568Z', 0, 20),
  (N'demo-31d64360-6658-7c4d-7c2d-07a5dcf32fa8', N'mock-store-api', N'31d64360-6658-7c4d-7c2d-07a5dcf32fa8', N'Giày cao gót nữ bít mũi nhiều màu', N'Đồ gia dụng', 2368000, N'Giày cao gót nữ bít mũi nhiều màu.

Thương hiệu: find..
Mã hoặc tên mẫu: 12-05-04.
Năm mẫu: 2017.', N'/products/ai-generated-500/0349-demo-31d64360-6658-7c4d-7c2d-07a5dcf32fa8.webp', N'["N\u0103m m\u1EABu: 2017"]', N'green', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/31d64360-6658-7c4d-7c2d-07a5dcf32fa8', 9472, N'USD', N'2026-09-25T15:26:51.613Z', 0, 20),
  (N'demo-329434d3-f957-4eee-4380-87b36e1ee933', N'mock-store-api', N'329434d3-f957-4eee-4380-87b36e1ee933', N'Ốp điện thoại cứng họa tiết trang trí', N'Linh kiện', 985000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8384-SL40435.
Thiết bị tương thích: Vivo Y21L.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0137-demo-329434d3-f957-4eee-4380-87b36e1ee933.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Vivo Y21L","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/329434d3-f957-4eee-4380-87b36e1ee933', 3941, N'USD', N'2026-09-25T15:27:09.422Z', 0, 20),
  (N'demo-33540c63-dca6-146e-2b87-d6dbeaf33fa1', N'mock-store-api', N'33540c63-dca6-146e-2b87-d6dbeaf33fa1', N'Chăn trẻ em họa tiết băng tuyết', N'Đồ gia dụng', 4323000, N'Chăn trẻ em họa tiết băng tuyết.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: JAYJ9j.
Chất liệu: Sợi tổng hợp.
Kiểu dáng: Chăn.
Khối lượng: 1,65 kg.
Chiều cao: 2,54 cm.
Chiều dài: 218,44 cm.
Chiều rộng: 162,56 cm.', N'/products/ai-generated-500/0354-demo-33540c63-dca6-146e-2b87-d6dbeaf33fa1.webp', N'["Ch\u1EA5t li\u1EC7u: S\u1EE3i t\u1ED5ng h\u1EE3p","Ki\u1EC3u d\u00E1ng: Ch\u0103n","Kh\u1ED1i l\u01B0\u1EE3ng: 1,65 kg","Chi\u1EC1u cao: 2,54 cm"]', N'sand', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/33540c63-dca6-146e-2b87-d6dbeaf33fa1', 17293, N'USD', N'2026-09-24T16:36:14.871Z', 0, 20),
  (N'demo-335b1db3-c925-5a6c-7905-fde2a9ba9a02', N'mock-store-api', N'335b1db3-c925-5a6c-7905-fde2a9ba9a02', N'Ốp điện thoại cứng họa tiết trang trí', N'Linh kiện', 613000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8290-SL40797.
Thiết bị tương thích: Samsung Z2.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0146-demo-335b1db3-c925-5a6c-7905-fde2a9ba9a02.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Samsung Z2","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/335b1db3-c925-5a6c-7905-fde2a9ba9a02', 2452, N'USD', N'2026-09-25T15:27:03.008Z', 0, 20),
  (N'demo-349fa759-068d-106a-937b-88b79b44b8b1', N'mock-store-api', N'349fa759-068d-106a-937b-88b79b44b8b1', N'Bộ bóng đèn ánh sáng ban ngày điều chỉnh được', N'Đồ gia dụng', 2543000, N'Bộ bóng đèn ánh sáng ban ngày điều chỉnh được.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: 203.
Khối lượng: 0,05 kg.
Chiều cao: 5,69 cm.
Chiều dài: 5,69 cm.
Chiều rộng: 10,01 cm.', N'/products/ai-generated-500/0359-demo-349fa759-068d-106a-937b-88b79b44b8b1.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg","Chi\u1EC1u cao: 5,69 cm","Chi\u1EC1u d\u00E0i: 5,69 cm","Chi\u1EC1u r\u1ED9ng: 10,01 cm"]', N'green', N'✿', N'Demo', N'https://store.halukaksoy.dev/api/products/349fa759-068d-106a-937b-88b79b44b8b1', 10171, N'USD', N'2026-09-24T16:36:14.871Z', 0, 20),
  (N'demo-3838b3ee-c18b-f2e0-9bd0-2a90a5ad6a60', N'mock-store-api', N'3838b3ee-c18b-f2e0-9bd0-2a90a5ad6a60', N'Ốp điện thoại cứng họa tiết trang trí', N'Linh kiện', 2803000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8173-SL40755.
Thiết bị tương thích: Lenovo ZUK Z1.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0158-demo-3838b3ee-c18b-f2e0-9bd0-2a90a5ad6a60.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Lenovo ZUK Z1","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/3838b3ee-c18b-f2e0-9bd0-2a90a5ad6a60', 11212, N'USD', N'2026-09-25T15:27:09.422Z', 0, 20),
  (N'demo-396fc840-2800-5ed0-700c-c2f8b75f0314', N'mock-store-api', N'396fc840-2800-5ed0-700c-c2f8b75f0314', N'Tủ đựng đồ lớp học', N'Đồ gia dụng', 4707000, N'Tủ đựng đồ lớp học.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: M42370B20.', N'/products/ai-generated-500/0372-demo-396fc840-2800-5ed0-700c-c2f8b75f0314.webp', N'["T\u1EE7 \u0111\u1EF1ng \u0111\u1ED3 l\u1EDBp h\u1ECDc"]', N'green', N'✿', N'Demo', N'https://store.halukaksoy.dev/api/products/396fc840-2800-5ed0-700c-c2f8b75f0314', 18828, N'USD', N'2026-09-24T16:36:14.871Z', 0, 20),
  (N'demo-3a79628b-be51-c1b5-7986-8266a079b04a', N'mock-store-api', N'3a79628b-be51-c1b5-7986-8266a079b04a', N'Bộ mũ quả bông và khăn len nữ màu xám', N'Đồ gia dụng', 1700000, N'Bộ mũ quả bông và khăn len nữ màu xám.

Thương hiệu: Amazon Essentials.
Mã hoặc tên mẫu: WAE69000FL18.', N'/products/ai-generated-500/0375-demo-3a79628b-be51-c1b5-7986-8266a079b04a.webp', N'["B\u1ED9 m\u0169 qu\u1EA3 b\u00F4ng v\u00E0 kh\u0103n len n\u1EEF m\u00E0u x\u00E1m"]', N'green', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/3a79628b-be51-c1b5-7986-8266a079b04a', 6798, N'USD', N'2026-09-25T15:26:51.613Z', 0, 20),
  (N'demo-3a957223-9a3e-114d-cbdd-dab26c8a9648', N'mock-store-api', N'3a957223-9a3e-114d-cbdd-dab26c8a9648', N'Chăn chần sợi mịn họa tiết màu cam', N'Đồ gia dụng', 2304000, N'Chăn chần sợi mịn họa tiết màu cam.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: Victoria.
Chất liệu: Sợi tổng hợp.
Khối lượng: 2,30 kg.', N'/products/ai-generated-500/0376-demo-3a957223-9a3e-114d-cbdd-dab26c8a9648.webp', N'["Ch\u1EA5t li\u1EC7u: S\u1EE3i t\u1ED5ng h\u1EE3p","Kh\u1ED1i l\u01B0\u1EE3ng: 2,30 kg"]', N'sand', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/3a957223-9a3e-114d-cbdd-dab26c8a9648', 9216, N'USD', N'2026-09-24T03:32:05.226Z', 0, 20),
  (N'demo-3b2330ae-cc2d-c305-6553-34bdf18c1fac', N'mock-store-api', N'3b2330ae-cc2d-c305-6553-34bdf18c1fac', N'Giày chạy bộ nam vải dệt màu đen', N'Linh kiện', 5648000, N'Giày chạy bộ nam vải dệt màu đen.

Thương hiệu: Klepe.
Mã hoặc tên mẫu: WD18-47/BLK.
Màu sắc: Đen.
Chất liệu: Vải lưới.
Kiểu dáng: Giày chạy bộ.', N'/products/ai-generated-500/0162-demo-3b2330ae-cc2d-c305-6553-34bdf18c1fac.webp', N'["M\u00E0u s\u1EAFc: \u0110en","Ch\u1EA5t li\u1EC7u: V\u1EA3i l\u01B0\u1EDBi","Ki\u1EC3u d\u00E1ng: Gi\u00E0y ch\u1EA1y b\u1ED9"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/3b2330ae-cc2d-c305-6553-34bdf18c1fac', 22593, N'USD', N'2026-09-25T15:26:07.397Z', 0, 20),
  (N'demo-3b410dd7-bac7-5de1-c3e1-5cc532295349', N'mock-store-api', N'3b410dd7-bac7-5de1-c3e1-5cc532295349', N'Bộ dao thìa nĩa thép không gỉ bề mặt mờ', N'Đồ gia dụng', 2129000, N'Bộ dao thìa nĩa thép không gỉ bề mặt mờ.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: A2940-EU45.
Kiểu dáng: Bề mặt mờ.
Khối lượng: 2,01 kg.
Chiều cao: 3,81 cm.
Chiều dài: 24,00 cm.
Chiều rộng: 16,99 cm.', N'/products/ai-generated-500/0381-demo-3b410dd7-bac7-5de1-c3e1-5cc532295349.webp', N'["Ki\u1EC3u d\u00E1ng: B\u1EC1 m\u1EB7t m\u1EDD","Kh\u1ED1i l\u01B0\u1EE3ng: 2,01 kg","Chi\u1EC1u cao: 3,81 cm","Chi\u1EC1u d\u00E0i: 24,00 cm"]', N'sand', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/3b410dd7-bac7-5de1-c3e1-5cc532295349', 8515, N'USD', N'2026-09-24T03:32:05.226Z', 0, 20),
  (N'demo-3d4d009f-b3b3-1d20-5037-d9c76476a499', N'mock-store-api', N'3d4d009f-b3b3-1d20-5037-d9c76476a499', N'Cải xoăn thái sợi', N'Đồ gia dụng', 5728000, N'Cải xoăn thái sợi.

Thương hiệu: Fresh.', N'/products/ai-generated-500/0389-demo-3d4d009f-b3b3-1d20-5037-d9c76476a499.webp', N'["C\u1EA3i xo\u0103n th\u00E1i s\u1EE3i"]', N'green', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/3d4d009f-b3b3-1d20-5037-d9c76476a499', 22912, N'USD', N'2026-09-25T15:25:11.511Z', 0, 20),
  (N'demo-3de5a5e9-624a-5b06-c77c-f58060e335c2', N'mock-store-api', N'3de5a5e9-624a-5b06-c77c-f58060e335c2', N'Tấm lót nệm sợi tre tạo cảm giác mát', N'Đồ gia dụng', 836000, N'Tấm lót nệm sợi tre tạo cảm giác mát.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: GW201803161-Parent.', N'/products/ai-generated-500/0394-demo-3de5a5e9-624a-5b06-c77c-f58060e335c2.webp', N'["T\u1EA5m l\u00F3t n\u1EC7m s\u1EE3i tre t\u1EA1o c\u1EA3m gi\u00E1c m\u00E1t"]', N'sand', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/3de5a5e9-624a-5b06-c77c-f58060e335c2', 3344, N'USD', N'2026-09-24T16:36:14.871Z', 0, 20),
  (N'demo-3f1246fe-b5a5-00fa-3727-2a0eab319cc5', N'mock-store-api', N'3f1246fe-b5a5-00fa-3727-2a0eab319cc5', N'Tranh trang trí tường phong cách đô thị', N'Đồ gia dụng', 965000, N'Tranh trang trí tường phong cách đô thị.

Thương hiệu: Rivet.
Mã hoặc tên mẫu: 51865-wwmr01.', N'/products/ai-generated-500/0399-demo-3f1246fe-b5a5-00fa-3727-2a0eab319cc5.webp', N'["Tranh trang tr\u00ED t\u01B0\u1EDDng phong c\u00E1ch \u0111\u00F4 th\u1ECB"]', N'sand', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/3f1246fe-b5a5-00fa-3727-2a0eab319cc5', 3858, N'USD', N'2026-09-24T16:36:14.871Z', 0, 20),
  (N'demo-3ff03970-a54c-debf-01b0-bf804938e215', N'mock-store-api', N'3ff03970-a54c-debf-01b0-bf804938e215', N'Ốp điện thoại dẻo họa tiết trang trí', N'Linh kiện', 5633000, N'Ốp điện thoại dẻo họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10773-SL11269.
Thiết bị tương thích: I Kall K1.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0180-demo-3ff03970-a54c-debf-01b0-bf804938e215.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: I Kall K1","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/3ff03970-a54c-debf-01b0-bf804938e215', 22531, N'USD', N'2026-09-25T15:25:27.887Z', 0, 20),
  (N'demo-401a05be-594a-639c-d9a4-e90067c29cc5', N'mock-store-api', N'401a05be-594a-639c-d9a4-e90067c29cc5', N'Bình nước thủy tinh thể thao màu hồng', N'Đồ gia dụng', 4287000, N'Bình nước thủy tinh thể thao màu hồng.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: SOL-HK-BRGN21-VV.
Màu sắc: Hồng.
Chất liệu: Thép không gỉ.
Khối lượng: 0,50 kg.', N'/products/ai-generated-500/0405-demo-401a05be-594a-639c-d9a4-e90067c29cc5.webp', N'["M\u00E0u s\u1EAFc: H\u1ED3ng","Ch\u1EA5t li\u1EC7u: Th\u00E9p kh\u00F4ng g\u1EC9","Kh\u1ED1i l\u01B0\u1EE3ng: 0,50 kg"]', N'rose', N'✦', N'Demo', N'https://store.halukaksoy.dev/api/products/401a05be-594a-639c-d9a4-e90067c29cc5', 17147, N'USD', N'2026-09-24T03:32:05.226Z', 0, 20),
  (N'demo-427dda3a-0e59-8329-48cf-6405e5e05a99', N'mock-store-api', N'427dda3a-0e59-8329-48cf-6405e5e05a99', N'Dây chuyền bạc mặt tròn khắc chữ', N'Đồ gia dụng', 3483000, N'Dây chuyền bạc mặt tròn khắc chữ.

Thương hiệu: Amazon Collection.
Mã hoặc tên mẫu: 427985G-Parent.', N'/products/ai-generated-500/0415-demo-427dda3a-0e59-8329-48cf-6405e5e05a99.webp', N'["D\u00E2y chuy\u1EC1n b\u1EA1c m\u1EB7t tr\u00F2n kh\u1EAFc ch\u1EEF"]', N'green', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/427dda3a-0e59-8329-48cf-6405e5e05a99', 13930, N'USD', N'2026-09-25T15:27:03.008Z', 0, 20),
  (N'demo-428ca7e0-de03-3751-ee6f-4c1d2c01d4b5', N'mock-store-api', N'428ca7e0-de03-3751-ee6f-4c1d2c01d4b5', N'Dung dịch tẩy dầu mỡ', N'Đồ gia dụng', 1843000, N'Dung dịch tẩy dầu mỡ.

Thương hiệu: AmazonBasics.', N'/products/ai-generated-500/0419-demo-428ca7e0-de03-3751-ee6f-4c1d2c01d4b5.webp', N'["Dung d\u1ECBch t\u1EA9y d\u1EA7u m\u1EE1"]', N'green', N'✿', N'Demo', N'https://store.halukaksoy.dev/api/products/428ca7e0-de03-3751-ee6f-4c1d2c01d4b5', 7373, N'USD', N'2026-09-24T16:36:14.871Z', 0, 20),
  (N'demo-4471f925-2cac-0ec8-caf7-efec24e42550', N'mock-store-api', N'4471f925-2cac-0ec8-caf7-efec24e42550', N'Lồng gấp gọn có túi đựng', N'Đồ gia dụng', 1191000, N'Lồng gấp gọn có túi đựng.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: JP08-PUG-01.
Khối lượng: 2,04 kg.
Chiều cao: 8,26 cm.
Chiều dài: 90,17 cm.
Chiều rộng: 62,87 cm.', N'/products/ai-generated-500/0428-demo-4471f925-2cac-0ec8-caf7-efec24e42550.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 2,04 kg","Chi\u1EC1u cao: 8,26 cm","Chi\u1EC1u d\u00E0i: 90,17 cm","Chi\u1EC1u r\u1ED9ng: 62,87 cm"]', N'blue', N'☀', N'Demo', N'https://store.halukaksoy.dev/api/products/4471f925-2cac-0ec8-caf7-efec24e42550', 4764, N'USD', N'2026-09-24T03:32:05.226Z', 0, 20),
  (N'demo-46132881-d70b-7ea8-5a5e-1c29d820002b', N'mock-store-api', N'46132881-d70b-7ea8-5a5e-1c29d820002b', N'Bộ ngăn vải thay thế cho tủ bốn ngăn', N'Đồ gia dụng', 5287000, N'Bộ ngăn vải thay thế cho tủ bốn ngăn.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: FAB-007RBU.
Khối lượng: 2,99 kg.
Chiều cao: 63,25 cm.
Chiều dài: 75,95 cm.
Chiều rộng: 28,50 cm.', N'/products/ai-generated-500/0432-demo-46132881-d70b-7ea8-5a5e-1c29d820002b.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 2,99 kg","Chi\u1EC1u cao: 63,25 cm","Chi\u1EC1u d\u00E0i: 75,95 cm","Chi\u1EC1u r\u1ED9ng: 28,50 cm"]', N'green', N'✿', N'Demo', N'https://store.halukaksoy.dev/api/products/46132881-d70b-7ea8-5a5e-1c29d820002b', 21147, N'USD', N'2026-09-24T16:36:14.871Z', 0, 20),
  (N'demo-469c4b7a-be12-8f0e-fa47-61ca8d7135f9', N'mock-store-api', N'469c4b7a-be12-8f0e-fa47-61ca8d7135f9', N'Khăn lau cơ thể dùng trên giường', N'Đồ gia dụng', 4380000, N'Khăn lau cơ thể dùng trên giường.

Thương hiệu: Mama Bear.
Mã hoặc tên mẫu: FBAMBbbw10 wipes/pack.
Khối lượng: 0,20 kg.
Chiều cao: 2,60 cm.
Chiều dài: 10,10 cm.
Chiều rộng: 15,20 cm.', N'/products/ai-generated-500/0436-demo-469c4b7a-be12-8f0e-fa47-61ca8d7135f9.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,20 kg","Chi\u1EC1u cao: 2,60 cm","Chi\u1EC1u d\u00E0i: 10,10 cm","Chi\u1EC1u r\u1ED9ng: 15,20 cm"]', N'green', N'✿', N'Demo', N'https://store.halukaksoy.dev/api/products/469c4b7a-be12-8f0e-fa47-61ca8d7135f9', 17518, N'USD', N'2026-09-24T16:36:14.871Z', 0, 20),
  (N'demo-47f294cc-0ca9-6ef8-7dcb-dc456c52f480', N'mock-store-api', N'47f294cc-0ca9-6ef8-7dcb-dc456c52f480', N'Thịt gà sấy làm phần thưởng cho chó', N'Đồ gia dụng', 520000, N'Thịt gà sấy làm phần thưởng cho chó.

Thương hiệu: WAG.
Khối lượng: 0,45 kg.
Chiều cao: 26,04 cm.
Chiều dài: 10,92 cm.
Chiều rộng: 24,00 cm.', N'/products/ai-generated-500/0451-demo-47f294cc-0ca9-6ef8-7dcb-dc456c52f480.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,45 kg","Chi\u1EC1u cao: 26,04 cm","Chi\u1EC1u d\u00E0i: 10,92 cm","Chi\u1EC1u r\u1ED9ng: 24,00 cm"]', N'green', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/47f294cc-0ca9-6ef8-7dcb-dc456c52f480', 2079, N'USD', N'2026-09-25T15:26:07.397Z', 0, 20),
  (N'demo-4a772e1b-67e4-c85b-cd50-48381e96e93c', N'mock-store-api', N'4a772e1b-67e4-c85b-cd50-48381e96e93c', N'Giá phơi đồ cỡ lớn', N'Đồ gia dụng', 2572000, N'Giá phơi đồ cỡ lớn.

Thương hiệu: Amazon Basics.
Mã hoặc tên mẫu: 1013517-1173-A60.
Chiều cao: 48,26 cm.
Chiều dài: 55,56 cm.
Chiều rộng: 36,20 cm.', N'/products/ai-generated-500/0469-demo-4a772e1b-67e4-c85b-cd50-48381e96e93c.webp', N'["Chi\u1EC1u cao: 48,26 cm","Chi\u1EC1u d\u00E0i: 55,56 cm","Chi\u1EC1u r\u1ED9ng: 36,20 cm"]', N'green', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/4a772e1b-67e4-c85b-cd50-48381e96e93c', 10287, N'USD', N'2026-09-25T15:24:54.798Z', 0, 20),
  (N'demo-4afb1eeb-3aad-85f4-3761-1cf6549f9f53', N'mock-store-api', N'4afb1eeb-3aad-85f4-3761-1cf6549f9f53', N'Thanh treo rèm phòng tắm điều chỉnh được', N'Đồ gia dụng', 4093000, N'Thanh treo rèm phòng tắm điều chỉnh được.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: 1009904-158-A60-cr.
Chất liệu: Vật liệu khác.
Khối lượng: 0,86 kg.
Chiều cao: 3,56 cm.
Chiều dài: 228,60 cm.
Chiều rộng: 3,56 cm.', N'/products/ai-generated-500/0477-demo-4afb1eeb-3aad-85f4-3761-1cf6549f9f53.webp', N'["Ch\u1EA5t li\u1EC7u: V\u1EADt li\u1EC7u kh\u00E1c","Kh\u1ED1i l\u01B0\u1EE3ng: 0,86 kg","Chi\u1EC1u cao: 3,56 cm","Chi\u1EC1u d\u00E0i: 228,60 cm"]', N'sand', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/4afb1eeb-3aad-85f4-3761-1cf6549f9f53', 16372, N'USD', N'2026-09-24T16:36:14.871Z', 0, 20),
  (N'demo-4b564c64-1bdd-86ec-f99b-2526537eb1d0', N'mock-store-api', N'4b564c64-1bdd-86ec-f99b-2526537eb1d0', N'Tấm bảo vệ nệm màu trắng', N'Đồ gia dụng', 5491000, N'Tấm bảo vệ nệm màu trắng.

Thương hiệu: Brooklyn Bedding.
Mã hoặc tên mẫu: Clean Sleep.
Màu sắc: Trắng.
Chất liệu: Vải bông.
Khối lượng: 0,91 kg.
Chiều cao: 213,36 cm.
Chiều dài: 182,88 cm.
Chiều rộng: 40,64 cm.', N'/products/ai-generated-500/0481-demo-4b564c64-1bdd-86ec-f99b-2526537eb1d0.webp', N'["M\u00E0u s\u1EAFc: Tr\u1EAFng","Ch\u1EA5t li\u1EC7u: V\u1EA3i b\u00F4ng","Kh\u1ED1i l\u01B0\u1EE3ng: 0,91 kg","Chi\u1EC1u cao: 213,36 cm"]', N'sand', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/4b564c64-1bdd-86ec-f99b-2526537eb1d0', 21962, N'USD', N'2026-09-24T16:36:14.871Z', 0, 20),
  (N'demo-4c4a9410-f9aa-263d-b4c9-a7d64da6ed83', N'mock-store-api', N'4c4a9410-f9aa-263d-b4c9-a7d64da6ed83', N'Vòng tay hạt đá tròn màu xanh', N'Đồ gia dụng', 546000, N'Vòng tay hạt đá tròn màu xanh.

Thương hiệu: Amazon Collection.
Mã hoặc tên mẫu: A0052B0174-AT-16mm-8".', N'/products/ai-generated-500/0488-demo-4c4a9410-f9aa-263d-b4c9-a7d64da6ed83.webp', N'["V\u00F2ng tay h\u1EA1t \u0111\u00E1 tr\u00F2n m\u00E0u xanh"]', N'green', N'✿', N'Demo', N'https://store.halukaksoy.dev/api/products/4c4a9410-f9aa-263d-b4c9-a7d64da6ed83', 2183, N'USD', N'2026-09-24T03:32:05.226Z', 0, 20),
  (N'demo-4c70b30c-2a3a-897a-6e45-653101dfcfba', N'mock-store-api', N'4c70b30c-2a3a-897a-6e45-653101dfcfba', N'Đèn ngủ đá muối hình trụ cắm điện', N'Đồ gia dụng', 4333000, N'Đèn ngủ đá muối hình trụ cắm điện.

Thương hiệu: AmazonBasics.
Mã hoặc tên mẫu: AQ-CJY-Salt-10.
Kiểu dáng: Hình trụ.
Khối lượng: 0,80 kg.
Chiều cao: 7,49 cm.
Chiều dài: 4,78 cm.
Chiều rộng: 4,78 cm.', N'/products/ai-generated-500/0492-demo-4c70b30c-2a3a-897a-6e45-653101dfcfba.webp', N'["Ki\u1EC3u d\u00E1ng: H\u00ECnh tr\u1EE5","Kh\u1ED1i l\u01B0\u1EE3ng: 0,80 kg","Chi\u1EC1u cao: 7,49 cm","Chi\u1EC1u d\u00E0i: 4,78 cm"]', N'sand', N'⌂', N'Demo', N'https://store.halukaksoy.dev/api/products/4c70b30c-2a3a-897a-6e45-653101dfcfba', 17331, N'USD', N'2026-09-24T16:36:14.871Z', 0, 20),
  (N'demo-4da0b931-4778-c6de-eb14-8ec7816e46aa', N'mock-store-api', N'4da0b931-4778-c6de-eb14-8ec7816e46aa', N'Ốp điện thoại dẻo họa tiết lá', N'Linh kiện', 3407000, N'Ốp điện thoại dẻo họa tiết lá.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10317-SL40528.
Thiết bị tương thích: HTC Desire 626/HTC Desire 628.
Chất liệu: Silicôn.
Kiểu dáng: Họa tiết trang trí.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0196-demo-4da0b931-4778-c6de-eb14-8ec7816e46aa.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: HTC Desire 626/HTC Desire 628","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Ki\u1EC3u d\u00E1ng: H\u1ECDa ti\u1EBFt trang tr\u00ED","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/4da0b931-4778-c6de-eb14-8ec7816e46aa', 13628, N'USD', N'2026-09-25T15:25:17.437Z', 0, 20),
  (N'demo-4f4d821b-40bc-06c6-26d9-a444bd9767f5', N'mock-store-api', N'4f4d821b-40bc-06c6-26d9-a444bd9767f5', N'Ốp điện thoại cứng họa tiết giọt nước', N'Tự Thiết Kế', 2388000, N'Ốp điện thoại cứng họa tiết giọt nước.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8290-SL40585.
Thiết bị tương thích: Samsung Z2.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0018-demo-4f4d821b-40bc-06c6-26d9-a444bd9767f5.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Samsung Z2","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'sand', N'✿', N'Demo', N'https://store.halukaksoy.dev/api/products/4f4d821b-40bc-06c6-26d9-a444bd9767f5', 9553, N'USD', N'2026-09-25T15:26:33.858Z', 0, 20),
  (N'demo-55e7e13a-01c7-623d-54cc-4e9fe11310df', N'mock-store-api', N'55e7e13a-01c7-623d-54cc-4e9fe11310df', N'Cà phê hạt hữu cơ rang đậm', N'Tự Thiết Kế', 1375000, N'Cà phê hạt hữu cơ rang đậm.

Thương hiệu: Allegro Coffee.
Mã hoặc tên mẫu: Espresso Bel Canto.
Chiều cao: 22,86 cm.
Chiều dài: 7,62 cm.
Chiều rộng: 9,53 cm.', N'/products/ai-generated-500/0026-demo-55e7e13a-01c7-623d-54cc-4e9fe11310df.webp', N'["Chi\u1EC1u cao: 22,86 cm","Chi\u1EC1u d\u00E0i: 7,62 cm","Chi\u1EC1u r\u1ED9ng: 9,53 cm"]', N'sand', N'✿', N'Demo', N'https://store.halukaksoy.dev/api/products/55e7e13a-01c7-623d-54cc-4e9fe11310df', 5499, N'USD', N'2026-09-25T15:27:19.885Z', 0, 20),
  (N'demo-56b5663d-9eeb-eac2-0cc8-dce10289e1ae', N'mock-store-api', N'56b5663d-9eeb-eac2-0cc8-dce10289e1ae', N'Ốp điện thoại dẻo họa tiết trang trí', N'Linh kiện', 1055000, N'Ốp điện thoại dẻo họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10702-SL40639.
Thiết bị tương thích: Vivo Z10.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0201-demo-56b5663d-9eeb-eac2-0cc8-dce10289e1ae.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Vivo Z10","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/56b5663d-9eeb-eac2-0cc8-dce10289e1ae', 4221, N'USD', N'2026-09-25T15:25:25.342Z', 0, 20),
  (N'demo-586d26b2-2cdb-03a4-1b00-e5240b108465', N'mock-store-api', N'586d26b2-2cdb-03a4-1b00-e5240b108465', N'Ốp điện thoại cứng họa tiết trang trí', N'Linh kiện', 2465000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8270-SL40791.
Thiết bị tương thích: HTC One M8.
Kiểu dáng: Họa tiết trang trí.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0205-demo-586d26b2-2cdb-03a4-1b00-e5240b108465.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: HTC One M8","Ki\u1EC3u d\u00E1ng: H\u1ECDa ti\u1EBFt trang tr\u00ED","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/586d26b2-2cdb-03a4-1b00-e5240b108465', 9860, N'USD', N'2026-09-25T15:26:17.233Z', 0, 20),
  (N'demo-58b44f5a-efbc-8e2c-b74b-d17f396d59a7', N'mock-store-api', N'58b44f5a-efbc-8e2c-b74b-d17f396d59a7', N'Ốp điện thoại cứng họa tiết hoa', N'Linh kiện', 2245000, N'Ốp điện thoại cứng họa tiết hoa.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8760-SL40315.
Thiết bị tương thích: Samsung Galaxy M21.
Chất liệu: Nhựa.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0207-demo-58b44f5a-efbc-8e2c-b74b-d17f396d59a7.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Samsung Galaxy M21","Ch\u1EA5t li\u1EC7u: Nh\u1EF1a","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/58b44f5a-efbc-8e2c-b74b-d17f396d59a7', 8980, N'USD', N'2026-09-25T15:27:09.422Z', 0, 20),
  (N'demo-625df510-5b78-62d6-42d4-268e18242c52', N'mock-store-api', N'625df510-5b78-62d6-42d4-268e18242c52', N'Ốp điện thoại cứng họa tiết hoa', N'Linh kiện', 3759000, N'Ốp điện thoại cứng họa tiết hoa.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8311-SL40760.
Thiết bị tương thích: Huawei Mate 9.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0218-demo-625df510-5b78-62d6-42d4-268e18242c52.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Huawei Mate 9","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/625df510-5b78-62d6-42d4-268e18242c52', 15034, N'USD', N'2026-09-25T15:25:25.341Z', 0, 20),
  (N'demo-6401edf1-4d90-c822-c1dd-3c49423c4f3f', N'mock-store-api', N'6401edf1-4d90-c822-c1dd-3c49423c4f3f', N'Ốp điện thoại cứng họa tiết trang trí', N'Linh kiện', 2244000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8256-SL40554.
Thiết bị tương thích: Micromax Canvas Selfie 2 Q340.
Chất liệu: Vải bố.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0222-demo-6401edf1-4d90-c822-c1dd-3c49423c4f3f.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Micromax Canvas Selfie 2 Q340","Ch\u1EA5t li\u1EC7u: V\u1EA3i b\u1ED1","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/6401edf1-4d90-c822-c1dd-3c49423c4f3f', 8974, N'USD', N'2026-09-25T15:25:41.425Z', 0, 20),
  (N'demo-6640cd7c-276f-81a3-a262-86fc6cd6d7d5', N'mock-store-api', N'6640cd7c-276f-81a3-a262-86fc6cd6d7d5', N'Gạo men đỏ dạng viên', N'Tự Thiết Kế', 584000, N'Gạo men đỏ dạng viên.

Thương hiệu: Whole Foods Market.
Chiều cao: 8,89 cm.
Chiều dài: 8,89 cm.
Chiều rộng: 5,08 cm.', N'/products/ai-generated-500/0032-demo-6640cd7c-276f-81a3-a262-86fc6cd6d7d5.webp', N'["Chi\u1EC1u cao: 8,89 cm","Chi\u1EC1u d\u00E0i: 8,89 cm","Chi\u1EC1u r\u1ED9ng: 5,08 cm"]', N'sand', N'✿', N'Demo', N'https://store.halukaksoy.dev/api/products/6640cd7c-276f-81a3-a262-86fc6cd6d7d5', 2334, N'USD', N'2026-09-25T15:24:49.496Z', 0, 20),
  (N'demo-68c3aa07-db3c-201e-7e81-a17ed367cb09', N'mock-store-api', N'68c3aa07-db3c-201e-7e81-a17ed367cb09', N'Ốp điện thoại cứng họa tiết trái tim', N'Linh kiện', 3525000, N'Ốp điện thoại cứng họa tiết trái tim.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8365-SL40743.
Thiết bị tương thích: Coolpad Cool1 Dual.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0231-demo-68c3aa07-db3c-201e-7e81-a17ed367cb09.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Coolpad Cool1 Dual","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/68c3aa07-db3c-201e-7e81-a17ed367cb09', 14098, N'USD', N'2026-09-25T15:25:35.979Z', 0, 20),
  (N'demo-69f0bca4-4f76-766f-a443-c978c851b17d', N'mock-store-api', N'69f0bca4-4f76-766f-a443-c978c851b17d', N'Ốp điện thoại cứng họa tiết lá', N'Linh kiện', 1894000, N'Ốp điện thoại cứng họa tiết lá.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8355-SL40528.
Thiết bị tương thích: Oppo A37.
Chất liệu: Gỗ.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0234-demo-69f0bca4-4f76-766f-a443-c978c851b17d.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Oppo A37","Ch\u1EA5t li\u1EC7u: G\u1ED7","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/69f0bca4-4f76-766f-a443-c978c851b17d', 7577, N'USD', N'2026-09-25T15:26:51.613Z', 0, 20),
  (N'demo-6b44115b-9d05-e972-f664-47ae5dd8565d', N'mock-store-api', N'6b44115b-9d05-e972-f664-47ae5dd8565d', N'Ốp điện thoại dẻo họa tiết trang trí', N'Linh kiện', 2916000, N'Ốp điện thoại dẻo họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10336-SL13062.
Thiết bị tương thích: Coolpad Note 5.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0237-demo-6b44115b-9d05-e972-f664-47ae5dd8565d.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Coolpad Note 5","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/6b44115b-9d05-e972-f664-47ae5dd8565d', 11663, N'USD', N'2026-09-25T15:25:05.568Z', 0, 20),
  (N'demo-6b7ff8c6-6c39-36e8-415d-2ed1a6c38a88', N'mock-store-api', N'6b7ff8c6-6c39-36e8-415d-2ed1a6c38a88', N'Ốp điện thoại cứng họa tiết sao', N'Linh kiện', 1225000, N'Ốp điện thoại cứng họa tiết sao.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8183-SL40507.
Thiết bị tương thích: LeTV Le 2.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0242-demo-6b7ff8c6-6c39-36e8-415d-2ed1a6c38a88.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: LeTV Le 2","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/6b7ff8c6-6c39-36e8-415d-2ed1a6c38a88', 4901, N'USD', N'2026-09-25T15:25:11.511Z', 0, 20),
  (N'demo-7199bfbc-41d7-1fbe-e7b8-9c015c7eb439', N'mock-store-api', N'7199bfbc-41d7-1fbe-e7b8-9c015c7eb439', N'Ốp điện thoại cứng họa tiết trang trí', N'Linh kiện', 2899000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8483-SL40766.
Thiết bị tương thích: Gionee A1 Lite.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0252-demo-7199bfbc-41d7-1fbe-e7b8-9c015c7eb439.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Gionee A1 Lite","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/7199bfbc-41d7-1fbe-e7b8-9c015c7eb439', 11596, N'USD', N'2026-09-25T15:26:41.581Z', 0, 20),
  (N'demo-740111d6-cb8f-24f4-fe5a-28d8d52eda01', N'mock-store-api', N'740111d6-cb8f-24f4-fe5a-28d8d52eda01', N'Ốp điện thoại dẻo họa tiết hoa', N'Linh kiện', 5621000, N'Ốp điện thoại dẻo họa tiết hoa.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10119-SL40370.
Thiết bị tương thích: Samsung Galaxy J7 Pro.
Chất liệu: Silicôn.
Kiểu dáng: Họa tiết trang trí.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0254-demo-740111d6-cb8f-24f4-fe5a-28d8d52eda01.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Samsung Galaxy J7 Pro","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Ki\u1EC3u d\u00E1ng: H\u1ECDa ti\u1EBFt trang tr\u00ED","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/740111d6-cb8f-24f4-fe5a-28d8d52eda01', 22482, N'USD', N'2026-09-25T15:25:57.529Z', 0, 20),
  (N'demo-74a58c44-2d09-bddc-09fc-5b615e70f34d', N'mock-store-api', N'74a58c44-2d09-bddc-09fc-5b615e70f34d', N'Ốp điện thoại cứng họa tiết trang trí', N'Linh kiện', 5092000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: SOLOPPOR15PRO3DM134.
Thiết bị tương thích: Oppo R15 Pro.
Chất liệu: Nhựa.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0258-demo-74a58c44-2d09-bddc-09fc-5b615e70f34d.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Oppo R15 Pro","Ch\u1EA5t li\u1EC7u: Nh\u1EF1a","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/74a58c44-2d09-bddc-09fc-5b615e70f34d', 20367, N'USD', N'2026-09-25T15:26:33.858Z', 0, 20),
  (N'demo-77310644-2127-90ee-fa6c-937d0c1ed925', N'mock-store-api', N'77310644-2127-90ee-fa6c-937d0c1ed925', N'Ốp điện thoại cứng họa tiết trang trí', N'Linh kiện', 5290000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: SOLR8A3DM310.
Thiết bị tương thích: Xiaomi Redmi 8A.
Chất liệu: Nhựa.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0267-demo-77310644-2127-90ee-fa6c-937d0c1ed925.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Xiaomi Redmi 8A","Ch\u1EA5t li\u1EC7u: Nh\u1EF1a","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/77310644-2127-90ee-fa6c-937d0c1ed925', 21161, N'USD', N'2026-09-25T15:24:59.274Z', 0, 20),
  (N'demo-79b4eb81-04c4-eeab-9fb6-d43673e15cbd', N'mock-store-api', N'79b4eb81-04c4-eeab-9fb6-d43673e15cbd', N'Ốp điện thoại dẻo họa tiết trái tim', N'Linh kiện', 3203000, N'Ốp điện thoại dẻo họa tiết trái tim.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10405-SL40404.
Thiết bị tương thích: Oppo A3S.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0273-demo-79b4eb81-04c4-eeab-9fb6-d43673e15cbd.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Oppo A3S","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/79b4eb81-04c4-eeab-9fb6-d43673e15cbd', 12810, N'USD', N'2026-09-25T15:24:38.934Z', 0, 20),
  (N'demo-7bbfad4b-9350-0e6e-1934-49e473e92f32', N'mock-store-api', N'7bbfad4b-9350-0e6e-1934-49e473e92f32', N'Ốp điện thoại cứng họa tiết lông vũ', N'Linh kiện', 2268000, N'Ốp điện thoại cứng họa tiết lông vũ.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8215-SL40397.
Thiết bị tương thích: Gionee Marathon M5 lite.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0278-demo-7bbfad4b-9350-0e6e-1934-49e473e92f32.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Gionee Marathon M5 lite","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/7bbfad4b-9350-0e6e-1934-49e473e92f32', 9070, N'USD', N'2026-09-25T15:26:23.427Z', 0, 20),
  (N'demo-7e44fe9f-f64e-afd2-821c-206062121ace', N'mock-store-api', N'7e44fe9f-f64e-afd2-821c-206062121ace', N'Ốp điện thoại cứng họa tiết trang trí', N'Linh kiện', 5717000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8756-SL40763.
Thiết bị tương thích: Realme C3.
Chất liệu: Nhựa.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0282-demo-7e44fe9f-f64e-afd2-821c-206062121ace.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Realme C3","Ch\u1EA5t li\u1EC7u: Nh\u1EF1a","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/7e44fe9f-f64e-afd2-821c-206062121ace', 22867, N'USD', N'2026-09-25T15:27:13.516Z', 0, 20),
  (N'demo-8423eb73-99ff-4463-7244-28f4cde37457', N'mock-store-api', N'8423eb73-99ff-4463-7244-28f4cde37457', N'Ốp điện thoại dẻo họa tiết lông vũ', N'Linh kiện', 3100000, N'Ốp điện thoại dẻo họa tiết lông vũ.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10825-SL40397.
Thiết bị tương thích: Infinix Hot 8.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0290-demo-8423eb73-99ff-4463-7244-28f4cde37457.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Infinix Hot 8","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/8423eb73-99ff-4463-7244-28f4cde37457', 12399, N'USD', N'2026-09-25T15:27:19.885Z', 0, 20),
  (N'demo-8522751e-e294-9bee-e1b1-148c36f4ec1a', N'mock-store-api', N'8522751e-e294-9bee-e1b1-148c36f4ec1a', N'Ốp điện thoại dẻo họa tiết tình yêu', N'Linh kiện', 5217000, N'Ốp điện thoại dẻo họa tiết tình yêu.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10180-SL27016.
Thiết bị tương thích: Mi Redmi Note 3.
Chất liệu: Silicôn.
Kiểu dáng: Trang trí chữ.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0292-demo-8522751e-e294-9bee-e1b1-148c36f4ec1a.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Mi Redmi Note 3","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Ki\u1EC3u d\u00E1ng: Trang tr\u00ED ch\u1EEF","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/8522751e-e294-9bee-e1b1-148c36f4ec1a', 20868, N'USD', N'2026-09-25T15:27:09.422Z', 0, 20),
  (N'demo-86cc613f-0d11-115e-0872-7ca0bdc33291', N'mock-store-api', N'86cc613f-0d11-115e-0872-7ca0bdc33291', N'Ốp điện thoại cứng họa tiết trang trí', N'Tự Thiết Kế', 2099000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8268-SL40374.
Thiết bị tương thích: Micromax Canvas Juice 3Plus Q394.
Chất liệu: Vải bố.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0038-demo-86cc613f-0d11-115e-0872-7ca0bdc33291.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Micromax Canvas Juice 3Plus Q394","Ch\u1EA5t li\u1EC7u: V\u1EA3i b\u1ED1","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'sand', N'✿', N'Demo', N'https://store.halukaksoy.dev/api/products/86cc613f-0d11-115e-0872-7ca0bdc33291', 8397, N'USD', N'2026-09-25T15:26:23.426Z', 0, 20),
  (N'demo-872874fb-8455-651a-ce12-5d0b7768374a', N'mock-store-api', N'872874fb-8455-651a-ce12-5d0b7768374a', N'Ốp điện thoại cứng họa tiết trang trí', N'Linh kiện', 2167000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8188-SL40345.
Thiết bị tương thích: Huawei Honor 5c.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0297-demo-872874fb-8455-651a-ce12-5d0b7768374a.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Huawei Honor 5c","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/872874fb-8455-651a-ce12-5d0b7768374a', 8667, N'USD', N'2026-09-25T15:25:41.425Z', 0, 20),
  (N'demo-8a698173-da17-276b-0ace-e53abd87c397', N'mock-store-api', N'8a698173-da17-276b-0ace-e53abd87c397', N'Hạnh nhân rang vị quế và đường', N'Tự Thiết Kế', 2608000, N'Hạnh nhân rang vị quế và đường.

Thương hiệu: Wickedly Prime.
Khối lượng: 0,71 kg.
Chiều cao: 10,16 cm.
Chiều dài: 30,48 cm.
Chiều rộng: 27,94 cm.', N'/products/ai-generated-500/0044-demo-8a698173-da17-276b-0ace-e53abd87c397.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,71 kg","Chi\u1EC1u cao: 10,16 cm","Chi\u1EC1u d\u00E0i: 30,48 cm","Chi\u1EC1u r\u1ED9ng: 27,94 cm"]', N'sand', N'✿', N'Demo', N'https://store.halukaksoy.dev/api/products/8a698173-da17-276b-0ace-e53abd87c397', 10433, N'USD', N'2026-09-25T15:26:33.858Z', 0, 20),
  (N'demo-8f5d13a3-55e1-77ea-be79-e7961c09d240', N'mock-store-api', N'8f5d13a3-55e1-77ea-be79-e7961c09d240', N'Ốp điện thoại cứng họa tiết giọt nước', N'Tự Thiết Kế', 4763000, N'Ốp điện thoại cứng họa tiết giọt nước.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8221-SL40585.
Thiết bị tương thích: Xiaomi Redmi 3S.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0050-demo-8f5d13a3-55e1-77ea-be79-e7961c09d240.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Xiaomi Redmi 3S","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'sand', N'✿', N'Demo', N'https://store.halukaksoy.dev/api/products/8f5d13a3-55e1-77ea-be79-e7961c09d240', 19052, N'USD', N'2026-09-25T15:26:33.858Z', 0, 20),
  (N'demo-90883a40-ade3-411c-758f-6c9422aaa7e9', N'mock-store-api', N'90883a40-ade3-411c-758f-6c9422aaa7e9', N'Ốp điện thoại dẻo họa tiết trang trí', N'Linh kiện', 1141000, N'Ốp điện thoại dẻo họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10554-SL40336.
Thiết bị tương thích: Comio P1 4G.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0313-demo-90883a40-ade3-411c-758f-6c9422aaa7e9.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Comio P1 4G","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/90883a40-ade3-411c-758f-6c9422aaa7e9', 4565, N'USD', N'2026-09-25T15:27:09.422Z', 0, 20),
  (N'demo-950c75b0-4dac-91bf-d01f-404f6b9f4eb2', N'mock-store-api', N'950c75b0-4dac-91bf-d01f-404f6b9f4eb2', N'Ốp điện thoại dẻo họa tiết trang trí', N'Linh kiện', 1194000, N'Ốp điện thoại dẻo họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10344-SL12390.
Thiết bị tương thích: Micromax Canvas Spark 3 Q385.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0320-demo-950c75b0-4dac-91bf-d01f-404f6b9f4eb2.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Micromax Canvas Spark 3 Q385","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/950c75b0-4dac-91bf-d01f-404f6b9f4eb2', 4775, N'USD', N'2026-09-25T15:25:48.548Z', 0, 20),
  (N'demo-95f5b7d9-f7d1-9f16-8f56-f13578ac6a6b', N'mock-store-api', N'95f5b7d9-f7d1-9f16-8f56-f13578ac6a6b', N'Ốp điện thoại cứng họa tiết trang trí', N'Linh kiện', 3311000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8037-SL40502.
Thiết bị tương thích: Sony Xperia T2 Ultra.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0321-demo-95f5b7d9-f7d1-9f16-8f56-f13578ac6a6b.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Sony Xperia T2 Ultra","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/95f5b7d9-f7d1-9f16-8f56-f13578ac6a6b', 13244, N'USD', N'2026-09-25T15:26:33.858Z', 0, 20),
  (N'demo-970f432c-8525-91d2-2865-b80e5e263b44', N'mock-store-api', N'970f432c-8525-91d2-2865-b80e5e263b44', N'Ốp điện thoại dẻo chống trầy họa tiết ngân hà', N'Linh kiện', 864000, N'Ốp điện thoại dẻo chống trầy họa tiết ngân hà.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: SOLSM31TPU0023.
Thiết bị tương thích: Samsung Galaxy M31.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0323-demo-970f432c-8525-91d2-2865-b80e5e263b44.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Samsung Galaxy M31","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/970f432c-8525-91d2-2865-b80e5e263b44', 3454, N'USD', N'2026-09-25T15:25:27.887Z', 0, 20),
  (N'demo-9ac1660d-e861-da15-c69b-dfee434007e0', N'mock-store-api', N'9ac1660d-e861-da15-c69b-dfee434007e0', N'Ốp điện thoại cứng họa tiết trang trí', N'Linh kiện', 6164000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8289-SL40723.
Thiết bị tương thích: Lenovo K6 Note.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0331-demo-9ac1660d-e861-da15-c69b-dfee434007e0.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Lenovo K6 Note","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/9ac1660d-e861-da15-c69b-dfee434007e0', 24657, N'USD', N'2026-09-25T15:26:23.426Z', 0, 20),
  (N'demo-a598b7a2-bbd7-6bd4-6686-28f00c48262c', N'mock-store-api', N'a598b7a2-bbd7-6bd4-6686-28f00c48262c', N'Ốp điện thoại cứng họa tiết trang trí', N'Linh kiện', 2894000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8581-SL40524.
Thiết bị tương thích: Apple iPhone Xs Max.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0345-demo-a598b7a2-bbd7-6bd4-6686-28f00c48262c.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Apple iPhone Xs Max","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/a598b7a2-bbd7-6bd4-6686-28f00c48262c', 11576, N'USD', N'2026-09-25T15:26:41.581Z', 0, 20),
  (N'demo-a67c8e94-c045-e966-246c-57bca8aa147a', N'mock-store-api', N'a67c8e94-c045-e966-246c-57bca8aa147a', N'Ốp điện thoại dẻo họa tiết trang trí', N'Linh kiện', 2901000, N'Ốp điện thoại dẻo họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10380-SL40617.
Thiết bị tương thích: Asus Zenfone 2 Laser ZE550KL.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0351-demo-a67c8e94-c045-e966-246c-57bca8aa147a.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Asus Zenfone 2 Laser ZE550KL","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/a67c8e94-c045-e966-246c-57bca8aa147a', 11605, N'USD', N'2026-09-25T15:26:23.426Z', 0, 20),
  (N'demo-a6a599d2-bdfc-fb0b-6946-2f2c549cbe26', N'mock-store-api', N'a6a599d2-bdfc-fb0b-6946-2f2c549cbe26', N'Hạt sấy tổng hợp vị anh đào', N'Tự Thiết Kế', 2461000, N'Hạt sấy tổng hợp vị anh đào.

Thương hiệu: Wickedly Prime.
Khối lượng: 0,64 kg.
Chiều cao: 10,16 cm.
Chiều dài: 30,48 cm.
Chiều rộng: 27,94 cm.', N'/products/ai-generated-500/0056-demo-a6a599d2-bdfc-fb0b-6946-2f2c549cbe26.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,64 kg","Chi\u1EC1u cao: 10,16 cm","Chi\u1EC1u d\u00E0i: 30,48 cm","Chi\u1EC1u r\u1ED9ng: 27,94 cm"]', N'sand', N'✿', N'Demo', N'https://store.halukaksoy.dev/api/products/a6a599d2-bdfc-fb0b-6946-2f2c549cbe26', 9844, N'USD', N'2026-09-25T15:24:38.935Z', 0, 20),
  (N'demo-a8bfccf6-2b7f-f69a-ba22-bc6a17958e1e', N'mock-store-api', N'a8bfccf6-2b7f-f69a-ba22-bc6a17958e1e', N'Ốp điện thoại dẻo họa tiết trang trí', N'Linh kiện', 604000, N'Ốp điện thoại dẻo họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10654-SL11074.
Thiết bị tương thích: Panasonic P100.
Chất liệu: Silicôn.
Kiểu dáng: Họa tiết xe.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0355-demo-a8bfccf6-2b7f-f69a-ba22-bc6a17958e1e.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Panasonic P100","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Ki\u1EC3u d\u00E1ng: H\u1ECDa ti\u1EBFt xe","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/a8bfccf6-2b7f-f69a-ba22-bc6a17958e1e', 2415, N'USD', N'2026-09-25T15:25:21.668Z', 0, 20),
  (N'demo-aab54a8a-b9d1-fedc-897e-120fc31d01bf', N'mock-store-api', N'aab54a8a-b9d1-fedc-897e-120fc31d01bf', N'Ốp điện thoại cứng họa tiết trang trí', N'Linh kiện', 5287000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8717-SL40732.
Thiết bị tương thích: OnePlus 7T Pro.
Chất liệu: Nhựa.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0358-demo-aab54a8a-b9d1-fedc-897e-120fc31d01bf.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: OnePlus 7T Pro","Ch\u1EA5t li\u1EC7u: Nh\u1EF1a","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/aab54a8a-b9d1-fedc-897e-120fc31d01bf', 21147, N'USD', N'2026-09-25T15:26:57.421Z', 0, 20),
  (N'demo-ab497411-7c45-ca48-1250-034133eb9485', N'mock-store-api', N'ab497411-7c45-ca48-1250-034133eb9485', N'Trà túi lọc dùng pha lạnh', N'Tự Thiết Kế', 1258000, N'Trà túi lọc dùng pha lạnh.

Thương hiệu: Happy Belly.
Khối lượng: 0,22 kg.
Chiều cao: 8,89 cm.
Chiều dài: 21,59 cm.
Chiều rộng: 6,35 cm.', N'/products/ai-generated-500/0063-demo-ab497411-7c45-ca48-1250-034133eb9485.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng: 0,22 kg","Chi\u1EC1u cao: 8,89 cm","Chi\u1EC1u d\u00E0i: 21,59 cm","Chi\u1EC1u r\u1ED9ng: 6,35 cm"]', N'sand', N'✿', N'Demo', N'https://store.halukaksoy.dev/api/products/ab497411-7c45-ca48-1250-034133eb9485', 5033, N'USD', N'2026-09-25T15:25:17.437Z', 0, 20),
  (N'demo-b9064e4c-3d97-db81-57f7-897b51301938', N'mock-store-api', N'b9064e4c-3d97-db81-57f7-897b51301938', N'Viên nén pha ca cao sữa nóng', N'Tự Thiết Kế', 5389000, N'Viên nén pha ca cao sữa nóng.

Thương hiệu: Happy Belly.
Chiều cao: 10,16 cm.
Chiều dài: 19,05 cm.
Chiều rộng: 13,81 cm.', N'/products/ai-generated-500/0069-demo-b9064e4c-3d97-db81-57f7-897b51301938.webp', N'["Chi\u1EC1u cao: 10,16 cm","Chi\u1EC1u d\u00E0i: 19,05 cm","Chi\u1EC1u r\u1ED9ng: 13,81 cm"]', N'sand', N'✿', N'Demo', N'https://store.halukaksoy.dev/api/products/b9064e4c-3d97-db81-57f7-897b51301938', 21557, N'USD', N'2026-09-25T15:27:03.008Z', 0, 20),
  (N'demo-b9429136-feec-6833-7ae9-adce66f3f047', N'mock-store-api', N'b9429136-feec-6833-7ae9-adce66f3f047', N'Ốp điện thoại cứng họa tiết trừu tượng', N'Linh kiện', 2269000, N'Ốp điện thoại cứng họa tiết trừu tượng.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8390-SL40805.
Thiết bị tương thích: LG Stylus 2.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0366-demo-b9429136-feec-6833-7ae9-adce66f3f047.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: LG Stylus 2","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/b9429136-feec-6833-7ae9-adce66f3f047', 9076, N'USD', N'2026-09-25T15:26:07.397Z', 0, 20),
  (N'demo-c9935312-d792-8181-858e-09d11cda1999', N'mock-store-api', N'c9935312-d792-8181-858e-09d11cda1999', N'Ốp điện thoại cứng họa tiết trang trí', N'Linh kiện', 1748000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8204-SL40624.
Thiết bị tương thích: Lenovo Vibe X3.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0377-demo-c9935312-d792-8181-858e-09d11cda1999.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Lenovo Vibe X3","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/c9935312-d792-8181-858e-09d11cda1999', 6992, N'USD', N'2026-09-25T15:25:25.341Z', 0, 20),
  (N'demo-cc0cd1f9-e4a5-ddb2-e659-bbc63de7d02c', N'mock-store-api', N'cc0cd1f9-e4a5-ddb2-e659-bbc63de7d02c', N'Ốp điện thoại dẻo chống trầy họa tiết trang trí', N'Linh kiện', 3439000, N'Ốp điện thoại dẻo chống trầy họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: SOLOPPOF11PROTPU0134_11.
Thiết bị tương thích: Oppo F11 Pro.
Chất liệu: Nhựa.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0378-demo-cc0cd1f9-e4a5-ddb2-e659-bbc63de7d02c.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Oppo F11 Pro","Ch\u1EA5t li\u1EC7u: Nh\u1EF1a","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/cc0cd1f9-e4a5-ddb2-e659-bbc63de7d02c', 13755, N'USD', N'2026-09-25T15:27:09.422Z', 0, 20),
  (N'demo-d0a51de0-254c-f07b-6d04-9aa2400ecfff', N'mock-store-api', N'd0a51de0-254c-f07b-6d04-9aa2400ecfff', N'Tranh thuyền trên sông khung đen', N'Tự Thiết Kế', 1377000, N'Tranh thuyền trên sông khung đen.

Thương hiệu: Stone & Beam.
Mã hoặc tên mẫu: 1-40166.
Màu sắc: Đen.
Kiểu dáng: Hiện đại.
Khối lượng: 1,63 kg.
Chiều cao: 3,18 cm.
Chiều dài: 38,10 cm.
Chiều rộng: 33,02 cm.', N'/products/ai-generated-500/0076-demo-d0a51de0-254c-f07b-6d04-9aa2400ecfff.webp', N'["M\u00E0u s\u1EAFc: \u0110en","Ki\u1EC3u d\u00E1ng: Hi\u1EC7n \u0111\u1EA1i","Kh\u1ED1i l\u01B0\u1EE3ng: 1,63 kg","Chi\u1EC1u cao: 3,18 cm"]', N'sand', N'✿', N'Demo', N'https://store.halukaksoy.dev/api/products/d0a51de0-254c-f07b-6d04-9aa2400ecfff', 5509, N'USD', N'2026-09-25T15:25:21.668Z', 0, 20),
  (N'demo-d230122a-afcb-b52a-430c-73c16bf128ef', N'mock-store-api', N'd230122a-afcb-b52a-430c-73c16bf128ef', N'Ốp điện thoại cứng họa tiết trang trí', N'Linh kiện', 1657000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8595-SL40787.
Thiết bị tương thích: Asus Zenfone Max Pro M1 ZB601KL.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0388-demo-d230122a-afcb-b52a-430c-73c16bf128ef.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Asus Zenfone Max Pro M1 ZB601KL","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/d230122a-afcb-b52a-430c-73c16bf128ef', 6629, N'USD', N'2026-09-25T15:24:59.274Z', 0, 20),
  (N'demo-d2415386-acbe-fb82-d337-26ac7b6c3391', N'mock-store-api', N'd2415386-acbe-fb82-d337-26ac7b6c3391', N'Ốp điện thoại cứng họa tiết ngân hà', N'Tự Thiết Kế', 4358000, N'Ốp điện thoại cứng họa tiết ngân hà.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8017-SL40643.
Thiết bị tương thích: Samsung Galaxy E7.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0080-demo-d2415386-acbe-fb82-d337-26ac7b6c3391.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Samsung Galaxy E7","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'sand', N'✿', N'Demo', N'https://store.halukaksoy.dev/api/products/d2415386-acbe-fb82-d337-26ac7b6c3391', 17431, N'USD', N'2026-09-25T15:26:17.233Z', 0, 20),
  (N'demo-d27f1be0-9d12-f06c-1e7e-4677614851af', N'mock-store-api', N'd27f1be0-9d12-f06c-1e7e-4677614851af', N'Ốp điện thoại dẻo họa tiết đôi tình nhân', N'Linh kiện', 5921000, N'Ốp điện thoại dẻo họa tiết đôi tình nhân.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10705-SL40744.
Thiết bị tương thích: Samsung Galaxy M10.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0390-demo-d27f1be0-9d12-f06c-1e7e-4677614851af.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Samsung Galaxy M10","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/d27f1be0-9d12-f06c-1e7e-4677614851af', 23684, N'USD', N'2026-09-25T15:27:03.008Z', 0, 20),
  (N'demo-d2e8ae50-2832-f70f-22de-fed472dc3634', N'mock-store-api', N'd2e8ae50-2832-f70f-22de-fed472dc3634', N'Ốp điện thoại dẻo họa tiết trang trí', N'Linh kiện', 5635000, N'Ốp điện thoại dẻo họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10243-SL40617.
Thiết bị tương thích: Micromax Yu Yureka Black.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0395-demo-d2e8ae50-2832-f70f-22de-fed472dc3634.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Micromax Yu Yureka Black","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/d2e8ae50-2832-f70f-22de-fed472dc3634', 22540, N'USD', N'2026-09-25T15:26:17.233Z', 0, 20),
  (N'demo-d44f4f62-5214-5671-d3e7-43cd5765f87c', N'mock-store-api', N'd44f4f62-5214-5671-d3e7-43cd5765f87c', N'Ốp điện thoại dẻo họa tiết trang trí', N'Linh kiện', 5165000, N'Ốp điện thoại dẻo họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10723-SL11269.
Thiết bị tương thích: Asus ZenFone Max Pro M2.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0400-demo-d44f4f62-5214-5671-d3e7-43cd5765f87c.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Asus ZenFone Max Pro M2","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/d44f4f62-5214-5671-d3e7-43cd5765f87c', 20661, N'USD', N'2026-09-25T15:27:03.008Z', 0, 20),
  (N'demo-d6080857-59f5-bab7-2dfc-c9fc166c53b2', N'mock-store-api', N'd6080857-59f5-bab7-2dfc-c9fc166c53b2', N'Ốp điện thoại cứng họa tiết trang trí', N'Linh kiện', 1953000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8178-SL40399.
Thiết bị tương thích: Meizu M3 Note.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0401-demo-d6080857-59f5-bab7-2dfc-c9fc166c53b2.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Meizu M3 Note","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/d6080857-59f5-bab7-2dfc-c9fc166c53b2', 7810, N'USD', N'2026-09-25T15:27:17.278Z', 0, 20),
  (N'demo-da3bb45e-9908-41a1-1bd4-7488b9568e62', N'mock-store-api', N'da3bb45e-9908-41a1-1bd4-7488b9568e62', N'Ốp điện thoại dẻo chữ trang trí', N'Linh kiện', 3370000, N'Ốp điện thoại dẻo chữ trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10854-SL13014.
Thiết bị tương thích: Nokia 6.2.
Chất liệu: Silicôn.
Kiểu dáng: Trang trí chữ.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0406-demo-da3bb45e-9908-41a1-1bd4-7488b9568e62.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Nokia 6.2","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Ki\u1EC3u d\u00E1ng: Trang tr\u00ED ch\u1EEF","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/da3bb45e-9908-41a1-1bd4-7488b9568e62', 13478, N'USD', N'2026-09-25T15:25:05.568Z', 0, 20),
  (N'demo-e7593ccf-aa84-7cdc-4758-b7dbefe87e92', N'mock-store-api', N'e7593ccf-aa84-7cdc-4758-b7dbefe87e92', N'Ốp điện thoại dẻo họa tiết hoa', N'Linh kiện', 1095000, N'Ốp điện thoại dẻo họa tiết hoa.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10184-SL40472.
Thiết bị tương thích: Motorola Moto E4 Plus.
Chất liệu: Silicôn.
Kiểu dáng: Họa tiết trang trí.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0413-demo-e7593ccf-aa84-7cdc-4758-b7dbefe87e92.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Motorola Moto E4 Plus","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Ki\u1EC3u d\u00E1ng: H\u1ECDa ti\u1EBFt trang tr\u00ED","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/e7593ccf-aa84-7cdc-4758-b7dbefe87e92', 4380, N'USD', N'2026-09-25T15:24:54.798Z', 0, 20),
  (N'demo-eae1576f-46f0-59d6-e28c-5144e9ed79ca', N'mock-store-api', N'eae1576f-46f0-59d6-e28c-5144e9ed79ca', N'Ốp điện thoại dẻo chống trầy họa tiết trang trí', N'Linh kiện', 3226000, N'Ốp điện thoại dẻo chống trầy họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: SOLR6ATPU0003_3.
Thiết bị tương thích: Xiaomi Redmi 6A.
Kiểu dáng: Nhiều màu.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0416-demo-eae1576f-46f0-59d6-e28c-5144e9ed79ca.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Xiaomi Redmi 6A","Ki\u1EC3u d\u00E1ng: Nhi\u1EC1u m\u00E0u","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/eae1576f-46f0-59d6-e28c-5144e9ed79ca', 12904, N'USD', N'2026-09-25T15:25:27.887Z', 0, 20),
  (N'demo-ef6a7b6a-c8b6-0341-b6d0-009b0da72df4', N'mock-store-api', N'ef6a7b6a-c8b6-0341-b6d0-009b0da72df4', N'Ốp điện thoại dẻo họa tiết trang trí', N'Linh kiện', 5648000, N'Ốp điện thoại dẻo họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: UV10893-SL40452.
Thiết bị tương thích: Techno Spark Go Plus.
Chất liệu: Silicôn.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0422-demo-ef6a7b6a-c8b6-0341-b6d0-009b0da72df4.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Techno Spark Go Plus","Ch\u1EA5t li\u1EC7u: Silic\u00F4n","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/ef6a7b6a-c8b6-0341-b6d0-009b0da72df4', 22590, N'USD', N'2026-09-25T15:25:27.886Z', 0, 20),
  (N'demo-f22d9691-c00f-5b9a-1504-4b5c697b88cb', N'mock-store-api', N'f22d9691-c00f-5b9a-1504-4b5c697b88cb', N'Ốp điện thoại cứng họa tiết trang trí', N'Linh kiện', 1423000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8703-SL13062.
Thiết bị tương thích: Vivo S1 / Vivo Z1x.
Chất liệu: Nhựa.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0425-demo-f22d9691-c00f-5b9a-1504-4b5c697b88cb.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Vivo S1 / Vivo Z1x","Ch\u1EA5t li\u1EC7u: Nh\u1EF1a","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/f22d9691-c00f-5b9a-1504-4b5c697b88cb', 5692, N'USD', N'2026-09-25T15:25:57.529Z', 0, 20),
  (N'demo-f87bfdfd-ce57-d7e6-d2d4-2c502c169287', N'mock-store-api', N'f87bfdfd-ce57-d7e6-d2d4-2c502c169287', N'Ốp điện thoại dẻo chống trầy họa tiết trái tim', N'Linh kiện', 4925000, N'Ốp điện thoại dẻo chống trầy họa tiết trái tim.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: SOLPOCOX2TPU0074.
Thiết bị tương thích: Poco X2 / Xiaomi Redmi K30.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0433-demo-f87bfdfd-ce57-d7e6-d2d4-2c502c169287.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Poco X2 / Xiaomi Redmi K30","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/f87bfdfd-ce57-d7e6-d2d4-2c502c169287', 19700, N'USD', N'2026-09-25T15:25:57.529Z', 0, 20),
  (N'demo-fba3ffa5-eaeb-4f51-1b49-f8bfee555169', N'mock-store-api', N'fba3ffa5-eaeb-4f51-1b49-f8bfee555169', N'Ốp điện thoại cứng họa tiết trang trí', N'Linh kiện', 4360000, N'Ốp điện thoại cứng họa tiết trang trí.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8228-SL40451.
Thiết bị tương thích: Oppo F1 Plus.
Kiểu dáng: Thể thao.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0435-demo-fba3ffa5-eaeb-4f51-1b49-f8bfee555169.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Oppo F1 Plus","Ki\u1EC3u d\u00E1ng: Th\u1EC3 thao","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/fba3ffa5-eaeb-4f51-1b49-f8bfee555169', 17439, N'USD', N'2026-09-25T15:26:07.397Z', 0, 20),
  (N'demo-fd23a34d-ed05-c537-0257-c4b537709f8d', N'mock-store-api', N'fd23a34d-ed05-c537-0257-c4b537709f8d', N'Ốp điện thoại cứng họa tiết tình yêu', N'Linh kiện', 3259000, N'Ốp điện thoại cứng họa tiết tình yêu.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8055-SL40741.
Thiết bị tương thích: Sony Xperia Z5 Dual.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0437-demo-fd23a34d-ed05-c537-0257-c4b537709f8d.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Sony Xperia Z5 Dual","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/fd23a34d-ed05-c537-0257-c4b537709f8d', 13036, N'USD', N'2026-09-25T15:24:54.798Z', 0, 20),
  (N'demo-fd77911a-49ab-e8d2-53e2-f16f4899b452', N'mock-store-api', N'fd77911a-49ab-e8d2-53e2-f16f4899b452', N'Ốp điện thoại cứng vân đá cẩm thạch', N'Linh kiện', 770000, N'Ốp điện thoại cứng vân đá cẩm thạch.

Thương hiệu: Amazon Brand - Solimo.
Mã hoặc tên mẫu: gz8238-SL40541.
Thiết bị tương thích: Oppo F1s.
Khối lượng: 0,05 kg.', N'/products/ai-generated-500/0439-demo-fd77911a-49ab-e8d2-53e2-f16f4899b452.webp', N'["Thi\u1EBFt b\u1ECB t\u01B0\u01A1ng th\u00EDch: Oppo F1s","Kh\u1ED1i l\u01B0\u1EE3ng: 0,05 kg"]', N'blue', N'⌁', N'Demo', N'https://store.halukaksoy.dev/api/products/fd77911a-49ab-e8d2-53e2-f16f4899b452', 3079, N'USD', N'2026-09-25T15:26:23.426Z', 0, 20),
  (N'dummyjson-1', N'dummyjson', N'1', N'Chuốt mi làm dày và dài', N'Làm đẹp', 250000, N'Chuốt mi làm dày và dài.

Thương hiệu: Essence.
Mã hoặc tên mẫu: Essence Lash Princess.
Khối lượng theo nguồn: 4 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 15.14 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 13.08 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 22.99 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0341-dummyjson-1.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 4 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 15.14 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 13.08 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 22.99 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'green', N'✦', N'Demo -10%', N'https://dummyjson.com/products/1', 999, N'USD', N'2026-09-25T15:21:54.360Z', 10, 20),
  (N'dummyjson-10', N'dummyjson', N'10', N'Nước hoa nữ hương hoa', N'Làm đẹp', 2000000, N'Nước hoa nữ hương hoa.

Thương hiệu: Gucci.
Mã hoặc tên mẫu: Gucci Bloom.
Khối lượng theo nguồn: 7 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 20.92 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 21.68 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 11.2 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0344-dummyjson-10.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 7 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 20.92 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 21.68 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 11.2 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'green', N'✦', N'Demo -14%', N'https://dummyjson.com/products/10', 7999, N'USD', N'2026-09-25T15:22:08.961Z', 14, 20),
  (N'dummyjson-100', N'dummyjson', N'100', N'Tai nghe không dây dạng nút', N'Linh kiện', 3250000, N'Tai nghe không dây dạng nút.

Thương hiệu: Apple.
Mã hoặc tên mẫu: Apple AirPods True Wireless.
Khối lượng theo nguồn: 4 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 25.79 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 18.38 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 11.53 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0441-dummyjson-100.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 4 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 25.79 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 18.38 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 11.53 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'blue', N'⌁', N'Demo -16%', N'https://dummyjson.com/products/100', 12999, N'USD', N'2026-09-25T15:23:00.873Z', 16, 20),
  (N'dummyjson-101', N'dummyjson', N'101', N'Tai nghe không dây chụp tai màu bạc', N'Linh kiện', 13750000, N'Tai nghe không dây chụp tai màu bạc.

Thương hiệu: Apple.
Mã hoặc tên mẫu: Apple AirPods Max.
Khối lượng theo nguồn: 2 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 24.88 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 14.9 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 27.54 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0444-dummyjson-101.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 2 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 24.88 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 14.9 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 27.54 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'blue', N'⌁', N'Demo -14%', N'https://dummyjson.com/products/101', 54999, N'USD', N'2026-09-25T15:23:00.199Z', 14, 20),
  (N'dummyjson-102', N'dummyjson', N'102', N'Đế sạc không dây đa dụng', N'Linh kiện', 2000000, N'Đế sạc không dây đa dụng.

Thương hiệu: Apple.
Mã hoặc tên mẫu: Apple AirPower.
Khối lượng theo nguồn: 5 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 25.25 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 25.44 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 10.98 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0448-dummyjson-102.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 5 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 25.25 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 25.44 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 10.98 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'blue', N'⌁', N'Demo -4%', N'https://dummyjson.com/products/102', 7999, N'USD', N'2026-09-25T15:21:44.353Z', 4, 20),
  (N'dummyjson-103', N'dummyjson', N'103', N'Loa thông minh nhỏ màu xám', N'Linh kiện', 2500000, N'Loa thông minh nhỏ màu xám.

Thương hiệu: Apple.
Mã hoặc tên mẫu: Apple HomePod Mini.
Khối lượng theo nguồn: 10 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 16.02 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 29.2 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 19.81 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0450-dummyjson-103.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 10 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 16.02 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 29.2 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 19.81 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'blue', N'⌁', N'Demo -18%', N'https://dummyjson.com/products/103', 9999, N'USD', N'2026-09-25T15:24:01.248Z', 18, 20),
  (N'dummyjson-104', N'dummyjson', N'104', N'Củ sạc nhanh cho điện thoại', N'Linh kiện', 500000, N'Củ sạc nhanh cho điện thoại.

Thương hiệu: Apple.
Mã hoặc tên mẫu: Apple iPhone.
Khối lượng theo nguồn: 1 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 13.63 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 26.25 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 5.95 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0452-dummyjson-104.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 1 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 13.63 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 26.25 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 5.95 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'blue', N'⌁', N'Demo -19%', N'https://dummyjson.com/products/104', 1999, N'USD', N'2026-09-25T15:21:51.484Z', 19, 20),
  (N'dummyjson-105', N'dummyjson', N'105', N'Pin dự phòng không dây gắn từ tính', N'Linh kiện', 2500000, N'Pin dự phòng không dây gắn từ tính.

Thương hiệu: Apple.
Mã hoặc tên mẫu: Apple MagSafe.
Khối lượng theo nguồn: 6 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 15.4 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 11.89 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 19.67 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0454-dummyjson-105.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 6 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 15.4 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 11.89 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 19.67 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'blue', N'⌁', N'Demo -17%', N'https://dummyjson.com/products/105', 9999, N'USD', N'2026-09-25T15:23:13.648Z', 17, 20),
  (N'dummyjson-106', N'dummyjson', N'106', N'Đồng hồ thông minh viền vàng', N'Linh kiện', 8750000, N'Đồng hồ thông minh viền vàng.

Thương hiệu: Apple.
Mã hoặc tên mẫu: Apple Watch Series 4.
Khối lượng theo nguồn: 6 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 27.69 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 28.03 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 7.11 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0458-dummyjson-106.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 6 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 27.69 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 28.03 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 7.11 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'blue', N'⌁', N'Demo -12%', N'https://dummyjson.com/products/106', 34999, N'USD', N'2026-09-25T15:21:58.607Z', 12, 20),
  (N'dummyjson-107', N'dummyjson', N'107', N'Tai nghe không dây có dây nối', N'Linh kiện', 1250000, N'Tai nghe không dây có dây nối.

Thương hiệu: Beats.
Mã hoặc tên mẫu: Beats Flex.
Khối lượng theo nguồn: 8 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 17.86 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 25.74 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 23.09 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0461-dummyjson-107.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 8 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 17.86 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 25.74 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 23.09 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'blue', N'⌁', N'Demo -6%', N'https://dummyjson.com/products/107', 4999, N'USD', N'2026-09-25T15:22:12.360Z', 6, 20),
  (N'dummyjson-108', N'dummyjson', N'108', N'Ốp điện thoại dẻo gắn từ tính màu mận', N'Linh kiện', 750000, N'Ốp điện thoại dẻo gắn từ tính màu mận.

Thương hiệu: Apple.
Mã hoặc tên mẫu: iPhone 12 MagSafe.
Khối lượng theo nguồn: 7 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 12.49 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 11.29 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 23.52 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0463-dummyjson-108.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 7 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 12.49 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 11.29 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 23.52 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'blue', N'⌁', N'Demo -14%', N'https://dummyjson.com/products/108', 2999, N'USD', N'2026-09-25T15:22:37.448Z', 14, 20),
  (N'dummyjson-109', N'dummyjson', N'109', N'Gậy chụp ảnh đơn chân', N'Linh kiện', 500000, N'Gậy chụp ảnh đơn chân.

Thương hiệu: TechGear.
Mã hoặc tên mẫu: MOB-TEC-MON-109.
Khối lượng theo nguồn: 10 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 8.8 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 12.93 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 21.1 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0466-dummyjson-109.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 10 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 8.8 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 12.93 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 21.1 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'blue', N'⌁', N'Demo -9%', N'https://dummyjson.com/products/109', 1999, N'USD', N'2026-09-25T15:21:50.461Z', 9, 20),
  (N'dummyjson-110', N'dummyjson', N'110', N'Đèn phát trực tiếp kèm giá đỡ điện thoại', N'Linh kiện', 375000, N'Đèn phát trực tiếp kèm giá đỡ điện thoại.

Thương hiệu: GadgetMaster.
Mã hoặc tên mẫu: MOB-GAD-SEL-110.
Khối lượng theo nguồn: 10 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 5.26 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 13.84 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 22.83 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0470-dummyjson-110.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 10 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 5.26 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 13.84 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 22.83 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'blue', N'⌁', N'Demo -19%', N'https://dummyjson.com/products/110', 1499, N'USD', N'2026-09-25T15:22:52.828Z', 19, 20),
  (N'dummyjson-111', N'dummyjson', N'111', N'Gậy chụp ảnh kiêm chân đế ba chân', N'Linh kiện', 325000, N'Gậy chụp ảnh kiêm chân đế ba chân.

Thương hiệu: SnapTech.
Mã hoặc tên mẫu: MOB-SNA-SEL-111.
Khối lượng theo nguồn: 2 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 24.76 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 26.38 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 21.39 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0472-dummyjson-111.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 2 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 24.76 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 26.38 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 21.39 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'blue', N'⌁', N'Demo -19%', N'https://dummyjson.com/products/111', 1299, N'USD', N'2026-09-25T15:22:11.675Z', 19, 20),
  (N'dummyjson-112', N'dummyjson', N'112', N'Chân máy quay chuyên dụng', N'Linh kiện', 12500000, N'Chân máy quay chuyên dụng.

Thương hiệu: ProVision.
Mã hoặc tên mẫu: MOB-PRO-STU-112.
Khối lượng theo nguồn: 4 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 29.84 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 11.01 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 6.81 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0475-dummyjson-112.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 4 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 29.84 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 11.01 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 6.81 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'blue', N'⌁', N'Demo -8%', N'https://dummyjson.com/products/112', 49999, N'USD', N'2026-09-25T15:23:08.542Z', 8, 20),
  (N'dummyjson-118', N'dummyjson', N'118', N'Nước rửa tay hữu cơ dịu nhẹ', N'Làm đẹp', 225000, N'Nước rửa tay hữu cơ dịu nhẹ.

Thương hiệu: Attitude.
Mã hoặc tên mẫu: SKI-ATT-ATT-118.
Khối lượng theo nguồn: 1 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 14.05 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 8.3 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 16.62 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0350-dummyjson-118.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 1 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 14.05 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 8.3 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 16.62 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'green', N'✦', N'Demo -18%', N'https://dummyjson.com/products/118', 899, N'USD', N'2026-09-25T15:23:03.092Z', 18, 20),
  (N'dummyjson-123', N'dummyjson', N'123', N'Điện thoại thông minh dòng chuyên nghiệp', N'Linh kiện', 27500000, N'Điện thoại thông minh dòng chuyên nghiệp.

Thương hiệu: Apple.
Mã hoặc tên mẫu: Apple iPhone 13 Pro.
Khối lượng theo nguồn: 8 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 12.63 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 5.28 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 14.29 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0482-dummyjson-123.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 8 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 12.63 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 5.28 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 14.29 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'blue', N'⌁', N'Demo -9%', N'https://dummyjson.com/products/123', 109999, N'USD', N'2026-09-25T15:22:46.774Z', 9, 20),
  (N'dummyjson-124', N'dummyjson', N'124', N'Điện thoại thông minh màn hình tự phát sáng', N'Linh kiện', 22500000, N'Điện thoại thông minh màn hình tự phát sáng.

Thương hiệu: Apple.
Mã hoặc tên mẫu: Apple iPhone X OLED.
Khối lượng theo nguồn: 1 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 21.88 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 24.19 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 14.19 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0484-dummyjson-124.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 1 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 21.88 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 24.19 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 14.19 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'blue', N'⌁', N'Demo -20%', N'https://dummyjson.com/products/124', 89999, N'USD', N'2026-09-25T15:21:42.781Z', 20, 20),
  (N'dummyjson-125', N'dummyjson', N'125', N'Điện thoại thông minh cảm ứng', N'Linh kiện', 6250000, N'Điện thoại thông minh cảm ứng.

Thương hiệu: Oppo.
Mã hoặc tên mẫu: Oppo A57.
Khối lượng theo nguồn: 5 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 7.2 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 10.74 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 23.68 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0486-dummyjson-125.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 5 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 7.2 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 10.74 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 23.68 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'blue', N'⌁', N'Demo -2%', N'https://dummyjson.com/products/125', 24999, N'USD', N'2026-09-25T15:22:35.616Z', 2, 20),
  (N'dummyjson-126', N'dummyjson', N'126', N'Điện thoại thông minh kết nối thế hệ năm', N'Linh kiện', 10000000, N'Điện thoại thông minh kết nối thế hệ năm.

Thương hiệu: Oppo.
Mã hoặc tên mẫu: Oppo F19 Pro Plus 5G.
Khối lượng theo nguồn: 6 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 6.78 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 25.17 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 8.4 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0489-dummyjson-126.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 6 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 6.78 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 25.17 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 8.4 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'blue', N'⌁', N'Demo -19%', N'https://dummyjson.com/products/126', 39999, N'USD', N'2026-09-25T15:22:05.335Z', 19, 20),
  (N'dummyjson-128', N'dummyjson', N'128', N'Điện thoại thông minh đa dụng', N'Linh kiện', 3750000, N'Điện thoại thông minh đa dụng.

Thương hiệu: Realme.
Mã hoặc tên mẫu: Realme C35.
Khối lượng theo nguồn: 2 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 25.28 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 8.14 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 29.53 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0493-dummyjson-128.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 2 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 25.28 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 8.14 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 29.53 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'blue', N'⌁', N'Demo -15%', N'https://dummyjson.com/products/128', 14999, N'USD', N'2026-09-25T15:23:38.710Z', 15, 20),
  (N'dummyjson-131', N'dummyjson', N'131', N'Điện thoại thông minh màn hình phẳng', N'Linh kiện', 7500000, N'Điện thoại thông minh màn hình phẳng.

Thương hiệu: Samsung.
Mã hoặc tên mẫu: Samsung Galaxy S7.
Khối lượng theo nguồn: 10 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 13.55 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 24.24 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 5.63 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0497-dummyjson-131.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 10 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 13.55 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 24.24 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 5.63 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'blue', N'⌁', N'Demo -20%', N'https://dummyjson.com/products/131', 29999, N'USD', N'2026-09-25T15:22:05.748Z', 20, 20),
  (N'dummyjson-16', N'dummyjson', N'16', N'Táo tươi giòn', N'Tự Thiết Kế', 50000, N'Táo tươi giòn.

Mã hoặc tên mẫu: GRO-BRD-APP-016.
Khối lượng theo nguồn: 9 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 13.66 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 11.01 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 9.73 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0085-dummyjson-16.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 9 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 13.66 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 11.01 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 9.73 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'sand', N'✿', N'Demo -13%', N'https://dummyjson.com/products/16', 199, N'USD', N'2026-09-25T15:22:38.626Z', 13, 20),
  (N'dummyjson-17', N'dummyjson', N'17', N'Thịt bò thăn lưng', N'Tự Thiết Kế', 325000, N'Thịt bò thăn lưng.

Mã hoặc tên mẫu: GRO-BRD-BEE-017.
Khối lượng theo nguồn: 10 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 18.9 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 5.77 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 18.57 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0088-dummyjson-17.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 10 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 18.9 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 5.77 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 18.57 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'sand', N'✿', N'Demo -10%', N'https://dummyjson.com/products/17', 1299, N'USD', N'2026-09-25T15:24:15.488Z', 10, 20),
  (N'dummyjson-18', N'dummyjson', N'18', N'Thức ăn hạt cho mèo', N'Tự Thiết Kế', 225000, N'Thức ăn hạt cho mèo.

Mã hoặc tên mẫu: GRO-BRD-FOO-018.
Khối lượng theo nguồn: 10 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 18.08 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 9.26 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 21.86 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0093-dummyjson-18.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 10 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 18.08 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 9.26 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 21.86 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'sand', N'✿', N'Demo -10%', N'https://dummyjson.com/products/18', 899, N'USD', N'2026-09-25T15:22:38.898Z', 10, 20),
  (N'dummyjson-19', N'dummyjson', N'19', N'Thịt ức gà phi lê', N'Tự Thiết Kế', 250000, N'Thịt ức gà phi lê.

Mã hoặc tên mẫu: GRO-BRD-CHI-019.
Khối lượng theo nguồn: 1 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 11.03 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 22.11 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 16.01 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0096-dummyjson-19.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 1 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 11.03 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 22.11 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 16.01 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'sand', N'✿', N'Demo -14%', N'https://dummyjson.com/products/19', 999, N'USD', N'2026-09-25T15:24:00.784Z', 14, 20),
  (N'dummyjson-2', N'dummyjson', N'2', N'Bảng phấn mắt nhiều màu có gương', N'Làm đẹp', 500000, N'Bảng phấn mắt nhiều màu có gương.

Thương hiệu: Glamour Beauty.
Mã hoặc tên mẫu: BEA-GLA-EYE-002.
Khối lượng theo nguồn: 9 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 9.26 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 22.47 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 27.67 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0360-dummyjson-2.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 9 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 9.26 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 22.47 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 27.67 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'green', N'✦', N'Demo -18%', N'https://dummyjson.com/products/2', 1999, N'USD', N'2026-09-25T15:22:52.078Z', 18, 20),
  (N'dummyjson-20', N'dummyjson', N'20', N'Dầu ăn thực vật', N'Tự Thiết Kế', 125000, N'Dầu ăn thực vật.

Mã hoặc tên mẫu: GRO-BRD-COO-020.
Khối lượng theo nguồn: 5 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 19.95 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 27.54 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 24.86 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0103-dummyjson-20.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 5 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 19.95 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 27.54 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 24.86 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'sand', N'✿', N'Demo -9%', N'https://dummyjson.com/products/20', 499, N'USD', N'2026-09-25T15:21:51.641Z', 9, 20),
  (N'dummyjson-21', N'dummyjson', N'21', N'Dưa chuột hữu cơ', N'Tự Thiết Kế', 37000, N'Dưa chuột hữu cơ.

Mã hoặc tên mẫu: GRO-BRD-CUC-021.
Khối lượng theo nguồn: 4 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 12.8 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 28.38 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 21.34 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0106-dummyjson-21.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 4 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 12.8 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 28.38 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 21.34 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'sand', N'✿', N'Demo -0%', N'https://dummyjson.com/products/21', 149, N'USD', N'2026-09-25T15:23:28.343Z', 0, 20),
  (N'dummyjson-22', N'dummyjson', N'22', N'Thức ăn hạt cho chó', N'Tự Thiết Kế', 275000, N'Thức ăn hạt cho chó.

Mã hoặc tên mẫu: GRO-BRD-FOO-022.
Khối lượng theo nguồn: 10 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 16.93 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 27.15 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 9.29 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0111-dummyjson-22.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 10 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 16.93 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 27.15 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 9.29 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'sand', N'✿', N'Demo -10%', N'https://dummyjson.com/products/22', 1099, N'USD', N'2026-09-25T15:23:42.426Z', 10, 20),
  (N'dummyjson-24', N'dummyjson', N'24', N'Cá phi lê tươi', N'Tự Thiết Kế', 375000, N'Cá phi lê tươi.

Mã hoặc tên mẫu: GRO-BRD-FIS-024.
Khối lượng theo nguồn: 6 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 14.95 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 26.31 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 11.27 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0116-dummyjson-24.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 6 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 14.95 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 26.31 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 11.27 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'sand', N'✿', N'Demo -4%', N'https://dummyjson.com/products/24', 1499, N'USD', N'2026-09-25T15:23:48.670Z', 4, 20),
  (N'dummyjson-25', N'dummyjson', N'25', N'Ớt chuông xanh', N'Tự Thiết Kế', 32000, N'Ớt chuông xanh.

Mã hoặc tên mẫu: GRO-BRD-GRE-025.
Khối lượng theo nguồn: 2 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 15.33 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 26.65 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 14.44 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0120-dummyjson-25.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 2 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 15.33 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 26.65 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 14.44 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'sand', N'✿', N'Demo -0%', N'https://dummyjson.com/products/25', 129, N'USD', N'2026-09-25T15:23:18.171Z', 0, 20),
  (N'dummyjson-26', N'dummyjson', N'26', N'Ớt cay xanh', N'Tự Thiết Kế', 25000, N'Ớt cay xanh.

Mã hoặc tên mẫu: GRO-BRD-GRE-026.
Khối lượng theo nguồn: 7 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 15.38 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 18.12 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 19.92 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0123-dummyjson-26.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 7 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 15.38 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 18.12 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 19.92 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'sand', N'✿', N'Demo -1%', N'https://dummyjson.com/products/26', 99, N'USD', N'2026-09-25T15:22:36.472Z', 1, 20),
  (N'dummyjson-27', N'dummyjson', N'27', N'Mật ong hoa rừng', N'Tự Thiết Kế', 175000, N'Mật ong hoa rừng.

Mã hoặc tên mẫu: GRO-BRD-HON-027.
Khối lượng theo nguồn: 2 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 9.28 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 21.72 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 17.74 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0126-dummyjson-27.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 2 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 9.28 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 21.72 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 17.74 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'sand', N'✿', N'Demo -14%', N'https://dummyjson.com/products/27', 699, N'USD', N'2026-09-25T15:24:14.827Z', 14, 20),
  (N'dummyjson-28', N'dummyjson', N'28', N'Kem tráng miệng', N'Tự Thiết Kế', 137000, N'Kem tráng miệng.

Mã hoặc tên mẫu: GRO-BRD-CRE-028.
Khối lượng theo nguồn: 1 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 14.83 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 15.07 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 24.2 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0130-dummyjson-28.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 1 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 14.83 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 15.07 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 24.2 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'sand', N'✿', N'Demo -9%', N'https://dummyjson.com/products/28', 549, N'USD', N'2026-09-25T15:22:01.693Z', 9, 20),
  (N'dummyjson-29', N'dummyjson', N'29', N'Nước ép trái cây', N'Tự Thiết Kế', 100000, N'Nước ép trái cây.

Mã hoặc tên mẫu: GRO-BRD-JUI-029.
Khối lượng theo nguồn: 1 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 18.56 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 21.46 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 28.02 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0133-dummyjson-29.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 1 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 18.56 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 21.46 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 28.02 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'sand', N'✿', N'Demo -12%', N'https://dummyjson.com/products/29', 399, N'USD', N'2026-09-25T15:23:32.637Z', 12, 20),
  (N'dummyjson-3', N'dummyjson', N'3', N'Phấn phủ kiềm dầu dạng bột', N'Làm đẹp', 375000, N'Phấn phủ kiềm dầu dạng bột.

Thương hiệu: Velvet Touch.
Mã hoặc tên mẫu: BEA-VEL-POW-003.
Khối lượng theo nguồn: 8 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 29.27 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 27.93 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 20.59 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0362-dummyjson-3.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 8 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 29.27 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 27.93 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 20.59 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'green', N'✦', N'Demo -10%', N'https://dummyjson.com/products/3', 1499, N'USD', N'2026-09-25T15:21:43.654Z', 10, 20),
  (N'dummyjson-31', N'dummyjson', N'31', N'Chanh vàng', N'Tự Thiết Kế', 20000, N'Chanh vàng.

Mã hoặc tên mẫu: GRO-BRD-LEM-031.
Khối lượng theo nguồn: 3 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 23.77 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 9.22 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 12.05 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0138-dummyjson-31.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 3 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 23.77 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 9.22 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 12.05 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'sand', N'✿', N'Demo -10%', N'https://dummyjson.com/products/31', 79, N'USD', N'2026-09-25T15:21:43.546Z', 10, 20),
  (N'dummyjson-33', N'dummyjson', N'33', N'Dâu tằm chín', N'Tự Thiết Kế', 125000, N'Dâu tằm chín.

Mã hoặc tên mẫu: GRO-BRD-MUL-033.
Khối lượng theo nguồn: 5 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 12.8 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 18.54 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 6.31 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0141-dummyjson-33.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 5 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 12.8 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 18.54 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 6.31 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'sand', N'✿', N'Demo -13%', N'https://dummyjson.com/products/33', 499, N'USD', N'2026-09-25T15:23:26.521Z', 13, 20),
  (N'dummyjson-34', N'dummyjson', N'34', N'Cà phê hòa tan', N'Tự Thiết Kế', 200000, N'Cà phê hòa tan.

Mã hoặc tên mẫu: GRO-BRD-NES-034.
Khối lượng theo nguồn: 6 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 20.54 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 29.49 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 29.2 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0144-dummyjson-34.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 6 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 20.54 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 29.49 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 29.2 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'sand', N'✿', N'Demo -2%', N'https://dummyjson.com/products/34', 799, N'USD', N'2026-09-25T15:22:25.219Z', 2, 20),
  (N'dummyjson-35', N'dummyjson', N'35', N'Khoai tây tươi', N'Tự Thiết Kế', 57000, N'Khoai tây tươi.

Mã hoặc tên mẫu: GRO-BRD-POT-035.
Khối lượng theo nguồn: 9 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 22.65 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 9.83 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 21.75 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0147-dummyjson-35.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 9 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 22.65 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 9.83 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 21.75 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'sand', N'✿', N'Demo -5%', N'https://dummyjson.com/products/35', 229, N'USD', N'2026-09-25T15:21:50.748Z', 5, 20),
  (N'dummyjson-36', N'dummyjson', N'36', N'Bột đạm sữa dùng khi tập luyện', N'Tự Thiết Kế', 500000, N'Bột đạm sữa dùng khi tập luyện.

Mã hoặc tên mẫu: GRO-BRD-PRO-036.
Khối lượng theo nguồn: 9 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 9.01 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 12.53 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 22.35 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0150-dummyjson-36.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 9 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 9.01 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 12.53 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 22.35 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'sand', N'✿', N'Demo -8%', N'https://dummyjson.com/products/36', 1999, N'USD', N'2026-09-25T15:23:03.504Z', 8, 20),
  (N'dummyjson-37', N'dummyjson', N'37', N'Hành tím', N'Tự Thiết Kế', 50000, N'Hành tím.

Mã hoặc tên mẫu: GRO-BRD-ONI-037.
Khối lượng theo nguồn: 9 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 16.01 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 24.96 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 12.74 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0155-dummyjson-37.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 9 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 16.01 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 24.96 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 12.74 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'sand', N'✿', N'Demo -10%', N'https://dummyjson.com/products/37', 199, N'USD', N'2026-09-25T15:23:02.631Z', 10, 20),
  (N'dummyjson-39', N'dummyjson', N'39', N'Nước ngọt đóng chai', N'Tự Thiết Kế', 50000, N'Nước ngọt đóng chai.

Mã hoặc tên mẫu: GRO-BRD-SOF-039.
Khối lượng theo nguồn: 9 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 19.75 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 6.79 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 9.33 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0159-dummyjson-39.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 9 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 19.75 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 6.79 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 9.33 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'sand', N'✿', N'Demo -17%', N'https://dummyjson.com/products/39', 199, N'USD', N'2026-09-25T15:23:49.110Z', 17, 20),
  (N'dummyjson-4', N'dummyjson', N'4', N'Son thỏi lì màu đỏ', N'Làm đẹp', 325000, N'Son thỏi lì màu đỏ.

Thương hiệu: Chic Cosmetics.
Mã hoặc tên mẫu: BEA-CHI-LIP-004.
Khối lượng theo nguồn: 1 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 18.11 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 28.38 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 22.17 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0363-dummyjson-4.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 1 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 18.11 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 28.38 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 22.17 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'green', N'✦', N'Demo -12%', N'https://dummyjson.com/products/4', 1299, N'USD', N'2026-09-25T15:22:08.569Z', 12, 20),
  (N'dummyjson-40', N'dummyjson', N'40', N'Dâu tây tươi', N'Tự Thiết Kế', 100000, N'Dâu tây tươi.

Mã hoặc tên mẫu: GRO-BRD-STR-040.
Khối lượng theo nguồn: 1 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 28.18 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 21.25 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 28.54 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0163-dummyjson-40.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 1 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 28.18 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 21.25 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 28.54 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'sand', N'✿', N'Demo -1%', N'https://dummyjson.com/products/40', 399, N'USD', N'2026-09-25T15:22:50.516Z', 1, 20),
  (N'dummyjson-41', N'dummyjson', N'41', N'Khăn giấy rút', N'Tự Thiết Kế', 62000, N'Khăn giấy rút.

Mã hoặc tên mẫu: GRO-BRD-TIS-041.
Khối lượng theo nguồn: 1 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 18.75 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 17.58 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 12.43 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0165-dummyjson-41.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 1 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 18.75 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 17.58 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 12.43 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'sand', N'✿', N'Demo -13%', N'https://dummyjson.com/products/41', 249, N'USD', N'2026-09-25T15:22:23.729Z', 13, 20),
  (N'dummyjson-42', N'dummyjson', N'42', N'Nước khoáng đóng chai', N'Tự Thiết Kế', 25000, N'Nước khoáng đóng chai.

Mã hoặc tên mẫu: GRO-BRD-WAT-042.
Khối lượng theo nguồn: 4 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 18.43 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 7.4 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 17.79 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0169-dummyjson-42.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 4 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 18.43 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 7.4 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 17.79 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'sand', N'✿', N'Demo -15%', N'https://dummyjson.com/products/42', 99, N'USD', N'2026-09-25T15:22:02.173Z', 15, 20),
  (N'dummyjson-6', N'dummyjson', N'6', N'Nước hoa dùng cho nam và nữ', N'Làm đẹp', 1250000, N'Nước hoa dùng cho nam và nữ.

Thương hiệu: Calvin Klein.
Mã hoặc tên mẫu: Calvin Klein CK One.
Khối lượng theo nguồn: 7 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 29.36 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 27.76 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 20.72 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0369-dummyjson-6.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 7 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 29.36 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 27.76 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 20.72 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'green', N'✦', N'Demo -2%', N'https://dummyjson.com/products/6', 4999, N'USD', N'2026-09-25T15:22:49.960Z', 2, 20),
  (N'dummyjson-78', N'dummyjson', N'78', N'Máy tính xách tay màu xám', N'Laptop', 50000000, N'Máy tính xách tay màu xám.

Thương hiệu: Apple.
Mã hoặc tên mẫu: Apple MacBook Pro 14 inch.
Khối lượng theo nguồn: 9 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 20.03 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 9.54 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 14.82 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0060-dummyjson-78.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 9 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 20.03 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 9.54 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 14.82 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'blue', N'▣', N'Demo -5%', N'https://dummyjson.com/products/78', 199999, N'USD', N'2026-09-25T15:22:40.809Z', 5, 20),
  (N'dummyjson-79', N'dummyjson', N'79', N'Máy tính xách tay hai màn hình cảm ứng', N'Laptop', 45000000, N'Máy tính xách tay hai màn hình cảm ứng.

Thương hiệu: Asus.
Mã hoặc tên mẫu: Asus Zenbook Pro.
Khối lượng theo nguồn: 9 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 16.6 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 11.49 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 10.89 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0066-dummyjson-79.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 9 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 16.6 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 11.49 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 10.89 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'blue', N'▣', N'Demo -11%', N'https://dummyjson.com/products/79', 179999, N'USD', N'2026-09-25T15:21:51.230Z', 11, 20),
  (N'dummyjson-80', N'dummyjson', N'80', N'Máy tính xách tay mỏng nhẹ', N'Laptop', 35000000, N'Máy tính xách tay mỏng nhẹ.

Thương hiệu: Huawei.
Mã hoặc tên mẫu: Huawei Matebook X Pro.
Khối lượng theo nguồn: 9 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 18.21 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 22.83 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 17.26 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0073-dummyjson-80.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 9 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 18.21 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 22.83 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 17.26 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'blue', N'▣', N'Demo -9%', N'https://dummyjson.com/products/80', 139999, N'USD', N'2026-09-25T15:23:51.477Z', 9, 20),
  (N'dummyjson-81', N'dummyjson', N'81', N'Máy tính xách tay xoay gập toàn vòng', N'Laptop', 27500000, N'Máy tính xách tay xoay gập toàn vòng.

Thương hiệu: Lenovo.
Mã hoặc tên mẫu: Lenovo Yoga 920.
Khối lượng theo nguồn: 9 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 20.84 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 22.68 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 17.39 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0078-dummyjson-81.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 9 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 20.84 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 22.68 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 17.39 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'blue', N'▣', N'Demo -7%', N'https://dummyjson.com/products/81', 109999, N'USD', N'2026-09-25T15:23:10.847Z', 7, 20),
  (N'dummyjson-82', N'dummyjson', N'82', N'Máy tính xách tay viền màn hình mỏng', N'Laptop', 37500000, N'Máy tính xách tay viền màn hình mỏng.

Thương hiệu: Dell.
Mã hoặc tên mẫu: Dell XPS 13 9300.
Khối lượng theo nguồn: 2 (nguồn chưa nêu đơn vị).
Chiều rộng theo nguồn: 13.76 (nguồn chưa nêu đơn vị).
Chiều cao theo nguồn: 29 (nguồn chưa nêu đơn vị).
Chiều sâu theo nguồn: 21.42 (nguồn chưa nêu đơn vị).', N'/products/ai-generated-500/0083-dummyjson-82.webp', N'["Kh\u1ED1i l\u01B0\u1EE3ng theo ngu\u1ED3n: 2 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u r\u1ED9ng theo ngu\u1ED3n: 13.76 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u cao theo ngu\u1ED3n: 29 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)","Chi\u1EC1u s\u00E2u theo ngu\u1ED3n: 21.42 (ngu\u1ED3n ch\u01B0a n\u00EAu \u0111\u01A1n v\u1ECB)"]', N'blue', N'▣', N'Demo -12%', N'https://dummyjson.com/products/82', 149999, N'USD', N'2026-09-25T15:23:42.237Z', 12, 20)
) AS src([id], [source], [source_id], [name], [category], [price], [description], [image], [features_json], [tone], [symbol], [label], [source_url], [source_price_cents], [source_currency], [imported_at], [discount_percent], [stock_count])
WHERE NOT EXISTS (SELECT 1 FROM [catalog_products] target WHERE target.[id] = src.[id]);
GO
INSERT INTO [catalog_products] ([id], [source], [source_id], [name], [category], [price], [description], [image], [features_json], [tone], [symbol], [label], [source_url], [source_price_cents], [source_currency], [imported_at], [discount_percent], [stock_count])
SELECT src.[id], src.[source], src.[source_id], src.[name], src.[category], src.[price], src.[description], src.[image], src.[features_json], src.[tone], src.[symbol], src.[label], src.[source_url], src.[source_price_cents], src.[source_currency], src.[imported_at], src.[discount_percent], src.[stock_count]
FROM (VALUES
  (N'manual-e6573516', N'admin-manual', N'manual-e6573516', N'Sản phẩm thử thanh toán', N'Tự Thiết Kế', 5000, N'Sản phẩm được tạo theo yêu cầu chủ cửa hàng để tự kiểm tra quy trình đặt hàng và thanh toán. Giá niêm yết 5.000đ.', N'/products/ai-generated-500/0002-2.webp', N'[]', N'green', N'✦', N'Mới', N'local://admin-manual', 5000, N'VND', N'2026-11-11T12:34:57.5445905+00:00', 0, 19)
) AS src([id], [source], [source_id], [name], [category], [price], [description], [image], [features_json], [tone], [symbol], [label], [source_url], [source_price_cents], [source_currency], [imported_at], [discount_percent], [stock_count])
WHERE NOT EXISTS (SELECT 1 FROM [catalog_products] target WHERE target.[id] = src.[id]);
GO

-- Table: Products (7 rows)
SET IDENTITY_INSERT [Products] ON;
INSERT INTO [Products] ([Id], [Name], [Price], [Category], [Description], [Image])
SELECT src.[Id], src.[Name], src.[Price], src.[Category], src.[Description], src.[Image]
FROM (VALUES
  (1, N'Tai nghe gọn nhẹ dùng hằng ngày', 890000.00, N'Điện tử', N'Tai nghe chống ồn công nghệ cao', N'/products/headphones.svg'),
  (2, N'Túi vải đeo vai đa dụng', 10000.00, N'Tự Thiết Kế', N'Everyday Tote là mẫu túi tối giản để mang theo đồ dùng cá nhân khi đi học, đi làm hoặc mua sắm ngắn ngày. Khoang chính rộng và phong cách trung tính giúp sắp xếp đồ dùng theo nhu cầu thường nhật.
Kiểu dáng dễ phối với nhiều trang phục. Hãy đối chiếu kích thước vật dụng định mang theo trước khi chọn mua; chất liệu, kích thước và tải trọng cụ thể chưa được công bố trong dữ liệu mẫu.

Mã hoặc tên mẫu: Everyday Tote.', N'/products/ai-generated-500/0002-2.webp'),
  (3, N'Đồng hồ đeo tay mặt số tối giản', 1290000.00, N'Phụ kiện', N'Đồng hồ đeo tay phong cách Bauhaus', N'/products/watch.svg'),
  (4, N'Ly đựng cà phê và trà', 159000.00, N'Đồ gia dụng', N'Ly sứ giữ nhiệt cao cấp', N'/products/cup.svg'),
  (5, N'Bàn phím cơ Không Dây', 1450000.00, N'Điện tử', N'Bàn phím cơ layout 75% switch êm ái', N'/products/keyboard.svg'),
  (6, N'Bình nước thể thao 1L', 180000.00, N'Đồ gia dụng', N'Bình giữ nhiệt inox 304', N'/products/bottle.svg'),
  (7, N'Sản phẩm thử thanh toán', 5000.00, N'Tự Thiết Kế', N'Sản phẩm được tạo theo yêu cầu chủ cửa hàng để tự kiểm tra quy trình đặt hàng và thanh toán. Giá niêm yết 5.000đ.', N'/products/ai-generated-500/0002-2.webp')
) AS src([Id], [Name], [Price], [Category], [Description], [Image])
WHERE NOT EXISTS (SELECT 1 FROM [Products] target WHERE target.[Id] = src.[Id]);
GO
SET IDENTITY_INSERT [Products] OFF;
GO

-- Table: voucher_codes (6 rows)
INSERT INTO [voucher_codes] ([code], [created_at])
SELECT src.[code], src.[created_at]
FROM (VALUES
  (N'BN0Y8UGL', N'2026-11-12T10:57:57.8045915+00:00'),
  (N'KHNCJUOW', N'2026-11-12T10:57:22.0858837+00:00'),
  (N'LUCKY100K-CDA7B6', N'2026-10-17T10:08:10.3372287+00:00'),
  (N'ML5FAHL7', N'2026-11-12T11:00:02.4781060+00:00'),
  (N'TEST10K-20261018', N'2026-10-18T04:50:45.5977725'),
  (N'WZYSWU5U', N'2026-11-12T11:01:04.6792802+00:00')
) AS src([code], [created_at])
WHERE NOT EXISTS (SELECT 1 FROM [voucher_codes] target WHERE target.[code] = src.[code]);
GO

-- Table: customers (1 rows)
SET IDENTITY_INSERT [customers] ON;
INSERT INTO [customers] ([id], [username], [email], [password_salt], [password_hash], [points], [paid_goods_total], [spin_credits], [created_at], [google_sub], [totp_secret], [totp_enabled], [totp_pending_secret], [totp_verified_at])
SELECT src.[id], src.[username], src.[email], src.[password_salt], src.[password_hash], src.[points], src.[paid_goods_total], src.[spin_credits], src.[created_at], src.[google_sub], src.[totp_secret], src.[totp_enabled], src.[totp_pending_secret], src.[totp_verified_at]
FROM (VALUES
  (1, N'letam10', N'ledominhtam1998@gmail.com', N'6633abe174478c99037b2842734fb202', N'7ffbac0c970d3113f3eead40bae7b6f19a8e100bfb8a57b7e06d9301f23d1ee5792d2b8d43131de3cffb2bad721d4f72b2bccd7687a495db21fda31aa12b07f4', 60405, 4750, 0, N'2026-10-12T17:04:58.6722304+00:00', NULL, NULL, 0, N'ZYHRUMARNFMWJ5MMYWZEAKOUO55RXLI5', NULL)
) AS src([id], [username], [email], [password_salt], [password_hash], [points], [paid_goods_total], [spin_credits], [created_at], [google_sub], [totp_secret], [totp_enabled], [totp_pending_secret], [totp_verified_at])
WHERE NOT EXISTS (SELECT 1 FROM [customers] target WHERE target.[id] = src.[id]);
GO
SET IDENTITY_INSERT [customers] OFF;
GO

-- Table: customer_vouchers (5 rows)
INSERT INTO [customer_vouchers] ([code], [customer_id], [label], [type], [value], [scope], [expires_at], [source], [created_at])
SELECT src.[code], src.[customer_id], src.[label], src.[type], src.[value], src.[scope], src.[expires_at], src.[source], src.[created_at]
FROM (VALUES
  (N'BN0Y8UGL', NULL, N'Giảm 50% hàng hóa', N'percent', 50, N'goods', N'2026-12-12T16:59:59.0000000+00:00', N'admin', N'2026-11-12T10:57:57.8045915+00:00'),
  (N'KHNCJUOW', NULL, N'Giảm 100000đ hàng hóa', N'amount', 100000, N'goods', N'2026-12-12T16:59:59.0000000+00:00', N'admin', N'2026-11-12T10:57:22.0858837+00:00'),
  (N'LUCKY100K-CDA7B6', 1, N'Voucher may mắn 100K', N'amount', 100000, N'goods', N'2026-10-31', N'spin', N'2026-10-17T10:08:10.3372287+00:00'),
  (N'ML5FAHL7', NULL, N'Giảm 100% phí vận chuyển', N'percent', 100, N'shipping', N'2026-12-12T16:59:59.0000000+00:00', N'admin', N'2026-11-12T11:00:02.4781060+00:00'),
  (N'WZYSWU5U', NULL, N'Giảm 750đ hàng hóa', N'amount', 750, N'goods', N'2026-12-12T16:59:59.0000000+00:00', N'admin', N'2026-11-12T11:01:04.6792802+00:00')
) AS src([code], [customer_id], [label], [type], [value], [scope], [expires_at], [source], [created_at])
WHERE NOT EXISTS (SELECT 1 FROM [customer_vouchers] target WHERE target.[code] = src.[code]);
GO

-- Table: customer_favorites (3 rows)
INSERT INTO [customer_favorites] ([customer_id], [product_id], [created_at])
SELECT src.[customer_id], src.[product_id], src.[created_at]
FROM (VALUES
  (1, N'1', N'2026-10-18T04:50:45.5977725'),
  (1, N'3', N'2026-10-17T07:46:56.7318966+00:00'),
  (1, N'abo-more-25264487-0018-60da-b89f-fe74935d1d1e', N'2026-10-18T01:11:02.1081713+00:00')
) AS src([customer_id], [product_id], [created_at])
WHERE NOT EXISTS (SELECT 1 FROM [customer_favorites] target WHERE target.[customer_id] = src.[customer_id] AND target.[product_id] = src.[product_id]);
GO

-- Table: product_reviews (1 rows)
SET IDENTITY_INSERT [product_reviews] ON;
INSERT INTO [product_reviews] ([id], [customer_id], [product_id], [rating], [comment], [admin_reply], [created_at], [replied_at], [customer_name])
SELECT src.[id], src.[customer_id], src.[product_id], src.[rating], src.[comment], src.[admin_reply], src.[created_at], src.[replied_at], src.[customer_name]
FROM (VALUES
  (1, 1, N'2', 5, N'Dá»¯ liá»‡u kiá»ƒm thá»­: sáº£n pháº©m hiá»ƒn thá»‹ tá»‘t vÃ  giao diá»‡n dá»… thao tÃ¡c.', N'', N'2026-10-18T04:50:45.5977725', NULL, NULL)
) AS src([id], [customer_id], [product_id], [rating], [comment], [admin_reply], [created_at], [replied_at], [customer_name])
WHERE NOT EXISTS (SELECT 1 FROM [product_reviews] target WHERE target.[id] = src.[id]);
GO
SET IDENTITY_INSERT [product_reviews] OFF;
GO

-- Table: product_views (16 rows)
INSERT INTO [product_views] ([product_id], [view_count])
SELECT src.[product_id], src.[view_count]
FROM (VALUES
  (N'1', 43),
  (N'2', 19),
  (N'3', 2),
  (N'abo-more-00334c87-c532-4d61-bc9c-71889fb9a3ca', 1),
  (N'abo-more-00e3ad7e-1526-d7de-1ad4-45a0a7f2d213', 1),
  (N'abo-more-00f71423-e729-3917-6367-2e01a4aa1b46', 1),
  (N'abo-more-019f92a1-0685-f1e4-05f1-d52c817d95f3', 1),
  (N'abo-more-046eebc0-49f1-c7f1-0588-191d99c75f04', 1),
  (N'abo-more-25264487-0018-60da-b89f-fe74935d1d1e', 1),
  (N'abo-more-50b8bce7-c00a-5e72-1b92-ac1714b3ceac', 1),
  (N'abo-more-a74f1254-419c-84aa-7ab0-8c5d277c8ecf', 1),
  (N'abo-more-f04f8191-72d7-51e5-778e-30583aba1b51', 1),
  (N'demo-00b7e2ee-fdc8-7e6f-9606-00e220d26276', 1),
  (N'dummyjson-124', 1),
  (N'dummyjson-19', 1),
  (N'manual-e6573516', 1)
) AS src([product_id], [view_count])
WHERE NOT EXISTS (SELECT 1 FROM [product_views] target WHERE target.[product_id] = src.[product_id]);
GO

-- Table: customer_orders (9 rows)
INSERT INTO [customer_orders] ([id], [customer_id], [items_json], [recipient], [phone], [address], [fulfillment], [region], [distance_km], [subtotal], [discount], [goods_total], [shipping_fee], [total], [voucher_codes_json], [tier], [status], [points_earned], [created_at], [paid_at], [payment_method], [scheduled_at], [weight_kg], [invoice_email_sent_at], [refund_amount], [delivery_status], [delivered_at], [extra_paid], [current_items_json], [current_goods_total], [reward_policy_version])
SELECT src.[id], src.[customer_id], src.[items_json], src.[recipient], src.[phone], src.[address], src.[fulfillment], src.[region], src.[distance_km], src.[subtotal], src.[discount], src.[goods_total], src.[shipping_fee], src.[total], src.[voucher_codes_json], src.[tier], src.[status], src.[points_earned], src.[created_at], src.[paid_at], src.[payment_method], src.[scheduled_at], src.[weight_kg], src.[invoice_email_sent_at], src.[refund_amount], src.[delivery_status], src.[delivered_at], src.[extra_paid], src.[current_items_json], src.[current_goods_total], src.[reward_policy_version]
FROM (VALUES
  (N'ST-1C2553F3', 1, N'[{"id":"abo-more-25264487-0018-60da-b89f-fe74935d1d1e","name":"find. Marco-03w4-002 Stivaletti alla Caviglia, Nero, 7","quantity":2,"price":302075000}]', N'letam10', N'+842345678965', N'Vũng TÀu, 3a', N'delivery', N'hcm', 0, 604150000, 6041500, 598108500, 30000, 598138500, N'[]', N'silver', N'paid', 59813, N'18/10/2026 22:02', N'2026-10-18T15:02:47.7305246+00:00', N'bank_transfer', N'2026-10-19T15:02:00.000Z', 1, NULL, 0, N'processing', NULL, 0, NULL, NULL, 1),
  (N'ST-21592A1A', 1, N'[{"id":"1","name":"Tai nghe Everyday","quantity":1,"price":890000}]', N'letam10', N'+842345678965', N'Vũng TÀu, 3a', N'delivery', N'hcm', 0, 890000, 54000, 836000, 30000, 866000, N'["TEST10K-20261018"]', N'diamond', N'paid', 86, N'24/10/2026 08:46', N'2026-10-24T01:46:11.2659889+00:00', N'bank_transfer', N'2026-10-25T01:45:00.000Z', 1, NULL, 0, N'processing', NULL, 0, NULL, NULL, 1),
  (N'ST49532540F54C415C', 1, N'[{"id":"1","name":"Tai nghe g\u1ECDn nh\u1EB9 d\u00F9ng h\u1EB1ng ng\u00E0y","quantity":1,"price":890000}]', N'letam10', N'0933247559', N'Vũng TÀu', N'delivery', N'hcm', 0, 890000, 44500, 845500, 30000, 875500, N'[]', N'diamond', N'cancelled', 1267, N'2026-11-14T13:48:49.5188578+00:00', NULL, N'bank_transfer', N'2026-11-15T13:47:00.0000000+00:00', 1, NULL, 0, N'processing', NULL, 0, NULL, NULL, 2),
  (N'ST5CAA54EE67394AC1', 1, N'[{"id":"manual-e6573516","name":"S\u1EA3n ph\u1EA9m th\u1EED thanh to\u00E1n 5.000\u0111","quantity":1,"price":5000}]', N'letam10', N'+842345678965', N'Vũng TÀu, 3a', N'delivery', N'hcm', 0, 5000, 30250, 4750, 0, 4750, N'["ML5FAHL7"]', N'diamond', N'cancelled', 6, N'2026-11-12T11:01:33.8751389+00:00', NULL, N'bank_transfer', N'2026-11-13T10:59:00.0000000+00:00', 1, NULL, 0, N'processing', NULL, 0, NULL, NULL, 2),
  (N'ST842404E8507E4AEA', 1, N'[{"id":"1","name":"Tai nghe g\u1ECDn nh\u1EB9 d\u00F9ng h\u1EB1ng ng\u00E0y","quantity":1,"price":890000}]', N'letam10', N'+842345678965', N'Vũng TÀu, 3a', N'delivery', N'hcm', 0, 890000, 44500, 845500, 30000, 875500, N'[]', N'diamond', N'cancelled', 1267, N'2026-11-14T13:46:06.6411827+00:00', NULL, N'bank_transfer', N'2026-11-15T13:45:00.0000000+00:00', 1, NULL, 0, N'processing', NULL, 0, NULL, NULL, 2),
  (N'STA36AE10CE3EF4C85', 1, N'[{"id":"1","name":"Tai nghe Everyday","quantity":1,"price":890000}]', N'letam10', N'+842345678965', N'Vũng TÀu, 3a', N'delivery', N'hcm', 0, 890000, 467250, 422750, 30000, 452750, N'["BN0Y8UGL"]', N'diamond', N'cancelled', 633, N'2026-11-12T10:58:20.0200238+00:00', NULL, N'bank_transfer', N'2026-11-13T10:57:00.0000000+00:00', 1, NULL, 0, N'processing', NULL, 0, NULL, NULL, 2),
  (N'STC5040BFFD0CB4250', 1, N'[{"id":"manual-e6573516","name":"S\u1EA3n ph\u1EA9m th\u1EED thanh to\u00E1n 5.000\u0111","quantity":1,"price":5000}]', N'letam10', N'+842345678965', N'Vũng TÀu, 3a', N'delivery', N'hcm', 0, 5000, 30250, 4750, 0, 4750, N'["ML5FAHL7"]', N'diamond', N'paid', 6, N'2026-11-13T02:25:41.4350676+00:00', N'2026-11-13T09:26:00.0000000+07:00', N'bank_transfer', N'2026-11-14T02:23:00.0000000+00:00', 1, N'2026-11-13T02:26:21.7709647+00:00', 0, N'processing', NULL, 0, NULL, NULL, 2),
  (N'STE45B7440F6E34E9D', 1, N'[{"id":"1","name":"Tai nghe g\u1ECDn nh\u1EB9 d\u00F9ng h\u1EB1ng ng\u00E0y","quantity":1,"price":890000}]', N'letam10', N'0933247559', N'Vũng TÀu', N'delivery', N'hcm', 0, 890000, 44500, 845500, 30000, 875500, N'[]', N'diamond', N'cancelled', 1267, N'2026-11-14T13:51:09.7748940+00:00', NULL, N'bank_transfer', N'2026-11-15T13:47:00.0000000+00:00', 1, NULL, 0, N'processing', NULL, 0, NULL, NULL, 2),
  (N'TEST-ORDER-20261018-001', 1, N'[{"id":"1","name":"Tai nghe Everyday","quantity":1,"price":890000}]', N'letam10', N'0900000000', N'Äá»‹a chá»‰ kiá»ƒm thá»­ Store', N'delivery', N'hcm', 0, 890000, 10000, 880000, 30000, 910000, N'["TEST10K-20261018"]', N'silver', N'paid', 500, N'2026-10-18T04:50:45.5977725', N'2026-10-18T04:50:45.5977725', N'bank_transfer', NULL, 1, NULL, 0, N'processing', NULL, 0, NULL, NULL, 1)
) AS src([id], [customer_id], [items_json], [recipient], [phone], [address], [fulfillment], [region], [distance_km], [subtotal], [discount], [goods_total], [shipping_fee], [total], [voucher_codes_json], [tier], [status], [points_earned], [created_at], [paid_at], [payment_method], [scheduled_at], [weight_kg], [invoice_email_sent_at], [refund_amount], [delivery_status], [delivered_at], [extra_paid], [current_items_json], [current_goods_total], [reward_policy_version])
WHERE NOT EXISTS (SELECT 1 FROM [customer_orders] target WHERE target.[id] = src.[id]);
GO

-- Table: admin_records (7 rows)
SET IDENTITY_INSERT [admin_records] ON;
INSERT INTO [admin_records] ([id], [module], [title], [data_json], [status], [created_at], [updated_at])
SELECT src.[id], src.[module], src.[title], src.[data_json], src.[status], src.[created_at], src.[updated_at]
FROM (VALUES
  (1, N'inventory', N'Máº«u kiá»ƒm thá»­ Â· Phiáº¿u nháº­p kho', N'{"sku":"1","location":"Kho chÃ­nh","quantity":"120","note":"Bá»• sung dá»¯ liá»‡u kiá»ƒm thá»­"}', N'Äang dÃ¹ng', N'2026-10-18T04:50:45.5977725', N'2026-10-18T04:50:45.5977725'),
  (2, N'logistics', N'Máº«u kiá»ƒm thá»­ Â· Giao Ä‘Æ¡n Store', N'{"order":"TEST-ORDER-20261018-001","carrier":"Store Express","status":"Äang xá»­ lÃ½","eta":"2026-10-20"}', N'Äang xá»­ lÃ½', N'2026-10-18T04:50:45.5977725', N'2026-10-18T04:50:45.5977725'),
  (3, N'returns', N'Máº«u kiá»ƒm thá»­ Â· YÃªu cáº§u Ä‘á»•i hÃ ng', N'{"customer":"letam10","order":"TEST-ORDER-20261018-001","reason":"Äá»•i Ã½","assignee":"CSKH"}', N'Chá» duyá»‡t', N'2026-10-18T04:50:45.5977725', N'2026-10-18T04:50:45.5977725'),
  (4, N'order-types', N'Mã hàng', N'{"priority":"Cao","sla":"24 gi\u00E1","note":"Li\u00EAn h\u1EC7 admin"}', N'Đang xử lý', N'2026-10-18T04:50:45.5977725', N'2026-10-20T01:57:13.9205548+00:00'),
  (5, N'support', N'Mua hàng bị lỗi', N'{"customer":"letam10","topic":"Tr\u1EA3 h\u00E0ng h\u00F3a","assignee":"CSKH 01","email":"ledominhtam1998@gmail.com","message":"Y\u00EAu c\u1EA7u li\u00EAn h\u1EC7 l\u1EA1i"}', N'Đang dùng', N'2026-10-18T04:50:45.5977725', N'2026-10-20T01:56:50.1012934+00:00'),
  (6, N'staff', N'Nhân viên', N'{"role":"CSKH","shift":"Ca s\u00E1ng","login":"support.demo"}', N'Đã xong', N'2026-10-18T04:50:45.5977725', N'2026-10-20T01:57:53.2643475+00:00'),
  (7, N'overtime', N'Khen thưởng', N'{"kind":"Khen th\u00C6\u00B0\u00E1\u00BB\u0178ng","value":"100 \u0111\u1ED3ng","note":"Xem th\u00EAm"}', N'Tạm dừng', N'2026-10-18T04:50:45.5977725', N'2026-10-20T01:58:26.6990536+00:00')
) AS src([id], [module], [title], [data_json], [status], [created_at], [updated_at])
WHERE NOT EXISTS (SELECT 1 FROM [admin_records] target WHERE target.[id] = src.[id]);
GO
SET IDENTITY_INSERT [admin_records] OFF;
GO

-- Bat lai toan bo kiem tra khoa ngoai
EXEC sp_MSforeachtable 'ALTER TABLE ? WITH CHECK CHECK CONSTRAINT ALL';
GO

