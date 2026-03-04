import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { AppRouter } from './routes/AppRouter'
import { getTestMessage } from './services/api'

async function bootstrap() {
  try {
    const response = await getTestMessage()
    console.log('Backend response:', response)
  } catch (error) {
    console.error('Failed to connect to backend:', error)
  }
}

void bootstrap()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  </StrictMode>,
)
