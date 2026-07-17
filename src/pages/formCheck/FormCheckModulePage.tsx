import { useCallback, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { FormCheckCaptureScreen } from '@/components/formCheck/FormCheckCaptureScreen'
import { FormCheckConfirmScreen } from '@/components/formCheck/FormCheckConfirmScreen'
import { FormCheckErrorPanel } from '@/components/formCheck/FormCheckErrorPanel'
import {
  FormCheckOcrErrorScreen,
  FormCheckOcrResultScreen,
} from '@/components/formCheck/FormCheckOcrResultScreen'
import { FormCheckOcrProcessing } from '@/components/formCheck/FormCheckOcrProcessing'
import { QrScannerView } from '@/components/formCheck/QrScannerView'
import { fetchFormOcrContext, resolveFormByQrPayload } from '@/lib/formCheck/api'
import { extractFormCheckFromImage } from '@/lib/formCheck/ocr'
import { uploadFormCheckScan } from '@/lib/formCheck/storage'
import {
  createInitialFormCheckState,
  transitionBackToConfirm,
  transitionOcrComplete,
  transitionOcrError,
  transitionRetakeCapture,
  transitionToCapture,
  transitionToCompare,
  transitionToConfirm,
  transitionToError,
  transitionToOcr,
  transitionToScan,
} from '@/lib/formCheck/workflow'
import type { FormCheckWorkflowState } from '@/types/formCheck'

export function FormCheckModulePage() {
  const [state, setState] = useState<FormCheckWorkflowState>(createInitialFormCheckState)
  const [resolving, setResolving] = useState(false)
  const [continuing, setContinuing] = useState(false)
  const [ocrProcessing, setOcrProcessing] = useState(false)
  const [confirmingOcr, setConfirmingOcr] = useState(false)

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

  const handleOcrConfirm = useCallback(async () => {
    setConfirmingOcr(true)
    try {
      setState((prev) => transitionToCompare(prev))
    } finally {
      setConfirmingOcr(false)
    }
  }, [])

  const isScanPhase = state.phase === 'scan'
  const isCapturePhase = state.phase === 'capture' && state.context
  const isOcrPhase = state.phase === 'ocr' && state.context

  return (
    <AppLayout>
      <PageHeader
        title="Kontrola formuláře"
        description="Naskenujte QR kód, vyfoťte formulář a zkontrolujte rozpoznané údaje z OCR."
      />

      <div className="mx-auto max-w-4xl space-y-4">
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
            confirming={confirmingOcr}
            onConfirm={handleOcrConfirm}
            onRetake={handleRetakeCapture}
            onCancel={handleCancel}
          />
        )}

        {state.phase === 'compare' && state.context && (
          <Card>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
              <div>
                <h3 className="font-semibold text-theme-primary">OCR potvrzeno</h3>
                <p className="mt-2 text-sm text-theme-secondary">
                  Výsledek OCR pro formulář {state.context.formNumber} byl potvrzen. Porovnání s
                  docházkou bude dostupné v další fázi – zatím se nic nezapisuje do docházky.
                </p>
                <Button variant="secondary" className="mt-6" onClick={handleCancel}>
                  Nové skenování
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  )
}
