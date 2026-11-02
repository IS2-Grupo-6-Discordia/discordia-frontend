import { useEffect, useState } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useAuth } from "@/context/AuthContext"
import { register, requestRegistrationCode } from "@/api/auth"
import { ApiError, friendlyError } from "@/api/client"
import { safeRedirect } from "@/lib/safeRedirect"
import AuthBrand from "@/components/AuthBrand"
import AuthField from "@/components/AuthField"

const RESEND_SECONDS = 60

const NOTICE_ERROR = {
  flexDirection: "row" as const,
  alignItems: "flex-start" as const,
  gap: 8,
  paddingHorizontal: 12,
  paddingVertical: 10,
  borderRadius: 10,
  marginBottom: 14,
  backgroundColor: "rgba(255,127,114,0.12)",
  borderWidth: 1,
  borderColor: "rgba(255,127,114,0.30)",
}

function Req({ met, text }: { met: boolean; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 9999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: met ? "#4FD69C" : "rgba(255,255,255,0.13)",
        }}
      >
        <Text style={{ fontSize: 7, fontWeight: "800", color: met ? "#0A1620" : "#8DA8AC" }}>
          {met ? "✓" : "–"}
        </Text>
      </View>
      <Text style={{ fontSize: 11, color: met ? "#4FD69C" : "#8DA8AC" }}>{text}</Text>
    </View>
  )
}

