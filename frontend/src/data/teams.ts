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

/**
 * A responder account's team (Alpha, Bravo or Charlie), set by an admin in Users; '' when it has none.
 * Logins saved before accounts had a team field fall back to the team in the account name ("Team Alpha").
 */
export function getAccountTeam(account: { team?: string | null; fullName?: string | null } | null | undefined): string {
  const team = toTeamName(account?.team === undefined ? account?.fullName : account.team)
  return (TEAM_NAMES as readonly string[]).includes(team) ? team : ''
}
