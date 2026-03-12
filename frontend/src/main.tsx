import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'

import { config } from './config/wagmi'
import App from './App'
import './styles/globals.css'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider
                    theme={(() => {
                        const t = darkTheme({
                            accentColor: '#3B82F6',
                            accentColorForeground: 'white',
                            borderRadius: 'large',
                            fontStack: 'system',
                            overlayBlur: 'small',
                        });
                        t.colors.modalBackground = '#111827';
                        t.colors.modalBorder = '#1E293B';
                        t.colors.generalBorder = '#1E293B';
                        t.colors.profileForeground = '#0B1120';
                        return t;
                    })()}
                >
                    <App />
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    </React.StrictMode>,
)
