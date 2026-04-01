import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

export function bootstrap() {
  try {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    )
  } catch (err: any) {
    document.getElementById('root')!.innerHTML =
      `<pre style="color:red;padding:2rem">${err?.stack || err}</pre>`
  }
}

// Also catch unhandled errors that happen during render
window.addEventListener('error', (e) => {
  const root = document.getElementById('root')
  if (root && !root.children.length) {
    root.innerHTML = `<pre style="color:red;padding:2rem">Uncaught: ${e.message}\n${e.filename}:${e.lineno}</pre>`
  }
})
