import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { AppRouter } from './routes/AppRouter'
import { setUpInstalledApp } from './pwa'
import { startSendingWaitingReports } from './services/offlineReports'
import { addNotification } from './services/notifications'

setUpInstalledApp()
startSendingWaitingReports((count) =>
  addNotification(`${count} report${count === 1 ? '' : 's'} saved on this phone ${count === 1 ? 'was' : 'were'} sent.`),
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  </StrictMode>,
)
