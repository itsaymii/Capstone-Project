// Chart building blocks for the Analytics page (plain SVG/HTML, no chart library).
//
// Follows one set of rules everywhere: thin marks, one axis per chart, hairline grid,
// text in ink colors (never the series color), a hover tooltip on every mark, and a
// single-hue light-to-dark ramp for magnitude (maps, heat grids).

import { useEffect, useMemo, useRef, useState } from 'react'
import type { FocusEvent as ReactFocusEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'

export const INK = {
  primary: '#0b0b0b',
  secondary: '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  surface: '#fcfcfb',
  empty: '#f0efec',
}

/** Default color for a single series. */
export const SERIES_BLUE = '#2a78d6'

/**
 * Heat ramp for maps and grids, in the severity colors: yellow (few) → orange → red (many),
 * so busy places and hours read as danger. Index 0 is the lightest non-zero step.
 */
export const SEQUENTIAL_RED = ['#ffee58', '#ffd600', '#ffab00', '#ff6d00', '#ff1744', '#d50000']
/** Solid red for marks that go with the red heat maps (hour totals, tooltips). */
export const SERIES_RED = '#ff1744'

/** Status colors, always shown with a label. */
export const STATUS_COLORS = {
  critical: '#d03b3b',
  serious: '#ec835a',
  warning: '#fab219',
  good: '#0ca30c',
}

export type TooltipRow = { label: string; value: string; color?: string }

type TooltipState = { x: number; y: number; title: string; rows: TooltipRow[] } | null

type HoverEvent = ReactPointerEvent<Element> | ReactFocusEvent<Element>

/** One tooltip per chart, positioned inside the chart's own box. */
function useTooltip() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [tip, setTip] = useState<TooltipState>(null)

  function show(event: HoverEvent, title: string, rows: TooltipRow[]): void {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    let x: number
    let y: number
    if ('clientX' in event) {
      x = event.clientX - box.left
      y = event.clientY - box.top
    } else {
      const target = (event.target as Element).getBoundingClientRect()
      x = target.left - box.left + target.width / 2
      y = target.top - box.top
    }
    setTip({ x, y, title, rows })
  }

  return { ref, tip, show, hide: () => setTip(null) }
}

function Tooltip({ tip, containerWidth }: { tip: TooltipState; containerWidth: number }) {
  if (!tip) return null
  const width = 232
  const left = Math.max(0, Math.min(tip.x + 14, containerWidth - width))
  const top = Math.max(0, tip.y - 12)

  return (
    <div
      className="pointer-events-none absolute z-20 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs shadow-[0_10px_24px_rgba(15,23,42,0.14)]"
      role="status"
      style={{ left, top, width, transform: 'translateY(-100%)' }}
    >
      <p className="mb-1 font-semibold" style={{ color: INK.secondary }}>{tip.title}</p>
      {tip.rows.map((row) => (
        <div className="flex items-center gap-2" key={row.label}>
          {row.color ? <span className="inline-block h-0.5 w-3 shrink-0 rounded" style={{ background: row.color }} /> : null}
          <span className="font-bold tabular-nums" style={{ color: INK.primary }}>{row.value}</span>
          <span className="truncate" style={{ color: INK.secondary }}>{row.label}</span>
        </div>
      ))}
    </div>
  )
}

