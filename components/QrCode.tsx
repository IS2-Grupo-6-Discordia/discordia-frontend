import { useMemo } from "react"
import { View } from "react-native"
import qrcode from "qrcode-generator"

interface QrCodeProps {
  value: string
  size?: number
}

export default function QrCode({ value, size = 200 }: QrCodeProps) {
  const rows = useMemo(() => {
    const qr = qrcode(0, "M")
    qr.addData(value)
    qr.make()
    const count = qr.getModuleCount()
    const result: { count: number; runs: { start: number; length: number }[] }[] = []
    for (let row = 0; row < count; row++) {
      const runs: { start: number; length: number }[] = []
      let col = 0
      while (col < count) {
        if (qr.isDark(row, col)) {
          const start = col
          while (col < count && qr.isDark(row, col)) col++
          runs.push({ start, length: col - start })
        } else col++
      }
      result.push({ count, runs })
    }
    return result
  }, [value])

  const modules = rows.length + 8
  const cell = Math.floor(size / modules) || 1
  const inner = cell * rows.length

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Código QR para la app autenticadora"
      style={{ width: inner + cell * 8, height: inner + cell * 8, padding: cell * 4, backgroundColor: "#FFFFFF", borderRadius: 12 }}
    >
      {rows.map((row, r) => (
        <View key={r} style={{ height: cell, width: inner }}>
          {row.runs.map((run) => (
            <View
              key={run.start}
              style={{ position: "absolute", left: run.start * cell, width: run.length * cell, height: cell, backgroundColor: "#000000" }}
            />
          ))}
        </View>
      ))}
    </View>
  )
}
