# Store

Store dùng React + Vite ở frontend và ASP.NET Core server-dotnet ở backend nghiệm thu chính trên cổng 5000. Node.js/Express + SQLite là backend legacy để rollback. AI chạy qua Ollama local; trình duyệt chỉ gọi `/api`, không gọi Ollama trực tiếp.

## Runtime đã chốt

- Node.js: **24.19.0** — dùng bản hiện có trên máy, thống nhất frontend/backend/CI.
- npm: **11.17.0**. Cả hai `package.json` khai báo chính xác `engines` và `packageManager`; `.npmrc` bật `engine-strict=true` để ngăn cài nhầm runtime.
- `.nvmrc` chỉ ghi phiên bản chuẩn cho công cụ/CI; **không yêu cầu cài trình quản lý Node hay runtime phụ**.
- Quy tắc cho mọi AI/thành viên: trước khi cài/chạy, kiểm tra `node -v` và `npm -v`. Không tự chuyển sang Node 22/26, không dùng `npm exec --package=node@...`, không bỏ qua kiểm tra engines. Nếu sai phiên bản, báo lại thay vì âm thầm đổi Node/npm toàn máy.
- Nâng phiên bản sau này là thay đổi có chủ đích: cập nhật đồng bộ runtime, manifests, lockfiles, CI và README rồi chạy lại test/native SQLite. Không tự nâng chỉ vì có bản mới.
- Ollama URL mặc định: `http://127.0.0.1:11434`.
- Model mặc định: `qwen3.5:4b`.
- Backend không tự tải model.

## Cài đặt tái lập

Frontend:

```powershell
npm ci
npm run dev
```

Backend:

```powershell
cd server
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm run dev
```

Không dùng lệnh copy `.env` theo cách ghi đè cấu hình đang có.

Vite proxy `/api` tới `http://127.0.0.1:3001`.

## Cấu hình backend

`server/.env.example` không chứa bí mật. Các giá trị chính:

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `PORT` | `3001` | cổng API local |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama local |
| `OLLAMA_MODEL` | `qwen3.5:4b` | model dùng chung khách/admin |
| `DB_PATH` | `data/store.sqlite` | SQLite local |
| `ENABLE_DEMO_DATA` | `false` | chỉ seed đơn demo khi chủ động bật |
| `SUPPORT_NUM_CTX` | `8192` | context khách |
| `ADMIN_DEFAULT_NUM_CTX` | `16384` | context admin mặc định |
| `SUPPORT_NUM_PREDICT` | `384` | giới hạn đầu ra khách |
| `ADMIN_NUM_PREDICT` | `1024` | giới hạn đầu ra admin |
| `OLLAMA_TIMEOUT_MS` | `120000` | timeout Ollama |
| `GENERATION_QUEUE_MAX` | `4` | số lượt chờ tối đa |
| `GENERATION_QUEUE_WAIT_MS` | `30000` | thời gian chờ queue tối đa |
| `COOKIE_SECURE` | `false` | đặt `true` khi dùng HTTPS |

Context admin cho phép 8K/16K/32K/64K. **64K = 65536 chỉ là cấu hình thử nghiệm**, không phải bằng chứng chạy ổn trên RTX 3050 6GB.

## Chat và stream

- Khách: backend khóa `think: false`.
- Admin hợp lệ: backend khóa `think: true`.
- Thinking thô bị bỏ ở parser Ollama, không gửi ra frontend và không lưu lịch sử.
- Ollama phải gửi terminal frame `done: true`. EOF sớm, timeout, abort hoặc hết giới hạn đầu ra không được lưu là assistant hoàn tất.
- Frontend cũng bắt buộc nhận event `done`; nếu stream đứt, phần đã nhận được đánh dấu chưa hoàn tất và có thể thử lại.
- Mỗi lượt frontend có `requestId`; retry cùng `requestId` được replay hoặc chạy lại theo trạng thái turn, không dedupe bằng nội dung tin nhắn.
- Một conversation chỉ có một lượt đang chạy. Hàng đợi GPU mặc định concurrency = 1.

Event NDJSON có thể gồm `status`, `conversation`, `verified`, `sources`, `report`, `delta`, `done`, `error`.

## Độ đúng và dữ liệu quan trọng

