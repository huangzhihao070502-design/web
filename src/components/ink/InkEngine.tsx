'use client'

import { useEffect, useRef } from 'react'
import { animate } from 'animejs'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InkEffectName =
  | 'inkDrop'
  | 'inkBloom'
  | 'inkSpread'
  | 'inkFlow'
  | 'inkStroke'
  | 'inkBreathe'
  | 'inkSpin'
  | 'inkFade'
  | 'inkParticles'
  | 'inkRipple'
  | 'none'

export interface InkEngineProps {
  /** Flip to true to trigger the effect once */
  trigger?: boolean
  /** Which effect to play */
  effect?: InkEffectName
  /** Normalised x-origin (0-1), default 0.5 */
  x?: number
  /** Normalised y-origin (0-1), default 0.5 */
  y?: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INK = 'rgba(26,26,26,'
const CANVAS_CLASS = 'pointer-events-none fixed inset-0 z-40'

// ---------------------------------------------------------------------------
// Canvas helpers
// ---------------------------------------------------------------------------

function initCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1
  const w = window.innerWidth
  const h = window.innerHeight
  canvas.width = w * dpr
  canvas.height = h * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  return ctx
}

/** Simple eased remap — t in [0,1], out in [0,1] via a quadratic ease-out */
function easeOutQuad(t: number): number {
  return t * (2 - t)
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
}

// ---------------------------------------------------------------------------
// Utility — draw an irregular organic circle
// ---------------------------------------------------------------------------

function organicCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  irregularity: number,
  seed: number = 0,
) {
  const segments = 36
  ctx.beginPath()
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    const n =
      1 +
      irregularity * Math.sin(a * 5 + seed) +
      irregularity * 0.6 * Math.sin(a * 11 + seed * 1.7) +
      irregularity * 0.3 * Math.sin(a * 23 + seed * 0.5)
    const r = radius * n
    const px = cx + Math.cos(a) * r
    const py = cy + Math.sin(a) * r
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

// ---------------------------------------------------------------------------
// Pre-compute particle state (used by inkParticles & inkBloom tendrils)
// ---------------------------------------------------------------------------

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  phase: number
  life: number
}

function createParticles(count: number, w: number, h: number, spread: number = 1): Particle[] {
  return Array.from({ length: count }, () => ({
    x: (Math.random() - 0.5) * w * spread,
    y: (Math.random() - 0.5) * h * spread,
    vx: (Math.random() - 0.5) * 0.15,
    vy: (Math.random() - 0.5) * 0.15,
    size: 0.5 + Math.random() * 2.5,
    phase: Math.random() * Math.PI * 2,
    life: 0.5 + Math.random() * 0.5,
  }))
}

// ===========================================================================
// EFFECTS
// ===========================================================================

type EffectFn = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cx: number,
  cy: number,
) => () => void

// ---------------------------------------------------------------------------
// 1. inkDrop — drop falls with gravity, splats, spreads irregularly
// ---------------------------------------------------------------------------

