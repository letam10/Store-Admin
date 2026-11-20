/*
  FILE NOTE
  - Mục đích: Giao diện quản lý chủ đề và banner hai bên trang chủ (ThemeEditor), hỗ trợ cấu hình 0 banner hoặc từ 10 đến 20 banner mỗi bên, chế độ xem thu gọn/chi tiết, bộ lọc tìm kiếm nhanh, tự động đồng bộ màu sắc banner theo Store Theme (Đất nung, Rừng xanh, Ô liu...) và thích ứng Dark/Light mode.
  - Liên kết trực tiếp: Store-Admin/src/services/sideBanners.js, Store-Admin/src/pages/ThemeEditor.css, Store-Admin/src/api/chat.js, Store-Admin/shared/theme.js.
  - Vùng ảnh hưởng khi sửa: Trang Quản trị > Giao diện (Theme Editor) trong Store-Admin, xem trước và lưu cấu hình banner của hệ thống.
*/

import { useEffect, useMemo, useRef, useState } from 'react'
import { apiJson } from '../api/chat'
import { DEFAULT_THEME, THEME_MODES, THEME_PRESET_IDS, normalizeTheme, presetTheme, themeVariables } from '../../shared/theme.js'
import {
  SIDE_BANNER_COUNT_OPTIONS,
  SIDE_BANNER_MAX_COUNT,
  SIDE_BANNER_MIN_COUNT,
  autoFillSideBanners,
  editorSideBanners,
  emptySideBannerSlot,
  filterCatalogProducts,
  padSideBannerList,
  serializeSideBanners,
  sideBannerProduct,
} from '../services/sideBanners'
import './ThemeEditor.css'

const appearanceDefaults = {
  brandName: 'OmniCart', brandTagline: 'EVERYDAY', headerSearchPlaceholder: 'Tìm sản phẩm, danh mục…',
  navHome: 'Trang chủ', navProducts: 'Hàng hóa', navFavorites: 'Yêu thích', navRewards: 'May mắn',
  navMembership: 'Thành viên', navContact: 'Địa chỉ & liên hệ', heroTitle: 'Chọn món bạn yêu. Sống theo cách riêng.',
  heroDescription: 'Khám phá sản phẩm nổi bật, ưu đãi và các nhóm hàng dễ tìm.', heroButton: 'Khám phá cửa hàng',
  footerText: 'Những điều nhỏ, cho một ngày tốt hơn.', footerSupport: 'Đội ngũ OmniCart luôn sẵn sàng hỗ trợ bạn.',
  footerInfo: 'Giá và ưu đãi được cập nhật tại cửa hàng. Điểm thành viên được cộng sau khi xác nhận thanh toán.',
  footerShopTitle: 'Mua sắm', footerProducts: 'Hàng hóa', footerCart: 'Giỏ hàng', footerMembership: 'Thành viên',
  footerRewards: 'Vòng quay may mắn', footerSupportTitle: 'Hỗ trợ', footerContact: 'Địa chỉ & liên hệ',
  footerAccount: 'Tài khoản của bạn', footerInfoTitle: 'Thông tin', footerCopyright: '© 2026 OmniCart',
  accentColor: '#4F8B67', bannerLabel: 'OMNICART EVERYDAY', contactAddress: '', contactPhone: '', contactEmail: '', contactHours: '',
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
    <aside className="theme-admin-preview__sidebar"><strong>OmniCart. <small>QUẢN TRỊ</small></strong><button type="button" className="is-active">✦ Giao diện</button><button type="button">◫ Hàng hóa</button><button type="button">★ Đánh giá</button></aside>
    <main className="theme-admin-preview__main"><small>GIAO DIỆN QUẢN TRỊ</small><h3>Không gian quản trị</h3><p>Màu thanh bên, bảng điều khiển và nút đang chọn được xem trước tại đây.</p><div className="theme-admin-preview__card"><b>Chỉnh giao diện</b><span>Sáng / Tối · Xem trước</span><button type="button">Đang chọn</button></div></main>
  </div>
}

function formatBannerPrice(value) {
  const price = Number(value)
  if (!Number.isFinite(price)) return ''
  return new Intl.NumberFormat('vi-VN').format(price) + ' ₫'
}

function SideBannerColorField({ label, value, onChange }) {
  const swatch = /^#[0-9A-F]{6}$/i.test(value || '') ? value : '#FFFFFF'
  return (
    <label className="side-banner-color">
      <span>{label}</span>
      <span className="side-banner-color-inputs">
        <input
          type="color"
          value={swatch}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          aria-label={label}
        />
        <input
          type="text"
          value={value}
          maxLength="7"
          placeholder="Mặc định"
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          aria-label={'Mã màu ' + label}
        />
        {value ? (
          <button
            type="button"
            className="side-banner-btn-tiny"
            onClick={() => onChange('')}
            title={'Xóa màu ' + label + ' (dùng màu mặc định)'}
            style={{ padding: '2px 5px', fontSize: '10px' }}
          >
            ✕
          </button>
        ) : null}
      </span>
    </label>
  )
}

// Tính toán màu chữ có độ tương phản cao dựa trên độ sáng (YIQ) của màu nền
function getContrastTextColor(hexColor, isDark = false) {
  if (!hexColor || !/^#[0-9A-Fa-f]{6}$/.test(hexColor)) {
    return isDark ? '#E2F0E6' : '#18362A'
  }
  const clean = hexColor.slice(1)
  const r = Number.parseInt(clean.slice(0, 2), 16)
  const g = Number.parseInt(clean.slice(2, 4), 16)
  const b = Number.parseInt(clean.slice(4, 6), 16)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  // Nếu nền sáng (yiq >= 135) dùng chữ màu sẫm #18362A, nếu nền tối dùng chữ sáng #E2F0E6
  return yiq >= 135 ? '#18362A' : '#E2F0E6'
}

