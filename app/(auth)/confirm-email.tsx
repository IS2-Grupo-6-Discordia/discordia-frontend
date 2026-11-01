import { useEffect, useState } from "react"
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { confirmEmailChange } from "@/api/auth"
import { friendlyError } from "@/api/client"
import AuthBrand from "@/components/AuthBrand"

type State = "loading" | "done" | "error"

export default function ConfirmEmailScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ token?: string | string[] }>()
  const rawToken = params.token
  const token = (Array.isArray(rawToken) ? rawToken[0] : rawToken) ?? ""

  const [state, setState] = useState<State>(token ? "loading" : "error")
  const [error, setError] = useState(token ? "" : "El enlace no es válido o está incompleto.")

  useEffect(() => {
    if (!token) return
    let active = true
    confirmEmailChange(token)
      .then(() => {
        if (active) setState("done")
      })
      .catch((err) => {
        if (!active) return
        setError(friendlyError(err))
        setState("error")
      })
    return () => {
      active = false
    }
  }, [token])

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#0A1620" }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 340,
          alignSelf: "center",
          borderRadius: 16,
          padding: 24,
          backgroundColor: "rgba(255,255,255,0.055)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.13)",
        }}
      >
        {state === "loading" ? (
          <>
            <AuthBrand title="Confirmando tu email" subtitle="Un momento..." />
            <ActivityIndicator color="#37D6C0" />
          </>
        ) : (
          <>
            <AuthBrand
              title={state === "done" ? "¡Email confirmado!" : "No pudimos confirmar el email"}
              subtitle={
                state === "done"
                  ? "Desde ahora iniciás sesión con tu nuevo email."
                  : `${error} Podés pedir un enlace nuevo desde Mi cuenta.`
              }
            />
            <TouchableOpacity
              onPress={() => router.replace("/")}
              style={{ width: "100%", borderRadius: 10, paddingVertical: 13, alignItems: "center", backgroundColor: "#37D6C0" }}
            >
              <Text style={{ color: "#04211D", fontWeight: "700", fontSize: 14 }}>Ir a Discordia</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  )
}
