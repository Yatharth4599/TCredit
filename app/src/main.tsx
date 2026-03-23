// Polyfills MUST run before any Solana imports
import { Buffer } from 'buffer'
window.Buffer = Buffer
window.global = window
window.process = window.process || ({ env: {} } as any)

// Dynamic import ensures polyfills are set up before React/Solana code loads
import('./index.css')
import('./bootstrap')
  .then(({ bootstrap }) => bootstrap())
  .catch((err) => {
    document.getElementById('root')!.innerHTML =
      `<pre style="color:red;padding:2rem">Boot error: ${err?.stack || err}</pre>`
  })
