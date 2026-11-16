import { api } from "./client"
import { resolveAuthorNames } from "./messages"
import type { AppNotification } from "./types"

// El backend acepta hasta 50 servidores por consulta.
const MAX_SERVER_IDS = 50

interface BackendNotification {
  message_id: string
  channel_id: string
  server_id: string
  author_id: string
  content: string
  kind: "mention" | "everyone"
  unread: boolean
  created_at: string
}

interface BackendNotifications {
  items: BackendNotification[]
  days: number
}

export interface NotificationHistory {
  items: AppNotification[]
  // Cuántos días hacia atrás llega el historial.
  days: number
}

// Centro de notificaciones: las menciones recientes del usuario, de la más nueva a la más vieja.
// Lista vacía = no hay nada para mostrar.
export async function getNotificationHistory(serverIds: string[], limit = 50): Promise<NotificationHistory> {
  if (serverIds.length === 0) return { items: [], days: 7 }
  const res = await api<BackendNotifications>(
    `/notifications?server_ids=${serverIds.slice(0, MAX_SERVER_IDS).join(",")}&limit=${limit}`,
  )
  const names = await resolveAuthorNames(res.items.map((n) => n.author_id))
  return {
    days: res.days,
    items: res.items.map((n) => ({
      id: n.message_id,
      channelId: n.channel_id,
      serverId: n.server_id,
      authorId: n.author_id,
      author: names.get(n.author_id) ?? "Usuario",
      content: n.content,
      kind: n.kind,
      unread: n.unread,
      createdAt: n.created_at,
    })),
  }
}

// "ahora", "hace 5 min", "hace 3 h", "ayer", "hace 4 días".
export function timeAgo(iso: string, now: number = Date.now()): string {
  const diff = Math.max(0, now - Date.parse(iso))
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return "ahora"
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return days === 1 ? "ayer" : `hace ${days} días`
}
