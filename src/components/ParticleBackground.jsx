import { useEffect, useRef } from 'react'

const CHARS = '01アイウエオカキクケコサシスセソBEAMUDabcdefghijklmnopqrstuvwxyz<>{}[]|/\\#@$%^&*+=~'.split('')
const PARTICLE_COUNT = 900
const PARTICLE_COUNT_SMALL = 800
const BREAKPOINT = 768

const HOVER_CONVERGENCE = 0.06
const HOVER_MOUSE_FOLLOW = 0.02
const FLOAT_AMPLITUDE = 0.2
const EMIT_SPEED_THRESHOLD = 1
const EMIT_PROBABILITY = 0.018
const EMIT_FORCE = 0.05
const EMIT_VEL_DECAY = 0.88
const GLOW_OPACITY_MIN = 0.05
const GLOW_OPACITY_MAX = 0.25
const GLOW_BREATH_SPEED = 0.03
const GLOW_OPACITY_HOVER = 0.7
const GLOW_BLUR = 10
const GLOW_BLUR_HOVER = 40
const HOVER_LINGER = 180
const CIRCLE_RADIUS = 0.72

function randomChar() {
  return CHARS[Math.floor(Math.random() * CHARS.length)]
}

const BLUE_PALETTE = [
  '#1a4fff', '#0077ff', '#00aaff', '#0ef',
  '#1230cc', '#3366ff', '#00cfff', '#5599ff',
]

