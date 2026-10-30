import { useEffect, useRef } from 'react'
import { subscribeTheme, useTheme } from '@/components/theme-context'
import { usePrefersReducedMotion } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

interface Node {
  x: number
  y: number
  z: number
  accent: boolean
}

function fibonacciSphere(count: number, radius: number): Node[] {
  const nodes: Node[] = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2
    const ringRadius = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    nodes.push({
      x: Math.cos(theta) * ringRadius * radius,
      y: y * radius,
      z: Math.sin(theta) * ringRadius * radius,
      accent: i % 5 === 0,
    })
  }
  return nodes
}

/**
 * A slowly rotating 3D point cloud with links between nearby nodes — the brand
 * mark's "neural" idea in motion. Dependency-free: real perspective projection
 * on a 2D canvas, with precomputed links so each frame stays cheap.
 *
 * Pauses when off-screen, when the tab is hidden, and renders a single static
 * frame under reduced motion.
 */
export function NeuralField({
  className,
  nodes = 82,
  linkDistance = 78,
  speed = 1,
}: {
  className?: string
  nodes?: number
  linkDistance?: number
  speed?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const reduced = usePrefersReducedMotion()
  useTheme()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const radius = 120
    const cloud = fibonacciSphere(nodes, radius)
    const links: [number, number][] = []
    for (let i = 0; i < cloud.length; i += 1) {
      for (let j = i + 1; j < cloud.length; j += 1) {
        const a = cloud[i]!
        const b = cloud[j]!
        const dx = a.x - b.x
        const dy = a.y - b.y
        const dz = a.z - b.z
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) < linkDistance) links.push([i, j])
      }
    }

    // Re-read on theme change: the palette is a set of CSS variables, so a
    // cached copy would draw dark-theme greys onto a light background.
    let primary = ''
    let accent = ''
    let faint = ''
    const readPalette = () => {
      const styles = getComputedStyle(document.documentElement)
      primary = styles.getPropertyValue('--primary').trim()
      accent = styles.getPropertyValue('--signal-strong').trim()
      faint = styles.getPropertyValue('--muted-foreground').trim()
    }
    readPalette()

    let width = 0
    let height = 0
    let dpr = 1
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = rect.width
      height = rect.height
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    const focal = 420
    let angleY = -0.4
    let angleX = -0.18
    let tiltTargetX = 0
    let tiltTargetY = 0
    let tiltX = 0
    let tiltY = 0
    let raf = 0
    let visible = true

    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      const cx = width / 2
      const cy = height / 2
      const scale = Math.min(width, height) / 380

      tiltX += (tiltTargetX - tiltX) * 0.06
      tiltY += (tiltTargetY - tiltY) * 0.06
      const ay = angleY + tiltY
      const ax = angleX + tiltX

      const cosY = Math.cos(ay)
      const sinY = Math.sin(ay)
      const cosX = Math.cos(ax)
      const sinX = Math.sin(ax)

      const projected = cloud.map((node) => {
        // rotate Y then X
        const x1 = node.x * cosY - node.z * sinY
        const z1 = node.x * sinY + node.z * cosY
        const y2 = node.y * cosX - z1 * sinX
        const z2 = node.y * sinX + z1 * cosX
        const depth = focal / (focal + z2)
        return {
          sx: cx + x1 * depth * scale,
          sy: cy + y2 * depth * scale,
          depth,
          z: z2,
          accent: node.accent,
        }
      })

      ctx.lineWidth = 1
      for (const [i, j] of links) {
        const a = projected[i]!
        const b = projected[j]!
        const depth = (a.depth + b.depth) / 2
        const alpha = Math.max(0, (depth - 0.72) * 0.5)
        if (alpha <= 0.01) continue
        ctx.globalAlpha = alpha
        ctx.strokeStyle = faint
        ctx.beginPath()
        ctx.moveTo(a.sx, a.sy)
        ctx.lineTo(b.sx, b.sy)
        ctx.stroke()
      }

      for (const point of projected) {
        const size = Math.max(0.6, point.depth * 2.1)
        ctx.globalAlpha = Math.max(0.08, (point.depth - 0.6) * 1.5)
        ctx.fillStyle = point.accent ? accent : primary
        ctx.beginPath()
        ctx.arc(point.sx, point.sy, size, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    const loop = () => {
      angleY += 0.0022 * speed
      angleX = -0.18 + Math.sin(angleY * 0.6) * 0.12
      draw()
      raf = requestAnimationFrame(loop)
    }

    const start = () => {
      if (raf || !visible || document.hidden || reduced) return
      raf = requestAnimationFrame(loop)
    }
    const stop = () => {
      if (raf) cancelAnimationFrame(raf)
      raf = 0
    }

    const onPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      tiltTargetY = ((event.clientX - rect.left) / rect.width - 0.5) * 0.6
      tiltTargetX = ((event.clientY - rect.top) / rect.height - 0.5) * -0.35
    }

    const onVisibility = () => {
      if (document.hidden) stop()
      else start()
    }

    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries.some((entry) => entry.isIntersecting)
        if (visible) start()
        else stop()
      },
      { threshold: 0 },
    )
    observer.observe(canvas)

    const resizeObserver = new ResizeObserver(() => {
      resize()
      if (reduced) draw()
    })
    resizeObserver.observe(canvas)

    // Subscribe to the same external theme snapshot used by React components.
    const unsubscribeTheme = subscribeTheme(() => {
      readPalette()
      draw()
    })


    window.addEventListener('pointermove', onPointer, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)

    draw()
    start()

    return () => {
      stop()
      observer.disconnect()
      resizeObserver.disconnect()
      unsubscribeTheme()
      window.removeEventListener('pointermove', onPointer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [nodes, linkDistance, speed, reduced])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn('pointer-events-none size-full', className)}
    />
  )
}
