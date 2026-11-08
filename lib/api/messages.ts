import { getUsersBatch } from "./auth"
import { api } from "./client"
import type { Message } from "./types"
import type { RealtimeTicket } from "@/lib/realtime"

const REAL_CHANNEL_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isRealChannel(channelId: string): boolean {
  return REAL_CHANNEL_RE.test(channelId)
}

export interface BackendMessage {
  id: string
  channel_id: string
  server_id: string
  author_id: string
  content: string
  mentions: string[]
  created_at: string
}

const AUTHOR_COLORS = ["#37D6C0", "#FF7F72", "#4FD69C", "#F0C24B", "#A093FF"]

function colorForAuthor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return AUTHOR_COLORS[hash % AUTHOR_COLORS.length]
}

export function toMessage(msg: BackendMessage, authorName: string): Message {
  return {
    id: msg.id,
    author: authorName,
    authorId: msg.author_id,
    color: colorForAuthor(msg.author_id),
    time: new Date(msg.created_at).toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    createdAt: msg.created_at,
    text: msg.content,
  }
}

// El servicio de mensajes solo guarda ids de autor: los nombres se piden al servicio de usuarios y
// se recuerdan, porque el historial del canal abierto se vuelve a consultar cada pocos segundos.
const authorNames = new Map<string, string>()

export async function hydrateAuthors(list: BackendMessage[]): Promise<Message[]> {
  const missing = [...new Set(list.map((m) => m.author_id))].filter((id) => !authorNames.has(id))
  if (missing.length > 0) {
    try {
      for (const u of await getUsersBatch(missing)) authorNames.set(u.id, u.name)
    } catch {
      // Sin nombres igual se muestra el historial.
    }
  }
  return list.map((m) => toMessage(m, authorNames.get(m.author_id) ?? "Usuario"))
}

const MOCK_MESSAGES: Record<string, Message[]> = {
  anuncios: [
    {
      id: "an-1",
      author: "Mora B.",
      color: "#37D6C0",
      time: "14:02",
      role: "Owner",
      roleColor: "#37D6C0",
      text: "Subí el ADR del gateway al repo. Falta la sección de alternativas descartadas.",
      reactions: [
        { emoji: "👍", count: 4 },
        { emoji: "🚀", count: 2, mine: true },
      ],
    },
    {
      id: "an-2",
      author: "Juanpi",
      color: "#F0C24B",
      time: "14:05",
      role: "Moderación",
      roleColor: "#F0C24B",
      text: "Lo miro hoy.",
      mentionRole: "backend",
    },
    {
      id: "an-3",
      author: "Facundo",
      color: "#37D6C0",
      time: "14:07",
      edited: true,
      text: "Separo /livez y /readyz esta tarde y lo dejo en un PR aparte.",
    },
  ],
  general: [
    {
      id: "ge-1",
      author: "Tomás S.",
      color: "#4FD69C",
      time: "09:12",
      text: "Buen día gente 👋 ¿alguien arrancó con el TP de esta semana?",
    },
    {
      id: "ge-2",
      author: "Nadia V.",
      color: "#FF7F72",
      time: "09:20",
      text: "Yo esta tarde. Si querés lo hacemos en una call.",
      reactions: [{ emoji: "🙌", count: 3, mine: true }],
    },
    {
      id: "ge-3",
      author: "Facundo",
      color: "#37D6C0",
      time: "09:24",
      text: "Dale, después coordinamos por acá.",
    },
  ],
  "checkpoint-2": [
    {
      id: "cp-1",
      author: "Mora B.",
      color: "#37D6C0",
      time: "11:40",
      role: "Owner",
      roleColor: "#37D6C0",
      text: "Recordatorio: el checkpoint 2 se entrega el viernes a las 23:59.",
      reactions: [{ emoji: "⏰", count: 5 }],
    },
    {
      id: "cp-2",
      author: "Lucía R.",
      color: "#A093FF",
      time: "11:58",
      role: "Moderación",
      roleColor: "#F0C24B",
      text: "Subí la rúbrica al canal #recursos así la tienen a mano.",
    },
    {
      id: "cp-3",
      author: "Juanpi",
      color: "#F0C24B",
      time: "12:15",
      text: "Nos falta cerrar el diagrama de secuencia. ¿Alguien lo agarra?",
      mentionRole: "equipo",
    },
  ],
  recursos: [
    {
      id: "re-1",
      author: "Lucía R.",
      color: "#A093FF",
      time: "10:03",
      role: "Moderación",
      roleColor: "#F0C24B",
      text: "Rúbrica del checkpoint 2 y el template del informe: los dejo fijados acá.",
      reactions: [{ emoji: "📌", count: 6, mine: true }],
    },
    {
      id: "re-2",
      author: "Tomás S.",
      color: "#4FD69C",
      time: "10:31",
      text: "Sumo el link a los apuntes de la clase de arquitectura 👇",
    },
  ],
}

export interface GetMessagesOptions {
  limit?: number
  // ISO `created_at`: returns messages strictly older than this, to page back
  // through history (historia 16 / ADR 0009 reconnect gap recovery).
  before?: string
  // Id of the oldest message already loaded. Sent together with `before` as a
  // composite cursor (created_at, id) so a message that shares `before`'s
  // millisecond is not skipped at a page boundary (HU-6 CA1). Ignored without
  // `before`.
  beforeId?: string
}

export async function getMessages(
  channelId: string,
  options: GetMessagesOptions = {},
): Promise<Message[]> {
  if (!isRealChannel(channelId)) return MOCK_MESSAGES[channelId] ?? []
  const params = new URLSearchParams({ limit: String(options.limit ?? 50) })
  if (options.before) params.set("before", options.before)
  if (options.before && options.beforeId) params.set("before_id", options.beforeId)
  const list = await api<BackendMessage[]>(`/channels/${channelId}/messages?${params.toString()}`)
  return hydrateAuthors(list)
}

// Single-use ticket to open the messages realtime WebSocket, which does not go
// through the gateway (lib/realtime.ts). Mirrors getVoiceRealtimeTicket.
export async function getMessagesRealtimeTicket(): Promise<RealtimeTicket> {
  return api<RealtimeTicket>("/messages/realtime/ticket", { method: "POST" })
}

export interface SendMessageOptions {
  serverId?: string
  mentions?: string[]
}

export async function sendMessage(
  channelId: string,
  text: string,
  authorName?: string,
  options: SendMessageOptions = {},
): Promise<Message> {
  if (isRealChannel(channelId)) {
    if (!options.serverId) throw new Error("sendMessage: falta serverId para un canal real")
    const res = await api<BackendMessage>(`/channels/${channelId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        server_id: options.serverId,
        content: text,
        mentions: options.mentions ?? [],
      }),
    })
    return toMessage(res, authorName || "Yo")
  }
  
  return {
    id: Date.now().toString(),
    author: authorName || "Yo",
    color: "#37D6C0",
    time: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
    text,
  }
}
