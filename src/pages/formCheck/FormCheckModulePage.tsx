import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, History } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { FormCheckCaptureScreen } from '@/components/formCheck/FormCheckCaptureScreen'
import { FormCheckCompareProcessing } from '@/components/formCheck/FormCheckCompareProcessing'
import { FormCheckCompareScreen } from '@/components/formCheck/FormCheckCompareScreen'
import { FormCheckConfirmScreen } from '@/components/formCheck/FormCheckConfirmScreen'
import { FormCheckErrorPanel } from '@/components/formCheck/FormCheckErrorPanel'
import {
  FormCheckOcrErrorScreen,
  FormCheckOcrResultScreen,
} from '@/components/formCheck/FormCheckOcrResultScreen'
import { FormCheckOcrProcessing } from '@/components/formCheck/FormCheckOcrProcessing'
import { QrScannerView } from '@/components/formCheck/QrScannerView'
import { useAuth } from '@/context/AuthContext'
import { fetchWorkerMonthlyAttendanceForCompare } from '@/lib/formCheck/attendance'
import { compareFormWithAttendance } from '@/lib/formCheck/compare'
import { fetchFormOcrContext, resolveFormByQrPayload } from '@/lib/formCheck/api'
import { extractFormCheckFromImage } from '@/lib/formCheck/ocr'
import { saveFormCheckRecord } from '@/lib/formCheck/records'
import { uploadFormCheckScan } from '@/lib/formCheck/storage'
import {
  createInitialFormCheckState,
  transitionBackToConfirm,
  transitionCompareComplete,
  transitionCompareError,
  transitionOcrComplete,
  transitionOcrError,
  transitionRetakeCapture,
  transitionToCapture,
  transitionToConfirm,
  transitionToError,
  transitionToOcr,
  transitionToResult,
  transitionToScan,
} from '@/lib/formCheck/workflow'
import type { FormCheckWorkflowState } from '@/types/formCheck'

