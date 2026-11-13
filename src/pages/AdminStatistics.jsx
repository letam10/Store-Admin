import { useEffect, useState } from 'react'
import { apiJson } from '../api/chat'
import DropdownMenu from '../components/ui/DropdownMenu'
import { dateOnlyLabel } from '../services/vietnameseLabels'

const money = new Intl.NumberFormat('vi-VN')
const chartOptions = [['area', 'Đồi núi'], ['line', 'Đường thẳng'], ['bars-v', 'Cột đứng'], ['bars-h', 'Cột ngang'], ['2.5d', '2.5D'], ['3d', '3D']]

export default function AdminStatistics({ Chart }) {
  const [range, setRange] = useState(() => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    return { from: today.slice(0, 8) + '01', to: today }
  })
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [chartType, setChartType] = useState('area')
  const query = new URLSearchParams(range).toString()
  useEffect(() => {
    const controller = new AbortController()
    apiJson('/api/admin/stats?' + query, { signal: controller.signal })
      .then(payload => { if (!controller.signal.aborted) { setReport(payload.report); setError('') } })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.code === 'INVALID_REPORT_RANGE' ? 'Khoảng ngày không hợp lệ.' : failure.message) })
    return () => controller.abort()
  }, [query])

  const ready = report && report.from === range.from && report.to === range.to && !error
  const revenue = ready ? report.revenueByDay : []
  const highest = Math.max(1, ...revenue.map(day => day.revenue))
  const chartWidth = 640
  const chartHeight = 220
  const linePoints = revenue.map((day, index) => `${revenue.length === 1 ? chartWidth / 2 : index / (revenue.length - 1) * chartWidth},${chartHeight - day.revenue / highest * (chartHeight - 28)}`).join(' ')

  function exportReport(format) {
    if (ready) window.open('/api/admin/stats/export?' + query + '&format=' + format, '_blank', 'noopener')
  }

  return <section className="admin-module-card statistics-module">
    <div className="admin-module-head">
      <div><p className="admin-eyebrow">THỐNG KÊ DOANH THU</p><h2>Báo cáo theo kỳ</h2><p>Màn hình và tệp xuất sử dụng cùng khoảng ngày và cách tính.</p></div>
      <div className="statistics-head-actions">
        <button type="button" disabled={!ready} onClick={() => exportReport('html')}>In / lưu PDF</button>
        <button type="button" disabled={!ready} onClick={() => exportReport('xlsx')}>Xuất Excel</button>
        <DropdownMenu value={chartType} options={chartOptions} onChange={setChartType} ariaLabel="Kiểu biểu đồ thống kê" />
      </div>
    </div>
    <div className="admin-editor-grid">
      <label>Từ ngày<input type="date" required value={range.from} max={range.to} onChange={event => setRange({ ...range, from: event.target.value })} /></label>
      <label>Đến ngày<input type="date" required value={range.to} min={range.from} onChange={event => setRange({ ...range, to: event.target.value })} /></label>
    </div>
    {error && <p role="alert">{error}</p>}
    {!ready && !error && <p role="status">Đang tải báo cáo…</p>}
    {ready && <>
      <div className="statistics-summary">
        {[['Doanh thu gộp', report.grossRevenue, '₫'], ['Hoàn tiền đã ghi nhận', report.refunds, '₫'], ['Doanh thu ròng', report.netRevenue, '₫'], ['Đơn đã thanh toán', report.includedOrders, 'đơn']].map(([label, value, unit]) => <div key={label}><small>{label}</small><b>{money.format(value)} {unit}</b></div>)}
      </div>
      <p>{report.basis}</p>
      {(report.excludedDemoOrders > 0 || report.undatedOrders > 0) && <p>Đã loại {report.excludedDemoOrders} bản ghi mô phỏng; có {report.undatedOrders} bản ghi thiếu ngày hợp lệ cần đối soát.</p>}
      <div className="statistics-visual"><Chart revenue={revenue} statuses={report.orderStatus} chartType={chartType} en={false} highest={highest} chartWidth={chartWidth} chartHeight={chartHeight} linePoints={linePoints} areaPoints={linePoints ? `0,${chartHeight} ${linePoints} ${chartWidth},${chartHeight}` : ''} currency={money} overview={report} /></div>
      <h3>Chi tiết theo ngày</h3>
      <div className="admin-table-wrap"><table>
        <thead><tr><th>Ngày</th><th>Số đơn</th><th>Doanh thu gộp</th><th>Hoàn tiền</th><th>Doanh thu ròng</th></tr></thead>
        <tbody>{revenue.map(day => <tr key={day.date}><td>{dateOnlyLabel(day.date)}</td><td>{day.orders}</td><td>{money.format(day.grossRevenue)} ₫</td><td>{money.format(day.refunds)} ₫</td><td>{money.format(day.revenue)} ₫</td></tr>)}</tbody>
        <tfoot><tr><th>Tổng</th><td>{report.includedOrders}</td><td>{money.format(report.grossRevenue)} ₫</td><td>{money.format(report.refunds)} ₫</td><td>{money.format(report.netRevenue)} ₫</td></tr></tfoot>
      </table></div>
    </>}
  </section>
}
