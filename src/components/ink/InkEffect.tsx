'use client'
import { useEffect, useRef } from 'react'
import { animate } from 'animejs'

interface InkDropProps {
  x?: number
  y?: number
  size?: number
  color?: string
  duration?: number
  trigger?: boolean
}

export function InkDrop({ x = 0.5, y = -0.1, size = 120, color = 'rgba(26,26,26,0.08)', duration = 4000, trigger = true }: InkDropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!trigger) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const cx = typeof x === 'number' ? x * canvas.width : canvas.width / 2
    const cy = typeof y === 'number' ? y * canvas.height : canvas.height / 2

    animate(
      { progress: 0 },
      {
        progress: [0, 1],
        duration,
        easing: 'easeOutCubic',
        update: (anim) => {
          const p = anim.progress
          ctx.clearRect(0, 0, canvas.width, canvas.height)

          // Ink drop falling
          if (p < 0.3) {
            const dropY = cy + (p / 0.3) * canvas.height * 0.3
            ctx.beginPath()
            ctx.arc(cx, dropY, 4, 0, Math.PI * 2)
            ctx.fillStyle = color
            ctx.fill()
          }

          // Ink spread
          if (p > 0.2) {
            const spread = (p - 0.2) / 0.8
            const r = size * spread
            const alpha = Math.max(0, 0.15 * (1 - spread))
            const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
            gradient.addColorStop(0, color.replace('0.08', String(alpha)))
            gradient.addColorStop(1, 'transparent')
            ctx.beginPath()
            ctx.arc(cx, cy, r, 0, Math.PI * 2)
            ctx.fillStyle = gradient
            ctx.fill()
          }
        },
      },
    )
  }, [trigger, x, y, size, color, duration])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-40"
    />
  )
}

export function InkSplash({ x = 0.15, y = 0.85, size = 200 }: { x?: number; y?: number; size?: number }) {
  return (
    <InkDrop x={x} y={y} size={size} color="rgba(26,26,26,0.06)" duration={8000} />
  )
}
