import { Crosshair, Layers, Maximize2 } from 'lucide-react'
import type { MapLayerMode } from '@/components/constructionPoints/ConstructionPointMapView'

interface MapToolbarProps {
  layerMode: MapLayerMode
  onLayerModeChange: (mode: MapLayerMode) => void
  onFitAll: () => void
  onMyLocation: () => void
  className?: string
}

export function MapToolbar({
  layerMode,
  onLayerModeChange,
  onFitAll,
  onMyLocation,
  className = '',
}: MapToolbarProps) {
  return (
    <div className={`photo-map-toolbar ${className}`}>
      <button
        type="button"
        className="photo-map-toolbar__btn touch-target"
        onClick={onFitAll}
        aria-label="Přizpůsobit mapu všem bodům"
      >
        <Maximize2 className="h-4 w-4" />
        <span className="hidden sm:inline">Zobrazit vše</span>
      </button>
      <button
        type="button"
        className="photo-map-toolbar__btn touch-target"
        onClick={() => void onMyLocation()}
        aria-label="Moje poloha"
      >
        <Crosshair className="h-4 w-4" />
        <span className="hidden sm:inline">Moje poloha</span>
      </button>
      <div className="photo-map-toolbar__layer-toggle">
        <button
          type="button"
          onClick={() => onLayerModeChange('satellite')}
          className={`photo-map-toolbar__layer ${layerMode === 'satellite' ? 'photo-map-toolbar__layer--active' : ''}`}
        >
          <Layers className="h-3.5 w-3.5" />
          Satelit
        </button>
        <button
          type="button"
          onClick={() => onLayerModeChange('street')}
          className={`photo-map-toolbar__layer ${layerMode === 'street' ? 'photo-map-toolbar__layer--active' : ''}`}
        >
          Mapa
        </button>
      </div>
    </div>
  )
}
