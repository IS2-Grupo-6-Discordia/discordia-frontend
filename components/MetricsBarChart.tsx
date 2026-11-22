import { useState } from "react"
import { Platform, Pressable, Text, View } from "react-native"

export interface ChartBar {
  label: string // the day or week the bar stands for, e.g. "02/10"
  value: number
  detail: string // shown when the bar is hovered or tapped, e.g. "42 miembros · 3 altas"
}

interface MetricsBarChartProps {
  title: string
  bars: ChartBar[]
  startLabel: string
  endLabel: string
  // "zero": bars measure from 0 (things counted per day). "range": from just
  // below the smallest value, so a change of a few members over a large total
  // stays visible; the header shows the range so the scale is not hidden.
  scale?: "zero" | "range"
  color?: string
  activeColor?: string
  accessibilityLabel: string
}

export const CHART_HEIGHT = 120
const MIN_BAR = 4
const EMPTY_BAR = 2

const HINT = Platform.OS === "web" ? "Pasá el cursor sobre una barra para ver el detalle." : "Tocá una barra para ver el detalle."

function barHeights(values: number[], scale: "zero" | "range"): number[] {
  const hi = Math.max(0, ...values)
  if (scale === "zero" || values.length === 0) {
    const max = Math.max(1, hi)
    return values.map((v) => (v === 0 ? EMPTY_BAR : Math.max(MIN_BAR, (v / max) * CHART_HEIGHT)))
  }
  const lo = Math.min(...values)
  // Flat series: a steady line at mid height (nothing changed, but there are members).
  if (hi === lo) return values.map((v) => (v === 0 ? EMPTY_BAR : CHART_HEIGHT / 2))
  const floor = Math.max(0, lo - Math.ceil((hi - lo) / 2))
  return values.map((v) => (v === 0 ? EMPTY_BAR : MIN_BAR + ((v - floor) / (hi - floor)) * (CHART_HEIGHT - MIN_BAR)))
}

export default function MetricsBarChart({
  title,
  bars,
  startLabel,
  endLabel,
  scale = "zero",
  color = "#3FD0C9",
  activeColor = "#9FF0EB",
  accessibilityLabel,
}: MetricsBarChartProps) {
  const [active, setActive] = useState<number | null>(null)
  const values = bars.map((b) => b.value)
  const heights = barHeights(values, scale)
  const hi = Math.max(0, ...values)
  const lo = values.length ? Math.min(...values) : 0
  const scaleNote =
    scale === "range" && hi !== lo ? `de ${lo.toLocaleString("es-AR")} a ${hi.toLocaleString("es-AR")}` : `máx. ${hi.toLocaleString("es-AR")}`
  const activeBar = active !== null ? bars[active] : undefined

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text style={{ color: "#C9DADC", fontSize: 12.5, fontWeight: "700" }}>{title}</Text>
        <Text style={{ color: "#7F9DA1", fontSize: 11 }}>{scaleNote}</Text>
      </View>
      <Text numberOfLines={1} style={{ minHeight: 16, fontSize: 11.5, color: activeBar ? "#E6F3F3" : "#7F9DA1", fontWeight: activeBar ? "700" : "400" }}>
        {activeBar ? `${activeBar.label}: ${activeBar.detail}` : HINT}
      </Text>
      <View
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
        style={{ height: CHART_HEIGHT, flexDirection: "row", alignItems: "flex-end", gap: bars.length > 40 ? 1 : 3 }}
      >
        {bars.map((bar, i) => {
          const isActive = active === i
          return (
            // The whole column is the target, not just the bar: thin or short bars stay easy to hover.
            <Pressable
              key={i}
              accessibilityLabel={`${bar.label}: ${bar.detail}`}
              onHoverIn={() => setActive(i)}
              onHoverOut={() => setActive((current) => (current === i ? null : current))}
              onPress={() => setActive((current) => (current === i ? null : i))}
              style={{ flex: 1, height: CHART_HEIGHT, justifyContent: "flex-end" }}
            >
              <View
                style={{
                  height: heights[i],
                  borderTopLeftRadius: 3,
                  borderTopRightRadius: 3,
                  backgroundColor: bar.value === 0 ? "rgba(255,255,255,0.08)" : isActive ? activeColor : color,
                }}
              />
            </Pressable>
          )
        })}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: "#7F9DA1", fontSize: 11 }}>{startLabel}</Text>
        <Text style={{ color: "#7F9DA1", fontSize: 11 }}>{endLabel}</Text>
      </View>
    </View>
  )
}
