import { api } from "./client"
import type { MuteState } from "./types"

const MAX_SERVER_IDS = 50

interface BackendMutes {
  servers: string[]
  channels: string[]
}

export const EMPTY_MUTES: MuteState = { servers: {}, channels: {} }

export async function getMutes(serverIds: string[]): Promise<MuteState> {
  const state: MuteState = { servers: {}, channels: {} }
  for (let i = 0; i < serverIds.length; i += MAX_SERVER_IDS) {
    const chunk = serverIds.slice(i, i + MAX_SERVER_IDS)
    const res = await api<BackendMutes>(`/mutes?server_ids=${chunk.join(",")}`)
    for (const id of res.servers) state.servers[id] = true
    for (const id of res.channels) state.channels[id] = true
  }
  return state
}

export async function setChannelMuted(channelId: string, muted: boolean): Promise<void> {
  await api(`/mutes/channels/${channelId}`, { method: muted ? "PUT" : "DELETE" })
}

export async function setServerMuted(serverId: string, muted: boolean): Promise<void> {
  await api(`/mutes/servers/${serverId}`, { method: muted ? "PUT" : "DELETE" })
}

export function withMute(
  state: MuteState,
  kind: "server" | "channel",
  id: string,
  muted: boolean,
): MuteState {
  const key = kind === "server" ? "servers" : "channels"
  const next = { ...state[key] }
  if (muted) next[id] = true
  else delete next[id]
  return { ...state, [key]: next }
}
