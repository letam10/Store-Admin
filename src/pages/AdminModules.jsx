import { useEffect, useMemo, useState } from 'react'
import { apiJson } from '../api/chat'
import { normalizeSearch } from '../storefront/state'
import { AdminCustomers, AdminFavorites, AdminOrders, AdminReviews, AdminVouchers } from './AdminCommerce'
import './AdminModules.css'

const statusOptions = ['Đang dùng', 'Nháp', 'Đang xử lý', 'Chờ duyệt', 'Đã xong', 'Đã duyệt', 'Tạm dừng']

const crudSchemas = {
  inventory: { title: 'Xuất nhập kho', description: 'Tạo, sửa, xóa và tìm phiếu nhập, phiếu xuất theo kho.', fields: [{ key: 'kind', label: 'Loại phiếu', options: ['Nhập', 'Xuất', 'Điều chỉnh'] }, { key: 'warehouse', label: 'Kho' }, { key: 'quantity', label: 'Số lượng', type: 'number' }], columns: ['Loại phiếu', 'Kho', 'Số lượng'] },
  logistics: { title: 'Quản lý lưu thông', description: 'Theo dõi tuyến vận chuyển và cập nhật tiến độ giao nhận.', fields: [{ key: 'route', label: 'Tuyến vận chuyển' }, { key: 'progress', label: 'Tiến độ' }, { key: 'updated', label: 'Cập nhật' }], columns: ['Tuyến', 'Tiến độ', 'Cập nhật'] },
  'order-types': { title: 'Quản lý loại đơn hàng', description: 'Cấu hình tên loại đơn, ưu tiên và SLA xử lý.', fields: [{ key: 'priority', label: 'Ưu tiên', options: ['Thấp', 'Bình thường', 'Cao'] }, { key: 'sla', label: 'SLA' }, { key: 'note', label: 'Ghi chú' }], columns: ['Ưu tiên', 'SLA', 'Ghi chú'] },
  staff: { title: 'Quản lý nhân viên', description: 'Quản lý vai trò, ca làm, trạng thái và thông tin đăng nhập nội bộ.', fields: [{ key: 'role', label: 'Vai trò' }, { key: 'shift', label: 'Ca làm' }, { key: 'login', label: 'Tài khoản đăng nhập' }], columns: ['Vai trò', 'Ca làm', 'Tài khoản'] },
  overtime: { title: 'Tăng ca & khen thưởng', description: 'Tạo và duyệt đề xuất tăng ca hoặc ghi nhận thành tích.', fields: [{ key: 'kind', label: 'Hạng mục', options: ['Tăng ca', 'Khen thưởng'] }, { key: 'value', label: 'Thời lượng / điểm' }, { key: 'note', label: 'Ghi chú' }], columns: ['Hạng mục', 'Thời lượng / điểm', 'Ghi chú'] },
  support: { title: 'Quản lý chăm sóc khách hàng', description: 'Theo dõi ticket CSKH theo người phụ trách và trạng thái.', fields: [{ key: 'customer', label: 'Khách hàng' }, { key: 'topic', label: 'Chủ đề' }, { key: 'assignee', label: 'Phụ trách' }], columns: ['Khách hàng', 'Chủ đề', 'Phụ trách'] },
}

function emptyData(schema) { return Object.fromEntries(schema.fields.map((field) => [field.key, ''])) }

