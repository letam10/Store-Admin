/**
 * Tệp: server/src/mailer.js
 * Mục đích: Gửi mail reset-password. Không thêm dep: SMTP tối giản qua node:net/tls, fallback log console khi chưa cấu hình.
 */
import { connect as tlsConnect } from 'node:tls'
import { connect as netConnect } from 'node:net'

function smtpConfig() {
  return {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.EMAIL_FROM || 'Store <no-reply@store.local>',
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
  }
}

export function mailerStatus() {
  const cfg = smtpConfig()
  return { configured: Boolean(cfg.host), host: cfg.host, port: cfg.port, from: cfg.from }
}

function readReply(socket) {
  return new Promise((resolve, reject) => {
    let buffer = ''
    const onData = (chunk) => {
      buffer += chunk.toString('utf8')
      if (/\r\n\d{3}[ ]/.test(buffer) || /\r\n\d{3}-\S[\s\S]*\r\n\d{3} /.test(buffer) || /^\d{3} /.test(buffer)) {
        socket.off('data', onData)
        resolve(buffer)
      }
    }
    socket.on('data', onData)
    socket.once('error', reject)
  })
}

async function sendSmtp({ host, port, user, pass, from, to, subject, text, html }) {
  const socket = await new Promise((resolve, reject) => {
    const sock = netConnect({ host, port, timeout: 10000 }, () => resolve(sock))
    sock.once('error', reject)
    sock.once('timeout', () => reject(new Error('SMTP_TIMEOUT')))
  })
  const cmd = async (text) => {
    socket.write(text + '\r\n')
    const reply = await readReply(socket)
    return reply
  }
  await readReply(socket)
  await cmd('EHLO store-local')
  // STARTTLS nếu server quảng cáo (cổng 587 thường cần)
  // Gửi mail dạng tối giản, hỗ trợ AUTH LOGIN khi có user/pass.
  const caps = await cmd('EHLO store-local')
  if (/STARTTLS/i.test(caps) && port === 587) {
    await cmd('STARTTLS')
    const tlsSocket = tlsConnect({ socket, host, servername: host })
    await new Promise((resolve, reject) => {
      tlsSocket.once('secureConnect', resolve)
      tlsSocket.once('error', reject)
    })
    // Tái sử dụng socket TLS cho các lệnh tiếp theo
    tlsSocket.write('EHLO store-local\r\n')
    await readReply(tlsSocket)
    if (user) {
      await cmdTls(tlsSocket, 'AUTH LOGIN')
      await cmdTls(tlsSocket, Buffer.from(user).toString('base64'))
      await cmdTls(tlsSocket, Buffer.from(pass).toString('base64'))
    }
    await cmdTls(tlsSocket, 'MAIL FROM:<' + extractEmail(from) + '>')
    await cmdTls(tlsSocket, 'RCPT TO:<' + extractEmail(to) + '>')
    await cmdTls(tlsSocket, 'DATA')
    tlsSocket.write(buildMessage({ from, to, subject, text, html }) + '\r\n.\r\n')
    await readReply(tlsSocket)
    await cmdTls(tlsSocket, 'QUIT')
    tlsSocket.end()
    return true
  }
  if (user) {
    await cmd('AUTH LOGIN')
    await cmd(Buffer.from(user).toString('base64'))
    await cmd(Buffer.from(pass).toString('base64'))
  }
  await cmd('MAIL FROM:<' + extractEmail(from) + '>')
  await cmd('RCPT TO:<' + extractEmail(to) + '>')
  await cmd('DATA')
  socket.write(buildMessage({ from, to, subject, text, html }) + '\r\n.\r\n')
  await readReply(socket)
  await cmd('QUIT')
  socket.end()
  return true
}

async function cmdTls(socket, text) {
  socket.write(text + '\r\n')
  return readReply(socket)
}

function extractEmail(value) {
  const match = String(value || '').match(/<([^>]+)>/)
  return (match ? match[1] : String(value || '')).trim()
}

function buildMessage({ from, to, subject, text, html }) {
  const boundary = 'store-' + Date.now().toString(36)
  if (!html) {
    return ['From: ' + from, 'To: ' + to, 'Subject: ' + subject, 'Content-Type: text/plain; charset=utf-8', '', text].join('\r\n')
  }
  return ['From: ' + from, 'To: ' + to, 'Subject: ' + subject, 'MIME-Version: 1.0', 'Content-Type: multipart/alternative; boundary="' + boundary + '"', '',
    '--' + boundary, 'Content-Type: text/plain; charset=utf-8', '', text,
    '--' + boundary, 'Content-Type: text/html; charset=utf-8', '', html,
    '--' + boundary + '--'].join('\r\n')
}

export async function sendResetEmail(to, resetLink) {
  const cfg = smtpConfig()
  const subject = '[Store] Dat lai mat khau (het han sau 30 phut)'
  const text = 'Ban vua yeu cau dat lai mat khau Store.\n\nLink (30 phut): ' + resetLink + '\n\nNeu khong phai ban, hay bo qua email nay.'
  const html = '<p>Bạn vừa yêu cầu đặt lại mật khẩu Store.</p><p><a href="' + resetLink + '">Đặt lại mật khẩu (30 phút)</a></p><p>Nếu không phải bạn, hãy bỏ qua email này.</p>'
  if (!cfg.host) {
    console.log('[Store mailer] SMTP_HOST chưa cấu hình — link reset cho ' + to + ': ' + resetLink)
    return { delivered: false, preview: resetLink }
  }
  try {
    await sendSmtp({ ...cfg, to, subject, text, html })
    return { delivered: true }
  } catch (error) {
    console.error('[Store mailer] Gửi mail thất bại:', error.message, '— link fallback:', resetLink)
    return { delivered: false, preview: resetLink, error: error.message }
  }
}