const effectInkDrop: EffectFn = (ctx, w, h, cx, cy) => {
  const maxR = Math.min(w, h) * 0.12
  const dropStartY = -30
  let running = true

  const anim = animate(
    { p: 0 },
    {
      p: [0, 1],
      duration: 6000,
      easing: 'easeInOutCubic',
      update: (a) => {
        if (!running) return
        const p = a.p as number
        ctx.clearRect(0, 0, w, h)

        if (p < 0.22) {
          // Falling drop with gravity feel
          const t = p / 0.22
          const y = dropStartY + (cy - dropStartY) * (t * t)
          const r = 3 + t * 2
          ctx.beginPath()
          ctx.arc(cx, y, r, 0, Math.PI * 2)
          ctx.fillStyle = `${INK}0.12)`
          ctx.fill()
        }

        if (p >= 0.22 && p < 0.30) {
          // Impact flash
          const t = (p - 0.22) / 0.08
          const r = 3 + t * 18
          const alpha = 0.18 * (1 - t)
          ctx.beginPath()
          ctx.arc(cx, cy, r, 0, Math.PI * 2)
          ctx.fillStyle = `${INK}${alpha.toFixed(3)})`
          ctx.fill()
        }

        if (p >= 0.30) {
          const t = (p - 0.30) / 0.70
          const r = 3 + maxR * easeOutExpo(t)
          const alpha = 0.14 * (1 - easeOutQuad(t))

          // Irregular organic spread with gradient
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
          grad.addColorStop(0, `${INK}${Math.min(alpha * 2, 0.20).toFixed(3)})`)
          grad.addColorStop(0.5, `${INK}${alpha.toFixed(3)})`)
          grad.addColorStop(1, `${INK}0)`)
          organicCircle(ctx, cx, cy, r, 0.10 + t * 0.06, p * 10)
          ctx.fillStyle = grad
          ctx.fill()

          // Denser core
          const coreR = r * 0.5
          const grad2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR)
          grad2.addColorStop(0, `${INK}${Math.min(alpha * 3, 0.28).toFixed(3)})`)
          grad2.addColorStop(1, `${INK}0)`)
          ctx.beginPath()
          ctx.arc(cx, cy, coreR, 0, Math.PI * 2)
          ctx.fillStyle = grad2
          ctx.fill()
        }
      },
    },
  )

  return () => {
    running = false
  }
}

// ---------------------------------------------------------------------------
// 2. inkBloom — ink blooms in water, radial gradient layers + tendrils
// ---------------------------------------------------------------------------

const effectInkBloom: EffectFn = (ctx, w, h, cx, cy) => {
  const maxR = Math.min(w, h) * 0.18
  const tendrilCount = 8
  const tendrils = Array.from({ length: tendrilCount }, () => ({
    angle: (Math.random() - 0.5) * Math.PI * 0.8,
    length: 0.4 + Math.random() * 0.6,
    width: 0.5 + Math.random() * 1.5,
  }))
  let running = true

  const anim = animate(
    { p: 0 },
    {
      p: [0, 1],
      duration: 8000,
      easing: 'easeInOutCubic',
      update: (a) => {
        if (!running) return
        const p = a.p as number
        ctx.clearRect(0, 0, w, h)

        const r = maxR * easeOutCubic(p)
        const baseAlpha = 0.10 * (1 - easeOutQuad(p))

        // Main radial bloom
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
        grad.addColorStop(0, `${INK}${Math.min(baseAlpha * 3, 0.22).toFixed(3)})`)
        grad.addColorStop(0.3, `${INK}${baseAlpha.toFixed(3)})`)
        grad.addColorStop(0.7, `${INK}${(baseAlpha * 0.5).toFixed(3)})`)
        grad.addColorStop(1, `${INK}0)`)
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()

        // Softer outer halo
        const haloR = r * 1.4
        const haloGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloR)
        haloGrad.addColorStop(0.6, `${INK}${(baseAlpha * 0.3).toFixed(3)})`)
        haloGrad.addColorStop(1, `${INK}0)`)
        ctx.beginPath()
        ctx.arc(cx, cy, haloR, 0, Math.PI * 2)
        ctx.fillStyle = haloGrad
        ctx.fill()

        // Tendrils
        if (p > 0.3) {
          const tp = (p - 0.3) / 0.7
          for (const t of tendrils) {
            const tLen = t.length * r * 0.8 * easeOutCubic(tp)
            const tWidth = t.width * (1 - tp * 0.5)
            const tAlpha = baseAlpha * 0.6 * (1 - tp * 0.3)
            const angle = t.angle + p * 0.5
            ctx.beginPath()
            ctx.moveTo(cx, cy)
            const ex = cx + Math.cos(angle) * tLen
            const ey = cy + Math.sin(angle) * tLen
            ctx.lineTo(ex, ey)
            ctx.strokeStyle = `${INK}${tAlpha.toFixed(3)})`
            ctx.lineWidth = tWidth
            ctx.lineCap = 'round'
            ctx.stroke()
          }
        }

        // Fine particles at edge
        if (p > 0.4) {
          const pp = (p - 0.4) / 0.6
          const particleCount = Math.floor(pp * 20)
          for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2 + pp * 2
            const dist = r * (0.8 + pp * 0.4)
            const px = cx + Math.cos(angle + i * 0.7) * dist
            const py = cy + Math.sin(angle + i * 0.7) * dist
            const ps = 1 + pp * 2
            ctx.beginPath()
            ctx.arc(px, py, ps, 0, Math.PI * 2)
            ctx.fillStyle = `${INK}${(baseAlpha * 0.4 * (1 - pp * 0.5)).toFixed(3)})`
            ctx.fill()
          }
        }
      },
    },
  )

  return () => {
    running = false
  }
}