function ChartBox({ tooltip, children, className = '' }: { tooltip: ReturnType<typeof useTooltip>; children: ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`} onPointerLeave={tooltip.hide} ref={tooltip.ref}>
      {children}
      <Tooltip containerWidth={tooltip.ref.current?.clientWidth ?? 600} tip={tooltip.tip} />
    </div>
  )
}

export function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex min-h-[160px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm font-semibold text-slate-500">
      {message}
    </div>
  )
}

export function LegendItem({ color, label, shape = 'box' }: { color: string; label: string; shape?: 'box' | 'line' | 'dot' }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: INK.secondary }}>
      <span
        className={shape === 'line' ? 'inline-block h-0.5 w-4 rounded' : shape === 'dot' ? 'inline-block h-2.5 w-2.5 rounded-full' : 'inline-block h-2.5 w-2.5 rounded-[3px]'}
        style={{ background: color }}
      />
      {label}
    </span>
  )
}

/** Width of an element, kept up to date, so SVG text stays at its real size. */
function useMeasuredWidth(fallback = 640) {
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    if (!element) return
    const update = () => setWidth(Math.max(280, Math.round(element.clientWidth)))
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])
  // A callback ref, so a chart that first rendered its empty state still gets measured later.
  return { ref: setElement, width }
}

/** Whole-number axis ticks from 0 up to a round maximum (about 4 steps). */
function niceTicks(value: number): number[] {
  const target = Math.max(1, value)
  const raw = target / 4
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = Math.max(1, [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= raw) ?? 10 * magnitude)
  const wholeStep = Math.ceil(step)
  const top = Math.ceil(target / wholeStep) * wholeStep
  const ticks: number[] = []
  for (let tick = 0; tick <= top; tick += wholeStep) ticks.push(tick)
  return ticks
}

function niceMax(value: number): number {
  if (value <= 0) return 1
  const exponent = Math.pow(10, Math.floor(Math.log10(value)))
  const fraction = value / exponent
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10
  return nice * exponent
}

/** Lightest-to-darkest step for a value; 0 gets the empty color. */
function rampFor(max: number, ramp: string[]): string[] {
  // Fewer steps than whole numbers would leave empty classes; use the darker end of the ramp.
  return max > 0 && max < ramp.length ? ramp.slice(ramp.length - Math.ceil(max)) : ramp
}

export function sequentialColor(value: number, max: number, ramp: string[] = SEQUENTIAL_RED): string {
  if (value <= 0 || max <= 0) return INK.empty
  const steps = rampFor(max, ramp)
  const index = Math.min(steps.length - 1, Math.ceil((value / max) * steps.length) - 1)
  return steps[Math.max(0, index)]
}

export function SequentialLegend({ max, label, ramp = SEQUENTIAL_RED }: { max: number; label: string; ramp?: string[] }) {
  const steps = rampFor(max, ramp)
  const classes = steps
    .map((color, index) => {
      const from = Math.floor((max * index) / steps.length) + 1
      const to = Math.floor((max * (index + 1)) / steps.length)
      return { color, text: from >= to ? String(to) : `${from}–${to}`, empty: from > to }
    })
    .filter((item) => !item.empty)
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px]" style={{ color: INK.secondary }}>
      <span className="font-semibold">{label}</span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-3 w-5 rounded-[3px]" style={{ background: INK.empty }} />0
      </span>
      {classes.map((item) => (
        <span className="inline-flex items-center gap-1" key={item.color}>
          <span className="inline-block h-3 w-5 rounded-[3px]" style={{ background: item.color }} />
          {item.text}
        </span>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Horizontal bar list: one measure across items, sorted.
// ---------------------------------------------------------------------------

export type BarItem = { label: string; value: number; color?: string; note?: string }

export function BarList({
  items,
  emptyText = 'No data for these filters.',
  format = (value: number) => value.toLocaleString(),
  valueLabel = 'Count',
  maxItems,
}: {
  items: BarItem[]
  emptyText?: string
  format?: (value: number) => string
  valueLabel?: string
  maxItems?: number
}) {
  const tooltip = useTooltip()
  const shown = maxItems ? items.slice(0, maxItems) : items
  const max = Math.max(...shown.map((item) => item.value), 0)
  if (shown.length === 0 || max === 0) return <ChartEmpty message={emptyText} />

  return (
    <ChartBox className="space-y-2" tooltip={tooltip}>
      {shown.map((item) => {
        const rows: TooltipRow[] = [{ label: valueLabel, value: format(item.value), color: item.color ?? SERIES_BLUE }]
        if (item.note) rows.push({ label: item.note, value: '' })
        return (
          <div
            aria-label={`${item.label}: ${format(item.value)}`}
            className="group grid cursor-default grid-cols-[minmax(0,38%)_1fr_auto] items-center gap-3 rounded-lg px-1 py-0.5 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-300"
            key={item.label}
            onBlur={tooltip.hide}
            onFocus={(event) => tooltip.show(event, item.label, rows)}
            onPointerMove={(event) => tooltip.show(event, item.label, rows)}
            tabIndex={0}
          >
            <span className="truncate text-sm" style={{ color: INK.primary }} title={item.label}>
              {item.label}
            </span>
            <span className="h-3 w-full overflow-hidden rounded-r" style={{ background: INK.empty }}>
              <span
                className="block h-full rounded-r-[4px] transition-[width,filter] duration-500 group-hover:brightness-110"
                style={{ width: `${Math.max(1.5, (item.value / max) * 100)}%`, background: item.color ?? SERIES_BLUE }}
              />
            </span>
            <span className="min-w-[3ch] text-right text-sm font-semibold tabular-nums" style={{ color: INK.primary }}>
              {format(item.value)}
            </span>
          </div>
        )
      })}
      {maxItems && items.length > maxItems ? (
        <p className="pl-1 text-xs" style={{ color: INK.muted }}>
          Showing the top {maxItems} of {items.length}.
        </p>
      ) : null}
    </ChartBox>
  )
}

// ---------------------------------------------------------------------------
// 100% share bar: parts of a whole, in a fixed order.
// ---------------------------------------------------------------------------

export type ShareSegment = { label: string; value: number; color: string; textColor?: string }

export function ShareBar({ segments, emptyText = 'No data for these filters.', unit = 'reports' }: { segments: ShareSegment[]; emptyText?: string; unit?: string }) {
  const tooltip = useTooltip()
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  if (total === 0) return <ChartEmpty message={emptyText} />
  const shown = segments.filter((segment) => segment.value > 0)

  return (
    <ChartBox tooltip={tooltip}>
      <div className="flex h-9 w-full gap-[2px] overflow-hidden rounded-md">
        {shown.map((segment) => {
          const share = (segment.value / total) * 100
          const rows = [{ label: unit, value: `${segment.value.toLocaleString()} (${Math.round(share)}%)`, color: segment.color }]
          return (
            <div
              aria-label={`${segment.label}: ${segment.value} (${Math.round(share)}%)`}
              className="flex h-full items-center justify-center text-xs font-semibold outline-none transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-blue-300"
              key={segment.label}
              onBlur={tooltip.hide}
              onFocus={(event) => tooltip.show(event, segment.label, rows)}
              onPointerMove={(event) => tooltip.show(event, segment.label, rows)}
              style={{ width: `${share}%`, background: segment.color, color: segment.textColor ?? '#ffffff' }}
              tabIndex={0}
            >
              {share >= 9 ? `${Math.round(share)}%` : ''}
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {segments.map((segment) => (
          <span className="inline-flex items-center gap-1.5 text-xs" key={segment.label} style={{ color: INK.secondary }}>
            <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: segment.color }} />
            <span style={{ color: INK.primary }}>{segment.label}</span>
            <span className="tabular-nums">
              {segment.value.toLocaleString()} · {Math.round((segment.value / total) * 100)}%
            </span>
          </span>
        ))}
      </div>
    </ChartBox>
  )
}

// ---------------------------------------------------------------------------
// Line chart over periods with a crosshair (one or a few series, one y axis).
// ---------------------------------------------------------------------------

export type LineSeries = { label: string; color: string; values: number[] }

export function LineChart({
  periods,
  series,
  height = 220,
  emptyText = 'No data for these filters.',
  area = true,
}: {
  periods: string[]
  series: LineSeries[]
  height?: number
  emptyText?: string
  area?: boolean
}) {
  const tooltip = useTooltip()
  const measured = useMeasuredWidth()
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const width = measured.width
  const pad = { top: 14, right: 18, bottom: 28, left: 40 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const ticks = niceTicks(Math.max(0, ...series.flatMap((item) => item.values)))
  const max = ticks[ticks.length - 1]
  const hasData = periods.length > 0 && series.some((item) => item.values.some((value) => value > 0))
  if (!hasData) return <ChartEmpty message={emptyText} />

  const x = (index: number) => pad.left + (periods.length === 1 ? innerW / 2 : (index / (periods.length - 1)) * innerW)
  const y = (value: number) => pad.top + innerH - (value / max) * innerH
  const labelEvery = Math.max(1, Math.ceil(periods.length / Math.max(3, Math.floor(innerW / 80))))

  function handleMove(event: ReactPointerEvent<SVGRectElement>): void {
    const svg = event.currentTarget.ownerSVGElement
    if (!svg) return
    const box = svg.getBoundingClientRect()
    const svgX = ((event.clientX - box.left) / box.width) * width
    const index = Math.round(((svgX - pad.left) / innerW) * (periods.length - 1))
    const clamped = Math.max(0, Math.min(periods.length - 1, Number.isFinite(index) ? index : 0))
    setHoverIndex(clamped)
    tooltip.show(
      event,
      periods[clamped],
      series.map((item) => ({ label: item.label, value: item.values[clamped].toLocaleString(), color: item.color })),
    )
  }

  return (
    <ChartBox tooltip={tooltip}>
      <div ref={measured.ref}>
      <svg aria-label="Line chart" className="block w-full" height={height} role="img" viewBox={`0 0 ${width} ${height}`}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line stroke={tick === 0 ? INK.axis : INK.grid} strokeWidth="1" x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} />
            <text fill={INK.muted} fontSize="11" textAnchor="end" x={pad.left - 8} y={y(tick) + 4}>
              {tick}
            </text>
          </g>
        ))}
        {periods.map((period, index) =>
          index % labelEvery === 0 || index === periods.length - 1 ? (
            <text fill={INK.muted} fontSize="11" key={period} textAnchor="middle" x={x(index)} y={height - 8}>
              {period}
            </text>
          ) : null,
        )}
        {series.map((item) => {
          const path = item.values.map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(value)}`).join(' ')
          const areaPath = `${path} L${x(item.values.length - 1)},${y(0)} L${x(0)},${y(0)} Z`
          return (
            <g key={item.label}>
              {area && series.length === 1 ? <path d={areaPath} fill={item.color} opacity="0.1" /> : null}
              <path d={path} fill="none" stroke={item.color} strokeLinejoin="round" strokeWidth="2" />
            </g>
          )
        })}
        {hoverIndex !== null ? (
          <g>
            <line stroke={INK.axis} strokeWidth="1" x1={x(hoverIndex)} x2={x(hoverIndex)} y1={pad.top} y2={pad.top + innerH} />
            {series.map((item) => (
              <circle cx={x(hoverIndex)} cy={y(item.values[hoverIndex])} fill={item.color} key={item.label} r="4.5" stroke={INK.surface} strokeWidth="2" />
            ))}
          </g>
        ) : null}
        <rect
          fill="transparent"
          height={innerH}
          onPointerLeave={() => setHoverIndex(null)}
          onPointerMove={handleMove}
          width={innerW + 20}
          x={pad.left - 10}
          y={pad.top}
        />
      </svg>
      </div>
      {series.length > 1 ? (
        <div className="mt-2 flex flex-wrap gap-4">
          {series.map((item) => (
            <LegendItem color={item.color} key={item.label} label={item.label} shape="line" />
          ))}
        </div>
      ) : null}
    </ChartBox>
  )
}

