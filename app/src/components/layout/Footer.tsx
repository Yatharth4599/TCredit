import { Link } from 'react-router-dom'

const PROGRAMS: { name: string; address: string }[] = [
  { name: 'Agent Registry', address: 'ChJjAXy7sE4d4jst9VViG7ScanVKqH9Q1cFxtdcH78cG' },
  { name: 'Credit Vault', address: '26SQx3rAyujWCupxvPAMf9N3ok4cw1awyTWAVWDQfr9N' },
  { name: 'Agent Wallet', address: '35t8yWLsUZNTLT71ej7DF59P81HrtZTx2uZeMhwuhhf6' },
  { name: 'Venue Whitelist', address: 'HyWQrHG14Sw6KpKYSMiBDmVj5u7PXfLWvim6FHbBLmua' },
  { name: 'Payment Router', address: '2Zy3d7C28Z9dfazdysKVBQUXnvvWNshxtDEFKftG83u8' },
  { name: 'Service Plan', address: 'Eqc48c6TtKAPRosTMoC6Nasi85iqdLuzwbu6WBrsPFdt' },
  { name: 'Score', address: '2GwtAXnjY5LehfZfT77ZH3XSshwbni8LP9zXeA84WUqh' },
]

function shortenAddr(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`
}

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#08080d]">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Protocol */}
          <div>
            <h4 className="text-xs font-medium text-white/30 uppercase tracking-widest mb-4">Protocol</h4>
            <ul className="space-y-2">
              <li><Link to="/" className="text-sm text-white/50 hover:text-white/80 transition-colors">Home</Link></li>
              <li><Link to="/score" className="text-sm text-white/50 hover:text-white/80 transition-colors">Score</Link></li>
              <li><Link to="/vault" className="text-sm text-white/50 hover:text-white/80 transition-colors">Vault</Link></li>
            </ul>
          </div>

          {/* Developers */}
          <div>
            <h4 className="text-xs font-medium text-white/30 uppercase tracking-widest mb-4">Developers</h4>
            <ul className="space-y-2">
              <li><Link to="/docs" className="text-sm text-white/50 hover:text-white/80 transition-colors">Docs</Link></li>
              <li><Link to="/docs" className="text-sm text-white/50 hover:text-white/80 transition-colors">SDK</Link></li>
              <li><Link to="/docs" className="text-sm text-white/50 hover:text-white/80 transition-colors">API</Link></li>
            </ul>
          </div>

          {/* Programs */}
          <div>
            <h4 className="text-xs font-medium text-white/30 uppercase tracking-widest mb-4">Programs</h4>
            <ul className="space-y-2">
              {PROGRAMS.map(p => (
                <li key={p.address} className="flex items-center gap-2 text-sm">
                  <span className="text-white/40">{p.name}</span>
                  <a
                    href={`https://explorer.solana.com/address/${p.address}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-white/20 hover:text-white/50 transition-colors text-xs"
                  >
                    {shortenAddr(p.address)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/20">Built on Solana</p>
          <div className="flex items-center gap-4">
            <a href="https://x.com/krexa_xyz" target="_blank" rel="noopener noreferrer" className="text-white/20 hover:text-white/50 transition-colors" aria-label="X (Twitter)">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <p className="text-xs text-white/20">&copy; {new Date().getFullYear()} Krexa Protocol. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
