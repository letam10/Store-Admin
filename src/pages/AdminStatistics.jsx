/*
  FILE NOTE
  - Mục đích: Giao diện báo cáo thống kê doanh thu đa kỳ (ngày/tuần/tháng/quý/năm), 4 KPI thẻ trực quan, biểu đồ xu hướng, nút in PDF và xuất Excel.
  - Liên kết trực tiếp: Store-Admin/server-dotnet/Controllers/AdminReportsController.cs, Store-Admin/src/pages/AdminModules.css
  - Vùng ảnh hưởng khi sửa: Toàn bộ module Thống kê trên bảng quản trị và các unit test liên quan (.statistics-summary, in/lưu PDF, xuất Excel).
*/

import { useEffect, useMemo, useState } from 'react'
import { apiJson } from '../api/chat'
import DropdownMenu from '../components/ui/DropdownMenu'
import { dateOnlyLabel, statusLabel } from '../services/vietnameseLabels'

const money = new Intl.NumberFormat('vi-VN')
const chartOptions = [
  ['area', 'Đồi núi'],
  ['line', 'Đường thẳng'],
  ['bars-v', 'Cột đứng'],
  ['bars-h', 'Cột ngang'],
  ['2.5d', '2.5D'],
  ['3d', '3D'],
]

function vnToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function shiftDays(isoDate, delta) {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

function compactVnd(val) {
  const n = Number(val || 0)
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'tr'
  if (n >= 1_000) return Math.round(n / 1_000) + 'K'
  return String(n)
}

export default function AdminStatistics({ Chart }) {
  const today = useMemo(() => vnToday(), [])
  const [range, setRange] = useState(() => ({ from: today.slice(0, 8) + '01', to: today }))
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [chartType, setChartType] = useState('area')
  const [hoveredDay, setHoveredDay] = useState(null)

  const query = new URLSearchParams(range).toString()
  useEffect(() => {
    const controller = new AbortController()
    apiJson('/api/admin/stats?' + query, { signal: controller.signal })
      .then((payload) => {
        if (!controller.signal.aborted) {
          setReport(payload.report)
          setError('')
          setHoveredDay(null)
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          setError(failure.code === 'INVALID_REPORT_RANGE' ? 'Khoảng ngày không hợp lệ.' : failure.message)
        }
      })
    return () => controller.abort()
  }, [query])

  const ready = report && report.from === range.from && report.to === range.to && !error
  const revenue = ready ? (report.revenueByDay || []) : []
  const orderStatuses = ready ? (report.orderStatus || []) : []
  const highest = Math.max(1, ...revenue.map((day) => Number(day.revenue || 0)))
  const chartWidth = 680
  const chartHeight = 230
  const padTop = 18
  const padBottom = 10
  const usableH = chartHeight - padTop - padBottom

  const coords = revenue.map((day, index) => {
    const x = revenue.length === 1 ? chartWidth / 2 : (index / (revenue.length - 1)) * chartWidth
    const y = chartHeight - padBottom - (Number(day.revenue || 0) / highest) * usableH
    return { x, y, day }
  })
  const linePoints = coords.map((c) => `${c.x},${c.y}`).join(' ')
  const areaPoints = linePoints ? `0,${chartHeight - padBottom} ${linePoints} ${chartWidth},${chartHeight - padBottom}` : ''

  const presets = useMemo(() => {
    const prevMonthDate = new Date(today.slice(0, 8) + '01T00:00:00Z')
    prevMonthDate.setUTCDate(0)
    const prevTo = prevMonthDate.toISOString().slice(0, 10)
    const prevFrom = prevTo.slice(0, 8) + '01'
    return [
      { id: 'today', label: 'Hôm nay', from: today, to: today },
      { id: '7d', label: '7 ngày', from: shiftDays(today, -6), to: today },
      { id: '30d', label: '30 ngày', from: shiftDays(today, -29), to: today },
      { id: 'month', label: 'Tháng này', from: today.slice(0, 8) + '01', to: today },
      { id: 'prev_month', label: 'Tháng trước', from: prevFrom, to: prevTo },
      { id: 'year', label: 'Năm nay', from: today.slice(0, 4) + '-01-01', to: today },
    ]
  }, [today])

  function exportReport(format) {
    if (ready) window.open('/api/admin/stats/export?' + query + '&format=' + format, '_blank', 'noopener')
  }

  const gross = Number(report?.grossRevenue || 0)
  const refunds = Number(report?.refunds || 0)
  const net = Number(report?.netRevenue || 0)
  const paidOrders = Number(report?.includedOrders || 0)
  const allOrders = Number(report?.allOrders ?? paidOrders)
  const refundRatio = gross > 0 ? ((refunds / gross) * 100).toFixed(1) : '0.0'
  const avgOrder = paidOrders > 0 ? Math.round(net / paidOrders) : 0
  const maxStatusCount = Math.max(1, ...orderStatuses.map((s) => Number(s.count || 0)))
  const totalStatusCount = Math.max(1, orderStatuses.reduce((sum, s) => sum + Number(s.count || 0), 0))

  return (
    <section className="admin-module-card statistics-module">
      {/* Header gọn gàng: tiêu đề trái, nút xuất & đổi biểu đồ phải */}
      <div className="statistics-topbar">
        <div>
          <p className="admin-eyebrow">THỐNG KÊ DOANH THU</p>
          <h2>Báo cáo theo kỳ</h2>
          <p className="statistics-period-subtitle">
            Kỳ báo cáo: <strong>{dateOnlyLabel(range.from)}</strong> → <strong>{dateOnlyLabel(range.to)}</strong> · Đơn vị: VNĐ (Giờ Việt Nam)
          </p>
        </div>
        <div className="statistics-head-actions">
          <button
            type="button"
            className="button-secondary statistics-action-btn statistics-action-btn--print"
            disabled={!ready}
            onClick={() => exportReport('html')}
          >
            In / lưu PDF
          </button>
          <button
            type="button"
            className="statistics-action-btn statistics-action-btn--excel"
            disabled={!ready}
            onClick={() => exportReport('xlsx')}
          >
            Xuất Excel
          </button>
          <DropdownMenu
            value={chartType}
            options={chartOptions}
            onChange={setChartType}
            ariaLabel="Kiểu biểu đồ thống kê"
            className="statistics-chart-dropdown"
          />
        </div>
      </div>

      {/* Thanh chọn nhanh khoảng thời gian + 2 ô ngày */}
      <div className="statistics-filter-bar">
        <div className="statistics-presets" role="group" aria-label="Chọn nhanh khoảng thời gian">
          {presets.map((p) => {
            const active = range.from === p.from && range.to === p.to
            return (
              <button
                key={p.id}
                type="button"
                className={'statistics-preset-btn' + (active ? ' is-active' : '')}
                onClick={() => setRange({ from: p.from, to: p.to })}
              >
                {p.label}
              </button>
            )
          })}
        </div>
        <div className="statistics-date-inputs">
          <label>
            <span>Từ ngày</span>
            <input type="date" required value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          </label>
          <label>
            <span>Đến ngày</span>
            <input type="date" required value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          </label>
        </div>
      </div>

      {error && <p role="alert" className="admin-error">{error}</p>}
      {!ready && !error && <p role="status">Đang tải báo cáo…</p>}

      {ready && (
        <>
          {/* 4 Thẻ KPI hiện đại */}
          <div className="statistics-summary">
            <article className="statistics-kpi-card">
              <div className="statistics-kpi-head">
                <small>Doanh thu gộp</small>
                <span className="statistics-kpi-icon">💰</span>
              </div>
              <b>{money.format(gross)} ₫</b>
              <span className="statistics-kpi-sub">Tổng tiền hàng + bù trước hoàn</span>
            </article>

            <article className={'statistics-kpi-card' + (refunds > 0 ? ' statistics-kpi-card--warn' : '')}>
              <div className="statistics-kpi-head">
                <small>Hoàn tiền đã ghi nhận</small>
                <span className="statistics-kpi-icon">↩️</span>
              </div>
              <b>{money.format(refunds)} ₫</b>
              <span className="statistics-kpi-sub">Tỷ lệ hoàn: {refundRatio}% doanh thu gộp</span>
            </article>

            <article className="statistics-kpi-card statistics-kpi-card--highlight">
              <div className="statistics-kpi-head">
                <small>Doanh thu ròng</small>
                <span className="statistics-kpi-icon">📈</span>
              </div>
              <b>{money.format(net)} ₫</b>
              <span className="statistics-kpi-sub">Thực thu sau trừ hoàn tiền</span>
            </article>

            <article className="statistics-kpi-card">
              <div className="statistics-kpi-head">
                <small>Đơn đã thanh toán</small>
                <span className="statistics-kpi-icon">🧾</span>
              </div>
              <b>{money.format(paidOrders)} đơn</b>
              <span className="statistics-kpi-sub">TB {money.format(avgOrder)} ₫ / đơn · Tổng {allOrders} đơn</span>
            </article>
          </div>

          {/* Biểu đồ tương tác + Cơ cấu trạng thái đơn */}
          <div className="statistics-charts-grid">
            <div className="statistics-visual-card">
              <div className="statistics-card-head">
                <div>
                  <h3>Biểu đồ doanh thu ròng theo ngày</h3>
                  <small>{revenue.length} ngày phát sinh doanh thu trong kỳ</small>
                </div>
                {hoveredDay ? (
                  <div className="statistics-hover-pill">
                    <strong>{dateOnlyLabel(hoveredDay.date)}</strong> · {hoveredDay.orders} đơn · Ròng <b>{money.format(hoveredDay.revenue)} ₫</b>
                  </div>
                ) : (
                  <span className="admin-preview-badge">Rê chuột vào điểm để xem chi tiết</span>
                )}
              </div>

              {chartType === 'area' || chartType === 'line' ? (
                revenue.length === 0 ? (
                  <p className="admin-empty">Chưa có giao dịch đã thanh toán trong kỳ này.</p>
                ) : (
                  <div className="statistics-enhanced-svg">
                    <div className="statistics-y-axis">
                      <span>{compactVnd(highest)}</span>
                      <span>{compactVnd(highest * 0.5)}</span>
                      <span>0</span>
                    </div>
                    <div className="statistics-svg-body">
                      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Biểu đồ doanh thu theo ngày">
                        <defs>
                          <linearGradient id="statsAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#4ade80" stopOpacity="0.42" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.03" />
                          </linearGradient>
                        </defs>
                        {[0, 0.5, 1].map((ratio) => {
                          const gy = padTop + usableH * ratio
                          return <line key={ratio} x1="0" y1={gy} x2={chartWidth} y2={gy} className="statistics-gridline" />
                        })}
                        {chartType === 'area' && <polygon points={areaPoints} fill="url(#statsAreaGrad)" />}
                        <polyline points={linePoints} className="statistics-line-stroke" />
                        {coords.map(({ x, y, day }) => (
                          <g
                            key={day.date}
                            className="statistics-point-group"
                            onMouseEnter={() => setHoveredDay(day)}
                            onMouseLeave={() => setHoveredDay(null)}
                          >
                            <circle cx={x} cy={y} r="14" fill="transparent" />
                            <circle cx={x} cy={y} r={hoveredDay?.date === day.date ? '6' : '4.5'} className="statistics-point-dot" />
                          </g>
                        ))}
                      </svg>
                      <div className="admin-svg-labels">
                        {revenue.map((day) => <small key={day.date}>{dateOnlyLabel(day.date, true)}</small>)}
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <div className="statistics-visual">
                  <Chart
                    revenue={revenue}
                    statuses={orderStatuses}
                    chartType={chartType}
                    en={false}
                    highest={highest}
                    chartWidth={chartWidth}
                    chartHeight={chartHeight}
                    linePoints={linePoints}
                    areaPoints={areaPoints}
                    currency={money}
                    overview={report}
                  />
                </div>
              )}
            </div>

            <div className="statistics-status-card">
              <div className="statistics-card-head">
                <div>
                  <h3>Cơ cấu trạng thái đơn</h3>
                  <small>{allOrders} đơn trong kỳ</small>
                </div>
              </div>
              {orderStatuses.length > 0 ? (
                <div className="admin-status-list">
                  {orderStatuses.map((item) => {
                    const pct = Math.round((Number(item.count || 0) / totalStatusCount) * 100)
                    return (
                      <div className="admin-status-row" key={item.status}>
                        <span title={statusLabel(item.status)}>{statusLabel(item.status)}</span>
                        <div><i style={{ '--status-width': `${Math.max(6, (Number(item.count || 0) / maxStatusCount) * 100)}%` }} /></div>
                        <b>{item.count} ({pct}%)</b>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="admin-empty">Chưa có đơn hàng trong kỳ.</p>
              )}
              <div className="statistics-basis-box">
                <p>{report.basis}</p>
                {(Number(report.excludedDemoOrders || 0) > 0 || Number(report.undatedOrders || 0) > 0) && (
                  <p>Đã loại {report.excludedDemoOrders} bản ghi mô phỏng; {report.undatedOrders} bản ghi thiếu ngày hợp lệ.</p>
                )}
              </div>
            </div>
          </div>

          {/* Bảng chi tiết theo ngày */}
          <div className="statistics-table-section">
            <div className="statistics-table__header">
              <h3>Chi tiết theo ngày</h3>
              <span>{revenue.length} ngày có thanh toán</span>
            </div>
            <div className="admin-table-wrap">
              <table className="statistics-detail-table">
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Số đơn</th>
                    <th>Doanh thu gộp</th>
                    <th>Hoàn tiền</th>
                    <th>Doanh thu ròng</th>
                  </tr>
                </thead>
                <tbody>
                  {revenue.map((day) => (
                    <tr key={day.date}>
                      <td><strong>{dateOnlyLabel(day.date)}</strong></td>
                      <td>{day.orders} đơn</td>
                      <td>{money.format(day.grossRevenue)} ₫</td>
                      <td className={Number(day.refunds || 0) > 0 ? 'statistics-cell-refund' : ''}>{money.format(day.refunds)} ₫</td>
                      <td className="statistics-cell-net"><strong>{money.format(day.revenue)} ₫</strong></td>
                    </tr>
                  ))}
                  {revenue.length === 0 && (
                    <tr><td colSpan="5" className="admin-empty">Chưa có dữ liệu theo ngày trong khoảng đã chọn.</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Tổng cộng</th>
                    <td><strong>{paidOrders} đơn</strong></td>
                    <td><strong>{money.format(gross)} ₫</strong></td>
                    <td><strong>{money.format(refunds)} ₫</strong></td>
                    <td className="statistics-cell-net"><strong>{money.format(net)} ₫</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
