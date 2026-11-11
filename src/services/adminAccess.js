const staffModules = new Set(['support', 'returns', 'products', 'customers', 'reviews'])

export function canOpenModule(role, module) {
  return role === 'admin' || (role === 'staff' && staffModules.has(module))
}

export function landingModule(role, selected = 'dashboard') {
  return canOpenModule(role, selected) ? selected : role === 'staff' ? 'support' : 'dashboard'
}
