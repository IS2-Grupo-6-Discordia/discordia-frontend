import { api } from "./client"
import type { NotificationLevel, NotificationPrefs } from "./types"

const MAX_SERVER_IDS = 50

interface BackendPrefs {
  servers: Record<string, NotificationLevel>
  channels: Record<string, NotificationLevel>
}

export const EMPTY_PREFS: NotificationPrefs = { servers: {}, channels: {} }

// Textos de cada nivel (el orden es el del menú).
export const NOTIFICATION_LEVELS: { level: NotificationLevel; label: string; icon: string }[] = [
  { level: "all", label: "Todos los mensajes", icon: "notifications-outline" },
  { level: "mentions", label: "Solo menciones", icon: "at-outline" },
  { level: "none", label: "Ninguno", icon: "notifications-off-outline" },
]

export function levelLabel(level: NotificationLevel): string {
  return NOTIFICATION_LEVELS.find((l) => l.level === level)?.label ?? ""
}

// Lo que el usuario configuró en esos servidores. Lo que no figura no tiene configuración propia.
export async function getNotificationPrefs(serverIds: string[]): Promise<NotificationPrefs> {
  const prefs: NotificationPrefs = { servers: {}, channels: {} }
  for (let i = 0; i < serverIds.length; i += MAX_SERVER_IDS) {
    const chunk = serverIds.slice(i, i + MAX_SERVER_IDS)
    const res = await api<BackendPrefs>(`/notification-preferences?server_ids=${chunk.join(",")}`)
    Object.assign(prefs.servers, res.servers)
    Object.assign(prefs.channels, res.channels)
  }
  return prefs
}

// Guarda el nivel de un canal o servidor; con `null` quita la configuración propia (el canal vuelve
// a la de su servidor, el servidor a "todos los mensajes").
export async function setNotificationLevel(
  kind: "server" | "channel",
  id: string,
  level: NotificationLevel | null,
): Promise<void> {
  const path = `/notification-preferences/${kind === "server" ? "servers" : "channels"}/${id}`
  if (level === null) await api(path, { method: "DELETE" })
  else await api(path, { method: "PUT", body: JSON.stringify({ level }) })
}

export function withLevel(
  prefs: NotificationPrefs,
  kind: "server" | "channel",
  id: string,
  level: NotificationLevel | null,
): NotificationPrefs {
  const key = kind === "server" ? "servers" : "channels"
  const next = { ...prefs[key] }
  if (level === null) delete next[id]
  else next[id] = level
  return { ...prefs, [key]: next }
}

// Nivel de un servidor: el que configuró o, si no, todos los mensajes.
export function serverLevel(prefs: NotificationPrefs, serverId: string): NotificationLevel {
  return prefs.servers[serverId] ?? "all"
}

// Nivel que vale para un canal: rige la configuración más específica (el canal; si no, su servidor).
export function channelLevel(
  prefs: NotificationPrefs,
  serverId: string,
  channelId: string,
): NotificationLevel {
  return prefs.channels[channelId] ?? serverLevel(prefs, serverId)
}
