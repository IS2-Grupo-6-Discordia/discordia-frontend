import { api } from "./client"
import type { VoiceJoinResponse } from "./types"

// HU-50: private 1-on-1 voice calls.

export interface InitiateCallResponse {
  call_id: string
}

// Start a private call to another user. The backend checks common servers,
// that neither party is already in voice, and notifies the callee via WebSocket.
// callerName is sent so the callee sees the name immediately in the incoming call modal.
export async function initiateCall(calleeId: string, callerName?: string): Promise<InitiateCallResponse> {
  return api<InitiateCallResponse>("/voice/calls", {
    method: "POST",
    body: JSON.stringify({ callee_id: calleeId, caller_name: callerName }),
  })
}

// Accept an incoming call. Returns LiveKit connection info.
export async function acceptCall(callId: string): Promise<VoiceJoinResponse> {
  return api<VoiceJoinResponse>(`/voice/calls/${callId}/accept`, { method: "POST" })
}

// Reject or cancel a ringing call.
export async function rejectCall(callId: string): Promise<void> {
  await api<void>(`/voice/calls/${callId}/reject`, { method: "POST" })
}

// Hang up an active call.
export async function endCall(callId: string): Promise<void> {
  await api<void>(`/voice/calls/${callId}/end`, { method: "POST" })
}
