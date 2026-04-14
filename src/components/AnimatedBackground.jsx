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
const MESH_BREATH_AMP    = 14      // píxeles máx de desplazamiento ondulatorio
const CUBE_DEPTH         = 28      // longitud de la arista de profundidad (px en pantalla)

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
    let outlineOpacity = 0
    let pingRadius     = 0
    let pingAlpha      = 0
    let pingTimer      = 0

    // ── Vector state ──────────────────────────────────────────────────────
    let vectors        = []
    let vcols          = 0
    let vrows          = 0
    let meshBreathPhase = 0

    // ── Back layer state ──────────────────────────────────────────────────
    let backVectors    = []
    let bvcols         = 0
    let bvrows         = 0

    // ── Third layer state ─────────────────────────────────────────────────
    let thirdVectors   = []
    let tvcols         = 0
    let tvrows         = 0

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
    // BACK MESH (plano trasero del cubo, desplazado por CUBE_DX/DY)
    // ══════════════════════════════════════════════════════════════════════
    function buildBackVectors(w, h) {
      backVectors = []
      bvcols = vcols
      bvrows = vrows
      const cx = w / 2
      const cy = h / 2

      for (let row = 0; row < vrows; row++) {
        for (let col = 0; col < vcols; col++) {
          const fx  = col * GRID_SPACING
          const fy  = row * GRID_SPACING
          // Dirección desde el nodo hacia el punto de fuga (centro = B)
          const dx  = cx - fx
          const dy  = cy - fy
          const len = Math.sqrt(dx * dx + dy * dy) || 1
          // Nodo trasero: desplazado CUBE_DEPTH px en dirección al punto de fuga
          const bx  = fx + (dx / len) * CUBE_DEPTH
          const by  = fy + (dy / len) * CUBE_DEPTH
          backVectors.push({ col, row, x: bx, y: by, color: randomBlue(), glow: 0 })
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // THIRD MESH (tercer plano, doble profundidad)
    // ══════════════════════════════════════════════════════════════════════
    function buildThirdVectors(w, h) {
      thirdVectors = []
      tvcols = vcols
      tvrows = vrows
      const cx = w / 2
      const cy = h / 2

      for (let row = 0; row < vrows; row++) {
        for (let col = 0; col < vcols; col++) {
          const fx  = col * GRID_SPACING
          const fy  = row * GRID_SPACING
          const dx  = cx - fx
          const dy  = cy - fy
          const len = Math.sqrt(dx * dx + dy * dy) || 1
          // Doble profundidad respecto al frente
          const tx  = fx + (dx / len) * CUBE_DEPTH * 2
          const ty  = fy + (dy / len) * CUBE_DEPTH * 2
          thirdVectors.push({ col, row, x: tx, y: ty, rx: tx, ry: ty, color: randomBlue(), glow: 0 })
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
      buildBackVectors(canvas.width, canvas.height)
      buildThirdVectors(canvas.width, canvas.height)
      computeBMask()
    }

    // ══════════════════════════════════════════════════════════════════════
    // DRAW HELPERS
    // ══════════════════════════════════════════════════════════════════════
    function drawCursor() {
      const x     = mouseX
      const y     = mouseY
      const pulse = Math.sin(time * 0.07) * 0.5 + 0.5
      const rot   = time * 0.012   // rotación lenta sentido horario
      const rotCC = time * -0.007  // rotación lenta sentido antihorario

      // ── Ping periódico ────────────────────────────────────────────────
      pingTimer++
      if (pingTimer > 90) { pingTimer = 0; pingRadius = 0; pingAlpha = 0.7 }
      if (pingAlpha > 0) {
        pingRadius += 2.2
        pingAlpha  *= 0.94
        ctx.save()
        ctx.beginPath(); ctx.arc(x, y, pingRadius, 0, Math.PI * 2)
        ctx.strokeStyle = '#00aaff'
        ctx.lineWidth   = 1.2
        ctx.globalAlpha = pingAlpha * 0.5
        ctx.stroke()
        ctx.restore()
      }

      ctx.save()

      // ── Halo exterior suave (gradiente radial) ────────────────────────
      const grad = ctx.createRadialGradient(x, y, 0, x, y, 65)
      grad.addColorStop(0,   `rgba(0,120,255,${0.07 + pulse * 0.05})`)
      grad.addColorStop(0.5, `rgba(0,60,180,${0.03 + pulse * 0.02})`)
      grad.addColorStop(1,   'rgba(0,20,80,0)')
      ctx.fillStyle   = grad
      ctx.globalAlpha = 1
      ctx.beginPath(); ctx.arc(x, y, 65, 0, Math.PI * 2); ctx.fill()

      // ── Anillo exterior giratorio con segmentos ───────────────────────
      ctx.strokeStyle = '#0077ff'
      ctx.lineWidth   = 1.0
      ctx.globalAlpha = 0.45 + pulse * 0.2
      const segs = 10
      for (let i = 0; i < segs; i++) {
        const a0 = rot + (i / segs) * Math.PI * 2
        const a1 = a0 + (Math.PI * 2 / segs) * 0.55
        ctx.beginPath(); ctx.arc(x, y, 42, a0, a1); ctx.stroke()
      }

      // ── Anillo interior (contra-rotación) ─────────────────────────────
      ctx.strokeStyle = '#00ccff'
      ctx.lineWidth   = 0.7
      ctx.globalAlpha = 0.55 + pulse * 0.15
      const segs2 = 6
      for (let i = 0; i < segs2; i++) {
        const a0 = rotCC + (i / segs2) * Math.PI * 2
        const a1 = a0 + (Math.PI * 2 / segs2) * 0.4
        ctx.beginPath(); ctx.arc(x, y, 26, a0, a1); ctx.stroke()
      }

      // ── Cruz de mira (4 marcas en ejes cardinales) ───────────────────
      ctx.strokeStyle = '#00eeff'
      ctx.lineWidth   = 1.0
      ctx.globalAlpha = 0.80
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14)
        ctx.lineTo(x + Math.cos(a) * 22, y + Math.sin(a) * 22)
        ctx.stroke()
      }

      // ── 4 marcas diagonales cortas ────────────────────────────────────
      ctx.strokeStyle = '#3366ff'
      ctx.lineWidth   = 0.8
      ctx.globalAlpha = 0.50
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i / 4) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(x + Math.cos(a) * 30, y + Math.sin(a) * 30)
        ctx.lineTo(x + Math.cos(a) * 38, y + Math.sin(a) * 38)
        ctx.stroke()
      }

      // ── Punto central ─────────────────────────────────────────────────
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2)
      ctx.fillStyle   = '#ffffff'
      ctx.globalAlpha = 0.95
      ctx.fill()

      // ── Coordenadas HUD ───────────────────────────────────────────────
      ctx.globalAlpha = 0.40
      ctx.fillStyle   = '#00aaff'
      ctx.font        = '9px monospace'
      ctx.fillText(`${Math.round(x)}, ${Math.round(y)}`, x + 48, y - 8)

      ctx.restore()
    }

    function drawBOutline(opacity) {
      if (opacity < 0.004) return
      const w  = canvas.width
      const h  = canvas.height
      const fs = Math.min(w, h) * 0.58
      ctx.save()
      ctx.font         = `900 ${fs}px 'Arial Black', Arial, sans-serif`
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'

      // Capa exterior difuminada (halo)
      ctx.filter      = 'blur(6px)'
      ctx.strokeStyle = '#00aaff'
      ctx.lineWidth   = 10
      ctx.globalAlpha = opacity * 0.3
      ctx.strokeText('B', w / 2, h / 2)

      // Capa media con algo de blur
      ctx.filter      = 'blur(2.5px)'
      ctx.strokeStyle = '#3399ff'
      ctx.lineWidth   = 5
      ctx.globalAlpha = opacity * 0.55
      ctx.strokeText('B', w / 2, h / 2)

      // Trazo nítido interior
      ctx.filter      = 'none'
      ctx.strokeStyle = '#aaddff'
      ctx.lineWidth   = 1.8
      ctx.globalAlpha = opacity * 0.75
      ctx.strokeText('B', w / 2, h / 2)

      ctx.restore()
    }

    // ══════════════════════════════════════════════════════════════════════
    // ANIMATE
    // ══════════════════════════════════════════════════════════════════════
    function animate() {
      time++
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // ── Shared breath values ─────────────────────────────────────────────
      meshBreathPhase += MESH_BREATH_SPEED
      const mBreath     = Math.sin(meshBreathPhase) * 0.5 + 0.5
      const globalPulse = Math.sin(time * 0.022) * 0.5 + 0.5
      const waveFreq    = 0.0048
      const waveSpeed   = 0.010

      // ── Iluminación de fondo sincronizada con la malla ───────────────────
      {
        const cx = canvas.width  / 2
        const cy = canvas.height / 2
        const maxR = Math.sqrt(cx * cx + cy * cy)

        // Glow central — respira con mBreath
        const glowIntensity = 0.10 + mBreath * 0.12 + globalPulse * 0.06   // 0.10 .. 0.28
        const gradCenter = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.72)
        gradCenter.addColorStop(0,    `rgba(10, 40, 140, ${glowIntensity})`)
        gradCenter.addColorStop(0.35, `rgba(5,  20,  90, ${glowIntensity * 0.55})`)
        gradCenter.addColorStop(0.70, `rgba(2,   8,  50, ${glowIntensity * 0.20})`)
        gradCenter.addColorStop(1,    'rgba(0, 0, 0, 0)')
        ctx.fillStyle   = gradCenter
        ctx.globalAlpha = 1
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Ola diagonal de luz — misma onda que las mallas
        const wavePhase = time * waveSpeed
        const waveAmp   = 0.05 + mBreath * 0.04
        // Tres bandas diagonales superpuestas con distinto offset
        for (const [ox, oy, alpha] of [
          [0,      0,      waveAmp],
          [cx * 0.4, cy * 0.4, waveAmp * 0.55],
          [-cx * 0.3, cy * 0.6, waveAmp * 0.40],
        ]) {
          const bx = cx + ox
          const by = cy + oy
          const r  = maxR * (0.45 + mBreath * 0.15)
          const wv = Math.sin((bx + by) * waveFreq - wavePhase) * 0.5 + 0.5
          const gr = ctx.createRadialGradient(bx, by, 0, bx, by, r)
          gr.addColorStop(0,   `rgba(15, 60, 200, ${alpha * wv})`)
          gr.addColorStop(0.5, `rgba(5,  25, 110, ${alpha * wv * 0.4})`)
          gr.addColorStop(1,   'rgba(0, 0, 0, 0)')
          ctx.fillStyle   = gr
          ctx.globalAlpha = 1
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }

        // Viñeta perimetral — oscurece los bordes para dar profundidad
        const vignette = ctx.createRadialGradient(cx, cy, maxR * 0.4, cx, cy, maxR * 1.1)
        vignette.addColorStop(0, 'rgba(0,0,0,0)')
        vignette.addColorStop(1, `rgba(0,0,8, ${0.55 + mBreath * 0.10})`)
        ctx.fillStyle   = vignette
        ctx.globalAlpha = 1
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }

      // Precomputar rx/ry y centerFade de todas las mallas
      const vcx = canvas.width  / 2
      const vcy = canvas.height / 2
      const FADE_R = GRID_SPACING * 4   // radio de desvanecimiento alrededor del centro

      for (let i = 0; i < vectors.length; i++) {
        const v  = vectors[i]

        // CenterFade: 0 en el centro, 1 más allá de FADE_R
        const distC = Math.sqrt((v.x - vcx) ** 2 + (v.y - vcy) ** 2)
        v.centerFade = Math.pow(Math.min(distC / FADE_R, 1), 1.8)

        // Malla frontal
        const wx = Math.sin(meshBreathPhase       + v.col * 0.32 + v.row * 0.11)
        const wy = Math.cos(meshBreathPhase * 0.8 + v.row * 0.28 + v.col * 0.14)
        v.rx = v.x + wx * MESH_BREATH_AMP * mBreath
        v.ry = v.y + wy * MESH_BREATH_AMP * mBreath
        const dv   = Math.sqrt((v.rx - mouseX) ** 2 + (v.ry - mouseY) ** 2)
        const spot = dv < SPOT_RADIUS ? Math.pow(1 - dv / SPOT_RADIUS, 2) : 0
        v.glow = spot > v.glow ? spot : v.glow * 0.965

        // Malla trasera
        const bv  = backVectors[i]
        if (bv) {
          const bdistC = Math.sqrt((bv.x - vcx) ** 2 + (bv.y - vcy) ** 2)
          bv.centerFade = Math.pow(Math.min(bdistC / FADE_R, 1), 1.8)
          const bwx = Math.sin(meshBreathPhase + Math.PI * 0.6 + bv.col * 0.28 + bv.row * 0.13)
          const bwy = Math.cos(meshBreathPhase * 0.75 + Math.PI * 0.4 + bv.row * 0.24 + bv.col * 0.16)
          bv.rx = bv.x + bwx * MESH_BREATH_AMP * 0.85 * mBreath
          bv.ry = bv.y + bwy * MESH_BREATH_AMP * 0.85 * mBreath
        }

        // Tercer plano
        const tv  = thirdVectors[i]
        if (tv) {
          const tdistC = Math.sqrt((tv.x - vcx) ** 2 + (tv.y - vcy) ** 2)
          tv.centerFade = Math.pow(Math.min(tdistC / FADE_R, 1), 1.8)
          const twx = Math.sin(meshBreathPhase + Math.PI * 1.2 + tv.col * 0.22 + tv.row * 0.18)
          const twy = Math.cos(meshBreathPhase * 0.65 + Math.PI * 0.9 + tv.row * 0.20 + tv.col * 0.19)
          tv.rx = tv.x + twx * MESH_BREATH_AMP * 0.70 * mBreath
          tv.ry = tv.y + twy * MESH_BREATH_AMP * 0.70 * mBreath
          const tdv   = Math.sqrt((tv.rx - mouseX) ** 2 + (tv.ry - mouseY) ** 2)
          const tspot = tdv < SPOT_RADIUS ? Math.pow(1 - tdv / SPOT_RADIUS, 2) : 0
          tv.glow = tspot > tv.glow ? tspot : tv.glow * 0.965
        }
      }

      // ── -1. THIRD MESH + DEPTH LINES back→third ──────────────────────────
      {
        ctx.save()
        for (let i = 0; i < thirdVectors.length; i++) {
          const tv = thirdVectors[i]
          const bv = backVectors[i]
          if (!tv || !bv) continue

          // Aristas de profundidad back→third
          const wave   = Math.sin((bv.rx + bv.ry) * waveFreq - time * waveSpeed) * 0.5 + 0.5
          const dG     = (bv.glow + tv.glow) * 0.5
          const cf     = Math.min(bv.centerFade ?? 1, tv.centerFade ?? 1)
          const dA     = Math.max(0.20 + mBreath * 0.10 + wave * 0.10 + globalPulse * 0.06, dG * 0.6) * cf
          ctx.globalAlpha = dA
          ctx.strokeStyle = dG > 0.3 ? '#3366cc' : '#1a2e99'
          ctx.lineWidth   = 0.5 + wave * 0.35 + dG * 0.55
          ctx.beginPath(); ctx.moveTo(bv.rx, bv.ry); ctx.lineTo(tv.rx, tv.ry); ctx.stroke()
        }

        // Cara del tercer plano
        for (let i = 0; i < thirdVectors.length; i++) {
          const v    = thirdVectors[i]
          const wave = Math.sin((v.rx + v.ry) * waveFreq - time * waveSpeed) * 0.5 + 0.5
          const cf   = v.centerFade ?? 1
          const baseA = Math.max(0.20 + mBreath * 0.10 + wave * 0.10 + globalPulse * 0.06, v.glow * 0.45) * cf
          const lw    = 0.25 + wave * 0.25 + v.glow * 0.35

          if (v.col < tvcols - 1) {
            const r = thirdVectors[v.row * tvcols + v.col + 1]
            if (r) {
              ctx.globalAlpha = Math.max(baseA, (v.glow + r.glow) * 0.25)
              ctx.strokeStyle = '#152888'
              ctx.lineWidth   = lw
              ctx.beginPath(); ctx.moveTo(v.rx, v.ry); ctx.lineTo(r.rx, r.ry); ctx.stroke()
            }
          }
          if (v.row < tvrows - 1) {
            const b = thirdVectors[(v.row + 1) * tvcols + v.col]
            if (b) {
              ctx.globalAlpha = Math.max(baseA, (v.glow + b.glow) * 0.25)
              ctx.strokeStyle = '#152888'
              ctx.lineWidth   = lw
              ctx.beginPath(); ctx.moveTo(v.rx, v.ry); ctx.lineTo(b.rx, b.ry); ctx.stroke()
            }
          }
          ctx.beginPath(); ctx.arc(v.rx, v.ry, 0.7 + wave * 0.3 + v.glow * 0.6, 0, Math.PI * 2)
          ctx.fillStyle   = v.glow > 0.4 ? '#3366cc' : v.color
          ctx.globalAlpha = Math.min(Math.max(baseA * 1.4, v.glow * 0.6), 0.55)
          ctx.fill()
        }
        ctx.restore()
      }

      // ── 0. BACK MESH + DEPTH LINES (cara trasera + aristas Z del cubo) ───
      {
        ctx.save()

        // Primero actualizar glow de back vectors y dibujar líneas de profundidad (Z)
        for (let i = 0; i < backVectors.length; i++) {
          const bv = backVectors[i]
          const fv = vectors[i]   // nodo frontal correspondiente (mismo col/row)

          // Glow del ratón en la malla trasera
          const dv   = Math.sqrt((bv.rx - mouseX) ** 2 + (bv.ry - mouseY) ** 2)
          const spot = dv < SPOT_RADIUS ? Math.pow(1 - dv / SPOT_RADIUS, 2) : 0
          bv.glow = spot > bv.glow ? spot : bv.glow * 0.965

          // Línea de profundidad: conecta nodo frontal con nodo trasero (arista Z del cubo)
          const wave    = Math.sin((fv.rx + fv.ry) * waveFreq - time * waveSpeed) * 0.5 + 0.5
          const depthG  = (fv.glow + bv.glow) * 0.5
          const cf      = Math.min(fv.centerFade ?? 1, bv.centerFade ?? 1)
          const depthA  = Math.max(0.30 + mBreath * 0.14 + wave * 0.14 + globalPulse * 0.08, depthG * 0.7) * cf
          ctx.globalAlpha = depthA
          ctx.strokeStyle = depthG > 0.3 ? '#4477ee' : '#2244bb'
          ctx.lineWidth   = 0.6 + wave * 0.5 + depthG * 0.7
          ctx.beginPath(); ctx.moveTo(fv.rx, fv.ry); ctx.lineTo(bv.rx, bv.ry); ctx.stroke()
        }

        // Cara trasera: líneas horizontales y verticales de la malla de fondo
        for (let i = 0; i < backVectors.length; i++) {
          const v    = backVectors[i]
          const wave  = Math.sin((v.rx + v.ry) * waveFreq - time * waveSpeed) * 0.5 + 0.5
          const cf    = v.centerFade ?? 1
          const baseA = Math.max(0.30 + mBreath * 0.14 + wave * 0.14 + globalPulse * 0.08, v.glow * 0.52) * cf
          const lw    = 0.3 + wave * 0.3 + v.glow * 0.4

          if (v.col < bvcols - 1) {
            const r = backVectors[v.row * bvcols + v.col + 1]
            if (r) {
              const trail = (v.glow + r.glow) * 0.5
              ctx.globalAlpha = Math.max(baseA, trail * 0.52)
              ctx.strokeStyle = trail > 0.35 ? '#2266dd' : '#1a3ecc'
              ctx.lineWidth   = lw
              ctx.beginPath(); ctx.moveTo(v.rx, v.ry); ctx.lineTo(r.rx, r.ry); ctx.stroke()
            }
          }
          if (v.row < bvrows - 1) {
            const b = backVectors[(v.row + 1) * bvcols + v.col]
            if (b) {
              const trail = (v.glow + b.glow) * 0.5
              ctx.globalAlpha = Math.max(baseA, trail * 0.52)
              ctx.strokeStyle = trail > 0.35 ? '#2266dd' : '#1a3ecc'
              ctx.lineWidth   = lw
              ctx.beginPath(); ctx.moveTo(v.rx, v.ry); ctx.lineTo(b.rx, b.ry); ctx.stroke()
            }
          }
          // Nodo trasero
          ctx.beginPath(); ctx.arc(v.rx, v.ry, 0.8 + wave * 0.4 + v.glow * 0.7, 0, Math.PI * 2)
          ctx.fillStyle   = v.glow > 0.4 ? '#4488ff' : v.color
          ctx.globalAlpha = Math.min(Math.max(baseA * 1.5, v.glow * 0.75), 0.70)
          ctx.fill()
        }

        ctx.restore()
      }

      // ── 1. VECTOR MESH (cara frontal del cubo) ────────────────────────────
      const baseAlpha = 0.30 + mBreath * 0.14 + globalPulse * 0.08     // 0.30 .. 0.52

      ctx.save()
      for (let i = 0; i < vectors.length; i++) {
        const v  = vectors[i]

        // Ola diagonal por nodo (mismo sistema que back layer)
        const wave  = Math.sin((v.rx + v.ry) * waveFreq - time * waveSpeed) * 0.5 + 0.5
        const waveBoost = wave * 0.10 + globalPulse * 0.06

        // ── Segmento horizontal ────────────────────────────────────────
        if (v.col < vcols - 1) {
          const r     = vectors[v.row * vcols + v.col + 1]
          const trail = (v.glow + r.glow) * 0.5
          const alpha = Math.max(baseAlpha + waveBoost, trail * 0.68)
          ctx.globalAlpha = alpha
          ctx.strokeStyle = trail > 0.4 ? '#00aaff' : (wave > 0.65 ? '#2255dd' : '#1a4fff')
          ctx.lineWidth   = 0.3 + wave * 0.4 + trail * 0.55
          ctx.beginPath(); ctx.moveTo(v.rx, v.ry); ctx.lineTo(r.rx, r.ry); ctx.stroke()
        }

        // ── Segmento vertical ──────────────────────────────────────────
        if (v.row < vrows - 1) {
          const b     = vectors[(v.row + 1) * vcols + v.col]
          const trail = (v.glow + b.glow) * 0.5
          const alpha = Math.max(baseAlpha + waveBoost, trail * 0.68)
          ctx.globalAlpha = alpha
          ctx.strokeStyle = trail > 0.4 ? '#00aaff' : (wave > 0.65 ? '#2255dd' : '#1a4fff')
          ctx.lineWidth   = 0.3 + wave * 0.4 + trail * 0.55
          ctx.beginPath(); ctx.moveTo(v.rx, v.ry); ctx.lineTo(b.rx, b.ry); ctx.stroke()
        }

        // ── Nodo ───────────────────────────────────────────────────────
        const nodeDot = Math.max(baseAlpha * 1.4 + waveBoost, v.glow * 1.1)
        if (nodeDot > 0.006) {
          ctx.beginPath(); ctx.arc(v.rx, v.ry, 1.0 + wave * 0.6 + v.glow * 0.9, 0, Math.PI * 2)
          ctx.fillStyle   = v.glow > 0.5 ? '#00cfff' : (wave > 0.7 ? '#4488ff' : '#3366ff')
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

      // ── 3. B OUTLINE (hover, detrás de las partículas) ───────────────
      outlineOpacity += ((isActive ? 1 : 0) - outlineOpacity) * 0.07
      drawBOutline(outlineOpacity)

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

      // ── 4. CURSOR ─────────────────────────────────────────────────────
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
    buildBackVectors(canvas.width, canvas.height)
    buildThirdVectors(canvas.width, canvas.height)
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
