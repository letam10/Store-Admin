import { canOpenModule, operationalExportModules } from '../../services/adminAccess'

export default function OperationalExportButton({ module, role }) {
  if (!operationalExportModules.has(module) || !canOpenModule(role, module)) return null
  return <div className="admin-module-toolbar">
    <a className="button" href={`/api/admin/exports/${encodeURIComponent(module)}.xlsx`}>Xuất Excel toàn bộ danh sách</a>
  </div>
}
