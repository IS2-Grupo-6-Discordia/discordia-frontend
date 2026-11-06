import { useEffect, useState } from "react"
import { View, Text, Modal, Platform, ActivityIndicator } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import PressableScale from "@/components/PressableScale"
import Avatar from "@/components/Avatar"
import { useVoice } from "@/context/VoiceContext"
import { friendlyError } from "@/lib/api/client"
import { initials } from "@/lib/api/auth"

// HU-50: fullscreen modal that appears when another user calls. Shows the
// caller's name, accept and reject buttons. Auto-dismisses after 35s (the
// backend ring timeout is 30s + network margin).

const AUTO_DISMISS_MS = 35_000

export default function IncomingCallModal() {
  const voice = useVoice()
  const router = useRouter()
  const { call, callStatus } = voice
  const visible = callStatus === "ringing" && call?.direction === "incoming"
  const [error, setError] = useState("")
  const [accepting, setAccepting] = useState(false)

  // Auto-dismiss if the backend missed event doesn't arrive.
  useEffect(() => {
    if (!visible) {
      setError("")
      setAccepting(false)
      return
    }
    const timer = setTimeout(() => {
      voice.rejectIncomingCall()
    }, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [visible])

  const handleAccept = async () => {
    setError("")
    setAccepting(true)
    try {
      await voice.acceptIncomingCall()
      router.push("/(main)/voice")
    } catch (err) {
      setError(err instanceof Error ? err.message : friendlyError(err))
      setAccepting(false)
    }
  }

  const handleReject = () => {
    voice.rejectIncomingCall()
  }

  const peerName = call?.peerName ?? "Alguien"

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(3,10,14,0.88)",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
          ...(Platform.OS === "web" ? ({ backdropFilter: "blur(12px)" } as object) : {}),
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 340,
            alignItems: "center",
            padding: 32,
            borderRadius: 20,
            backgroundColor: "#0B1822",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.10)",
            ...(Platform.OS === "web"
              ? ({ boxShadow: "0 24px 60px -24px rgba(0,0,0,0.7)" } as object)
              : {}),
          }}
        >
          {/* Caller avatar */}
          <View style={{ marginBottom: 20 }}>
            <View
              style={{
                borderRadius: 9999,
                borderWidth: 3,
                borderColor: "#37D6C0",
                padding: 3,
              }}
            >
              <Avatar initials={initials(peerName)} size={80} />
            </View>
          </View>

          <Text style={{ color: "#E6F3F3", fontSize: 18, fontWeight: "800", marginBottom: 6 }}>
            {peerName}
          </Text>
          <Text style={{ color: "#8DA8AC", fontSize: 13, marginBottom: 28 }}>
            Llamada entrante...
          </Text>

          {error ? (
            <Text style={{ color: "#FF9E94", fontSize: 12, textAlign: "center", marginBottom: 16 }}>
              {error}
            </Text>
          ) : null}

          {/* Action buttons */}
          <View style={{ flexDirection: "row", gap: 24 }}>
            {/* Reject */}
            <View style={{ alignItems: "center", gap: 8 }}>
              <PressableScale
                onPress={handleReject}
                disabled={accepting}
                accessibilityLabel="Rechazar llamada"
                pressedScale={0.9}
                hoverStyle={{ backgroundColor: "#FF6B5C" }}
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 9999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#FF7F72",
                }}
              >
                <Ionicons name="call" size={26} color="#04211D" style={{ transform: [{ rotate: "135deg" }] }} />
              </PressableScale>
              <Text style={{ color: "#FF9E94", fontWeight: "700", fontSize: 11 }}>Rechazar</Text>
            </View>

            {/* Accept */}
            <View style={{ alignItems: "center", gap: 8 }}>
              <PressableScale
                onPress={handleAccept}
                disabled={accepting}
                accessibilityLabel="Aceptar llamada"
                pressedScale={0.9}
                hoverStyle={{ backgroundColor: "#2BC4AF" }}
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 9999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#37D6C0",
                }}
              >
                {accepting ? (
                  <ActivityIndicator color="#04211D" />
                ) : (
                  <Ionicons name="call" size={26} color="#04211D" />
                )}
              </PressableScale>
              <Text style={{ color: "#37D6C0", fontWeight: "700", fontSize: 11 }}>Aceptar</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  )
}
