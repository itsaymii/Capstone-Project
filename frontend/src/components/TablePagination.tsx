// Page controls under an admin table: "Showing 11–20 of 150", rows per page, Previous/Next and page numbers.

import { PAGE_SIZE_OPTIONS, getPageNumbers } from './pagination'

type TablePaginationProps = {
  page: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  label: string
}

const pageButtonClass =
  'rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40'

export function TablePagination({ page, pageSize, totalItems, onPageChange, onPageSizeChange, label }: TablePaginationProps) {
  if (totalItems === 0) return null

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const start = (page - 1) * pageSize

  return (
    <nav
      aria-label={label}
      className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <span>
          Showing <strong className="text-slate-900">{start + 1}–{Math.min(start + pageSize, totalItems)}</strong> of{' '}
          <strong className="text-slate-900">{totalItems.toLocaleString()}</strong>
        </span>
        <label className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Rows per page</span>
          <select
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-800 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            value={pageSize}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <button className={pageButtonClass} disabled={page === 1} onClick={() => onPageChange(page - 1)} type="button">
          Previous
        </button>
        {getPageNumbers(page, totalPages).map((number, index) =>
          number === null ? (
            <span className="px-1.5 text-sm text-slate-400" key={`gap-${index}`}>…</span>
          ) : (
            <button
              aria-current={number === page ? 'page' : undefined}
              className={`min-w-9 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition ${
                number === page
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              }`}
              key={number}
              onClick={() => onPageChange(number)}
              type="button"
            >
              {number}
            </button>
          ),
        )}
        <button className={pageButtonClass} disabled={page === totalPages} onClick={() => onPageChange(page + 1)} type="button">
          Next
        </button>
      </div>
    </nav>
  )
}
