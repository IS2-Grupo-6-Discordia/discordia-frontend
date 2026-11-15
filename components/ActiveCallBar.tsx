import { ActivityIndicator, Text, View, useWindowDimensions } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { usePathname, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import PressableScale from "@/components/PressableScale"
import { useVoice } from "@/context/VoiceContext"

export default function ActiveCallBar() {
  const voice = useVoice()
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  const isNarrow = useWindowDimensions().width < 600

  const inPrivateCall =
    !!voice.call && voice.callStatus !== "idle" && !(voice.callStatus === "ringing" && voice.call.direction === "incoming")
  const inChannel = !inPrivateCall && voice.status !== "idle" && !!voice.channel

  if (pathname === "/voice") return null
  if (!inPrivateCall && !(inChannel && pathname !== "/chat")) return null

  const connecting = inPrivateCall ? voice.callStatus !== "connected" : voice.status === "connecting"
  const title = inPrivateCall
    ? voice.callStatus === "ringing"
      ? "Llamando..."
      : voice.callStatus === "connecting"
        ? "Conectando..."
        : "En llamada"
    : connecting
      ? "Conectando..."
      : "Conectado a voz"
  const subtitle = inPrivateCall
    ? voice.call?.peerName ?? "Llamada privada"
    : `${voice.channel?.name ?? ""} / ${voice.channel?.serverName ?? ""}`

  const hangUp = () => {
    if (inPrivateCall) {
      if (voice.callStatus === "ringing") voice.rejectIncomingCall()
      else voice.endCurrentCall()
    } else {
      voice.leave()
    }
  }

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: insets.bottom + (isNarrow ? 76 : 84),
        alignItems: isNarrow ? "stretch" : "flex-end",
        paddingHorizontal: 16,
        zIndex: 40,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          minWidth: isNarrow ? undefined : 300,
          paddingLeft: 14,
          paddingRight: 8,
          paddingVertical: 8,
          borderRadius: 14,
          backgroundColor: "#12312C",
          borderWidth: 1,
          borderColor: "rgba(79,214,156,0.45)",
          shadowColor: "#000",
          shadowOpacity: 0.4,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        <PressableScale
          onPress={() => router.push("/(main)/voice")}
          accessibilityLabel={inPrivateCall ? "Volver a la llamada" : "Abrir canal de voz"}
          pressedScale={0.98}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}
        >
          {connecting ? (
            <ActivityIndicator size="small" color="#F0C24B" />
          ) : (
            <Ionicons name={inPrivateCall ? "call" : "cellular"} size={16} color="#4FD69C" />
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: connecting ? "#F0C24B" : "#4FD69C", fontWeight: "800", fontSize: 12.5 }}>{title}</Text>
            <Text style={{ color: "#C9DADC", fontSize: 11.5 }} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
          <Text style={{ color: "#37D6C0", fontWeight: "700", fontSize: 12 }}>Volver</Text>
        </PressableScale>
        <PressableScale
          onPress={hangUp}
          accessibilityLabel={inPrivateCall ? "Colgar llamada" : "Desconectarse del canal de voz"}
          hoverStyle={{ backgroundColor: "#FF9E94" }}
          style={{ width: 38, height: 38, borderRadius: 9999, alignItems: "center", justifyContent: "center", backgroundColor: "#FF7F72" }}
        >
          <Ionicons name="call" size={17} color="#04211D" style={{ transform: [{ rotate: "135deg" }] }} />
        </PressableScale>
      </View>
    </View>
  )
}
