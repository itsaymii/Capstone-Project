import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
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
    <div />
  </StrictMode>,
)
