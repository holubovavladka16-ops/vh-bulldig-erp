import { type TextareaHTMLAttributes, forwardRef, useCallback, useEffect, useRef } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
  /** Automaticky zvětší výšku podle obsahu (výchozí: true) */
  autoGrow?: boolean
}

function resizeTextarea(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${Math.max(el.scrollHeight, 100)}px`
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, autoGrow = true, className = '', id, value, onChange, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    const innerRef = useRef<HTMLTextAreaElement | null>(null)

    const setRefs = useCallback(
      (node: HTMLTextAreaElement | null) => {
        innerRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      },
      [ref]
    )

    useEffect(() => {
      if (!autoGrow || !innerRef.current) return
      resizeTextarea(innerRef.current)
    }, [autoGrow, value])

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-theme-secondary">
            {label}
          </label>
        )}
        <textarea
          ref={setRefs}
          id={inputId}
          value={value}
          onChange={(e) => {
            if (autoGrow) resizeTextarea(e.currentTarget)
            onChange?.(e)
          }}
          className={`
            input-glass w-full rounded-xl px-3.5 py-2.5 text-sm resize-y min-h-[100px] overflow-hidden
            disabled:cursor-not-allowed disabled:opacity-50
            ${error ? 'border-red-400/50' : ''} ${className}
          `}
          {...props}
        />
        {hint && !error && <p className="mt-1.5 text-xs text-theme-muted">{hint}</p>}
        {error && <p className="mt-1.5 text-sm text-red-400">{error}</p>}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
