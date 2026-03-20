import { glassPanelClass, glassPanelSoftClass } from './constants'

type InlineModuleSectionProps = {
  title: string
  eyebrow: string
  description: string
}

export function InlineModuleSection({ title, eyebrow, description }: InlineModuleSectionProps) {
  return (
    <section className="px-6 py-8">
      <div className={`${glassPanelClass} p-6`}>
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">{title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{description}</p>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <article className={`${glassPanelSoftClass} p-5`}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Status</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">Embedded in dashboard</p>
            <p className="mt-2 text-sm text-slate-600">This module now stays inside the same admin workspace instead of opening a separate dark page.</p>
          </article>
          <article className={`${glassPanelSoftClass} p-5`}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Theme</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">Light dashboard layout</p>
            <p className="mt-2 text-sm text-slate-600">The section uses the same light cards and spacing pattern as the overview screen.</p>
          </article>
          <article className={`${glassPanelSoftClass} p-5`}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Next step</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">Ready for module content</p>
            <p className="mt-2 text-sm text-slate-600">You can keep this inline panel or replace it later with full charts, tables, and forms for this section.</p>
          </article>
        </div>
      </div>
    </section>
  )
}
