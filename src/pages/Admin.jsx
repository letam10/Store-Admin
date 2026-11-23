/*
  FILE NOTE
  - Mục đích: Màn hình điều phối admin, hiển thị logo thương hiệu OmniCart (ảnh vuông), session, module, dashboard, cài đặt AI context size và chuyển đổi Tự động hóa đăng bài Mạng Xã Hội.
  - Liên kết trực tiếp: ../api/chat.js, ./AdminModules.jsx, ./AdminSocialAutomation.jsx, ../services/adminState.js
  - Vùng ảnh hưởng khi sửa: Giao diện quản trị, logo thương hiệu admin, cài đặt ngữ cảnh AI, session, chat hỗ trợ admin và tab đăng bài mạng xã hội.
*/
import { useEffect, useMemo, useRef, useState } from 'react'
import { canOpenModule, landingModule } from '../services/adminAccess'
import { apiJson, streamChat } from '../api/chat'
import { createRequestGate } from '../api/requestGate'
import { adminConversationKey } from '../services/adminState'
import { hideSourceDisclosure, mapServerMessages } from '../services/customerSupportState'
import AdminModule from './AdminModules'
import AdminSocialAutomation from './AdminSocialAutomation'
import { adminModules } from '../data/adminModuleData'
import { compactLabel, thinkingLabel } from '../services/vietnameseLabels'
import { listenAdminNotifications } from '../services/adminNotifications'
import { installVietnameseValidation } from '../services/formValidation'
import { normalizeSearch } from '../services/storefrontState'
import { DEFAULT_THEME, THEME_MODES, normalizeTheme, themeVariables } from '../../shared/theme.js'
import AiMarkdown from '../components/ui/AiMarkdown'
import DropdownMenu from '../components/ui/DropdownMenu'
import OperationalExportButton from '../components/ui/OperationalExportButton'
import './Admin.css'
import './AdminPolish.css'
import './AdminTheme.css'
import './AdminLayout.css'
import './AdminSocialAutomation.css'

const moduleGroups = [
  { title: 'Tổng quan', ids: ['dashboard', 'customer-orders', 'statistics', 'ai-local'] },
  { title: 'Hàng hóa & cửa hàng', ids: ['products', 'product-views', 'inventory', 'logistics', 'appearance', 'returns'] },
  { title: 'Khách hàng', ids: ['customers', 'favorites', 'reviews', 'rewards-wheel', 'support'] },
  { title: 'Vận hành', ids: ['order-types', 'staff', 'overtime'] },
]
const moduleById = new Map(adminModules.map((entry) => [entry[0], entry]))

// Chức năng localId: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
function localId() {
  return globalThis.crypto?.randomUUID?.() || String(Date.now()) + '-' + String(Math.random())
}

// Chức năng businessToday: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
function businessToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

// Chức năng formatMoney: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0)) + ' ₫'
}


