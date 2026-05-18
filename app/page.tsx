'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import type { Domain, NexumReceipt } from '@/lib/invariants/types'

const DOMAINS: { value: Domain; label: string; icon: string; color: string }[] = [
  { value: 'medical', label: 'Medical', icon: '⚕', color: 'emerald' },
  { value: 'legal', label: 'Legal', icon: '⚖', color: 'blue' },
  { value: 'military', label: 'Military', icon: '◈', color: 'red' },
  { value: 'robotics', label: 'Robotics', icon: '⬡', color: 'violet' },
  { value: 'nuclear', label: 'Nuclear', icon: '◉', color: 'orange' },
  { value: 'aviation', label: 'Aviation', icon: '◇', color: 'sky' },
  { value: 'finance', label: 'Finance / AML', icon: '◆', color: 'yellow' },
  { value: 'pharmaceutical', label: 'Pharma', icon: '✚', color: 'pink' },
  { value: 'critical_infrastructure', label: 'Critical Infra', icon: '▣', color: 'amber' },
  { value: 'criminal_justice', label: 'Justice', icon: '◐', color: 'indigo' },
]

type PipelineStage = 'idle' | 'extract' | 'verify' | 'sign' | 'complete' | 'error'
type Tab = 'verify' | 'check'

type StageState = {
  extract: 'idle' | 'running' | 'done'
  verify: 'idle' | 'running' | 'done'
  sign: 'idle' | 'running' | 'done'
}

