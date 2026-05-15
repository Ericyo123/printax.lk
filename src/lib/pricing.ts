// Pricing calculation engine

export interface PricingRule {
  pricePerPage: number
  pricePerCopy: number
  pricePerBook: number
}

export type PricingType = 'PER_PAGE' | 'PER_COPY' | 'PER_BOOK' | 'MANUAL'
export type PrintMode = 'SINGLE' | 'DOUBLE'

export function calculateBaseAmount(
  rule: PricingRule,
  pricingType: PricingType,
  pages: number,
  copies: number,
  printMode: PrintMode,
  manualPrice?: number
): number {
  const effectivePages = printMode === 'DOUBLE' ? Math.ceil(pages / 2) : pages

  switch (pricingType) {
    case 'PER_PAGE':
      return rule.pricePerPage * effectivePages * copies
    case 'PER_COPY':
      return rule.pricePerCopy * copies
    case 'PER_BOOK':
      return rule.pricePerBook
    case 'MANUAL':
      return manualPrice ?? 0
    default:
      return 0
  }
}

export function calculateTotal(
  baseAmount: number,
  additionalAmounts: number[]
): number {
  const additionalTotal = additionalAmounts.reduce((sum, a) => sum + a, 0)
  return baseAmount + additionalTotal
}
