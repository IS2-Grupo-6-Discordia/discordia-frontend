import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ApiError } from "@/api/client"
import {
  getMessages,
  getMessagesRealtimeTicket,
  hydrateAuthors,
  type BackendMessage,
} from "@/api/messages"
import type { Message } from "@/api/types"
import { RealtimeConnection } from "@/lib/realtime"
import type { RealtimeMessage, RealtimeStatus } from "@/lib/realtime"

// Real-time messages for the open text channel (HU "Enviar mensajes", CA1),
// mirroring useVoicePresence: one socket per chat screen, subscribed only to
// the channel being viewed. A `messages.created` frame is pushed straight to
// the screen; gaps are closed by refetching history over HTTP, never from the
// socket (messages, unlike voice, are incremental — ADR 0009 / historia 16):
//  - on every reconnection, page back with `before` until we overlap a known id;
//  - every 60 s while the socket is open, reconcile (covers a frame lost because
//    Redis failed: the POST still returns 201 but no frame is published);
//  - while the socket is NOT open, poll every 5 s, backing off to 30 s on a 503
//    (servidores cold-starting behind the gateway) and back to 5 s on the first OK.
// The screen owns the message list and merges everything by id.

const POLL_MIN_MS = 5000
const POLL_MAX_MS = 30000
const RECONCILE_MS = 60000
const RECOVERY_MAX_PAGES = 5
const PAGE_LIMIT = 50

const ERROR_FORBIDDEN = 403
const ERROR_LOCKED = 423

export interface OpenChannel {
  id: string
  serverId: string
}

export interface UseChannelMessagesOptions {
  // The open real (UUID) channel on a real server, or null (mock/example
  // channels and "no channel open" open no socket and trigger no fetch).
  channel: OpenChannel | null
  enabled: boolean
  // Deliver created/refetched messages; the screen merges them by id.
  onMessages: (msgs: Message[]) => void
  // A WS `error` frame with code 423: the channel's server is suspended.
  onServerSuspended: (serverId: string) => void
  // The ids the screen already holds, used to stop reconnect paging on overlap.
  getKnownMessageIds: () => string[]
}

