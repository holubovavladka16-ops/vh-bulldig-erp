import { useEffect, useState } from 'react'

interface FieldModeHeaderProps {
  gpsActive: boolean
}

export function FieldModeHeader({ gpsActive }: FieldModeHeaderProps) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const dateLabel = now.toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  })
  const timeLabel = now.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })

  return (
    <header className="field-mode-header field-mode-header--compact">
      <div className="field-mode-header__row">
        <div className="field-mode-header__brand-block">
          <img src="/logo-bulldig.png" alt="VH Bulldig" className="field-mode-header__logo-sm" />
          <div>
            <p className="field-mode-header__title-main">Denní výkaz pracovníka</p>
            <p className="field-mode-header__subtitle">VH Bulldig ERP</p>
          </div>
        </div>
        <div className="field-mode-header__meta">
          <span className="field-mode-header__meta-line">{dateLabel}</span>
          <span className="field-mode-header__meta-line">{timeLabel}</span>
          <span className={`field-mode-header__gps ${gpsActive ? 'field-mode-header__gps--ok' : 'field-mode-header__gps--bad'}`}>
            {gpsActive ? '🟢 GPS aktivní' : '🔴 GPS nedostupná'}
          </span>
        </div>
      </div>
    </header>
  )
}
