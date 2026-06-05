import { useEffect, useMemo, useState } from 'react'
import { getIncidents, type BackendIncident } from '../../../services/incidents'

export function IncidentsList() {
  const [incidents, setIncidents] = useState<BackendIncident[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadIncidents() {
      try {
        setIsLoading(true)
        setError(null)
        const data = await getIncidents()
        if (isMounted) {
          setIncidents(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        console.error('[IncidentsList] Failed to load incidents:', err)
        if (isMounted) {
          setError('Failed to load incidents')
          setIncidents([])
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadIncidents()
    return () => {
      isMounted = false
    }
  }, [])

  const filteredIncidents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return incidents

    return incidents.filter((incident) =>
      [
        incident.reference_code,
        incident.address,
        incident.hazard_type?.name,
        incident.description,
        incident.severity_level,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    )
  }, [incidents, searchQuery])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Loading incidents...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Search incidents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="text-sm text-slate-600">
          {filteredIncidents.length} incident{filteredIncidents.length !== 1 ? 's' : ''}
        </div>
      </div>

      {filteredIncidents.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center">
          <p className="text-slate-600">
            {searchQuery ? 'No incidents found matching your search.' : 'No incidents available yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredIncidents.map((incident) => (
            <div
              key={incident.id}
              className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-slate-900">{incident.reference_code}</h3>
                  <p className="text-sm text-slate-600">{incident.address}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    incident.severity_level === 'high'
                      ? 'bg-red-100 text-red-800'
                      : incident.severity_level === 'moderate'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {incident.severity_level?.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">Hazard Type</p>
                  <p className="font-medium text-slate-900">{incident.hazard_type?.name}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Status</p>
                  <p className="font-medium text-slate-900 capitalize">{incident.status}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Date & Time</p>
                  <p className="font-medium text-slate-900">
                    {new Date(incident.incident_datetime).toLocaleString('en-PH', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Impact Level</p>
                  <p className="font-medium text-slate-900 capitalize">{incident.impact_level}</p>
                </div>
              </div>

              {incident.description && (
                <p className="text-sm text-slate-600 mt-3">{incident.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