// Chức năng Admin: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
export default function Admin() {
  const today = useMemo(() => businessToday(), [])
  const [theme, setTheme] = useState(() => THEME_MODES.includes(localStorage.getItem('store_admin_theme')) ? localStorage.getItem('store_admin_theme') : 'light')
  const [adminThemeConfig, setAdminThemeConfig] = useState(() => normalizeTheme(DEFAULT_THEME))
  const [language, setLanguage] = useState(() => localStorage.getItem('store_admin_language') || 'vi')
  useEffect(() => installVietnameseValidation(language), [language])
  const [session, setSession] = useState(null)
  const [credentials, setCredentials] = useState({ username: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [pageError, setPageError] = useState('')
  const [settings, setSettings] = useState(null)
  const [contextSize, setContextSize] = useState(16384)
  const [thinkingEnabled, setThinkingEnabled] = useState(false)
  const [thinkingMode, setThinkingMode] = useState('off')
  const [messages, setMessages] = useState([])
  const [conversationId, setConversationId] = useState('')
  const [draft, setDraft] = useState('')
  const [copiedMsgId, setCopiedMsgId] = useState('')
  const adminQuickPrompts = [
    'Sản phẩm trong các đơn hàng gần nhất là gì?',
    'Top sản phẩm được mua nhiều nhất?',
    'Sản phẩm nào sắp hết tồn kho?',
    'Tóm tắt doanh thu tháng này và hôm nay'
  ]

  function startNewAdminChat() {
    gateRef.current.cancel()
    if (session?.username) sessionStorage.removeItem(adminConversationKey(session.username))
    setMessages([])
    setConversationId('')
    setCompactStatus('not_needed')
    setBusy(false)
    setActivity('')
    chatInputRef.current?.focus()
  }

  async function copyChatReply(msg) {
    try {
      await navigator.clipboard.writeText(hideSourceDisclosure(msg.content))
      setCopiedMsgId(msg.id)
      setTimeout(() => setCopiedMsgId(''), 2000)
    } catch (_) {}
  }
  const [busy, setBusy] = useState(false)
  const [activity, setActivity] = useState('')
  const [compactStatus, setCompactStatus] = useState('not_needed')
  const [report, setReport] = useState(null)
  const [range, setRange] = useState({ from: today.slice(0, 8) + '01', to: today })
  const [selectedModule, setActiveModule] = useState('dashboard')
  const [aiWorkspaceTab, setAiWorkspaceTab] = useState('chat')
  const activeModule = landingModule(session?.role, selectedModule)
  const [adminSearch, setAdminSearch] = useState('')
  const [realtimeEvents, setRealtimeEvents] = useState([])
  const logRef = useRef(null)
  const gateRef = useRef(createRequestGate())
  const loadEpochRef = useRef(0)
  const restoreEpochRef = useRef(0)
  const statsEpochRef = useRef(0)
  const settingsEpochRef = useRef(0)
  const sessionProbeRef = useRef(0)
  const adminSearchRef = useRef(null)
  const chatInputRef = useRef(null)

  useEffect(() => {
    if (!session?.authenticated || !session.csrfToken) return undefined
    const controller = new AbortController()
    const heartbeat = () => {
      if (document.visibilityState !== 'visible') return
      apiJson('/api/admin/presence', { method: 'POST', headers: { 'x-csrf-token': session.csrfToken }, signal: controller.signal })
        .catch(() => { /* Mất kết nối sẽ tự hết trạng thái online sau 90 giây. */ })
    }
    heartbeat()
    const timer = setInterval(heartbeat, 30000)
    document.addEventListener('visibilitychange', heartbeat)
    return () => {
      clearInterval(timer)
      controller.abort()
      document.removeEventListener('visibilitychange', heartbeat)
    }
  }, [session?.authenticated, session?.csrfToken])

  useEffect(() => {
    document.documentElement.dataset.adminTheme = theme === 'dark' ? 'dark' : 'light'
    Object.entries(themeVariables(adminThemeConfig, theme)).forEach(([name, value]) => document.documentElement.style.setProperty(name, value))
    localStorage.setItem('store_admin_theme', theme === 'dark' ? 'dark' : 'light')
  }, [theme, adminThemeConfig])

  useEffect(() => {
    document.documentElement.lang = language === 'en' ? 'en' : 'vi'
    localStorage.setItem('store_admin_language', language === 'en' ? 'en' : 'vi')
  }, [language])

  const copy = language === 'en' ? {
    login: 'Sign in', account: 'Account', password: 'Password', signOut: 'Sign out',
    backStore: '← Back to Store', adminOnly: 'Backend authentication is required before admin data is opened.',
    wrongLogin: 'Invalid username or password.', searching: 'Search admin modules…', local: '● Local system',
    themeLight: 'Light mode', themeDark: 'Dark mode', language: 'Language',
  } : {
    login: 'Đăng nhập', account: 'Tài khoản', password: 'Mật khẩu', signOut: 'Đăng xuất',
    backStore: '← Quay lại Store', adminOnly: 'Máy chủ phải xác thực trước khi mở dữ liệu quản trị.',
    wrongLogin: 'Sai tài khoản hoặc mật khẩu.', searching: 'Tìm mục quản trị…', local: '● Hệ thống cục bộ',
    themeLight: 'Giao diện sáng', themeDark: 'Giao diện tối', language: 'Ngôn ngữ',
  }

  // Chức năng ThemeLanguageControls: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
  function ThemeLanguageControls({ compact = false, showTheme = true }) {
    return <div className={'admin-preferences' + (compact ? ' admin-preferences--compact' : '')}>
      <label className="admin-language-control"><span className="sr-only">{copy.language}</span><DropdownMenu value={language} options={[['vi', 'VI'], ['en', 'EN']]} onChange={setLanguage} ariaLabel={copy.language} /></label>
      {showTheme && <button type="button" className="admin-theme-toggle" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? copy.themeLight : copy.themeDark} title={theme === 'dark' ? copy.themeLight : copy.themeDark}>{theme === 'dark' ? '☀' : '☾'}<span>{language === 'en' ? (theme === 'dark' ? 'Light' : 'Dark') : (theme === 'dark' ? 'Sáng' : 'Tối')}</span></button>}
    </div>
  }

  // Chức năng clearSensitiveUi: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
  function clearSensitiveUi({ removeStorageFor = '' } = {}) {
    gateRef.current.cancel()
    loadEpochRef.current += 1
    restoreEpochRef.current += 1
    statsEpochRef.current += 1
    settingsEpochRef.current += 1
    if (removeStorageFor) sessionStorage.removeItem(adminConversationKey(removeStorageFor))
    setSettings(null)
    setContextSize(16384)
    setThinkingEnabled(false)
    setThinkingMode('off')
    setMessages([])
    setConversationId('')
    setDraft('')
    setBusy(false)
    setActivity('')
    setCompactStatus('not_needed')
    setReport(null)
    setRealtimeEvents([])
    setPageError('')
  }

  // Chức năng expireSession: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
  function expireSession() {
    const username = session?.username || ''
    clearSensitiveUi({ removeStorageFor: username })
    setSession(false)
  }

  useEffect(() => {
    let disposed = false
    const gate = gateRef.current
    const probe = ++sessionProbeRef.current
    apiJson('/api/admin/session')
      .then((payload) => { if (!disposed && probe === sessionProbeRef.current) setSession(payload) })
      .catch(() => { if (!disposed && probe === sessionProbeRef.current) setSession(false) })
    return () => { disposed = true; gate.cancel(); loadEpochRef.current += 1 }
  }, [])

  useEffect(() => {
    // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
    if (!session?.authenticated) return undefined
    clearSensitiveUi()
    const epoch = ++loadEpochRef.current
    const key = adminConversationKey(session.username)
    const settingsEpoch = ++settingsEpochRef.current
    const restoreEpoch = ++restoreEpochRef.current
    const reportEpoch = statsEpochRef.current

    if (session.role === 'admin') apiJson('/api/admin/appearance')
      .then((payload) => {
        const nextTheme = normalizeTheme(payload.adminTheme || payload.theme || payload.appearance?.theme)
        setAdminThemeConfig(nextTheme)
        if (!localStorage.getItem('store_admin_theme')) setTheme(nextTheme.defaultMode)
      })
      .catch(() => {})
      .catch((error) => {
        if (epoch !== loadEpochRef.current || settingsEpoch !== settingsEpochRef.current) return
        // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
        if (error.code === 'UNAUTHENTICATED') expireSession()
        else setPageError('Không tải được cấu hình quản trị.')
      })

    const saved = sessionStorage.getItem(key)
    if (saved && session.role === 'admin') {
      apiJson('/api/admin/conversations/' + encodeURIComponent(saved))
        .then((payload) => {
          if (epoch !== loadEpochRef.current || restoreEpoch !== restoreEpochRef.current || gateRef.current.locked) return
          setConversationId(payload.conversationId)
          setCompactStatus(payload.compactStatus)
          setMessages(mapServerMessages(payload.messages))
          const lastReport = [...payload.messages].reverse().find((message) => message.report)?.report
          if (lastReport && statsEpochRef.current === reportEpoch) setReport(lastReport)
        })
        .catch((error) => {
          if (epoch !== loadEpochRef.current || restoreEpoch !== restoreEpochRef.current || gateRef.current.locked) return
          sessionStorage.removeItem(key)
          // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
          if (error.code === 'UNAUTHENTICATED') expireSession()
        })
    }
    return () => { loadEpochRef.current += 1 }
  // Session identity is the lifecycle boundary for all private UI data.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.authenticated, session?.username, session?.role])

  useEffect(() => {
    if (!session?.authenticated) return undefined
    try {
      return listenAdminNotifications(item => setRealtimeEvents(current =>
        [item, ...current.filter(previous => previous.id !== item.id)].slice(0, 4)))
    } catch { return undefined }
  }, [session?.authenticated, session?.role])

  useEffect(() => {
    if (!session?.authenticated || activeModule !== 'ai-local') return undefined
    const epoch = loadEpochRef.current
    const settingsEpoch = ++settingsEpochRef.current
    apiJson('/api/admin/settings')
      .then((payload) => {
        if (epoch !== loadEpochRef.current || settingsEpoch !== settingsEpochRef.current) return
        setSettings(payload)
        setContextSize(payload.contextSize)
        setThinkingEnabled(payload.thinking !== false)
        setThinkingMode(payload.thinkingMode || 'medium')
      })
      .catch((error) => {
        if (epoch !== loadEpochRef.current || settingsEpoch !== settingsEpochRef.current) return
        if (error.code === 'UNAUTHENTICATED') expireSession()
        else setPageError('Không tải được cấu hình AI cục bộ.')
      })
    return () => { settingsEpochRef.current += 1 }
  }, [session?.authenticated, activeModule]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [messages, activity])

  useEffect(() => {
    // Chức năng onShortcut: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
    const onShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase('en') === 'k') {
        event.preventDefault()
        adminSearchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [])


  // Chức năng login: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
  async function login(event) {
    event.preventDefault()
    setLoginError('')
    clearSensitiveUi()
    const probe = ++sessionProbeRef.current
    const epoch = loadEpochRef.current
    try {
      const payload = await apiJson('/api/admin/login', { method: 'POST', body: JSON.stringify(credentials) })
      if (epoch !== loadEpochRef.current || probe !== sessionProbeRef.current) return
      setCredentials({ username: '', password: '' })
      setSession(payload)
    } catch (error) {
      if (epoch !== loadEpochRef.current) return
      setCredentials((current) => ({ ...current, password: '' }))
      setLoginError(error.code === 'RATE_LIMITED' ? 'Đăng nhập bị giới hạn tạm thời.' : 'Sai tài khoản hoặc mật khẩu.')
    }
  }

  // Chức năng logout: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
  async function logout() {
    const current = session
    clearSensitiveUi({ removeStorageFor: current?.username })
    ++sessionProbeRef.current
    setSession(false)
    const epoch = loadEpochRef.current
    // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
    if (!current?.csrfToken) return
    try {
      await apiJson('/api/admin/logout', { method: 'POST', headers: { 'x-csrf-token': current.csrfToken } })
    } catch (error) {
      if (epoch !== loadEpochRef.current) return
      // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
      if (error.code !== 'UNAUTHENTICATED') setLoginError('Phiên cục bộ đã được xóa; máy chủ không xác nhận đăng xuất.')
    }
  }

  // Chức năng saveContext: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
  async function saveContext() {
    // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
    if (!session?.csrfToken) return
    setPageError('')
    const epoch = loadEpochRef.current
    const requestEpoch = ++settingsEpochRef.current
    try {
      const payload = await apiJson('/api/admin/settings', {
        method: 'PUT', headers: { 'x-csrf-token': session.csrfToken }, body: JSON.stringify({ contextSize }),
      })
      if (epoch !== loadEpochRef.current || requestEpoch !== settingsEpochRef.current) return
      setSettings((current) => ({ ...current, contextSize: payload.contextSize }))
    } catch (error) {
      if (epoch !== loadEpochRef.current || requestEpoch !== settingsEpochRef.current) return
      // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
      if (error.code === 'UNAUTHENTICATED') expireSession()
      else setPageError('Không lưu được ngữ cảnh.')
    }
  }

  // Chức năng loadStats: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
  async function loadStats(event) {
    event?.preventDefault()
    setPageError('')
    const epoch = loadEpochRef.current
    const requestEpoch = ++statsEpochRef.current
    try {
      const payload = await apiJson('/api/admin/stats?from=' + encodeURIComponent(range.from) + '&to=' + encodeURIComponent(range.to))
      if (epoch !== loadEpochRef.current || requestEpoch !== statsEpochRef.current) return
      setReport(payload.report)
    } catch (error) {
      if (epoch !== loadEpochRef.current || requestEpoch !== statsEpochRef.current) return
      setReport(null)
      // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
      if (error.code === 'UNAUTHENTICATED') expireSession()
      else setPageError('Khoảng ngày không hợp lệ hoặc không tải được số liệu.')
    }
  }

  // Chức năng updateAssistant: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
  function updateAssistant(id, updater) {
    setMessages((previous) => previous.map((message) => message.id === id ? updater(message) : message))
  }

  // Chức năng sendMessage: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
  async function sendMessage(event, retry = null) {
    event.preventDefault()
    const content = (retry?.retryContent || draft).trim()
    // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
    if (!content || !session?.csrfToken) return
    const gate = gateRef.current.tryBegin()
    if (!gate) return
    restoreEpochRef.current += 1
    const reportEpoch = ++statsEpochRef.current
    const assistantId = retry?.id || localId()
    const requestId = retry?.requestId || localId()
    // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
    if (retry) updateAssistant(assistantId, (message) => ({ ...message, content: '', status: 'streaming', error: '' }))
    else setMessages((previous) => [...previous,
      { id: localId(), role: 'user', content, status: 'complete' },
      { id: assistantId, role: 'assistant', content: '', status: 'streaming', sources: [], requestId, retryContent: content },
    ])
    setDraft(''); chatInputRef.current?.focus(); setBusy(true); setActivity('Đang phân tích'); setPageError('')

    try {
      await streamChat({
        endpoint: '/api/admin/chat', message: content, conversationId, requestId,
        csrfToken: session.csrfToken, signal: gate.controller.signal,
        onEvent: (streamEvent) => {
          if (!gateRef.current.isCurrent(gate.epoch)) return
          if (streamEvent.type === 'conversation') {
            setConversationId(streamEvent.conversationId)
            sessionStorage.setItem(adminConversationKey(session.username), streamEvent.conversationId)
            setCompactStatus(streamEvent.compactStatus || 'not_needed')
          } else if (streamEvent.type === 'status') setActivity(streamEvent.label || 'Đang phân tích')
          else if (streamEvent.type === 'delta') updateAssistant(assistantId, (message) => ({ ...message, content: message.content + streamEvent.content }))
          else if (streamEvent.type === 'report') {
            if (reportEpoch === statsEpochRef.current) setReport(streamEvent.report)
            updateAssistant(assistantId, (message) => ({ ...message, report: streamEvent.report }))
          }
          else if (streamEvent.type === 'verified') updateAssistant(assistantId, (message) => ({ ...message, verified: streamEvent.verified }))
          // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
          else if (streamEvent.type === 'done') { setCompactStatus(streamEvent.compactStatus || 'not_needed'); updateAssistant(assistantId, (message) => ({ ...message, status: 'complete' })) }
        },
      })
    } catch (error) {
      if (!gateRef.current.isCurrent(gate.epoch)) return
      // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
      if (error.code === 'UNAUTHENTICATED') expireSession()
      else {
        updateAssistant(assistantId, (message) => ({ ...message, status: error.incomplete ? 'incomplete' : 'error', error: error.message, content: message.content || 'Không thể hoàn tất phân tích: ' + error.message }))
        setDraft((current) => current || content)
      }
    } finally {
      if (gateRef.current.isCurrent(gate.epoch)) { gateRef.current.finish(gate.epoch); setBusy(false); setActivity(''); chatInputRef.current?.focus() }
    }
  }

  // Chức năng stopStream: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
  function stopStream() {
    gateRef.current.cancel()
    setMessages((previous) => previous.map((message) => message.status === 'streaming' ? { ...message, status: 'stopped' } : message))
    setBusy(false); setActivity('Đã dừng')
  }

  // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
  const loginVideoBg = (
    <div className="admin-video-bg" aria-hidden="true">
      <iframe
        src="https://www.youtube.com/embed/2qeTbiQ57C0?autoplay=1&mute=1&loop=1&playlist=2qeTbiQ57C0&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&playsinline=1"
        title="Background video"
        allow="autoplay; encrypted-media"
        tabIndex="-1"
      />
      <div className="admin-video-overlay" />
    </div>
  )

  if (session === null) return (
    <main className="admin-shell admin-shell--login">
      {loginVideoBg}
      <div className="admin-login-card admin-loading-state">
        <div className="admin-login-card__preferences"><ThemeLanguageControls showTheme={false} /></div>
        <p>Đang kiểm tra phiên quản trị…</p>
      </div>
    </main>
  )
  if (!session?.authenticated) return (
    <main className="admin-shell admin-shell--login">
      {loginVideoBg}
      <div className="admin-login-card">
        <div className="admin-login-card__preferences"><ThemeLanguageControls showTheme={false} /></div>
        <form className="admin-login" onSubmit={login}>
          <div className="admin-login__brand">
            <img src="/brand-logo-square.jpg" alt="OmniCart" className="admin-login__brand-logo" />
            <span className="admin-login__brand-title">OmniCart<span>.</span></span>
          </div>
          <p className="admin-eyebrow">QUẢN TRỊ STORE</p><h1>{copy.login}</h1><p>{copy.adminOnly}</p>
          <label>{copy.account}<input autoComplete="username" value={credentials.username} onChange={(event) => setCredentials((current) => ({ ...current, username: event.target.value }))} /></label>
          <label>{copy.password}<input type="password" autoComplete="current-password" value={credentials.password} onChange={(event) => setCredentials((current) => ({ ...current, password: event.target.value }))} /></label>
          {loginError && <p className="admin-error" role="alert">{language === 'en' && loginError === 'Sai tài khoản hoặc mật khẩu.' ? copy.wrongLogin : loginError}</p>}<button type="submit">{copy.login}</button><a href={import.meta.env?.VITE_STOREFRONT_URL || 'http://localhost:5173'}>{copy.backStore}</a>
        </form>
      </div>
    </main>
  )

  const moduleEnglish = { dashboard: 'Dashboard', customers: 'Customers', favorites: 'Favorites', reviews: 'Reviews', 'customer-orders': 'Orders', products: 'Products', 'product-views': 'Most viewed', logistics: 'Logistics', inventory: 'Inventory', appearance: 'Storefront', returns: 'Returns', statistics: 'Statistics', 'ai-local': 'Local AI', 'order-types': 'Order types', support: 'Support', 'rewards-wheel': 'Voucher', staff: 'Staff', overtime: 'Overtime & rewards' }
  const visibleModules = adminModules.filter(([id]) => canOpenModule(session.role, id))
  const visibleGroups = moduleGroups.map(group => ({ ...group, ids: group.ids.filter(id => canOpenModule(session.role, id)) })).filter(group => group.ids.length)
  const currentLabel = language === 'en' ? (moduleEnglish[activeModule] || 'Dashboard') : (adminModules.find(([id]) => id === activeModule)?.[1] || 'Tổng quan')

  return (
    <main className="admin-shell admin-shell--workspace">
      <div className="admin-workspace-card">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/admin" aria-label="OmniCart Dashboard">
          <img src="/brand-logo-square.jpg" alt="OmniCart" style={{ width: '32px', height: '32px', borderRadius: '7px', objectFit: 'cover', marginRight: '6px' }} />
          <span>OmniCart</span><small className="admin-brand-badge">Dashboard</small>
        </a>
        <div className="admin-sidebar__profile"><span>{String(session.username || 'A').slice(0, 1).toUpperCase()}</span><div><b>{session.username}</b><small>{session.role === 'staff' ? 'Nhân viên' : 'Quản trị viên'}</small></div></div>
        <nav aria-label="Điều hướng quản trị">
          {visibleGroups.map((group) => <div className="admin-nav-group" key={group.title}><p>{group.title}</p>{group.ids.map((id) => {
            const [, label, icon] = moduleById.get(id)
            const displayLabel = language === 'en' ? ({ dashboard: 'Dashboard', statistics: 'Statistics', 'ai-local': 'Local AI', products: 'Products', 'product-views': 'Most viewed', inventory: 'Inventory', logistics: 'Logistics', appearance: 'Storefront', returns: 'Returns', customers: 'Customers', favorites: 'Favorites', reviews: 'Reviews', 'rewards-wheel': 'Voucher', 'customer-orders': 'Orders', support: 'Support', 'order-types': 'Order types', staff: 'Staff', overtime: 'Overtime & rewards' }[id] || label) : label
            return <button key={id} type="button" aria-current={activeModule === id ? 'page' : undefined} className={activeModule === id ? 'is-active' : ''} onClick={() => setActiveModule(id)}><span aria-hidden="true">{icon}</span>{displayLabel}</button>
          })}</div>)}
        </nav>
        <div className="admin-sidebar__footer"><a href={import.meta.env?.VITE_STOREFRONT_URL || 'http://localhost:5173'}>↗ {language === 'en' ? 'View store' : 'Xem cửa hàng'}</a><button type="button" onClick={logout}>{copy.signOut}</button></div>
      </aside>
      <section className="admin-main">
        <div className="admin-main__card">
        {busy && <div className="admin-top-progress" role="progressbar" aria-label="Đang xử lý…" />}
        <header className="admin-header">
          <div><p className="admin-eyebrow">{language === 'en' ? 'STORE ADMIN' : 'QUẢN TRỊ STORE'} / {currentLabel.toUpperCase()}</p><h1>{currentLabel}</h1></div>
          <div className="admin-global-search">
            <span aria-hidden="true">⌕</span>
            <input ref={adminSearchRef} type="search" value={adminSearch} onChange={(event) => setAdminSearch(event.target.value)} placeholder={copy.searching} aria-label={copy.searching} />
            <kbd>Ctrl K</kbd>
            {adminSearch && <div className="admin-search-results">{visibleModules.filter(([,label]) => normalizeSearch(label).includes(normalizeSearch(adminSearch))).slice(0,6).map(([id,label,icon]) => <button key={id} type="button" onClick={() => { setActiveModule(id); setAdminSearch('') }}><span aria-hidden="true">{icon}</span>{label}</button>)}{visibleModules.filter(([,label]) => normalizeSearch(label).includes(normalizeSearch(adminSearch))).length === 0 && <p>Không tìm thấy mục.</p>}</div>}
          </div>
          <div className="admin-header__actions"><span className="admin-live-dot">{copy.local}</span><ThemeLanguageControls /><button type="button" onClick={logout}>{copy.signOut}</button></div>
        </header>
        <div className="admin-workspace-content" key={activeModule}>
        {realtimeEvents.length > 0 && (
          <div className="admin-realtime-bar" role="status" aria-live="polite" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: '#f4fbf5', border: '1px solid #cbe9d3', padding: '0.5rem 1rem', borderRadius: '6px', margin: '0.5rem 0', fontSize: '0.875rem' }}>
            <span style={{ fontWeight: 'bold', color: '#254535' }}>Thông báo mới:</span>
            <span style={{ flex: 1, color: '#1b3327' }}>{realtimeEvents[0].text}</span>
            <small style={{ color: '#688272' }}>{realtimeEvents[0].time}</small>
          </div>
        )}
        {pageError && <p className="admin-error" role="alert">{pageError}</p>}
        <OperationalExportButton module={activeModule} role={session.role} />
        {activeModule !== 'ai-local' && <AdminModule role={session.role} module={activeModule} csrfToken={session.csrfToken} onNavigate={setActiveModule} language={language} />}
        {activeModule === 'ai-local' && <>
          <div className="admin-ai-tab-switch" role="tablist" aria-label="Chế độ AI">
            <button
              type="button"
              role="tab"
              aria-selected={aiWorkspaceTab === 'chat'}
              className={'admin-ai-tab-btn' + (aiWorkspaceTab === 'chat' ? ' is-active' : '')}
              onClick={() => setAiWorkspaceTab('chat')}
            >
              <span aria-hidden="true">💬</span> {language === 'en' ? 'AI Chat & Analytics' : 'Trò chuyện & Phân tích AI'}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={aiWorkspaceTab === 'social'}
              className={'admin-ai-tab-btn' + (aiWorkspaceTab === 'social' ? ' is-active' : '')}
              onClick={() => setAiWorkspaceTab('social')}
            >
              <span aria-hidden="true">🚀</span> {language === 'en' ? 'Social Marketing Automation' : 'Tự động đăng bài Mạng Xã Hội'}
            </button>
          </div>

          {aiWorkspaceTab === 'social' && (
            <div className="admin-social-posting" data-testid="social-posting-workspace">
              <AdminSocialAutomation csrfToken={session.csrfToken} language={language} />
            </div>
          )}

          {aiWorkspaceTab === 'chat' && (
            <div className="admin-workspace-chat">
              <section className="admin-meta" aria-label="Cấu hình AI">
                <div><small>Mô hình</small><strong>{settings?.model || 'qwen3.5:4b'}</strong></div>
                <div><small>Suy luận</small><strong>{thinkingEnabled ? 'Bật · ' + thinkingLabel(thinkingMode) : 'Tắt · phản hồi trực tiếp'}</strong></div>
                <div><small>Rút gọn</small><strong>{compactLabel(compactStatus)}</strong></div>
                <div className="admin-context"><label>Ngữ cảnh<DropdownMenu value={contextSize} options={(settings?.allowedContextSizes || [8192, 16384, 32768, 65536]).map((size) => [size, size === 65536 ? '64K · thử nghiệm' : (size / 1024) + 'K'])} onChange={(value) => setContextSize(Number(value))} ariaLabel="Kích thước ngữ cảnh" /></label><button type="button" onClick={saveContext}>Lưu</button></div>
              </section>
              <p className="admin-warning">Ngữ cảnh lớn cần nhiều bộ nhớ hơn. Máy thành viên có thể cần mức 8.192 hoặc 16.384 tùy phần cứng; mức 65.536 chỉ dành cho thử nghiệm.</p>
              <div className="admin-grid">
                <section className="admin-panel"><div className="admin-panel__heading"><div><p className="admin-eyebrow">SỐ LIỆU GỐC</p><h2>Doanh thu máy chủ</h2></div><span>Giờ Việt Nam</span></div>
                  <form className="admin-range" onSubmit={loadStats}><label>Từ<input type="date" value={range.from} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} /></label><label>Đến<input type="date" value={range.to} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} /></label><button type="submit">Tải số liệu</button></form>
                  {report ? <dl className="admin-stats"><div><dt>Doanh thu gộp</dt><dd>{formatMoney(report.grossRevenue)}</dd></div><div><dt>Hoàn tiền đã trừ</dt><dd>{formatMoney(report.refunds)}</dd></div><div><dt>Doanh thu ròng</dt><dd>{formatMoney(report.netRevenue)}</dd></div><div><dt>Đơn được tính</dt><dd>{report.includedOrders}</dd></div></dl> : <p className="admin-muted">Chọn khoảng thời gian để lấy số liệu máy chủ.</p>}
                  {report && <p className="admin-source">Dữ liệu cửa hàng · {report.from} → {report.to} · dữ liệu: {{ real: 'thực tế', none: 'chưa có giao dịch' }[report.dataMode] || 'chưa xác định'}</p>}
                </section>
                <section className="admin-panel admin-chat">
                  <div className="admin-panel__heading">
                    <div><p className="admin-eyebrow">AI NHẬN XÉT</p><h2>Trò chuyện quản trị</h2></div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span>Suy luận: {thinkingEnabled ? thinkingLabel(thinkingMode) : 'Tắt'}</span>
                      <button type="button" className="table-action" onClick={startNewAdminChat} disabled={busy}>+ Chat mới</button>
                    </div>
                  </div>
                  <div className="admin-chat__quick-prompts">
                    {adminQuickPrompts.map((promptText) => (
                      <button
                        key={promptText}
                        type="button"
                        disabled={busy}
                        onClick={() => { setDraft(promptText); chatInputRef.current?.focus() }}
                      >
                        ✦ {promptText}
                      </button>
                    ))}
                  </div>
                  <div ref={logRef} className="admin-chat__log" role="log" aria-live="polite">
                    {messages.length === 0 && <p className="admin-muted">AI Cục Bộ kết nối trực tiếp SQL Server StoreDb. Bấm gợi ý phía trên hoặc nhập câu hỏi (Enter để gửi, Shift+Enter để xuống dòng).</p>}
                    {messages.map((message) => (
                      <div key={message.id} className={'admin-chat__message admin-chat__message--' + message.role}>
                        <div className="admin-chat__meta-row">
                          <small>{message.role === 'user' ? 'Quản trị' : 'AI cục bộ (qwen3.5:4b)'}</small>
                          {message.role === 'assistant' && message.content && (
                            <button type="button" className="admin-chat__copy-btn" onClick={() => copyChatReply(message)}>
                              {copiedMsgId === message.id ? '✓ Đã chép' : '📋 Chép'}
                            </button>
                          )}
                        </div>
                        <div className="admin-chat__bubble">
                          {message.role === 'assistant'
                            ? <AiMarkdown text={hideSourceDisclosure(message.content) || (busy ? 'Đang suy nghĩ…' : '')} />
                            : <p>{message.content}</p>}
                        </div>
                        {message.verified?.text && <p>{message.verified.text}</p>}
                        {message.report && <p className="admin-chat__report-chip">📊 Báo cáo: {message.report.from} → {message.report.to} · Doanh thu ròng: <strong>{formatMoney(message.report.netRevenue)}</strong></p>}
                        {['incomplete', 'error', 'stopped', 'pending'].includes(message.status) && <small>Chưa hoàn tất. {message.error}</small>}
                        {['incomplete', 'error', 'stopped'].includes(message.status) && message.requestId && <button type="button" disabled={busy} onClick={(event) => sendMessage(event, message)}>Thử lại</button>}
                      </div>
                    ))}
                    {busy && <p className="admin-thinking">{activity || 'Đang phân tích dữ liệu SQL Server...'}</p>}
                  </div>
                  <form className="admin-chat__form" onSubmit={sendMessage}>
                    <textarea
                      ref={chatInputRef}
                      maxLength={2000}
                      rows="3"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                          event.preventDefault()
                          if (draft.trim() && !busy) sendMessage(event)
                        }
                      }}
                      placeholder="Nhập câu hỏi quản trị... (Enter để gửi, Shift+Enter xuống dòng)"
                      aria-busy={busy}
                    />
                    {busy ? <button type="button" onClick={stopStream}>Dừng</button> : <button type="submit" disabled={!draft.trim()}>Gửi ↵</button>}
                  </form>
                </section>
              </div>
            </div>
          )}
        </>}
        </div>
        </div>
      </section>
      </div>
    </main>
  )
}