// ---------------------------------------------------------------------------
// 3. inkSpread — ink contacts paper, spreads along fibers
// ---------------------------------------------------------------------------

const effectInkSpread: EffectFn = (ctx, w, h, cx, cy) => {
  const maxR = Math.min(w, h) * 0.10
  // Pre-compute fiber directions
  const fibers = Array.from({ length: 40 }, () => ({
    angle: (Math.random() - 0.5) * Math.PI,
    length: 0.3 + Math.random() * 0.7,
    offset: (Math.random() - 0.5) * 0.5,
    delay: Math.random() * 0.4,
  }))
  let running = true

  const anim = animate(
    { p: 0 },
    {
      p: [0, 1],
      duration: 10000,
      easing: 'easeInOutQuad',
      update: (a) => {
        if (!running) return
        const p = a.p as number
        ctx.clearRect(0, 0, w, h)

        const baseR = maxR * easeOutCubic(Math.min(p / 0.3, 1))
        const alpha = 0.12 * (1 - easeOutQuad(Math.min(p / 0.5, 1)))

        // Core ink pool
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR)
        grad.addColorStop(0, `${INK}${Math.min(alpha * 3, 0.25).toFixed(3)})`)
        grad.addColorStop(0.4, `${INK}${alpha.toFixed(3)})`)
        grad.addColorStop(1, `${INK}0)`)
        organicCircle(ctx, cx, cy, baseR, 0.08, 1.3)
        ctx.fillStyle = grad
        ctx.fill()

        // Fiber spread (dendritic)
        for (const f of fibers) {
          const fp = Math.max(0, Math.min(1, (p - f.delay) / (1 - f.delay)))
          const fAlpha = alpha * 0.5 * easeOutQuad(fp) * (1 - fp * 0.6)
          const fLen = f.length * maxR * 1.5 * easeOutCubic(fp)
          const fWidth = 1.5 * (1 - fp * 0.7)
          const angle = f.angle + f.offset

          ctx.beginPath()
          const sx = cx + Math.cos(angle + Math.PI / 2) * f.offset * baseR
          const sy = cy + Math.sin(angle + Math.PI / 2) * f.offset * baseR
          ctx.moveTo(sx, sy)
          const ex = sx + Math.cos(angle) * fLen
          const ey = sy + Math.sin(angle) * fLen
          ctx.lineTo(ex, ey)
          ctx.strokeStyle = `${INK}${fAlpha.toFixed(3)})`
          ctx.lineWidth = fWidth
          ctx.lineCap = 'round'
          ctx.stroke()
        }

        // Edge diffusion blobs
        if (p > 0.2) {
          const dp = Math.min(1, (p - 0.2) / 0.8)
          const blobCount = Math.floor(dp * 15)
          for (let i = 0; i < blobCount; i++) {
            const angle = (i / 15) * Math.PI * 2 + dp * 3
            const dist = baseR * (0.5 + dp * 0.6)
            const bx = cx + Math.cos(angle * 1.3 + i * 0.5) * dist
            const by = cy + Math.sin(angle * 1.3 + i * 0.5) * dist
            const br = 1 + dp * 4
            ctx.beginPath()
            ctx.arc(bx, by, br, 0, Math.PI * 2)
            ctx.fillStyle = `${INK}${(alpha * 0.3 * (1 - dp * 0.5)).toFixed(3)})`
            ctx.fill()
          }
        }
      },
    },
  )

  return () => {
    running = false
  }
}

// ---------------------------------------------------------------------------
// 4. inkFlow — ink flows along paper texture direction
// ---------------------------------------------------------------------------

