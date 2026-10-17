/**
 * @codex-vn-doc
 * Tệp: src/pages/AdminModules.jsx
 * Mục đích: Các module quản trị, dashboard và điều hướng nhóm chức năng.
 * Thành phần chính: AdminModule.
 * Liên kết trực tiếp: react, ../api/chat, ../storefront/state, ./AdminCommerce.
 * Cẩn trọng: khi sửa hàm, route, state, schema hoặc export phải kiểm tra các tệp gọi nó; các nhánh lỗi, dữ liệu rỗng, hủy request và dữ liệu không hợp lệ phải giữ đúng hợp đồng hiện tại.
 */
import { useEffect, useMemo, useState } from 'react'
import { apiJson } from '../api/chat'
import { normalizeSearch } from '../storefront/state'
import { AdminCustomers, AdminFavorites, AdminOrders, AdminReviews, AdminVouchers } from './AdminCommerce'
import './AdminModules.css'
import ThemeEditor from './ThemeEditor'
import { AdminAfterSales, AdminPaymentSettings } from './AdminOrderWorkflow'
import DropdownMenu from '../components/ui/DropdownMenu'

const statusOptions = ['Đang dùng', 'Nháp', 'Đang xử lý', 'Chờ duyệt', 'Đã xong', 'Đã duyệt', 'Tạm dừng']

const dashboardChartOptions = (en) => [
  ['line', en ? 'Line' : 'Đường thẳng'],
  ['zigzag', en ? 'Zigzag' : 'Ziczac'],
  ['area', en ? 'Mountain area' : 'Đồi núi'],
  ['bars-v', en ? 'Vertical bars' : 'Cột đứng'],
  ['bars-h', en ? 'Horizontal bars' : 'Cột ngang'],
  ['pie', en ? 'Pie' : 'Hình tròn'],
  ['donut', en ? 'Donut' : 'Cái bánh'],
  ['2.5d', '2.5D'],
  ['3d', '3D'],
]

const statisticsChartOptions = [
  ['area', 'Đồi núi'],
  ['line', 'Đường thẳng'],
  ['bars-v', 'Cột đứng'],
  ['bars-h', 'Cột ngang'],
  ['2.5d', '2.5D'],
  ['3d', '3D'],
]

const crudSchemas = {
  inventory: { title: 'Xuất nhập kho', description: 'Tạo, sửa, xóa và tìm phiếu nhập, phiếu xuất theo kho.', fields: [{ key: 'kind', label: 'Loại phiếu', options: ['Nhập', 'Xuất', 'Điều chỉnh'] }, { key: 'warehouse', label: 'Kho' }, { key: 'quantity', label: 'Số lượng', type: 'number' }], columns: ['Loại phiếu', 'Kho', 'Số lượng'] },
  logistics: { title: 'Quản lý lưu thông', description: 'Theo dõi tuyến vận chuyển và cập nhật tiến độ giao nhận.', fields: [{ key: 'route', label: 'Tuyến vận chuyển' }, { key: 'progress', label: 'Tiến độ' }, { key: 'updated', label: 'Cập nhật' }], columns: ['Tuyến', 'Tiến độ', 'Cập nhật'] },
  returns: { title: 'Đổi / trả hàng', description: 'Theo dõi yêu cầu đổi trả, lý do và trạng thái xử lý sau bán hàng.', fields: [{ key: 'customer', label: 'Khách hàng' }, { key: 'order', label: 'Mã đơn hàng' }, { key: 'reason', label: 'Lý do', options: ['Đổi kích thước', 'Sản phẩm lỗi', 'Không đúng mô tả', 'Đổi ý'] }, { key: 'assignee', label: 'Phụ trách' }], columns: ['Khách hàng', 'Mã đơn', 'Lý do', 'Phụ trách'] },
  'order-types': { title: 'Quản lý loại đơn hàng', description: 'Cấu hình tên loại đơn, ưu tiên và SLA xử lý.', fields: [{ key: 'priority', label: 'Ưu tiên', options: ['Thấp', 'Bình thường', 'Cao'] }, { key: 'sla', label: 'SLA' }, { key: 'note', label: 'Ghi chú' }], columns: ['Ưu tiên', 'SLA', 'Ghi chú'] },
  staff: { title: 'Quản lý nhân viên', description: 'Quản lý vai trò, ca làm, trạng thái và thông tin đăng nhập nội bộ.', fields: [{ key: 'role', label: 'Vai trò' }, { key: 'shift', label: 'Ca làm' }, { key: 'login', label: 'Tài khoản đăng nhập' }], columns: ['Vai trò', 'Ca làm', 'Tài khoản'] },
  overtime: { title: 'Tăng ca & khen thưởng', description: 'Tạo và duyệt đề xuất tăng ca hoặc ghi nhận thành tích.', fields: [{ key: 'kind', label: 'Hạng mục', options: ['Tăng ca', 'Khen thưởng'] }, { key: 'value', label: 'Thời lượng / điểm' }, { key: 'note', label: 'Ghi chú' }], columns: ['Hạng mục', 'Thời lượng / điểm', 'Ghi chú'] },
  support: { title: 'Quản lý chăm sóc khách hàng', description: 'Theo dõi ticket CSKH theo người phụ trách và trạng thái.', fields: [{ key: 'customer', label: 'Khách hàng' }, { key: 'topic', label: 'Chủ đề' }, { key: 'assignee', label: 'Phụ trách' }, { key: 'email', label: 'Email phản hồi' }, { key: 'message', label: 'Nội dung yêu cầu' }], columns: ['Khách hàng', 'Chủ đề', 'Phụ trách', 'Email', 'Nội dung'] },
  settings: { title: 'Cài đặt hệ thống', description: 'Quản lý các thông số vận hành, cảnh báo và quy tắc hiển thị nội bộ.', fields: [{ key: 'key', label: 'Tên cài đặt' }, { key: 'value', label: 'Giá trị' }, { key: 'description', label: 'Mô tả' }], columns: ['Cài đặt', 'Giá trị', 'Mô tả'] },
}

