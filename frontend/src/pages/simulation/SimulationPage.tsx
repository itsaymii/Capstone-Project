import { NavigationBar } from '../../components/NavigationBar'

export function SimulationPage() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-800">
      <NavigationBar variant="hero" />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 sm:p-8">
        <section className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-10 shadow-xl">
          <h1 className="text-4xl font-semibold text-slate-900">Simulation</h1>
        </section>
      </div>
    </main>
  )
}