- Chính sách chưa được duyệt: backend trả trực tiếp `Store chưa cung cấp thông tin này.`; không hỏi model để tự bịa.
- Giá sản phẩm được render từ dữ liệu có cấu trúc ở `shared/products.js`.
- Bản hiện tại dùng **hợp đồng phản hồi đóng**: model chọn `responseKey` qua JSON schema, backend kiểm tra mã và render câu tiếng Việt đã định nghĩa. Không dùng regex để chứng nhận văn bản AI tự do (số viết bằng chữ cũng có thể sai).
- Đánh đổi rõ ràng: đây là MVP tư vấn có giới hạn, **chưa phải trợ lý phân tích tự do/EQ cao**. Muốn mở rộng cần bổ sung hành vi và dữ liệu có thể kiểm chứng, không chỉ nới bộ lọc.
- Doanh thu do SQLite/backend tính, có khoảng ngày và nguồn riêng. Chưa có dữ liệu kỳ so sánh thì không kết luận tăng trưởng hoặc nguyên nhân biến động.
- Với lượt gọi model, backend buffer JSON đến terminal hợp lệ và lưu thành công trước khi phát nội dung. Giao thức vẫn là NDJSON nhưng bản an toàn này **không stream từng token văn bản tự do**; giao diện hiển thị trạng thái chờ/phân tích.
- Chính sách và giá trả trực tiếp từ backend có thể không gọi model; khóa thinking chỉ áp dụng khi có lời gọi Ollama.
- Lịch sử khôi phục cả thẻ giá, báo cáo, trạng thái lỗi/dừng và requestId. Retry lượt lỗi cũ sau khi đã có câu hỏi mới sẽ bị từ chối; hãy gửi thành tin nhắn mới.
- Nguồn dữ liệu gắn với phần dữ liệu xác minh, không được coi là bằng chứng rằng mọi câu AI nói đều đúng.

`ENABLE_DEMO_DATA=false` là mặc định an toàn. Khi không có order, `dataMode=none`; dữ liệu được phân biệt `demo`, `real`, `mixed`, `none`.

## Báo cáo thời gian

Backend hiểu `hôm nay`, `hôm qua`, `tháng này`, `tháng trước` theo `Asia/Ho_Chi_Minh`. Ngày ISO được kiểm tra ngày có thật, năm nhuận, thứ tự khoảng và giới hạn tối đa 366 ngày. Câu báo cáo không nêu phạm vi rõ ràng sẽ hỏi lại thay vì tự chọn tháng hiện tại.

## Rút gọn hội thoại

Cơ chế hiện tại được mô tả trung thực là **rút gọn trích xuất**, không phải “compact thông minh”:

- lịch sử gốc vẫn nằm trong SQLite;
- `memory_json` lưu riêng entity, sở thích, request chưa giải quyết, nguồn backend và action backend đã xác nhận;
- mỗi mục có provenance như `user_claim`, `user_request`, `backend_source`, `backend_confirmed`;
- lời user không được nâng thành sự thật hay system instruction;
- lời model không tự trở thành dữ kiện xác minh;
- câu hỏi bổ sung của assistant không tự đóng yêu cầu khách; chỉ nguồn action backend xác nhận rõ yêu cầu nào đã hoàn thành mới đóng nó;
- mã sản phẩm/đơn và memory bắt buộc không bị loại bằng cách cắt chuỗi;
- mốc compact chỉ cập nhật sau khi candidate đã qua kiểm tra ngân sách;
- nếu rút gọn không an toàn, summary/memory/mốc tốt trước đó được giữ và request nhận lỗi có thể phục hồi.

Backend hiện **không có tokenizer Qwen**. Ước lượng dùng số byte UTF-8 và chỉ cho input dùng 65% `num_ctx` để chừa biên cho sai số, output và thinking. Đây vẫn là heuristic, **không phải bảo đảm token chính xác**.

## Admin

Tạo admin mà không hardcode password:

```powershell
cd server
npm run create-admin -- owner
```

Mật khẩu được nhập ẩn và hash bằng scrypt + salt. Khi tạo admin local/dev, mật khẩu có **4–256 ký tự** (lớn hơn 3); với `NODE_ENV=production` yêu cầu **12–256 ký tự**. Tài khoản thử với mật khẩu yếu chỉ dùng trên máy local; phải đổi mật khẩu hoặc xóa tài khoản thử trước khi triển khai. Không seed tài khoản/mật khẩu mặc định vào source hay tự tạo ở mỗi lần khởi động.

Phiên dùng cookie HttpOnly + SameSite=Strict; chat/settings/logout yêu cầu CSRF. Login có limiter riêng theo IP và tài khoản đã normalize; limiter có giới hạn số key trong bộ nhớ.

