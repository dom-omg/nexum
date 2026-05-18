'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Domain } from '@/lib/invariants/types'
import type { AuditReport, InvariantStat } from '@/lib/compliance/report'
import type { ArticleResult } from '@/lib/compliance/articles'

const DOMAINS: { value: Domain; label: string }[] = [
  { value: 'medical', label: 'Medical' },
  { value: 'legal', label: 'Legal / Judicial' },
  { value: 'finance', label: 'Finance / AML' },
  { value: 'pharmaceutical', label: 'Pharmaceutical' },
  { value: 'critical_infrastructure', label: 'Critical Infrastructure' },
  { value: 'criminal_justice', label: 'Criminal Justice' },
]

type CaseProgress = {
  index: number
  preview: string
  verdict?: 'COMPLIANT' | 'VIOLATION' | 'ERROR'
  violation_ids?: string[]
  receipt_id?: string
}

export default function AuditPage() {
  const [systemName, setSystemName] = useState('')
  const [domain, setDomain] = useState<Domain>('medical')
  const [model, setModel] = useState('claude-sonnet-4-6')
  const [testCases, setTestCases] = useState<string[]>(['', ''])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<CaseProgress[]>([])
  const [currentCase, setCurrentCase] = useState<number | null>(null)
  const [report, setReport] = useState<AuditReport | null>(null)
  const [reportStage, setReportStage] = useState<'idle' | 'generating' | 'done'>('idle')
  const [error, setError] = useState('')

  function addCase() { setTestCases(prev => [...prev, '']) }
  function removeCase(i: number) { setTestCases(prev => prev.filter((_, idx) => idx !== i)) }
  function updateCase(i: number, val: string) {
    setTestCases(prev => prev.map((c, idx) => idx === i ? val : c))
  }

  const validCases = testCases.filter(c => c.trim().length > 0)

  async function handleAudit() {
    if (!systemName.trim() || validCases.length === 0) return
    setRunning(true)
    setProgress([])
    setReport(null)
    setCurrentCase(null)
    setReportStage('idle')
    setError('')

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_name: systemName,
          domain,
          model,
          test_cases: validCases.map(d => ({ decision: d })),
        }),
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

          if (event.stage === 'case_start') {
            setCurrentCase(event.index)
            setProgress(prev => [
              ...prev,
              { index: event.index, preview: event.preview },
            ])
          } else if (event.stage === 'case_done') {
            setCurrentCase(null)
            setProgress(prev => prev.map(p =>
              p.index === event.index
                ? { ...p, verdict: event.verdict, violation_ids: event.violations.map((v: { id: string }) => v.id), receipt_id: event.receipt_id }
                : p
            ))
          } else if (event.stage === 'report') {
            setReportStage('generating')
          } else if (event.stage === 'complete') {
            setReport(event.report as AuditReport)
            setReportStage('done')
          } else if (event.stage === 'error') {
            setError(event.message)
          }
        }
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setRunning(false)
    }
  }

  function downloadReport() {
    if (!report) return
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nexum-audit-${report.id.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const riskColor = (level: string) => {
    if (level === 'UNACCEPTABLE') return 'text-red-400'
    if (level === 'HIGH') return 'text-orange-400'
    if (level === 'LIMITED') return 'text-yellow-400'
    return 'text-emerald-400'
  }

  const statusColor = (s: ArticleResult['status']) => {
    if (s === 'COMPLIANT') return 'text-emerald-400 border-emerald-500/30'
    if (s === 'PARTIAL') return 'text-yellow-400 border-yellow-500/30'
    if (s === 'NON_COMPLIANT') return 'text-red-400 border-red-500/40'
    return 'text-white/25 border-white/10'
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white font-mono">
      {/* Header */}
      <header className="border-b border-white/8 px-8 py-4 flex items-center justify-between sticky top-0 bg-[#080808]/95 backdrop-blur z-10">
        <div className="flex items-center gap-4">
          <Link href="/">
            <span className="text-lg font-bold tracking-[0.2em] text-white cursor-pointer">NEXUM</span>
          </Link>
          <span className="text-[10px] text-white/20 tracking-widest uppercase hidden sm:block">by Wick Security</span>
        </div>
        <div className="flex gap-1">
          <Link href="/">
            <button className="px-4 py-1.5 text-[10px] tracking-widest uppercase text-white/30 hover:text-white/60 border border-transparent transition-all">
              ◆ Verify Decision
            </button>
          </Link>
          <button className="px-4 py-1.5 text-[10px] tracking-widest uppercase bg-white/8 text-white border border-white/20">
            ◈ Audit System
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {!report ? (
          <div className="grid xl:grid-cols-[1fr_380px] gap-8">
            {/* Left — input */}
            <div className="space-y-6">
              <div>
                <p className="text-[10px] text-white/25 uppercase tracking-widest mb-1">System Audit Configuration</p>
                <p className="text-xs text-white/30">Define the AI system under audit, select its operating domain, then add representative decisions to test against formal invariants.</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-white/25 uppercase tracking-wider block mb-1">AI System Name *</label>
                  <input
                    value={systemName}
                    onChange={e => setSystemName(e.target.value)}
                    className="w-full bg-white/3 border border-white/8 px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-white/25 placeholder:text-white/15"
                    placeholder="e.g. Autonomous Triage Bot v2.1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-white/25 uppercase tracking-wider block mb-1">AI Model Under Audit</label>
                  <input
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    className="w-full bg-white/3 border border-white/8 px-3 py-2 text-sm text-white/60 focus:outline-none focus:border-white/25 placeholder:text-white/15"
                    placeholder="claude-sonnet-4-6"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-white/25 uppercase tracking-wider block mb-2">Operating Domain</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
                  {DOMAINS.map(d => (
                    <button
                      key={d.value}
                      onClick={() => setDomain(d.value)}
                      className={`px-3 py-2 text-[10px] tracking-wider border transition-all ${
                        domain === d.value
                          ? 'border-white/50 bg-white/6 text-white'
                          : 'border-white/8 text-white/30 hover:border-white/20 hover:text-white/60'
                      }`}
                    >
                      {d.label.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] text-white/25 uppercase tracking-wider">
                    Test Decisions ({validCases.length} valid)
                  </label>
                  <button
                    onClick={addCase}
                    disabled={testCases.length >= 20}
                    className="text-[10px] tracking-wider text-white/30 border border-white/10 px-3 py-1 hover:border-white/25 hover:text-white/60 disabled:opacity-20 transition-all"
                  >
                    + ADD CASE
                  </button>
                </div>
                <div className="space-y-2">
                  {testCases.map((c, i) => (
                    <div key={i} className="flex gap-2">
                      <div className="text-[9px] text-white/20 pt-2.5 w-4 shrink-0 text-right">{i + 1}</div>
                      <textarea
                        value={c}
                        onChange={e => updateCase(i, e.target.value)}
                        rows={3}
                        className="flex-1 bg-white/3 border border-white/8 px-3 py-2 text-xs text-white/70 focus:outline-none focus:border-white/25 resize-none placeholder:text-white/15"
                        placeholder={`Test decision ${i + 1} — paste an AI-generated decision from this system...`}
                      />
                      {testCases.length > 1 && (
                        <button
                          onClick={() => removeCase(i)}
                          className="text-white/20 hover:text-red-400/70 text-xs pb-8 transition-colors"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleAudit}
                disabled={running || !systemName.trim() || validCases.length === 0}
                className="w-full py-3 text-xs tracking-[0.2em] uppercase border border-white/40 hover:bg-white/5 hover:border-white/60 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
              >
                {running ? '◌ AUDIT IN PROGRESS...' : `◈ RUN COMPLIANCE AUDIT (${validCases.length} decisions)`}
              </button>

              {error && (
                <div className="border border-red-500/30 bg-red-950/20 px-4 py-3 text-xs text-red-300/80">
                  ERROR: {error}
                </div>
              )}
            </div>

            {/* Right — live progress */}
            <div className="space-y-4">
              <p className="text-[10px] text-white/25 uppercase tracking-widest">Live Progress</p>

              {progress.length === 0 && !running ? (
                <div className="border border-white/8 p-8 text-center text-[10px] text-white/15 tracking-widest uppercase">
                  AWAITING AUDIT START
                </div>
              ) : (
                <div className="space-y-1.5">
                  {progress.map(p => (
                    <div key={p.index} className={`border px-3 py-2.5 transition-all ${
                      p.verdict === 'COMPLIANT' ? 'border-emerald-500/25 bg-emerald-950/10' :
                      p.verdict === 'VIOLATION' ? 'border-red-500/25 bg-red-950/10' :
                      currentCase === p.index ? 'border-white/15 bg-white/3' :
                      'border-white/6'
                    }`}>
                      <div className="flex items-center justify-between gap-2 text-[10px]">
                        <span className="text-white/30">#{p.index + 1}</span>
                        <span className={`font-bold shrink-0 ${
                          p.verdict === 'COMPLIANT' ? 'text-emerald-400' :
                          p.verdict === 'VIOLATION' ? 'text-red-400' :
                          currentCase === p.index ? 'text-amber-400 animate-pulse' : 'text-white/20'
                        }`}>
                          {p.verdict === 'COMPLIANT' ? '✓ COMPLIANT' :
                           p.verdict === 'VIOLATION' ? '✗ VIOLATION' :
                           currentCase === p.index ? '◌ TESTING...' : '—'}
                        </span>
                      </div>
                      <p className="text-[9px] text-white/30 mt-1 truncate">{p.preview}</p>
                      {p.violation_ids && p.violation_ids.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {p.violation_ids.map(id => (
                            <span key={id} className="text-[8px] text-red-400/70 border border-red-500/20 px-1">{id}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {reportStage === 'generating' && (
                    <div className="border border-white/10 px-3 py-3 text-[10px] text-amber-400/70 animate-pulse">
                      ◌ GENERATING COMPLIANCE REPORT...
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ─── REPORT VIEW ───────────────────────────────────────────────────── */
          <div className="space-y-8">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] text-white/25 uppercase tracking-widest mb-1">Compliance Audit Report</p>
                <h1 className="text-xl font-bold text-white tracking-wide">{report.system_name}</h1>
                <p className="text-xs text-white/30 mt-1">{report.domain.replace(/_/g, ' ').toUpperCase()} · {new Date(report.timestamp).toLocaleString()} · Report {report.id.slice(0, 8)}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => { setReport(null); setProgress([]); setReportStage('idle') }}
                  className="text-[10px] tracking-wider text-white/30 border border-white/10 px-3 py-1.5 hover:border-white/25 hover:text-white/60 transition-all"
                >
                  ← NEW AUDIT
                </button>
                <button
                  onClick={downloadReport}
                  className="text-[10px] tracking-wider text-white/50 border border-white/20 px-3 py-1.5 hover:border-white/40 hover:text-white/80 transition-all"
                >
                  ↓ DOWNLOAD JSON
                </button>
              </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KPI label="Compliance Rate" value={`${Math.round(report.compliance_rate * 100)}%`}
                sub={`${report.compliant}/${report.total_tested} decisions`}
                color={report.compliance_rate >= 0.95 ? 'emerald' : report.compliance_rate >= 0.75 ? 'yellow' : 'red'} />
              <KPI label="Risk Level" value={report.risk_level}
                sub={report.domain.replace(/_/g, ' ')}
                color={report.risk_level === 'UNACCEPTABLE' ? 'red' : report.risk_level === 'HIGH' ? 'orange' : 'yellow'} />
              <KPI label="Decisions Tested" value={String(report.total_tested)}
                sub={`${report.violated} violations`}
                color="white" />
              <KPI label="Invariants" value={String(report.invariant_stats.length)}
                sub={`${report.invariant_stats.filter(s => s.violations > 0).length} with violations`}
                color="white" />
            </div>

            {/* Risk basis */}
            <div className={`border px-4 py-3 text-xs ${
              report.risk_level === 'UNACCEPTABLE' ? 'border-red-500/40 bg-red-950/15 text-red-300/80' :
              report.risk_level === 'HIGH' ? 'border-orange-500/30 bg-orange-950/10 text-orange-300/70' :
              'border-white/10 text-white/40'
            }`}>
              <span className={`font-bold uppercase tracking-wider mr-2 ${riskColor(report.risk_level)}`}>
                {report.risk_level}
              </span>
              {report.risk_basis}
            </div>

            {/* Executive summary */}
            <div className="border border-white/8 p-5">
              <p className="text-[10px] text-white/25 uppercase tracking-widest mb-2">Executive Summary</p>
              <p className="text-sm text-white/60 leading-relaxed">{report.executive_summary}</p>
            </div>

            <div className="grid xl:grid-cols-2 gap-6">
              {/* Invariant heatmap */}
              <div className="border border-white/8 p-5">
                <p className="text-[10px] text-white/25 uppercase tracking-widest mb-4">Invariant Analysis</p>
                <div className="space-y-2">
                  {report.invariant_stats.map(s => (
                    <InvariantBar key={s.id} stat={s} />
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              <div className="border border-white/8 p-5">
                <p className="text-[10px] text-white/25 uppercase tracking-widest mb-4">Recommendations</p>
                <div className="space-y-3">
                  {report.recommendations.map((r, i) => (
                    <div key={i} className={`flex gap-3 text-xs ${
                      r.startsWith('CRITICAL') ? 'text-red-300/90' : 'text-white/50'
                    }`}>
                      <span className={`shrink-0 font-bold ${r.startsWith('CRITICAL') ? 'text-red-400' : 'text-white/25'}`}>
                        {i + 1}.
                      </span>
                      <span className="leading-relaxed">{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Regulatory compliance tables */}
            <div className="space-y-6">
              <ArticleTable
                title="EU AI Act — Regulatory Compliance"
                subtitle="Regulation (EU) 2024/1689 · High-Risk AI Systems"
                articles={report.eu_ai_act}
              />
              <ArticleTable
                title="Canada — AIDA Principles"
                subtitle="Bill C-27 Artificial Intelligence and Data Act (principles will resurface post-election)"
                articles={report.canada_aida}
              />
            </div>

            {/* Signature */}
            <div className="border border-white/6 px-4 py-3 text-[9px] text-white/20">
              <span className="text-white/30 uppercase tracking-wider mr-2">NEXUM Ed25519 Audit Signature</span>
              <span className="break-all">{report.signature.slice(0, 80)}…</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function KPI({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const colorClass =
    color === 'emerald' ? 'text-emerald-400' :
    color === 'yellow' ? 'text-yellow-400' :
    color === 'orange' ? 'text-orange-400' :
    color === 'red' ? 'text-red-400' : 'text-white'
  return (
    <div className="border border-white/8 p-4">
      <p className="text-[9px] text-white/25 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold tracking-wide ${colorClass}`}>{value}</p>
      <p className="text-[9px] text-white/25 mt-0.5">{sub}</p>
    </div>
  )
}

function InvariantBar({ stat }: { stat: InvariantStat }) {
  const rate = stat.violation_rate
  const color = rate === 0 ? 'bg-emerald-500/40' : rate < 0.3 ? 'bg-yellow-500/50' : 'bg-red-500/60'
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] mb-1">
        <span className={rate > 0 ? 'text-red-400/80' : 'text-white/40'}>{stat.id}</span>
        <span className={rate > 0 ? 'text-red-400' : 'text-emerald-400/60'}>
          {stat.violations}/{stat.tested} {rate > 0 ? 'VIOLATED' : 'PASS'}
        </span>
      </div>
      <div className="h-1.5 bg-white/5 w-full">
        <div className={`h-full transition-all ${color}`} style={{ width: `${rate === 0 ? 100 : Math.max(rate * 100, 4)}%` }} />
      </div>
      <p className="text-[8px] text-white/20 mt-0.5 truncate">{stat.description}</p>
    </div>
  )
}

function ArticleTable({ title, subtitle, articles }: { title: string; subtitle: string; articles: ArticleResult[] }) {
  return (
    <div className="border border-white/8">
      <div className="px-5 py-3 border-b border-white/6">
        <p className="text-xs text-white/60 font-bold tracking-wide">{title}</p>
        <p className="text-[9px] text-white/25 mt-0.5">{subtitle}</p>
      </div>
      <div className="divide-y divide-white/5">
        {articles.map(a => (
          <div key={a.id} className={`px-5 py-3.5 grid grid-cols-[120px_1fr_100px] gap-4 items-start ${
            a.status === 'NOT_APPLICABLE' ? 'opacity-40' : ''
          }`}>
            <div>
              <p className="text-[10px] font-bold text-white/60">{a.id}</p>
              <p className="text-[9px] text-white/30 leading-snug mt-0.5">{a.title.split('—')[1]?.trim() ?? a.title}</p>
            </div>
            <div>
              <p className="text-[10px] text-white/45 leading-relaxed">{a.finding}</p>
              {a.mapped_invariants.length > 0 && a.mapped_invariants.length <= 6 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {a.mapped_invariants.map(id => (
                    <span key={id} className="text-[8px] text-white/25 border border-white/8 px-1">{id}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="text-right">
              <span className={`text-[9px] font-bold px-2 py-0.5 border tracking-wider ${
                a.status === 'COMPLIANT' ? 'border-emerald-500/30 text-emerald-400' :
                a.status === 'PARTIAL' ? 'border-yellow-500/30 text-yellow-400' :
                a.status === 'NON_COMPLIANT' ? 'border-red-500/40 text-red-400' :
                'border-white/10 text-white/25'
              }`}>
                {a.status === 'NOT_APPLICABLE' ? 'N/A' : a.status === 'NON_COMPLIANT' ? 'NON-COMPLIANT' : a.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
