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

// ── FPGA bridge stub — replace with UART/AXI-Lite impl when board is available ──
// Protocol: send JSON params over serial, receive Z3CheckResult JSON
class FPGABridge implements VerificationBridge {
  private readonly host: string
  private readonly port: number

  constructor(host = '127.0.0.1', port = 7642) {
    this.host = host
    this.port = port
  }

  async verify(params: AnyDomainParams, domain: Domain): Promise<Z3CheckResult> {
    // TODO: implement net.Socket or SerialPort communication
    // Packet format: { version: 1, domain, params } → JSON newline
    // Response format: Z3CheckResult JSON newline
    void this.host
    void this.port
    throw new Error('FPGA bridge not implemented — use SoftwareBridge')
  }

  hardwareSource(): HardwareSource { return 'fpga_risc_v' }
  isConnected(): boolean { return false }
}

// ── Singleton selection ───────────────────────────────────────────────────────
// Set NEXUM_FPGA_HOST env var to enable hardware path
function selectBridge(): VerificationBridge {
  if (process.env.NEXUM_FPGA_HOST) {
    const [host, portStr] = process.env.NEXUM_FPGA_HOST.split(':')
    return new FPGABridge(host, portStr ? parseInt(portStr) : 7642)
  }
  return new SoftwareBridge()
}

export const bridge: VerificationBridge = selectBridge()
