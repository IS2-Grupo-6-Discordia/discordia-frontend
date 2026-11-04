import { useEffect, useRef } from "react"
import { getVoiceRealtimeTicket } from "@/lib/api/voice"
import { RealtimeConnection } from "@/lib/realtime"
import type { RealtimeMessage } from "@/lib/realtime"
import type { CallSignalingMessage } from "@/lib/api/types"

// HU-50: listens to call.* messages on the voice realtime WebSocket and
// dispatches them to the VoiceContext. Uses its own connection so the call
// signaling is always active while logged in, regardless of which server the
// user is viewing (voice presence subscribes per-channel; calls are per-user).

const CALL_TYPES = new Set([
  "call.incoming",
  "call.accepted",
  "call.rejected",
  "call.ended",
  "call.missed",
])

export function useCallSignaling(
  enabled: boolean,
  onMessage: (msg: CallSignalingMessage) => void,
) {
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  useEffect(() => {
    if (!enabled) return

    const conn = new RealtimeConnection({
      getTicket: getVoiceRealtimeTicket,
      onMessage: (msg: RealtimeMessage) => {
        if (CALL_TYPES.has(msg.type)) {
          onMessageRef.current(msg as unknown as CallSignalingMessage)
        }
      },
    })
    conn.start()
    return () => conn.stop()
  }, [enabled])
}
