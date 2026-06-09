import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import MainMap from './MainMap.tsx'
import AppLayout from './layout.tsx'
import { MapInteractionProvider } from './MapInteractionContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MapInteractionProvider>
      <AppLayout>
        <MainMap />
      </AppLayout>
    </MapInteractionProvider>
  </StrictMode>,
)
