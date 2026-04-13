import { useEffect, useRef } from 'react'

// ─── Particle system ────────────────────────────────────────────────────────
const CHARS = '01アイウエオカキクケコサシスセソBEAMUDabcdefghijklmnopqrstuvwxyz<>{}[]|/\\#@$%^&*+=~'.split('')
const PARTICLE_COUNT        = 1200
const PARTICLE_COUNT_SMALL  = 800
const BREAKPOINT            = 768
const HOVER_CONVERGENCE     = 0.06
const HOVER_MOUSE_FOLLOW    = 0.02
const FLOAT_AMPLITUDE       = 0.2
const EMIT_SPEED_THRESHOLD  = 1
const EMIT_PROBABILITY      = 0.018
const EMIT_FORCE            = 0.05
const EMIT_VEL_DECAY        = 0.88
const GLOW_OPACITY_MIN      = 0.05
const GLOW_OPACITY_MAX      = 0.25
const GLOW_BREATH_SPEED     = 0.03
const GLOW_OPACITY_HOVER    = 0.7
const GLOW_BLUR             = 10
const GLOW_BLUR_HOVER       = 40
const HOVER_LINGER          = 180
const CIRCLE_RADIUS         = 0.72

// ─── Vector mesh ────────────────────────────────────────────────────────────
const GRID_SPACING       = 58
const SPOT_RADIUS        = 270
const MESH_BREATH_SPEED  = 0.009   // velocidad de respiración (lenta)
const MESH_BREATH_AMP    = 5       // píxeles máx de desplazamiento ondulatorio

// ─── Shared palette ─────────────────────────────────────────────────────────
const BLUE_PALETTE = [
  '#1a4fff', '#0077ff', '#00aaff', '#00eeff',
  '#1230cc', '#3366ff', '#00cfff', '#5599ff',
]

function randomChar() { return CHARS[Math.floor(Math.random() * CHARS.length)] }
function randomBlue() { return BLUE_PALETTE[Math.floor(Math.random() * BLUE_PALETTE.length)] }