// Chức năng emptyData: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
function emptyData(schema) { return Object.fromEntries(schema.fields.map((field) => [field.key, ''])) }

// Chức năng ProductOfferRow: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
function ProductOfferRow({ product, csrfToken, onSaved, onEdit, onDelete }) {
  const [discountPercent, setDiscountPercent] = useState(product.discountPercent || 0)
  const [stockCount, setStockCount] = useState(product.stockCount === null || product.stockCount === undefined ? '20' : String(product.stockCount))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  // Chức năng submit: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
  async function submit(event) {
    event.preventDefault(); setError(''); setSaved(false); setSaving(true)
    try { const offer = { discountPercent: Number(discountPercent), stockCount: stockCount === '' ? 20 : Number(stockCount) }; await apiJson('/api/admin/products/' + encodeURIComponent(product.id) + '/offer', { method: 'PATCH', headers: { 'x-csrf-token': csrfToken }, body: JSON.stringify(offer) }); onSaved(product.id, offer); setSaved(true) }
    // Nhánh lỗi: chuyển ngoại lệ thành phản hồi an toàn và giữ trạng thái nhất quán.
    catch (failure) { setError(failure.message || 'Không lưu được ưu đãi.') }
    finally { setSaving(false) }
  }
  return <tr><td><div className="admin-product-cell"><img src={product.image} alt="" width="44" height="44" loading="lazy" /><span>{product.name}</span></div></td><td>{product.category}</td><td>{new Intl.NumberFormat('vi-VN').format(product.price)} ₫</td><td><form className="admin-offer-form" onSubmit={submit}><label>Giảm %<input aria-label={'Giảm giá ' + product.name} type="number" min="0" max="90" step="1" value={discountPercent} onChange={(event) => setDiscountPercent(event.target.value)} required /></label><label>Tồn kho<input aria-label={'Tồn kho ' + product.name} type="number" min="0" max="999999" step="1" value={stockCount} onChange={(event) => setStockCount(event.target.value)} required /></label><button type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu'}</button>{saved && <small role="status">Đã lưu</small>}{error && <small role="alert">{error}</small>}</form></td><td>{product.viewCount || 0}</td><td className="admin-product-actions"><button className="table-action" type="button" onClick={() => onEdit(product)}>Sửa</button><button className="table-action table-action--danger" type="button" onClick={() => onDelete(product)}>Xóa</button></td></tr>
}

// Chức năng ProductEditor: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
function ProductEditor({ product, csrfToken, onSaved, onCancel }) {
  const [form, setForm] = useState({ name: product?.name || '', category: product?.category || 'Đồ gia dụng', price: product?.price || 0, stockCount: product?.stockCount ?? 20, image: product?.image || '/products/bag.svg', description: product?.description || '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // Chức năng submit: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true)
    try {
      const normalizedPrice = Number(form.price)
      const normalizedStock = Number(form.stockCount)
      // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
      if (!Number.isInteger(normalizedPrice) || normalizedPrice < 1) throw new Error('Gia phai la so nguyen duong.')
      // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
      if (!Number.isInteger(normalizedStock) || normalizedStock < 0) throw new Error('Ton kho phai la so nguyen tu 0 tro len.')
      const payload = await apiJson(product ? '/api/admin/products/' + encodeURIComponent(product.id) : '/api/admin/products', { method: product ? 'PATCH' : 'POST', headers: { 'x-csrf-token': csrfToken }, body: JSON.stringify({ ...form, price: normalizedPrice }) })
      const savedProduct = payload.product
      await apiJson('/api/admin/products/' + encodeURIComponent(savedProduct.id) + '/offer', { method: 'PATCH', headers: { 'x-csrf-token': csrfToken }, body: JSON.stringify({ discountPercent: Number(savedProduct.discountPercent || 0), stockCount: normalizedStock }) })
      onSaved({ ...savedProduct, stockCount: normalizedStock })
    }
    // Nhánh lỗi: chuyển ngoại lệ thành phản hồi an toàn và giữ trạng thái nhất quán.
    catch (failure) { setError(failure.message || 'Không lưu được sản phẩm.') }
    finally { setBusy(false) }
  }
  return <form className="admin-product-editor" onSubmit={submit}><div className="admin-editor-grid"><label>Tên sản phẩm<input required minLength="2" maxLength="160" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label><label>Danh mục<input required minLength="2" maxLength="80" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} /></label><label>Giá VND<input required type="number" min="1" max="1000000000" step="1" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} /></label><label>Tồn kho<input required type="number" min="0" max="999999" step="1" value={form.stockCount} onChange={(event) => setForm((current) => ({ ...current, stockCount: event.target.value }))} /></label><label>Đường dẫn ảnh<input value={form.image} onChange={(event) => setForm((current) => ({ ...current, image: event.target.value }))} /></label><label className="admin-editor-wide">Mô tả<textarea rows="2" maxLength="2000" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label></div>{error && <p role="alert">{error}</p>}<div className="admin-editor-actions"><button type="submit" disabled={busy}>{busy ? 'Đang lưu…' : product ? 'Lưu thay đổi' : 'Thêm sản phẩm'}</button><button type="button" className="button-secondary" onClick={onCancel}>Hủy</button></div></form>
}