// ---------------------------------------------------------------------------
// Small multiples: one mini line per incident type, all on the same scale.
// ---------------------------------------------------------------------------

export function SmallMultiples({ periods, series }: { periods: string[]; series: LineSeries[] }) {
  const tooltip = useTooltip()
  const [hover, setHover] = useState<{ series: string; index: number } | null>(null)
  const width = 220
  const height = 72
  const pad = { top: 6, right: 6, bottom: 6, left: 6 }
  const max = niceMax(Math.max(0, ...series.flatMap((item) => item.values)))
  const shown = series.filter((item) => item.values.some((value) => value > 0))
  if (periods.length < 2 || shown.length === 0) return null

  const x = (index: number) => pad.left + (index / (periods.length - 1)) * (width - pad.left - pad.right)
  const y = (value: number) => pad.top + (height - pad.top - pad.bottom) * (1 - value / max)

  return (
    <ChartBox className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" tooltip={tooltip}>
      {shown.map((item) => {
        const total = item.values.reduce((sum, value) => sum + value, 0)
        const peak = Math.max(...item.values)
        const peakIndex = item.values.indexOf(peak)
        const path = item.values.map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(value)}`).join(' ')
        return (
          <div className="rounded-xl border border-slate-100 bg-white p-3" key={item.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="truncate text-xs font-semibold" style={{ color: INK.primary }} title={item.label}>
                {item.label}
              </span>
              <span className="shrink-0 text-xs tabular-nums" style={{ color: INK.secondary }}>
                {total.toLocaleString()} total
              </span>
            </div>
            <svg aria-label={`${item.label} trend`} className="h-auto w-full" role="img" viewBox={`0 0 ${width} ${height}`}>
              <line stroke={INK.axis} strokeWidth="1" x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} />
              <path d={`${path} L${x(item.values.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={item.color} opacity="0.12" />
              <path d={path} fill="none" stroke={item.color} strokeLinejoin="round" strokeWidth="2" />
              <circle cx={x(peakIndex)} cy={y(peak)} fill={item.color} r="3.5" stroke={INK.surface} strokeWidth="2" />
              {hover?.series === item.label ? (
                <g>
                  <line stroke={INK.axis} x1={x(hover.index)} x2={x(hover.index)} y1={pad.top} y2={height - pad.bottom} />
                  <circle cx={x(hover.index)} cy={y(item.values[hover.index])} fill={item.color} r="4" stroke={INK.surface} strokeWidth="2" />
                </g>
              ) : null}
              <rect
                fill="transparent"
                height={height}
                onPointerLeave={() => setHover(null)}
                onPointerMove={(event) => {
                  const box = event.currentTarget.ownerSVGElement?.getBoundingClientRect()
                  if (!box) return
                  const svgX = ((event.clientX - box.left) / box.width) * width
                  const index = Math.max(0, Math.min(periods.length - 1, Math.round(((svgX - pad.left) / (width - pad.left - pad.right)) * (periods.length - 1))))
                  setHover({ series: item.label, index })
                  tooltip.show(event, periods[index], [{ label: item.label, value: item.values[index].toLocaleString(), color: item.color }])
                }}
                width={width}
                x="0"
                y="0"
              />
            </svg>
            <p className="mt-1 text-[11px]" style={{ color: INK.muted }}>
              Peak {peak.toLocaleString()} in {periods[peakIndex]}
            </p>
          </div>
        )
      })}
    </ChartBox>
  )
}