const effectInkFlow: EffectFn = (ctx, w, h, cx, cy) => {
  const flowPaths = Array.from({ length: 12 }, (_, i) => ({
    angle: -0.3 + (i / 12) * 0.6 + (Math.random() - 0.5) * 0.15,
    length: 0.3 + Math.random() * 0.7,
    offset: (Math.random() - 0.5) * w * 0.15,
    delay: Math.random() * 0.3,
    width: 1 + Math.random() * 3,
  }))
  let running = true

  const anim = animate(
    { p: 0 },
    {
      p: [0, 1],
      duration: 12000,
      easing: 'easeInOutQuad',
      update: (a) => {
        if (!running) return
        const p = a.p as number
        ctx.clearRect(0, 0, w, h)

        for (const fp of flowPaths) {
          const fp0 = Math.max(0, Math.min(1, (p - fp.delay) / (1 - fp.delay)))
          if (fp0 <= 0) continue
          const fpLen = fp.length * h * 0.5 * easeOutCubic(fp0)
          const alpha = 0.06 * easeOutQuad(fp0) * (1 - fp0 * 0.7)
          const width = fp.width * (1 - fp0 * 0.4)

          const sx = cx + fp.offset
          const sy = cy - fpLen * 0.3
          const ex = cx + fp.offset + Math.sin(fp.angle) * fpLen
          const ey = cy + fpLen * 0.7

          // Draw with slight curve
          ctx.beginPath()
          const cpx = (sx + ex) / 2 + Math.sin(fp.angle + p) * 20
          const cpy = (sy + ey) / 2 + 10
          ctx.moveTo(sx, sy)
          ctx.quadraticCurveTo(cpx, cpy, ex, ey)
          ctx.strokeStyle = `${INK}${alpha.toFixed(3)})`
          ctx.lineWidth = width
          ctx.lineCap = 'round'
          ctx.stroke()

          // Faint trail behind main flow
          if (fp0 > 0.1) {
            const trailAlpha = alpha * 0.3
            ctx.beginPath()
            ctx.moveTo(sx, sy)
            ctx.quadraticCurveTo(cpx + 5, cpy + 5, ex - fpLen * 0.1, ey - fpLen * 0.1)
            ctx.strokeStyle = `${INK}${trailAlpha.toFixed(3)})`
            ctx.lineWidth = width * 0.5
            ctx.stroke()
          }
        }

        // Central pool
        if (p > 0.1) {
          const poolR = Math.min(w, h) * 0.04 * easeOutQuad(Math.min(p / 0.4, 1))
          const poolAlpha = 0.10 * (1 - easeOutQuad(Math.min(p / 0.5, 1)))
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, poolR)
          g.addColorStop(0, `${INK}${Math.min(poolAlpha * 2, 0.22).toFixed(3)})`)
          g.addColorStop(1, `${INK}0)`)
          ctx.beginPath()
          ctx.arc(cx, cy, poolR, 0, Math.PI * 2)
          ctx.fillStyle = g
          ctx.fill()
        }
      },
    },
  )

  return () => {
    running = false
  }
}

// ---------------------------------------------------------------------------
// 5. inkStroke — brush stroke effect
// ---------------------------------------------------------------------------

