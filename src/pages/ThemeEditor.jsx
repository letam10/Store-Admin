import { useEffect, useMemo, useState } from 'react'
import { apiJson } from '../api/chat'
import { DEFAULT_THEME, THEME_MODES, THEME_PRESET_IDS, normalizeTheme, presetTheme, themeVariables } from '../../shared/theme.js'
import './ThemeEditor.css'

const appearanceDefaults = {
  brandName: 'store', brandTagline: 'EVERYDAY', headerSearchPlaceholder: 'Tìm sản phẩm, danh mục…',
  navHome: 'Trang chủ', navProducts: 'Hàng hóa', navFavorites: 'Yêu thích', navRewards: 'May mắn',
  navMembership: 'Thành viên', navContact: 'Địa chỉ & liên hệ', heroTitle: 'Chọn món bạn yêu. Sống theo cách riêng.',
  heroDescription: 'Khám phá sản phẩm nổi bật, ưu đãi và các nhóm hàng dễ tìm.', heroButton: 'Khám phá cửa hàng',
  footerText: 'Những điều nhỏ, cho một ngày tốt hơn.', footerSupport: 'Đội ngũ Store luôn sẵn sàng hỗ trợ bạn.',
  footerInfo: 'Giá và ưu đãi được cập nhật tại cửa hàng. Điểm thành viên được cộng sau khi xác nhận thanh toán.',
  footerShopTitle: 'Mua sắm', footerProducts: 'Hàng hóa', footerCart: 'Giỏ hàng', footerMembership: 'Thành viên',
  footerRewards: 'Vòng quay may mắn', footerSupportTitle: 'Hỗ trợ', footerContact: 'Địa chỉ & liên hệ',
  footerAccount: 'Tài khoản của bạn', footerInfoTitle: 'Thông tin', footerCopyright: '© 2026 Store',
  accentColor: '#4F8B67', bannerLabel: 'STORE EVERYDAY', contactAddress: '', contactPhone: '', contactEmail: '', contactHours: '',
}
const legacyFields = Object.entries(appearanceDefaults)
const colorKeys = ['page', 'surface', 'surfaceAlt', 'text', 'muted', 'border', 'accent', 'accentStrong', 'accentSoft', 'control', 'controlActive', 'danger', 'success']

const presetLabels = { forest: 'Rừng xanh', terracotta: 'Đất nung', olive: 'Ô liu' }
const colorLabels = { page: 'Nền trang', surface: 'Nền thẻ', surfaceAlt: 'Nền phụ', text: 'Chữ chính', muted: 'Chữ phụ', border: 'Đường viền', accent: 'Màu nhấn', accentStrong: 'Màu nhấn đậm', accentSoft: 'Màu nhấn nhẹ', control: 'Nền nút', controlActive: 'Nút đang chọn', danger: 'Cảnh báo lỗi', success: 'Thành công' }
const contentLabels = {
  brandName: 'Tên cửa hàng', brandTagline: 'Khẩu hiệu', headerSearchPlaceholder: 'Gợi ý ô tìm kiếm',
  navHome: 'Mục trang chủ', navProducts: 'Mục hàng hóa', navFavorites: 'Mục yêu thích', navRewards: 'Mục vòng quay',
  navMembership: 'Mục thành viên', navContact: 'Mục liên hệ', heroTitle: 'Tiêu đề trang chủ',
  heroDescription: 'Mô tả trang chủ', heroButton: 'Nút trang chủ', footerText: 'Giới thiệu cuối trang',
  footerSupport: 'Lời nhắn hỗ trợ', footerInfo: 'Thông tin cuối trang', footerShopTitle: 'Tiêu đề mua sắm',
  footerProducts: 'Liên kết hàng hóa', footerCart: 'Liên kết giỏ hàng', footerMembership: 'Liên kết thành viên',
  footerRewards: 'Liên kết vòng quay', footerSupportTitle: 'Tiêu đề hỗ trợ', footerContact: 'Liên kết liên hệ',
  footerAccount: 'Liên kết tài khoản', footerInfoTitle: 'Tiêu đề thông tin', footerCopyright: 'Dòng bản quyền',
  accentColor: 'Màu nhấn', bannerLabel: 'Nhãn giới thiệu', contactAddress: 'Địa chỉ liên hệ',
  contactPhone: 'Điện thoại liên hệ', contactEmail: 'Thư điện tử liên hệ', contactHours: 'Giờ làm việc',
}

