import { AdminSimulationManager } from '../../../components/AdminSimulationManager'
import { SimulationCertificatesManager } from '../../../components/SimulationCertificatesManager'

export function SimulationSection() {
  return (
    <section className="grid gap-6 px-6 py-8">
      <SimulationCertificatesManager />
      <AdminSimulationManager embedded />
    </section>
  )
}