const effectInkStroke: EffectFn = (ctx, w, h, cx, cy) => {
  // Generate a stroke path (slightly curved)
  const pts = Array.from({ length: 60 }, (_, i) => {
    const t = i / 59
    const x = cx - 80 + t * 160 + Math.sin(t * Math.PI * 2) * 30
    const y = cy - 60 + t * 120 + Math.cos(t * Math.PI * 1.5) * 20
    const width = 2 + Math.sin(t * Math.PI) * 6 + Math.sin(t * Math.PI * 3) * 2
    return { x, y, width }
  })
  let running = true

  const anim = animate(
    { p: 0 },
    {
      p: [0, 1],
      duration: 6000,
      easing: 'easeInOutQuad',
      update: (a) => {
        if (!running) return
        const p = a.p as number
        ctx.clearRect(0, 0, w, h)

        const visibleCount = Math.floor(p * pts.length)

        // Draw stroke segment by segment
        for (let i = 1; i < visibleCount; i++) {
          const prev = pts[i - 1]
          const curr = pts[i]
          const alpha = 0.15 * (1 - i / pts.length * 0.4)
          ctx.beginPath()
          ctx.moveTo(prev.x, prev.y)
          ctx.lineTo(curr.x, curr.y)
          ctx.strokeStyle = `${INK}${alpha.toFixed(3)})`
          ctx.lineWidth = curr.width
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          ctx.stroke()
        }

        // Ink pooling at stroke tip
        if (visibleCount > 0) {
          const tip = pts[Math.min(visibleCount, pts.length - 1)]
          const tipR = 3 + p * 8
          const tipAlpha = 0.06 * (1 - 0.5 * (visibleCount / pts.length))
          const g = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, tipR)
          g.addColorStop(0, `${INK}${Math.min(tipAlpha * 2, 0.15).toFixed(3)})`)
          g.addColorStop(1, `${INK}0)`)
          ctx.beginPath()
          ctx.arc(tip.x, tip.y, tipR, 0, Math.PI * 2)
          ctx.fillStyle = g
          ctx.fill()
        }

        // Subtle splatter near stroke
        if (p > 0.3) {
          const sp = Math.min(1, (p - 0.3) / 0.7)
          const splatterCount = Math.floor(sp * 8)
          for (let i = 0; i < splatterCount; i++) {
            const idx = Math.floor(Math.random() * visibleCount)
            if (idx >= pts.length) continue
            const pt = pts[idx]
            const offAngle = Math.random() * Math.PI * 2
            const offDist = 3 + Math.random() * 12
            const sx = pt.x + Math.cos(offAngle) * offDist
            const sy = pt.y + Math.sin(offAngle) * offDist
            const sr = 0.5 + Math.random() * 2
            ctx.beginPath()
            ctx.arc(sx, sy, sr, 0, Math.PI * 2)
            ctx.fillStyle = `${INK}${(0.08 * (1 - sp * 0.5)).toFixed(3)})`
            ctx.fill()
          }
        }
      },
    },
  )

  return () => {
    running = false
  }
}

// ---------------------------------------------------------------------------
// 6. inkBreathe — depth breathing pulse (4s loop)
// ---------------------------------------------------------------------------

const effectInkBreathe: EffectFn = (ctx, w, h, cx, cy) => {
  const baseR = Math.min(w, h) * 0.06
  let running = true

  const anim = animate(
    { p: 0 },
    {
      p: [0, 1],
      duration: 4000,
      loop: true,
      easing: 'easeInOutSine',
      update: (a) => {
        if (!running) return
        const p = a.p as number
        ctx.clearRect(0, 0, w, h)

        // Smooth breathing: slow inhale, gentle exhale using sine
        const breath = Math.sin(p * Math.PI * 2)
        const r = baseR * (1 + 0.20 * breath)
        const alpha = 0.12 * (1 - 0.25 * breath)

        // Main breathing blob
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
        g.addColorStop(0, `${INK}${Math.min(alpha * 2.5, 0.20).toFixed(3)})`)
        g.addColorStop(0.5, `${INK}${alpha.toFixed(3)})`)
        g.addColorStop(1, `${INK}0)`)
        organicCircle(ctx, cx, cy, r, 0.06, p * 10)
        ctx.fillStyle = g
        ctx.fill()

        // Secondary pulsing aura
        const auraR = r * 1.6
        const auraAlpha = alpha * 0.3 * (1 - 0.15 * Math.sin(p * Math.PI * 2 + 0.5))
        const g2 = ctx.createRadialGradient(cx, cy, r, cx, cy, auraR)
        g2.addColorStop(0, `${INK}${auraAlpha.toFixed(3)})`)
        g2.addColorStop(1, `${INK}0)`)
        ctx.beginPath()
        ctx.arc(cx, cy, auraR, 0, Math.PI * 2)
        ctx.fillStyle = g2
        ctx.fill()
      },
    },
  )

  return () => {
    running = false
  }
}

// ---------------------------------------------------------------------------
// 7. inkSpin — slow ink vortex rotation (12s loop)
// ---------------------------------------------------------------------------

