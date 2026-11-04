import { useState } from "react"
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { ApiError, friendlyError } from "@/lib/api/client"
import { completeTwoFactorLogin, type TwoFactorLoginResult } from "@/lib/api/auth"
import AuthField from "./AuthField"
import PressableScale from "./PressableScale"

interface TwoFactorStepProps {
  challengeToken: string
  onCancel: () => void
  onDone: (result: TwoFactorLoginResult, next: "continue" | "regenerate") => void
}

export default function TwoFactorStep({ challengeToken, onCancel, onDone }: TwoFactorStepProps) {
  const [mode, setMode] = useState<"code" | "recovery">("code")
  const [value, setValue] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [expired, setExpired] = useState(false)
  const [usedRecovery, setUsedRecovery] = useState<TwoFactorLoginResult | null>(null)

  const clean = mode === "code" ? value.replace(/\D/g, "") : value.trim()
  const ready = mode === "code" ? clean.length === 6 : clean.replace(/[^a-z0-9]/gi, "").length >= 10

  const submit = async () => {
    if (!ready || loading) return
    setLoading(true)
    setError("")
    try {
      const result = await completeTwoFactorLogin(challengeToken, mode === "code" ? { code: clean } : { recoveryCode: clean })
      if (result.recoveryCodeUsed) setUsedRecovery(result)
      else onDone(result, "continue")
    } catch (err) {
      if (err instanceof ApiError && err.status === 401 && /Volvé a iniciar sesión/.test(err.message)) setExpired(true)
      else if (err instanceof ApiError && err.status === 401)
        setError(mode === "code" ? "El código no es correcto o ya venció. Probá con el que muestra ahora la app." : "Ese código de recuperación no es válido o ya se usó.")
      else setError(friendlyError(err))
      setValue("")
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => {
    setMode((m) => (m === "code" ? "recovery" : "code"))
    setValue("")
    setError("")
  }

  if (usedRecovery) {
    const left = usedRecovery.recoveryCodesRemaining
    return (
      <View style={{ gap: 12 }}>
        <View style={{ alignItems: "center", gap: 10 }}>
          <View style={{ width: 52, height: 52, borderRadius: 9999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(240,194,75,0.14)" }}>
            <Ionicons name="key-outline" size={24} color="#F0C24B" />
          </View>
          <Text style={{ color: "#F2FAFA", fontWeight: "800", fontSize: 18, textAlign: "center" }}>Usaste un código de recuperación</Text>
          <Text style={{ color: "#8DA8AC", fontSize: 13, lineHeight: 19, textAlign: "center" }}>
            Ese código ya no sirve más.{" "}
            {left === 0 ? "No te queda ninguno." : left === 1 ? "Te queda 1." : `Te quedan ${left}.`} Te recomendamos generar una lista nueva y guardarla en un
            lugar seguro.
          </Text>
        </View>
        <PressableScale
          onPress={() => onDone(usedRecovery, "regenerate")}
          style={{ borderRadius: 10, paddingVertical: 13, alignItems: "center", backgroundColor: "#37D6C0" }}
        >
          <Text style={{ color: "#04211D", fontWeight: "700", fontSize: 14 }}>Generar códigos nuevos</Text>
        </PressableScale>
        <TouchableOpacity onPress={() => onDone(usedRecovery, "continue")} style={{ alignItems: "center", paddingVertical: 8 }}>
          <Text style={{ color: "#8DA8AC", fontWeight: "600", fontSize: 13 }}>Más tarde</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (expired) {
    return (
      <View style={{ gap: 12, alignItems: "center" }}>
        <Ionicons name="time-outline" size={28} color="#FF9E94" />
        <Text style={{ color: "#F2FAFA", fontWeight: "800", fontSize: 17, textAlign: "center" }}>La verificación venció</Text>
        <Text style={{ color: "#8DA8AC", fontSize: 13, lineHeight: 19, textAlign: "center" }}>
          Pasó demasiado tiempo o hubo demasiados intentos. Volvé a ingresar tu email y contraseña.
        </Text>
        <PressableScale onPress={onCancel} style={{ alignSelf: "stretch", borderRadius: 10, paddingVertical: 13, alignItems: "center", backgroundColor: "#37D6C0" }}>
          <Text style={{ color: "#04211D", fontWeight: "700", fontSize: 14 }}>Volver a empezar</Text>
        </PressableScale>
      </View>
    )
  }

  return (
    <View>
      <View style={{ alignItems: "center", marginBottom: 18 }}>
        <View style={{ width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(55,214,192,0.14)", marginBottom: 12 }}>
          <Ionicons name={mode === "code" ? "phone-portrait-outline" : "key-outline"} size={22} color="#37D6C0" />
        </View>
        <Text style={{ color: "#F2FAFA", fontWeight: "800", fontSize: 20, textAlign: "center" }}>Verificación en dos pasos</Text>
        <Text style={{ color: "#8DA8AC", fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 4 }}>
          {mode === "code"
            ? "Abrí tu app autenticadora (por ejemplo, Google Authenticator) e ingresá el código de 6 dígitos de Discordia."
            : "Ingresá uno de los códigos de recuperación que guardaste al activar la verificación."}
        </Text>
      </View>

      {error ? (
        <View
          accessibilityRole="alert"
          style={{ flexDirection: "row", gap: 8, padding: 10, borderRadius: 10, marginBottom: 12, backgroundColor: "rgba(255,127,114,0.12)", borderWidth: 1, borderColor: "rgba(255,127,114,0.30)" }}
        >
          <Ionicons name="alert-circle" size={15} color="#FF9E94" />
          <Text style={{ flex: 1, color: "#FF9E94", fontSize: 12.5 }}>{error}</Text>
        </View>
      ) : null}

      <AuthField
        label={mode === "code" ? "Código de la app" : "Código de recuperación"}
        value={value}
        onChangeText={(t) => {
          setValue(mode === "code" ? t.replace(/\D/g, "").slice(0, 6) : t.toUpperCase().slice(0, 20))
          setError("")
        }}
        placeholder={mode === "code" ? "123456" : "ABCDE-FGHJK"}
        keyboardType={mode === "code" ? "number-pad" : "default"}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete={mode === "code" ? "one-time-code" : "off"}
        textContentType={mode === "code" ? "oneTimeCode" : "none"}
        autoFocus
        editable={!loading}
        onSubmitEditing={submit}
        error={!!error}
        style={mode === "code" ? { letterSpacing: 8, fontSize: 20, textAlign: "center" } : undefined}
      />

      <PressableScale
        onPress={submit}
        disabled={!ready || loading}
        style={{
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          gap: 8,
          borderRadius: 10,
          paddingVertical: 13,
          marginTop: 14,
          backgroundColor: ready ? "#37D6C0" : "rgba(255,255,255,0.15)",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? <ActivityIndicator size="small" color="#04211D" /> : null}
        <Text style={{ color: ready ? "#04211D" : "#8DA8AC", fontWeight: "700", fontSize: 14 }}>Verificar</Text>
      </PressableScale>

      <TouchableOpacity onPress={switchMode} style={{ alignItems: "center", paddingVertical: 12 }}>
        <Text style={{ color: "#37D6C0", fontWeight: "700", fontSize: 13 }}>
          {mode === "code" ? "No tengo mi app: usar un código de recuperación" : "Usar el código de la app"}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onCancel} style={{ alignItems: "center", paddingVertical: 4 }}>
        <Text style={{ color: "#8DA8AC", fontWeight: "600", fontSize: 13 }}>← Volver</Text>
      </TouchableOpacity>
    </View>
  )
}
