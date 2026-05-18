import net from 'net'
import type { Domain } from '../invariants/types'
import type { AnyDomainParams } from '../invariants/params'
import { z3Check, type Z3CheckResult } from '../z3-checker'

export type HardwareSource = 'software_mock' | 'fpga_risc_v'

export interface VerificationBridge {
  verify(params: AnyDomainParams, domain: Domain): Promise<Z3CheckResult>
  hardwareSource(): HardwareSource
  isConnected(): boolean
}

// ── Software bridge (default — Z3 in Node.js) ────────────────────────────────
class SoftwareBridge implements VerificationBridge {
  async verify(params: AnyDomainParams, domain: Domain): Promise<Z3CheckResult> {
    return z3Check(params, domain)
  }
  hardwareSource(): HardwareSource { return 'software_mock' }
  isConnected(): boolean { return true }
}

// ── Wire protocol ─────────────────────────────────────────────────────────────
// → board: {"version":1,"domain":"military","params":{...}}\n
// ← board: {"sat":true,"violations":[{"id":"MIL-001","desc":"..."}],"time_us":7,"engine":"nexum-riscv-v1"}\n

type BoardResponse = {
  sat: boolean
  violations: Array<{ id: string; desc: string }>
  time_us: number
  engine: string
}

function boardResponseToZ3Result(raw: BoardResponse, domain: Domain): Z3CheckResult {
  return {
    z3_result: raw.sat ? 'SAT' : 'UNSAT',
    violations: raw.violations.map(v => ({ id: v.id, description: v.desc })),
    invariants_checked: [],
    processing_time_ms: raw.time_us / 1000,
  }
}

// ── FPGA bridge — TCP socket to board-side UART bridge daemon ─────────────────
// Run nexum-sim on the board host at port 7642, or a UART↔TCP bridge daemon.
// Set NEXUM_FPGA_HOST=<host>:<port> to activate.
class FPGABridge implements VerificationBridge {
  private readonly host: string
  private readonly port: number
  private _connected = false

  constructor(host = '127.0.0.1', port = 7642) {
    this.host = host
    this.port = port
  }

  async verify(params: AnyDomainParams, domain: Domain): Promise<Z3CheckResult> {
    const payload = JSON.stringify({ version: 1, domain, params }) + '\n'

    return new Promise((resolve, reject) => {
      const socket = new net.Socket()
      let buf = ''

      socket.setTimeout(5000)

      socket.connect(this.port, this.host, () => {
        this._connected = true
        socket.write(payload)
      })

      socket.on('data', (chunk: Buffer) => {
        buf += chunk.toString()
        const nl = buf.indexOf('\n')
        if (nl === -1) return
        socket.destroy()
        try {
          const raw = JSON.parse(buf.slice(0, nl)) as BoardResponse
          resolve(boardResponseToZ3Result(raw, domain))
        } catch {
          reject(new Error('FPGA bridge: invalid JSON response'))
        }
      })

      socket.on('timeout', () => {
        socket.destroy()
        this._connected = false
        reject(new Error('FPGA bridge: timeout after 5s'))
      })

      socket.on('error', (err: Error) => {
        this._connected = false
        reject(new Error(`FPGA bridge: ${err.message}`))
      })

      socket.on('close', () => { this._connected = false })
    })
  }

  hardwareSource(): HardwareSource { return 'fpga_risc_v' }
  isConnected(): boolean { return this._connected }
}

// ── Singleton selection ───────────────────────────────────────────────────────
function selectBridge(): VerificationBridge {
  if (process.env.NEXUM_FPGA_HOST) {
    const [host, portStr] = process.env.NEXUM_FPGA_HOST.split(':')
    return new FPGABridge(host ?? '127.0.0.1', portStr ? parseInt(portStr, 10) : 7642)
  }
  return new SoftwareBridge()
}

export const bridge: VerificationBridge = selectBridge()