// ---------------------------------------------------------------------------
// Vertical histogram (ordered bins, e.g. magnitude bands).
// ---------------------------------------------------------------------------

export function Histogram({ bins, color = SERIES_BLUE, unit = 'events', emptyText = 'No data for these filters.' }: { bins: BarItem[]; color?: string; unit?: string; emptyText?: string }) {
  const tooltip = useTooltip()
  const measured = useMeasuredWidth(480)
  const ticks = niceTicks(Math.max(0, ...bins.map((bin) => bin.value)))
  const max = ticks[ticks.length - 1]
  const width = measured.width
  const height = 220
  const pad = { top: 22, right: 8, bottom: 30, left: 36 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const slot = innerW / bins.length
  const barW = Math.min(64, slot - 10)
  const y = (value: number) => pad.top + innerH - (value / max) * innerH
  if (bins.every((bin) => bin.value === 0)) return <ChartEmpty message={emptyText} />

  return (
    <ChartBox tooltip={tooltip}>
      <div ref={measured.ref}>
      <svg aria-label="Histogram" className="block w-full" height={height} role="img" viewBox={`0 0 ${width} ${height}`}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line stroke={tick === 0 ? INK.axis : INK.grid} x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} />
            <text fill={INK.muted} fontSize="11" textAnchor="end" x={pad.left - 6} y={y(tick) + 4}>
              {tick}
            </text>
          </g>
        ))}
        {bins.map((bin, index) => {
          const cx = pad.left + slot * index + slot / 2
          const top = y(bin.value)
          const barHeight = pad.top + innerH - top
          const rows = [{ label: unit, value: bin.value.toLocaleString(), color: bin.color ?? color }]
          return (
            <g key={bin.label}>
              <path
                d={barHeight > 0
                  ? `M${cx - barW / 2},${pad.top + innerH} V${top + Math.min(4, barHeight)} Q${cx - barW / 2},${top} ${cx - barW / 2 + 4},${top} H${cx + barW / 2 - 4} Q${cx + barW / 2},${top} ${cx + barW / 2},${top + Math.min(4, barHeight)} V${pad.top + innerH} Z`
                  : ''}
                fill={bin.color ?? color}
              />
              <rect
                aria-label={`${bin.label}: ${bin.value}`}
                fill="transparent"
                height={innerH + 20}
                onBlur={tooltip.hide}
                onFocus={(event) => tooltip.show(event, bin.label, rows)}
                onPointerMove={(event) => tooltip.show(event, bin.label, rows)}
                tabIndex={0}
                width={slot}
                x={pad.left + slot * index}
                y={pad.top - 20}
              />
              <text fill={INK.primary} fontSize="12" fontWeight="600" textAnchor="middle" x={cx} y={top - 6}>
                {bin.value}
              </text>
              <text fill={INK.secondary} fontSize="11" textAnchor="middle" x={cx} y={height - 10}>
                {bin.label}
              </text>
            </g>
          )
        })}
      </svg>
      </div>
    </ChartBox>
  )
}