function ProductOfferRow({ product, csrfToken, onSaved, onEdit, onDelete }) {
  const [discountPercent, setDiscountPercent] = useState(product.discountPercent || 0)
  const [stockCount, setStockCount] = useState(product.stockCount === null ? '' : String(product.stockCount))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  async function submit(event) {
    event.preventDefault(); setError(''); setSaved(false); setSaving(true)
    try { const offer = { discountPercent: Number(discountPercent), stockCount: stockCount === '' ? null : Number(stockCount) }; await apiJson('/api/admin/products/' + encodeURIComponent(product.id) + '/offer', { method: 'PATCH', headers: { 'x-csrf-token': csrfToken }, body: JSON.stringify(offer) }); onSaved(product.id, offer); setSaved(true) }
    catch (failure) { setError(failure.message || 'Không lưu được ưu đãi.') }
    finally { setSaving(false) }
  }
  return <tr><td><div className="admin-product-cell"><img src={product.image} alt="" width="44" height="44" loading="lazy" /><span>{product.name}</span></div></td><td>{product.category}</td><td>{new Intl.NumberFormat('vi-VN').format(product.price)} ₫</td><td><form className="admin-offer-form" onSubmit={submit}><label>Giảm %<input aria-label={'Giảm giá ' + product.name} type="number" min="0" max="90" step="1" value={discountPercent} onChange={(event) => setDiscountPercent(event.target.value)} required /></label><label>Tồn kho<input aria-label={'Tồn kho ' + product.name} type="number" min="0" max="999999" step="1" value={stockCount} onChange={(event) => setStockCount(event.target.value)} placeholder="Chưa rõ" /></label><button type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu'}</button>{saved && <small role="status">Đã lưu</small>}{error && <small role="alert">{error}</small>}</form></td><td>{product.viewCount || 0}</td><td className="admin-product-actions"><button className="table-action" type="button" onClick={() => onEdit(product)}>Sửa</button><button className="table-action table-action--danger" type="button" onClick={() => onDelete(product)}>Xóa</button></td></tr>
}

function ProductEditor({ product, csrfToken, onSaved, onCancel }) {
  const [form, setForm] = useState({ name: product?.name || '', category: product?.category || 'Đồ gia dụng', price: product?.price || 0, image: product?.image || '/products/bag.svg', description: product?.description || '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true)
    try { const payload = await apiJson(product ? '/api/admin/products/' + encodeURIComponent(product.id) : '/api/admin/products', { method: product ? 'PATCH' : 'POST', headers: { 'x-csrf-token': csrfToken }, body: JSON.stringify({ ...form, price: Number(form.price) }) }); onSaved(payload.product) }
    catch (failure) { setError(failure.message || 'Không lưu được sản phẩm.') }
    finally { setBusy(false) }
  }
  return <form className="admin-product-editor" onSubmit={submit}><div className="admin-editor-grid"><label>Tên sản phẩm<input required maxLength="160" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label><label>Danh mục<input required maxLength="80" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} /></label><label>Giá VND<input required type="number" min="0" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} /></label><label>Đường dẫn ảnh<input value={form.image} onChange={(event) => setForm((current) => ({ ...current, image: event.target.value }))} /></label><label className="admin-editor-wide">Mô tả<textarea rows="2" maxLength="2000" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label></div>{error && <p role="alert">{error}</p>}<div className="admin-editor-actions"><button type="submit" disabled={busy}>{busy ? 'Đang lưu…' : product ? 'Lưu thay đổi' : 'Thêm sản phẩm'}</button><button type="button" className="button-secondary" onClick={onCancel}>Hủy</button></div></form>
}

