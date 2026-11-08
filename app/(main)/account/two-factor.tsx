import { useEffect, useState } from "react"
import { ActivityIndicator, Linking, Platform, Pressable, Text, TouchableOpacity, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import * as Clipboard from "expo-clipboard"
import { Ionicons } from "@expo/vector-icons"
import {
  disableTwoFactor,
  enableTwoFactor,
  getTwoFactorStatus,
  regenerateRecoveryCodes,
  startTwoFactorSetup,
  type TwoFactorStatus,
} from "@/lib/api/auth"
import { ApiError, friendlyError } from "@/lib/api/client"
import AuthField from "@/components/AuthField"
import QrCode from "@/components/QrCode"
import { AccountScreen, Card, DoneState, NoticeBox, PrimaryButton } from "@/components/account/AccountUi"
import type { Notice } from "@/components/account/AccountUi"
import { useAuth } from "@/context/AuthContext"
import { saveTextFile } from "@/lib/saveTextFile"

type Flow = "overview" | "qr" | "verify" | "codes" | "reauth-regenerate" | "reauth-disable" | "disabled"

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function groupSecret(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim()
}

export default function TwoFactorScreen() {
  const { user, setUser } = useAuth()
  const router = useRouter()
  const { regenerate } = useLocalSearchParams<{ regenerate?: string }>()
  const [status, setStatus] = useState<TwoFactorStatus | null>(null)
  const [flow, setFlow] = useState<Flow>("overview")
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string } | null>(null)
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [codes, setCodes] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const usesPassword = user?.hasPassword !== false

  useEffect(() => {
    getTwoFactorStatus()
      .then((s) => {
        setStatus(s)
        if (regenerate && s.enabled) setFlow("reauth-regenerate")
      })
      .catch((err) => setNotice({ tone: "error", text: friendlyError(err) }))
  }, [regenerate])

  const exit = () => (router.canGoBack() ? router.back() : router.replace("/(main)/account"))
  const toOverview = () => {
    setNotice(null)
    setCode("")
    setPassword("")
    setFlow("overview")
  }

  const begin = async () => {
    setBusy(true)
    setNotice(null)
    try {
      setSetup(await startTwoFactorSetup())
      setFlow("qr")
    } catch (err) {
      setNotice({ tone: "error", text: friendlyError(err) })
    } finally {
      setBusy(false)
    }
  }

  const confirmCode = async () => {
    if (code.length !== 6) return
    setBusy(true)
    setNotice(null)
    try {
      const list = await enableTwoFactor(code)
      setCodes(list)
      setSaved(false)
      setCopied(false)
      setDownloaded(false)
      setStatus({ enabled: true, enabledAt: new Date().toISOString(), recoveryCodesRemaining: list.length })
      if (user) setUser({ ...user, twoFactorEnabled: true })
      setCode("")
      setFlow("codes")
    } catch (err) {
      setCode("")
      setNotice({
        tone: "error",
        text: err instanceof ApiError && err.status === 400 ? "El código no coincide. Fijate que sea el que muestra ahora la app para Discordia." : friendlyError(err),
      })
    } finally {
      setBusy(false)
    }
  }

  const proof = () => (usesPassword ? { password } : { code })
  const proofReady = usesPassword ? password.length > 0 : code.length === 6

  const doRegenerate = async () => {
    if (!proofReady) return
    setBusy(true)
    setNotice(null)
    try {
      const list = await regenerateRecoveryCodes(proof())
      setCodes(list)
      setSaved(false)
      setCopied(false)
      setDownloaded(false)
      setStatus((s) => (s ? { ...s, recoveryCodesRemaining: list.length } : s))
      setPassword("")
      setCode("")
      setFlow("codes")
    } catch (err) {
      setPassword("")
      setCode("")
      setNotice({ tone: "error", text: friendlyError(err) })
    } finally {
      setBusy(false)
    }
  }

  const doDisable = async () => {
    if (!proofReady) return
    setBusy(true)
    setNotice(null)
    try {
      await disableTwoFactor(proof())
      setStatus({ enabled: false, enabledAt: null, recoveryCodesRemaining: 0 })
      if (user) setUser({ ...user, twoFactorEnabled: false })
      setPassword("")
      setCode("")
      setFlow("disabled")
    } catch (err) {
      setPassword("")
      setCode("")
      setNotice({ tone: "error", text: friendlyError(err) })
    } finally {
      setBusy(false)
    }
  }

  const copyCodes = async () => {
    await Clipboard.setStringAsync(codes.join("\n"))
    setCopied(true)
  }

  const downloadCodes = async () => {
    const generated = new Date().toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    const content = [
      "Discordia - Códigos de recuperación",
      `Cuenta: ${user?.email ?? ""}`,
      `Generados: ${generated}`,
      "",
      "Cada código sirve una sola vez para entrar si no tenés tu app autenticadora.",
      "Si generás una lista nueva, estos dejan de servir.",
      "",
      ...codes,
      "",
    ].join("\n")
    try {
      await saveTextFile("discordia-codigos-de-recuperacion.txt", content)
      setDownloaded(true)
    } catch {
      setNotice({ tone: "error", text: "No pudimos guardar el archivo. Probá copiándolos." })
    }
  }

  if (!status) {
    return (
      <AccountScreen title="Verificación en dos pasos" onBack={exit}>
        <NoticeBox notice={notice} />
        {notice ? null : <ActivityIndicator color="#37D6C0" />}
      </AccountScreen>
    )
  }

  if (flow === "qr" && setup) {
    return (
      <AccountScreen
        title="Escaneá el código"
        subtitle="Abrí tu app autenticadora (Google Authenticator, Microsoft Authenticator, Authy…) y escaneá este código."
        step={1}
        totalSteps={3}
        onBack={toOverview}
      >
        <Card>
          <View style={{ alignItems: "center", gap: 14 }}>
            <QrCode value={setup.otpauthUri} size={200} />
            <Text style={{ color: "#8DA8AC", fontSize: 12.5, textAlign: "center" }}>¿No podés escanearlo? Cargá esta clave a mano en la app:</Text>
            <Text selectable style={{ color: "#E6F3F3", fontSize: 15, fontWeight: "700", letterSpacing: 1, textAlign: "center", fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) }}>
              {groupSecret(setup.secret)}
            </Text>
            {Platform.OS !== "web" ? (
              <TouchableOpacity onPress={() => Linking.openURL(setup.otpauthUri).catch(() => undefined)}>
                <Text style={{ color: "#37D6C0", fontWeight: "700", fontSize: 13 }}>Abrir en mi app autenticadora</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </Card>
        <PrimaryButton label="Ya lo escaneé" onPress={() => setFlow("verify")} />
      </AccountScreen>
    )
  }

  if (flow === "verify") {
    return (
      <AccountScreen
        title="Confirmá el código"
        subtitle="Ingresá el código de 6 dígitos que muestra la app para Discordia."
        step={2}
        totalSteps={3}
        onBack={() => setFlow("qr")}
      >
        <Card>
          <NoticeBox notice={notice} />
          <AuthField
            label="Código de la app"
            value={code}
            onChangeText={(t) => {
              setCode(t.replace(/\D/g, "").slice(0, 6))
              setNotice(null)
            }}
            placeholder="123456"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            autoFocus
            onSubmitEditing={confirmCode}
            style={{ letterSpacing: 8, fontSize: 20, textAlign: "center" }}
          />
          <View style={{ height: 14 }} />
          <PrimaryButton label="Activar" onPress={confirmCode} disabled={code.length !== 6} busy={busy} />
        </Card>
      </AccountScreen>
    )
  }

  if (flow === "codes") {
    return (
      <AccountScreen
        title="Guardá tus códigos de recuperación"
        subtitle="Si perdés el celular, cada código te deja entrar una sola vez. Guardalos en un lugar seguro: no los vas a volver a ver."
        step={3}
        totalSteps={3}
        onBack={() =>
          saved ? toOverview() : setNotice({ tone: "error", text: "Antes de salir, guardá los códigos y marcá la casilla de abajo." })
        }
      >
        <NoticeBox notice={notice} />
        <Card>
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 }}>
            {codes.map((c) => (
              <View key={c} style={{ width: "48%", paddingVertical: 9, borderRadius: 8, alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)" }}>
                <Text selectable style={{ color: "#E6F3F3", fontSize: 14.5, fontWeight: "700", letterSpacing: 1, fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) }}>
                  {c}
                </Text>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: "row", justifyContent: "center", flexWrap: "wrap", columnGap: 22, marginTop: 14 }}>
            <TouchableOpacity onPress={copyCodes} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 }}>
              <Ionicons name={copied ? "checkmark" : "copy-outline"} size={15} color="#37D6C0" />
              <Text style={{ color: "#37D6C0", fontWeight: "700", fontSize: 13 }}>{copied ? "Copiados" : "Copiar todos"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={downloadCodes} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 }}>
              <Ionicons name={downloaded ? "checkmark" : "download-outline"} size={15} color="#37D6C0" />
              <Text style={{ color: "#37D6C0", fontWeight: "700", fontSize: 13 }}>{downloaded ? "Descargados" : "Descargar .txt"}</Text>
            </TouchableOpacity>
          </View>
        </Card>
        <Pressable
          onPress={() => {
            setSaved((v) => !v)
            setNotice(null)
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: saved }}
          style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}
        >
          <Ionicons name={saved ? "checkbox" : "square-outline"} size={20} color={saved ? "#37D6C0" : "#8DA8AC"} />
          <Text style={{ color: "#E6F3F3", fontSize: 13.5, flex: 1 }}>Ya los guardé en un lugar seguro</Text>
        </Pressable>
        <PrimaryButton label="Listo" disabled={!saved} onPress={toOverview} />
      </AccountScreen>
    )
  }

  if (flow === "reauth-regenerate" || flow === "reauth-disable") {
    const disabling = flow === "reauth-disable"
    return (
      <AccountScreen
        title={disabling ? "Desactivar la verificación" : "Generar códigos nuevos"}
        subtitle={
          disabling
            ? "Tu cuenta va a quedar protegida solo con la contraseña. Para confirmar, ingresá"
              + (usesPassword ? " tu contraseña." : " el código de tu app.")
            : "La lista anterior deja de servir. Para confirmar, ingresá" + (usesPassword ? " tu contraseña." : " el código de tu app.")
        }
        onBack={toOverview}
      >
        <Card>
          <NoticeBox notice={notice} />
          {usesPassword ? (
            <AuthField
              label="Contraseña"
              value={password}
              onChangeText={(t) => {
                setPassword(t)
                setNotice(null)
              }}
              secureTextEntry
              autoComplete="current-password"
              autoFocus
              onSubmitEditing={disabling ? doDisable : doRegenerate}
            />
          ) : (
            <AuthField
              label="Código de la app"
              value={code}
              onChangeText={(t) => {
                setCode(t.replace(/\D/g, "").slice(0, 6))
                setNotice(null)
              }}
              placeholder="123456"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              autoFocus
              onSubmitEditing={disabling ? doDisable : doRegenerate}
              style={{ letterSpacing: 8, fontSize: 20, textAlign: "center" }}
            />
          )}
          <View style={{ height: 14 }} />
          <PrimaryButton
            label={disabling ? "Desactivar" : "Generar códigos"}
            onPress={disabling ? doDisable : doRegenerate}
            disabled={!proofReady}
            busy={busy}
          />
        </Card>
      </AccountScreen>
    )
  }

  if (flow === "disabled") {
    return (
      <AccountScreen title="Verificación en dos pasos" onBack={exit}>
        <DoneState
          icon="shield-outline"
          title="Verificación desactivada"
          text="Desde ahora, para entrar alcanza con tu email y contraseña. Podés volver a activarla cuando quieras."
          buttonLabel="Volver a Mi cuenta"
          onPress={exit}
        />
      </AccountScreen>
    )
  }

  return (
    <AccountScreen
      title="Verificación en dos pasos"
      subtitle="Además de tu contraseña, al entrar te pedimos un código de tu celular. Así, aunque alguien conozca tu contraseña, no puede entrar."
      onBack={exit}
    >
      <NoticeBox notice={notice} />
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: status.enabled ? "rgba(79,214,156,0.14)" : "rgba(255,255,255,0.06)",
            }}
          >
            <Ionicons name={status.enabled ? "shield-checkmark" : "shield-outline"} size={20} color={status.enabled ? "#4FD69C" : "#8DA8AC"} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#E6F3F3", fontSize: 15, fontWeight: "800" }}>{status.enabled ? "Activada" : "Desactivada"}</Text>
            <Text style={{ color: "#8DA8AC", fontSize: 12.5, marginTop: 2 }}>
              {status.enabled && status.enabledAt ? `Desde el ${formatDate(status.enabledAt)}` : "Tu cuenta se protege solo con la contraseña."}
            </Text>
          </View>
        </View>
        {status.enabled ? (
          <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)" }}>
            <Text style={{ color: status.recoveryCodesRemaining <= 2 ? "#F0C24B" : "#C9DADB", fontSize: 13 }}>
              {status.recoveryCodesRemaining === 0
                ? "No te quedan códigos de recuperación. Generá una lista nueva."
                : `Códigos de recuperación disponibles: ${status.recoveryCodesRemaining}`}
            </Text>
          </View>
        ) : null}
      </Card>
      {status.enabled ? (
        <>
          <PrimaryButton label="Generar códigos de recuperación nuevos" onPress={() => setFlow("reauth-regenerate")} />
          <TouchableOpacity onPress={() => setFlow("reauth-disable")} style={{ alignItems: "center", paddingVertical: 14 }}>
            <Text style={{ color: "#FF9E94", fontWeight: "700", fontSize: 13.5 }}>Desactivar la verificación en dos pasos</Text>
          </TouchableOpacity>
        </>
      ) : (
        <PrimaryButton label="Activar" onPress={begin} busy={busy} />
      )}
    </AccountScreen>
  )
}