Nếu Vite báo `ECONNREFUSED 127.0.0.1:3001` khi đăng nhập, backend chưa lắng nghe đúng cổng, chưa phải lỗi mật khẩu. Giữ frontend chạy và mở terminal riêng tại thư mục Store, chạy `npm run dev:api`, rồi vào `/admin` trên địa chỉ Vite đang sử dụng.

API admin và API đọc conversation private đặt `Cache-Control: no-store`. Frontend hủy stream khi logout/unmount và xóa report, source, draft, conversation cùng UI nhạy cảm khi đổi phiên.

Response HTTP cũ và restore hội thoại bị bỏ qua nếu phiên/lượt chat đã thay đổi. SQLite chỉ phục hồi turn gián đoạn khi backend khởi động và giành quyền sở hữu database; mở DB để tạo admin không phục hồi turn. Một DB local chỉ phục vụ một tiến trình backend. PID còn sống hoặc không xác minh được sẽ bị từ chối (fail-closed); không dùng cơ chế PID này cho DB chia sẻ qua nhiều máy/container.

## Kiểm thử không dùng GPU

```powershell
npm ci
npm test
npm run lint
npm run build

cd server
npm ci
npm test
```

Regression test bao phủ parser Ollama qua HTTP giả lập, terminal frame/EOF/token limit, thinking leakage, restore race, double-send, transaction/idempotency, queue/abort, CSRF/session, ngày tương đối, dataMode, rút gọn trích xuất và model cố tình đưa chính sách/giá/doanh thu sai.

Workflow `.github/workflows/ai-local-ci.yml` chạy trên nhánh tính năng, `main` và PR vào `main`, dùng Node từ `.nvmrc`, chỉ có quyền đọc. CI không tạo commit/push hay sửa lockfile. Test component mount Admin thật trong JSDOM; đây không phải kiểm thử hiển thị trên trình duyệt hoặc GPU.

## Native SQLite và đổi runtime

`better-sqlite3` có binary native phụ thuộc Node ABI. Binary cài từ Node 22 (ABI 127) không dùng được với Node 24 trên máy (ABI 137). Đây là lỗi trộn runtime, không phải dữ liệu SQLite bị hỏng.

Sau khi xác nhận đúng Node 24.19.0/npm 11.17.0, dừng backend của chính bạn trước khi cài lại dependencies:

```powershell
node -v
npm -v
npm ci
npm --prefix server ci
```

`npm ci` thay dependencies trong `node_modules`, không xóa `.env`, database hoặc source. Không xóa database để chữa lỗi ABI và không copy `node_modules` từ máy/major Node khác. Phiên bản `better-sqlite3` thực tế được khóa trong `server/package-lock.json`; `^12.4.1` là khoảng cho phép, không phải cam kết đang cài đúng 12.4.1.

Chạy frontend bằng `npm run dev`; mở terminal riêng ở gốc Store và chạy backend bằng `npm run dev:api`. Không cần runtime Node phụ.

### Kết quả chuyển runtime trên máy

- Node `v24.19.0`, npm `11.17.0`, Node ABI `137`.
- Giữ `better-sqlite3` theo lockfile hiện tại: `12.11.1`; binary đã được cài lại bằng Node 24. Kiểm tra SQLite trong bộ nhớ: tạo bảng, ghi và đọc thành công, không tác động database thật.
- Frontend: 21 test PASS; backend: 33 test PASS; tổng 54 test PASS.
- `npm run lint` và `npm run build`: PASS.
- CI đã được cấu hình cùng Node/npm; kết quả local trên đây không phải tuyên bố CI mới đã chạy.
- Không gọi Ollama/GPU. Runtime PASS không chứng minh chất lượng AI, tốc độ token/s hoặc context 64K.

## Không nằm trong phạm vi xác minh hiện tại

- Ollama thật / `qwen3.5:4b`: **NOT_TESTED** nếu chưa chạy trên máy dự án.
- RTX 3050 6GB: **NOT_TESTED**.
- Context gần đầy 64K: **NOT_TESTED**.
- RTX 4060: không dùng kết quả để suy ra RTX 3050.
- Tốc độ token/s: **NOT_TESTED**.
- LoRA/training/cloud: không triển khai trong đợt này.

Không commit `.env`, database thật, hội thoại riêng tư, model, dataset, cache hoặc `node_modules`.
