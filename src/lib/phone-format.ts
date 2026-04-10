export function formatPhoneForDisplay(value: string | null | undefined): string {
  if (!value) return "N/D"

  const raw = value.trim()
  if (!raw) return "N/D"

  const hasPlus = raw.startsWith("+")
  const digits = raw.replace(/\D/g, "")
  if (!digits) return raw

  // Brasil: exibir amigável sem código país.
  // +55 51 99205 9415 -> (51) 99205-9415
  const brDigits = digits.startsWith("55") ? digits.slice(2) : digits
  if (
    digits.startsWith("55") ||
    (!hasPlus && (digits.length === 10 || digits.length === 11))
  ) {
    if (brDigits.length === 11) {
      const ddd = brDigits.slice(0, 2)
      const p1 = brDigits.slice(2, 7)
      const p2 = brDigits.slice(7)
      return `(${ddd}) ${p1}-${p2}`
    }
    if (brDigits.length === 10) {
      const ddd = brDigits.slice(0, 2)
      const p1 = brDigits.slice(2, 6)
      const p2 = brDigits.slice(6)
      return `(${ddd}) ${p1}-${p2}`
    }
  }

  // EUA/Canadá: +1 (555) 999-9999
  if (digits.startsWith("1") && digits.length === 11) {
    const local = digits.slice(1)
    return `+1 (${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`
  }

  // Peru: +51 999 999 999
  if (digits.startsWith("51") && digits.length === 11) {
    const local = digits.slice(2)
    return `+51 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
  }

  // Portugal: +351 999 999 000
  if (digits.startsWith("351") && digits.length === 12) {
    const local = digits.slice(3)
    return `+351 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
  }

  // Fallback internacional: mantém + e agrupa em blocos de 3
  if (hasPlus) {
    const ccLen = digits.length > 11 ? 3 : digits.length > 10 ? 2 : 1
    const cc = digits.slice(0, ccLen)
    const rest = digits.slice(ccLen)
    const groups = rest.match(/.{1,3}/g)?.join(" ") || rest
    return `+${cc} ${groups}`.trim()
  }

  return raw
}
