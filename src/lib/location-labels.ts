export function normalizeRegionCode(value: string): string {
  if (!value) return value
  const upper = value.toUpperCase().trim()
  if (upper === "BRASIL") return "BRASIL"
  if (/^[A-Z]{2}$/.test(upper)) return `UF_${upper}`
  return upper
}

export function formatLocationLabel(value: string): string {
  const normalized = normalizeRegionCode(value)

  const map: Record<string, string> = {
    BRASIL: "Brasil",

    GOIANIA: "Goiânia",
    DOURADOS: "Dourados",
    CUIABA: "Cuiabá",
    UBERABA: "Uberaba",
    "CAMPO GRANDE": "Campo Grande",
    BELEM: "Belém",
    "PORTO VELHO": "Porto Velho",
    "SAO PAULO": "São Paulo",

    UF_AC: "Acre - AC",
    UF_AL: "Alagoas - AL",
    UF_AP: "Amapá - AP",
    UF_AM: "Amazonas - AM",
    UF_BA: "Bahia - BA",
    UF_CE: "Ceará - CE",
    UF_DF: "Distrito Federal - DF",
    UF_ES: "Espírito Santo - ES",
    UF_GO: "Goiás - GO",
    UF_MA: "Maranhão - MA",
    UF_MT: "Mato Grosso - MT",
    UF_MS: "Mato Grosso do Sul - MS",
    UF_MG: "Minas Gerais - MG",
    UF_PA: "Pará - PA",
    UF_PB: "Paraíba - PB",
    UF_PR: "Paraná - PR",
    UF_PE: "Pernambuco - PE",
    UF_PI: "Piauí - PI",
    UF_RJ: "Rio de Janeiro - RJ",
    UF_RN: "Rio Grande do Norte - RN",
    UF_RS: "Rio Grande do Sul - RS",
    UF_RO: "Rondônia - RO",
    UF_RR: "Roraima - RR",
    UF_SC: "Santa Catarina - SC",
    UF_SP: "São Paulo - SP",
    UF_SE: "Sergipe - SE",
    UF_TO: "Tocantins - TO",
  }

  if (map[normalized]) return map[normalized]

  return normalized
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

