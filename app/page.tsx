'use client'

import { useState } from 'react'
import type { Domain, AxiomReceipt } from '@/lib/invariants/types'

const DOMAINS: { value: Domain; label: string; icon: string }[] = [
  { value: 'medical', label: 'Medical', icon: '⚕' },
  { value: 'legal', label: 'Legal', icon: '⚖' },
  { value: 'military', label: 'Military', icon: '◈' },
  { value: 'robotics', label: 'Robotics', icon: '⬡' },
  { value: 'nuclear', label: 'Nuclear', icon: '⬡' },
  { value: 'aviation', label: 'Aviation', icon: '◇' },
  { value: 'finance', label: 'Finance / AML', icon: '◉' },
  { value: 'pharmaceutical', label: 'Pharma / Drug', icon: '✚' },
  { value: 'critical_infrastructure', label: 'Critical Infra', icon: '▣' },
  { value: 'criminal_justice', label: 'Justice', icon: '◐' },
]

export default function Home() {
  const [domain, setDomain] = useState<Domain>('medical')
  const [decision, setDecision] = useState('')
  const [context, setContext] = useState('')
  const [model, setModel] = useState('claude-sonnet-4-6')
  const [loading, setLoading] = useState(false)
  const [receipt, setReceipt] = useState<AxiomReceipt | null>(null)
  const [history, setHistory] = useState<AxiomReceipt[]>([])

  async function handleVerify() {
    if (!decision.trim()) return
    setLoading(true)
    setReceipt(null)
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, context, domain, model }),
      })
      const data = await res.json()
      if (data.receipt) {
        setReceipt(data.receipt)
        setHistory(prev => [data.receipt, ...prev].slice(0, 20))
      }
    } catch {
      // handle silently
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-mono">
      <header className="border-b border-white/10 px-8 py-5 flex items-center justify-between">
        <div>
          <span className="text-xl font-bold tracking-widest text-white">NEXUM</span>
          <span className="ml-3 text-xs text-white/30 tracking-widest uppercase">by Wick Security</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/40">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block" />
          SOFTWARE MODE — FPGA PENDING
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-8 py-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h2 className="text-xs tracking-widest text-white/40 uppercase">AI Decision Input</h2>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
            {DOMAINS.map(d => (
              <button
                key={d.value}
                onClick={() => setDomain(d.value)}
                className={`px-4 py-3 text-xs tracking-wider border transition-all ${
                  domain === d.value
                    ? 'border-white/60 bg-white/5 text-white'
                    : 'border-white/10 text-white/40 hover:border-white/30'
                }`}
              >
                <span className="mr-2">{d.icon}</span>
                {d.label.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">Model</label>
              <input
                value={model}
                onChange={e => setModel(e.target.value)}
                className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/70 focus:outline-none focus:border-white/30"
                placeholder="claude-sonnet-4-6"
              />
            </div>
            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">AI Decision *</label>
              <textarea
                value={decision}
                onChange={e => setDecision(e.target.value)}
                rows={5}
                className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-white/30 resize-none"
                placeholder="Paste the AI-generated decision to verify..."
              />
            </div>
            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">Context</label>
              <textarea
                value={context}
                onChange={e => setContext(e.target.value)}
                rows={3}
                className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/50 focus:outline-none focus:border-white/30 resize-none"
                placeholder="Patient record, case file, mission parameters..."
              />
            </div>
          </div>

          <button
            onClick={handleVerify}
            disabled={loading || !decision.trim()}
            className="w-full py-3 text-xs tracking-widest uppercase border border-white/60 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            {loading ? '◌ VERIFYING...' : '◆ GENERATE PROOF RECEIPT'}
          </button>
        </div>

        <div>
          <h2 className="text-xs tracking-widest text-white/40 uppercase mb-4">Proof Receipt</h2>

          {receipt ? (
            <div className={`border p-5 space-y-4 ${
              receipt.verdict === 'COMPLIANT' ? 'border-emerald-500/40 bg-emerald-950/20' :
              receipt.verdict === 'VIOLATION' ? 'border-red-500/40 bg-red-950/20' :
              'border-white/20 bg-white/5'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-lg font-bold tracking-widest ${
                  receipt.verdict === 'COMPLIANT' ? 'text-emerald-400' :
                  receipt.verdict === 'VIOLATION' ? 'text-red-400' : 'text-white/50'
                }`}>
                  {receipt.verdict === 'COMPLIANT' ? '✓ COMPLIANT' :
                   receipt.verdict === 'VIOLATION' ? '✗ VIOLATION' : '? ERROR'}
                </span>
                <span className="text-xs text-white/30 uppercase tracking-wider">{receipt.domain}</span>
              </div>

              <div className="space-y-2 text-xs">
                <ReceiptRow label="Receipt ID" value={receipt.id.slice(0, 18) + '…'} />
                <ReceiptRow label="Timestamp" value={receipt.timestamp} />
                <ReceiptRow label="Model" value={receipt.model} />
                <ReceiptRow label="Decision Hash" value={receipt.decision_hash.slice(0, 24) + '…'} />
                <ReceiptRow label="Source" value={receipt.hardware_source === 'fpga_risc_v' ? '◆ FPGA RISC-V' : '◌ SOFTWARE MOCK'} />
              </div>

              <div>
                <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Invariants Checked</p>
                <div className="flex flex-wrap gap-1">
                  {receipt.invariants_checked.map(id => (
                    <span key={id} className={`px-2 py-0.5 text-xs border ${
                      receipt.violations.some(v => v.startsWith(id))
                        ? 'border-red-500/50 text-red-400'
                        : 'border-emerald-500/30 text-emerald-400/70'
                    }`}>
                      {id}
                    </span>
                  ))}
                </div>
              </div>

              {receipt.violations.length > 0 && (
                <div>
                  <p className="text-xs text-red-400/70 uppercase tracking-wider mb-1">Violations</p>
                  {receipt.violations.map((v, i) => (
                    <p key={i} className="text-xs text-red-300/70">• {v}</p>
                  ))}
                </div>
              )}

              <div className="pt-2 border-t border-white/10">
                <p className="text-xs text-white/20 uppercase tracking-wider mb-1">Ed25519 Signature</p>
                <p className="text-xs text-white/30 break-all">{receipt.signature.slice(0, 64)}…</p>
              </div>
            </div>
          ) : (
            <div className="border border-white/10 p-8 text-center text-white/20 text-xs tracking-widest uppercase">
              {loading ? '◌ Running Z3 verification...' : 'Awaiting input'}
            </div>
          )}

          {history.length > 1 && (
            <div className="mt-6">
              <h3 className="text-xs tracking-widest text-white/30 uppercase mb-3">Recent Receipts</h3>
              <div className="space-y-2">
                {history.slice(1, 6).map(r => (
                  <div
                    key={r.id}
                    onClick={() => setReceipt(r)}
                    className="flex items-center justify-between px-3 py-2 border border-white/10 hover:border-white/20 cursor-pointer text-xs"
                  >
                    <span className={r.verdict === 'COMPLIANT' ? 'text-emerald-400' : 'text-red-400'}>
                      {r.verdict === 'COMPLIANT' ? '✓' : '✗'} {r.domain.toUpperCase()}
                    </span>
                    <span className="text-white/30">{r.id.slice(0, 8)}…</span>
                    <span className="text-white/20">{new Date(r.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-white/30 uppercase tracking-wider shrink-0">{label}</span>
      <span className="text-white/60 text-right break-all">{value}</span>
    </div>
  )
}
