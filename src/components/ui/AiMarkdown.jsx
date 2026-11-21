/*
  FILE NOTE
  - Mục đích: Component render Markdown gọn nhẹ, an toàn (không dùng dangerouslySetInnerHTML) cho Khung Chat AI Cục bộ: hỗ trợ **in đậm**, *in nghiêng*, `code`, ![ảnh sản phẩm](url), [link](url), danh sách và bảng so sánh.
*/
import React from 'react'

function renderInline(text, keyPrefix) {
  const parts = []
  const regex = /(!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`)/g
  let lastIndex = 0
  let match
  let idx = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    if (match[2] !== undefined && match[3]) {
      parts.push(
        <span key={`${keyPrefix}-img-${idx++}`} className="ai-md-img-wrap">
          <img src={match[3]} alt={match[2] || 'Sản phẩm'} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none' }} />
        </span>
      )
    } else if (match[4] && match[5]) {
      const href = /^(https?:\/\/|\/)/i.test(match[5]) ? match[5] : '#'
      parts.push(
        <a key={`${keyPrefix}-a-${idx++}`} href={href} target={href.startsWith('http') ? '_blank' : '_self'} rel="noopener noreferrer" className="ai-md-link">
          {match[4]}
        </a>
      )
    } else if (match[6]) {
      parts.push(<strong key={`${keyPrefix}-b-${idx++}`}>{match[6]}</strong>)
    } else if (match[7]) {
      parts.push(<code key={`${keyPrefix}-c-${idx++}`} className="ai-md-code">{match[7]}</code>)
    }
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

export default function AiMarkdown({ text }) {
  const raw = String(text || '').trim()
  if (!raw) return null

  const lines = raw.split('\n')
  const blocks = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) { i++; continue }

    // Bảng Markdown | col1 | col2 |
    if (line.startsWith('|') && i + 1 < lines.length && /^\|?[\s:-]+\|/.test(lines[i + 1].trim())) {
      const parseRow = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
      const headers = parseRow(lines[i])
      i += 2
      const bodyRows = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        bodyRows.push(parseRow(lines[i]))
        i++
      }
      blocks.push(
        <div key={`tbl-${i}`} className="ai-md-table-wrap">
          <table className="ai-md-table">
            <thead><tr>{headers.map((h, hi) => <th key={hi}>{renderInline(h, `th-${i}-${hi}`)}</th>)}</tr></thead>
            <tbody>{bodyRows.map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{renderInline(cell, `td-${i}-${ri}-${ci}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )
      continue
    }

    // Tiêu đề ### / ##
    const headMatch = line.match(/^(#{1,3})\s+(.+)/)
    if (headMatch) {
      blocks.push(<h4 key={`h-${i}`} className="ai-md-heading">{renderInline(headMatch[2], `h-${i}`)}</h4>)
      i++
      continue
    }

    // Danh sách gạch đầu dòng hoặc số thứ tự
    if (/^([-•*]|\d+\.)\s+/.test(line)) {
      const isOrdered = /^\d+\.\s+/.test(line)
      const listItems = []
      while (i < lines.length && /^([-•*]|\d+\.)\s+/.test(lines[i].trim())) {
        const cleanItem = lines[i].trim().replace(/^([-•*]|\d+\.)\s+/, '')
        listItems.push(<li key={`li-${i}`}>{renderInline(cleanItem, `li-${i}`)}</li>)
        i++
      }
      blocks.push(isOrdered ? <ol key={`ol-${i}`} className="ai-md-list">{listItems}</ol> : <ul key={`ul-${i}`} className="ai-md-list">{listItems}</ul>)
      continue
    }

    // Đoạn văn bình thường
    const paraLines = []
    while (i < lines.length && lines[i].trim() && !/^([-•*]|\d+\.|#{1,3})\s+/.test(lines[i].trim()) && !lines[i].trim().startsWith('|')) {
      paraLines.push(lines[i])
      i++
    }
    blocks.push(
      <p key={`p-${i}`} className="ai-md-p">
        {paraLines.map((pl, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <br />}
            {renderInline(pl, `p-${i}-${idx}`)}
          </React.Fragment>
        ))}
      </p>
    )
  }

  return <div className="ai-md-root">{blocks}</div>
}