// ---------------------------------------------------------------------------
// Choropleth map of barangays (GeoJSON polygons drawn as SVG paths).
// ---------------------------------------------------------------------------

type Position = number[]
type PolygonGeometry = { type: 'Polygon'; coordinates: Position[][] } | { type: 'MultiPolygon'; coordinates: Position[][][] }
export type BarangayFeature = { properties: Record<string, unknown>; geometry: PolygonGeometry }

/** "Barangay 10 (Pob.)", "Barangay 10", "Gulang-Gulang" → "10", "10", "gulanggulang". */
export function normalizeBarangayKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(pob\.?\)/g, '')
    .replace(/^\s*(barangay|brgy\.?|bgy\.?)\s+/, '')
    .replace(/[^a-z0-9]/g, '')
}

export function featureName(feature: BarangayFeature): string {
  return String(feature.properties.barangay_name ?? feature.properties.brgy_name ?? feature.properties.name ?? 'Unknown')
}

export type MapValue = { value: number; rows: TooltipRow[] }

export function ChoroplethMap({
  features,
  values,
  metricLabel,
  selectedKey,
  onSelect,
}: {
  features: BarangayFeature[]
  values: Map<string, MapValue>
  metricLabel: string
  selectedKey?: string | null
  onSelect?: (key: string, name: string) => void
}) {
  const tooltip = useTooltip()
  const width = 640

  const projected = useMemo(() => {
    const rings = features.flatMap((feature) =>
      feature.geometry.type === 'Polygon' ? feature.geometry.coordinates : feature.geometry.coordinates.flat(),
    )
    const points = rings.flat()
    if (points.length === 0) return null
    const lngs = points.map((point) => point[0])
    const lats = points.map((point) => point[1])
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const kx = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180))
    const scale = (width - 16) / ((maxLng - minLng) * kx)
    const height = (maxLat - minLat) * scale + 16
    const project = (point: Position) => `${8 + (point[0] - minLng) * kx * scale},${8 + (maxLat - point[1]) * scale}`
    const toPath = (polygon: Position[][]) => polygon.map((ring) => `M${ring.map(project).join('L')}Z`).join('')

    return {
      height,
      shapes: features.map((feature) => {
        const name = featureName(feature)
        const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates
        return { name, key: normalizeBarangayKey(name), d: polygons.map(toPath).join('') }
      }),
    }
  }, [features])

  if (!projected) return <ChartEmpty message="Barangay boundaries could not be loaded." />
  const max = Math.max(0, ...Array.from(values.values()).map((item) => item.value))

  return (
    <ChartBox tooltip={tooltip}>
      <svg aria-label={`Map of Lucena barangays by ${metricLabel}`} className="h-auto w-full" role="img" viewBox={`0 0 ${width} ${projected.height}`}>
        {projected.shapes.map((shape) => {
          const entry = values.get(shape.key)
          const value = entry?.value ?? 0
          const selected = selectedKey === shape.key
          const rows = entry?.rows ?? [{ label: metricLabel, value: '0' }]
          return (
            <path
              aria-label={`${shape.name}: ${value}`}
              className="cursor-pointer outline-none transition hover:brightness-95 focus-visible:brightness-90"
              d={shape.d}
              fill={sequentialColor(value, max)}
              key={shape.name}
              onBlur={tooltip.hide}
              onClick={() => onSelect?.(shape.key, shape.name)}
              onFocus={(event) => tooltip.show(event, shape.name, rows)}
              onPointerMove={(event) => tooltip.show(event, shape.name, rows)}
              stroke={selected ? INK.primary : INK.surface}
              strokeLinejoin="round"
              strokeWidth={selected ? 2.5 : 1.2}
              tabIndex={0}
            />
          )
        })}
      </svg>
      <div className="mt-3">
        <SequentialLegend label={metricLabel} max={max} />
      </div>
    </ChartBox>
  )
}