function ProductsCatalog({ csrfToken }) {
  const [products, setProducts] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editor, setEditor] = useState(null)
  useEffect(() => { const controller = new AbortController(); apiJson('/api/admin/products', { signal: controller.signal }).then((payload) => setProducts(payload.products || [])).catch((failure) => { if (!controller.signal.aborted) setError(failure.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) }); return () => controller.abort() }, [])
  const visible = useMemo(() => { const needle = normalizeSearch(filter).trim(); return needle ? products.filter((product) => normalizeSearch(product.name + ' ' + product.category).includes(needle)) : products }, [filter, products])
  async function remove(product) { if (!window.confirm('Xóa sản phẩm ' + product.name + '?')) return; try { await apiJson('/api/admin/products/' + encodeURIComponent(product.id), { method: 'DELETE', headers: { 'x-csrf-token': csrfToken } }); setProducts((current) => current.filter((item) => item.id !== product.id)) } catch (failure) { setError(failure.message) } }
  function savedProduct(product) { setProducts((current) => current.some((item) => item.id === product.id) ? current.map((item) => item.id === product.id ? { ...item, ...product } : item) : [product, ...current]); setEditor(null) }
  return <section className="admin-module-card"><div className="admin-module-head"><div><p className="admin-eyebrow">DANH MỤC ĐỒNG BỘ</p><h2>Quản lý hàng hóa</h2><p>Thêm, sửa, xóa, tìm kiếm, tồn kho và giảm giá. Store đọc cùng catalog SQLite.</p></div><div className="admin-head-actions"><span className="admin-preview-badge">{products.length} sản phẩm</span><button type="button" onClick={() => setEditor({})}>+ Thêm sản phẩm</button></div></div>{editor && <ProductEditor product={editor.id ? editor : null} csrfToken={csrfToken} onSaved={savedProduct} onCancel={() => setEditor(null)} />}<div className="admin-module-toolbar"><label><span className="sr-only">Tìm sản phẩm</span><input className="admin-wide-search" type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Tìm tên, danh mục hoặc mã sản phẩm…" /></label><span>{visible.length}/{products.length} mục</span></div>{loading && <p>Đang tải sản phẩm…</p>}{error && <p role="alert">Không tải được danh mục: {error}</p>}{!loading && !error && <div className="admin-table-wrap"><table><caption className="sr-only">Sản phẩm đã nhập</caption><thead><tr><th>Sản phẩm</th><th>Danh mục</th><th>Giá gốc</th><th>Giảm giá / tồn kho</th><th>Lượt xem</th><th>Thao tác</th></tr></thead><tbody>{visible.map((product) => <ProductOfferRow key={product.id} product={product} csrfToken={csrfToken} onSaved={(id, offer) => setProducts((current) => current.map((item) => item.id === id ? { ...item, ...offer } : item))} onEdit={setEditor} onDelete={remove} />)}</tbody></table>{visible.length === 0 && <p className="admin-empty">Không có sản phẩm phù hợp.</p>}</div>}<p className="admin-demo-note">Ảnh và metadata là dữ liệu mẫu; không đại diện tồn kho kinh doanh thực tế.</p></section>
}

function ProductViews() {
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { const controller = new AbortController(); apiJson('/api/admin/product-views', { signal: controller.signal }).then(setReport).catch((failure) => { if (!controller.signal.aborted) setError(failure.message) }); return () => controller.abort() }, [])
  const highest = report?.products[0]?.viewCount || 1
  return <section className="admin-module-card"><div className="admin-module-head"><div><p className="admin-eyebrow">THỐNG KÊ TRUY CẬP</p><h2>20 sản phẩm được xem nhiều nhất</h2><p>Mỗi sản phẩm một hàng, ảnh và tên rút gọn; thanh dữ liệu tăng dần theo lượt xem.</p></div><span className="admin-preview-badge">{report?.totalViews || 0} lượt xem</span></div>{error && <p role="alert">Không tải được thống kê: {error}</p>}{!report && !error && <p>Đang tải lượt xem…</p>}{report && <div className="admin-view-list">{report.products.map((product) => <article key={product.id}><b className="admin-view-rank">{String(product.rank).padStart(2, '0')}</b>{product.image ? <img src={product.image} alt="" width="48" height="48" loading="lazy" /> : <span className="admin-view-symbol" aria-hidden="true">{product.symbol}</span>}<div><strong>{product.name}</strong><small>{product.category}</small><span className="admin-view-bar" style={{ '--view-width': `${product.viewCount / highest * 100}%` }} /></div><b>{product.viewCount} lượt</b></article>)}</div>}</section>
}

