import { useEffect, useRef } from 'react'

const CHARS = '01アイウエオカキクケコサシスセソBEAMUDabcdefghijklmnopqrstuvwxyz<>{}[]|/\\#@$%^&*+=~'.split('')
const PARTICLE_COUNT = 480

function randomChar() {
  return CHARS[Math.floor(Math.random() * CHARS.length)]
}

function randomGreen() {
  return Math.floor(Math.random() * 120 + 135) // 135-255
}

export default function ParticleBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    let particles = []
    let bPositions = []
    let isHovering = false
    let animFrameId = null
    let offCanvas = null
    let offCtx = null
    let wasHovering = false

    // ── Muestrear píxeles de la B en un canvas oculto ──────────────────
    function buildBShape(w, h) {
      offCanvas = document.createElement('canvas')
      offCanvas.width = w
      offCanvas.height = h
      offCtx = offCanvas.getContext('2d', { willReadFrequently: true })

      const fontSize = Math.min(w, h) * 0.58
      offCtx.clearRect(0, 0, w, h)
      offCtx.font = `900 ${fontSize}px 'Arial Black', Arial, sans-serif`
      offCtx.textAlign = 'center'
      offCtx.textBaseline = 'middle'
      offCtx.fillStyle = 'white'
      offCtx.fillText('B', w / 2, h / 2)

      const imgData = offCtx.getImageData(0, 0, w, h)
      const positions = []
      const step = 7

      for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
          if (imgData.data[(y * w + x) * 4 + 3] > 128) {
            positions.push({ x, y })
          }
        }
      }

      return positions
    }

    function isOverB(mx, my) {
      if (!offCtx || mx < 0 || my < 0 || mx >= offCanvas.width || my >= offCanvas.height) return false
      const px = offCtx.getImageData(Math.round(mx), Math.round(my), 1, 1).data
      return px[3] > 50
    }

    // ── Inicializar partículas ──────────────────────────────────────────
    function initParticles(w, h) {
      particles = []
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const t = bPositions[Math.floor(Math.random() * bPositions.length)] ?? { x: w / 2, y: h / 2 }
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 1.4,
          vy: (Math.random() - 0.5) * 1.4,
          char: randomChar(),
          size: Math.floor(Math.random() * 7 + 9),  // 9-15px
          alpha: Math.random() * 0.45 + 0.15,
          targetX: t.x,
          targetY: t.y,
          changeTimer: Math.floor(Math.random() * 90),
          green: randomGreen(),
          brightness: Math.random() * 0.6 + 0.4,
        })
      }
    }

    // ── Reasignar targets al redimensionar ─────────────────────────────
    function reassignTargets() {
      particles.forEach(p => {
        const t = bPositions[Math.floor(Math.random() * bPositions.length)]
        if (t) { p.targetX = t.x; p.targetY = t.y }
      })
    }

    // ── Resize ─────────────────────────────────────────────────────────
    function resize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      bPositions = buildBShape(canvas.width, canvas.height)
      reassignTargets()
    }

    // ── Loop de animación ──────────────────────────────────────────────
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Silueta de la B con iluminación interna en capas
      const guideSize = Math.min(canvas.width, canvas.height) * 0.58
      const cx = canvas.width / 2
      const cy = canvas.height / 2
      ctx.save()
      ctx.font = `900 ${guideSize}px 'Arial Black', Arial, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // Capa 1 – halo exterior amplio
      ctx.shadowColor = '#00ff41'
      ctx.shadowBlur = 80
      ctx.fillStyle = 'rgba(0,255,65,0.04)'
      ctx.fillText('B', cx, cy)

      // Capa 2 – glow medio
      ctx.shadowBlur = 40
      ctx.fillStyle = 'rgba(0,255,65,0.07)'
      ctx.fillText('B', cx, cy)

      // Capa 3 – núcleo interior más nítido
      ctx.shadowBlur = 15
      ctx.fillStyle = 'rgba(0,255,65,0.13)'
      ctx.fillText('B', cx, cy)

      // Capa 4 – contorno brillante
      ctx.shadowBlur = 8
      ctx.strokeStyle = 'rgba(0,255,65,0.35)'
      ctx.lineWidth = 1.2
      ctx.strokeText('B', cx, cy)

      ctx.restore()

      // Detectar transición hover -> no-hover para dar impulso de dispersión
      if (wasHovering && !isHovering) {
        particles.forEach(p => {
          const angle = Math.random() * Math.PI * 2
          const speed = Math.random() * 2.5 + 0.5
          p.vx = Math.cos(angle) * speed
          p.vy = Math.sin(angle) * speed
        })
      }
      wasHovering = isHovering

      particles.forEach(p => {
        if (isHovering) {
          // Converger hacia la B
          p.x += (p.targetX - p.x) * 0.09
          p.y += (p.targetY - p.y) * 0.09
          p.vx *= 0.85
          p.vy *= 0.85
          p.alpha = Math.min(p.alpha + 0.04, p.brightness)
        } else {
          // Flotar libremente
          p.x += p.vx
          p.y += p.vy

          // Wrap edges
          if (p.x < -30) p.x = canvas.width + 30
          else if (p.x > canvas.width + 30) p.x = -30
          if (p.y < -30) p.y = canvas.height + 30
          else if (p.y > canvas.height + 30) p.y = -30

          p.changeTimer--
          if (p.changeTimer <= 0) {
            p.char = randomChar()
            p.changeTimer = Math.floor(Math.random() * 80 + 40)
          }
        }

        ctx.save()
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = `rgb(0,${p.green},55)`
        ctx.font = `${p.size}px monospace`
        ctx.fillText(p.char, p.x, p.y)
        ctx.restore()
      })

      animFrameId = requestAnimationFrame(animate)
    }

    // ── Eventos ────────────────────────────────────────────────────────
    function onMouseMove(e) {
      const r = canvas.getBoundingClientRect()
      isHovering = isOverB(e.clientX - r.left, e.clientY - r.top)
    }

    function onMouseLeave() {
      isHovering = false
    }

    // ── Arranque ───────────────────────────────────────────────────────
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    bPositions = buildBShape(canvas.width, canvas.height)
    initParticles(canvas.width, canvas.height)
    animate()

    window.addEventListener('resize', resize)
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseleave', onMouseLeave)

    return () => {
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseleave', onMouseLeave)
      cancelAnimationFrame(animFrameId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0"
      style={{ width: '100%', height: '100%', cursor: 'default' }}
    />
  )
}
