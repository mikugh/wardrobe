import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { WardrobeProvider } from './store'
// Fonts are bundled with the app instead of loaded from Google Fonts, so visitors make no third-party requests.
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/fraunces/opsz.css'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <WardrobeProvider>
        <App />
      </WardrobeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