// Chức năng ProductsCatalog: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
function ProductsCatalog({ csrfToken }) {
  const [products, setProducts] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editor, setEditor] = useState(null)
  useEffect(() => { const controller = new AbortController(); apiJson('/api/admin/products', { signal: controller.signal }).then((payload) => setProducts(payload.products || [])).catch((failure) => { if (!controller.signal.aborted) setError(failure.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) }); return () => controller.abort() }, [])
  const visible = useMemo(() => { const needle = normalizeSearch(filter).trim(); return needle ? products.filter((product) => normalizeSearch(product.name + ' ' + product.category).includes(needle)) : products }, [filter, products])
  // Chức năng remove: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
  async function remove(product) { if (!window.confirm('Xóa sản phẩm ' + product.name + '?')) return; try { await apiJson('/api/admin/products/' + encodeURIComponent(product.id), { method: 'DELETE', headers: { 'x-csrf-token': csrfToken } }); setProducts((current) => current.filter((item) => item.id !== product.id)) } catch (failure) { setError(failure.message) } }
  // Chức năng savedProduct: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
  function savedProduct(product) { setProducts((current) => current.some((item) => item.id === product.id) ? current.map((item) => item.id === product.id ? { ...item, ...product } : item) : [product, ...current]); setEditor(null) }
  return <section className="admin-module-card"><div className="admin-module-head"><div><p className="admin-eyebrow">DANH MỤC ĐỒNG BỘ</p><h2>Quản lý hàng hóa</h2><p>Thêm, sửa, xóa, tìm kiếm, tồn kho và giảm giá. Store đọc cùng catalog SQLite.</p></div><div className="admin-head-actions"><span className="admin-preview-badge">{products.length} sản phẩm</span><button type="button" onClick={() => setEditor({})}>+ Thêm sản phẩm</button></div></div>{editor && <ProductEditor product={editor.id ? editor : null} csrfToken={csrfToken} onSaved={savedProduct} onCancel={() => setEditor(null)} />}<div className="admin-module-toolbar"><label><span className="sr-only">Tìm sản phẩm</span><input className="admin-wide-search" type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Tìm tên, danh mục hoặc mã sản phẩm…" /></label><span>{visible.length}/{products.length} mục</span></div>{loading && <p>Đang tải sản phẩm…</p>}{error && <p role="alert">Không tải được danh mục: {error}</p>}{!loading && !error && <div className="admin-table-wrap"><table><caption className="sr-only">Sản phẩm đã nhập</caption><thead><tr><th>Sản phẩm</th><th>Danh mục</th><th>Giá gốc</th><th>Giảm giá / tồn kho</th><th>Lượt xem</th><th>Thao tác</th></tr></thead><tbody>{visible.map((product) => <ProductOfferRow key={product.id} product={product} csrfToken={csrfToken} onSaved={(id, offer) => setProducts((current) => current.map((item) => item.id === id ? { ...item, ...offer } : item))} onEdit={setEditor} onDelete={remove} />)}</tbody></table>{visible.length === 0 && <p className="admin-empty">Không có sản phẩm phù hợp.</p>}</div>}<p className="admin-demo-note">Ảnh và metadata là dữ liệu mẫu; không đại diện tồn kho kinh doanh thực tế.</p></section>
}

// Chức năng ProductViews: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
function ProductViews() {
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { const controller = new AbortController(); apiJson('/api/admin/product-views', { signal: controller.signal }).then(setReport).catch((failure) => { if (!controller.signal.aborted) setError(failure.message) }); return () => controller.abort() }, [])
  const highest = report?.products[0]?.viewCount || 1
  return <section className="admin-module-card"><div className="admin-module-head"><div><p className="admin-eyebrow">THỐNG KÊ TRUY CẬP</p><h2>20 sản phẩm được xem nhiều nhất</h2><p>Mỗi sản phẩm một hàng, ảnh và tên rút gọn; thanh dữ liệu tăng dần theo lượt xem.</p></div><span className="admin-preview-badge">{report?.totalViews || 0} lượt xem</span></div>{error && <p role="alert">Không tải được thống kê: {error}</p>}{!report && !error && <p>Đang tải lượt xem…</p>}{report && <div className="admin-view-list">{report.products.map((product) => <article key={product.id}><b className="admin-view-rank">{String(product.rank).padStart(2, '0')}</b>{product.image ? <img src={product.image} alt="" width="48" height="48" loading="lazy" /> : <span className="admin-view-symbol" aria-hidden="true">{product.symbol}</span>}<div><strong>{product.name}</strong><small>{product.category}</small><span className="admin-view-bar" style={{ '--view-width': `${product.viewCount / highest * 100}%` }} /></div><b>{product.viewCount} lượt</b></article>)}</div>}</section>
}

