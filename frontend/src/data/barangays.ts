/**
 * The 33 barangays of Lucena City. Every barangay dropdown uses this list, so a barangay
 * shows up even before it has any reports.
 */
export const LUCENA_BARANGAYS = [
  'Barangay 1',
  'Barangay 2',
  'Barangay 3',
  'Barangay 4',
  'Barangay 5',
  'Barangay 6',
  'Barangay 7',
  'Barangay 8',
  'Barangay 9',
  'Barangay 10',
  'Barangay 11',
  'Barra',
  'Bocohan',
  'Cotta',
  'Dalahican',
  'Domoit',
  'Gulang-Gulang',
  'Ibabang Dupay',
  'Ibabang Iyam',
  'Ibabang Talim',
  'Ilayang Dupay',
  'Ilayang Iyam',
  'Ilayang Talim',
  'Isabang',
  'Market View',
  'Mayao Castillo',
  'Mayao Crossing',
  'Mayao Kanluran',
  'Mayao Parada',
  'Mayao Silangan',
  'Ransohan',
  'Salinas',
  'Talao-Talao',
] as const

export type LucenaBarangay = (typeof LUCENA_BARANGAYS)[number]

/** Lowercase words only: "Brgy. 1 (Pob.)" -> "barangay 1", "Talao-talao" -> "talao talao". */
function simplify(value: string): string {
  return value
    .toLowerCase()
    .replace(/\(pob\.?\)/g, ' ')
    .replace(/\b(brgy|bgy)\b\.?/g, 'barangay')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Longest names first, so "Barangay 10" is found before "Barangay 1" would be.
const SEARCH_ORDER = LUCENA_BARANGAYS.map((name) => ({ name, words: simplify(name) })).sort(
  (left, right) => right.words.length - left.words.length,
)

/**
 * The Lucena barangay named in a barangay name or a location such as
 * "Diversion Road, Stone Gate area, Domoit, Lucena City", or null if none is named.
 */
export function toLucenaBarangay(value: string | null | undefined): LucenaBarangay | null {
  if (!value) return null
  const text = ` ${simplify(value)} `

  for (const { name, words } of SEARCH_ORDER) {
    if (text.includes(` ${words} `)) return name
  }
  return null
}

/** All 33 barangays, then any other place names found in the data (e.g. "Unspecified"). */
export function withAllBarangays(found: Iterable<string>): string[] {
  const known = new Set<string>(LUCENA_BARANGAYS)
  const extras = Array.from(new Set(found))
    .filter((name) => name && !known.has(name))
    .sort((left, right) => left.localeCompare(right))
  return [...LUCENA_BARANGAYS, ...extras]
}
