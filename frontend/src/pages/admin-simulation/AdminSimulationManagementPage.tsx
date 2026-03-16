import { AdminSidebar } from '../../components/AdminSidebar'
import { AdminSimulationManager } from '../../components/AdminSimulationManager'

export function AdminSimulationManagementPage() {
  return (
    <div className="min-h-screen bg-[#181c23] text-slate-100 md:flex">
      <AdminSidebar activeKey="simulationTool" />

      <main className="flex-1">
        <div className="border-b border-slate-800 bg-[#181c23]">
          <div className="mx-auto w-full max-w-7xl px-6 py-5 sm:px-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Admin Operations</p>
            <h1 className="mt-1 text-2xl font-black text-white">Simulation Management</h1>
          </div>
        </div>

        <AdminSimulationManager />
      </main>
    </div>
  )
}
