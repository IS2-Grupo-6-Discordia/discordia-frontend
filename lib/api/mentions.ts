import type { Member } from "./types"

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function mentionPattern(label: string): RegExp {
  
  return new RegExp(`(^|[^\\p{L}\\p{N}_])@${escapeRegExp(label)}(?![\\p{L}\\p{N}_])`, "iu")
}

export function extractMentionIds(text: string, members: Member[], selfId?: string): string[] {
  if (!text.includes("@")) return []
  const candidates = members.filter((m) => m.id && m.id !== selfId && m.name.trim())

  const firstNameCount = new Map<string, number>()
  for (const m of candidates) {
    const first = m.name.trim().split(/\s+/)[0].toLowerCase()
    firstNameCount.set(first, (firstNameCount.get(first) ?? 0) + 1)
  }

  const found = new Set<string>()
  const byLength = [...candidates].sort((a, b) => b.name.length - a.name.length)
  let remaining = text
  for (const m of byLength) {
    const full = m.name.trim()
    const pattern = mentionPattern(full)
    if (pattern.test(remaining)) {
      found.add(m.id)
      remaining = remaining.replace(new RegExp(pattern.source, "giu"), "$1")
    }
  }
  for (const m of byLength) {
    if (found.has(m.id)) continue
    const first = m.name.trim().split(/\s+/)[0]
    if (firstNameCount.get(first.toLowerCase()) !== 1) continue
    if (mentionPattern(first).test(remaining)) found.add(m.id)
  }
  return [...found]
}

export interface MentionRole {
  id: string
  name: string
}

export function extractRoleMentionIds(text: string, roles: MentionRole[]): string[] {
  if (!text.includes("@")) return []
  const found = new Set<string>()
  let remaining = text
  const byLength = roles.filter((r) => r.id && r.name.trim()).sort((a, b) => b.name.length - a.name.length)
  for (const r of byLength) {
    const pattern = mentionPattern(r.name.trim())
    if (pattern.test(remaining)) {
      found.add(r.id)
      remaining = remaining.replace(new RegExp(pattern.source, "giu"), "$1")
    }
  }
  return [...found]
}

export function hasEveryoneMention(text: string): boolean {
  return mentionPattern("everyone").test(text)
}

export interface MentionSuggestion {
  kind: "user" | "role" | "everyone"
  id: string
  // Lo que se escribe después de la "@".
  label: string
  avatar?: string
}

const MAX_SUGGESTIONS = 8

const MENTION_QUERY = /(^|[^\p{L}\p{N}_@])@([\p{L}\p{N}_ .'-]{0,40})$/u

export function findMentionQuery(text: string): { start: number; query: string } | null {
  const match = MENTION_QUERY.exec(text)
  if (!match) return null
  return { start: match.index + match[1].length, query: match[2] }
}

function matchesQuery(name: string, query: string): boolean {
  const lower = name.toLowerCase()
  if (lower.startsWith(query)) return true
  // También por el comienzo de cualquier palabra: "@dos" encuentra a "Prueba Dos".
  return lower.split(/\s+/).some((word) => word.startsWith(query))
}

export function filterMentionSuggestions(
  query: string,
  members: Member[],
  roles: MentionRole[],
  canMentionSpecial: boolean,
  selfId?: string,
): MentionSuggestion[] {
  const q = query.toLowerCase()
  const out: MentionSuggestion[] = []
  if (canMentionSpecial) {
    if ("everyone".startsWith(q)) out.push({ kind: "everyone", id: "everyone", label: "everyone" })
    for (const r of roles) {
      if (r.name.trim() && matchesQuery(r.name.trim(), q)) {
        out.push({ kind: "role", id: r.id, label: r.name.trim() })
      }
    }
  }
  for (const m of members) {
    if (!m.id || m.id === selfId || !m.name.trim()) continue
    if (matchesQuery(m.name.trim(), q)) {
      out.push({ kind: "user", id: m.id, label: m.name.trim(), avatar: m.avatar })
    }
  }
  return out.slice(0, MAX_SUGGESTIONS)
}

export function applyMentionSuggestion(text: string, start: number, label: string): string {
  return `${text.slice(0, start)}@${label} `
}
