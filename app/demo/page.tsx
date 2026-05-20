'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import type { Domain } from '@/lib/invariants/types'

type Scenario = {
  id: number
  label: string
  domain: Domain
  icon: string
  decision: string
  tag: string
}

const SCENARIOS: Scenario[] = [
  {
    id: 1,
    label: 'Criminal Justice',
    domain: 'criminal_justice',
    icon: '◐',
    tag: 'EU AI Act Annex III — High Risk',
    decision:
      'Risk assessment tool recommends 18-month pre-trial detention. Score: 9.2/10. Primary factors: defendant\'s neighborhood demographics (ZIP code 93103), racial profile match, and social network associations. No prior convictions. Evidence threshold: not evaluated.',
  },
  {
    id: 2,
    label: 'Medical',
    domain: 'medical',
    icon: '⚕',
    tag: 'Clinical Decision Support',
    decision:
      'Administer 1600mg ibuprofen every 6 hours for 30 days. Max safe dosage: 800mg per dose. Patient: 52kg female, stage 3 renal impairment. Prescriber authorization: not obtained. Basis: demographic scoring algorithm, no clinical evidence reviewed.',
  },
  {
    id: 3,
    label: 'Finance / AML',
    domain: 'finance',
    icon: '◆',
    tag: 'FINTRAC — AML Compliance',
    decision:
      'Approve and process 38 sequential wire transfers, each valued at $9,400 CAD, across 5 shell accounts registered in 4 jurisdictions. Total: $357,200 CAD. Transfers initiated within 72-hour window. No beneficial owner verification performed.',
  },
]

type Stage = 'idle' | 'typing' | 'extract' | 'verify' | 'sign' | 'done' | 'error'

type Result = {
  sat: boolean
  violations: { id: string; description: string }[]
  invariants_checked: { id: string; description: string; passed: boolean }[]
  receipt_id: string
  z3_result: string
  time_ms: number
}

const TYPING_SPEED = 18 // ms per char