const effectInkSpin: EffectFn = (ctx, w, h, cx, cy) => {
  const maxR = Math.min(w, h) * 0.14
  const arms = 3
  let running = true

  const anim = animate(
    { p: 0 },
    {
      p: [0, 1],
      duration: 12000,
      loop: true,
      easing: 'linear',
      update: (a) => {
        if (!running) return
        const p = a.p as number
        ctx.clearRect(0, 0, w, h)

        const angle = p * Math.PI * 2

        // Draw spiral arms
        for (let arm = 0; arm < arms; arm++) {
          const armOffset = (arm / arms) * Math.PI * 2
          const segments = 80
          ctx.beginPath()
          for (let i = 0; i <= segments; i++) {
            const t = i / segments
            const r = maxR * easeOutCubic(t)
            const a = armOffset + angle * 1.5 + t * Math.PI * 4
            const px = cx + Math.cos(a) * r
            const py = cy + Math.sin(a) * r
            if (i === 0) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
          }
          const armAlpha = 0.07 * (1 - 0.3 * Math.sin(angle + arm))
          ctx.strokeStyle = `${INK}${armAlpha.toFixed(3)})`
          ctx.lineWidth = 2 + Math.sin(angle * 0.5 + arm) * 0.5
          ctx.stroke()
        }

        // Core glow
        const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.25)
        coreGrad.addColorStop(0, `${INK}0.18)`)
        coreGrad.addColorStop(1, `${INK}0)`)
        ctx.beginPath()
        ctx.arc(cx, cy, maxR * 0.25, 0, Math.PI * 2)
        ctx.fillStyle = coreGrad
        ctx.fill()

        // Outer haze
        const hazeGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR)
        hazeGrad.addColorStop(0.6, `${INK}${(0.04 * (1 - 0.2 * Math.sin(angle * 0.7))).toFixed(3)})`)
        hazeGrad.addColorStop(1, `${INK}0)`)
        ctx.beginPath()
        ctx.arc(cx, cy, maxR, 0, Math.PI * 2)
        ctx.fillStyle = hazeGrad
        ctx.fill()
      },
    },
  )

  return () => {
    running = false
  }
}

// ---------------------------------------------------------------------------
// 8. inkFade — ink gradually fades away (8s)
// ---------------------------------------------------------------------------

const effectInkFade: EffectFn = (ctx, w, h, cx, cy) => {
  // Pre-generate ink marks
  interface InkMark {
    x: number
    y: number
    r: number
    alpha: number
    phase: number
    delay: number
  }
  const marks: InkMark[] = Array.from({ length: 25 }, () => ({
    x: cx + (Math.random() - 0.5) * Math.min(w, h) * 0.15,
    y: cy + (Math.random() - 0.5) * Math.min(w, h) * 0.15,
    r: 2 + Math.random() * 30,
    alpha: 0.06 + Math.random() * 0.08,
    phase: Math.random() * Math.PI * 2,
    delay: Math.random() * 0.3,
  }))
  let running = true

  const anim = animate(
    { p: 0 },
    {
      p: [0, 1],
      duration: 8000,
      easing: 'easeInQuad',
      update: (a) => {
        if (!running) return
        const p = a.p as number
        ctx.clearRect(0, 0, w, h)

        for (const m of marks) {
          const mp = Math.max(0, Math.min(1, (p - m.delay) / (1 - m.delay)))
          if (mp <= 0) continue
          // Appear then fade
          const appear = Math.min(mp / 0.2, 1)
          const fade = Math.max(0, (mp - 0.3) / 0.7)
          const currentAlpha = m.alpha * appear * (1 - easeOutQuad(fade))

          if (currentAlpha <= 0.001) continue

          // Slight drift while fading
          const driftX = Math.sin(m.phase + mp * 2) * mp * 5
          const driftY = Math.cos(m.phase + mp * 1.3) * mp * 5

          // Main mark
          const g = ctx.createRadialGradient(
            m.x + driftX, m.y + driftY, 0,
            m.x + driftX, m.y + driftY, m.r,
          )
          g.addColorStop(0, `${INK}${Math.min(currentAlpha * 2, 0.18).toFixed(3)})`)
          g.addColorStop(1, `${INK}0)`)
          ctx.beginPath()
          ctx.arc(m.x + driftX, m.y + driftY, m.r, 0, Math.PI * 2)
          ctx.fillStyle = g
          ctx.fill()
        }

        // Large central pool (slowest to fade)
        const poolAlpha = 0.10 * Math.min(1, p / 0.15) * (1 - easeOutQuad(Math.max(0, (p - 0.4) / 0.6)))
        if (poolAlpha > 0.001) {
          const poolR = Math.min(w, h) * 0.06
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, poolR)
          g.addColorStop(0, `${INK}${Math.min(poolAlpha * 2, 0.16).toFixed(3)})`)
          g.addColorStop(1, `${INK}0)`)
          ctx.beginPath()
          ctx.arc(cx, cy, poolR, 0, Math.PI * 2)
          ctx.fillStyle = g
          ctx.fill()
        }
      },
    },
  )

  return () => {
    running = false
  }
}

