import { useEffect, useRef } from 'react'

const GRID_SPACING    = 58
const INFLUENCE_RADIUS = 250
const ARROW_LENGTH    = 14
const ARROW_HEAD      = 5
const PULL_MAX        = 26

// Back layer perspective
const BACK_SCALE      = 0.65   // how compressed the back grid appears
const BACK_DIM        = 0.55   // alpha multiplier for back layer

const BLUE_PALETTE = [
  '#1a4fff', '#0077ff', '#00aaff', '#00eeff',
  '#1230cc', '#3366ff', '#00cfff', '#5599ff',
]

function shortAngleDiff(from, to) {
  return ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI
}

export default function VectorMesh() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    let mouseX = -9999
    let mouseY = -9999
    let animFrameId = null
    let time = 0

    // Front layer
    let vectors = []
    let cols = 0
    let rows = 0

    // Back layer
    let backVectors = []
    let bCols = 0
    let bRows = 0

    // ── Build front grid ──────────────────────────────────────────────────
    function buildVectors(w, h) {
      vectors = []
      cols = Math.ceil(w / GRID_SPACING) + 1
      rows = Math.ceil(h / GRID_SPACING) + 1

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const naturalAngle = Math.random() * Math.PI * 2
          vectors.push({
            col, row,
            bx: col * GRID_SPACING,
            by: row * GRID_SPACING,
            x:  col * GRID_SPACING,
            y:  row * GRID_SPACING,
            angle: naturalAngle,
            naturalAngle,
            rotSpeed: (Math.random() - 0.5) * 0.005,
            color: BLUE_PALETTE[Math.floor(Math.random() * BLUE_PALETTE.length)],
            baseAlpha: Math.random() * 0.18 + 0.05,
            gathered: 0,
            breathPhase: Math.random() * Math.PI * 2,
            breathSpeed: 0.008 + Math.random() * 0.004,
          })
        }
      }
    }

    // ── Build back grid (perspective-projected toward center) ─────────────
    function buildBackVectors(w, h) {
      backVectors = []
      const cx = w / 2
      const cy = h / 2

      // Extend source grid so projected points cover the full screen:
      // cx + (gx - cx) * BACK_SCALE = 0  →  gx = cx - cx/BACK_SCALE
      // Divide by GRID_SPACING to get col range, add padding
      const extraCols = Math.ceil(cx * (1 / BACK_SCALE - 1) / GRID_SPACING) + 2
      const extraRows = Math.ceil(cy * (1 / BACK_SCALE - 1) / GRID_SPACING) + 2

      bCols = cols + extraCols * 2
      bRows = rows + extraRows * 2

      for (let row = 0; row < bRows; row++) {
        for (let col = 0; col < bCols; col++) {
          // Source position (can be negative / outside screen)
          const gx = (col - extraCols) * GRID_SPACING
          const gy = (row - extraRows) * GRID_SPACING

          // Project toward vanishing point at center
          const pbx = cx + (gx - cx) * BACK_SCALE
          const pby = cy + (gy - cy) * BACK_SCALE

          const naturalAngle = Math.random() * Math.PI * 2
          backVectors.push({
            col, row,
            bx: pbx, by: pby,
            x:  pbx, y:  pby,
            angle: naturalAngle,
            naturalAngle,
            rotSpeed: (Math.random() - 0.5) * 0.003,
            color: BLUE_PALETTE[Math.floor(Math.random() * BLUE_PALETTE.length)],
            baseAlpha: Math.random() * 0.16 + 0.06,
            breathPhase: Math.random() * Math.PI * 2,
            breathSpeed: 0.006 + Math.random() * 0.003,
          })
        }
      }
    }

    function resize() {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
      buildVectors(canvas.width, canvas.height)
      buildBackVectors(canvas.width, canvas.height)
    }

    // ── Draw helpers ──────────────────────────────────────────────────────
    function drawArrow(x, y, angle, length, headSize, color, alpha, lineW = 1.1) {
      const ex = x + Math.cos(angle) * length
      const ey = y + Math.sin(angle) * length

      ctx.save()
      ctx.globalAlpha = alpha
      ctx.strokeStyle = color
      ctx.fillStyle   = color
      ctx.lineWidth   = lineW

      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(ex, ey)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(ex, ey)
      ctx.lineTo(ex - headSize * Math.cos(angle - Math.PI / 5), ey - headSize * Math.sin(angle - Math.PI / 5))
      ctx.lineTo(ex - headSize * Math.cos(angle + Math.PI / 5), ey - headSize * Math.sin(angle + Math.PI / 5))
      ctx.closePath()
      ctx.fill()

      ctx.restore()
    }

    // ── Front grid lines ──────────────────────────────────────────────────
    function drawGridLines() {
      ctx.save()
      ctx.lineWidth = 0.5

      const waveFreq  = 0.0055
      const waveSpeed = 0.012

      for (let i = 0; i < vectors.length; i++) {
        const v = vectors[i]
        const waveLine = Math.sin((v.bx + v.by) * waveFreq - time * waveSpeed) * 0.5 + 0.5

        if (v.col < cols - 1) {
          const right = vectors[v.row * cols + v.col + 1]
          if (right) {
            const mx = (v.x + right.x) / 2
            const my = (v.y + right.y) / 2
            const d   = Math.sqrt((mx - mouseX) ** 2 + (my - mouseY) ** 2)
            const inf = mouseX > 0 ? Math.max(0, 1 - d / INFLUENCE_RADIUS) : 0
            ctx.globalAlpha = 0.03 + waveLine * 0.06 + inf * 0.22
            ctx.strokeStyle = inf > 0.3 ? '#3366ff' : '#1a4fff'
            ctx.beginPath(); ctx.moveTo(v.x, v.y); ctx.lineTo(right.x, right.y); ctx.stroke()
          }
        }

        if (v.row < rows - 1) {
          const below = vectors[(v.row + 1) * cols + v.col]
          if (below) {
            const mx = (v.x + below.x) / 2
            const my = (v.y + below.y) / 2
            const d   = Math.sqrt((mx - mouseX) ** 2 + (my - mouseY) ** 2)
            const inf = mouseX > 0 ? Math.max(0, 1 - d / INFLUENCE_RADIUS) : 0
            ctx.globalAlpha = 0.03 + waveLine * 0.06 + inf * 0.22
            ctx.strokeStyle = inf > 0.3 ? '#3366ff' : '#1a4fff'
            ctx.beginPath(); ctx.moveTo(v.x, v.y); ctx.lineTo(below.x, below.y); ctx.stroke()
          }
        }
      }

      ctx.restore()
    }

    // ── Back grid lines ───────────────────────────────────────────────────
    function drawBackGridLines() {
      ctx.save()
      ctx.lineWidth = 0.4

      const waveFreq  = 0.0055
      const waveSpeed = 0.012

      for (let i = 0; i < backVectors.length; i++) {
        const v = backVectors[i]
        const waveLine = Math.sin((v.bx + v.by) * waveFreq - time * waveSpeed) * 0.5 + 0.5

        if (v.col < bCols - 1) {
          const right = backVectors[v.row * bCols + v.col + 1]
          if (right) {
            ctx.globalAlpha = (0.03 + waveLine * 0.07) * BACK_DIM
            ctx.strokeStyle = '#1a4fff'
            ctx.beginPath(); ctx.moveTo(v.x, v.y); ctx.lineTo(right.x, right.y); ctx.stroke()
          }
        }

        if (v.row < bRows - 1) {
          const below = backVectors[(v.row + 1) * bCols + v.col]
          if (below) {
            ctx.globalAlpha = (0.03 + waveLine * 0.07) * BACK_DIM
            ctx.strokeStyle = '#1a4fff'
            ctx.beginPath(); ctx.moveTo(v.x, v.y); ctx.lineTo(below.x, below.y); ctx.stroke()
          }
        }
      }

      ctx.restore()
    }

    function drawCursor() {
      if (mouseX < 0) return
      const x = mouseX
      const y = mouseY
      const pulse = Math.sin(time * 0.07) * 0.5 + 0.5

      ctx.save()

      ctx.beginPath()
      ctx.arc(x, y, 20 + pulse * 5, 0, Math.PI * 2)
      ctx.strokeStyle = '#00aaff'
      ctx.globalAlpha = 0.08 + pulse * 0.1
      ctx.lineWidth = 1
      ctx.stroke()

      const size = 24, gap = 7
      ctx.strokeStyle = '#00cfff'; ctx.lineWidth = 1; ctx.globalAlpha = 0.9
      ctx.beginPath()
      ctx.moveTo(x - size, y); ctx.lineTo(x - gap, y)
      ctx.moveTo(x + gap, y);  ctx.lineTo(x + size, y)
      ctx.moveTo(x, y - size); ctx.lineTo(x, y - gap)
      ctx.moveTo(x, y + gap);  ctx.lineTo(x, y + size)
      ctx.stroke()

      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.85; ctx.fill()

      const br = 18, bl = 7
      ctx.globalAlpha = 0.5 + pulse * 0.25; ctx.strokeStyle = '#3366ff'; ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x - br, y - br + bl); ctx.lineTo(x - br, y - br); ctx.lineTo(x - br + bl, y - br)
      ctx.moveTo(x + br - bl, y - br); ctx.lineTo(x + br, y - br); ctx.lineTo(x + br, y - br + bl)
      ctx.moveTo(x - br, y + br - bl); ctx.lineTo(x - br, y + br); ctx.lineTo(x - br + bl, y + br)
      ctx.moveTo(x + br - bl, y + br); ctx.lineTo(x + br, y + br); ctx.lineTo(x + br, y + br - bl)
      ctx.stroke()

      ctx.globalAlpha = 0.45; ctx.fillStyle = '#00aaff'; ctx.font = '9px monospace'
      ctx.fillText(`x:${Math.round(x)}  y:${Math.round(y)}`, x + br + 4, y - br + 2)

      ctx.restore()
    }

    // ── Main loop ─────────────────────────────────────────────────────────
    function animate() {
      time++
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const hasActiveMouse = mouseX > 0
      const waveFreq  = 0.0055
      const waveSpeed = 0.012

      // ── 1. Back layer (grid lines) ──────────────────────────────────────
      drawBackGridLines()

      // ── 2. Back layer (arrows + dots) ──────────────────────────────────
      for (let i = 0; i < backVectors.length; i++) {
        const v = backVectors[i]

        // Idle rotation only — no mouse interaction on back layer
        v.naturalAngle += v.rotSpeed
        v.angle += shortAngleDiff(v.angle, v.naturalAngle) * 0.03

        const breath = Math.sin(time * v.breathSpeed + v.breathPhase) * 0.5 + 0.5
        const wave   = Math.sin((v.bx + v.by) * waveFreq - time * waveSpeed) * 0.5 + 0.5
        const glow   = breath * 0.55 + wave * 0.45

        const alpha    = Math.min((v.baseAlpha + glow * 0.13) * BACK_DIM, 0.45)
        const arrowLen = (ARROW_LENGTH * BACK_SCALE) + glow * 1.5

        drawArrow(v.x, v.y, v.angle, arrowLen, ARROW_HEAD * BACK_SCALE, v.color, alpha, 0.8)

        ctx.save()
        ctx.beginPath()
        ctx.arc(v.x, v.y, 1.0, 0, Math.PI * 2)
        ctx.fillStyle   = v.color
        ctx.globalAlpha = Math.min((v.baseAlpha + glow * 0.10) * BACK_DIM * 1.8, 0.38)
        ctx.fill()
        ctx.restore()
      }

      // ── 3. Front layer (grid lines) ────────────────────────────────────
      drawGridLines()

      // ── 4. Front layer (arrows + dots) ────────────────────────────────
      for (let i = 0; i < vectors.length; i++) {
        const v = vectors[i]

        const dx   = hasActiveMouse ? mouseX - v.bx : 0
        const dy   = hasActiveMouse ? mouseY - v.by : 0
        const dist = hasActiveMouse ? Math.sqrt(dx * dx + dy * dy) : Infinity

        let gather = 0
        if (dist < INFLUENCE_RADIUS) gather = Math.pow(1 - dist / INFLUENCE_RADIUS, 1.6)
        v.gathered += (gather - v.gathered) * 0.1

        if (v.gathered > 0.005 && hasActiveMouse) {
          const toMouse = Math.atan2(dy, dx)
          v.angle += shortAngleDiff(v.angle, toMouse) * Math.min(v.gathered * 0.2, 0.18)
        } else {
          v.naturalAngle += v.rotSpeed
          v.angle += shortAngleDiff(v.angle, v.naturalAngle) * 0.035
        }

        if (v.gathered > 0.005) {
          const safeDist   = Math.max(dist, 1)
          const pullAmount = PULL_MAX * v.gathered * v.gathered
          v.x += (v.bx + (dx / safeDist) * pullAmount - v.x) * 0.12
          v.y += (v.by + (dy / safeDist) * pullAmount - v.y) * 0.12
        } else {
          v.x += (v.bx - v.x) * 0.09
          v.y += (v.by - v.y) * 0.09
        }

        const breath = Math.sin(time * v.breathSpeed + v.breathPhase) * 0.5 + 0.5
        const wave   = Math.sin((v.bx + v.by) * waveFreq - time * waveSpeed) * 0.5 + 0.5
        const glow   = breath * 0.55 + wave * 0.45

        const alpha    = Math.min(v.baseAlpha + glow * 0.14 + v.gathered * 0.58, 0.88)
        const arrowLen = ARROW_LENGTH + glow * 2.5 + v.gathered * 11

        drawArrow(v.x, v.y, v.angle, arrowLen, ARROW_HEAD, v.color, alpha)

        ctx.save()
        ctx.beginPath()
        ctx.arc(v.x, v.y, 1.3, 0, Math.PI * 2)
        ctx.fillStyle   = v.color
        ctx.globalAlpha = Math.min((v.baseAlpha + glow * 0.1 + v.gathered * 0.4) * 1.8, 0.7)
        ctx.fill()
        ctx.restore()
      }

      // ── 5. Cursor ──────────────────────────────────────────────────────
      drawCursor()

      animFrameId = requestAnimationFrame(animate)
    }

    function onMouseMove(e) {
      const r = canvas.getBoundingClientRect()
      mouseX = e.clientX - r.left
      mouseY = e.clientY - r.top
    }

    function onMouseLeave() {
      mouseX = -9999
      mouseY = -9999
    }

    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight
    buildVectors(canvas.width, canvas.height)
    buildBackVectors(canvas.width, canvas.height)
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
    <section
      style={{
        position: 'relative',
        display: 'block',
        width: '100%',
        height: '100vh',
        backgroundColor: '#080b11',
        cursor: 'none',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          position: 'absolute',
          top: 0, left: 0,
          width: '100%', height: '100%',
        }}
      />
    </section>
  )
}