// Chức năng DashboardChart: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
function DashboardChart({ revenue, statuses, chartType, en, highest, chartWidth, chartHeight, linePoints, areaPoints, pieGradient, currency, overview }) {
  // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
  if (!revenue.length) return <p className="admin-empty">{en ? 'No revenue data yet.' : 'Chưa có doanh thu. Bật dữ liệu demo để xem biểu đồ.'}</p>
  // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
  if (chartType === 'pie' || chartType === 'donut') return <div className={'admin-chart-pie-layout admin-chart-pie-layout--' + chartType}><div className="admin-pie-chart" style={{ background: pieGradient }}><span>{overview?.includedOrders ?? 0}<small>{en ? 'orders' : 'đơn'}</small></span></div><div className="admin-chart-legend">{statuses.map((item, index) => <div key={item.status}><i style={{ background: ['#5ca575', '#e0a557', '#7299c8', '#c97979'][index % 4] }} />{item.status}<b>{item.count}</b></div>)}</div></div>
  // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
  if (chartType === 'bars-v') return <div className="admin-simple-bars admin-simple-bars--vertical" aria-label={en ? 'Vertical bars' : 'Cột đứng'}>{revenue.map((item) => <div key={item.date}><i style={{ height: `${Math.max(5, Number(item.revenue || 0) / highest * 100)}%` }} title={`${item.date}: ${currency.format(item.revenue)} ₫`} /><small>{item.date.slice(5)}</small></div>)}</div>
  // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
  if (chartType === 'bars-h') return <div className="admin-simple-bars admin-simple-bars--horizontal" aria-label={en ? 'Horizontal bars' : 'Cột ngang'}>{revenue.slice(-8).map((item) => <div key={item.date}><small>{item.date.slice(5)}</small><i style={{ width: `${Math.max(5, Number(item.revenue || 0) / highest * 100)}%` }} title={`${item.date}: ${currency.format(item.revenue)} ₫`} /><b>{currency.format(item.revenue)} ₫</b></div>)}</div>
  // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
  if (chartType === '3d') return <div className="admin-3d-chart" aria-label={en ? 'Three dimensional revenue chart' : 'Biểu đồ doanh thu 3D'}>{revenue.map((item) => <div className="admin-3d-bar" key={item.date} style={{ '--bar-height': `${Math.max(5, (Number(item.revenue) || 0) / highest * 100)}%` }}><i title={`${item.date}: ${currency.format(item.revenue)} ₫`} /><small>{item.date.slice(5)}</small></div>)}</div>
  // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
  if (chartType === '2.5d') return <div className="admin-25d-chart" aria-label={en ? 'Two and a half dimensional chart' : 'Biểu đồ 2.5D'}>{revenue.map((item) => <div key={item.date} className="admin-25d-bar" style={{ '--bar-height': `${Math.max(5, Number(item.revenue || 0) / highest * 100)}%` }}><i title={`${item.date}: ${currency.format(item.revenue)} ₫`} /><small>{item.date.slice(5)}</small></div>)}</div>
  return <div className={'admin-svg-chart admin-svg-chart--' + chartType} aria-label={en ? 'Revenue chart by day' : 'Biểu đồ doanh thu theo ngày'}><svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img"><line x1="0" y1={chartHeight} x2={chartWidth} y2={chartHeight} className="admin-chart-axis" />{chartType === 'area' && <polygon points={areaPoints} className="admin-chart-area" />}{chartType !== 'area' && <polyline points={linePoints} className={chartType === 'zigzag' ? 'admin-chart-zig-line' : 'admin-chart-line'} />}{chartType === 'zigzag' && revenue.map((item, index) => <rect key={item.date} x={revenue.length === 1 ? chartWidth / 2 - 3 : (index / (revenue.length - 1)) * chartWidth - 3} y={chartHeight - ((Number(item.revenue) || 0) / highest) * (chartHeight - 28) - 5} width="6" height="10" rx="3" className="admin-chart-zig" />)}</svg><div className="admin-svg-labels">{revenue.map((item) => <small key={item.date}>{item.date.slice(5)}</small>)}</div></div>
}