export function useChannelMessages({
  channel,
  enabled,
  onMessages,
  onServerSuspended,
  getKnownMessageIds,
}: UseChannelMessagesOptions): { status: RealtimeStatus } {
  const [status, setStatus] = useState<RealtimeStatus>("closed")
  const connRef = useRef<RealtimeConnection | null>(null)

  // Kept in refs so the long-lived socket callbacks read current values without
  // reopening the connection on every render.
  const channelRef = useRef(channel)
  channelRef.current = channel
  const onMessagesRef = useRef(onMessages)
  onMessagesRef.current = onMessages
  const onServerSuspendedRef = useRef(onServerSuspended)
  onServerSuspendedRef.current = onServerSuspended
  const knownIdsRef = useRef(getKnownMessageIds)
  knownIdsRef.current = getKnownMessageIds
  const openedOnceRef = useRef(false)

  const channelId = channel?.id ?? null

  const deliver = useCallback((msgs: Message[]) => {
    if (msgs.length > 0) onMessagesRef.current(msgs)
  }, [])

  // Page back with `before` until we overlap a message the screen already has
  // (or exhaust history / hit the page cap), then deliver everything to merge.
  const recoverHistory = useCallback(
    async (ch: OpenChannel) => {
      const known = new Set(knownIdsRef.current())
      const collected: Message[] = []
      let before: string | undefined
      for (let page = 0; page < RECOVERY_MAX_PAGES; page++) {
        let batch: Message[]
        try {
          batch = await getMessages(ch.id, { limit: PAGE_LIMIT, before })
        } catch {
          break
        }
        if (channelRef.current?.id !== ch.id) return // channel changed mid-recovery
        collected.push(...batch)
        const overlapped = batch.some((m) => known.has(m.id))
        if (overlapped || batch.length < PAGE_LIMIT) break
        const oldest = batch.reduce<string | undefined>(
          (min, m) => (m.createdAt && (!min || m.createdAt < min) ? m.createdAt : min),
          undefined,
        )
        if (!oldest || oldest === before) break
        before = oldest
      }
      deliver(collected)
    },
    [deliver],
  )

  // One socket per screen while enabled (logged in, real backend).
  useEffect(() => {
    if (!enabled) return
    openedOnceRef.current = false
    const conn = new RealtimeConnection({
      getTicket: getMessagesRealtimeTicket,
      onStatus: (s) => {
        setStatus(s)
        if (s === "open") {
          const ch = channelRef.current
          // First open relies on the screen's normal history fetch; a later
          // open is a reconnection, so close the gap.
          if (openedOnceRef.current && ch) void recoverHistory(ch)
          openedOnceRef.current = true
        }
      },
      onMessage: (msg: RealtimeMessage) => {
        const ch = channelRef.current
        if (msg.type === "messages.created") {
          if (!ch || msg.channel_id !== ch.id) return // ignore other channels
          const raw = msg.message as BackendMessage | undefined
          if (!raw || typeof raw.id !== "string") return
          hydrateAuthors([raw])
            .then((converted) => {
              if (channelRef.current?.id === ch.id) deliver(converted)
            })
            .catch(() => undefined)
          return
        }
        if (msg.type === "error") {
          if (msg.code === ERROR_LOCKED && ch) onServerSuspendedRef.current(ch.serverId)
          else if (msg.code === ERROR_FORBIDDEN) console.warn("[messages] subscribe denied", msg)
        }
      },
    })
    connRef.current = conn
    conn.start()
    return () => {
      conn.stop()
      connRef.current = null
      setStatus("closed")
      openedOnceRef.current = false
    }
  }, [enabled, deliver, recoverHistory])

  // Subscribe only to the open channel; resubscribe when it changes.
  const subscribedRef = useRef<string | null>(null)
  useEffect(() => {
    const conn = connRef.current
    if (!enabled || !conn) {
      subscribedRef.current = null
      return
    }
    const prev = subscribedRef.current
    if (prev && prev !== channelId) conn.unsubscribe([prev])
    if (channelId) conn.subscribe([channelId])
    subscribedRef.current = channelId
  }, [enabled, channelId, status])

  // Reconcile every 60 s while the socket is open (covers a messages.created
  // lost because Redis failed: POST still 201, no frame, open socket unaware).
  useEffect(() => {
    if (!enabled || status !== "open" || !channelId) return
    const ch = channelRef.current
    if (!ch) return
    const timer = setInterval(() => {
      getMessages(ch.id, { limit: PAGE_LIMIT })
        .then((msgs) => {
          if (channelRef.current?.id === ch.id) deliver(msgs)
        })
        .catch(() => undefined)
    }, RECONCILE_MS)
    return () => clearInterval(timer)
  }, [enabled, status, channelId, deliver])

  // Fallback poll while the socket is NOT open. A 503 (servidores cold-starting
  // behind the gateway) backs the interval off up to 30 s; the first OK resets
  // it to 5 s.
  useEffect(() => {
    if (!enabled || status === "open" || !channelId) return
    const ch = channelRef.current
    if (!ch) return
    let cancelled = false
    let interval = POLL_MIN_MS
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = () => {
      getMessages(ch.id, { limit: PAGE_LIMIT })
        .then((msgs) => {
          if (cancelled) return
          interval = POLL_MIN_MS
          if (channelRef.current?.id === ch.id) deliver(msgs)
        })
        .catch((err) => {
          if (cancelled) return
          if (err instanceof ApiError && err.status === 503) {
            interval = Math.min(POLL_MAX_MS, interval * 2)
          }
        })
        .finally(() => {
          if (!cancelled) timer = setTimeout(tick, interval)
        })
    }
    tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [enabled, status, channelId, deliver])

  return useMemo(() => ({ status }), [status])
}