function hexToRgb(value) {
  const clean = /^#[0-9a-f]{6}$/i.test(value) ? value.slice(1) : '000000'
  return [0, 2, 4].map((index) => Number.parseInt(clean.slice(index, index + 2), 16))
}

function rgbToHex(rgb) { return '#' + rgb.map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('').toUpperCase() }

function rgbToHsv(value) {
  const [red, green, blue] = hexToRgb(value).map((item) => item / 255)
  const max = Math.max(red, green, blue), min = Math.min(red, green, blue), delta = max - min
  let hue = 0
  if (delta) hue = max === red ? 60 * (((green - blue) / delta) % 6) : max === green ? 60 * ((blue - red) / delta + 2) : 60 * ((red - green) / delta + 4)
  return { hue: (hue + 360) % 360, saturation: max ? delta / max : 0, value: max }
}

function hsvToHex(hue, saturation, value) {
  const chroma = value * saturation, part = (hue / 60) % 2, second = chroma * (1 - Math.abs(part - 1))
  const [red, green, blue] = hue < 60 ? [chroma, second, 0] : hue < 120 ? [second, chroma, 0] : hue < 180 ? [0, chroma, second] : hue < 240 ? [0, second, chroma] : hue < 300 ? [second, 0, chroma] : [chroma, 0, second]
  const match = value - chroma
  return rgbToHex([(red + match) * 255, (green + match) * 255, (blue + match) * 255])
}

function ThemeColorField({ label, value, onChange }) {
  const hsv = useMemo(() => rgbToHsv(value), [value])
  const hue = hsv.hue
  const updateHue = (nextHue) => onChange(hsvToHex(nextHue, hsv.saturation || 1, hsv.value || 1))
  return <div className="theme-color-field"><label><span>{label}</span><input className="theme-color-swatch" type="color" value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} /></label><input className="theme-hue-slider" type="range" min="0" max="360" value={hue} onChange={(event) => updateHue(Number(event.target.value))} aria-label={'Sắc độ ' + label} /><input className="theme-hex-input" value={value} maxLength="7" pattern="#[0-9A-Fa-f]{6}" onChange={(event) => onChange(event.target.value.toUpperCase())} aria-label={'Mã màu ' + label} /></div>
}

function updateThemeValue(theme, mode, group, key, value) { return { ...theme, [mode]: { ...theme[mode], [group]: { ...theme[mode][group], [key]: value } } } }

function ThemePreview({ theme, mode, previewMode, form }) {
  const variables = themeVariables(theme, mode)
  const title = previewMode === 'catalog' ? form.navProducts : previewMode === 'footer' ? form.footerShopTitle : form.heroTitle
  const description = previewMode === 'catalog' ? `${form.headerSearchPlaceholder} · ${form.navFavorites}` : previewMode === 'footer' ? `${form.footerText} ${form.footerInfo}` : form.heroDescription
  return <div className={'theme-preview theme-preview--' + previewMode} style={variables}><small>{previewMode === 'footer' ? form.footerInfoTitle : form.bannerLabel}</small><h3>{title || 'Tiêu đề trang chủ'}</h3><p>{description}</p>{previewMode !== 'footer' && <button type="button">{previewMode === 'catalog' ? form.navProducts : form.heroButton}</button>}<footer><b>{form.brandName}.</b><br />{form.footerText}<br /><span>{form.footerSupport}</span></footer></div>
}

