// Helpers for TablePagination (kept apart so the component file only exports components).

export const PAGE_SIZE_OPTIONS = [10, 25, 50]

/** Page numbers to show, with null for a gap: 1 … 4 5 6 … 15. */
export function getPageNumbers(current: number, total: number): Array<number | null> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)

  const pages = new Set([1, total, current - 1, current, current + 1])
  const sorted = Array.from(pages).filter((page) => page >= 1 && page <= total).sort((a, b) => a - b)
  const result: Array<number | null> = []
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push(null)
    result.push(page)
  })
  return result
}

/** The page to show, kept between 1 and the last page (a filter can make the list shorter). */
export function clampPage(page: number, totalItems: number, pageSize: number): number {
  return Math.min(Math.max(1, page), Math.max(1, Math.ceil(totalItems / pageSize)))
}
