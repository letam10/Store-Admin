/**
 * @codex-vn-doc
 * Tệp: src/main.jsx
 * Mục đích: Điểm khởi động React và gắn App vào DOM.
 * Thành phần chính: các hàm/lớp và xử lý nội bộ trong tệp.
 * Liên kết trực tiếp: react, react-dom/client, ./App.jsx.
 * Cẩn trọng: khi sửa hàm, route, state, schema hoặc export phải kiểm tra các tệp gọi nó; các nhánh lỗi, dữ liệu rỗng, hủy request và dữ liệu không hợp lệ phải giữ đúng hợp đồng hiện tại.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