// ---------------------------------------------------------------------------
// Heat table: rows × columns with a number in each cell.
// ---------------------------------------------------------------------------

export function HeatTable({
  rowLabel,
  rows,
  columns,
  cells,
  emptyText = 'No data for these filters.',
}: {
  rowLabel: string
  rows: string[]
  columns: Array<{ label: string; color: string }>
  cells: number[][]
  emptyText?: string
}) {
  const tooltip = useTooltip()
  const max = Math.max(0, ...cells.flat())
  if (rows.length === 0 || max === 0) return <ChartEmpty message={emptyText} />
  const columnTotals = columns.map((_, col) => cells.reduce((sum, row) => sum + row[col], 0))

  return (
    <ChartBox className="overflow-x-auto" tooltip={tooltip}>
      <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-[2px] text-xs">
        <thead>
          <tr>
            <th className="w-[170px] px-2 py-1 text-left font-semibold" style={{ color: INK.secondary }}>{rowLabel}</th>
            {columns.map((column) => (
              <th className="px-1 py-1 text-center align-bottom font-semibold" key={column.label} style={{ color: INK.secondary }}>
                <span className="mx-auto mb-1 block h-1 w-6 rounded" style={{ background: column.color }} />
                {column.label}
              </th>
            ))}
            <th className="w-[56px] px-2 py-1 text-right font-semibold" style={{ color: INK.secondary }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const total = cells[rowIndex].reduce((sum, value) => sum + value, 0)
            return (
              <tr key={row}>
                <th className="max-w-[160px] truncate px-2 py-1 text-left font-medium" scope="row" style={{ color: INK.primary }} title={row}>
                  {row}
                </th>
                {columns.map((column, colIndex) => {
                  const value = cells[rowIndex][colIndex]
                  const background = sequentialColor(value, max)
                  const dark = [SEQUENTIAL_RED[4], SEQUENTIAL_RED[5]].includes(background)
                  const tooltipRows = [{ label: column.label, value: value.toLocaleString(), color: column.color }]
                  return (
                    <td
                      aria-label={`${row}, ${column.label}: ${value}`}
                      className="h-8 rounded-[4px] text-center font-semibold tabular-nums outline-none hover:ring-2 hover:ring-slate-900/30"
                      key={column.label}
                      onPointerMove={(event) => tooltip.show(event, row, tooltipRows)}
                      style={{ background, color: value === 0 ? INK.muted : dark ? '#ffffff' : INK.primary }}
                    >
                      {value === 0 ? '·' : value}
                    </td>
                  )
                })}
                <td className="px-2 text-right font-semibold tabular-nums" style={{ color: INK.primary }}>{total}</td>
              </tr>
            )
          })}
          <tr>
            <th className="px-2 py-1 text-left font-semibold" scope="row" style={{ color: INK.secondary }}>Total</th>
            {columnTotals.map((total, index) => (
              <td className="text-center font-semibold tabular-nums" key={columns[index].label} style={{ color: INK.secondary }}>
                {total}
              </td>
            ))}
            <td className="px-2 text-right font-bold tabular-nums" style={{ color: INK.primary }}>
              {columnTotals.reduce((sum, value) => sum + value, 0)}
            </td>
          </tr>
        </tbody>
      </table>
      <div className="mt-3">
        <SequentialLegend label="Reports per cell" max={max} />
      </div>
    </ChartBox>
  )
}

// ---------------------------------------------------------------------------
// Day × hour grid: when incidents happen.
// ---------------------------------------------------------------------------

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function hourLabel(hour: number): string {
  if (hour === 0) return '12AM'
  if (hour === 12) return '12PM'
  return hour < 12 ? `${hour}AM` : `${hour - 12}PM`
}

