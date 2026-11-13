import { useRef, useState } from 'react'

export default function ConfirmRemoval({ name, onConfirm, onCancel }) {
  const gate = useRef(false)
  const [busy, setBusy] = useState(false)
  async function confirm() {
    if (gate.current) return
    gate.current = true
    setBusy(true)
    try { await onConfirm() }
    finally { gate.current = false; setBusy(false) }
  }
  return <section className="admin-detail-panel" role="group" aria-label="Xác nhận xóa">
    <p>Bạn muốn xóa <strong>{name}</strong>?</p>
    <div className="admin-editor-actions">
      <button type="button" disabled={busy} onClick={confirm}>{busy ? 'Đang xóa…' : 'Xác nhận xóa'}</button>
      <button type="button" disabled={busy} onClick={onCancel}>Giữ lại</button>
    </div>
  </section>
}
