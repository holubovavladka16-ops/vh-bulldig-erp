/** Tabulky a entity, které se při bezpečném mazání testovacích dat NIKDY nemažou. */
export const PRESERVED_ENTITIES = [
  'workers',
  'profiles',
  'company_settings',
  'app_settings',
  'erp_modules',
  'worker_price_items',
] as const

/**
 * Obsahové / testovací tabulky ke smazání (pořadí: závislé dříve).
 * Zaměstnanci (workers) zde nejsou – zůstávají zachováni.
 */
export const SAFE_TEST_DATA_TABLES = [
  'form_check_records',
  'paper_monthly_import_log',
  'paper_monthly_form_lines',
  'paper_monthly_forms',
  'worker_form_task_items',
  'worker_form_photos',
  'worker_reports',
  'worker_attendance_records',
  'worker_history',
  'worker_statistics',
  'worker_daily_forms',
  'worker_documents',
  'receipts',
  'utility_connections',
  'construction_diary_entries',
  'gps_photo_history',
  'gps_photos',
  'construction_point_history',
  'construction_point_notes',
  'construction_points',
  'job_cost_photos',
  'job_cost_documents',
  'job_costs',
  'job_order_invoices',
  'job_order_photos',
  'job_order_documents',
  'excavation_routes',
  'job_orders',
  'login_logs',
  'attendance',
  'payroll',
  'invoices',
  'orders',
  'projects',
  'employees',
  'warehouse_items',
  'warehouses',
  'documents',
  'vehicles',
  'reports',
] as const

/** Tabulky zahrnuté do exportu databáze a Excelu. */
export const EXPORT_TABLES = [
  'workers',
  'worker_price_items',
  'job_orders',
  'worker_attendance_records',
  'worker_daily_forms',
  'worker_reports',
  'paper_monthly_forms',
  'paper_monthly_form_lines',
  'form_check_records',
  'receipts',
  'job_costs',
  'utility_connections',
  'construction_diary_entries',
  'gps_photos',
  'construction_points',
  'company_settings',
  'app_settings',
  'profiles',
] as const

export const STORAGE_BUCKETS_TO_CLEAN = [
  'worker-documents',
  'worker-photos',
  'order-documents',
  'order-photos',
  'gps-photos',
  'cost-photos',
  'cost-documents',
  'receipt-photos',
  'paper-forms',
  'excavation-routes',
] as const

export const STORAGE_PATH_SOURCES = [
  { table: 'worker_documents', column: 'file_path', bucket: 'worker-documents' },
  { table: 'worker_form_photos', column: 'file_path', bucket: 'worker-photos' },
  { table: 'job_order_documents', column: 'file_path', bucket: 'order-documents' },
  { table: 'job_order_photos', column: 'file_path', bucket: 'order-photos' },
  { table: 'gps_photos', column: 'file_path', bucket: 'gps-photos' },
  { table: 'job_cost_photos', column: 'file_path', bucket: 'cost-photos' },
  { table: 'job_cost_documents', column: 'file_path', bucket: 'cost-documents' },
  { table: 'receipts', column: 'photo_path', bucket: 'receipt-photos' },
  { table: 'paper_monthly_forms', column: 'blank_pdf_path', bucket: 'paper-forms' },
  { table: 'paper_monthly_forms', column: 'scanned_photo_path', bucket: 'paper-forms' },
  { table: 'paper_monthly_forms', column: 'signed_pdf_path', bucket: 'paper-forms' },
  { table: 'form_check_records', column: 'photo_path', bucket: 'paper-forms' },
] as const

export const TEST_DATA_CONFIRM_PHRASE = 'VYMAZAT TESTOVACÍ DATA'

export const PRESERVED_ENTITY_LABELS: Record<(typeof PRESERVED_ENTITIES)[number], string> = {
  workers: 'Zaměstnanci',
  profiles: 'Uživatelé (profily)',
  company_settings: 'Nastavení společnosti',
  app_settings: 'Nastavení aplikace',
  erp_modules: 'Registr modulů ERP',
  worker_price_items: 'Ceníky zaměstnanců',
}
