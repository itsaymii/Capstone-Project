import { useState } from 'react'
import { glassPanelClass, glassPanelSoftClass } from './constants'

type MaintenanceChecklistStatus = 'pending' | 'complete' | 'incomplete'

type MaintenanceChecklistItem = {
  label: string
  status: MaintenanceChecklistStatus
  details?: string
}

type MaintenanceCategory = {
  title: string
  items: MaintenanceChecklistItem[]
}

type MaintenanceVehicleRecord = {
  team: string
  date: string
  time: string
  vehicle: string
  fuelType: string
  plateNumber: string
  assignedTo: string
  fuelGauge: string
  note: string
}

const defaultMaintenanceVehicleRecord: MaintenanceVehicleRecord = {
  team: 'BRAVO',
  date: 'March 01-02, 2026',
  time: '0800H - 0800H',
  vehicle: 'PCSO Commuter',
  fuelType: 'Diesel (70L)',
  plateNumber: 'IP 047A',
  assignedTo: 'Janet V. Gendrano',
  fuelGauge: '20%',
  note: 'Respectfully submitted with end-of-day maintenance notes from the 24-hour duty.',
}

const defaultMaintenanceTodoItems: MaintenanceChecklistItem[] = [
  { label: 'Disinfect and clean the ambulance', status: 'pending' },
  { label: 'Refill oxygen', status: 'pending', details: '100 PSI level' },
  { label: 'Inventory of supplies', status: 'complete' },
]

const defaultMaintenanceInventoryItems = [
  '1 stretcher',
  '1 folding stretcher (orange)',
  '1 scoop basket',
  '1 spine board',
  '1 oxygen tank',
  '1 set body splint (green)',
  '1 set padded board splint (blue)',
]

const defaultMaintenanceCategories: MaintenanceCategory[] = [
  {
    title: 'Check-up / Replacement of vehicle used',
    items: [
      { label: 'PMS', status: 'pending' },
      { label: 'Change oil / brake cleaning', status: 'pending' },
      { label: 'Brake pads', status: 'pending' },
      { label: 'Brake shoe', status: 'pending' },
      { label: 'Brake fluid / coolant / power steering / washer fluid', status: 'pending' },
      { label: 'Tire replacement / alignment', status: 'pending' },
      { label: 'Module siren replacement', status: 'pending' },
      { label: 'Wiper replacement', status: 'pending' },
      { label: 'Aircon cleaning', status: 'pending' },
      { label: 'Other services', status: 'pending', details: 'Pending workshop scheduling' },
    ],
  },
  {
    title: 'Communication equipment',
    items: [
      { label: 'Non-functional radio check', status: 'pending', details: 'Needs detailed equipment review' },
      { label: 'Functional communication line', status: 'complete' },
    ],
  },
]

