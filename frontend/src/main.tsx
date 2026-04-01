import { Buffer } from 'buffer'
window.Buffer = Buffer

import React from 'react'
import ReactDOM from 'react-dom/client'

import SolanaWalletProvider from './providers/SolanaWalletProvider'
import App from './App'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <SolanaWalletProvider>
            <App />
        </SolanaWalletProvider>
    </React.StrictMode>,
)
