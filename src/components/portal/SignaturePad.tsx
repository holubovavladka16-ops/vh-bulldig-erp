import { useRef, useEffect, useState } from 'react'
import { Eraser } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface SignaturePadProps {
  value: string | null
  onChange: (dataUrl: string | null) => void
  disabled?: boolean
}

export function SignaturePad({ value, onChange, disabled }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasStroke, setHasStroke] = useState(Boolean(value))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#ffffff'

    if (value) {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height)
        setHasStroke(true)
      }
      img.src = value
    }
  }, [value])

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      const touch = e.touches[0]
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    if (disabled) return
    e.preventDefault()
    drawing.current = true
    const ctx = canvasRef.current?.getContext('2d')
    const pos = getPos(e)
    ctx?.beginPath()
    ctx?.moveTo(pos.x, pos.y)
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current || disabled) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    const pos = getPos(e)
    ctx?.lineTo(pos.x, pos.y)
    ctx?.stroke()
    setHasStroke(true)
  }

  function endDraw() {
    if (!drawing.current) return
    drawing.current = false
    const canvas = canvasRef.current
    if (canvas) onChange(canvas.toDataURL('image/png'))
  }

  function clear() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasStroke(false)
    onChange(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-theme-secondary">Podpis zaměstnance</label>
        {!disabled && (
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            <Eraser className="h-4 w-4" />
            Vymazat
          </Button>
        )}
      </div>
      <canvas
        ref={canvasRef}
        className="h-48 w-full touch-none rounded-xl border border-[var(--border-glass)] bg-[var(--surface-input)] sm:h-36"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      {!hasStroke && !disabled && (
        <p className="text-xs text-theme-muted">Podepište se prstem nebo myší.</p>
      )}
    </div>
  )
}
