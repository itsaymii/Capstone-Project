/**
 * Responder team names: Alpha, Bravo and Charlie, without a "Team" prefix.
 * Same rules as backend/incidents/teams.py, which cleans the names before reports are saved.
 */
export const TEAM_NAMES = ['Alpha', 'Bravo', 'Charlie'] as const

/** "Team Alpha", "TEAM-bravo" -> "Alpha", "Bravo". Other names only lose a leading "Team". */
export function toTeamName(value: string | null | undefined): string {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ')
  const stripped = text.replace(/^team\b[\s:.\-_]*/i, '')
  if (!stripped) return text

  return TEAM_NAMES.find((name) => name.toLowerCase() === stripped.toLowerCase()) ?? stripped
}
