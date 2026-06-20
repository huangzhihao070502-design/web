import { useEffect, useRef } from 'react'

export default function PaperTexture() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    // Generate very subtle paper noise (barely visible)
    const imageData = ctx.createImageData(canvas.width, canvas.height)
    const data = imageData.data
    for (let i = 0; i < data.length; i += 4) {
      const noise = Math.random() * 6 - 3
      data[i] = 248 + noise
      data[i + 1] = 248 + noise
      data[i + 2] = 246 + noise
      data[i + 3] = 4 // ~1.5% opacity
    }
    ctx.putImageData(imageData, 0, 0)

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      const imgData = ctx.createImageData(canvas.width, canvas.height)
      const d = imgData.data
      for (let i = 0; i < d.length; i += 4) {
        const noise = Math.random() * 6 - 3
        d[i] = 248 + noise
        d[i + 1] = 248 + noise
        d[i + 2] = 246 + noise
        d[i + 3] = 4
      }
      ctx.putImageData(imgData, 0, 0)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50"
      style={{ mixBlendMode: 'multiply' }}
    />
  )
}