/** counts[day][hour], day 0 = Monday. */
export function DayHourGrid({ counts, emptyText = 'No incident times for these filters.' }: { counts: number[][]; emptyText?: string }) {
  const tooltip = useTooltip()
  const measured = useMeasuredWidth(720)
  const max = Math.max(0, ...counts.flat())
  const gap = 2
  const left = 40
  const top = 18
  const rightTotals = 44
  const cell = Math.max(12, Math.min(48, Math.floor((measured.width - left - rightTotals) / 24) - gap))
  const width = left + 24 * (cell + gap) + rightTotals
  const height = top + 7 * (cell + gap) + 30
  const hourTotals = Array.from({ length: 24 }, (_, hour) => counts.reduce((sum, day) => sum + day[hour], 0))
  const hourMax = Math.max(1, ...hourTotals)
  if (max === 0) return <ChartEmpty message={emptyText} />

  return (
    <ChartBox tooltip={tooltip}>
      <div className="overflow-x-auto" ref={measured.ref}>
      <svg aria-label="Incidents by day of week and hour" className="block" height={height} role="img" viewBox={`0 0 ${width} ${height}`} width={width}>
        {Array.from({ length: 24 }, (_, hour) =>
          hour % 3 === 0 ? (
            <text fill={INK.muted} fontSize="10" key={hour} textAnchor="middle" x={left + hour * (cell + gap) + cell / 2} y={top - 6}>
              {hourLabel(hour)}
            </text>
          ) : null,
        )}
        {counts.map((day, dayIndex) => {
          const rowY = top + dayIndex * (cell + gap)
          const dayTotal = day.reduce((sum, value) => sum + value, 0)
          return (
            <g key={DAY_NAMES[dayIndex]}>
              <text fill={INK.secondary} fontSize="11" textAnchor="end" x={left - 8} y={rowY + cell / 2 + 4}>
                {DAY_NAMES[dayIndex]}
              </text>
              {day.map((value, hour) => (
                <rect
                  aria-label={`${DAY_NAMES[dayIndex]} ${hourLabel(hour)}: ${value}`}
                  className="outline-none hover:opacity-80"
                  fill={sequentialColor(value, max)}
                  height={cell}
                  key={hour}
                  onPointerMove={(event) =>
                    tooltip.show(event, `${DAY_NAMES[dayIndex]}, ${hourLabel(hour)}–${hourLabel((hour + 1) % 24)}`, [
                      { label: 'incidents', value: value.toLocaleString(), color: SERIES_RED },
                    ])
                  }
                  rx="3"
                  width={cell}
                  x={left + hour * (cell + gap)}
                  y={rowY}
                />
              ))}
              <text fill={INK.primary} fontSize="11" fontWeight="600" textAnchor="start" x={left + 24 * (cell + gap) + 8} y={rowY + cell / 2 + 4}>
                {dayTotal}
              </text>
            </g>
          )
        })}
        {hourTotals.map((total, hour) => {
          const barH = (total / hourMax) * 22
          return (
            <rect
              fill={SERIES_RED}
              height={barH}
              key={hour}
              onPointerMove={(event) => tooltip.show(event, `${hourLabel(hour)}–${hourLabel((hour + 1) % 24)}, all days`, [{ label: 'incidents', value: total.toLocaleString(), color: SERIES_RED }])}
              opacity="0.7"
              rx="2"
              width={cell}
              x={left + hour * (cell + gap)}
              y={top + 7 * (cell + gap) + 26 - barH}
            />
          )
        })}
      </svg>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <SequentialLegend label="Incidents" max={max} />
        <span className="text-[11px]" style={{ color: INK.muted }}>Right: total per day · Bottom: total per hour</span>
      </div>
    </ChartBox>
  )
}

// ---------------------------------------------------------------------------
// Scatter: teams by response time (x) and resolution rate (y), dot size = reports.
// ---------------------------------------------------------------------------

export type ScatterPoint = { label: string; x: number; y: number; size: number; rows: TooltipRow[] }

