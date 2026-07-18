import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ensureFreshBuildLoaded } from '@/lib/app/buildRefresh'
import './index.css'

ensureFreshBuildLoaded()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
