import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { getGoogleLink, linkGoogle, unlinkGoogle, type GoogleLink } from "@/lib/api/auth"
import { ApiError, friendlyError } from "@/lib/api/client"
import AuthField from "@/components/AuthField"
import GoogleSignInButton, { isGoogleSignInAvailable } from "@/components/GoogleSignInButton"
import { AccountScreen, Card, DoneState, NoticeBox, PrimaryButton } from "@/components/account/AccountUi"
import type { Notice } from "@/components/account/AccountUi"
import { useAuth } from "@/context/AuthContext"

type Mode = "view" | "confirm-password" | "pick-google" | "confirm-unlink" | "linked" | "unlinked"

function formatDate(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })
}

export default function GoogleAccount() {
  const { user } = useAuth()
  const router = useRouter()
  const [link, setLink] = useState<GoogleLink | null>(null)
  const [loadError, setLoadError] = useState("")
  const [mode, setMode] = useState<Mode>("view")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  const exit = () => (router.canGoBack() ? router.back() : router.replace("/(main)/account"))
  const hasPassword = user?.hasPassword !== false

  const load = useCallback(() => {
    setLoadError("")
    getGoogleLink()
      .then(setLink)
      .catch((err) => setLoadError(friendlyError(err)))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const startLink = () => {
    setNotice(null)
    setMode(hasPassword ? "confirm-password" : "pick-google")
  }

  const back = () => {
    setNotice(null)
    if (mode === "pick-google" && hasPassword) setMode("confirm-password")
    else if (mode === "view" || mode === "linked" || mode === "unlinked") exit()
    else {
      setPassword("")
      setMode("view")
    }
  }

  const onCredential = async (idToken: string) => {
    setBusy(true)
    setNotice(null)
    try {
      setLink(await linkGoogle(idToken, hasPassword ? password : null))
      setPassword("")
      setMode("linked")
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setPassword("")
        setMode("confirm-password")
      }
      setNotice({ tone: "error", text: friendlyError(err) })
    } finally {
      setBusy(false)
    }
  }

  const unlink = async () => {
    setBusy(true)
    setNotice(null)
    try {
      setLink(await unlinkGoogle())
      setMode("unlinked")
    } catch (err) {
      setNotice({ tone: "error", text: friendlyError(err) })
      setMode("view")
    } finally {
      setBusy(false)
    }
  }

  if (mode === "linked" && link?.linked) {
    return (
      <AccountScreen title="Cuenta de Google" onBack={exit}>
        <DoneState
          icon="logo-google"
          title="Cuenta de Google vinculada"
          text={`Desde ahora también podés entrar a Discordia con ${link.email}.`}
          buttonLabel="Volver a Mi cuenta"
          onPress={exit}
        />
      </AccountScreen>
    )
  }

  if (mode === "unlinked") {
    return (
      <AccountScreen title="Cuenta de Google" onBack={exit}>
        <DoneState
          icon="unlink-outline"
          title="Google desvinculado"
          text="Para entrar a Discordia usá tu email y contraseña. Si querés, podés vincular otra cuenta de Google cuando quieras."
          buttonLabel="Volver a Mi cuenta"
          onPress={exit}
        />
      </AccountScreen>
    )
  }

  if (mode === "confirm-password") {
    return (
      <AccountScreen title="Vincular Google" subtitle="Primero confirmá que sos vos." step={1} totalSteps={2} onBack={back}>
        <Card>
          <NoticeBox notice={notice} />
          <AuthField
            label="Contraseña actual"
            value={password}
            onChangeText={(value) => {
              setPassword(value)
              setNotice(null)
            }}
            secureTextEntry
            autoFocus
            onSubmitEditing={() => password && setMode("pick-google")}
            containerStyle={{ marginBottom: 14 }}
          />
          <PrimaryButton label="Continuar" onPress={() => setMode("pick-google")} disabled={!password} />
        </Card>
      </AccountScreen>
    )
  }

  if (mode === "pick-google") {
    return (
      <AccountScreen
        title="Vincular Google"
        subtitle="Elegí la cuenta de Google con la que querés entrar a Discordia. Puede tener otro email que tu cuenta."
        step={hasPassword ? 2 : 1}
        totalSteps={hasPassword ? 2 : 1}
        onBack={back}
      >
        <Card>
          <NoticeBox notice={notice} />
          {isGoogleSignInAvailable() ? (
            <GoogleSignInButton
              loading={busy}
              loadingLabel="Vinculando con Google..."
              onCredential={onCredential}
              onUnavailable={() => setNotice({ tone: "error", text: "No pudimos abrir Google. Probá de nuevo en un rato." })}
            />
          ) : (
            <Text style={{ color: "#8DA8AC", fontSize: 13 }}>Google no está disponible en este dispositivo.</Text>
          )}
        </Card>
      </AccountScreen>
    )
  }

  if (mode === "confirm-unlink" && link?.linked) {
    return (
      <AccountScreen title="Desvincular Google" onBack={back}>
        <Card>
          <NoticeBox notice={notice} />
          <Text style={{ color: "#E6F3F3", fontSize: 14, lineHeight: 20, marginBottom: 6 }}>
            ¿Desvincular <Text style={{ fontWeight: "800" }}>{link.email}</Text>?
          </Text>
          <Text style={{ color: "#8DA8AC", fontSize: 13, lineHeight: 19, marginBottom: 16 }}>
            Ya no vas a poder entrar con ese botón de Google. Vas a seguir entrando con tu email ({user?.email}) y tu contraseña.
          </Text>
          <TouchableOpacity
            onPress={unlink}
            disabled={busy}
            accessibilityRole="button"
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderRadius: 10,
              paddingVertical: 13,
              backgroundColor: "#FF7F72",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? <ActivityIndicator size="small" color="#04211D" /> : null}
            <Text style={{ color: "#04211D", fontWeight: "800", fontSize: 14 }}>Desvincular</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={back} disabled={busy} style={{ alignItems: "center", paddingVertical: 12 }}>
            <Text style={{ color: "#8DA8AC", fontWeight: "700", fontSize: 13 }}>Cancelar</Text>
          </TouchableOpacity>
        </Card>
      </AccountScreen>
    )
  }

  return (
    <AccountScreen title="Cuenta de Google" subtitle="Con una cuenta de Google vinculada podés entrar a Discordia sin escribir tu contraseña." onBack={back}>
      <Card>
        <NoticeBox notice={notice ?? (loadError ? { tone: "error", text: loadError } : null)} />
        {!link ? (
          loadError ? (
            <PrimaryButton label="Reintentar" onPress={load} />
          ) : (
            <View style={{ paddingVertical: 24, alignItems: "center" }}>
              <ActivityIndicator color="#37D6C0" />
            </View>
          )
        ) : (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: link.linked ? "rgba(79,214,156,0.14)" : "rgba(255,255,255,0.06)",
                }}
              >
                <Ionicons name="logo-google" size={20} color={link.linked ? "#4FD69C" : "#8DA8AC"} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: link.linked ? "#4FD69C" : "#8DA8AC", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>
                  {link.linked ? "Vinculada" : "No vinculada"}
                </Text>
                <Text style={{ color: "#E6F3F3", fontSize: 14.5, fontWeight: "700", marginTop: 2 }} numberOfLines={1}>
                  {link.linked ? link.email : "Ninguna cuenta de Google"}
                </Text>
                {link.linked && link.linkedAt ? (
                  <Text style={{ color: "#5E7E82", fontSize: 12, marginTop: 2 }}>Desde el {formatDate(link.linkedAt)}</Text>
                ) : null}
              </View>
            </View>

            {link.linked ? (
              <>
                {link.canUnlink ? (
                  <>
                    <TouchableOpacity
                      onPress={() => {
                        setNotice(null)
                        setMode("confirm-unlink")
                      }}
                      accessibilityRole="button"
                      style={{
                        alignItems: "center",
                        borderRadius: 10,
                        paddingVertical: 12,
                        borderWidth: 1,
                        borderColor: "rgba(255,127,114,0.45)",
                        backgroundColor: "rgba(255,127,114,0.08)",
                      }}
                    >
                      <Text style={{ color: "#FF9E94", fontWeight: "700", fontSize: 14 }}>Desvincular</Text>
                    </TouchableOpacity>
                    <Text style={{ color: "#5E7E82", fontSize: 12, lineHeight: 17, marginTop: 10 }}>
                      Para usar otra cuenta de Google, desvinculá esta y después vinculá la nueva.
                    </Text>
                  </>
                ) : (
                  <>
                    <NoticeBox
                      notice={{
                        tone: "error",
                        text: "Tu cuenta solo entra con Google. Para desvincularla primero creá una contraseña, así no te quedás sin forma de entrar.",
                      }}
                    />
                    <PrimaryButton label="Crear contraseña" onPress={() => router.push("/(main)/account/password")} />
                  </>
                )}
              </>
            ) : (
              <PrimaryButton label="Vincular cuenta de Google" onPress={startLink} />
            )}
          </>
        )}
      </Card>
    </AccountScreen>
  )
}