// Chức năng Dashboard: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
function Dashboard({ onNavigate, language = 'vi' }) {
  const [overview, setOverview] = useState(null)
  const [chartType, setChartType] = useState('line')
  useEffect(() => { let active = true; apiJson('/api/admin/overview').then((payload) => { if (active) setOverview(payload.overview) }).catch(() => {}); return () => { active = false } }, [])
  const en = language === 'en'
  const currency = new Intl.NumberFormat(en ? 'en-US' : 'vi-VN')
  const cards = [[en ? 'Products' : 'Sản phẩm', overview?.products ?? '—', 'catalog SQLite'], [en ? 'Customers' : 'Khách hàng', overview?.customers ?? '—', en ? 'registered accounts' : 'tài khoản đã đăng ký'], [en ? 'Orders' : 'Đơn thanh toán', overview?.orders ?? '—', en ? 'orders in system' : 'đơn trong hệ thống'], [en ? 'Revenue' : 'Doanh thu mẫu', overview ? currency.format(overview.revenue || 0) + ' ₫' : '—', en ? 'after refunds' : 'đã trừ hoàn tiền']]
  const revenue = overview?.revenueByDay || []
  const highest = Math.max(1, ...revenue.map((item) => Number(item.revenue) || 0))
  const statuses = overview?.orderStatus || []
  const chartWidth = 640
  const chartHeight = 220
  const linePoints = revenue.map((item, index) => `${revenue.length === 1 ? chartWidth / 2 : (index / (revenue.length - 1)) * chartWidth},${chartHeight - ((Number(item.revenue) || 0) / highest) * (chartHeight - 28)}`).join(' ')
  const areaPoints = linePoints ? `0,${chartHeight} ${linePoints} ${chartWidth},${chartHeight}` : ''
  const pieTotal = Math.max(1, statuses.reduce((sum, item) => sum + Number(item.count || 0), 0))
  const pieGradient = statuses.length ? `conic-gradient(${statuses.map((item, index) => { const start = statuses.slice(0, index).reduce((sum, entry) => sum + Number(entry.count || 0), 0) / pieTotal * 100; const end = (start + Number(item.count || 0) / pieTotal * 100); return `${['#5ca575', '#e0a557', '#7299c8', '#c97979'][index % 4]} ${start}% ${end}%` }).join(', ')})` : 'conic-gradient(#294936 0 100%)'
  const latestRevenue = [...revenue].slice(-8).reverse()
  const latestStatuses = [...statuses].sort((a, b) => Number(b.count || 0) - Number(a.count || 0))
  return <><div className="admin-kpi-grid">{cards.map(([label, value, note]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div><section className="admin-dashboard-grid admin-dashboard-grid--hero"><section className="admin-module-card admin-dashboard-chart"><div className="admin-module-head"><div><p className="admin-eyebrow">{en ? 'OPERATIONS OVERVIEW' : 'TỔNG QUAN VẬN HÀNH'}</p><h2>{en ? 'Interactive dashboard' : 'Dashboard tổng quan'}</h2><p>{en ? 'Switch chart styles for different operational views.' : 'Chọn kiểu biểu đồ để xem số liệu theo nhu cầu.'}</p></div><div className="admin-dashboard-chart__tools"><span className="admin-preview-badge">{overview?.includedOrders ?? 0} {en ? 'sample orders' : 'đơn mẫu'}</span><label><span className="sr-only">{en ? 'Chart type' : 'Kiểu biểu đồ'}</span><DropdownMenu value={chartType} options={dashboardChartOptions(en)} onChange={setChartType} ariaLabel={en ? 'Chart type' : 'Kiểu biểu đồ'} /></label></div></div><DashboardChart revenue={revenue} statuses={statuses} chartType={chartType} en={en} highest={highest} chartWidth={chartWidth} chartHeight={chartHeight} linePoints={linePoints} areaPoints={areaPoints} pieGradient={pieGradient} currency={currency} overview={overview} /></section><section className="admin-module-card admin-status-chart"><div className="admin-module-head"><div><p className="admin-eyebrow">{en ? 'ORDER MIX' : 'SO SÁNH ĐƠN'}</p><h2>{en ? 'Order status' : 'Trạng thái đơn'}</h2><p>{en ? 'Live breakdown of the current order pipeline.' : 'Phân bổ trực tiếp các trạng thái đơn hiện có.'}</p></div><span className="admin-preview-badge">{statuses.reduce((sum, item) => sum + Number(item.count || 0), 0)} {en ? 'orders' : 'đơn'}</span></div><div className="admin-status-list">{statuses.map((item) => <div className="admin-status-row" key={item.status}><span>{item.status}</span><div><i style={{ '--status-width': `${Math.min(100, Number(item.count) / Math.max(1, ...statuses.map((entry) => Number(entry.count || 0))) * 100)}%` }} /></div><b>{item.count}</b></div>)}</div>{!statuses.length && <p className="admin-empty">{en ? 'No order data yet.' : 'Chưa có dữ liệu đơn.'}</p>}</section></section><section className="admin-dashboard-tables"><section className="admin-module-card admin-dashboard-table"><div className="admin-module-head"><div><p className="admin-eyebrow">{en ? 'RECENT REVENUE' : 'DOANH THU GẦN ĐÂY'}</p><h2>{en ? 'Daily revenue' : 'Doanh thu theo ngày'}</h2></div><button type="button" onClick={() => onNavigate('statistics')}>{en ? 'Open statistics' : 'Mở thống kê'} →</button></div><div className="admin-table-wrap"><table><thead><tr><th>{en ? 'Date' : 'Ngày'}</th><th>{en ? 'Orders' : 'Đơn'}</th><th>{en ? 'Revenue' : 'Doanh thu'}</th><th>{en ? 'Average' : 'Trung bình'}</th></tr></thead><tbody>{latestRevenue.map((item) => <tr key={item.date}><td>{item.date}</td><td>{item.orders || 0}</td><td>{currency.format(item.revenue || 0)} ₫</td><td>{currency.format(item.orders ? Math.round(item.revenue / item.orders) : 0)} ₫</td></tr>)}</tbody></table>{!latestRevenue.length && <p className="admin-empty">{en ? 'No daily revenue.' : 'Chưa có dữ liệu theo ngày.'}</p>}</div></section><section className="admin-module-card admin-dashboard-table"><div className="admin-module-head"><div><p className="admin-eyebrow">{en ? 'PIPELINE HEALTH' : 'SỨC KHỎE ĐƠN HÀNG'}</p><h2>{en ? 'Status detail' : 'Chi tiết trạng thái'}</h2></div><button type="button" onClick={() => onNavigate('customer-orders')}>{en ? 'Open orders' : 'Mở đơn hàng'} →</button></div><div className="admin-table-wrap"><table><thead><tr><th>{en ? 'Status' : 'Trạng thái'}</th><th>{en ? 'Orders' : 'Số đơn'}</th><th>{en ? 'Share' : 'Tỷ lệ'}</th><th>{en ? 'Signal' : 'Tín hiệu'}</th></tr></thead><tbody>{latestStatuses.map((item) => { const total = latestStatuses.reduce((sum, entry) => sum + Number(entry.count || 0), 0) || 1; const share = Math.round(Number(item.count || 0) / total * 100); return <tr key={item.status}><td><span className="admin-status-chip">{item.status}</span></td><td>{item.count}</td><td>{share}%</td><td><span className={'admin-signal admin-signal--' + (share > 60 ? 'good' : share > 20 ? 'watch' : 'quiet')}>{share > 60 ? 'Ổn định' : share > 20 ? 'Theo dõi' : 'Ít dữ liệu'}</span></td></tr> })}</tbody></table>{!latestStatuses.length && <p className="admin-empty">{en ? 'No status detail.' : 'Chưa có dữ liệu trạng thái.'}</p>}</div></section></section><section className="admin-dashboard-grid admin-dashboard-grid--bottom"><section className="admin-module-card"><p className="admin-eyebrow">{en ? 'LIVE OVERVIEW' : 'TỔNG QUAN LIVE'}</p><h2>{en ? 'Central operations' : 'Vận hành tập trung'}</h2><div className="admin-task-list"><div><b>{overview?.totalViews ?? '—'}</b><span>{en ? 'Product views' : 'Lượt xem sản phẩm'}</span></div><div><b>{overview?.favorites ?? '—'}</b><span>{en ? 'Favorites' : 'Lượt yêu thích'}</span></div><div><b>{overview?.records ?? '—'}</b><span>{en ? 'Operations records' : 'Bản ghi vận hành'}</span></div></div></section><section className="admin-module-card"><p className="admin-eyebrow">{en ? 'SHORTCUTS' : 'LỐI TẮT'}</p><h2>{en ? 'Open modules' : 'Mở nhanh các mục'}</h2><div className="admin-quick-actions"><button type="button" onClick={() => onNavigate('products')}>{en ? 'Products' : 'Quản lý hàng hóa'}</button><button type="button" onClick={() => onNavigate('product-views')}>{en ? 'Most viewed' : 'Sản phẩm xem nhiều'}</button><button type="button" onClick={() => onNavigate('favorites')}>{en ? 'Favorites' : 'Yêu thích'}</button><button type="button" onClick={() => onNavigate('rewards-wheel')}>{en ? 'Voucher' : 'Voucher'}</button></div></section></section></>
}

// Chức năng Statistics: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
function Statistics() {
  const [overview, setOverview] = useState(null)
  const [chartType, setChartType] = useState('area')
  useEffect(() => { let active = true; apiJson('/api/admin/overview').then((payload) => { if (active) setOverview(payload.overview) }).catch(() => {}); return () => { active = false } }, [])
  const revenue = overview?.revenueByDay || []
  const totalOrders = overview?.includedOrders || 0
  const average = totalOrders ? Math.round((overview?.revenue || 0) / totalOrders) : 0
  const highest = Math.max(1, ...revenue.map((item) => Number(item.revenue) || 0))
  const chartWidth = 640; const chartHeight = 220
  const linePoints = revenue.map((item, index) => `${revenue.length === 1 ? chartWidth / 2 : (index / (revenue.length - 1)) * chartWidth},${chartHeight - ((Number(item.revenue) || 0) / highest) * (chartHeight - 28)}`).join(' ')
  const areaPoints = linePoints ? `0,${chartHeight} ${linePoints} ${chartWidth},${chartHeight}` : ''
  return <section className="admin-module-card statistics-module"><div className="admin-module-head"><div><p className="admin-eyebrow">STORE ANALYTICS</p><h2>Thống kê tổng hợp</h2><p>So sánh doanh thu, số đơn và hành vi truy cập từ dữ liệu backend SQLite.</p></div><div className="statistics-head-actions"><span className="admin-preview-badge">Cập nhật trực tiếp</span><DropdownMenu value={chartType} options={statisticsChartOptions} onChange={setChartType} ariaLabel="Kiểu biểu đồ thống kê" /></div></div><div className="statistics-summary"><div><small>Doanh thu ròng</small><b>{new Intl.NumberFormat('vi-VN').format(overview?.revenue || 0)} ₫</b><span className="statistics-trend">{overview?.revenue ? 'Đang ghi nhận' : 'Chưa có giao dịch'}</span></div><div><small>Đơn đã ghi nhận</small><b>{totalOrders}</b><span className="statistics-trend">{overview?.includedOrders ? 'Có dữ liệu' : 'Đang chờ'}</span></div><div><small>Giá trị đơn trung bình</small><b>{new Intl.NumberFormat('vi-VN').format(average)} ₫</b><span className="statistics-trend">Theo đơn</span></div><div><small>Lượt xem sản phẩm</small><b>{overview?.totalViews || 0}</b><span className="statistics-trend">Tương tác</span></div></div><div className="statistics-visual"><DashboardChart revenue={revenue} statuses={overview?.orderStatus || []} chartType={chartType} en={false} highest={highest} chartWidth={chartWidth} chartHeight={chartHeight} linePoints={linePoints} areaPoints={areaPoints} pieGradient="conic-gradient(#5ca575 0 100%)" currency={new Intl.NumberFormat('vi-VN')} overview={overview} /></div><div className="statistics-table"><div className="statistics-table__header"><h3>Doanh thu theo ngày</h3><span>{revenue.length} ngày</span></div>{revenue.length ? revenue.map((item) => <div key={item.date}><span>{item.date}</span><span>{item.orders} đơn</span><b>{new Intl.NumberFormat('vi-VN').format(item.revenue)} ₫</b></div>) : <p className="admin-empty">Chưa có dữ liệu thống kê.</p>}</div></section>
}

// Chức năng AppearanceEditor: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
function AppearanceEditor({ csrfToken }) {
  return <ThemeEditor csrfToken={csrfToken} />
}

// Chức năng RecordEditor: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
function RecordEditor({ schema, record, onSave, onCancel }) {
  const [title, setTitle] = useState(record?.title || '')
  const [status, setStatus] = useState(record?.status || 'Đang dùng')
  const [data, setData] = useState({ ...emptyData(schema), ...(record?.data || {}) })
  const [error, setError] = useState('')
  // Chức năng submit: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
  async function submit(event) { event.preventDefault(); setError(''); try { await onSave({ title, status, data }) } catch (failure) { setError(failure.message) } }
  return <form className="admin-record-editor" onSubmit={submit}><div className="admin-editor-grid"><label>Tên / mã<input required maxLength="160" value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Trạng thái<DropdownMenu value={status} options={statusOptions.map((item) => [item, item])} onChange={setStatus} ariaLabel="Trạng thái" /></label>{schema.fields.map((field) => <label key={field.key}>{field.label}{field.options ? <DropdownMenu value={data[field.key] || ''} options={[['', 'Chọn'], ...field.options.map((item) => [item, item])]} onChange={(value) => setData((current) => ({ ...current, [field.key]: value }))} ariaLabel={field.label} /> : field.key === 'message' ? <textarea className="admin-message-input" rows="5" maxLength="2000" value={data[field.key] || ''} onChange={(event) => setData((current) => ({ ...current, [field.key]: event.target.value }))} /> : <input type={field.type || 'text'} value={data[field.key] || ''} onChange={(event) => setData((current) => ({ ...current, [field.key]: event.target.value }))} />}</label>)}</div>{error && <p role="alert">{error}</p>}<div className="admin-editor-actions"><button type="submit">{record ? 'Lưu thay đổi' : 'Thêm bản ghi'}</button><button type="button" className="button-secondary" onClick={onCancel}>Hủy</button></div></form>
}

// Chức năng CrudModule: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
function CrudModule({ module, csrfToken }) {
  const schema = crudSchemas[module]
  const [records, setRecords] = useState([])
  // Lệnh tích hợp: gọi mạng hoặc dữ liệu bên ngoài; cần xử lý timeout, lỗi và dữ liệu rỗng.
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState(null)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => { const controller = new AbortController(); apiJson('/api/admin/records/' + module, { signal: controller.signal }).then((payload) => setRecords(payload.records || [])).catch((failure) => { if (!controller.signal.aborted) setError(failure.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) }); return () => controller.abort() }, [module])
  // Lệnh tích hợp: gọi mạng hoặc dữ liệu bên ngoài; cần xử lý timeout, lỗi và dữ liệu rỗng.
  const visible = useMemo(() => { const needle = normalizeSearch(query).trim(); return needle ? records.filter((record) => normalizeSearch([record.title, record.status, ...Object.values(record.data || {})].join(' ')).includes(needle)) : records }, [query, records])
  const activeCount = records.filter((record) => /đang dùng|đang xử lý|đã duyệt|đã xong/i.test(record.status || '')).length
  const pendingCount = records.filter((record) => /nháp|chờ duyệt|tạm dừng/i.test(record.status || '')).length
  const lastUpdated = records.map((record) => record.updatedAt || record.createdAt).filter(Boolean).sort().at(-1)
  // Chức năng save: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
  async function save(payload) { const editing = editor?.id; const response = await apiJson('/api/admin/records/' + module + (editing ? '/' + editing : ''), { method: editing ? 'PATCH' : 'POST', headers: { 'x-csrf-token': csrfToken }, body: JSON.stringify(payload) }); const record = response.record; setRecords((current) => editing ? current.map((item) => item.id === record.id ? record : item) : [record, ...current]); setEditor(null) }
  // Chức năng remove: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
  async function remove(record) { if (!window.confirm('Xóa bản ghi ' + record.title + '?')) return; try { await apiJson('/api/admin/records/' + module + '/' + record.id, { method: 'DELETE', headers: { 'x-csrf-token': csrfToken } }); setRecords((current) => current.filter((item) => item.id !== record.id)) } catch (failure) { setError(failure.message) } }
  // Lệnh tích hợp: gọi mạng hoặc dữ liệu bên ngoài; cần xử lý timeout, lỗi và dữ liệu rỗng.
  return <section className="admin-module-card admin-crud-module"><div className="admin-module-head"><div><p className="admin-eyebrow">STORE OPERATIONS</p><h2>{schema.title}</h2><p>{schema.description}</p></div><button type="button" onClick={() => setEditor({})}>+ Thêm</button></div><div className="admin-crud-insights"><div><small>Tổng bản ghi</small><b>{records.length}</b><span>Đồng bộ backend</span></div><div><small>Đang hoạt động</small><b>{activeCount}</b><span>Đang xử lý / hoàn tất</span></div><div><small>Cần theo dõi</small><b>{pendingCount}</b><span>Nháp / chờ duyệt</span></div><div><small>Cập nhật gần nhất</small><b>{lastUpdated ? new Date(lastUpdated).toLocaleDateString('vi-VN') : '—'}</b><span>Thời gian hệ thống</span></div></div>{editor && <RecordEditor schema={schema} record={editor.id ? editor : null} onSave={save} onCancel={() => setEditor(null)} />}<div className="admin-module-toolbar"><input className="admin-wide-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={'Tìm trong ' + schema.title.toLocaleLowerCase('vi') + '…'} /><span>{visible.length}/{records.length} mục</span></div>{error && <p role="alert">{error}</p>}{loading ? <p>Đang tải…</p> : <div className="admin-table-wrap"><table><thead><tr><th>Tên / mã</th>{schema.columns.map((column) => <th key={column}>{column}</th>)}<th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{visible.map((record) => <tr key={record.id}><td><button className="admin-link-button" type="button" onClick={() => setSelected(record)}>{record.title}</button><small>#{record.id}</small></td>{schema.fields.map((field) => <td key={field.key}>{record.data?.[field.key] || '—'}</td>)}<td className="admin-status-cell">{record.status}</td><td className="admin-product-actions"><button className="table-action" type="button" onClick={() => setEditor(record)}>Sửa</button><button className="table-action table-action--danger" type="button" onClick={() => remove(record)}>Xóa</button></td></tr>)}</tbody></table>{visible.length === 0 && <p className="admin-empty">Chưa có bản ghi phù hợp.</p>}</div>}{selected && <section className="admin-detail-panel"><p className="admin-eyebrow">CHI TIẾT BẢN GHI</p><h3>{selected.title}</h3><button type="button" onClick={() => setSelected(null)}>Đóng</button><dl>{Object.entries({ ...selected.data, status: selected.status, createdAt: selected.createdAt, updatedAt: selected.updatedAt }).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value || '—')}</dd></div>)}</dl></section>}</section>
}

// Chức năng AdminModule: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
export default function AdminModule({ module, csrfToken, onNavigate, language = 'vi' }) {
  if (module === 'dashboard') return <Dashboard onNavigate={onNavigate} language={language} />
  if (module === 'statistics') return <Statistics />
  // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
  if (module === 'products') return <ProductsCatalog csrfToken={csrfToken} />
  if (module === 'product-views') return <ProductViews />
  // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
  if (module === 'appearance') return <AppearanceEditor csrfToken={csrfToken} />
  if (module === 'customers') return <AdminCustomers />
  if (module === 'favorites') return <AdminFavorites />
  // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
  if (module === 'reviews') return <AdminReviews csrfToken={csrfToken} />
  // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
  if (module === 'customer-orders') return <AdminOrders csrfToken={csrfToken} />
  // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
  if (module === 'rewards-wheel') return <AdminVouchers csrfToken={csrfToken} />
  if (module === 'returns') return <AdminAfterSales csrfToken={csrfToken} />
  if (module === 'settings') return <><AdminPaymentSettings csrfToken={csrfToken} /><CrudModule module={module} csrfToken={csrfToken} /></>
  // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
  if (crudSchemas[module]) return <CrudModule module={module} csrfToken={csrfToken} />
  return <section className="admin-module-card"><h2>Module chưa có dữ liệu</h2><p>Module này đang chờ cấu hình backend.</p></section>
}
