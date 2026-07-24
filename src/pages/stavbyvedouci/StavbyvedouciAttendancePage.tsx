import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Card } from '@/components/ui/Card'
import { todayIsoDate } from '@/lib/dates'
import {
  fetchAssignedProjectsWithMarkers,
  fetchWorkersForAssignedOrder,
  insertStavbyvedouciAttendance,
} from '@/lib/stavbyvedouci/api'

export function StavbyvedouciAttendancePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [orders, setOrders] = useState<{ value: string; label: string }[]>([])
  const [workers, setWorkers] = useState<{ value: string; label: string }[]>([])
  const [orderId, setOrderId] = useState('')
  const [workerId, setWorkerId] = useState('')
  const [date, setDate] = useState(todayIsoDate())
  const [workStart, setWorkStart] = useState('')
  const [workEnd, setWorkEnd] = useState('')
  const [breakMinutes, setBreakMinutes] = useState('0')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    void fetchAssignedProjectsWithMarkers().then((items) => {
      const options = items.map((item) => ({
        value: item.project_id,
        label: `${item.order.name} – ${item.order.location}`,
      }))
      setOrders(options)
      const prefill = searchParams.get('orderId')
      if (prefill && options.some((option) => option.value === prefill)) {
        setOrderId(prefill)
      } else if (options.length === 1) {
        setOrderId(options[0].value)
      }
    })
  }, [searchParams])

  const loadWorkers = useCallback(async (selectedOrderId: string) => {
    if (!selectedOrderId) {
      setWorkers([])
      return
    }
    const rows = await fetchWorkersForAssignedOrder(selectedOrderId)
    setWorkers(rows.map((row) => ({ value: row.id, label: row.full_name })))
  }, [])

  useEffect(() => {
    void loadWorkers(orderId)
  }, [orderId, loadWorkers])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (!orderId || !workerId) {
      setError('Vyberte zakázku a pracovníka')
      return
    }
    setLoading(true)
    try {
      await insertStavbyvedouciAttendance({
        worker_id: workerId,
        order_id: orderId,
        attendance_date: date,
        work_start: workStart,
        work_end: workEnd,
        break_minutes: Number(breakMinutes) || 0,
        note,
      })
      setSuccess('Docházka byla uložena.')
      setWorkStart('')
      setWorkEnd('')
      setBreakMinutes('0')
      setNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení docházky se nezdařilo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <Button variant="ghost" className="mb-4 min-h-[44px]" onClick={() => navigate('/stavbyvedouci')}>
        <ArrowLeft className="h-4 w-4" />
        Zpět
      </Button>

      <PageHeader
        title="Zapsat docházku"
        description="Evidence přítomnosti – bez zobrazení mezd a ceníků."
      />

      <Card className="mx-auto max-w-3xl p-4">
        <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
          <Select
            label="Zakázka"
            options={[{ value: '', label: 'Vyberte zakázku…' }, ...orders]}
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            required
          />
          <Select
            label="Pracovník"
            options={[{ value: '', label: 'Vyberte pracovníka…' }, ...workers]}
            value={workerId}
            onChange={(event) => setWorkerId(event.target.value)}
            required
          />
          <Input label="Datum" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Příchod"
              type="time"
              value={workStart}
              onChange={(event) => setWorkStart(event.target.value)}
              required
            />
            <Input
              label="Odchod"
              type="time"
              value={workEnd}
              onChange={(event) => setWorkEnd(event.target.value)}
              required
            />
          </div>
          <Input
            label="Přestávka (min)"
            type="number"
            min={0}
            value={breakMinutes}
            onChange={(event) => setBreakMinutes(event.target.value)}
          />
          <Textarea label="Poznámka" value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {success ? <p className="text-sm text-green-300">{success}</p> : null}
          <Button type="submit" className="min-h-[48px] w-full" disabled={loading}>
            {loading ? 'Ukládám…' : 'Uložit docházku'}
          </Button>
        </form>
      </Card>
    </AppLayout>
  )
}
