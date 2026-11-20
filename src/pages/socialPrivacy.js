export function privacyForSocialPlatform(platform, selectedPrivacy = 'only_me') {
  const normalizedPlatform = String(platform || '').toLowerCase()
  const normalizedPrivacy = String(selectedPrivacy || '').toLowerCase()

  if (!['facebook', 'tiktok'].includes(normalizedPlatform)) return null
  if (!['only_me', 'public'].includes(normalizedPrivacy)) return null

  return normalizedPrivacy
}