// Giải quyết màu sắc hiển thị cho slot banner theo theme (Light/Dark), Store Theme và tùy chỉnh riêng
function resolveBannerSlotColors(slot = {}, isDark = false, theme = null) {
  const customBg = slot.bg && /^#[0-9A-Fa-f]{6}$/i.test(slot.bg) ? slot.bg : ''
  const customText = slot.text && /^#[0-9A-Fa-f]{6}$/i.test(slot.text) ? slot.text : ''
  const customAccent = slot.accent && /^#[0-9A-Fa-f]{6}$/i.test(slot.accent) ? slot.accent : ''

  const modeKey = isDark ? 'dark' : 'light'
  const themeColors = theme?.[modeKey]?.colors || {}

  // Khi chưa custom màu riêng: tự động lấy màu theo Store Theme đang chọn (Đất nung, Rừng xanh, Ô liu, hoặc custom palette)
  const defaultBg = themeColors.surface || (isDark ? '#14281F' : '#FFFFFF')
  const defaultText = themeColors.text || (isDark ? '#E2F0E6' : '#18362A')
  const defaultAccent = themeColors.accent || (isDark ? '#34D399' : '#4F8B67')
  const defaultBorder = themeColors.border || (isDark ? '#284C37' : '#D6E3D8')

  const bg = customBg || defaultBg
  // Khi có custom riêng, tự động tính toán màu chữ tương phản tương ứng nếu slot.text chưa đặt:
  const text = customText || (customBg ? getContrastTextColor(customBg, isDark) : defaultText)
  const accent = customAccent || defaultAccent
  const border = customAccent || (customBg ? customBg : defaultBorder)

  return { bg, text, accent, border, isCustomized: Boolean(customBg || customText || customAccent) }
}

