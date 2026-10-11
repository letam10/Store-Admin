/**
 * Tệp: server/src/google.js
 * Mục đích: Google OAuth code-flow thủ công bằng fetch (không thêm dep), verify ID token tối giản.
 */
export function googleConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://127.0.0.1:3001/api/customer/google/callback',
    frontendUrl: (process.env.FRONTEND_URL || 'http://127.0.0.1:5173').replace(/\/+$/, ''),
  }
}

export function googleStatus() {
  const cfg = googleConfig()
  return { configured: Boolean(cfg.clientId && cfg.clientSecret), redirectUri: cfg.redirectUri }
}

export function buildGoogleAuthUrl(state) {
  const cfg = googleConfig()
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state,
  })
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString()
}

export async function exchangeGoogleCode(code) {
  const cfg = googleConfig()
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error('GOOGLE_TOKEN_FAILED: ' + (data.error_description || data.error || res.status))
  return data
}

export async function fetchGoogleProfile(accessToken) {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: 'Bearer ' + accessToken },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error('GOOGLE_PROFILE_FAILED')
  if (!data.email || !data.email_verified) throw new Error('GOOGLE_EMAIL_UNVERIFIED')
  return { sub: String(data.sub || ''), email: String(data.email).toLowerCase(), name: String(data.name || data.email) }
}
