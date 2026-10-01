import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthProvider } from './providers/AuthProvider'
import { WalletProvider } from './providers/WalletProvider'
import './styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletProvider><AuthProvider><App /></AuthProvider></WalletProvider>
  </StrictMode>,
)