// ---------------------------------------------------------------------------
// 9. inkParticles — fine ink particles floating (15s loop)
// ---------------------------------------------------------------------------

const effectInkParticles: EffectFn = (ctx, w, h, cx, cy) => {
  const particles = createParticles(80, w, h, 0.5)
  let running = true
  let time = 0

  const anim = animate(
    { p: 0 },
    {
      p: [0, 1],
      duration: 15000,
      loop: true,
      easing: 'linear',
      update: (a) => {
        if (!running) return
        const p = a.p as number
        time = p
        ctx.clearRect(0, 0, w, h)

        for (let i = 0; i < particles.length; i++) {
          const pt = particles[i]

          // Brownian motion
          pt.x += pt.vx + Math.sin(time * 0.5 + pt.phase) * 0.05
          pt.y += pt.vy + Math.cos(time * 0.3 + pt.phase * 1.3) * 0.05

          // Gentle oscillation
          pt.x += Math.sin(time * 0.7 + pt.phase * 2) * 0.03
          pt.y += Math.cos(time * 0.5 + pt.phase * 1.7) * 0.03

          // Keep within bounds
          const maxDist = Math.min(w, h) * 0.25
          const dx = pt.x
          const dy = pt.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist > maxDist) {
            pt.x *= 0.98
            pt.y *= 0.98
          }

          // Opacity oscillates for twinkle effect
          const twinkle = 0.6 + 0.4 * Math.sin(time * 2 + pt.phase * 3)
          const alpha = 0.06 * pt.life * twinkle
          const size = pt.size * (0.8 + 0.2 * Math.sin(time * 0.5 + pt.phase))

          ctx.beginPath()
          ctx.arc(cx + pt.x, cy + pt.y, size, 0, Math.PI * 2)
          ctx.fillStyle = `${INK}${alpha.toFixed(3)})`
          ctx.fill()
        }

        // Very faint central glow
        const glowR = Math.min(w, h) * 0.08
        const glowAlpha = 0.02 + 0.01 * Math.sin(time * 1.5)
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR)
        g.addColorStop(0, `${INK}${glowAlpha.toFixed(3)})`)
        g.addColorStop(1, `${INK}0)`)
        ctx.beginPath()
        ctx.arc(cx, cy, glowR, 0, Math.PI * 2)
        ctx.fillStyle = g
        ctx.fill()
      },
    },
  )

  return () => {
    running = false
  }
}

// ---------------------------------------------------------------------------
// 10. inkRipple — ink drop ripples on water surface
// ---------------------------------------------------------------------------

