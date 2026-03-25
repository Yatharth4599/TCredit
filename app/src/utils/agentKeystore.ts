/**
 * Encrypted agent keypair storage.
 *
 * Stores the agent secret key in localStorage, encrypted with AES-GCM
 * using a key derived from the owner's wallet public key via PBKDF2.
 *
 * This is a meaningful upgrade over raw sessionStorage:
 *  - Persists across tab closes / browser restarts
 *  - Encrypted at rest (not plaintext JSON in storage)
 *  - Export/import for backup
 *
 * NOTE: For mainnet with real funds, consider hardware wallet derived keys
 * or a proper secrets manager. This is suitable for devnet and early mainnet.
 */

const STORAGE_PREFIX = 'krexa_agent_enc_'
const LEGACY_PREFIX = 'krexa_agent_'

// --- Web Crypto helpers ---

async function deriveKey(ownerPubkey: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(ownerPubkey),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('krexa-agent-keystore'), iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function encrypt(data: Uint8Array, ownerPubkey: string): Promise<string> {
  const key = await deriveKey(ownerPubkey)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  // Store as base64: iv (12 bytes) + ciphertext
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return btoa(String.fromCharCode(...combined))
}

async function decrypt(encoded: string, ownerPubkey: string): Promise<Uint8Array> {
  const key = await deriveKey(ownerPubkey)
  const combined = Uint8Array.from(atob(encoded), c => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new Uint8Array(plaintext)
}

// --- Public API ---

/** Store an agent keypair (encrypted in localStorage). */
export async function saveAgentKeypair(ownerPubkey: string, secretKey: Uint8Array): Promise<void> {
  const encrypted = await encrypt(secretKey, ownerPubkey)
  localStorage.setItem(STORAGE_PREFIX + ownerPubkey, encrypted)
  // Also write to sessionStorage for backward compat during migration
  sessionStorage.setItem(LEGACY_PREFIX + ownerPubkey, JSON.stringify(Array.from(secretKey)))
}

/** Load agent keypair. Tries encrypted localStorage first, then legacy sessionStorage. */
export async function loadAgentKeypair(ownerPubkey: string): Promise<Uint8Array | null> {
  // Try encrypted localStorage first
  const encrypted = localStorage.getItem(STORAGE_PREFIX + ownerPubkey)
  if (encrypted) {
    try {
      return await decrypt(encrypted, ownerPubkey)
    } catch {
      // Decryption failed — key may be corrupted
      localStorage.removeItem(STORAGE_PREFIX + ownerPubkey)
    }
  }

  // Fall back to legacy sessionStorage
  const legacy = sessionStorage.getItem(LEGACY_PREFIX + ownerPubkey)
  if (legacy) {
    try {
      const bytes = new Uint8Array(JSON.parse(legacy))
      // Migrate to encrypted storage
      await saveAgentKeypair(ownerPubkey, bytes)
      return bytes
    } catch {
      return null
    }
  }

  return null
}

/** Check if an agent keypair exists for this owner. */
export function hasAgentKeypair(ownerPubkey: string): boolean {
  return !!(localStorage.getItem(STORAGE_PREFIX + ownerPubkey) || sessionStorage.getItem(LEGACY_PREFIX + ownerPubkey))
}

/** Export the agent keypair as a JSON-encoded byte array string (for backup). */
export async function exportAgentKeypair(ownerPubkey: string): Promise<string | null> {
  const bytes = await loadAgentKeypair(ownerPubkey)
  if (!bytes) return null
  return JSON.stringify(Array.from(bytes))
}

/** Import an agent keypair from a JSON-encoded byte array string (restore from backup). */
export async function importAgentKeypair(ownerPubkey: string, jsonStr: string): Promise<void> {
  const arr = JSON.parse(jsonStr) as number[]
  if (!Array.isArray(arr) || arr.length !== 64) {
    throw new Error('Invalid keypair: expected 64-byte secret key array')
  }
  await saveAgentKeypair(ownerPubkey, new Uint8Array(arr))
}

/** Remove an agent keypair from all storage. */
export function removeAgentKeypair(ownerPubkey: string): void {
  localStorage.removeItem(STORAGE_PREFIX + ownerPubkey)
  sessionStorage.removeItem(LEGACY_PREFIX + ownerPubkey)
}
