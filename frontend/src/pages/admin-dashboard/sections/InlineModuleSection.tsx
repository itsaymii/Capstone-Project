import { useState } from 'react'
import { glassPanelClass, glassPanelSoftClass } from './constants'

type InlineModuleSectionProps = {
  title: string
  eyebrow: string
  description: string
}

export function InlineModuleSection({ title, eyebrow, description }: InlineModuleSectionProps) {
  const [systemName, setSystemName] = useState('Lucena DRRMO Command Center')
  const [systemLogo, setSystemLogo] = useState('')
  const [organizationName, setOrganizationName] = useState('Lucena City DRRMO')
  const [contactEmail, setContactEmail] = useState('info@lucenadrrmo.gov.ph')
  const [contactNumber, setContactNumber] = useState('+63 42 123 4567')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [sessionTimeout, setSessionTimeout] = useState('30')
  const [loginAttemptLimit, setLoginAttemptLimit] = useState('5')

  const [smtpEmail, setSmtpEmail] = useState('smtp@lucenadrrmo.gov.ph')
  const [smtpPassword, setSmtpPassword] = useState('')
  const [testEmail, setTestEmail] = useState('admin@lucenadrrmo.gov.ph')

  const [defaultMapCenter, setDefaultMapCenter] = useState('13.9414, 121.6236')
  const [defaultZoomLevel, setDefaultZoomLevel] = useState('13')
  const [enableHeatmap, setEnableHeatmap] = useState(true)
  const [showBarangayBoundaries, setShowBarangayBoundaries] = useState(true)

  const [enableEmailAlerts, setEnableEmailAlerts] = useState(true)
  const [alertSeverityLevel, setAlertSeverityLevel] = useState('medium')
  const [notificationSound, setNotificationSound] = useState(true)

  const [backupStatus, setBackupStatus] = useState('No backup performed yet.')
  const [restoreStatus, setRestoreStatus] = useState('No restore action performed yet.')
  const [exportStatus, setExportStatus] = useState('No export performed yet.')

  function handleTestEmail() {
    setExportStatus('Sending test email...')
    setTimeout(() => setExportStatus('Test email sent to ' + testEmail), 800)
  }

  function handleBackup() {
    setBackupStatus('Database backup completed successfully.')
  }

  function handleRestore() {
    setRestoreStatus('Database restore completed successfully.')
  }

  function handleExportReports() {
    setExportStatus('Export completed. Reports file is ready for download.')
  }

  return (
    <section className="px-6 py-10 bg-slate-50">
      <div className={`${glassPanelClass} p-8 md:p-10`}>
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">{title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{description}</p>
        </div>

        <div className="mt-8 space-y-8">
          <section className={`${glassPanelSoftClass} p-6 shadow-sm ring-1 ring-slate-100/80`}>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">1. General</p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">System identity</h3>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-700">
                <span>System Name</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-blue-200"
                  value={systemName}
                  onChange={(event) => setSystemName(event.target.value)}
                  type="text"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-700">
                <span>System Logo URL</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-blue-200"
                  value={systemLogo}
                  onChange={(event) => setSystemLogo(event.target.value)}
                  type="text"
                  placeholder="https://..."
                />
              </label>

              <label className="space-y-2 text-sm text-slate-700">
                <span>Organization Name</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-blue-200"
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  type="text"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-700">
                <span>Contact Email</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-blue-200"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  type="email"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-700">
                <span>Contact Number</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-blue-200"
                  value={contactNumber}
                  onChange={(event) => setContactNumber(event.target.value)}
                  type="tel"
                />
              </label>
            </div>
          </section>

          <section className={`${glassPanelSoftClass} p-6 shadow-sm ring-1 ring-slate-100/80`}>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">2. Security</p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">Account protection</h3>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-700">
                <span>Current Password</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-blue-200"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  type="password"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-700">
                <span>New Password</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-blue-200"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  type="password"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-700">
                <span>Confirm Password</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-blue-200"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  type="password"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-700">
                <span>Session Timeout (minutes)</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-blue-200"
                  value={sessionTimeout}
                  onChange={(event) => setSessionTimeout(event.target.value)}
                  type="number"
                  min="5"
                  max="240"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-700">
                <span>Login Attempt Limit</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-blue-200"
                  value={loginAttemptLimit}
                  onChange={(event) => setLoginAttemptLimit(event.target.value)}
                  type="number"
                  min="1"
                  max="20"
                />
              </label>
            </div>
          </section>

          <section className={`${glassPanelSoftClass} p-6`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">3. Email Configuration</p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">SMTP settings</h3>
              </div>
            </div>

            <p className="mt-4 text-sm text-slate-600">Ginagamit ito para sa OTP at email notifications.</p>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-700">
                <span>SMTP Email</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-blue-200"
                  value={smtpEmail}
                  onChange={(event) => setSmtpEmail(event.target.value)}
                  type="email"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-700">
                <span>SMTP Password</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-blue-200"
                  value={smtpPassword}
                  onChange={(event) => setSmtpPassword(event.target.value)}
                  type="password"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-700 lg:col-span-2">
                <span>Test Email</span>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-blue-200"
                    value={testEmail}
                    onChange={(event) => setTestEmail(event.target.value)}
                    type="email"
                  />
                  <button
                    className="inline-flex items-center justify-center rounded-2xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 hover:shadow-md"
                    type="button"
                    onClick={handleTestEmail}
                  >
                    Send Test Email
                  </button>
                </div>
              </label>
            </div>
          </section>

          <section className={`${glassPanelSoftClass} p-6 shadow-sm ring-1 ring-slate-100/80`}>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">4. Map Settings</p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">Map defaults</h3>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-700">
                <span>Default Map Center</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-blue-200"
                  value={defaultMapCenter}
                  onChange={(event) => setDefaultMapCenter(event.target.value)}
                  type="text"
                  placeholder="lat, lng"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-700">
                <span>Default Zoom Level</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-blue-200"
                  value={defaultZoomLevel}
                  onChange={(event) => setDefaultZoomLevel(event.target.value)}
                  type="number"
                  min="1"
                  max="20"
                />
              </label>

              <div className="space-y-4 lg:col-span-2">
                <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white px-4 py-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Enable Heatmap</p>
                    <p className="mt-1 text-xs text-slate-500">Visualize density on the map for incident clusters.</p>
                  </div>
                  <button
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${enableHeatmap ? 'bg-blue-700 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}
                    type="button"
                    onClick={() => setEnableHeatmap((current) => !current)}
                  >
                    {enableHeatmap ? 'On' : 'Off'}
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white px-4 py-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Show Barangay Boundaries</p>
                    <p className="mt-1 text-xs text-slate-500">Toggle the barangay boundary overlay on the map view.</p>
                  </div>
                  <button
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${showBarangayBoundaries ? 'bg-blue-700 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}
                    type="button"
                    onClick={() => setShowBarangayBoundaries((current) => !current)}
                  >
                    {showBarangayBoundaries ? 'Shown' : 'Hidden'}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className={`${glassPanelSoftClass} p-6 shadow-sm ring-1 ring-slate-100/80`}>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">5. Alert Settings</p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">Notification rules</h3>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Enable Email Alerts</p>
                  <p className="mt-1 text-xs text-slate-500">Send email notifications for high-priority incidents.</p>
                </div>
                <button
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${enableEmailAlerts ? 'bg-blue-700 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}
                  type="button"
                  onClick={() => setEnableEmailAlerts((current) => !current)}
                >
                  {enableEmailAlerts ? 'On' : 'Off'}
                </button>
              </div>

              <label className="space-y-2 text-sm text-slate-700">
                <span>Alert Severity Level</span>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-blue-200"
                  value={alertSeverityLevel}
                  onChange={(event) => setAlertSeverityLevel(event.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>

              <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white px-4 py-4 lg:col-span-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Notification Sound</p>
                  <p className="mt-1 text-xs text-slate-500">Enable or disable audible alerts for new notifications.</p>
                </div>
                <button
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${notificationSound ? 'bg-blue-700 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}
                  type="button"
                  onClick={() => setNotificationSound((current) => !current)}
                >
                  {notificationSound ? 'On' : 'Off'}
                </button>
              </div>
            </div>
          </section>

          <section className={`${glassPanelSoftClass} p-6 shadow-sm ring-1 ring-slate-100/80`}>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">6. Data Management</p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">Backup and export</h3>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="grid gap-4 xl:grid-cols-3">
                <button
                  className="rounded-3xl border border-slate-200 bg-white px-4 py-4 text-left text-sm font-semibold text-slate-900 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:shadow-md"
                  type="button"
                  onClick={handleBackup}
                >
                  <p className="text-sm font-semibold">Backup Database</p>
                  <p className="mt-2 text-xs text-slate-500">Create a new database backup archive.</p>
                </button>

                <button
                  className="rounded-3xl border border-slate-200 bg-white px-4 py-4 text-left text-sm font-semibold text-slate-900 transition hover:border-blue-300 hover:bg-blue-50"
                  type="button"
                  onClick={handleRestore}
                >
                  <p className="text-sm font-semibold">Restore Database</p>
                  <p className="mt-2 text-xs text-slate-500">Restore data from the latest backup file.</p>
                </button>

                <button
                  className="rounded-3xl border border-slate-200 bg-white px-4 py-4 text-left text-sm font-semibold text-slate-900 transition hover:border-blue-300 hover:bg-blue-50"
                  type="button"
                  onClick={handleExportReports}
                >
                  <p className="text-sm font-semibold">Export Reports</p>
                  <p className="mt-2 text-xs text-slate-500">Download incident and accomplishments data.</p>
                </button>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Status</p>
                <p className="mt-2">{backupStatus}</p>
                <p className="mt-1">{restoreStatus}</p>
                <p className="mt-1">{exportStatus}</p>
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Save admin settings</p>
              <p className="mt-1 text-sm text-slate-500">These controls are currently local preview only. Integrate with backend storage as needed.</p>
            </div>
            <button
              className="inline-flex items-center justify-center rounded-3xl bg-blue-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-800"
              type="button"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