function Dashboard({ onNavigate }) {
  const [overview, setOverview] = useState(null)
  useEffect(() => { let active = true; apiJson('/api/admin/overview').then((payload) => { if (active) setOverview(payload.overview) }).catch(() => {}); return () => { active = false } }, [])
  const cards = [['Sản phẩm', overview?.products ?? '—', 'catalog SQLite'], ['Khách hàng', overview?.customers ?? '—', 'tài khoản đã đăng ký'], ['Đơn thanh toán', overview?.orders ?? '—', 'đơn trong hệ thống'], ['Doanh thu mẫu', overview ? new Intl.NumberFormat('vi-VN').format(overview.revenue || 0) + ' ₫' : '—', 'đã trừ hoàn tiền']]
  const revenue = overview?.revenueByDay || []
  const highest = Math.max(1, ...revenue.map((item) => item.revenue))
  const statuses = overview?.orderStatus || []
  return <><div className="admin-kpi-grid">{cards.map(([label, value, note]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div><div className="admin-dashboard-grid admin-dashboard-grid--wide"><section className="admin-module-card admin-chart-card"><div className="admin-module-head"><div><p className="admin-eyebrow">DOANH THU THEO NGÀY</p><h2>Biểu đồ vận hành</h2></div><span className="admin-preview-badge">{overview?.includedOrders ?? 0} đơn mẫu</span></div><div className="admin-bar-chart" aria-label="Biểu đồ doanh thu theo ngày">{revenue.length ? revenue.map((item) => <div className="admin-bar-chart__item" key={item.date}><div className="admin-bar-chart__bar" style={{ height: `${Math.max(5, item.revenue / highest * 100)}%` }} title={`${item.date}: ${new Intl.NumberFormat('vi-VN').format(item.revenue)} ₫`}><span>{item.revenue ? new Intl.NumberFormat('vi-VN').format(Math.round(item.revenue / 1000)) + 'k' : '0'}</span></div><small>{item.date.slice(5)}</small></div>) : <p className="admin-empty">Chưa có doanh thu. Bật dữ liệu demo để xem biểu đồ.</p>}</div></section><section className="admin-module-card admin-status-chart"><div className="admin-module-head"><div><p className="admin-eyebrow">SO SÁNH ĐƠN</p><h2>Trạng thái đơn</h2></div></div>{statuses.map((item) => <div className="admin-status-row" key={item.status}><span>{item.status}</span><div><i style={{ '--status-width': `${Math.min(100, Number(item.count) * 25)}%` }} /></div><b>{item.count}</b></div>)}</section></div><div className="admin-dashboard-grid"><section className="admin-module-card"><p className="admin-eyebrow">TỔNG QUAN LIVE</p><h2>Vận hành tập trung</h2><div className="admin-task-list"><div><b>{overview?.totalViews ?? '—'}</b><span>Lượt xem sản phẩm</span></div><div><b>{overview?.favorites ?? '—'}</b><span>Lượt yêu thích</span></div><div><b>{overview?.records ?? '—'}</b><span>Bản ghi vận hành</span></div></div></section><section className="admin-module-card"><p className="admin-eyebrow">LỐI TẮT</p><h2>Mở nhanh các mục</h2><div className="admin-quick-actions"><button type="button" onClick={() => onNavigate('products')}>Quản lý hàng hóa</button><button type="button" onClick={() => onNavigate('product-views')}>Sản phẩm xem nhiều</button><button type="button" onClick={() => onNavigate('statistics')}>Mở thống kê</button><button type="button" onClick={() => onNavigate('support')}>CSKH</button></div></section></div></>
}

function Statistics() {
  const [overview, setOverview] = useState(null)
  useEffect(() => { let active = true; apiJson('/api/admin/overview').then((payload) => { if (active) setOverview(payload.overview) }).catch(() => {}); return () => { active = false } }, [])
  const revenue = overview?.revenueByDay || []
  const totalOrders = overview?.includedOrders || 0
  const average = totalOrders ? Math.round((overview?.revenue || 0) / totalOrders) : 0
  return <section className="admin-module-card statistics-module"><div className="admin-module-head"><div><p className="admin-eyebrow">STORE ANALYTICS</p><h2>Thống kê tổng hợp</h2><p>So sánh doanh thu, số đơn và hành vi truy cập từ dữ liệu backend SQLite.</p></div><span className="admin-preview-badge">Cập nhật trực tiếp</span></div><div className="statistics-summary"><div><small>Doanh thu ròng</small><b>{new Intl.NumberFormat('vi-VN').format(overview?.revenue || 0)} ₫</b></div><div><small>Đơn đã ghi nhận</small><b>{totalOrders}</b></div><div><small>Giá trị đơn trung bình</small><b>{new Intl.NumberFormat('vi-VN').format(average)} ₫</b></div><div><small>Lượt xem sản phẩm</small><b>{overview?.totalViews || 0}</b></div></div><div className="statistics-table"><h3>Doanh thu theo ngày</h3>{revenue.length ? revenue.map((item) => <div key={item.date}><span>{item.date}</span><span>{item.orders} đơn</span><b>{new Intl.NumberFormat('vi-VN').format(item.revenue)} ₫</b></div>) : <p className="admin-empty">Chưa có dữ liệu thống kê.</p>}</div></section>
}

function AppearanceEditor({ csrfToken }) {
  const defaults = { brandName: 'store', brandTagline: 'EVERYDAY', headerSearchPlaceholder: 'Tìm sản phẩm, danh mục…', navHome: 'Trang chủ', navProducts: 'Hàng hóa', navFavorites: 'Yêu thích', navRewards: 'May mắn', navMembership: 'Thành viên', navContact: 'Địa chỉ & liên hệ', heroTitle: 'Chọn món bạn yêu. Sống theo cách riêng.', heroDescription: 'Khám phá sản phẩm nổi bật, ưu đãi và các nhóm hàng dễ tìm.', heroButton: 'Khám phá cửa hàng', footerText: 'Những điều nhỏ, cho một ngày tốt hơn.', footerSupport: 'Đội ngũ Store luôn sẵn sàng hỗ trợ bạn.', footerInfo: 'Danh mục và giá là dữ liệu mẫu trong môi trường thử nghiệm.', footerShopTitle: 'Mua sắm', footerProducts: 'Hàng hóa', footerCart: 'Giỏ hàng', footerMembership: 'Thành viên', footerRewards: 'Vòng quay may mắn', footerSupportTitle: 'Hỗ trợ', footerContact: 'Địa chỉ & liên hệ', footerAccount: 'Tài khoản của bạn', footerInfoTitle: 'Thông tin', footerCopyright: '© 2026 Store', accentColor: '#4f8b67', bannerLabel: 'STORE EVERYDAY' }
  const [form, setForm] = useState(defaults)
  const [status, setStatus] = useState('')
  useEffect(() => { apiJson('/api/admin/appearance').then((payload) => setForm((current) => ({ ...current, ...(payload.appearance || {}) }))).catch(() => {}) }, [])
  async function save(event) { event.preventDefault(); setStatus(''); try { const payload = await apiJson('/api/admin/appearance', { method: 'PUT', headers: { 'x-csrf-token': csrfToken }, body: JSON.stringify(form) }); setForm((current) => ({ ...current, ...payload.appearance })); setStatus('Đã lưu trực tiếp cho storefront.') } catch (error) { setStatus(error.message) } }
  return <section className="admin-module-card"><div className="admin-module-head"><div><p className="admin-eyebrow">STOREFRONT EDITOR</p><h2>Trang trí & chỉnh sửa</h2><p>Chỉnh nội dung header, hero, menu, nhãn thương hiệu và toàn bộ footer; dữ liệu lưu trong backend để Store đọc khi tải lại.</p></div><span className="admin-preview-badge">Đang nối API</span></div><div className="appearance-layout"><div className="appearance-preview appearance-preview--ink" style={{ '--editor-accent': form.accentColor }}><small>{form.bannerLabel}</small><h3>{form.heroTitle || 'Tiêu đề trang chủ'}</h3><p>{form.heroDescription}</p><button type="button">{form.heroButton}</button><footer><b>{form.brandName}.</b><br />{form.footerText}<br /><span>{form.footerSupport}</span></footer></div><form className="appearance-controls" onSubmit={save}>{[['brandName','Tên logo'],['brandTagline','Dòng chữ cạnh logo'],['headerSearchPlaceholder','Gợi ý ô tìm kiếm'],['navHome','Menu Trang chủ'],['navProducts','Menu Hàng hóa'],['navFavorites','Menu Yêu thích'],['navRewards','Menu May mắn'],['navMembership','Menu Thành viên'],['navContact','Menu Liên hệ'],['bannerLabel','Nhãn banner'],['heroTitle','Tiêu đề hero'],['heroDescription','Mô tả hero'],['heroButton','Tên nút hero'],['footerText','Nội dung footer'],['footerSupport','Dòng hỗ trợ footer'],['footerInfo','Thông tin footer'],['footerShopTitle','Tiêu đề nhóm mua sắm'],['footerProducts','Link Hàng hóa'],['footerCart','Link Giỏ hàng'],['footerMembership','Link Thành viên'],['footerRewards','Link Vòng quay'],['footerSupportTitle','Tiêu đề nhóm hỗ trợ'],['footerContact','Link Liên hệ'],['footerAccount','Link Tài khoản'],['footerInfoTitle','Tiêu đề nhóm thông tin'],['footerCopyright','Bản quyền footer'],['accentColor','Màu nhấn']].map(([key,label]) => <label key={key}>{label}{key.includes('Description') || key.includes('footer') || key === 'footerSupport' || key === 'footerInfo' ? <textarea rows="2" maxLength="240" value={form[key] || ''} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /> : <input maxLength="240" value={form[key] || ''} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} />}</label>)}<button type="submit">Lưu thay đổi</button>{status && <small role="status">{status}</small>}</form></div></section>
}

function RecordEditor({ schema, record, onSave, onCancel }) {
  const [title, setTitle] = useState(record?.title || '')
  const [status, setStatus] = useState(record?.status || 'Đang dùng')
  const [data, setData] = useState({ ...emptyData(schema), ...(record?.data || {}) })
  const [error, setError] = useState('')
  async function submit(event) { event.preventDefault(); setError(''); try { await onSave({ title, status, data }) } catch (failure) { setError(failure.message) } }
  return <form className="admin-record-editor" onSubmit={submit}><div className="admin-editor-grid"><label>Tên / mã<input required maxLength="160" value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Trạng thái<select value={status} onChange={(event) => setStatus(event.target.value)}>{statusOptions.map((item) => <option key={item}>{item}</option>)}</select></label>{schema.fields.map((field) => <label key={field.key}>{field.label}{field.options ? <select value={data[field.key] || ''} onChange={(event) => setData((current) => ({ ...current, [field.key]: event.target.value }))}><option value="">Chọn</option>{field.options.map((item) => <option key={item}>{item}</option>)}</select> : <input type={field.type || 'text'} value={data[field.key] || ''} onChange={(event) => setData((current) => ({ ...current, [field.key]: event.target.value }))} />}</label>)}</div>{error && <p role="alert">{error}</p>}<div className="admin-editor-actions"><button type="submit">{record ? 'Lưu thay đổi' : 'Thêm bản ghi'}</button><button type="button" className="button-secondary" onClick={onCancel}>Hủy</button></div></form>
}

function CrudModule({ module, csrfToken }) {
  const schema = crudSchemas[module]
  const [records, setRecords] = useState([])
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState(null)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => { const controller = new AbortController(); apiJson('/api/admin/records/' + module, { signal: controller.signal }).then((payload) => setRecords(payload.records || [])).catch((failure) => { if (!controller.signal.aborted) setError(failure.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) }); return () => controller.abort() }, [module])
  const visible = useMemo(() => { const needle = normalizeSearch(query).trim(); return needle ? records.filter((record) => normalizeSearch([record.title, record.status, ...Object.values(record.data || {})].join(' ')).includes(needle)) : records }, [query, records])
  async function save(payload) { const editing = editor?.id; const response = await apiJson('/api/admin/records/' + module + (editing ? '/' + editing : ''), { method: editing ? 'PATCH' : 'POST', headers: { 'x-csrf-token': csrfToken }, body: JSON.stringify(payload) }); const record = response.record; setRecords((current) => editing ? current.map((item) => item.id === record.id ? record : item) : [record, ...current]); setEditor(null) }
  async function remove(record) { if (!window.confirm('Xóa bản ghi ' + record.title + '?')) return; try { await apiJson('/api/admin/records/' + module + '/' + record.id, { method: 'DELETE', headers: { 'x-csrf-token': csrfToken } }); setRecords((current) => current.filter((item) => item.id !== record.id)) } catch (failure) { setError(failure.message) } }
  return <section className="admin-module-card"><div className="admin-module-head"><div><p className="admin-eyebrow">STORE OPERATIONS</p><h2>{schema.title}</h2><p>{schema.description}</p></div><button type="button" onClick={() => setEditor({})}>+ Thêm</button></div>{editor && <RecordEditor schema={schema} record={editor.id ? editor : null} onSave={save} onCancel={() => setEditor(null)} />}<div className="admin-module-toolbar"><input className="admin-wide-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={'Tìm trong ' + schema.title.toLocaleLowerCase('vi') + '…'} /><span>{visible.length}/{records.length} mục</span></div>{error && <p role="alert">{error}</p>}{loading ? <p>Đang tải…</p> : <div className="admin-table-wrap"><table><thead><tr><th>Tên / mã</th>{schema.columns.map((column) => <th key={column}>{column}</th>)}<th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{visible.map((record) => <tr key={record.id}><td><button className="admin-link-button" type="button" onClick={() => setSelected(record)}>{record.title}</button><small>#{record.id}</small></td>{schema.fields.map((field) => <td key={field.key}>{record.data?.[field.key] || '—'}</td>)}<td className="admin-status-cell">{record.status}</td><td className="admin-product-actions"><button className="table-action" type="button" onClick={() => setEditor(record)}>Sửa</button><button className="table-action table-action--danger" type="button" onClick={() => remove(record)}>Xóa</button></td></tr>)}</tbody></table>{visible.length === 0 && <p className="admin-empty">Chưa có bản ghi phù hợp.</p>}</div>}{selected && <section className="admin-detail-panel"><p className="admin-eyebrow">CHI TIẾT BẢN GHI</p><h3>{selected.title}</h3><button type="button" onClick={() => setSelected(null)}>Đóng</button><dl>{Object.entries({ ...selected.data, status: selected.status, createdAt: selected.createdAt, updatedAt: selected.updatedAt }).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value || '—')}</dd></div>)}</dl></section>}</section>
}

export default function AdminModule({ module, csrfToken, onNavigate }) {
  if (module === 'dashboard') return <Dashboard onNavigate={onNavigate} />
  if (module === 'statistics') return <Statistics />
  if (module === 'products') return <ProductsCatalog csrfToken={csrfToken} />
  if (module === 'product-views') return <ProductViews />
  if (module === 'appearance') return <AppearanceEditor csrfToken={csrfToken} />
  if (module === 'customers') return <AdminCustomers />
  if (module === 'favorites') return <AdminFavorites />
  if (module === 'reviews') return <AdminReviews csrfToken={csrfToken} />
  if (module === 'customer-orders') return <AdminOrders csrfToken={csrfToken} />
  if (module === 'rewards-wheel') return <AdminVouchers csrfToken={csrfToken} />
  if (crudSchemas[module]) return <CrudModule module={module} csrfToken={csrfToken} />
  return <section className="admin-module-card"><h2>Module chưa có dữ liệu</h2><p>Module này đang chờ cấu hình backend.</p></section>
}
