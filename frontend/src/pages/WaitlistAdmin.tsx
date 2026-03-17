import { useState, useEffect, useCallback } from 'react'
import { waitlistApi } from '../api/client'
import styles from './WaitlistAdmin.module.css'

const STORAGE_KEY = 'krexa_admin_key'

interface Entry {
  id: string
  email: string
  walletAddress: string | null
  createdAt: string
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function WaitlistAdmin() {
  const [apiKey, setApiKey]     = useState(() => sessionStorage.getItem(STORAGE_KEY) ?? '')
  const [keyInput, setKeyInput] = useState('')
  const [authed, setAuthed]     = useState(false)

  const [entries, setEntries]   = useState<Entry[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [search, setSearch]     = useState('')

  const load = useCallback(async (key: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await waitlistApi.all(key)
      setEntries(res.data.entries)
      setTotal(res.data.total)
      setAuthed(true)
      sessionStorage.setItem(STORAGE_KEY, key)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 401) {
        setError('Invalid API key')
        setAuthed(false)
      } else {
        setError('Failed to load entries')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (apiKey) load(apiKey)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleKeySubmit(e: React.FormEvent) {
    e.preventDefault()
    const key = keyInput.trim()
    if (!key) return
    setApiKey(key)
    await load(key)
  }

  async function handleExport() {
    try {
      const res = await waitlistApi.exportCsv(apiKey)
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `waitlist-${new Date().toISOString().slice(0,10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Export failed')
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(STORAGE_KEY)
    setApiKey('')
    setAuthed(false)
    setEntries([])
  }

  const filtered = entries.filter(e =>
    e.email.toLowerCase().includes(search.toLowerCase()) ||
    (e.walletAddress?.toLowerCase().includes(search.toLowerCase()) ?? false)
  )

  if (!authed) {
    return (
      <div className={styles.page}>
        <div className={styles.loginBox}>
          <h1 className={styles.loginTitle}>Admin — Waitlist</h1>
          <p className={styles.loginSub}>Enter your API key to view waitlist entries</p>
          {error && <p className={styles.errorMsg}>{error}</p>}
          <form onSubmit={handleKeySubmit} className={styles.loginForm}>
            <input
              type="password"
              className={styles.keyInput}
              placeholder="API key (tck_...)"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              autoFocus
            />
            <button type="submit" className={styles.loginBtn} disabled={loading || !keyInput.trim()}>
              {loading ? 'Checking...' : 'Access'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Waitlist</h1>
          <p className={styles.subtitle}>{total.toLocaleString()} signups</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.refreshBtn} onClick={() => load(apiKey)} disabled={loading}>
            {loading ? '...' : 'Refresh'}
          </button>
          <button className={styles.exportBtn} onClick={handleExport}>
            Export CSV
          </button>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>

      {error && <p className={styles.errorMsg}>{error}</p>}

      <div className={styles.searchBar}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search by email or wallet..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <span className={styles.searchCount}>{filtered.length} of {total}</span>
        )}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Email</th>
              <th>Wallet</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={4} className={styles.emptyCell}>No entries found</td></tr>
            )}
            {filtered.map((e, i) => (
              <tr key={e.id}>
                <td className={styles.numCell}>{i + 1}</td>
                <td className={styles.emailCell}>{e.email}</td>
                <td className={styles.walletCell}>
                  {e.walletAddress
                    ? <span title={e.walletAddress}>{e.walletAddress.slice(0,6)}...{e.walletAddress.slice(-4)}</span>
                    : <span className={styles.na}>—</span>
                  }
                </td>
                <td className={styles.dateCell}>{fmt(e.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