export function ScatterPlot({
  points,
  xLabel,
  yLabel,
  xTarget,
  emptyText = 'No data for these filters.',
}: {
  points: ScatterPoint[]
  xLabel: string
  yLabel: string
  xTarget?: number
  emptyText?: string
}) {
  const tooltip = useTooltip()
  const measured = useMeasuredWidth()
  const width = measured.width
  const height = 320
  const pad = { top: 16, right: 110, bottom: 44, left: 52 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const xTicks = niceTicks(Math.max(xTarget ?? 0, ...points.map((point) => point.x)) * 1.1)
  const xMax = xTicks[xTicks.length - 1]
  const sizeMax = Math.max(1, ...points.map((point) => point.size))
  const x = (value: number) => pad.left + (value / xMax) * innerW
  const y = (value: number) => pad.top + innerH - (value / 100) * innerH
  const radius = (size: number) => 6 + Math.sqrt(size / sizeMax) * 12
  if (points.length === 0) return <ChartEmpty message={emptyText} />

  return (
    <ChartBox tooltip={tooltip}>
      <div ref={measured.ref}>
      <svg aria-label={`${yLabel} by ${xLabel}`} className="block w-full" height={height} role="img" viewBox={`0 0 ${width} ${height}`}>
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={`y${tick}`}>
            <line stroke={tick === 0 ? INK.axis : INK.grid} x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} />
            <text fill={INK.muted} fontSize="11" textAnchor="end" x={pad.left - 8} y={y(tick) + 4}>{tick}%</text>
          </g>
        ))}
        {xTicks.map((tick) => (
          <text fill={INK.muted} fontSize="11" key={`x${tick}`} textAnchor="middle" x={x(tick)} y={pad.top + innerH + 16}>
            {tick}
          </text>
        ))}
        <text fill={INK.secondary} fontSize="11" textAnchor="middle" x={pad.left + innerW / 2} y={height - 6}>{xLabel}</text>
        <text fill={INK.secondary} fontSize="11" textAnchor="middle" transform={`rotate(-90 14 ${pad.top + innerH / 2})`} x="14" y={pad.top + innerH / 2}>
          {yLabel}
        </text>
        {xTarget !== undefined ? (
          <g>
            <line stroke={INK.axis} x1={x(xTarget)} x2={x(xTarget)} y1={pad.top} y2={pad.top + innerH} />
            <text fill={INK.muted} fontSize="10" x={x(xTarget) + 4} y={pad.top + 10}>{xTarget}-min target</text>
          </g>
        ) : null}
        <text fill={INK.muted} fontSize="10" x={pad.left + 6} y={pad.top + 12}>Faster and more resolved ↖</text>
        {[...points].sort((a, b) => b.size - a.size).map((point) => (
          <g key={point.label}>
            <circle cx={x(point.x)} cy={y(point.y)} fill={SERIES_BLUE} fillOpacity="0.75" r={radius(point.size)} stroke={INK.surface} strokeWidth="2" />
            <text fill={INK.primary} fontSize="11" fontWeight="600" x={x(point.x) + radius(point.size) + 4} y={y(point.y) + 4}>
              {point.label}
            </text>
            <circle
              aria-label={point.label}
              cx={x(point.x)}
              cy={y(point.y)}
              fill="transparent"
              onBlur={tooltip.hide}
              onFocus={(event) => tooltip.show(event, point.label, point.rows)}
              onPointerMove={(event) => tooltip.show(event, point.label, point.rows)}
              r={Math.max(14, radius(point.size) + 4)}
              tabIndex={0}
            />
          </g>
        ))}
      </svg>
      </div>
      <p className="mt-1 text-[11px]" style={{ color: INK.muted }}>Dot size = number of reports.</p>
    </ChartBox>
  )
}

// ---------------------------------------------------------------------------
// Share rows: one thin 100% bar per item (e.g. severity mix per incident type).
// ---------------------------------------------------------------------------

export function ShareRows({
  rows,
  legend,
  unit = 'reports',
}: {
  rows: Array<{ label: string; segments: ShareSegment[] }>
  legend: Array<{ label: string; color: string }>
  unit?: string
}) {
  const tooltip = useTooltip()
  const shown = rows.filter((row) => row.segments.some((segment) => segment.value > 0))
  if (shown.length === 0) return null

  return (
    <ChartBox className="space-y-2" tooltip={tooltip}>
      {shown.map((row) => {
        const total = row.segments.reduce((sum, segment) => sum + segment.value, 0)
        return (
          <div className="grid grid-cols-[minmax(0,38%)_1fr_auto] items-center gap-3" key={row.label}>
            <span className="truncate text-sm" style={{ color: INK.primary }} title={row.label}>{row.label}</span>
            <div className="flex h-3 gap-[2px] overflow-hidden rounded-[3px]">
              {row.segments.filter((segment) => segment.value > 0).map((segment) => (
                <span
                  className="block h-full hover:brightness-110"
                  key={segment.label}
                  onPointerMove={(event) =>
                    tooltip.show(event, row.label, [
                      { label: `${segment.label} (${Math.round((segment.value / total) * 100)}%)`, value: `${segment.value} ${unit}`, color: segment.color },
                    ])
                  }
                  style={{ width: `${(segment.value / total) * 100}%`, background: segment.color }}
                />
              ))}
            </div>
            <span className="min-w-[3ch] text-right text-xs tabular-nums" style={{ color: INK.secondary }}>{total}</span>
          </div>
        )
      })}
      <div className="flex flex-wrap gap-4 pt-1">
        {legend.map((item) => (
          <LegendItem color={item.color} key={item.label} label={item.label} />
        ))}
      </div>
    </ChartBox>
  )
}