function AdminThemePreview({ theme, mode }) {
  const variables = themeVariables(theme, mode)
  return <div className="theme-preview theme-preview--admin" style={variables}>
    <div className="theme-admin-preview__corner theme-admin-preview__corner--top" />
    <div className="theme-admin-preview__corner theme-admin-preview__corner--bottom" />
    <aside className="theme-admin-preview__sidebar"><strong>store. <small>QUẢN TRỊ</small></strong><button type="button" className="is-active">✦ Giao diện</button><button type="button">◫ Hàng hóa</button><button type="button">★ Đánh giá</button></aside>
    <main className="theme-admin-preview__main"><small>GIAO DIỆN QUẢN TRỊ</small><h3>Không gian quản trị</h3><p>Màu thanh bên, bảng điều khiển và nút đang chọn được xem trước tại đây.</p><div className="theme-admin-preview__card"><b>Chỉnh giao diện</b><span>Sáng / Tối · Xem trước</span><button type="button">Đang chọn</button></div></main>
  </div>
}

export default function ThemeEditor({ csrfToken }) {
  const [form, setForm] = useState(appearanceDefaults)
  const [storeTheme, setStoreTheme] = useState(() => normalizeTheme(DEFAULT_THEME))
  const [adminTheme, setAdminTheme] = useState(() => normalizeTheme(DEFAULT_THEME))
  const [target, setTarget] = useState('store')
  const [mode, setMode] = useState('light')
  const [previewMode, setPreviewMode] = useState('home')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { apiJson('/api/admin/appearance').then((payload) => { setForm((current) => ({ ...current, ...(payload.appearance || {}) })); setStoreTheme(normalizeTheme(payload.theme || payload.appearance?.theme)); setAdminTheme(normalizeTheme(payload.adminTheme || payload.theme || payload.appearance?.theme)) }).catch((error) => setStatus(error.message)) }, [])
  const activeTheme = target === 'admin' ? adminTheme : storeTheme
  const setActiveTheme = (updater) => { if (target === 'admin') setAdminTheme(updater); else setStoreTheme(updater) }
  function choosePreset(id) { setActiveTheme(() => presetTheme(id)); setStatus('Đã nạp mẫu giao diện ' + presetLabels[id] + ' cho ' + (target === 'admin' ? 'Quản trị' : 'Store') + '.') }
  function setColor(key, value) { setActiveTheme((current) => updateThemeValue(current, mode, 'colors', key, value)) }
  function setRadius(key, value) { setActiveTheme((current) => updateThemeValue(current, mode, 'radius', key, Number(value))) }
  function setShadow(value) { setActiveTheme((current) => ({ ...current, [mode]: { ...current[mode], shadowStrength: Number(value) } })) }
  async function save(event) { event.preventDefault(); setBusy(true); setStatus(''); try { const payload = await apiJson('/api/admin/appearance', { method: 'PUT', headers: { 'x-csrf-token': csrfToken }, body: JSON.stringify({ ...form, theme: storeTheme, adminTheme }) }); setForm((current) => ({ ...current, ...(payload.appearance || {}) })); setStoreTheme(normalizeTheme(payload.theme || payload.appearance?.theme)); setAdminTheme(normalizeTheme(payload.adminTheme || payload.theme || payload.appearance?.theme)); setStatus('Đã lưu giao diện Store, giao diện Quản trị và nội dung cửa hàng.') } catch (error) { setStatus(error.message) } finally { setBusy(false) } }
  function resetSystem() { setActiveTheme(() => normalizeTheme(DEFAULT_THEME)); setStatus('Đã khôi phục mặc định hệ thống cho ' + (target === 'admin' ? 'Quản trị' : 'Store') + '. Hãy bấm Lưu giao diện để ghi lại.') }
  function openPreview(url) { window.open(url, '_blank', 'noopener,noreferrer') }
  const variant = activeTheme[mode]
  return <section className="admin-module-card theme-editor"><div className="admin-module-head"><div><p className="admin-eyebrow">CHỈNH GIAO DIỆN</p><h2>Giao diện cửa hàng và quản trị</h2><p>Điều chỉnh riêng giao diện cửa hàng và trang quản trị.</p></div><span className="admin-preview-badge">{activeTheme.presetId === 'forest' ? 'Rừng xanh mặc định' : 'Tùy chỉnh'}</span></div><div className="theme-editor-toolbar"><div className="theme-target-tabs" role="tablist" aria-label="Chọn nơi áp dụng"><button type="button" className={target === 'store' ? 'is-active' : ''} onClick={() => setTarget('store')} role="tab" aria-selected={target === 'store'}>Cửa hàng</button><button type="button" className={target === 'admin' ? 'is-active' : ''} onClick={() => setTarget('admin')} role="tab" aria-selected={target === 'admin'}>Quản trị</button></div><div className="theme-mode-tabs" role="tablist" aria-label="Chọn chế độ sáng hoặc tối">{THEME_MODES.map((item) => <button key={item} type="button" className={mode === item ? 'is-active' : ''} onClick={() => setMode(item)} role="tab" aria-selected={mode === item}>{item === 'light' ? 'Sáng' : 'Tối'}</button>)}</div><div className="theme-preset-list" aria-label="Mẫu giao diện">{THEME_PRESET_IDS.map((id) => <button key={id} type="button" className={activeTheme.presetId === id ? 'is-active' : ''} onClick={() => choosePreset(id)}>{presetLabels[id]}</button>)}</div></div><div className="theme-editor-layout"><div>{target === 'admin' ? <AdminThemePreview theme={activeTheme} mode={mode} /> : <ThemePreview theme={activeTheme} mode={mode} previewMode={previewMode} form={form} />}<div className="theme-preview-actions"><button type="button" onClick={() => openPreview(import.meta.env?.VITE_STOREFRONT_URL || 'http://localhost:5173/')}>Xem trước cửa hàng</button><button type="button" onClick={() => openPreview(window.location.origin)}>Xem trước Quản trị</button></div>{target === 'store' && <div className="appearance-preview-tabs" role="tablist" aria-label="Khung xem trước">{[['home', 'Trang chủ'], ['catalog', 'Hàng hóa'], ['footer', 'Chân trang']].map(([id, label]) => <button key={id} type="button" className={previewMode === id ? 'is-active' : ''} onClick={() => setPreviewMode(id)} role="tab" aria-selected={previewMode === id}>{label}</button>)}</div>}</div><div className="theme-controls"><fieldset><legend>{target === 'admin' ? 'Màu Quản trị ' : 'Màu Store '}{mode === 'light' ? 'Sáng' : 'Tối'}</legend><div className="theme-color-grid">{colorKeys.map((key) => <ThemeColorField key={key} label={colorLabels[key]} value={variant.colors[key]} onChange={(value) => setColor(key, value)} />)}</div></fieldset><fieldset><legend>Bo góc và bóng đổ</legend>{[['card', 'Bo góc thẻ'], ['control', 'Bo góc nút'], ['panel', 'Bo góc bảng']].map(([key, label]) => <label className="theme-range-row" key={key}><span>{label} <b>{variant.radius[key]}px</b></span><input type="range" min="0" max="24" value={variant.radius[key]} onChange={(event) => setRadius(key, event.target.value)} /></label>)}<label className="theme-range-row"><span>Độ mạnh bóng đổ <b>{variant.shadowStrength}</b></span><input type="range" min="0" max="100" value={variant.shadowStrength} onChange={(event) => setShadow(event.target.value)} /></label></fieldset></div></div><form className="appearance-controls theme-legacy-controls" onSubmit={save}><h3>Nội dung cửa hàng</h3>{legacyFields.map(([key]) => <label key={key}>{contentLabels[key]}{key.toLowerCase().includes('description') || key.toLowerCase().includes('footer') ? <textarea rows="2" maxLength="240" value={form[key] || ''} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /> : <input type={key === 'contactEmail' ? 'email' : 'text'} maxLength="240" value={form[key] || ''} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} />}</label>)}<div className="theme-editor-actions"><button type="submit" disabled={busy}>Lưu giao diện</button><button type="button" onClick={() => choosePreset(activeTheme.presetId)}>Khôi phục mẫu giao diện</button><button type="button" onClick={resetSystem}>Khôi phục mặc định hệ thống</button></div>{status && <small role="status">{status}</small>}</form></section>
}