function escapeHtmlCell(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function ResourcesSection() {
  const [maintenanceVehicleForm, setMaintenanceVehicleForm] = useState<MaintenanceVehicleRecord>(defaultMaintenanceVehicleRecord)
  const [maintenanceTodoState, setMaintenanceTodoState] = useState<MaintenanceChecklistItem[]>(defaultMaintenanceTodoItems)
  const [maintenanceCategoryState, setMaintenanceCategoryState] = useState<MaintenanceCategory[]>(defaultMaintenanceCategories)
  const [maintenanceMessage, setMaintenanceMessage] = useState('')

  function handleMaintenanceFieldChange(field: keyof MaintenanceVehicleRecord, value: string): void {
    setMaintenanceVehicleForm((current) => ({ ...current, [field]: value }))
    if (maintenanceMessage) setMaintenanceMessage('')
  }

  function handleMaintenanceTodoChange(index: number, field: 'status' | 'details', value: string): void {
    setMaintenanceTodoState((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    )
    if (maintenanceMessage) setMaintenanceMessage('')
  }

  function handleMaintenanceCategoryChange(categoryIndex: number, itemIndex: number, field: 'status' | 'details', value: string): void {
    setMaintenanceCategoryState((current) =>
      current.map((category, currentCategoryIndex) =>
        currentCategoryIndex === categoryIndex
          ? {
              ...category,
              items: category.items.map((item, currentItemIndex) =>
                currentItemIndex === itemIndex ? { ...item, [field]: value } : item,
              ),
            }
          : category,
      ),
    )
    if (maintenanceMessage) setMaintenanceMessage('')
  }

  function handleSaveMaintenanceRecord(): void {
    setMaintenanceMessage(
      `Maintenance record updated locally at ${new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.`,
    )
  }

  function handleResetMaintenanceRecord(): void {
    setMaintenanceVehicleForm(defaultMaintenanceVehicleRecord)
    setMaintenanceTodoState(defaultMaintenanceTodoItems)
    setMaintenanceCategoryState(defaultMaintenanceCategories)
    setMaintenanceMessage('Maintenance form reset to the default checklist.')
  }

  function printMaintenanceVehicleForm(): void {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=900')
    if (!printWindow) return

    const todoRows = maintenanceTodoState
      .map(
        (item) => `
          <tr>
            <td>${escapeHtmlCell(item.label)}</td>
            <td>${escapeHtmlCell(item.status)}</td>
            <td>${escapeHtmlCell(item.details || '-')}</td>
          </tr>
        `,
      )
      .join('')

    const inventoryRows = defaultMaintenanceInventoryItems.map((item) => `<li>${escapeHtmlCell(item)}</li>`).join('')

    const categorySections = maintenanceCategoryState
      .map(
        (category) => `
          <section class="category-block">
            <h3>${escapeHtmlCell(category.title)}</h3>
            <table>
              <thead>
                <tr><th>Item</th><th>Status</th><th>Details</th></tr>
              </thead>
              <tbody>
                ${category.items
                  .map(
                    (item) => `
                      <tr>
                        <td>${escapeHtmlCell(item.label)}</td>
                        <td>${escapeHtmlCell(item.status)}</td>
                        <td>${escapeHtmlCell(item.details || '-')}</td>
                      </tr>
                    `,
                  )
                  .join('')}
              </tbody>
            </table>
          </section>
        `,
      )
      .join('')

    printWindow.document.write(`
      <html>
        <head>
          <title>Maintenance Vehicle Form</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
            h1 { font-size: 24px; margin-bottom: 4px; text-transform: uppercase; }
            h2 { font-size: 16px; margin: 0 0 8px; }
            h3 { font-size: 14px; margin: 0 0 10px; text-transform: uppercase; }
            p { margin: 0; }
            .subtle { color: #475569; margin-bottom: 16px; }
            .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
            .info-card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px; }
            .info-card span { display: block; font-size: 11px; text-transform: uppercase; color: #64748b; margin-bottom: 6px; }
            .meta-table, table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left; vertical-align: top; font-size: 12px; }
            th { background: #e2e8f0; text-transform: uppercase; font-size: 11px; letter-spacing: 0.08em; }
            .section { margin-top: 18px; }
            .inventory-list { margin: 10px 0 0; padding-left: 18px; }
            .inventory-list li { margin-bottom: 6px; }
            .category-block { margin-top: 18px; }
            .note-box { margin-top: 12px; padding: 12px; border: 1px solid #cbd5e1; border-radius: 12px; background: #f8fafc; }
          </style>
        </head>
        <body>
          <h1>Maintenance of Vehicle</h1>
          <p class="subtle">Printable vehicle readiness and maintenance checklist for the current response unit.</p>

          <div class="summary-grid">
            <div class="info-card"><span>Team</span><strong>${escapeHtmlCell(maintenanceVehicleForm.team)}</strong></div>
            <div class="info-card"><span>Date</span><strong>${escapeHtmlCell(maintenanceVehicleForm.date)}</strong></div>
            <div class="info-card"><span>Time</span><strong>${escapeHtmlCell(maintenanceVehicleForm.time)}</strong></div>
            <div class="info-card"><span>Assigned For</span><strong>${escapeHtmlCell(maintenanceVehicleForm.assignedTo)}</strong></div>
          </div>

          <table class="meta-table">
            <thead>
              <tr><th>Vehicle</th><th>Fuel Type</th><th>Temporary Plate No.</th><th>Fuel Gauge</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>${escapeHtmlCell(maintenanceVehicleForm.vehicle)}</td>
                <td>${escapeHtmlCell(maintenanceVehicleForm.fuelType)}</td>
                <td>${escapeHtmlCell(maintenanceVehicleForm.plateNumber)}</td>
                <td>${escapeHtmlCell(maintenanceVehicleForm.fuelGauge)}</td>
              </tr>
            </tbody>
          </table>

          <div class="note-box">${escapeHtmlCell(maintenanceVehicleForm.note)}</div>

          <section class="section">
            <h2>Daily Maintenance Checklist</h2>
            <table>
              <thead><tr><th>Task</th><th>Status</th><th>Details</th></tr></thead>
              <tbody>${todoRows}</tbody>
            </table>
          </section>

          <section class="section">
            <h2>Inventory of Supplies</h2>
            <ul class="inventory-list">${inventoryRows}</ul>
          </section>

          ${categorySections}
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  return (
    <section className="px-6 py-8">
      <div className="grid gap-6">
        <div className={`${glassPanelClass} overflow-hidden`}>
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-[linear-gradient(180deg,#eff6ff_0%,#ffffff_100%)] px-6 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Resources</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">Maintenance Vehicle</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
                Vehicle readiness and equipment maintenance summary for the active response unit, based on the ambulance maintenance checklist format.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                onClick={handleResetMaintenanceRecord}
                type="button"
              >
                Reset Form
              </button>
              <button
                className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
                onClick={handleSaveMaintenanceRecord}
                type="button"
              >
                Save Changes
              </button>
              <button
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                onClick={printMaintenanceVehicleForm}
                type="button"
              >
                Print Maintenance Form
              </button>
            </div>
          </div>

          {maintenanceMessage ? (
            <div className="border-b border-slate-200 bg-emerald-50 px-6 py-3 text-sm font-medium text-emerald-700">{maintenanceMessage}</div>
          ) : null}

          <div className="grid gap-4 px-6 py-6 md:grid-cols-3 xl:grid-cols-4">
            <div className={`${glassPanelSoftClass} p-4`}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Team</p>
              <input
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => handleMaintenanceFieldChange('team', event.target.value)}
                type="text"
                value={maintenanceVehicleForm.team}
              />
            </div>
            <div className={`${glassPanelSoftClass} p-4`}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Date</p>
              <input
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => handleMaintenanceFieldChange('date', event.target.value)}
                type="text"
                value={maintenanceVehicleForm.date}
              />
            </div>
            <div className={`${glassPanelSoftClass} p-4`}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Time</p>
              <input
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => handleMaintenanceFieldChange('time', event.target.value)}
                type="text"
                value={maintenanceVehicleForm.time}
              />
            </div>
            <div className={`${glassPanelSoftClass} p-4`}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Assigned For</p>
              <input
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => handleMaintenanceFieldChange('assignedTo', event.target.value)}
                type="text"
                value={maintenanceVehicleForm.assignedTo}
              />
            </div>
          </div>

          <div className="grid gap-6 border-t border-slate-200 px-6 py-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="grid gap-6">
              <div className={`${glassPanelSoftClass} p-5`}>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Vehicle</p>
                    <input
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                      onChange={(event) => handleMaintenanceFieldChange('vehicle', event.target.value)}
                      type="text"
                      value={maintenanceVehicleForm.vehicle}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Fuel Type</p>
                    <input
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                      onChange={(event) => handleMaintenanceFieldChange('fuelType', event.target.value)}
                      type="text"
                      value={maintenanceVehicleForm.fuelType}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Temporary Plate No.</p>
                    <input
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                      onChange={(event) => handleMaintenanceFieldChange('plateNumber', event.target.value)}
                      type="text"
                      value={maintenanceVehicleForm.plateNumber}
                    />
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Fuel Gauge</p>
                      <input
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                        onChange={(event) => handleMaintenanceFieldChange('fuelGauge', event.target.value)}
                        type="text"
                        value={maintenanceVehicleForm.fuelGauge}
                      />
                    </div>
                    <div className="h-3 w-full max-w-[220px] overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: maintenanceVehicleForm.fuelGauge }} />
                    </div>
                  </div>
                  <textarea
                    className="mt-4 min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                    onChange={(event) => handleMaintenanceFieldChange('note', event.target.value)}
                    value={maintenanceVehicleForm.note}
                  />
                </div>
              </div>

              <div className={`${glassPanelSoftClass} p-5`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">To Do</p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-900">Daily maintenance checklist</h3>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Task</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {maintenanceTodoState.map((item, index) => (
                        <tr key={item.label}>
                          <td className="px-4 py-4 font-medium text-slate-900">{item.label}</td>
                          <td className="px-4 py-4">
                            <select
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-700"
                              onChange={(event) => handleMaintenanceTodoChange(index, 'status', event.target.value)}
                              value={item.status}
                            >
                              <option value="pending">Pending</option>
                              <option value="complete">Complete</option>
                              <option value="incomplete">Incomplete</option>
                            </select>
                          </td>
                          <td className="px-4 py-4 text-slate-600">
                            <input
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-700"
                              onChange={(event) => handleMaintenanceTodoChange(index, 'details', event.target.value)}
                              placeholder="Add details"
                              type="text"
                              value={item.details || ''}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="grid gap-6">
              <div className={`${glassPanelSoftClass} p-5`}>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Inventory of Supplies</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">Toyota commuter ambulance equipment</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {defaultMaintenanceInventoryItems.map((item) => (
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700" key={item}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              {maintenanceCategoryState.map((category, categoryIndex) => (
                <div className={`${glassPanelSoftClass} p-5`} key={category.title}>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Maintenance Category</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">{category.title}</h3>
                  <div className="mt-4 grid gap-3">
                    {category.items.map((item, itemIndex) => (
                      <div
                        className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
                        key={`${category.title}-${item.label}`}
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">{item.label}</p>
                          <input
                            className="mt-2 w-full min-w-[220px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-700"
                            onChange={(event) => handleMaintenanceCategoryChange(categoryIndex, itemIndex, 'details', event.target.value)}
                            placeholder="Add details"
                            type="text"
                            value={item.details || ''}
                          />
                        </div>
                        <select
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-700"
                          onChange={(event) => handleMaintenanceCategoryChange(categoryIndex, itemIndex, 'status', event.target.value)}
                          value={item.status}
                        >
                          <option value="pending">Pending</option>
                          <option value="complete">Complete</option>
                          <option value="incomplete">Incomplete</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
