import { useRef, useState } from 'react'
import { apiJson } from '../api/chat'

export default function CustomerPasswordEditor({ customer, csrfToken }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const gate = useRef(false)

  async function submit(event) {
    event.preventDefault()
    setNotice('')
    if (password !== confirmation) {
      setError('Hai mật khẩu chưa khớp.')
      return
    }
    if (gate.current) return
    gate.current = true
    setBusy(true)
    setError('')
    try {
      await apiJson('/api/admin/customers/' + customer.id + '/password', {
        method: 'PUT',
        headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify({ password }),
      })
      setPassword('')
      setConfirmation('')
      setNotice('Đã đổi mật khẩu và thu hồi các phiên đăng nhập cũ của khách hàng.')
    } catch {
      setError('Không đổi được mật khẩu. Kiểm tra quyền quản trị và mật khẩu từ 8 đến 128 ký tự.')
    } finally {
      gate.current = false
      setBusy(false)
    }
  }

  return <form className="admin-commerce-form" onSubmit={submit}>
    <h3>Đổi mật khẩu cho {customer.username}</h3>
    <label>Mật khẩu mới<input type="password" autoComplete="new-password" required minLength="8" maxLength="128" value={password} onChange={event => setPassword(event.target.value)} /></label>
    <label>Nhập lại mật khẩu<input type="password" autoComplete="new-password" required minLength="8" maxLength="128" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
    <button disabled={busy} type="submit">{busy ? 'Đang đổi…' : 'Đổi mật khẩu'}</button>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
  </form>
}
