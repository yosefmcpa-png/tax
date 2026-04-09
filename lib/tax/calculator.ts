/**
 * Israeli Tax Calculator — 2024/2025
 * חישוב מס הכנסה, ביטוח לאומי, ומע"מ
 */

// ── מדרגות מס הכנסה 2024 ─────────────────────────────────
const INCOME_TAX_BRACKETS_2024 = [
  { upTo: 81_480,   rate: 0.10 },
  { upTo: 116_760,  rate: 0.14 },
  { upTo: 187_440,  rate: 0.20 },
  { upTo: 260_520,  rate: 0.31 },
  { upTo: 542_160,  rate: 0.35 },
  { upTo: 698_280,  rate: 0.47 },
  { upTo: Infinity, rate: 0.50 },
]

// ── נקודות זיכוי ─────────────────────────────────────────
const CREDIT_POINT_VALUE_2024 = 2_904 // ₪ לשנה (242 לחודש)

const CREDIT_POINTS: Record<string, number> = {
  resident:        2.25,  // תושב ישראל
  singleParent:    1,     // הורה יחיד
  child_0_5:       1.5,   // ילד 0-5
  child_6_17:      1,     // ילד 6-17
  newImmigrant:    3,     // עולה חדש (שנה ראשונה)
  disabled:        2,     // נכות
  soldier:         0.5,   // שחרור מצבא
}

// ── ביטוח לאומי + בריאות (שכיר) 2024 ───────────────────
const NI_EMPLOYEE = [
  { upTo: 7_522,   rate: 0.004 },   // עד מחצית שכר ממוצע
  { upTo: 49_030,  rate: 0.07  },   // מעל
]
const HEALTH_EMPLOYEE = [
  { upTo: 7_522,   rate: 0.031 },
  { upTo: 49_030,  rate: 0.05  },
]

// ── ביטוח לאומי עצמאי ───────────────────────────────────
const NI_SELF_EMPLOYED = [
  { upTo: 7_522,   rate: 0.0587 },
  { upTo: 49_030,  rate: 0.1240 },
]

export interface TaxInput {
  annualIncome:   number
  employeeType:   'employee' | 'self_employed'
  creditPoints:   number
  pensionPercent: number   // % הפקדה לפנסיה (0-7)
  includeVAT:     boolean
  vatableRevenue: number   // הכנסה חייבת מע"מ (עצמאי)
}

export interface TaxResult {
  grossIncome:        number
  pensionDeduction:   number
  taxableIncome:      number
  incomeTaxGross:     number
  creditReduction:    number
  incomeTaxNet:       number
  nationalInsurance:  number
  healthInsurance:    number
  totalDeductions:    number
  netIncome:          number
  effectiveRate:      number
  marginalRate:       number
  vatAmount:          number
  brackets:           Array<{ rate: number; amount: number; tax: number }>
  monthlyNet:         number
}

// ── Main calculator ──────────────────────────────────────

export function calculateTax(input: TaxInput): TaxResult {
  const { annualIncome, employeeType, creditPoints, pensionPercent, includeVAT, vatableRevenue } = input

  // פנסיה — מוכרת עד 7% מהכנסה
  const pensionPct     = Math.min(pensionPercent / 100, 0.07)
  const pensionDeduct  = annualIncome * pensionPct
  const taxableIncome  = Math.max(0, annualIncome - pensionDeduct)

  // מס הכנסה לפי מדרגות
  const { tax: incomeTaxGross, brackets } = calcBracketed(taxableIncome, INCOME_TAX_BRACKETS_2024)

  // זיכוי נקודות
  const creditReduction = creditPoints * CREDIT_POINT_VALUE_2024
  const incomeTaxNet    = Math.max(0, incomeTaxGross - creditReduction)

  // ביטוח לאומי + בריאות (חודשי → שנתי)
  const monthlyIncome = annualIncome / 12
  let niMonthly = 0, healthMonthly = 0

  if (employeeType === 'employee') {
    niMonthly     = calcBracketed(monthlyIncome, NI_EMPLOYEE).tax
    healthMonthly = calcBracketed(monthlyIncome, HEALTH_EMPLOYEE).tax
  } else {
    niMonthly = calcBracketed(monthlyIncome, NI_SELF_EMPLOYED).tax
    // עצמאי — בריאות כלולה בביטוח לאומי
  }

  const nationalInsurance = niMonthly * 12
  const healthInsurance   = employeeType === 'employee' ? healthMonthly * 12 : 0

  const totalDeductions = incomeTaxNet + nationalInsurance + healthInsurance
  const netIncome       = annualIncome - totalDeductions
  const effectiveRate   = annualIncome > 0 ? (totalDeductions / annualIncome) * 100 : 0
  const marginalRate    = getMarginalRate(taxableIncome) * 100

  // מע"מ
  const vatAmount = (includeVAT && vatableRevenue > 0)
    ? vatableRevenue * 0.17
    : 0

  return {
    grossIncome:        annualIncome,
    pensionDeduction:   pensionDeduct,
    taxableIncome,
    incomeTaxGross,
    creditReduction,
    incomeTaxNet,
    nationalInsurance,
    healthInsurance,
    totalDeductions,
    netIncome,
    effectiveRate,
    marginalRate,
    vatAmount,
    brackets,
    monthlyNet: netIncome / 12,
  }
}

// ── Helpers ──────────────────────────────────────────────

function calcBracketed(
  income: number,
  brackets: Array<{ upTo: number; rate: number }>
): { tax: number; brackets: Array<{ rate: number; amount: number; tax: number }> } {
  let tax = 0
  let prev = 0
  const breakdown: Array<{ rate: number; amount: number; tax: number }> = []

  for (const b of brackets) {
    if (income <= prev) break
    const amount = Math.min(income, b.upTo) - prev
    const bracketTax = amount * b.rate
    if (amount > 0) breakdown.push({ rate: b.rate * 100, amount, tax: bracketTax })
    tax += bracketTax
    prev = b.upTo
    if (income <= b.upTo) break
  }

  return { tax, brackets: breakdown }
}

function getMarginalRate(income: number): number {
  for (const b of INCOME_TAX_BRACKETS_2024) {
    if (income <= b.upTo) return b.rate
  }
  return 0.50
}

export function formatILS(n: number): string {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n)
}

// ── Presets ───────────────────────────────────────────────
export const PRESETS = [
  { label: 'שכיר ממוצע',         income: 144_000, type: 'employee'      as const, credits: 2.25, pension: 6 },
  { label: 'מהנדס / מנהל',       income: 360_000, type: 'employee'      as const, credits: 2.25, pension: 7 },
  { label: 'עצמאי קטן',          income: 120_000, type: 'self_employed'  as const, credits: 2.25, pension: 5 },
  { label: 'יועץ / פרילנסר',     income: 300_000, type: 'self_employed'  as const, credits: 2.25, pension: 7 },
  { label: 'הורה יחיד + 2 ילדים', income: 180_000, type: 'employee'      as const, credits: 5.75, pension: 6 },
]