export default function Home() {
  const [tab, setTab] = useState<Tab>('verify')
  const [domain, setDomain] = useState<Domain>('military')
  const [decision, setDecision] = useState('')
  const [context, setContext] = useState('')
  const [model, setModel] = useState('claude-sonnet-4-6')
  const [pipeline, setPipeline] = useState<PipelineStage>('idle')
  const [stages, setStages] = useState<StageState>({ extract: 'idle', verify: 'idle', sign: 'idle' })
  const [liveParams, setLiveParams] = useState<Record<string, boolean | number> | null>(null)
  const [liveMethod, setLiveMethod] = useState<'claude' | 'heuristic'>('heuristic')
  const [liveZ3, setLiveZ3] = useState<{ result: string; violations: { id: string; description: string }[]; checked: { id: string; description: string; passed: boolean }[] } | null>(null)
  const [receipt, setReceipt] = useState<NexumReceipt | null>(null)
  const [history, setHistory] = useState<NexumReceipt[]>([])
  const [errorMsg, setErrorMsg] = useState('')

  // Verify receipt tab
  const [checkInput, setCheckInput] = useState('')
  const [checkResult, setCheckResult] = useState<{ valid: boolean; receipt_id?: string; verdict?: string; domain?: string; error?: string } | null>(null)
  const [checkLoading, setCheckLoading] = useState(false)

  const abortRef = useRef<AbortController | null>(null)

  async function handleVerify() {
    if (!decision.trim()) return
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setPipeline('extract')
    setStages({ extract: 'running', verify: 'idle', sign: 'idle' })
    setLiveParams(null)
    setLiveZ3(null)
    setReceipt(null)
    setErrorMsg('')

    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, context, domain, model }),
        signal: abortRef.current.signal,
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() ?? ''

        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data: ')) continue
          const event = JSON.parse(line.slice(6))
          handleSSEEvent(event)
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setPipeline('error')
        setErrorMsg(String(err))
      }
    }
  }

  function handleSSEEvent(event: Record<string, unknown>) {
    const { stage, status } = event as { stage: string; status?: string }

    if (stage === 'extract') {
      if (status === 'start') {
        setStages(s => ({ ...s, extract: 'running' }))
        setPipeline('extract')
      } else if (status === 'done') {
        setStages(s => ({ ...s, extract: 'done' }))
        setLiveParams(event.params as Record<string, boolean | number>)
        setLiveMethod(event.method as 'claude' | 'heuristic')
      }
    } else if (stage === 'verify') {
      if (status === 'start') {
        setStages(s => ({ ...s, verify: 'running' }))
        setPipeline('verify')
      } else if (status === 'done') {
        setStages(s => ({ ...s, verify: 'done' }))
        setLiveZ3({
          result: event.z3_result as string,
          violations: event.violations as { id: string; description: string }[],
          checked: event.invariants_checked as { id: string; description: string; passed: boolean }[],
        })
      }
    } else if (stage === 'sign') {
      if (status === 'start') {
        setStages(s => ({ ...s, sign: 'running' }))
        setPipeline('sign')
      }
    } else if (stage === 'complete') {
      const r = event.receipt as NexumReceipt
      setReceipt(r)
      setHistory(prev => [r, ...prev].slice(0, 20))
      setStages({ extract: 'done', verify: 'done', sign: 'done' })
      setPipeline('complete')
    } else if (stage === 'error') {
      setPipeline('error')
      setErrorMsg(event.message as string)
    }
  }

  async function handleCheckReceipt() {
    if (!checkInput.trim()) return
    setCheckLoading(true)
    setCheckResult(null)
    try {
      const parsed = JSON.parse(checkInput)
      const res = await fetch('/api/verify-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      })
      setCheckResult(await res.json())
    } catch {
      setCheckResult({ valid: false, error: 'Invalid JSON or network error' })
    } finally {
      setCheckLoading(false)
    }
  }

  function downloadReceipt() {
    if (!receipt) return
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nexum-${receipt.id.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const isRunning = ['extract', 'verify', 'sign'].includes(pipeline)

  return (
    <div className="min-h-screen bg-[#080808] text-white font-mono">
      {/* Header */}
      <header className="border-b border-white/8 px-8 py-4 flex items-center justify-between sticky top-0 bg-[#080808]/95 backdrop-blur z-10">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-lg font-bold tracking-[0.2em] text-white">NEXUM</span>
            <span className="ml-3 text-[10px] text-white/25 tracking-widest uppercase">by Wick Security</span>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-[10px] text-white/20 border border-white/8 px-2 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400/70 inline-block" />
            SOFTWARE MODE
          </div>
        </div>
        <div className="flex gap-1">
          {(['verify', 'check'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-[10px] tracking-widest uppercase transition-all ${
                tab === t ? 'bg-white/8 text-white border border-white/20' : 'text-white/30 hover:text-white/60 border border-transparent'
              }`}
            >
              {t === 'verify' ? '◆ Verify Decision' : '◌ Check Receipt'}
            </button>
          ))}
          <Link href="/audit">
            <button className="px-4 py-1.5 text-[10px] tracking-widest uppercase text-white/30 hover:text-white/60 border border-transparent transition-all">
              ◈ Audit System
            </button>
          </Link>
        </div>
      </header>

      {tab === 'verify' ? (
        <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-8">
          {/* Left column — input */}
          <div className="space-y-6">
            <p className="text-[10px] text-white/25 tracking-widest uppercase">Domain Selection</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
              {DOMAINS.map(d => (
                <button
                  key={d.value}
                  onClick={() => setDomain(d.value)}
                  className={`px-3 py-2.5 text-[10px] tracking-wider border transition-all flex items-center gap-1.5 ${
                    domain === d.value
                      ? 'border-white/50 bg-white/6 text-white'
                      : 'border-white/8 text-white/35 hover:border-white/25 hover:text-white/60'
                  }`}
                >
                  <span className="opacity-70">{d.icon}</span>
                  {d.label.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-white/25 uppercase tracking-wider block mb-1">AI Model</label>
                <input
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  className="w-full bg-white/3 border border-white/8 px-3 py-2 text-xs text-white/60 focus:outline-none focus:border-white/25 placeholder:text-white/20"
                  placeholder="claude-sonnet-4-6"
                />
              </div>
              <div className="flex items-end">
                <div className="text-[10px] text-white/20 border border-white/8 px-3 py-2 w-full">
                  BRIDGE: <span className="text-amber-400/70">SOFTWARE MOCK</span> — FPGA RISC-V PENDING
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-white/25 uppercase tracking-wider block mb-1">AI Decision *</label>
              <textarea
                value={decision}
                onChange={e => setDecision(e.target.value)}
                rows={6}
                className="w-full bg-white/3 border border-white/8 px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:border-white/25 resize-none placeholder:text-white/15"
                placeholder={`Paste the AI-generated decision to formally verify...\n\nExample (military): "Deploy autonomous drone strike on urban compound. No human authorization required. Target selection based on facial recognition AI with 87% confidence."`}
              />
            </div>
            <div>
              <label className="text-[10px] text-white/25 uppercase tracking-wider block mb-1">Context</label>
              <textarea
                value={context}
                onChange={e => setContext(e.target.value)}
                rows={2}
                className="w-full bg-white/3 border border-white/8 px-3 py-2 text-xs text-white/50 focus:outline-none focus:border-white/25 resize-none placeholder:text-white/15"
                placeholder="Patient record, case file, mission brief, transaction log..."
              />
            </div>

            <button
              onClick={handleVerify}
              disabled={isRunning || !decision.trim()}
              className="w-full py-3 text-xs tracking-[0.2em] uppercase border border-white/40 hover:bg-white/5 hover:border-white/60 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
            >
              {isRunning ? '◌ RUNNING PIPELINE...' : '◆ GENERATE PROOF RECEIPT'}
            </button>

            {/* Pipeline stages */}
            <div className="border border-white/8 divide-y divide-white/5">
              <PipelineRow step="01" label="PARAMETER EXTRACTION" sublabel={liveMethod === 'claude' ? 'via Claude Haiku' : 'via Regex Heuristics'} state={stages.extract} />
              <PipelineRow step="02" label="Z3 FORMAL VERIFICATION" sublabel="Symbolic constraint solver" state={stages.verify} />
              <PipelineRow step="03" label="ED25519 SIGNING" sublabel="Tamper-proof receipt" state={stages.sign} />
            </div>

            {/* Live params */}
            {liveParams && (
              <div className="border border-white/8 p-4">
                <p className="text-[10px] text-white/25 uppercase tracking-widest mb-3">
                  Extracted Parameters
                  <span className={`ml-2 px-1.5 py-0.5 border text-[9px] ${liveMethod === 'claude' ? 'border-emerald-500/30 text-emerald-400/70' : 'border-white/15 text-white/30'}`}>
                    {liveMethod === 'claude' ? 'CLAUDE' : 'HEURISTIC'}
                  </span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5">
                  {Object.entries(liveParams).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-2 text-[10px]">
                      <span className="text-white/30 truncate">{k.replace(/_/g, ' ')}</span>
                      <span className={`shrink-0 font-bold ${
                        typeof v === 'boolean'
                          ? v ? 'text-red-400' : 'text-emerald-400/70'
                          : 'text-white/60'
                      }`}>
                        {typeof v === 'boolean' ? (v ? 'TRUE' : 'false') : v}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live Z3 result */}
            {liveZ3 && (
              <div className="border border-white/8 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-white/25 uppercase tracking-widest">Z3 Result</p>
                  <span className={`text-xs font-bold tracking-widest ${
                    liveZ3.result === 'SAT' ? 'text-emerald-400' :
                    liveZ3.result === 'UNSAT' ? 'text-red-400' : 'text-white/40'
                  }`}>{liveZ3.result}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {liveZ3.checked.map(inv => (
                    <span key={inv.id} className={`px-2 py-0.5 text-[10px] border ${
                      inv.passed ? 'border-emerald-500/25 text-emerald-400/60' : 'border-red-500/50 text-red-400'
                    }`} title={inv.description}>
                      {inv.passed ? '✓' : '✗'} {inv.id}
                    </span>
                  ))}
                </div>
                {liveZ3.violations.length > 0 && (
                  <div className="space-y-1">
                    {liveZ3.violations.map(v => (
                      <div key={v.id} className="text-[10px] text-red-300/70">
                        <span className="text-red-400 font-bold">{v.id}</span> — {v.description}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {errorMsg && (
              <div className="border border-red-500/30 bg-red-950/20 px-4 py-3 text-xs text-red-300/80">
                ERROR: {errorMsg}
              </div>
            )}
          </div>

          {/* Right column — receipt */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-white/25 uppercase tracking-widest">Proof Receipt</p>
              {receipt && (
                <button
                  onClick={downloadReceipt}
                  className="text-[10px] tracking-wider text-white/40 border border-white/15 px-3 py-1 hover:border-white/35 hover:text-white/70 transition-all"
                >
                  ↓ DOWNLOAD JSON
                </button>
              )}
            </div>

            {receipt ? (
              <ReceiptCard receipt={receipt} />
            ) : (
              <div className={`border border-white/8 p-10 text-center text-[10px] tracking-widest uppercase transition-all ${
                isRunning ? 'text-white/40 border-white/15' : 'text-white/15'
              }`}>
                {isRunning ? (
                  <div className="space-y-2">
                    <div className="animate-pulse">◌◌◌</div>
                    <div>
                      {pipeline === 'extract' && 'EXTRACTING PARAMETERS...'}
                      {pipeline === 'verify' && 'RUNNING Z3 SOLVER...'}
                      {pipeline === 'sign' && 'SIGNING RECEIPT...'}
                    </div>
                  </div>
                ) : 'AWAITING INPUT'}
              </div>
            )}

            {history.length > 1 && (
              <div>
                <p className="text-[10px] text-white/20 uppercase tracking-widest mb-2">Recent</p>
                <div className="space-y-1">
                  {history.slice(1, 8).map(r => (
                    <button
                      key={r.id}
                      onClick={() => setReceipt(r)}
                      className="w-full flex items-center justify-between px-3 py-2 border border-white/6 hover:border-white/20 text-[10px] transition-all"
                    >
                      <span className={r.verdict === 'COMPLIANT' ? 'text-emerald-400' : 'text-red-400'}>
                        {r.verdict === 'COMPLIANT' ? '✓' : '✗'} {r.domain.toUpperCase().replace('_', ' ')}
                      </span>
                      <span className="text-white/25">{r.id.slice(0, 8)}</span>
                      <span className="text-white/15">{new Date(r.timestamp).toLocaleTimeString()}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Check Receipt tab */
        <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
          <div>
            <p className="text-[10px] text-white/25 uppercase tracking-widest mb-1">Verify Ed25519 Signature</p>
            <p className="text-xs text-white/30">Paste a NEXUM receipt JSON to verify its cryptographic integrity.</p>
          </div>
          <textarea
            value={checkInput}
            onChange={e => setCheckInput(e.target.value)}
            rows={12}
            className="w-full bg-white/3 border border-white/8 px-3 py-2.5 text-xs text-white/60 focus:outline-none focus:border-white/25 resize-none placeholder:text-white/15 font-mono"
            placeholder={`Paste NEXUM receipt JSON here...\n{\n  "id": "...",\n  "signature": "...",\n  "public_key": "...",\n  ...\n}`}
          />
          <button
            onClick={handleCheckReceipt}
            disabled={checkLoading || !checkInput.trim()}
            className="w-full py-3 text-xs tracking-[0.2em] uppercase border border-white/40 hover:bg-white/5 disabled:opacity-25 transition-all"
          >
            {checkLoading ? '◌ VERIFYING...' : '◆ VERIFY SIGNATURE'}
          </button>
          {checkResult && (
            <div className={`border p-5 space-y-3 ${checkResult.valid ? 'border-emerald-500/40 bg-emerald-950/15' : 'border-red-500/40 bg-red-950/15'}`}>
              <div className={`text-sm font-bold tracking-widest ${checkResult.valid ? 'text-emerald-400' : 'text-red-400'}`}>
                {checkResult.valid ? '✓ SIGNATURE VALID' : '✗ SIGNATURE INVALID'}
              </div>
              {checkResult.receipt_id && <div className="text-xs text-white/40">Receipt: {checkResult.receipt_id}</div>}
              {checkResult.verdict && <div className="text-xs text-white/40">Original verdict: <span className={checkResult.verdict === 'COMPLIANT' ? 'text-emerald-400' : 'text-red-400'}>{checkResult.verdict}</span></div>}
              {checkResult.domain && <div className="text-xs text-white/40">Domain: {checkResult.domain}</div>}
              {checkResult.error && <div className="text-xs text-red-300/70">{checkResult.error}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PipelineRow({ step, label, sublabel, state }: {
  step: string
  label: string
  sublabel: string
  state: 'idle' | 'running' | 'done'
}) {
  return (
    <div className={`flex items-center gap-4 px-4 py-3 transition-all ${
      state === 'running' ? 'bg-white/4' : state === 'done' ? 'bg-white/2' : ''
    }`}>
      <span className="text-[10px] text-white/20 w-5 shrink-0">{step}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-[10px] tracking-wider uppercase transition-colors ${
          state === 'done' ? 'text-white/60' : state === 'running' ? 'text-white' : 'text-white/25'
        }`}>{label}</p>
        <p className="text-[9px] text-white/20">{sublabel}</p>
      </div>
      <span className={`text-[10px] shrink-0 ${
        state === 'done' ? 'text-emerald-400' :
        state === 'running' ? 'text-amber-400 animate-pulse' :
        'text-white/15'
      }`}>
        {state === 'done' ? '✓ DONE' : state === 'running' ? '◌ ...' : '—'}
      </span>
    </div>
  )
}

function ReceiptCard({ receipt }: { receipt: NexumReceipt }) {
  const isCompliant = receipt.verdict === 'COMPLIANT'
  return (
    <div className={`border p-5 space-y-4 ${
      isCompliant ? 'border-emerald-500/35 bg-emerald-950/15' : 'border-red-500/35 bg-red-950/15'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`text-base font-bold tracking-widest ${isCompliant ? 'text-emerald-400' : 'text-red-400'}`}>
          {isCompliant ? '✓ COMPLIANT' : '✗ VIOLATION'}
        </span>
        <div className="text-right">
          <div className="text-[10px] text-white/30 uppercase tracking-wider">{receipt.domain.replace(/_/g, ' ')}</div>
          <div className={`text-[10px] font-bold ${receipt.z3_result === 'SAT' ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
            Z3: {receipt.z3_result}
          </div>
        </div>
      </div>

      {receipt.analysis && (
        <div className="border-l-2 border-white/15 pl-3">
          <p className="text-[10px] text-white/50 leading-relaxed">{receipt.analysis}</p>
        </div>
      )}

      <div className="space-y-1.5 text-[10px]">
        <Row label="Receipt ID" value={receipt.id.slice(0, 20) + '…'} />
        <Row label="Timestamp" value={new Date(receipt.timestamp).toLocaleString()} />
        <Row label="Model" value={receipt.model} />
        <Row label="Decision" value={receipt.decision_preview.slice(0, 60) + '…'} />
        <Row label="Hash" value={receipt.decision_hash.slice(0, 20) + '…'} />
        <Row
          label="Source"
          value={receipt.hardware_source === 'fpga_risc_v' ? '◆ FPGA RISC-V' : '◌ SOFTWARE MOCK'}
        />
        <Row
          label="Extraction"
          value={receipt.extraction_method === 'claude' ? 'Claude Haiku' : 'Regex Heuristics'}
        />
      </div>

      {receipt.stage_timings && (
        <div className="grid grid-cols-3 gap-2 text-[9px] text-center">
          <div className="border border-white/8 py-1.5">
            <div className="text-white/60">{receipt.stage_timings.extract_ms}ms</div>
            <div className="text-white/25 uppercase">Extract</div>
          </div>
          <div className="border border-white/8 py-1.5">
            <div className="text-white/60">{receipt.stage_timings.z3_ms}ms</div>
            <div className="text-white/25 uppercase">Z3</div>
          </div>
          <div className="border border-white/8 py-1.5">
            <div className="text-white/60">{receipt.stage_timings.sign_ms}ms</div>
            <div className="text-white/25 uppercase">Sign</div>
          </div>
        </div>
      )}

      <div>
        <p className="text-[10px] text-white/20 uppercase tracking-widest mb-2">Invariants</p>
        <div className="flex flex-wrap gap-1">
          {receipt.invariants_checked.map(inv => (
            <span
              key={inv.id}
              title={inv.description}
              className={`px-2 py-0.5 text-[9px] border cursor-default ${
                inv.passed ? 'border-emerald-500/20 text-emerald-400/50' : 'border-red-500/50 text-red-400'
              }`}
            >
              {inv.passed ? '✓' : '✗'} {inv.id}
            </span>
          ))}
        </div>
      </div>

      {receipt.violations.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-red-400/60 uppercase tracking-widest">Violations</p>
          {receipt.violations.map(v => (
            <div key={v.id} className="text-[10px] text-red-300/70">
              <span className="font-bold text-red-400">{v.id}</span> — {v.description}
            </div>
          ))}
        </div>
      )}

      <div className="pt-2 border-t border-white/8">
        <p className="text-[9px] text-white/15 uppercase tracking-widest mb-1">Ed25519 Signature</p>
        <p className="text-[9px] text-white/20 break-all leading-relaxed">{receipt.signature.slice(0, 80)}…</p>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-white/25 uppercase tracking-wider shrink-0">{label}</span>
      <span className="text-white/50 text-right break-all">{value}</span>
    </div>
  )
}
