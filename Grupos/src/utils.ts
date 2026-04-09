/**
 * Converte uma string numérica no formato brasileiro (vírgula decimal)
 * para um número float no padrão americano (ponto decimal).
 *
 * Exemplos:
 *   "256,60"   -> 256.60
 *   "1.256,60" -> 1256.60
 *   "127,15"   -> 127.15
 */
export function parseBrlToFloat(valor: string): number {
    if (!valor || typeof valor !== "string") {
        throw new Error(`Valor inválido para conversão: "${valor}"`);
    }

    // Remove espaços, R$, e caracteres especiais
    let limpo = valor
        .replace(/\s/g, "")
        .replace("R$", "")
        .replace("US$", "")
        .trim();

    // Remove pontos de milhar e troca vírgula por ponto
    limpo = limpo.replace(/\./g, "").replace(",", ".");

    const numero = parseFloat(limpo);

    if (isNaN(numero)) {
        throw new Error(`Não foi possível converter "${valor}" para número.`);
    }

    return numero;
}

/**
 * Formata um número para o padrão brasileiro (R$)
 */
export function formatBrl(valor: number): string {
    return valor.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

/**
 * Retorna uma promise que resolve após `ms` milissegundos.
 * Útil para delays controlados dentro do scraping.
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