function randomBlue() {
  return BLUE_PALETTE[Math.floor(Math.random() * BLUE_PALETTE.length)]
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
    let lingerTimer = HOVER_LINGER
    let glowCanvas = null
    let currentGlowOpacity = GLOW_OPACITY_MIN
    let currentGlowBlur = 0
    let breathPhase = 0
    let mouseX = 0
    let mouseY = 0
    let mouseDX = 0
    let mouseDY = 0
    let prevMouseX = 0
    let prevMouseY = 0

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

    let glowCanvasHover = null

    function createGlowCanvas(w, h, blur) {
      const gc = document.createElement('canvas')
      gc.width = w
      gc.height = h
      const gCtx = gc.getContext('2d')
      const fontSize = Math.min(w, h) * 0.58
      const cx = w / 2
      const cy = h / 2
      gCtx.font = `900 ${fontSize}px 'Arial Black', Arial, sans-serif`
      gCtx.textAlign = 'center'
      gCtx.textBaseline = 'middle'
      gCtx.filter = `blur(${blur}px)`
      gCtx.fillStyle = 'rgba(30,100,220,0.18)'
      gCtx.fillText('B', cx, cy)
      gCtx.filter = `blur(${blur * 0.5}px)`
      gCtx.fillStyle = 'rgba(50,120,255,0.16)'
      gCtx.fillText('B', cx, cy)
      const radGrad = gCtx.createRadialGradient(cx, cy, 0, cx, cy, fontSize * 0.18)
      radGrad.addColorStop(0, 'rgba(150,200,255,0.22)')
      radGrad.addColorStop(0.4, 'rgba(50,130,255,0.14)')
      radGrad.addColorStop(0.8, 'rgba(20,70,200,0.07)')
      radGrad.addColorStop(1, 'rgba(0,20,80,0.0)')
      gCtx.filter = `blur(${blur * 0.25}px)`
      gCtx.fillStyle = radGrad
      gCtx.fillText('B', cx, cy)
      gCtx.filter = 'none'
      return gc
    }

    function buildBGlow(w, h) {
      glowCanvas = createGlowCanvas(w, h, GLOW_BLUR)
      glowCanvasHover = createGlowCanvas(w, h, GLOW_BLUR_HOVER)
    }

    function initParticles(w, h) {
      particles = []
      const count = w <= BREAKPOINT ? PARTICLE_COUNT_SMALL : PARTICLE_COUNT
      for (let i = 0; i < count; i++) {
        const t = bPositions[Math.floor(Math.random() * bPositions.length)] ?? { x: w / 2, y: h / 2 }
        particles.push({
          x: t.x,
          y: t.y,
          vx: Math.cos(Math.random() * Math.PI * 2) * (Math.random() * 2.5 + 0.5),
          vy: Math.sin(Math.random() * Math.PI * 2) * (Math.random() * 2.5 + 0.5),
          char: randomChar(),
          size: Math.floor(Math.random() * 7 + 9),
          alpha: Math.random() * 0.45 + 0.15,
          targetX: t.x,
          targetY: t.y,
          changeTimer: Math.floor(Math.random() * 90),
          color: randomBlue(),
          brightness: Math.random() * 0.6 + 0.4,
          phase: Math.random() * Math.PI * 2,
          phaseSpeed: Math.random() * 0.025 + 0.008,
          floatR: Math.random() * 2.5 + 1,
        })
      }
    }

    function reassignTargets() {
      particles.forEach(p => {
        const t = bPositions[Math.floor(Math.random() * bPositions.length)]
        if (t) {
          p.targetX = t.x
          p.targetY = t.y
          p.x = t.x
          p.y = t.y
          p.vx = (Math.random() - 0.5) * 1.4
          p.vy = (Math.random() - 0.5) * 1.4
        }
      })
    }

    function resize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      bPositions = buildBShape(canvas.width, canvas.height)
      buildBGlow(canvas.width, canvas.height)
      initParticles(canvas.width, canvas.height)
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      breathPhase += GLOW_BREATH_SPEED
      const breathOpacity = GLOW_OPACITY_MIN + (Math.sin(breathPhase) * 0.5 + 0.5) * (GLOW_OPACITY_MAX - GLOW_OPACITY_MIN)
      const targetOpacity = isHovering ? GLOW_OPACITY_HOVER : breathOpacity
      currentGlowOpacity += (targetOpacity - currentGlowOpacity) * 0.05
      currentGlowBlur += ((isHovering ? 1 : 0) - currentGlowBlur) * 0.05
      if (glowCanvas && glowCanvasHover) {
        ctx.globalAlpha = currentGlowOpacity * (1 - currentGlowBlur)
        ctx.drawImage(glowCanvas, 0, 0)
        ctx.globalAlpha = currentGlowOpacity * currentGlowBlur
        ctx.drawImage(glowCanvasHover, 0, 0)
        ctx.globalAlpha = 1
      }

      const circleR = Math.min(canvas.width, canvas.height) * CIRCLE_RADIUS
      const circleCx = canvas.width / 2
      const circleCy = canvas.height / 2

      if (isHovering) {
        lingerTimer = HOVER_LINGER
        mouseDX *= 0.75
        mouseDY *= 0.75
      } else if (lingerTimer > 0) {
        lingerTimer--
      }

      const isActive = isHovering || lingerTimer > 0
      if (wasHovering && !isActive) {
        particles.forEach(p => {
          const angle = Math.random() * Math.PI * 2
          const speed = Math.random() * 0.6 + 0.2
          p.vx = Math.cos(angle) * speed
          p.vy = Math.sin(angle) * speed
        })
      }
      wasHovering = isActive

      particles.forEach(p => {
        p.changeTimer--
        if (p.changeTimer <= 0) {
          p.char = randomChar()
          p.changeTimer = Math.floor(Math.random() * 80 + 40)
        }

        if (isActive) {
          const mouseSpeed = Math.sqrt(mouseDX * mouseDX + mouseDY * mouseDY)
          if (mouseSpeed > EMIT_SPEED_THRESHOLD) {
            const nx = mouseDX / mouseSpeed
            const ny = mouseDY / mouseSpeed
            const dot = (p.targetX - canvas.width / 2) * nx + (p.targetY - canvas.height / 2) * ny
            const bRadius = Math.min(canvas.width, canvas.height) * 0.58 * 0.28
            const emitChance = Math.min(mouseSpeed * EMIT_PROBABILITY, 0.04)
            if (dot < -bRadius * 0.65 && Math.random() < emitChance) {
              const force = Math.min(mouseSpeed, 8) * EMIT_FORCE
              p.vx += -nx * force
              p.vy += -ny * force
            }
          }

          p.phase += p.phaseSpeed
          p.x += (p.targetX - p.x) * HOVER_CONVERGENCE + Math.sin(p.phase) * p.floatR * FLOAT_AMPLITUDE + mouseDX * HOVER_MOUSE_FOLLOW + p.vx
          p.y += (p.targetY - p.y) * HOVER_CONVERGENCE + Math.cos(p.phase * 0.7) * p.floatR * FLOAT_AMPLITUDE + mouseDY * HOVER_MOUSE_FOLLOW + p.vy
          p.vx *= EMIT_VEL_DECAY
          p.vy *= EMIT_VEL_DECAY
          p.alpha = Math.min(p.alpha + 0.04, p.brightness)
        } else {
          p.x += p.vx
          p.y += p.vy

          const pdx = p.x - circleCx
          const pdy = p.y - circleCy
          const dist = Math.sqrt(pdx * pdx + pdy * pdy)
          const fadeStart = circleR * 0.75

          if (dist > fadeStart) {
            const fadeRatio = Math.min((dist - fadeStart) / (circleR - fadeStart), 1)
            p.alpha = p.brightness * (1 - fadeRatio)
          } else {
            p.alpha = Math.min(p.alpha + 0.015, p.brightness)
          }

          if (dist > circleR) {
            const t = bPositions[Math.floor(Math.random() * bPositions.length)]
            if (t) {
              p.x = t.x
              p.y = t.y
              p.alpha = 0
              const angle = Math.random() * Math.PI * 2
              const speed = Math.random() * 0.6 + 0.2
              p.vx = Math.cos(angle) * speed
              p.vy = Math.sin(angle) * speed
            }
          }
        }

        ctx.save()
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = p.color
        ctx.font = `${p.size}px monospace`
        ctx.fillText(p.char, p.x, p.y)
        ctx.restore()
      })

      animFrameId = requestAnimationFrame(animate)
    }

    function onMouseMove(e) {
      const r = canvas.getBoundingClientRect()
      mouseX = e.clientX - r.left
      mouseY = e.clientY - r.top
      mouseDX = mouseX - prevMouseX
      mouseDY = mouseY - prevMouseY
      prevMouseX = mouseX
      prevMouseY = mouseY
      isHovering = isOverB(mouseX, mouseY)
    }

    function onMouseLeave() {
      isHovering = false
    }

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    bPositions = buildBShape(canvas.width, canvas.height)
    buildBGlow(canvas.width, canvas.height)
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
