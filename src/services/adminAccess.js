const staffModules = new Set(['support', 'returns', 'products', 'customers', 'reviews', 'customer-orders', 'inventory'])

export const operationalExportModules = new Set(['products', 'customers', 'customer-orders', 'inventory', 'support', 'returns', 'reviews'])

export function canOpenModule(role, module) {
  return role === 'admin' || (role === 'staff' && staffModules.has(module))
}

export function landingModule(role, selected = 'dashboard') {
  return canOpenModule(role, selected) ? selected : role === 'staff' ? 'support' : 'dashboard'
}
