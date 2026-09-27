/**
 * @codex-vn-doc
 * Tệp: src/App.jsx
 * Mục đích: Điểm điều phối ứng dụng React, route, trạng thái chung và layout.
 * Thành phần chính: App.
 * Liên kết trực tiếp: ./pages/Admin.
 * Cẩn trọng: khi sửa hàm, route, state, schema hoặc export phải kiểm tra các tệp gọi nó; các nhánh lỗi, dữ liệu rỗng, hủy request và dữ liệu không hợp lệ phải giữ đúng hợp đồng hiện tại.
 */
import Admin from './pages/Admin'
import './App.css'
// Chức năng App: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
export default function App() { return <Admin /> }