export function FormCheckModulePage() {
  const { user } = useAuth()
  const [state, setState] = useState<FormCheckWorkflowState>(createInitialFormCheckState)
  const [resolving, setResolving] = useState(false)
  const [continuing, setContinuing] = useState(false)
  const [ocrProcessing, setOcrProcessing] = useState(false)
  const [compareProcessing, setCompareProcessing] = useState(false)
  const [confirmingCompare, setConfirmingCompare] = useState(false)

  const handleScan = useCallback(async (payload: string) => {
    setResolving(true)
    setState((prev) => ({ ...prev, error: null }))

    try {
      const result = await resolveFormByQrPayload(payload)

      if ('error' in result) {
        setState((prev) => transitionToError(prev, result.error))
        return
      }

      setState((prev) => transitionToConfirm(prev, result.context))
    } catch {
      setState((prev) =>
        transitionToError(prev, {
          code: 'unknown',
          message: 'Neočekávaná chyba při zpracování QR kódu. Zkuste to prosím znovu.',
        })
      )
    } finally {
      setResolving(false)
    }
  }, [])

  const handleDismissError = useCallback(() => {
    setState((prev) => transitionToScan(prev))
  }, [])

  const handleCancel = useCallback(() => {
    setState(createInitialFormCheckState())
  }, [])

  const handleContinue = useCallback(async () => {
    setContinuing(true)
    try {
      setState((prev) => transitionToCapture(prev))
    } finally {
      setContinuing(false)
    }
  }, [])

  const handleCaptureCancel = useCallback(() => {
    setState((prev) => transitionBackToConfirm(prev))
  }, [])

  const runOcrPipeline = useCallback(
    async (file: File, previewUrl: string, context: NonNullable<FormCheckWorkflowState['context']>) => {
      setOcrProcessing(true)
      setState((prev) => transitionToOcr(prev, previewUrl))

      try {
        const storagePath = await uploadFormCheckScan(context.formId, file)
        const ocrContext = await fetchFormOcrContext(context.formId)

        const ocrResult = await extractFormCheckFromImage({
          file,
          formNumber: context.formNumber,
          month: ocrContext.month,
          year: ocrContext.year,
          workerName: ocrContext.workerName,
          orderLegend: ocrContext.orderLegend,
        })

        setState((prev) => transitionOcrComplete(prev, ocrResult, storagePath))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'OCR rozpoznání se nezdařilo'
        const code = message.toLowerCase().includes('nahr') ? 'upload_failed' : 'ocr_failed'
        setState((prev) =>
          transitionOcrError(prev, {
            code,
            message,
          })
        )
      } finally {
        setOcrProcessing(false)
      }
    },
    []
  )

  const runComparePipeline = useCallback(
    async (workflow: FormCheckWorkflowState) => {
      const context = workflow.context
      const ocrResult = workflow.ocrResult

      if (!context?.workerId) {
        setState((prev) =>
          transitionCompareError(prev, {
            code: 'no_worker',
            message: 'Chybí zaměstnanec pro porovnání s docházkou.',
          })
        )
        return
      }

      if (!ocrResult) {
        setState((prev) =>
          transitionCompareError(prev, {
            code: 'ocr_failed',
            message: 'Chybí výsledek OCR pro porovnání.',
          })
        )
        return
      }

      setCompareProcessing(true)

      try {
        const erpDays = await fetchWorkerMonthlyAttendanceForCompare(
          context.workerId,
          context.month,
          context.year
        )

        const comparisonResult = compareFormWithAttendance(ocrResult, erpDays)
        setState((prev) => transitionCompareComplete(prev, comparisonResult))
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Porovnání s docházkou se nezdařilo.'
        setState((prev) =>
          transitionCompareError(prev, {
            code: 'compare_failed',
            message,
          })
        )
      } finally {
        setCompareProcessing(false)
      }
    },
    []
  )

  const handleCaptured = useCallback(
    (file: File, previewUrl: string) => {
      setState((prev) => {
        if (!prev.context) return prev
        void runOcrPipeline(file, previewUrl, prev.context)
        return prev
      })
    },
    [runOcrPipeline]
  )

  const handleRetakeCapture = useCallback(() => {
    setState((prev) => transitionRetakeCapture(prev))
  }, [])

  const handleOcrConfirm = useCallback(() => {
    setState((prev) => {
      void runComparePipeline(prev)
      return { ...prev, phase: 'compare', error: null }
    })
  }, [runComparePipeline])

  const handleConfirmCheck = useCallback(async () => {
    if (!state.context?.workerId || !state.ocrResult || !state.comparisonResult || !user?.id) {
      setState((prev) =>
        transitionCompareError(prev, {
          code: 'compare_failed',
          message: 'Chybí data pro uložení výsledku kontroly.',
        })
      )
      return
    }

    setConfirmingCompare(true)
    try {
      const recordId = await saveFormCheckRecord({
        formId: state.context.formId,
        formNumber: state.context.formNumber,
        workerId: state.context.workerId,
        month: state.context.month,
        year: state.context.year,
        outcome: state.comparisonResult.outcome,
        differenceCount: state.comparisonResult.differenceCount,
        ocrConfidence: state.ocrResult.overallConfidence,
        ocrResult: state.ocrResult,
        comparisonResult: state.comparisonResult,
        photoPath: state.capturedImageStoragePath,
        checkedBy: user.id,
      })
      setState((prev) => transitionToResult(prev, recordId))
    } catch (err) {
      setState((prev) =>
        transitionCompareError(prev, {
          code: 'compare_failed',
          message: err instanceof Error ? err.message : 'Uložení výsledku kontroly se nezdařilo.',
        })
      )
    } finally {
      setConfirmingCompare(false)
    }
  }, [state, user?.id])

  const isScanPhase = state.phase === 'scan'
  const isCapturePhase = state.phase === 'capture' && state.context
  const isOcrPhase = state.phase === 'ocr' && state.context
  const isComparePhase = state.phase === 'compare' && state.context

  return (
    <AppLayout>
      <PageHeader
        title="Kontrola formuláře"
        description="Naskenujte QR kód, vyfoťte formulář, ověřte OCR a porovnejte údaje s docházkou v ERP."
        action={
          <Link
            to="/kontrola-formulare/historie"
            className="btn-neon inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium"
          >
            <History className="h-4 w-4" />
            Historie kontrol
          </Link>
        }
      />

      <div className="mx-auto max-w-5xl space-y-4">
        {state.error && isScanPhase && (
          <FormCheckErrorPanel error={state.error} onDismiss={handleDismissError} />
        )}

        {isScanPhase && (
          <QrScannerView
            active
            resolving={resolving}
            onScan={handleScan}
            error={state.error}
            onDismissError={handleDismissError}
          />
        )}

        {state.phase === 'confirm' && state.context && (
          <FormCheckConfirmScreen
            context={state.context}
            continuing={continuing}
            onContinue={handleContinue}
            onCancel={handleCancel}
          />
        )}

        {isCapturePhase && state.context && (
          <FormCheckCaptureScreen
            active
            context={state.context}
            onCaptured={handleCaptured}
            onCancel={handleCaptureCancel}
          />
        )}

        {isOcrPhase && ocrProcessing && (
          <FormCheckOcrProcessing previewUrl={state.capturedImagePreviewUrl} />
        )}

        {isOcrPhase && !ocrProcessing && state.error && (
          <FormCheckOcrErrorScreen
            message={state.error.message}
            previewUrl={state.capturedImagePreviewUrl}
            onRetake={handleRetakeCapture}
            onCancel={handleCancel}
          />
        )}

        {isOcrPhase && !ocrProcessing && !state.error && state.ocrResult && state.context && (
          <FormCheckOcrResultScreen
            context={state.context}
            result={state.ocrResult}
            previewUrl={state.capturedImagePreviewUrl}
            onConfirm={handleOcrConfirm}
            onRetake={handleRetakeCapture}
            onCancel={handleCancel}
          />
        )}

        {isComparePhase && compareProcessing && <FormCheckCompareProcessing />}

        {isComparePhase && !compareProcessing && state.error && (
          <FormCheckErrorPanel
            error={state.error}
            onDismiss={() => setState((prev) => ({ ...prev, error: null }))}
          />
        )}

        {isComparePhase &&
          !compareProcessing &&
          !state.error &&
          state.comparisonResult &&
          state.context && (
            <FormCheckCompareScreen
              context={state.context}
              result={state.comparisonResult}
              previewUrl={state.capturedImagePreviewUrl}
              saving={confirmingCompare}
              onConfirm={handleConfirmCheck}
              onRetake={handleRetakeCapture}
              onCancel={handleCancel}
            />
          )}

        {state.phase === 'result' && state.context && (
          <Card className="border-green-500/30 bg-green-500/10">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
              <div>
                <h3 className="font-semibold text-theme-primary">Kontrola uložena</h3>
                <p className="mt-2 text-sm text-theme-secondary">
                  Výsledek kontroly formuláře {state.context.formNumber} byl uložen. Docházka v ERP
                  nebyla změněna.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  {state.savedRecordId && (
                    <Link
                      to={`/kontrola-formulare/historie/${state.savedRecordId}`}
                      className="btn-neon-primary inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-medium"
                    >
                      Zobrazit detail kontroly
                    </Link>
                  )}
                  <Button variant="secondary" onClick={handleCancel}>
                    Nové skenování
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  )
}
