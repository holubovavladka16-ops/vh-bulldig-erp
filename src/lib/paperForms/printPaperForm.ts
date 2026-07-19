import {
  assignPaperFormWorker,
  fetchPaperForm,
  fetchPaperFormLines,
  markPaperFormPrinted,
} from '@/lib/paperForms/api'
import { buildPaperMonthlyFormPdfBlob, getPaperFormPdfFilename } from '@/lib/paperForms/pdf'
import {
  confirmWorkerSnapshotWarnings,
  isWorkerFirstVariant,
  snapshotHasRequiredNames,
  validateWorkerSnapshotForPdf,
} from '@/lib/paperForms/workerSnapshot'
import { downloadPdfBlob } from '@/lib/print/pdfShare'
import type { CompanySettings } from '@/types'
import type { PaperFormLine, PaperMonthlyForm } from '@/types/paperForms'

export async function loadPaperFormForPrint(formId: string): Promise<{
  form: PaperMonthlyForm
  lines: PaperFormLine[]
}> {
  let form = await fetchPaperForm(formId)
  if (!form) throw new Error('Formulář nenalezen')

  if (isWorkerFirstVariant(form)) {
    if (!form.worker_id) {
      throw new Error('Varianta 1 vyžaduje vybraného zaměstnance. Přiřaďte zaměstnance před tiskem.')
    }
    if (!snapshotHasRequiredNames(form.worker_snapshot)) {
      await assignPaperFormWorker(form.id, form.worker_id)
      form = await fetchPaperForm(formId)
      if (!form) throw new Error('Formulář nenalezen po obnovení údajů zaměstnance')
    }
  }

  const lines = await fetchPaperFormLines(formId)
  return { form, lines }
}

export async function printPaperMonthlyFormPdf(
  formId: string,
  company: CompanySettings,
  options: { markPrinted?: boolean; skipOptionalConfirm?: boolean } = {}
): Promise<PaperMonthlyForm> {
  const { form, lines } = await loadPaperFormForPrint(formId)

  if (isWorkerFirstVariant(form)) {
    const validation = validateWorkerSnapshotForPdf(form.worker_snapshot)
    if (!validation.ok) {
      throw new Error(
        `Nelze vytisknout PDF — ${validation.missingRequired.join(', ')} ${validation.missingRequired.length === 1 ? 'chybí' : 'chybí'}. Doplňte kartu zaměstnance.`
      )
    }
    if (!options.skipOptionalConfirm && !confirmWorkerSnapshotWarnings(validation)) {
      throw new Error('Tisk zrušen — doplňte chybějící údaje nebo potvrďte tisk.')
    }
  }

  const blob = await buildPaperMonthlyFormPdfBlob(form, lines, company)
  downloadPdfBlob(blob, getPaperFormPdfFilename(form))

  if (options.markPrinted !== false) {
    await markPaperFormPrinted(form.id)
  }

  const refreshed = await fetchPaperForm(formId)
  return refreshed ?? form
}