export default function RegisterScreen() {
  const { setUser } = useAuth()
  const router = useRouter()
  // Preserve an invite deep-link across register -> login so the destination
  // survives the whole sign-up flow. Validated before use (open-redirect guard).
  const { redirect } = useLocalSearchParams<{ redirect?: string }>()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [pw, setPw] = useState("")
  const [loading, setLoading] = useState(false)
  const [emailDupe, setEmailDupe] = useState(false)
  const [error, setError] = useState("")
  const [step, setStep] = useState<"form" | "code">("form")
  const [code, setCode] = useState("")
  const [resendIn, setResendIn] = useState(0)
  const [notice, setNotice] = useState("")

  useEffect(() => {
    if (resendIn <= 0) return
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendIn])

  const checks = {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
  }
  const metCount = Object.values(checks).filter(Boolean).length
  const allMet = metCount === 4

  const showError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : ""
    if (msg === "EMAIL_DUPLICADO") {
      setEmailDupe(true)
      setStep("form")
    } else {
      setError(friendlyError(err))
    }
  }

  const sendCode = async () => {
    setLoading(true)
    setEmailDupe(false)
    setError("")
    setNotice("")
    try {
      await requestRegistrationCode(name.trim(), email.trim(), pw)
      setStep("code")
      setCode("")
      setResendIn(RESEND_SECONDS)
    } catch (err) {
      showError(err)
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async () => {
    if (!allMet) return
    await sendCode()
  }

  const resend = async () => {
    if (resendIn > 0 || loading) return
    await sendCode()
    setNotice("Te mandamos un código nuevo.")
  }

  const confirmCode = async () => {
    if (code.length !== 6) return
    setLoading(true)
    setError("")
    setNotice("")
    try {
      const res = await register(name.trim(), email.trim(), pw, code)
      setUser(res.user)
      router.replace(safeRedirect(redirect))
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setEmailDupe(true)
        setStep("form")
      } else {
        showError(err)
      }
    } finally {
      setLoading(false)
    }
  }

  if (step === "code") {
    const ready = code.length === 6
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, backgroundColor: "#0A1620" }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
          keyboardShouldPersistTaps="handled"
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
            <AuthBrand
              title="Revisá tu email"
              subtitle={`Te mandamos un código de 6 dígitos a ${email.trim()}. Ingresalo para terminar de crear tu cuenta.`}
            />

            {error ? (
              <View style={NOTICE_ERROR}>
                <Text style={{ color: "#FF9E94", fontWeight: "700" }}>!</Text>
                <Text style={{ color: "#FF9E94", fontSize: 12.5, flex: 1 }}>{error}</Text>
              </View>
            ) : null}
            {notice ? (
              <Text style={{ color: "#4FD69C", fontSize: 12.5, marginBottom: 12, textAlign: "center" }}>{notice}</Text>
            ) : null}

            <AuthField
              label="Código"
              value={code}
              onChangeText={(value) => {
                setCode(value.replace(/\D/g, "").slice(0, 6))
                setError("")
              }}
              placeholder="000000"
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              onSubmitEditing={confirmCode}
              style={{ fontSize: 22, letterSpacing: 8, textAlign: "center", fontWeight: "700" }}
              containerStyle={{ marginBottom: 14 }}
            />

            <TouchableOpacity
              onPress={confirmCode}
              disabled={loading || !ready}
              style={{
                width: "100%",
                borderRadius: 10,
                paddingVertical: 13,
                alignItems: "center",
                backgroundColor: ready ? "#37D6C0" : "rgba(255,255,255,0.15)",
              }}
            >
              <Text style={{ fontWeight: "700", fontSize: 14, color: ready ? "#04211D" : "#8DA8AC" }}>
                {loading ? "Creando cuenta..." : "Confirmar y crear cuenta"}
              </Text>
            </TouchableOpacity>

            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16 }}>
              <TouchableOpacity
                onPress={() => {
                  setStep("form")
                  setError("")
                  setNotice("")
                }}
              >
                <Text style={{ color: "#8DA8AC", fontWeight: "600", fontSize: 12 }}>← Cambiar email</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={resend} disabled={resendIn > 0 || loading}>
                <Text style={{ color: resendIn > 0 ? "#5E7E82" : "#37D6C0", fontWeight: "600", fontSize: 12 }}>
                  {resendIn > 0 ? `Reenviar en ${resendIn}s` : "Reenviar código"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#0A1620" }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
        keyboardShouldPersistTaps="handled"
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
          <AuthBrand title="Creá tu cuenta" subtitle="Un minuto y ya podés abrir tu primer servidor." />

          {/* Email dupe error */}
          {emailDupe ? (
            <View style={NOTICE_ERROR}>
              <Text style={{ color: "#FF9E94", fontWeight: "700" }}>!</Text>
              <Text style={{ color: "#FF9E94", fontSize: 12.5, flex: 1 }}>
                Ese correo ya está en uso. ¿Querés iniciar sesión?
              </Text>
            </View>
          ) : null}

          {error ? (
            <View style={NOTICE_ERROR}>
              <Text style={{ color: "#FF9E94", fontWeight: "700" }}>!</Text>
              <Text style={{ color: "#FF9E94", fontSize: 12.5, flex: 1 }}>{error}</Text>
            </View>
          ) : null}

          <AuthField
            label="Nombre"
            value={name}
            onChangeText={setName}
            placeholder="Facundo Arroquy"
            containerStyle={{ marginBottom: 14 }}
          />

          <AuthField
            label="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            placeholder="vos@ejemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            error={emailDupe}
            containerStyle={{ marginBottom: 14 }}
          />

          <AuthField
            label="Contraseña"
            value={pw}
            onChangeText={setPw}
            placeholder="Mínimo 8 caracteres"
            secureTextEntry
          />

          {/* Password strength */}
          {pw.length > 0 && (
            <>
              <View style={{ flexDirection: "row", gap: 4, marginTop: 8 }}>
                {[0, 1, 2, 3].map((i) => (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: 3,
                      borderRadius: 2,
                      backgroundColor:
                        i < metCount
                          ? metCount <= 2
                            ? "#F0C24B"
                            : "#4FD69C"
                          : "rgba(255,255,255,0.13)",
                    }}
                  />
                ))}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 4, columnGap: 12, marginTop: 8, marginBottom: 12 }}>
                <Req met={checks.length} text="8 caracteres" />
                <Req met={checks.upper} text="Una mayúscula" />
                <Req met={checks.lower} text="Una minúscula" />
                <Req met={checks.number} text="Un número" />
              </View>
            </>
          )}

          {/* Register button */}
          <TouchableOpacity
            onPress={handleRegister}
            disabled={loading || !allMet || !name.trim() || !email.trim()}
            style={{
              width: "100%",
              borderRadius: 10,
              paddingVertical: 13,
              alignItems: "center",
              marginTop: 6,
              backgroundColor: allMet ? "#37D6C0" : "rgba(255,255,255,0.15)",
            }}
          >
            <Text
              style={{
                fontWeight: "700",
                fontSize: 14,
                color: allMet ? "#04211D" : "#8DA8AC",
              }}
            >
              {loading ? "Enviando código..." : "Crear cuenta"}
            </Text>
          </TouchableOpacity>

          <Text style={{ color: "#8DA8AC", fontSize: 12, textAlign: "center", marginTop: 16, lineHeight: 20 }}>
            Al registrarte aceptás los términos de la plataforma.
          </Text>

          {/* Back to login */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 12, gap: 4 }}>
            <Text style={{ color: "#8DA8AC", fontSize: 12 }}>¿Ya tenés cuenta?</Text>
            <TouchableOpacity
              onPress={() =>
                router.push(
                  redirect
                    ? { pathname: "/(auth)/login", params: { redirect } }
                    : "/(auth)/login",
                )
              }
            >
              <Text style={{ color: "#37D6C0", fontWeight: "600", fontSize: 12 }}>Iniciá sesión</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