const effectInkRipple: EffectFn = (ctx, w, h, cx, cy) => {
  const maxR = Math.min(w, h) * 0.20
  const ringCount = 5
  let running = true

  const anim = animate(
    { p: 0 },
    {
      p: [0, 1],
      duration: 6000,
      easing: 'easeInOutQuad',
      update: (a) => {
        if (!running) return
        const p = a.p as number
        ctx.clearRect(0, 0, w, h)

        // Drop impact at center
        const impactAlpha = 0.14 * (1 - easeOutQuad(Math.min(p / 0.2, 1)))
        if (impactAlpha > 0.001) {
          const impactR = 3 + p * 15
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, impactR)
          g.addColorStop(0, `${INK}${Math.min(impactAlpha * 2, 0.20).toFixed(3)})`)
          g.addColorStop(1, `${INK}0)`)
          ctx.beginPath()
          ctx.arc(cx, cy, impactR, 0, Math.PI * 2)
          ctx.fillStyle = g
          ctx.fill()
        }

        // Expanding ripples
        for (let ring = 0; ring < ringCount; ring++) {
          const ringDelay = ring * 0.07
          const rp = Math.max(0, Math.min(1, (p - ringDelay) / (1 - ringDelay)))
          if (rp <= 0) continue

          const ringR = maxR * easeOutQuad(rp)
          const ringWidth = 1.5 * (1 - rp * 0.7)
          const ringAlpha = 0.08 * (1 - rp) * Math.sin(rp * Math.PI)

          if (ringAlpha <= 0.001) continue

          // Ring with organic waviness
          ctx.beginPath()
          const segs = 48
          for (let i = 0; i <= segs; i++) {
            const a = (i / segs) * Math.PI * 2
            const wave = 1 + 0.02 * Math.sin(a * ring * 3 + rp * 8)
            const rr = ringR * wave
            const px = cx + Math.cos(a) * rr
            const py = cy + Math.sin(a) * rr
            if (i === 0) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
          }
          ctx.closePath()
          ctx.strokeStyle = `${INK}${ringAlpha.toFixed(3)})`
          ctx.lineWidth = ringWidth
          ctx.stroke()
        }

        // Final spreading pool
        if (p > 0.5) {
          const poolP = (p - 0.5) / 0.5
          const poolR = maxR * 0.8 * easeOutQuad(poolP)
          const poolAlpha = 0.04 * (1 - easeOutQuad(poolP))
          if (poolAlpha > 0.001) {
            const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, poolR)
            g.addColorStop(0, `${INK}${poolAlpha.toFixed(3)})`)
            g.addColorStop(1, `${INK}0)`)
            ctx.beginPath()
            ctx.arc(cx, cy, poolR, 0, Math.PI * 2)
            ctx.fillStyle = g
            ctx.fill()
          }
        }
      },
    },
  )

  return () => {
    running = false
  }
}

// ===========================================================================
// Effect registry
// ===========================================================================

const EFFECTS: Record<string, EffectFn> = {
  inkDrop: effectInkDrop,
  inkBloom: effectInkBloom,
  inkSpread: effectInkSpread,
  inkFlow: effectInkFlow,
  inkStroke: effectInkStroke,
  inkBreathe: effectInkBreathe,
  inkSpin: effectInkSpin,
  inkFade: effectInkFade,
  inkParticles: effectInkParticles,
  inkRipple: effectInkRipple,
}

// ===========================================================================
// Component
// ===========================================================================

export function InkEngine({
  trigger = false,
  effect = 'none',
  x = 0.5,
  y = 0.5,
}: InkEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const prevTriggerRef = useRef(false)
  const prevEffectRef = useRef(effect)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const triggerEdge = trigger && !prevTriggerRef.current
    const effectChanged = effect !== prevEffectRef.current

    prevTriggerRef.current = trigger
    prevEffectRef.current = effect

    // Run effect when trigger fires OR when effect changes while triggered
    const shouldRun = trigger && effect !== 'none' && (triggerEdge || effectChanged)
    if (!shouldRun) return

    // Cleanup previous
    cleanupRef.current?.()
    cleanupRef.current = null

    // Setup canvas
    const ctx = initCanvas(canvas)
    const w = window.innerWidth
    const h = window.innerHeight
    const cx = x * w
    const cy = y * h

    // Look up effect
    const runner = EFFECTS[effect]
    if (!runner) return

    // Run
    cleanupRef.current = runner(ctx, w, h, cx, cy)
  }, [trigger, effect, x, y])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      cleanupRef.current?.()
    }
  }, [])

  return <canvas ref={canvasRef} className={CANVAS_CLASS} />
}