export default function AnimatedBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')

    // ── Shared state ──────────────────────────────────────────────────────
    let animFrameId  = null
    let time         = 0
    let mouseX       = 0
    let mouseY       = 0
    let mouseDX      = 0
    let mouseDY      = 0
    let prevMouseX   = 0
    let prevMouseY   = 0
    let isHoveringB  = false

    // ── Particle state ────────────────────────────────────────────────────
    let particles      = []
    let bPositions     = []
    let offCanvas      = null
    let offCtx         = null
    let wasActive      = false
    let lingerTimer    = 0
    let glowCanvas     = null
    let glowCanvasHvr  = null
    let glowOpacity    = GLOW_OPACITY_MIN
    let glowBlur       = 0
    let breathPhase    = 0

    // ── Vector state ──────────────────────────────────────────────────────
    let vectors        = []
    let vcols          = 0
    let vrows          = 0
    let meshBreathPhase = 0

    // ══════════════════════════════════════════════════════════════════════
    // PARTICLE HELPERS
    // ══════════════════════════════════════════════════════════════════════
    function buildBShape(w, h) {
      offCanvas       = document.createElement('canvas')
      offCanvas.width = w
      offCanvas.height= h
      offCtx = offCanvas.getContext('2d', { willReadFrequently: true })
      const fs = Math.min(w, h) * 0.58
      offCtx.clearRect(0, 0, w, h)
      offCtx.font          = `900 ${fs}px 'Arial Black', Arial, sans-serif`
      offCtx.textAlign     = 'center'
      offCtx.textBaseline  = 'middle'
      offCtx.fillStyle     = 'white'
      offCtx.fillText('B', w / 2, h / 2)
      const img  = offCtx.getImageData(0, 0, w, h)
      const pos  = []
      const step = 7
      for (let y = 0; y < h; y += step)
        for (let x = 0; x < w; x += step)
          if (img.data[(y * w + x) * 4 + 3] > 128) pos.push({ x, y })
      return pos
    }

    function isOverB(mx, my) {
      if (!offCtx || mx < 0 || my < 0 || mx >= offCanvas.width || my >= offCanvas.height) return false
      return offCtx.getImageData(Math.round(mx), Math.round(my), 1, 1).data[3] > 50
    }

    function makeGlowCanvas(w, h, blur) {
      const gc  = document.createElement('canvas')
      gc.width  = w
      gc.height = h
      const g   = gc.getContext('2d')
      const fs  = Math.min(w, h) * 0.58
      const cx  = w / 2, cy = h / 2
      g.font         = `900 ${fs}px 'Arial Black', Arial, sans-serif`
      g.textAlign    = 'center'
      g.textBaseline = 'middle'
      g.filter    = `blur(${blur}px)`;         g.fillStyle = 'rgba(30,100,220,0.18)';   g.fillText('B', cx, cy)
      g.filter    = `blur(${blur * 0.5}px)`;   g.fillStyle = 'rgba(50,120,255,0.16)';   g.fillText('B', cx, cy)
      const rg = g.createRadialGradient(cx, cy, 0, cx, cy, fs * 0.18)
      rg.addColorStop(0,   'rgba(150,200,255,0.22)')
      rg.addColorStop(0.4, 'rgba(50,130,255,0.14)')
      rg.addColorStop(0.8, 'rgba(20,70,200,0.07)')
      rg.addColorStop(1,   'rgba(0,20,80,0)')
      g.filter    = `blur(${blur * 0.25}px)`;  g.fillStyle = rg;                        g.fillText('B', cx, cy)
      g.filter    = 'none'
      return gc
    }

    function initParticles(w, h) {
      particles = []
      const count = w <= BREAKPOINT ? PARTICLE_COUNT_SMALL : PARTICLE_COUNT
      for (let i = 0; i < count; i++) {
        const t = bPositions[Math.floor(Math.random() * bPositions.length)] ?? { x: w / 2, y: h / 2 }
        particles.push({
          x: t.x, y: t.y,
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

    // ══════════════════════════════════════════════════════════════════════
    // VECTOR HELPERS
    // ══════════════════════════════════════════════════════════════════════
    function buildVectors(w, h) {
      vectors = []
      vcols   = Math.ceil(w / GRID_SPACING) + 1
      vrows   = Math.ceil(h / GRID_SPACING) + 1
      for (let row = 0; row < vrows; row++) {
        for (let col = 0; col < vcols; col++) {
          vectors.push({
            col, row,
            x: col * GRID_SPACING,
            y: row * GRID_SPACING,
            rx: col * GRID_SPACING,
            ry: row * GRID_SPACING,
            color: randomBlue(),
            glow: 0,
            bMask: 0,
          })
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // B-MASK: qué nodos de la malla caen dentro/cerca de la B
    // ══════════════════════════════════════════════════════════════════════
    function computeBMask() {
      if (!offCtx) return
      const w      = offCanvas.width
      const h      = offCanvas.height
      const pixels = offCtx.getImageData(0, 0, w, h).data
      const maxR   = GRID_SPACING * 1.4   // radio máximo de influencia
      const step   = 5                    // paso del muestreo (px)

      vectors.forEach(v => {
        let minDist = Infinity

        for (let dy = -maxR; dy <= maxR; dy += step) {
          for (let dx = -maxR; dx <= maxR; dx += step) {
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist >= maxR || dist >= minDist) continue
            const px = Math.round(v.x + dx)
            const py = Math.round(v.y + dy)
            if (px >= 0 && px < w && py >= 0 && py < h) {
              if (pixels[(py * w + px) * 4 + 3] > 50) {
                minDist = dist
                if (minDist < step) break  // dentro de la B, salir pronto
              }
            }
          }
        }

        // Misma caída cuadrática que el spotlight del mouse
        const t = minDist === Infinity ? 0 : Math.max(0, 1 - minDist / maxR)
        v.bMask = t * t
      })
    }

    // ══════════════════════════════════════════════════════════════════════
    // RESIZE
    // ══════════════════════════════════════════════════════════════════════
    function resize() {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
      bPositions    = buildBShape(canvas.width, canvas.height)
      glowCanvas    = makeGlowCanvas(canvas.width, canvas.height, GLOW_BLUR)
      glowCanvasHvr = makeGlowCanvas(canvas.width, canvas.height, GLOW_BLUR_HOVER)
      initParticles(canvas.width, canvas.height)
      buildVectors(canvas.width, canvas.height)
      computeBMask()
    }

    // ══════════════════════════════════════════════════════════════════════
    // DRAW HELPERS
    // ══════════════════════════════════════════════════════════════════════
    function drawCursor() {
      const x      = mouseX
      const y      = mouseY
      const pulse  = Math.sin(time * 0.07) * 0.5 + 0.5
      const tip    = 5
      const size   = 24
      const gap    = 7
      const br     = 18
      const bl     = 7

      ctx.save()

      // Outer ring
      ctx.beginPath(); ctx.arc(x, y, 20 + pulse * 5, 0, Math.PI * 2)
      ctx.strokeStyle = '#00aaff'; ctx.globalAlpha = 0.08 + pulse * 0.1; ctx.lineWidth = 1; ctx.stroke()

      // Crosshair
      ctx.strokeStyle = '#00cfff'; ctx.lineWidth = 1; ctx.globalAlpha = 0.9
      ctx.beginPath()
      ctx.moveTo(x - size, y); ctx.lineTo(x - gap, y)
      ctx.moveTo(x + gap,  y); ctx.lineTo(x + size, y)
      ctx.moveTo(x, y - size); ctx.lineTo(x, y - gap)
      ctx.moveTo(x, y + gap);  ctx.lineTo(x, y + size)
      ctx.stroke()

      // Arrow tips
      ctx.fillStyle = '#00cfff'; ctx.globalAlpha = 0.9
      const tri = (ax, ay, bx, by, cx, cy) => { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill() }
      tri(x + size + tip, y,         x + size, y - tip * 0.55, x + size, y + tip * 0.55)
      tri(x - size - tip, y,         x - size, y - tip * 0.55, x - size, y + tip * 0.55)
      tri(x, y + size + tip,         x - tip * 0.55, y + size, x + tip * 0.55, y + size)
      tri(x, y - size - tip,         x - tip * 0.55, y - size, x + tip * 0.55, y - size)

      // Center dot
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.85; ctx.fill()

      // Corner brackets
      ctx.globalAlpha = 0.5 + pulse * 0.25; ctx.strokeStyle = '#3366ff'; ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x - br, y - br + bl); ctx.lineTo(x - br, y - br); ctx.lineTo(x - br + bl, y - br)
      ctx.moveTo(x + br - bl, y - br); ctx.lineTo(x + br, y - br); ctx.lineTo(x + br, y - br + bl)
      ctx.moveTo(x - br, y + br - bl); ctx.lineTo(x - br, y + br); ctx.lineTo(x - br + bl, y + br)
      ctx.moveTo(x + br - bl, y + br); ctx.lineTo(x + br, y + br); ctx.lineTo(x + br, y + br - bl)
      ctx.stroke()

      // Coordinates
      ctx.globalAlpha = 0.45; ctx.fillStyle = '#00aaff'; ctx.font = '9px monospace'
      ctx.fillText(`x:${Math.round(x)}  y:${Math.round(y)}`, x + br + 4, y - br + 2)

      ctx.restore()
    }

    // ══════════════════════════════════════════════════════════════════════
    // ANIMATE
    // ══════════════════════════════════════════════════════════════════════
    function animate() {
      time++
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // ── 1. VECTOR MESH (respiración + spotlight) ──────────────────────────
      meshBreathPhase += MESH_BREATH_SPEED
      const mBreath   = Math.sin(meshBreathPhase) * 0.5 + 0.5          // 0..1
      const baseAlpha = 0.08 + mBreath * 0.07                          // 0.08..0.15, siempre visible

      // Precomputar rx/ry (onda de respiración) y actualizar glow de cada nodo
      for (let i = 0; i < vectors.length; i++) {
        const v  = vectors[i]
        const wx = Math.sin(meshBreathPhase       + v.col * 0.32 + v.row * 0.11)
        const wy = Math.cos(meshBreathPhase * 0.8 + v.row * 0.28 + v.col * 0.14)
        v.rx = v.x + wx * MESH_BREATH_AMP * mBreath
        v.ry = v.y + wy * MESH_BREATH_AMP * mBreath

        // Glow: sube rápido al pasar el spotlight, decae lento (rastro)
        const dv   = Math.sqrt((v.rx - mouseX) ** 2 + (v.ry - mouseY) ** 2)
        const spot = dv < SPOT_RADIUS ? Math.pow(1 - dv / SPOT_RADIUS, 2) : 0
        v.glow = spot > v.glow ? spot : v.glow * 0.965
      }

      ctx.save()
      for (let i = 0; i < vectors.length; i++) {
        const v  = vectors[i]

        // ── Segmento horizontal ────────────────────────────────────────
        if (v.col < vcols - 1) {
          const r     = vectors[v.row * vcols + v.col + 1]
          const trail = (v.glow + r.glow) * 0.5   // media → bordes más difusos
          const alpha = Math.max(baseAlpha, trail * 0.68)
          ctx.globalAlpha = alpha
          ctx.strokeStyle = trail > 0.4 ? '#00aaff' : '#1a4fff'
          ctx.lineWidth   = 0.4 + trail * 0.55
          ctx.beginPath(); ctx.moveTo(v.rx, v.ry); ctx.lineTo(r.rx, r.ry); ctx.stroke()
        }

        // ── Segmento vertical ──────────────────────────────────────────
        if (v.row < vrows - 1) {
          const b     = vectors[(v.row + 1) * vcols + v.col]
          const trail = (v.glow + b.glow) * 0.5
          const alpha = Math.max(baseAlpha, trail * 0.68)
          ctx.globalAlpha = alpha
          ctx.strokeStyle = trail > 0.4 ? '#00aaff' : '#1a4fff'
          ctx.lineWidth   = 0.4 + trail * 0.55
          ctx.beginPath(); ctx.moveTo(v.rx, v.ry); ctx.lineTo(b.rx, b.ry); ctx.stroke()
        }

        // ── Nodo ───────────────────────────────────────────────────────
        const nodeDot = Math.max(baseAlpha * 1.4, v.glow * 1.1)
        if (nodeDot > 0.006) {
          ctx.beginPath(); ctx.arc(v.rx, v.ry, 1.2 + v.glow * 0.9, 0, Math.PI * 2)
          ctx.fillStyle   = v.glow > 0.5 ? '#00cfff' : '#3366ff'
          ctx.globalAlpha = Math.min(nodeDot, 0.9)
          ctx.fill()
        }

        // ── Líneas convergentes (radio corto, sin trail, rápidas) ──────
        const dvConv = Math.sqrt((v.rx - mouseX) ** 2 + (v.ry - mouseY) ** 2)
        const CONV_R = SPOT_RADIUS * 0.42
        if (dvConv < CONV_R && dvConv > 2) {
          const tc = Math.pow(1 - dvConv / CONV_R, 2)
          ctx.strokeStyle = v.color
          ctx.lineWidth   = 0.4 + tc * 0.6
          ctx.globalAlpha = tc * 0.55
          ctx.beginPath(); ctx.moveTo(v.rx, v.ry); ctx.lineTo(mouseX, mouseY); ctx.stroke()
        }

      }
      ctx.restore()

      // ── 2. PARTICLE SYSTEM (encima, siempre visible) ──────────────────
      breathPhase += GLOW_BREATH_SPEED
      const breathOp = GLOW_OPACITY_MIN + (Math.sin(breathPhase) * 0.5 + 0.5) * (GLOW_OPACITY_MAX - GLOW_OPACITY_MIN)
      const targetOp = isHoveringB ? GLOW_OPACITY_HOVER : breathOp
      glowOpacity += (targetOp - glowOpacity) * 0.05
      glowBlur    += ((isHoveringB ? 1 : 0) - glowBlur) * 0.05
      if (glowCanvas && glowCanvasHvr) {
        ctx.globalAlpha = glowOpacity * (1 - glowBlur)
        ctx.drawImage(glowCanvas, 0, 0)
        ctx.globalAlpha = glowOpacity * glowBlur
        ctx.drawImage(glowCanvasHvr, 0, 0)
        ctx.globalAlpha = 1
      }

      const circleR  = Math.min(canvas.width, canvas.height) * CIRCLE_RADIUS
      const circleCx = canvas.width / 2
      const circleCy = canvas.height / 2

      if (isHoveringB) {
        lingerTimer = HOVER_LINGER
        mouseDX *= 0.75; mouseDY *= 0.75
      } else if (lingerTimer > 0) {
        lingerTimer--
      }

      const isActive = isHoveringB || lingerTimer > 0
      if (wasActive && !isActive) {
        particles.forEach(p => {
          const a = Math.random() * Math.PI * 2
          p.vx = Math.cos(a) * (Math.random() * 0.6 + 0.2)
          p.vy = Math.sin(a) * (Math.random() * 0.6 + 0.2)
        })
      }
      wasActive = isActive

      particles.forEach(p => {
        p.changeTimer--
        if (p.changeTimer <= 0) {
          p.char = randomChar()
          p.changeTimer = Math.floor(Math.random() * 80 + 40)
        }

        if (isActive) {
          const spd = Math.sqrt(mouseDX * mouseDX + mouseDY * mouseDY)
          if (spd > EMIT_SPEED_THRESHOLD) {
            const nx  = mouseDX / spd, ny = mouseDY / spd
            const dot = (p.targetX - canvas.width / 2) * nx + (p.targetY - canvas.height / 2) * ny
            const bR  = Math.min(canvas.width, canvas.height) * 0.58 * 0.28
            if (dot < -bR * 0.65 && Math.random() < Math.min(spd * EMIT_PROBABILITY, 0.04)) {
              const force = Math.min(spd, 8) * EMIT_FORCE
              p.vx += -nx * force; p.vy += -ny * force
            }
          }
          p.phase += p.phaseSpeed
          p.x += (p.targetX - p.x) * HOVER_CONVERGENCE + Math.sin(p.phase) * p.floatR * FLOAT_AMPLITUDE + mouseDX * HOVER_MOUSE_FOLLOW + p.vx
          p.y += (p.targetY - p.y) * HOVER_CONVERGENCE + Math.cos(p.phase * 0.7) * p.floatR * FLOAT_AMPLITUDE + mouseDY * HOVER_MOUSE_FOLLOW + p.vy
          p.vx *= EMIT_VEL_DECAY; p.vy *= EMIT_VEL_DECAY
          p.alpha = Math.min(p.alpha + 0.04, p.brightness)
        } else {
          p.x += p.vx; p.y += p.vy
          const pdx  = p.x - circleCx, pdy = p.y - circleCy
          const dist = Math.sqrt(pdx * pdx + pdy * pdy)
          const fade = circleR * 0.75
          if (dist > fade) {
            p.alpha = p.brightness * (1 - Math.min((dist - fade) / (circleR - fade), 1))
          } else {
            p.alpha = Math.min(p.alpha + 0.015, p.brightness)
          }
          if (dist > circleR) {
            const t = bPositions[Math.floor(Math.random() * bPositions.length)]
            if (t) {
              p.x = t.x; p.y = t.y; p.alpha = 0
              const a = Math.random() * Math.PI * 2
              p.vx = Math.cos(a) * (Math.random() * 0.6 + 0.2)
              p.vy = Math.sin(a) * (Math.random() * 0.6 + 0.2)
            }
          }
        }

        ctx.save()
        ctx.globalAlpha = p.alpha
        ctx.fillStyle   = p.color
        ctx.font        = `${p.size}px monospace`
        ctx.fillText(p.char, p.x, p.y)
        ctx.restore()
      })

      // ── 3. CURSOR ─────────────────────────────────────────────────────
      drawCursor()
      animFrameId = requestAnimationFrame(animate)
    }

    // ══════════════════════════════════════════════════════════════════════
    // EVENTS
    // ══════════════════════════════════════════════════════════════════════
    function onMouseMove(e) {
      const r  = canvas.getBoundingClientRect()
      const nx = e.clientX - r.left
      const ny = e.clientY - r.top
      mouseDX = nx - prevMouseX; mouseDY = ny - prevMouseY
      prevMouseX = nx; prevMouseY = ny
      mouseX = nx; mouseY = ny
      isHoveringB = isOverB(mouseX, mouseY)
    }

    function onMouseLeave() {
      isHoveringB = false
    }

    // ══════════════════════════════════════════════════════════════════════
    // INIT
    // ══════════════════════════════════════════════════════════════════════
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight
    bPositions  = buildBShape(canvas.width, canvas.height)
    glowCanvas  = makeGlowCanvas(canvas.width, canvas.height, GLOW_BLUR)
    glowCanvasHvr = makeGlowCanvas(canvas.width, canvas.height, GLOW_BLUR_HOVER)
    initParticles(canvas.width, canvas.height)
    buildVectors(canvas.width, canvas.height)
    computeBMask()
    animate()

    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseleave', onMouseLeave)

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
      cancelAnimationFrame(animFrameId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0, left: 0,
        width: '100%', height: '100%',
        cursor: 'none',
      }}
    />
  )
}
