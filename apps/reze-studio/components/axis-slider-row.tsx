"use client"

import * as SliderPrimitive from "@radix-ui/react-slider"
import { memo, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type AxisSliderRowProps = {
  axis: string
  color: string
  value: number
  min: number
  max: number
  decimals: number
  disabled?: boolean
  onChange: (v: number) => void
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

/** Center-zero axis value: Radix Slider + theme track/input; fill + thumb use engine axis color. */
export const AxisSliderRow = memo(function AxisSliderRow({
  axis,
  color,
  value,
  min,
  max,
  decimals,
  disabled,
  onChange,
}: AxisSliderRowProps) {
  const step = useMemo(() => (decimals <= 2 ? 10 ** -decimals : 10 ** -4), [decimals])
  const pct = ((value - min) / (max - min)) * 100
  // Keep a local draft string while the input is focused so intermediate
  // values like "-", "3.", "-0.0" don't get reformatted away on each keystroke.
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <div className={cn("mb-1.5 px-1 flex items-center gap-1.5", disabled && "opacity-50")}>
      <span className="w-3.5 shrink-0 text-[10px] font-semibold" style={{ color: color }}>
        {axis}
      </span>
      <SliderPrimitive.Root
        className="relative flex h-[18px] flex-1 touch-none select-none items-center"
        min={min}
        max={max}
        step={step}
        value={[value]}
        disabled={disabled}
        onValueChange={(v) => onChange(clamp(v[0] ?? min, min, max))}
        aria-label={`${axis} axis`}
      >
        <SliderPrimitive.Track className="relative h-[3px] w-full grow overflow-hidden rounded-sm bg-secondary">
          {value >= 0 ? (
            <div
              className="absolute top-0 h-full rounded-sm opacity-50"
              style={{ left: "50%", width: `${Math.max(0, pct - 50)}%`, background: color }}
            />
          ) : (
            <div
              className="absolute top-0 h-full rounded-sm opacity-50"
              style={{ right: "50%", width: `${Math.max(0, 50 - pct)}%`, background: color }}
            />
          )}
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className="block size-2.5 cursor-grab rounded-full border-[1.5px] border-background shadow-sm ring-offset-background transition-[box-shadow] hover:ring-2 hover:ring-ring/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none data-[disabled]:opacity-50"
          style={{ backgroundColor: color }}
        />
      </SliderPrimitive.Root>
      <Input
        type="text"
        inputMode="decimal"
        disabled={disabled}
        className="h-5 w-13 rounded-sm border border-input bg-muted ml-2 px-1.5 py-0.5 text-right font-mono text-[10px] tabular-nums shadow-none md:text-[10px]"
        style={{ color }}
        value={draft ?? (Number.isFinite(value) ? value.toFixed(decimals) : "")}
        onFocus={(e) => {
          setDraft(Number.isFinite(value) ? value.toFixed(decimals) : "")
          e.currentTarget.select()
        }}
        onChange={(e) => {
          const s = e.target.value
          setDraft(s)
          const x = parseFloat(s.replace(/,/g, "."))
          if (Number.isFinite(x)) onChange(clamp(x, min, max))
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur()
          if (e.key === "Escape") {
            setDraft(null)
            ;(e.currentTarget as HTMLInputElement).blur()
          }
        }}
      />
    </div>
  )
})
