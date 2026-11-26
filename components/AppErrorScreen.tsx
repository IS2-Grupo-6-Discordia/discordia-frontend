import { useState } from "react"
import { Pressable, Text, View } from "react-native"
import type { ErrorBoundaryProps } from "expo-router"

// Lo que ve el usuario si una pantalla tira un error al renderizar. Sin esto, Expo
// Router deja la pantalla en blanco (o roja en desarrollo) y la única salida es
// recargar la app. El error técnico va a la consola, nunca a la UI.
export default function AppErrorScreen({ error, retry }: ErrorBoundaryProps) {
  const [retrying, setRetrying] = useState(false)
  console.error("[ErrorBoundary]", error)

  async function onRetry() {
    setRetrying(true)
    try {
      await retry()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0A1620",
        padding: 24,
      }}
    >
      <Text style={{ color: "#E6F3F3", fontSize: 18, fontWeight: "700", textAlign: "center" }}>
        Algo salió mal
      </Text>
      <Text
        style={{
          color: "#8DA8AC",
          fontSize: 14,
          marginTop: 10,
          textAlign: "center",
          maxWidth: 320,
          lineHeight: 20,
        }}
      >
        No pudimos mostrar esta pantalla. Probá de nuevo; si sigue pasando, recargá la app.
      </Text>
      <Pressable
        onPress={onRetry}
        disabled={retrying}
        accessibilityRole="button"
        accessibilityLabel="Reintentar"
        style={{
          marginTop: 20,
          backgroundColor: "#37D6C0",
          paddingHorizontal: 22,
          paddingVertical: 12,
          borderRadius: 12,
          opacity: retrying ? 0.6 : 1,
        }}
      >
        <Text style={{ color: "#04211D", fontSize: 15, fontWeight: "700" }}>
          {retrying ? "Reintentando…" : "Reintentar"}
        </Text>
      </Pressable>
    </View>
  )
}