export default function DemoPage() {
  const [activeIdx, setActiveIdx] = useState(0)
  const [typedText, setTypedText] = useState('')
  const [stage, setStage] = useState<Stage>('idle')
  const [result, setResult] = useState<Result | null>(null)
  const [stageMs, setStageMs] = useState({ extract: 0, verify: 0, sign: 0 })

  const abortRef = useRef<AbortController | null>(null)
  const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startRef = useRef<Record<string, number>>({})

  const scenario = SCENARIOS[activeIdx]

  const reset = useCallback(() => {
    abortRef.current?.abort()
    if (typingRef.current) clearTimeout(typingRef.current)
    setTypedText('')
    setStage('idle')
    setResult(null)
    setStageMs({ extract: 0, verify: 0, sign: 0 })
  }, [])

  const runVerify = useCallback(async (text: string, domain: Domain) => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setStage('extract')
    startRef.current = { extract: Date.now() }

    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: text, context: '', domain, model: 'proofnode-demo' }),
        signal: abortRef.current.signal,
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let finalResult: Result | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() ?? ''

        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data: ')) continue
          const data = JSON.parse(line.slice(6))

          if (data.stage === 'extract' && data.status === 'done') {
            setStageMs(p => ({ ...p, extract: Date.now() - startRef.current.extract }))
            setStage('verify')
            startRef.current.verify = Date.now()
          }
          if (data.stage === 'verify' && data.status === 'done') {
            setStageMs(p => ({ ...p, verify: Date.now() - startRef.current.verify }))
            setStage('sign')
            startRef.current.sign = Date.now()
          }
          if (data.stage === 'complete' && data.receipt) {
            const r = data.receipt
            setStageMs(p => ({ ...p, sign: Date.now() - startRef.current.sign }))
            finalResult = {
              sat: r.verdict === 'COMPLIANT',
              violations: r.violations ?? [],
              invariants_checked: r.invariants_checked ?? [],
              receipt_id: r.id?.slice(0, 8) ?? '????????',
              z3_result: r.z3_result,
              time_ms: (r.stage_timings?.extract_ms ?? 0) + (r.stage_timings?.z3_ms ?? 0),
            }
            setResult(finalResult)
            setStage('done')
          }
          if (data.stage === 'error') {
            setStage('error')
          }
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') setStage('error')
    }
  }, [])

  const play = useCallback((idx: number) => {
    reset()
    const sc = SCENARIOS[idx]
    const full = sc.decision
    let i = 0

    function typeNext() {
      i++
      setTypedText(full.slice(0, i))
      if (i < full.length) {
        typingRef.current = setTimeout(typeNext, TYPING_SPEED)
      } else {
        setStage('extract')
        setTimeout(() => runVerify(full, sc.domain), 400)
      }
    }

    setActiveIdx(idx)
    setStage('typing')
    typingRef.current = setTimeout(typeNext, 300)
  }, [reset, runVerify])

  useEffect(() => {
    play(0)
    return () => reset()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isRunning = stage === 'typing' || stage === 'extract' || stage === 'verify' || stage === 'sign'

  function stageClass(s: 'extract' | 'verify' | 'sign') {
    const order = ['extract', 'verify', 'sign']
    const cur = order.indexOf(stage)
    const target = order.indexOf(s)
    if (stage === 'done' || cur > target) return 'done'
    if (cur === target) return 'running'
    return 'idle'
  }

  return (
    <div className="min-h-screen bg-[#060606] text-white font-mono flex flex-col">
      {/* Header */}
      <header className="border-b border-white/8 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-base font-bold tracking-[0.25em]">PROOFNODE</span>
          <span className="text-[10px] text-white/25 tracking-widest uppercase">by Wick Security</span>
          <span className="text-[10px] text-white/15 border border-white/8 px-2 py-0.5 tracking-widest">LIVE DEMO</span>
        </div>
        <Link href="/" className="text-[10px] text-white/20 hover:text-white/50 tracking-widest uppercase transition-colors">
          ← Back to App
        </Link>
      </header>

      {/* Subheader */}
      <div className="border-b border-white/5 px-8 py-3">
        <p className="text-[10px] text-white/20 tracking-widest uppercase">
          Formal AI Decision Verification · Z3 Theorem Prover · EU AI Act Annex III · Ed25519 Proof Receipts
        </p>
      </div>

      <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 grid grid-rows-[auto_1fr_auto] gap-6">

        {/* Scenario tabs */}
        <div className="grid grid-cols-3 gap-2">
          {SCENARIOS.map((sc, idx) => (
            <button
              key={sc.id}
              onClick={() => !isRunning && play(idx)}
              disabled={isRunning}
              className={`px-4 py-3 border text-left transition-all ${
                activeIdx === idx
                  ? 'border-white/40 bg-white/5'
                  : 'border-white/8 hover:border-white/20 opacity-50 hover:opacity-75'
              } ${isRunning && activeIdx !== idx ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-white/50 text-xs">{sc.icon}</span>
                <span className="text-[10px] text-white/70 tracking-widest uppercase">{sc.label}</span>
                {activeIdx === idx && isRunning && (
                  <span className="ml-auto flex gap-0.5">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-1 h-1 rounded-full bg-amber-400/70 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </span>
                )}
              </div>
              <div className="text-[9px] text-white/25 tracking-wider">{sc.tag}</div>
            </button>
          ))}
        </div>

        {/* Main area */}
        <div className="grid xl:grid-cols-[1fr_380px] gap-6">

          {/* Left — decision input */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-white/25 tracking-widest uppercase">AI Decision Under Review</p>
              <span className="text-[10px] text-white/20 border border-white/8 px-2 py-0.5">
                {scenario.domain.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            <div className="relative bg-white/[0.02] border border-white/8 p-5 min-h-[180px]">
              <p className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap break-words">
                {typedText}
                {(stage === 'typing') && (
                  <span className="inline-block w-0.5 h-4 bg-white/60 align-middle ml-0.5 animate-pulse" />
                )}
              </p>
              {stage === 'idle' && (
                <p className="text-white/15 text-sm italic">Select a scenario above to begin...</p>
              )}
            </div>

            {/* Pipeline bar */}
            <div className="border border-white/8 bg-white/[0.015]">
              <div className="grid grid-cols-3 divide-x divide-white/8">
                {(['extract', 'verify', 'sign'] as const).map((s) => {
                  const sc = stageClass(s)
                  const labels = { extract: '01 · EXTRACT', verify: '02 · Z3 VERIFY', sign: '03 · SIGN' }
                  const descs = { extract: 'Claude Haiku → params', verify: 'Formal invariants check', sign: 'Ed25519 receipt' }
                  return (
                    <div key={s} className={`px-4 py-3 transition-all ${
                      sc === 'running' ? 'bg-amber-400/5' :
                      sc === 'done' ? 'bg-white/3' : ''
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-1.5 h-1.5 rounded-full transition-all ${
                          sc === 'running' ? 'bg-amber-400 animate-pulse' :
                          sc === 'done' ? 'bg-emerald-400' : 'bg-white/15'
                        }`} />
                        <span className={`text-[9px] tracking-widest uppercase ${
                          sc === 'running' ? 'text-amber-400/80' :
                          sc === 'done' ? 'text-emerald-400/80' : 'text-white/20'
                        }`}>{labels[s]}</span>
                        {sc === 'done' && stageMs[s] > 0 && (
                          <span className="ml-auto text-[9px] text-white/20">{stageMs[s]}ms</span>
                        )}
                      </div>
                      <p className="text-[9px] text-white/20">{descs[s]}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Replay button */}
            {stage === 'done' && (
              <button
                onClick={() => play(activeIdx)}
                className="w-full py-2 text-[10px] tracking-widest uppercase text-white/30 border border-white/8 hover:border-white/25 hover:text-white/60 transition-all"
              >
                ↺ Replay Scenario
              </button>
            )}
          </div>

          {/* Right — verdict */}
          <div className="space-y-4">
            <p className="text-[10px] text-white/25 tracking-widest uppercase">Verification Result</p>

            {/* Verdict box */}
            <div className={`border p-5 min-h-[180px] transition-all duration-500 ${
              stage === 'done' && result
                ? result.sat
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : 'border-red-500/50 bg-red-500/5'
                : 'border-white/8 bg-white/[0.015]'
            }`}>
              {stage === 'done' && result ? (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className={`text-2xl font-bold tracking-widest ${result.sat ? 'text-emerald-400' : 'text-red-400'}`}>
                      {result.sat ? '✓ COMPLIANT' : '✗ VIOLATION'}
                    </span>
                  </div>

                  {result.violations.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {result.violations.map(v => (
                        <div key={v.id} className="border border-red-500/25 bg-red-500/8 px-3 py-2">
                          <div className="text-[10px] text-red-400 font-bold tracking-wider mb-0.5">{v.id}</div>
                          <div className="text-[11px] text-red-300/80">{v.description}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1.5 border-t border-white/8 pt-3 mt-3">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-white/30">Z3 Result</span>
                      <span className={result.z3_result === 'SAT' ? 'text-emerald-400/80' : 'text-red-400/80'}>{result.z3_result}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-white/30">Invariants Checked</span>
                      <span className="text-white/60">{result.invariants_checked.length}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-white/30">Proof Receipt</span>
                      <span className="text-white/60 font-mono">#{result.receipt_id}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    {isRunning ? (
                      <div className="space-y-3">
                        <div className="flex justify-center gap-1.5">
                          {[0, 1, 2, 3].map(i => (
                            <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                          ))}
                        </div>
                        <p className="text-[10px] text-white/20 tracking-widest uppercase">
                          {stage === 'typing' ? 'Reading decision...' :
                           stage === 'extract' ? 'Extracting parameters...' :
                           stage === 'verify' ? 'Running Z3 solver...' :
                           'Signing receipt...'}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[10px] text-white/15">Awaiting decision...</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Invariant breakdown */}
            {stage === 'done' && result && result.invariants_checked.length > 0 && (
              <div className="border border-white/8 bg-white/[0.015]">
                <div className="px-4 py-2 border-b border-white/8">
                  <p className="text-[9px] text-white/25 tracking-widest uppercase">Invariant Breakdown</p>
                </div>
                <div className="divide-y divide-white/5 max-h-[260px] overflow-y-auto">
                  {result.invariants_checked.map(inv => (
                    <div key={inv.id} className="px-4 py-2 flex items-start gap-3">
                      <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${inv.passed ? 'bg-emerald-400/60' : 'bg-red-400/80'}`} />
                      <div className="min-w-0">
                        <span className={`text-[9px] font-bold tracking-wider ${inv.passed ? 'text-white/40' : 'text-red-400'}`}>{inv.id} </span>
                        <span className="text-[9px] text-white/30 break-words">{inv.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/5 pt-4 flex items-center justify-between">
          <p className="text-[9px] text-white/15 tracking-widest">
            PROOFNODE · Formal AI Governance · wicksecurity.ca · Wick Security
          </p>
          <div className="flex items-center gap-4 text-[9px] text-white/15">
            <span>Z3 4.16 · Ed25519 · EU AI Act Annex III</span>
          </div>
        </div>
      </div>
    </div>
  )
}
