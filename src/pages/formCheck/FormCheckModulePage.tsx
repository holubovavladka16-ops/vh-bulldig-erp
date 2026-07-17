import { useCallback, useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { FormCheckConfirmScreen } from '@/components/formCheck/FormCheckConfirmScreen'
import { FormCheckErrorPanel } from '@/components/formCheck/FormCheckErrorPanel'
import { FormCheckNextPhasePlaceholder } from '@/components/formCheck/FormCheckNextPhasePlaceholder'
import { QrScannerView } from '@/components/formCheck/QrScannerView'
import { resolveFormByQrPayload } from '@/lib/formCheck/api'
import {
  createInitialFormCheckState,
  transitionToCapture,
  transitionToConfirm,
  transitionToError,
  transitionToScan,
} from '@/lib/formCheck/workflow'
import type { FormCheckWorkflowState } from '@/types/formCheck'

export function FormCheckModulePage() {
  const [state, setState] = useState<FormCheckWorkflowState>(createInitialFormCheckState)
  const [resolving, setResolving] = useState(false)
  const [continuing, setContinuing] = useState(false)

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

  const handleBackToScan = useCallback(() => {
    setState(createInitialFormCheckState())
  }, [])

  const isScanPhase = state.phase === 'scan'
  const isNextPhase = ['capture', 'ocr', 'compare', 'result'].includes(state.phase)

  return (
    <AppLayout>
      <PageHeader
        title="Kontrola formuláře"
        description="Naskenujte QR kód z papírového měsíčního formuláře a ověřte přiřazeného zaměstnance."
      />

      <div className="mx-auto max-w-2xl space-y-4">
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

        {isNextPhase && <FormCheckNextPhasePlaceholder onBack={handleBackToScan} />}
      </div>
    </AppLayout>
  )
}
