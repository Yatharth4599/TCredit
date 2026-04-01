import { Buffer } from 'buffer'

window.Buffer = Buffer
window.global = window
window.process = window.process || ({ env: {} } as any)
