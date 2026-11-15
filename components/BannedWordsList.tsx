import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native"
import type { TextStyle, ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { friendlyError } from "@/lib/api/client"
import {
  BANNED_WORD_MAX,
  BANNED_WORDS_MAX_PER_SERVER,
  addBannedWord,
  listBannedWords,
  removeBannedWord,
  type BannedWord,
} from "@/lib/api/servers"
import PressableScale from "./PressableScale"

interface BannedWordsListProps {
  serverId: string
}

// HU-63: the server's banned words, for members with `moderate_members`.
// Changes apply from the next message: mensajes reads the list on every send.
// The backend has the final word on validation; this only catches the obvious
// cases (empty, spaces, too long) before the request.
export default function BannedWordsList({ serverId }: BannedWordsListProps) {
  const [words, setWords] = useState<BannedWord[]>([])
  const [draft, setDraft] = useState("")
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      setWords(await listBannedWords(serverId))
    } catch (err) {
      setError(friendlyError(err))
      setWords([])
    } finally {
      setLoading(false)
    }
  }, [serverId])

  useEffect(() => {
    if (serverId) load()
  }, [serverId, load])

  const full = words.length >= BANNED_WORDS_MAX_PER_SERVER

  const add = async () => {
    const word = draft.trim()
    if (!word) return
    if (/\s/.test(word)) {
      setError("Agregá una palabra por vez, sin espacios.")
      return
    }
    if ([...word].length > BANNED_WORD_MAX) {
      setError(`La palabra puede tener hasta ${BANNED_WORD_MAX} caracteres.`)
      return
    }
    setAdding(true)
    setError("")
    try {
      const added = await addBannedWord(serverId, word)
      setWords((prev) =>
        prev.some((w) => w.word === added.word) ? prev : [...prev, added].sort((a, b) => a.word.localeCompare(b.word)),
      )
      setDraft("")
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setAdding(false)
    }
  }

  const remove = async (word: string) => {
    setRemoving(word)
    setError("")
    try {
      await removeBannedWord(serverId, word)
      setWords((prev) => prev.filter((w) => w.word !== word))
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setRemoving(null)
    }
  }

  return (
    <View>
      <Text style={{ color: "#8DA8AC", fontSize: 12, lineHeight: 17, marginBottom: 10 }}>
        Los mensajes que tengan alguna de estas palabras no se envían. No importan las mayúsculas ni las tildes, y
        cuenta solo la palabra completa: “casa” bloquea “CASA” y “cása”, pero no “casamiento”.
      </Text>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        <TextInput
          value={draft}
          onChangeText={(text) => {
            setDraft(text)
            if (error) setError("")
          }}
          onSubmitEditing={add}
          placeholder={full ? "Llegaste al máximo de palabras" : "Nueva palabra"}
          placeholderTextColor="#5E7E82"
          maxLength={BANNED_WORD_MAX + 10}
          editable={!adding && !full}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Nueva palabra prohibida"
          style={INPUT}
        />
        <PressableScale
          onPress={add}
          disabled={adding || full || !draft.trim()}
          style={[PRIMARY, { opacity: adding || full || !draft.trim() ? 0.5 : 1 }]}
        >
          {adding ? <ActivityIndicator size="small" color="#04211D" /> : <Ionicons name="add" size={16} color="#04211D" />}
          <Text style={{ color: "#04211D", fontWeight: "800", fontSize: 13 }}>Agregar</Text>
        </PressableScale>
      </View>

      {error ? (
        <View style={NOTICE_ERROR}>
          <Text style={{ color: "#FF9E94", fontSize: 12.5 }}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={{ paddingVertical: 30, alignItems: "center" }}>
          <ActivityIndicator color="#FF7F72" />
        </View>
      ) : words.length === 0 ? (
        <View style={{ alignItems: "center", gap: 8, paddingVertical: 26 }}>
          <Ionicons name="text-outline" size={28} color="#5E7E82" />
          <Text style={{ color: "#E6F3F3", fontSize: 13.5, fontWeight: "700" }}>No hay palabras prohibidas</Text>
          <Text style={{ color: "#8DA8AC", fontSize: 12, textAlign: "center", lineHeight: 17 }}>
            Las palabras que agregues se bloquean desde el próximo mensaje.
          </Text>
        </View>
      ) : (
        <>
          <Text style={META}>
            {words.length} de {BANNED_WORDS_MAX_PER_SERVER} palabras
          </Text>
          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {words.map((w) => (
              <View key={w.word} style={CHIP}>
                <Text style={{ color: "#E6F3F3", fontSize: 13, fontWeight: "600" }}>{w.word}</Text>
                <Pressable
                  onPress={() => remove(w.word)}
                  disabled={removing === w.word}
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar ${w.word}`}
                  hitSlop={8}
                >
                  {removing === w.word ? (
                    <ActivityIndicator size="small" color="#8DA8AC" />
                  ) : (
                    <Ionicons name="close" size={15} color="#8DA8AC" />
                  )}
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  )
}

const INPUT: TextStyle = {
  flex: 1,
  minWidth: 0,
  paddingHorizontal: 12,
  paddingVertical: 9,
  borderRadius: 10,
  color: "#E6F3F3",
  fontSize: 13.5,
  backgroundColor: "rgba(0,0,0,0.22)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.10)",
}

const PRIMARY: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  paddingHorizontal: 14,
  borderRadius: 10,
  backgroundColor: "#FF7F72",
}

const CHIP: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
  paddingLeft: 11,
  paddingRight: 8,
  paddingVertical: 6,
  borderRadius: 9999,
  backgroundColor: "rgba(255,255,255,0.05)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.10)",
}

const META: TextStyle = { color: "#5E7E82", fontSize: 11, marginBottom: 8 }

const NOTICE_ERROR: ViewStyle = {
  paddingHorizontal: 12,
  paddingVertical: 10,
  borderRadius: 10,
  marginBottom: 12,
  backgroundColor: "rgba(255,127,114,0.12)",
  borderWidth: 1,
  borderColor: "rgba(255,127,114,0.30)",
}
