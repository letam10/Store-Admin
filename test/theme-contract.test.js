import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeTheme, presetTheme, themeVariables } from '../shared/theme.js'

test('admin theme contract normalizes invalid fields and allows presets', () => {
  const theme = normalizeTheme({ presetId: 'terracotta', defaultMode: 'dark', light: { colors: { page: 'bad' }, radius: { panel: 99 } } })
  assert.equal(theme.schemaVersion, 1)
  assert.equal(theme.presetId, 'terracotta')
  assert.equal(theme.defaultMode, 'dark')
  assert.match(theme.light.colors.page, /^#[0-9A-F]{6}$/)
  assert.equal(theme.light.radius.panel, 20)
  assert.equal(themeVariables(theme, 'dark')['--accent'], theme.dark.colors.accent)
})

test('admin theme presets return full light and dark variants', () => {
  const theme = presetTheme('olive')
  assert.equal(theme.presetId, 'olive')
  assert.equal(theme.light.radius.card, 16)
  assert.equal(theme.dark.radius.panel, 20)
})
