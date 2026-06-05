import { useState } from 'react'
import { ResourcesMapPage } from './ResourcesMapPage'
import { ResourcesVehicleMaintenancePage } from './ResourcesVehicleMaintenancePage'

const tabs = [
  { id: 'map', label: 'Resource Map' },
  { id: 'maintenance', label: 'Vehicle Maintenance' },
] as const

type ResourceTab = (typeof tabs)[number]['id']

export function ResourcesSection() {
  const [activeTab, setActiveTab] = useState<ResourceTab>('map')

  return (
    <section className="px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Resources</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Resource Management</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
            View evacuation and service locations on one focused map, or manage vehicle maintenance records.
          </p>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
          <div className="mb-6 flex flex-wrap gap-3">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'map' ? <ResourcesMapPage /> : <ResourcesVehicleMaintenancePage />}
        </div>
      </div>
    </section>
  )
}
