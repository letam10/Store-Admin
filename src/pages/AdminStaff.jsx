/*
  FILE NOTE
  - Mục đích: Giao diện quản lý tài khoản nhân viên (danh sách, tạo mới, sửa mật khẩu/quyền đăng nhập).
  - Liên kết trực tiếp: Store-Admin/server-dotnet/Controllers/AdminAccountsController.cs, Store-Admin/src/pages/AdminCommerce.css
  - Vùng ảnh hưởng khi sửa: Bảng và form quản lý nhân viên, đổi mật khẩu và cấp/thu hồi quyền truy cập.
*/

import { useEffect, useRef, useState } from 'react'
import { apiJson } from '../api/chat'
import './AdminCommerce.css'

const emptyAccount = { username: '', displayName: '', email: '', password: '', active: true }
const errors = {
  ACCOUNT_EXISTS: 'Tên đăng nhập đã được sử dụng.',
  INVALID_ACCOUNT: 'Kiểm tra tên đăng nhập, họ tên và email.',
  INVALID_PASSWORD: 'Mật khẩu cần từ 8 đến 128 ký tự.',
  FORBIDDEN: 'Chỉ quản trị viên được quản lý tài khoản nhân viên.',
}

export default function AdminStaff({ csrfToken }) {
  const [accounts, setAccounts] = useState([])
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const gate = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    apiJson('/api/admin/staff', { signal: controller.signal })
      .then(payload => setAccounts(payload.staff))
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message) })
    return () => controller.abort()
  }, [])

  async function save(event) {
    event.preventDefault()
    if (gate.current) return
    gate.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const { staff } = await apiJson('/api/admin/staff' + (editing.id ? '/' + editing.id : ''), {
        method: editing.id ? 'PATCH' : 'POST',
        headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify(editing),
      })
      setAccounts(current => editing.id ? current.map(item => item.id === staff.id ? staff : item) : [...current, staff])
      setEditing(null)
      setNotice('Đã lưu tài khoản. Nhân viên đăng nhập lại bằng thông tin mới.')
    } catch (failure) {
      setError(errors[failure.code] || 'Không lưu được tài khoản nhân viên.')
    } finally {
      gate.current = false
      setBusy(false)
    }
  }

  return <section className="admin-module-card">
    <div className="admin-module-head">
      <div><h2>Tài khoản nhân viên</h2><p>Nhân viên được chăm sóc khách hàng, xử lý yêu cầu đổi trả và xem sản phẩm, khách hàng. Cấu hình, tài chính và tài khoản do quản trị viên quản lý.</p></div>
      <button type="button" onClick={() => { setEditing({ ...emptyAccount }); setError('') }}>+ Thêm nhân viên</button>
    </div>
    {error && <p role="alert" className="admin-error">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {editing && <form className="admin-commerce-form admin-staff-form" onSubmit={save}>
      <label>Tên đăng nhập<input required minLength="3" maxLength="100" value={editing.username} onChange={event => setEditing({ ...editing, username: event.target.value })} /></label>
      <label>Họ tên<input required maxLength="255" value={editing.displayName} onChange={event => setEditing({ ...editing, displayName: event.target.value })} /></label>
      <label>Email<input required type="email" maxLength="255" value={editing.email} onChange={event => setEditing({ ...editing, email: event.target.value })} /></label>
      <label>{editing.id ? 'Mật khẩu mới (để trống để giữ nguyên)' : 'Mật khẩu'}<input type="password" autoComplete="new-password" required={!editing.id} minLength="8" maxLength="128" value={editing.password} onChange={event => setEditing({ ...editing, password: event.target.value })} /></label>
      <div className="admin-staff-form__footer">
        <label className="admin-confirm-check admin-staff-active-toggle">
          <input type="checkbox" checked={editing.active} onChange={event => setEditing({ ...editing, active: event.target.checked })} />
          <span>Cho phép đăng nhập</span>
        </label>
        <div className="voucher-editor-actions">
          <button disabled={busy} type="submit">{busy ? 'Đang lưu…' : 'Lưu nhân viên'}</button>
          <button disabled={busy} type="button" className="button-secondary" onClick={() => setEditing(null)}>Hủy</button>
        </div>
      </div>
    </form>}
    <div className="admin-table-wrap"><table>
      <thead><tr><th>Họ tên</th><th>Tài khoản</th><th>Email</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
      <tbody>{accounts.map(account => <tr key={account.id}>
        <td><strong>{account.displayName}</strong></td>
        <td>{account.username}</td>
        <td>{account.email}</td>
        <td><span className={'admin-status-chip ' + (account.active ? 'admin-signal--good' : 'admin-signal--quiet')}>{account.active ? 'Đang hoạt động' : 'Đã khóa'}</span></td>
        <td><button type="button" className="table-action admin-staff-edit-btn" onClick={() => { setEditing({ ...account, password: '' }); setError('') }}>Sửa thông tin / mật khẩu</button></td>
      </tr>)}</tbody>
    </table></div>
    {!accounts.length && <p className="admin-empty">Chưa có tài khoản nhân viên.</p>}
  </section>
}