// Modal duyệt và chọn sản phẩm trực quan, lọc theo danh mục
function ProductPickerModal({ activeSlot, catalog, onClose, onSelect }) {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')

  const categories = useMemo(() => {
    const set = new Set()
    for (const p of catalog) {
      if (p?.category) set.add(p.category)
    }
    return Array.from(set)
  }, [catalog])

  const filteredProducts = useMemo(() => {
    let list = catalog
    if (selectedCategory) {
      list = list.filter((p) => p?.category === selectedCategory)
    }
    return filterCatalogProducts(list, search)
  }, [catalog, selectedCategory, search])

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!activeSlot) return null

  return (
    <div className="side-banner-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Chọn sản phẩm">
      <div className="side-banner-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="side-banner-modal-head">
          <h4>Chọn sản phẩm cho {activeSlot.sideLabel} · Banner {activeSlot.index + 1}</h4>
          <button type="button" className="side-banner-modal-close" onClick={onClose} aria-label="Đóng modal">✕</button>
        </div>
        <div className="side-banner-modal-controls">
          <input
            type="text"
            className="side-banner-search-input"
            placeholder="🔍 Gõ tìm theo tên sản phẩm, danh mục, giá, ID..."
            value={search}
            autoFocus
            onChange={(e) => setSearch(e.target.value)}
          />
          {categories.length > 0 && (
            <div className="side-banner-modal-chips" role="tablist" aria-label="Lọc theo danh mục">
              <button
                type="button"
                className={'side-banner-chip' + (selectedCategory === '' ? ' is-active' : '')}
                onClick={() => setSelectedCategory('')}
              >
                Tất cả ({catalog.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={'side-banner-chip' + (selectedCategory === cat ? ' is-active' : '')}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="side-banner-modal-list">
          {filteredProducts.length === 0 ? (
            <p style={{ gridColumn: '1/-1', textAlign: 'center', padding: '24px 0', color: 'var(--theme-muted)' }}>
              Không tìm thấy sản phẩm phù hợp.
            </p>
          ) : (
            filteredProducts.map((item) => (
              <button
                key={String(item.id)}
                type="button"
                className="side-banner-modal-product-card"
                onClick={() => {
                  onSelect(item)
                  onClose()
                }}
              >
                {item.image ? <img src={item.image} alt={item.name || ''} loading="lazy" /> : <div style={{ width: 44, height: 44, background: '#eee', borderRadius: 6 }} />}
                <div>
                  <strong>{item.name || String(item.id)}</strong>
                  <span>{item.category || 'Chung'}</span>
                  <b>{formatBannerPrice(item.price)}</b>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function SideBannerSlot({
  sideLabel,
  side,
  index,
  slot,
  catalog,
  catalogReady,
  isDark = false,
  storeTheme = null,
  isExpanded = true,
  isHighlighted = false,
  onToggleExpand,
  onChange,
  onOpenPicker,
}) {
  const product = sideBannerProduct(catalog, slot.productId)
  const selectedMissing = slot.productId !== '' && !product
  const colors = resolveBannerSlotColors(slot, isDark, storeTheme)
  const previewTitle = slot.title || product?.name || 'Chưa chọn sản phẩm'

  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchWrapRef = useRef(null)

  const searchResults = useMemo(() => {
    if (!query.trim()) return []
    return filterCatalogProducts(catalog, query).slice(0, 8)
  }, [catalog, query])

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('pointerdown', handleClickOutside)
    return () => document.removeEventListener('pointerdown', handleClickOutside)
  }, [])

  function handleSelectProduct(item) {
    onChange({
      productId: String(item.id),
    })
    setQuery('')
    setShowDropdown(false)
    setIsSearching(false)
  }

  function handleClearProduct() {
    onChange({
      productId: '',
      title: '',
      note: '',
      bg: '',
      text: '',
      accent: '',
    })
    setQuery('')
    setShowDropdown(false)
    setIsSearching(false)
  }

  // Chế độ Thu gọn (Compact view: hiển thị thẻ hàng ngang nhỏ gọn có thumbnail, số thứ tự, tên sản phẩm, giá, trạng thái, nút sửa nhanh)
  if (!isExpanded) {
    return (
      <article
        id={`side-banner-slot-${side}-${index}`}
        className={'side-banner-slot side-banner-slot--compact' + (isHighlighted ? ' is-highlighted' : '')}
      >
        <div className="side-banner-compact-left">
          <span className="side-banner-compact-index">#{index + 1}</span>
          <div className="side-banner-compact-thumb">
            {product?.image ? (
              <img src={product.image} alt={product.name || ''} loading="lazy" />
            ) : (
              <span className="side-banner-compact-thumb-empty">{product ? '📦' : '—'}</span>
            )}
          </div>
          <div className="side-banner-compact-info">
            <strong title={slot.title || product?.name || 'Tự động khi lưu'}>
              {slot.title || product?.name || 'Chưa chọn riêng (tự động khi lưu)'}
            </strong>
            <span className="side-banner-compact-meta">
              {product ? (
                <>
                  {product.category ? product.category + ' · ' : ''}
                  <b style={{ color: 'var(--theme-accent-strong, #2f6847)' }}>{formatBannerPrice(product.price)}</b>
                </>
              ) : (
                'Tự động gán sản phẩm khi lưu'
              )}
            </span>
          </div>
        </div>

        <div className="side-banner-compact-right">
          <span className={'side-banner-badge' + (product ? ' is-customized' : ' is-empty')}>
            {product ? 'Đã tùy chỉnh' : slot.productId ? 'Mã: ' + slot.productId : 'Tự động khi lưu'}
          </span>

          {colors.isCustomized && (
            <span
              className="side-banner-color-indicator"
              title="Đã tùy chỉnh màu sắc riêng"
              style={{ background: colors.bg, borderColor: colors.border }}
            />
          )}

          <button
            type="button"
            className="side-banner-action-btn side-banner-action-btn--sm"
            onClick={onToggleExpand}
            title="Mở rộng chi tiết ô banner này để sửa tiêu đề, ghi chú, màu sắc..."
          >
            ✏️ Sửa nhanh
          </button>

          <button
            type="button"
            className="side-banner-action-btn side-banner-action-btn--sm"
            onClick={onOpenPicker}
            disabled={!catalogReady}
            title="Chọn nhanh sản phẩm khác từ danh mục"
          >
            📂 Chọn SP
          </button>

          {product && (
            <button
              type="button"
              className="side-banner-btn-tiny side-banner-btn-tiny--danger"
              onClick={handleClearProduct}
              title="Bỏ chọn để tự động điền"
            >
              ✕
            </button>
          )}
        </div>
      </article>
    )
  }

  // Chế độ Chi tiết (Expanded view: đầy đủ các trường nhập, thumbnail 72px và mini preview 72px)
  return (
    <article
      id={`side-banner-slot-${side}-${index}`}
      className={'side-banner-slot' + (isHighlighted ? ' is-highlighted' : '')}
    >
      <div className="side-banner-slot-head">
        <h4>{sideLabel} · Banner {index + 1}</h4>
        <div className="side-banner-slot-head-actions">
          <span className={'side-banner-badge' + (product ? ' is-customized' : ' is-empty')}>
            {product ? 'Đã tùy chỉnh' : slot.productId ? 'Mã: ' + slot.productId : 'Tự động khi lưu'}
          </span>
          <button
            type="button"
            className="side-banner-btn-tiny"
            onClick={onToggleExpand}
            title="Thu gọn thẻ này"
          >
            ⊟ Thu gọn
          </button>
        </div>
      </div>

      <div className="side-banner-thumb">
        {product?.image ? (
          <img src={product.image} alt={product.name || ''} loading="lazy" />
        ) : (
          <span className="side-banner-thumb-empty">
            {product ? 'Không có ảnh' : 'Chưa chọn sản phẩm (sẽ tự động điền)'}
          </span>
        )}
      </div>

      <p className="side-banner-product">
        {product ? (
          <>
            {product.name}
            {product.category ? ' · ' + product.category : ''}
            {formatBannerPrice(product.price) ? ' · ' + formatBannerPrice(product.price) : ''}
          </>
        ) : (
          'Chưa chọn riêng — hệ thống sẽ tự động gán sản phẩm khi lưu để không bị trống.'
        )}
      </p>

      {/* Giao diện tìm kiếm sản phẩm gõ chữ thuận tiện */}
      <div className="side-banner-search-container" ref={searchWrapRef}>
        <label>Sản phẩm banner</label>
        {product ? (
          <div className="side-banner-chosen-card">
            <div className="side-banner-chosen-details">
              {product.image && <img src={product.image} alt={product.name || ''} />}
              <div className="side-banner-chosen-text">
                <strong>{product.name}</strong>
                <span>{product.category ? product.category + ' · ' : ''}{formatBannerPrice(product.price)}</span>
              </div>
            </div>
            <div className="side-banner-chosen-actions">
              <button
                type="button"
                className="side-banner-btn-tiny"
                onClick={() => {
                  setIsSearching(true)
                  setShowDropdown(Boolean(query.trim()))
                }}
                title="Đổi sản phẩm"
              >
                🔍 Đổi
              </button>
              <button
                type="button"
                className="side-banner-btn-tiny side-banner-btn-tiny--danger"
                onClick={handleClearProduct}
                title="Bỏ chọn để tự động điền"
              >
                ✕
              </button>
            </div>
          </div>
        ) : null}

        {(!product || isSearching) && (
          <div className="side-banner-search-row">
            <div className="side-banner-search-input-wrap">
              <input
                type="text"
                placeholder="🔍 Gõ tìm sản phẩm (tên, danh mục, giá)..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setShowDropdown(true)
                }}
                onFocus={() => {
                  if (query.trim()) setShowDropdown(true)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setShowDropdown(false)
                }}
                disabled={!catalogReady}
              />
              {query && (
                <button
                  type="button"
                  className="side-banner-search-clear"
                  onClick={() => {
                    setQuery('')
                    setShowDropdown(false)
                  }}
                  aria-label="Xóa tìm kiếm"
                >
                  ✕
                </button>
              )}

              {showDropdown && searchResults.length > 0 && (
                <div className="side-banner-search-results">
                  {searchResults.map((item) => (
                    <button
                      key={String(item.id)}
                      type="button"
                      className="side-banner-search-item"
                      onClick={() => handleSelectProduct(item)}
                    >
                      {item.image ? (
                        <img src={item.image} alt={item.name || ''} />
                      ) : (
                        <div style={{ width: 34, height: 34, background: '#eee', borderRadius: 4 }} />
                      )}
                      <div className="side-banner-search-item-info">
                        <span className="side-banner-search-item-name">{item.name || String(item.id)}</span>
                        <span className="side-banner-search-item-meta">
                          {item.category ? item.category : ''} · {formatBannerPrice(item.price)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              className="side-banner-search-browse-btn"
              onClick={onOpenPicker}
              disabled={!catalogReady}
              title="Duyệt toàn bộ danh mục sản phẩm"
            >
              📂 Duyệt
            </button>

            {isSearching && product && (
              <button
                type="button"
                className="side-banner-btn-tiny"
                onClick={() => {
                  setIsSearching(false)
                  setShowDropdown(false)
                }}
              >
                Đóng
              </button>
            )}
          </div>
        )}

        {/* Dropdown HTML select chuẩn giữ khả năng truy cập tốt nhất */}
        <select
          value={slot.productId}
          disabled={!catalogReady}
          onChange={(event) => onChange({ productId: event.target.value })}
          aria-label={'Chọn sản phẩm cho ' + sideLabel + ' banner ' + (index + 1)}
          style={{ marginTop: '4px' }}
        >
          <option value="">-- Hoặc chọn nhanh từ danh sách --</option>
          {selectedMissing && <option value={slot.productId}>Sản phẩm đã chọn: {slot.productId}</option>}
          {catalog.map((item) => (
            <option key={String(item.id)} value={String(item.id)}>
              {item.name || String(item.id)}
              {item.category ? ' (' + item.category + ')' : ''}
              {formatBannerPrice(item.price) ? ' — ' + formatBannerPrice(item.price) : ''}
            </option>
          ))}
        </select>
      </div>

      <label>
        Tiêu đề banner
        <input
          type="text"
          maxLength="120"
          value={slot.title}
          placeholder={product?.name || 'Tiêu đề hiển thị trên banner'}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </label>

      <label>
        Ghi chú
        <textarea
          rows="2"
          maxLength="240"
          value={slot.note}
          placeholder="Ghi chú hiển thị trên banner (khuyến mãi, nổi bật...)"
          onChange={(event) => onChange({ note: event.target.value })}
        />
      </label>

      <div className="side-banner-colors">
        <SideBannerColorField label="Màu nền" value={slot.bg} onChange={(value) => onChange({ bg: value })} />
        <SideBannerColorField label="Màu chữ" value={slot.text} onChange={(value) => onChange({ text: value })} />
        <SideBannerColorField label="Màu nhấn" value={slot.accent} onChange={(value) => onChange({ accent: value })} />
      </div>

      <div
        className="side-banner-mini-preview"
        style={{
          background: colors.bg,
          color: colors.text,
          borderColor: colors.border,
        }}
      >
        <strong>{previewTitle}</strong>
        {product && <span>{formatBannerPrice(product.price)}</span>}
        <em
          style={{
            background: colors.accent,
            color: getContrastTextColor(colors.accent, isDark),
          }}
        >
          Xem
        </em>
      </div>
    </article>
  )
}

function SideBannerSyncColumn({ sideLabel, side, slots, catalog, onSelectSlot, isDark = false, storeTheme = null }) {
  return (
    <div className="side-banner-sync-column">
      <h4>
        <span>{sideLabel}</span>
        <span className="side-banner-sync-count">{slots.length} ô</span>
      </h4>
      {slots.map((slot, index) => {
        const product = sideBannerProduct(catalog, slot.productId)
        const { bg, text, border } = resolveBannerSlotColors(slot, isDark, storeTheme)
        return (
          <div
            key={sideLabel + '-' + index}
            role="button"
            tabIndex={0}
            className={'side-banner-sync-card' + (product ? '' : ' is-empty')}
            style={{ background: bg, color: text, borderColor: border }}
            onClick={() => onSelectSlot?.(side, index)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelectSlot?.(side, index)
              }
            }}
            title={`Bấm để cuộn và làm nổi bật ${sideLabel} banner ${index + 1}`}
          >
            <span className="side-banner-sync-card-index">{index + 1}</span>
            {product?.image ? (
              <img src={product.image} alt={product.name || ''} className="side-banner-sync-card-thumb" loading="lazy" />
            ) : (
              <span className="side-banner-sync-card-thumb-empty">{product ? '📦' : '—'}</span>
            )}
            <span className="side-banner-sync-card-name">{slot.title || product?.name || 'Tự động khi lưu'}</span>
            {product && <span className="side-banner-sync-card-price">{formatBannerPrice(product.price)}</span>}
          </div>
        )
      })}
    </div>
  )
}

function SideBannerPanel({
  config,
  catalog,
  catalogStatus,
  catalogError,
  busy,
  status,
  isDark = false,
  storeTheme = null,
  onRetryCatalog,
  onCountChange,
  onSlotChange,
  onAutoFillEmpty,
  onAutoFillAll,
  onSave,
}) {
  const catalogReady = catalogStatus === 'ready'
  const count = config.left.length
  const filled = (side) => config[side].filter((slot) => slot.productId !== '').length
  const leftFilled = filled('left')
  const rightFilled = filled('right')

  const [activeTab, setActiveTab] = useState('all') // 'all' | 'left' | 'right'
  const [modalSlot, setModalSlot] = useState(null) // { side, index, sideLabel }
  const [viewMode, setViewMode] = useState('expanded') // 'expanded' | 'compact'
  const [expandedSlots, setExpandedSlots] = useState({}) // { [`${side}-${index}`]: boolean }
  const [slotSearch, setSlotSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'customized' | 'empty'
  const [highlightedSlot, setHighlightedSlot] = useState(null)

  const totalBanners = count * 2
  const totalFilled = leftFilled + rightFilled

  function isSlotExpanded(side, index) {
    const key = `${side}-${index}`
    if (expandedSlots[key] !== undefined) {
      return expandedSlots[key]
    }
    return viewMode === 'expanded'
  }

  function toggleSlotExpand(side, index) {
    const key = `${side}-${index}`
    setExpandedSlots((prev) => ({
      ...prev,
      [key]: !isSlotExpanded(side, index),
    }))
  }

  function collapseAll() {
    setViewMode('compact')
    setExpandedSlots({})
  }

  function expandAll() {
    setViewMode('expanded')
    setExpandedSlots({})
  }

  function matchesFilter(slot, index) {
    const isSlotFilled = slot.productId !== ''
    if (statusFilter === 'customized' && !isSlotFilled) return false
    if (statusFilter === 'empty' && isSlotFilled) return false

    if (!slotSearch.trim()) return true
    const q = slotSearch.trim().toLowerCase()
    if (String(index + 1) === q || `#${index + 1}` === q) return true
    if (slot.title && slot.title.toLowerCase().includes(q)) return true
    if (slot.note && slot.note.toLowerCase().includes(q)) return true
    const product = sideBannerProduct(catalog, slot.productId)
    if (product) {
      if (product.name && product.name.toLowerCase().includes(q)) return true
      if (product.category && product.category.toLowerCase().includes(q)) return true
      if (String(product.id).includes(q)) return true
      if (String(product.price).includes(q)) return true
    }
    return false
  }

  function handleSelectSlotFromSync(side, index) {
    if (activeTab !== 'all' && activeTab !== side) {
      setActiveTab('all')
    }
    const slot = config[side]?.[index]
    if (slot && !matchesFilter(slot, index)) {
      setSlotSearch('')
      setStatusFilter('all')
    }
    const key = `${side}-${index}`
    setExpandedSlots((prev) => ({ ...prev, [key]: true }))
    setHighlightedSlot(key)

    setTimeout(() => {
      const el = document.getElementById(`side-banner-slot-${side}-${index}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.focus?.()
      }
    }, 60)

    setTimeout(() => {
      setHighlightedSlot((curr) => (curr === key ? null : curr))
    }, 2200)
  }

  const filteredSlots = useMemo(() => {
    return {
      left: config.left
        .map((slot, index) => ({ slot, index }))
        .filter(({ slot, index }) => matchesFilter(slot, index)),
      right: config.right
        .map((slot, index) => ({ slot, index }))
        .filter(({ slot, index }) => matchesFilter(slot, index)),
    }
  }, [config.left, config.right, catalog, slotSearch, statusFilter])

  const totalFilteredCount = filteredSlots.left.length + filteredSlots.right.length
  const isFilterActive = slotSearch.trim() !== '' || statusFilter !== 'all'

  return (
    <div className="side-banner-panel">
      <h3>Banner hai bên trang chủ</h3>
      <p>
        Số lượng banner mỗi bên hỗ trợ: <strong>0 banner</strong> (ẩn hoàn toàn) hoặc từ <strong>10 đến 20 banner mỗi bên</strong> (tổng cộng 20 đến 40 banner). Mỗi banner được tùy chỉnh sản phẩm, tiêu đề, ghi chú và màu sắc riêng.
        Nếu bạn chưa custom riêng cho từng banner, hệ thống sẽ <strong>tự động gán sản phẩm phù hợp khi lưu</strong> để không bao giờ bị lỗi để trống.
      </p>

      {/* Thanh công cụ số lượng & tự động điền */}
      <div className="side-banner-count-shared">
        <label>
          Số lượng banner mỗi bên
          <select
            value={count}
            onChange={(event) => onCountChange(Number(event.target.value))}
            aria-label="Số lượng banner mỗi bên"
          >
            {SIDE_BANNER_COUNT_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value === 0
                  ? '0 banner mỗi bên (Tổng 2 bên: 0 banner)'
                  : `${value} banner mỗi bên (Tổng 2 bên: ${value * 2} banner)`}
              </option>
            ))}
          </select>
        </label>

        <div className="side-banner-toolbar-actions">
          <button
            type="button"
            className="side-banner-action-btn side-banner-action-btn--primary"
            onClick={onAutoFillEmpty}
            disabled={!catalogReady || count === 0}
            title="Tự động gán sản phẩm cho tất cả banner đang để trống"
          >
            ⚡ Tự động điền banner trống
          </button>
          <button
            type="button"
            className="side-banner-action-btn"
            onClick={onAutoFillAll}
            disabled={!catalogReady || count === 0}
            title="Làm mới và tự động gán toàn bộ banner từ danh mục"
          >
            ↻ Điền tự động lại tất cả
          </button>
        </div>

        <p>
          Bên trái {leftFilled}/{count} đã chọn · Bên phải {rightFilled}/{count} đã chọn · Tổng: {totalFilled}/{totalBanners}
        </p>
      </div>

      {catalogStatus === 'loading' && <p role="status">Đang tải danh mục sản phẩm…</p>}
      {catalogStatus === 'error' && (
        <p role="alert">
          Không tải được danh mục sản phẩm: {catalogError}{' '}
          <button type="button" onClick={onRetryCatalog}>
            Thử lại
          </button>
        </p>
      )}
      {catalogStatus === 'empty' && (
        <p role="status">
          Danh mục sản phẩm đang trống, chưa chọn được sản phẩm cho banner.{' '}
          <button type="button" onClick={onRetryCatalog}>
            Tải lại
          </button>
        </p>
      )}

      {/* Xem trước đồng bộ hai bên */}
      {count === 0 ? (
        <div className="side-banner-empty-preview" role="status" style={{ padding: '24px', textAlign: 'center', background: 'var(--surfaceAlt, #f0f4f1)', borderRadius: '8px', border: '1px dashed var(--border, #ccc)', margin: '16px 0' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>🚫 Đang chọn: 0 banner mỗi bên (Tổng 2 bên: 0 banner)</p>
          <p style={{ margin: '8px 0 0', color: 'var(--muted, #666)', fontSize: '0.9rem' }}>
            Banner hai bên trang chủ sẽ được ẩn hoàn toàn trên giao diện cửa hàng khi bạn bấm Lưu cấu hình banner.
          </p>
        </div>
      ) : (
        <div className="side-banner-sync-wrapper">
          <div className="side-banner-sync" aria-label="Xem trước đồng bộ hai bên">
            <SideBannerSyncColumn
              sideLabel="Bên trái"
              side="left"
              slots={config.left}
              catalog={catalog}
              onSelectSlot={handleSelectSlotFromSync}
              isDark={isDark}
              storeTheme={storeTheme}
            />
            <div className="side-banner-sync-sale" aria-label="Khe giảm giá ở giữa">
              <span>Đang giảm giá</span>
            </div>
            <SideBannerSyncColumn
              sideLabel="Bên phải"
              side="right"
              slots={config.right}
              catalog={catalog}
              onSelectSlot={handleSelectSlotFromSync}
              isDark={isDark}
              storeTheme={storeTheme}
            />
          </div>
          <p className="side-banner-sync-note">
            💡 <strong>Mẹo:</strong> Bấm vào bất kỳ thẻ xem trước nào ở trên để cuộn và làm nổi bật ngay ô banner đó. Khe ở giữa là khu vực “Đang giảm giá” ở trang chủ.
          </p>
        </div>
      )}

      {/* Thanh bộ lọc & Tìm kiếm nhanh slot & Chế độ xem */}
      {count > 0 && (
        <div className="side-banner-filter-bar">
          <div className="side-banner-filter-search-wrap">
            <input
              type="text"
              className="side-banner-filter-search"
              placeholder="🔍 Tìm nhanh slot (tên sản phẩm, tiêu đề, số #)..."
              value={slotSearch}
              onChange={(e) => setSlotSearch(e.target.value)}
              aria-label="Tìm kiếm slot banner"
            />
            {slotSearch && (
              <button
                type="button"
                className="side-banner-filter-clear"
                onClick={() => setSlotSearch('')}
                aria-label="Xóa tìm kiếm"
              >
                ✕
              </button>
            )}
          </div>

          <div className="side-banner-filter-chips" role="group" aria-label="Bộ lọc trạng thái">
            <button
              type="button"
              className={'side-banner-chip' + (statusFilter === 'all' ? ' is-active' : '')}
              onClick={() => setStatusFilter('all')}
            >
              Tất cả ({totalBanners})
            </button>
            <button
              type="button"
              className={'side-banner-chip' + (statusFilter === 'customized' ? ' is-active' : '')}
              onClick={() => setStatusFilter('customized')}
            >
              ✓ Đã chọn ({totalFilled})
            </button>
            <button
              type="button"
              className={'side-banner-chip' + (statusFilter === 'empty' ? ' is-active' : '')}
              onClick={() => setStatusFilter('empty')}
            >
              ⚡ Chưa chọn ({totalBanners - totalFilled})
            </button>
          </div>

          <div className="side-banner-view-mode-group" role="group" aria-label="Chế độ hiển thị danh sách">
            <button
              type="button"
              className={'side-banner-action-btn' + (viewMode === 'compact' ? ' side-banner-action-btn--primary' : '')}
              onClick={collapseAll}
              title="Chuyển tất cả banner sang dạng thẻ hàng ngang thu gọn"
            >
              ⊟ Thu gọn tất cả
            </button>
            <button
              type="button"
              className={'side-banner-action-btn' + (viewMode === 'expanded' ? ' side-banner-action-btn--primary' : '')}
              onClick={expandAll}
              title="Mở rộng tất cả banner để chỉnh sửa toàn bộ chi tiết"
            >
              ⊞ Mở rộng tất cả
            </button>
          </div>
        </div>
      )}

      {/* Thông tin kết quả lọc khi đang tìm kiếm */}
      {isFilterActive && count > 0 && (
        <div className="side-banner-filter-summary">
          <span>
            Đang lọc: hiển thị <strong>{totalFilteredCount}</strong> / {totalBanners} banner
          </span>
          <button
            type="button"
            className="side-banner-btn-tiny"
            onClick={() => {
              setSlotSearch('')
              setStatusFilter('all')
            }}
          >
            ✕ Bỏ lọc
          </button>
        </div>
      )}

      {/* Chuyển đổi tab xem bên trái / bên phải / cả hai */}
      <div className="side-banner-view-tabs" role="tablist" aria-label="Lọc bên hiển thị">
        <button
          type="button"
          className={activeTab === 'all' ? 'is-active' : ''}
          onClick={() => setActiveTab('all')}
        >
          Toàn bộ 2 bên ({totalBanners} banner)
        </button>
        <button
          type="button"
          className={activeTab === 'left' ? 'is-active' : ''}
          onClick={() => setActiveTab('left')}
        >
          ◀ Bên trái ({leftFilled}/{count} đã tùy chỉnh)
        </button>
        <button
          type="button"
          className={activeTab === 'right' ? 'is-active' : ''}
          onClick={() => setActiveTab('right')}
        >
          Bên phải ▶ ({rightFilled}/{count} đã tùy chỉnh)
        </button>
      </div>

      {/* Cột Banner Trái & Phải */}
      {[
        ['left', 'Bên trái'],
        ['right', 'Bên phải'],
      ]
        .filter(([side]) => activeTab === 'all' || activeTab === side)
        .map(([side, sideLabel]) => {
          const items = filteredSlots[side]
          return (
            <fieldset key={side} className="side-banner-column">
              <legend>
                {sideLabel} · {filled(side)}/{config[side].length} banner đã chọn sản phẩm riêng
                {isFilterActive && ` (Khớp lọc: ${items.length})`}
              </legend>
              {items.length === 0 ? (
                <p className="side-banner-empty-filter" style={{ textAlign: 'center', padding: '24px 0', color: 'var(--theme-muted)' }}>
                  Không có banner nào ở {sideLabel.toLowerCase()} khớp với bộ lọc hiện tại.
                </p>
              ) : (
                <div className={'side-banner-slots' + (viewMode === 'compact' ? ' is-compact' : '')}>
                  {items.map(({ slot, index }) => (
                    <SideBannerSlot
                      key={side + '-' + index}
                      sideLabel={sideLabel}
                      side={side}
                      index={index}
                      slot={slot}
                      catalog={catalog}
                      catalogReady={catalogReady}
                      isDark={isDark}
                      storeTheme={storeTheme}
                      isExpanded={isSlotExpanded(side, index)}
                      isHighlighted={highlightedSlot === `${side}-${index}`}
                      onToggleExpand={() => toggleSlotExpand(side, index)}
                      onChange={(patch) => onSlotChange(side, index, patch)}
                      onOpenPicker={() => setModalSlot({ side, index, sideLabel })}
                    />
                  ))}
                </div>
              )}
            </fieldset>
          )
        })}

      {/* Nút lưu banner */}
      <div className="side-banner-save">
        <button type="button" onClick={onSave} disabled={busy}>
          {busy ? 'Đang lưu…' : 'Lưu banner'}
        </button>
        <p role="status">
          Bên trái {leftFilled}/{count} đã chọn sản phẩm · Bên phải {rightFilled}/{count} đã chọn · Khi lưu hệ thống sẽ tự động điền các ô chưa chọn.
        </p>
        {status && <p role="status" className="side-banner-save-status">{status}</p>}
      </div>

      {/* Modal Duyệt sản phẩm */}
      {modalSlot && (
        <ProductPickerModal
          activeSlot={modalSlot}
          catalog={catalog}
          onClose={() => setModalSlot(null)}
          onSelect={(item) => {
            onSlotChange(modalSlot.side, modalSlot.index, {
              productId: String(item.id),
            })
          }}
        />
      )}
    </div>
  )
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
  const [sideBanners, setSideBanners] = useState(() => editorSideBanners(null))
  const [catalog, setCatalog] = useState([])
  const [catalogStatus, setCatalogStatus] = useState('idle')
  const [catalogError, setCatalogError] = useState('')

  useEffect(() => {
    apiJson('/api/admin/appearance')
      .then((payload) => {
        setForm((current) => ({ ...current, ...(payload.appearance || {}) }))
        setSideBanners(editorSideBanners(payload.appearance?.sideBanners))
        setStoreTheme(normalizeTheme(payload.theme || payload.appearance?.theme))
        setAdminTheme(normalizeTheme(payload.adminTheme || payload.theme || payload.appearance?.theme))
      })
      .catch((error) => setStatus(error.message))
  }, [])

  useEffect(() => {
    if (catalogStatus !== 'loading') return undefined
    let cancelled = false
    apiJson('/api/storefront/catalog')
      .then((payload) => {
        if (cancelled) return
        const products = Array.isArray(payload?.products)
          ? payload.products.filter((product) => product && String(product.id ?? '') !== '')
          : []
        setCatalog(products)
        setCatalogStatus(products.length ? 'ready' : 'empty')
      })
      .catch((error) => {
        if (cancelled) return
        setCatalogError(error.message)
        setCatalogStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [catalogStatus])

  const activeTheme = target === 'admin' ? adminTheme : storeTheme
  const setActiveTheme = (updater) => {
    if (target === 'admin') setAdminTheme(updater)
    else setStoreTheme(updater)
  }

  function choosePreset(id) {
    setActiveTheme(() => presetTheme(id))
    setStatus('Đã nạp mẫu giao diện ' + presetLabels[id] + ' cho ' + (target === 'admin' ? 'Quản trị' : 'Store') + '.')
  }

  function setColor(key, value) {
    setActiveTheme((current) => updateThemeValue(current, mode, 'colors', key, value))
  }

  function setRadius(key, value) {
    setActiveTheme((current) => updateThemeValue(current, mode, 'radius', key, Number(value)))
  }

  function setShadow(value) {
    setActiveTheme((current) => ({ ...current, [mode]: { ...current[mode], shadowStrength: Number(value) } }))
  }

  async function saveWithData(bannersToSave) {
    setBusy(true)
    setStatus('')
    try {
      const payload = await apiJson('/api/admin/appearance', {
        method: 'PUT',
        headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify({
          ...form,
          sideBanners: serializeSideBanners(bannersToSave, catalog),
          theme: storeTheme,
          adminTheme,
        }),
      })
      setForm((current) => ({ ...current, ...(payload.appearance || {}) }))
      setSideBanners(editorSideBanners(payload.appearance?.sideBanners))
      setStoreTheme(normalizeTheme(payload.theme || payload.appearance?.theme))
      setAdminTheme(normalizeTheme(payload.adminTheme || payload.theme || payload.appearance?.theme))
      setStatus('Đã lưu giao diện Store, giao diện Quản trị và cấu hình banner thành công!')
    } catch (error) {
      setStatus(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function save(event) {
    event?.preventDefault?.()
    if (sideBanners.count === 0 || sideBanners.left.length === 0) {
      const zeroBanners = { version: 1, count: 0, left: [], right: [] }
      setSideBanners(zeroBanners)
      await saveWithData(zeroBanners)
      return
    }
    const autoFilled = autoFillSideBanners(sideBanners, catalog, sideBanners.left.length)
    setSideBanners(autoFilled)
    await saveWithData(autoFilled)
  }

  function openBannerTab() {
    setTarget('banners')
    if (catalogStatus === 'idle') setCatalogStatus('loading')
  }

  function retryCatalog() {
    setCatalogError('')
    setCatalogStatus('loading')
  }

  function changeSideBannerCount(count) {
    if (count === 0) {
      setSideBanners({ version: 1, count: 0, left: [], right: [] })
      return
    }
    setSideBanners((current) => {
      if (catalog && catalog.length > 0) {
        return autoFillSideBanners(current, catalog, count)
      }
      return {
        version: 1,
        left: padSideBannerList(current.left, count),
        right: padSideBannerList(current.right, count),
      }
    })
  }

  function handleAutoFillEmpty() {
    if (!catalog || catalog.length === 0 || sideBanners.left.length === 0) return
    setSideBanners((current) => autoFillSideBanners(current, catalog, current.left.length))
    setStatus('Đã tự động điền sản phẩm cho các ô banner đang trống.')
  }

  function handleAutoFillAll() {
    if (!catalog || catalog.length === 0 || sideBanners.left.length === 0) return
    const resetLeft = padSideBannerList([], sideBanners.left.length)
    const resetRight = padSideBannerList([], sideBanners.right.length)
    setSideBanners(autoFillSideBanners({ version: 1, left: resetLeft, right: resetRight }, catalog, sideBanners.left.length))
    setStatus('Đã tự động custom lại toàn bộ banner từ danh mục sản phẩm.')
  }

  function saveBanners() {
    if (sideBanners.count === 0 || sideBanners.left.length === 0) {
      const zeroBanners = { version: 1, count: 0, left: [], right: [] }
      setSideBanners(zeroBanners)
      saveWithData(zeroBanners)
      return
    }
    const autoFilled = autoFillSideBanners(sideBanners, catalog, sideBanners.left.length)
    setSideBanners(autoFilled)
    saveWithData(autoFilled)
  }

  function changeSideBannerSlot(side, index, patch) {
    setSideBanners((current) => ({
      ...current,
      [side]: current[side].map((slot, slotIndex) => (slotIndex === index ? { ...slot, ...patch } : slot)),
    }))
  }

  function resetSystem() {
    setActiveTheme(() => normalizeTheme(DEFAULT_THEME))
    setStatus('Đã khôi phục mặc định hệ thống cho ' + (target === 'admin' ? 'Quản trị' : 'Store') + '. Hãy bấm Lưu giao diện để ghi lại.')
  }

  function openPreview(url) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const variant = activeTheme[mode]
  const isDark = mode === 'dark' || (typeof document !== 'undefined' && document.documentElement.getAttribute('data-admin-theme') === 'dark')

  return (
    <section className="admin-module-card theme-editor">
      <div className="admin-module-head">
        <div>
          <p className="admin-eyebrow">CHỈNH GIAO DIỆN</p>
          <h2>Giao diện cửa hàng và quản trị</h2>
          <p>Điều chỉnh riêng giao diện cửa hàng và trang quản trị.</p>
        </div>
        <span className="admin-preview-badge">
          {activeTheme.presetId === 'forest' ? 'Rừng xanh mặc định' : 'Tùy chỉnh'}
        </span>
      </div>

      <div className="theme-editor-toolbar">
        <div className="theme-target-tabs" role="tablist" aria-label="Chọn nơi áp dụng">
          <button
            type="button"
            className={target === 'store' ? 'is-active' : ''}
            onClick={() => setTarget('store')}
            role="tab"
            aria-selected={target === 'store'}
          >
            Cửa hàng
          </button>
          <button
            type="button"
            className={target === 'admin' ? 'is-active' : ''}
            onClick={() => setTarget('admin')}
            role="tab"
            aria-selected={target === 'admin'}
          >
            Quản trị
          </button>
          <button
            type="button"
            className={'theme-target-tab--banners' + (target === 'banners' ? ' is-active' : '')}
            onClick={openBannerTab}
            role="tab"
            aria-selected={target === 'banners'}
          >
            Banner
          </button>
        </div>

        <div className="theme-mode-tabs" role="tablist" aria-label="Chọn chế độ sáng hoặc tối">
          {THEME_MODES.map((item) => (
            <button
              key={item}
              type="button"
              className={mode === item ? 'is-active' : ''}
              onClick={() => setMode(item)}
              role="tab"
              aria-selected={mode === item}
            >
              {item === 'light' ? 'Sáng' : 'Tối'}
            </button>
          ))}
        </div>

        <div className="theme-preset-list" aria-label="Mẫu giao diện">
          {THEME_PRESET_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={activeTheme.presetId === id ? 'is-active' : ''}
              onClick={() => choosePreset(id)}
            >
              {presetLabels[id]}
            </button>
          ))}
        </div>
      </div>

      {target === 'banners' ? (
        <SideBannerPanel
          config={sideBanners}
          catalog={catalog}
          catalogStatus={catalogStatus}
          catalogError={catalogError}
          busy={busy}
          status={status}
          isDark={isDark}
          storeTheme={storeTheme}
          onRetryCatalog={retryCatalog}
          onCountChange={changeSideBannerCount}
          onSlotChange={changeSideBannerSlot}
          onAutoFillEmpty={handleAutoFillEmpty}
          onAutoFillAll={handleAutoFillAll}
          onSave={saveBanners}
        />
      ) : (
        <div className="theme-editor-layout">
          <div>
            {target === 'admin' ? (
              <AdminThemePreview theme={activeTheme} mode={mode} />
            ) : (
              <ThemePreview theme={activeTheme} mode={mode} previewMode={previewMode} form={form} />
            )}
            <div className="theme-preview-actions">
              <button
                type="button"
                onClick={() => openPreview(import.meta.env?.VITE_STOREFRONT_URL || 'http://localhost:5173/')}
              >
                Xem trước cửa hàng
              </button>
              <button type="button" onClick={() => openPreview(window.location.origin)}>
                Xem trước Quản trị
              </button>
            </div>
            {target === 'store' && (
              <div className="appearance-preview-tabs" role="tablist" aria-label="Khung xem trước">
                {[
                  ['home', 'Trang chủ'],
                  ['catalog', 'Hàng hóa'],
                  ['footer', 'Chân trang'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={previewMode === id ? 'is-active' : ''}
                    onClick={() => setPreviewMode(id)}
                    role="tab"
                    aria-selected={previewMode === id}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="theme-controls">
            <fieldset>
              <legend>
                {target === 'admin' ? 'Màu Quản trị ' : 'Màu Store '}
                {mode === 'light' ? 'Sáng' : 'Tối'}
              </legend>
              <div className="theme-color-grid">
                {colorKeys.map((key) => (
                  <ThemeColorField
                    key={key}
                    label={colorLabels[key]}
                    value={variant.colors[key]}
                    onChange={(value) => setColor(key, value)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>Bo góc và bóng đổ</legend>
              {[
                ['card', 'Bo góc thẻ'],
                ['control', 'Bo góc nút'],
                ['panel', 'Bo góc bảng'],
              ].map(([key, label]) => (
                <label className="theme-range-row" key={key}>
                  <span>
                    {label} <b>{variant.radius[key]}px</b>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="24"
                    value={variant.radius[key]}
                    onChange={(event) => setRadius(key, event.target.value)}
                  />
                </label>
              ))}
              <label className="theme-range-row">
                <span>
                  Độ mạnh bóng đổ <b>{variant.shadowStrength}</b>
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={variant.shadowStrength}
                  onChange={(event) => setShadow(event.target.value)}
                />
              </label>
            </fieldset>
          </div>
        </div>
      )}

      <form className="appearance-controls theme-legacy-controls" onSubmit={save}>
        <h3>Nội dung cửa hàng</h3>
        {legacyFields.map(([key]) => (
          <label key={key}>
            {contentLabels[key]}
            {key.toLowerCase().includes('description') || key.toLowerCase().includes('footer') ? (
              <textarea
                rows="2"
                maxLength="240"
                value={form[key] || ''}
                onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
              />
            ) : (
              <input
                type={key === 'contactEmail' ? 'email' : 'text'}
                maxLength="240"
                value={form[key] || ''}
                onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
              />
            )}
          </label>
        ))}
        <div className="theme-editor-actions">
          <button type="submit" disabled={busy}>
            Lưu giao diện
          </button>
          <button type="button" onClick={() => choosePreset(activeTheme.presetId)}>
            Khôi phục mẫu giao diện
          </button>
          <button type="button" onClick={resetSystem}>
            Khôi phục mặc định hệ thống
          </button>
        </div>
        {status && <small role="status">{status}</small>}
      </form>
    </section>
  )
}
