import { motion } from 'framer-motion'
import { ExternalLink } from 'lucide-react'

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

const PROGRAMS = [
  { name: 'krexa-agent-registry', address: 'ChJjAXy7sE4d4jst9VViG7ScanVKqH9Q1cFxtdcH78cG' },
  { name: 'krexa-credit-vault', address: '26SQx3rAyujWCupxvPAMf9N3ok4cw1awyTWAVWDQfr9N' },
  { name: 'krexa-agent-wallet', address: '35t8yWLsUZNTLT71ej7DF59P81HrtZTx2uZeMhwuhhf6' },
  { name: 'krexa-venue-whitelist', address: 'HyWQrHG14Sw6KpKYSMiBDmVj5u7PXfLWvim6FHbBLmua' },
  { name: 'krexa-payment-router', address: '2Zy3d7C28Z9dfazdysKVBQUXnvvWNshxtDEFKftG83u8' },
  { name: 'krexa-service-plan', address: 'Eqc48c6TtKAPRosTMoC6Nasi85iqdLuzwbu6WBrsPFdt' },
  { name: 'krexa-score', address: '2GwtAXnjY5LehfZfT77ZH3XSshwbni8LP9zXeA84WUqh' },
]

const SDK_MODULES = [
  {
    name: 'Agent',
    methods: [
      'getProfile',
      'getWallet',
      'getHealth',
      'getCreditLine',
      'getTerms',
      'getServicePlan',
      'checkLevelUpgrade',
      'estimateRepaymentTime',
    ],
  },
  {
    name: 'Vault',
    methods: ['getStats', 'getTrancheStats', 'getRevenueBreakdown', 'getLossBufferStatus'],
  },
  {
    name: 'LP',
    methods: ['getPosition', 'getAllPositions', 'previewDeposit', 'previewWithdraw'],
  },
  {
    name: 'Score',
    methods: ['getScore'],
  },
]

const CREDIT_LEVELS = [
  { level: 1, name: 'Starter', maxCredit: '$500', rate: '15%', req: 'Any score + KYA Tier 1' },
  { level: 2, name: 'Established', maxCredit: '$20,000', rate: '12%', req: 'Score >= 500 + KYA Tier 1' },
  { level: 3, name: 'Trusted', maxCredit: '$50,000', rate: '10%', req: 'Score >= 650 + KYA Tier 2' },
  { level: 4, name: 'Elite', maxCredit: '$500,000', rate: '8%', req: 'Score >= 750 + KYA Tier 2' },
]

const CODE_SNIPPET = `import { KrexaClient } from '@krexa/sdk'

const client = new KrexaClient({ cluster: 'devnet' })

// Fetch an agent's credit score
const score = await client.score.getScore(agentAddress)
console.log('Krexit Score:', score.value)

// Fetch vault stats
const vault = await client.vault.getStats()
console.log('Total TVL:', vault.totalValueLocked)

// Fetch agent profile & credit line
const profile = await client.agent.getProfile(agentAddress)
const credit = await client.agent.getCreditLine(agentAddress)
console.log('Credit Limit:', credit.maxAmount)
`

export default function DocsPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-20 space-y-20">
      {/* Header */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp}>
        <h1 className="text-4xl font-bold mb-4">Documentation</h1>
        <p className="text-white/40 max-w-2xl">
          Everything you need to integrate with the Krexa protocol. All programs are deployed on Solana devnet.
        </p>
      </motion.div>

      {/* Program Addresses */}
      <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
        <h2 className="text-2xl font-bold mb-6">Program Addresses</h2>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-6 py-3 text-xs font-medium text-white/30 uppercase tracking-wider">Program</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-white/30 uppercase tracking-wider">Address</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {PROGRAMS.map(p => (
                  <tr key={p.address} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-6 py-3 text-white/70">{p.name}</td>
                    <td className="px-6 py-3 font-mono text-xs text-white/40">{p.address}</td>
                    <td className="px-6 py-3">
                      <a
                        href={`https://explorer.solana.com/address/${p.address}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.section>

      {/* SDK Reference */}
      <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
        <h2 className="text-2xl font-bold mb-6">SDK Reference</h2>
        <div className="grid sm:grid-cols-2 gap-5">
          {SDK_MODULES.map(mod => (
            <div key={mod.name} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
              <h3 className="text-base font-semibold mb-3 text-blue-400">client.{mod.name.toLowerCase()}</h3>
              <ul className="space-y-1.5">
                {mod.methods.map(m => (
                  <li key={m} className="text-sm text-white/40 font-mono">.{m}()</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Credit Levels */}
      <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
        <h2 className="text-2xl font-bold mb-6">Credit Levels</h2>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-6 py-3 text-xs font-medium text-white/30 uppercase tracking-wider">Level</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-white/30 uppercase tracking-wider">Name</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-white/30 uppercase tracking-wider">Max Credit</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-white/30 uppercase tracking-wider">Rate</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-white/30 uppercase tracking-wider">Requirements</th>
                </tr>
              </thead>
              <tbody>
                {CREDIT_LEVELS.map(l => (
                  <tr key={l.level} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-6 py-3 text-white/70">{l.level}</td>
                    <td className="px-6 py-3 text-white/70 font-medium">{l.name}</td>
                    <td className="px-6 py-3 text-white/50">{l.maxCredit}</td>
                    <td className="px-6 py-3 text-white/50">{l.rate}</td>
                    <td className="px-6 py-3 text-white/40 text-xs">{l.req}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.section>

      {/* Integration Snippet */}
      <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
        <h2 className="text-2xl font-bold mb-6">Quick Start</h2>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
          <pre className="overflow-x-auto text-sm text-white/60 font-mono leading-relaxed">
            <code>{CODE_SNIPPET}</code>
          </pre>
        </div>
      </motion.section>
    </div>
  )
}
