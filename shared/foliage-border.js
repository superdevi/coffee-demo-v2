/**
 * Foliage Border — lush leaves growing out from the 4 corners,
 * tips pointing inward toward the cup. Like plants growing from
 * behind each corner into the frame.
 */

const LEAF_COLS = 3
const LEAF_ROWS = 2

function loadLeafSprites() {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const cw = Math.floor(img.width / LEAF_COLS)
      const ch = Math.floor(img.height / LEAF_ROWS)
      const sprites = []

      for (let row = 0; row < LEAF_ROWS; row++) {
        for (let col = 0; col < LEAF_COLS; col++) {
          const c = document.createElement('canvas')
          c.width = cw
          c.height = ch
          const ctx = c.getContext('2d')
          ctx.drawImage(img, col * cw, row * ch, cw, ch, 0, 0, cw, ch)

          const imageData = ctx.getImageData(0, 0, cw, ch)
          const d = imageData.data
          for (let i = 0; i < d.length; i += 4) {
            const r = d[i], g = d[i + 1], b = d[i + 2]
            if (r > 230 && g > 230 && b > 230) {
              d[i + 3] = 0
            } else if (r > 200 && g > 200 && b > 200) {
              d[i + 3] = Math.floor((255 - Math.max(r, g, b)) * 4.6)
            }
          }
          ctx.putImageData(imageData, 0, 0)
          sprites.push(c)
        }
      }
      resolve(sprites)
    }
    img.onerror = () => resolve([])
    img.src = '/assets/sprites/leaves.png'
  })
}

function generateLeaves(w, h) {
  const leaves = []
  const cx = w / 2
  const cy = h / 2
  const short = Math.min(w, h)

  // 4 corners — leaves radiate outward from each corner point
  const corners = [
    { x: 0, y: 0 },       // top-left
    { x: w, y: 0 },       // top-right
    { x: 0, y: h },       // bottom-left
    { x: w, y: h },       // bottom-right
  ]

  const leavesPerCorner = 30

  for (const corner of corners) {
    // Angle from corner toward center
    const baseAngle = Math.atan2(cy - corner.y, cx - corner.x)

    for (let layer = 0; layer < 3; layer++) {
      const count = layer === 0 ? 12 : layer === 1 ? 10 : 8
      const brightness = layer === 0 ? 0.4 : layer === 1 ? 0.6 : 0.8

      for (let i = 0; i < count; i++) {
        // Spread leaves in a fan from the corner
        // Angle varies ±60° around the base angle toward center
        const angleSpread = (Math.random() - 0.5) * Math.PI * 0.7
        const angle = baseAngle + angleSpread

        // Distance from corner — start behind the corner so stems are cropped off
        const dist = short * (-0.08 + Math.random() * 0.28)

        const x = corner.x + Math.cos(angle) * dist
        const y = corner.y + Math.sin(angle) * dist

        // Size — big, overlapping
        const size = short * (0.2 + Math.random() * 0.18)

        // Tip points toward center from this leaf's position
        const tipAngle = Math.atan2(cy - y, cx - x)

        leaves.push({
          x,
          y,
          size,
          rotation: tipAngle + (Math.random() - 0.5) * 0.4,
          spriteIdx: Math.floor(Math.random() * 6),
          brightness: brightness + (Math.random() - 0.5) * 0.1,
          swaySpeed: 0.25 + Math.random() * 0.35,
          swayAmp: 0.02 + Math.random() * 0.03,
          swayOffset: Math.random() * Math.PI * 2,
        })
      }
    }
  }

  // Edge leaves — fill the borders between corners
  // More points along longer sides (portrait mobile = tall sides)
  const sideCount = Math.max(8, Math.round(h / (short * 0.12)))
  const topBottomCount = Math.max(4, Math.round(w / (short * 0.14)))

  const edgeDefs = [
    // left edge
    ...Array.from({ length: sideCount }, (_, i) => ({
      x: 0, y: h * ((i + 0.5) / sideCount), fromAngle: 0
    })),
    // right edge
    ...Array.from({ length: sideCount }, (_, i) => ({
      x: w, y: h * ((i + 0.5) / sideCount), fromAngle: Math.PI
    })),
    // top edge
    ...Array.from({ length: topBottomCount }, (_, i) => ({
      x: w * ((i + 0.5) / topBottomCount), y: 0, fromAngle: Math.PI / 2
    })),
    // bottom edge
    ...Array.from({ length: topBottomCount }, (_, i) => ({
      x: w * ((i + 0.5) / topBottomCount), y: h, fromAngle: -Math.PI / 2
    })),
  ]

  for (const edge of edgeDefs) {
    for (let layer = 0; layer < 2; layer++) {
      const count = layer === 0 ? 3 : 2
      const brightness = layer === 0 ? 0.45 : 0.7

      for (let i = 0; i < count; i++) {
        const angleJitter = (Math.random() - 0.5) * 0.6
        const angle = edge.fromAngle + angleJitter
        const dist = short * (-0.1 + Math.random() * 0.12)

        const x = edge.x + Math.cos(angle) * dist
        const y = edge.y + Math.sin(angle) * dist

        const size = short * (0.18 + Math.random() * 0.14)
        const tipAngle = Math.atan2(cy - y, cx - x)

        leaves.push({
          x,
          y,
          size,
          rotation: tipAngle + (Math.random() - 0.5) * 0.4,
          spriteIdx: Math.floor(Math.random() * 6),
          brightness: brightness + (Math.random() - 0.5) * 0.1,
          swaySpeed: 0.25 + Math.random() * 0.35,
          swayAmp: 0.02 + Math.random() * 0.03,
          swayOffset: Math.random() * Math.PI * 2,
        })
      }
    }
  }

  leaves.sort((a, b) => a.brightness - b.brightness)
  return leaves
}

export async function initFoliageBorder(canvasEl) {
  const ctx = canvasEl.getContext('2d')
  const sprites = await loadLeafSprites()
  if (sprites.length === 0) return { setRustling() {} }

  let w, h, dpr, leaves
  let rustling = false
  let rustleIntensity = 0 // smooth transition 0→1

  function resize() {
    dpr = Math.min(window.devicePixelRatio, 2)
    w = window.innerWidth
    h = window.innerHeight
    canvasEl.width = w * dpr
    canvasEl.height = h * dpr
    canvasEl.style.width = w + 'px'
    canvasEl.style.height = h + 'px'
    leaves = generateLeaves(w * dpr, h * dpr)
  }

  window.addEventListener('resize', resize)
  resize()

  const startTime = performance.now()

  function draw() {
    requestAnimationFrame(draw)
    const t = (performance.now() - startTime) / 1000

    // Smooth ramp rustle intensity
    const target = rustling ? 1 : 0
    rustleIntensity += (target - rustleIntensity) * 0.06

    ctx.clearRect(0, 0, w * dpr, h * dpr)

    for (const leaf of leaves) {
      // Base gentle sway + rustle layer (faster, more chaotic)
      const baseSway = Math.sin(t * leaf.swaySpeed + leaf.swayOffset) * leaf.swayAmp
      const rustle = rustleIntensity * (
        Math.sin(t * 3.5 + leaf.swayOffset * 2.7) * 0.08 +
        Math.sin(t * 5.2 + leaf.swayOffset * 1.3) * 0.05 +
        Math.cos(t * 7.1 + leaf.swayOffset * 3.1) * 0.03
      )
      const sway = baseSway + rustle

      const sprite = sprites[leaf.spriteIdx % sprites.length]

      ctx.save()
      ctx.globalAlpha = 1
      ctx.filter = `brightness(${leaf.brightness})`

      ctx.translate(leaf.x, leaf.y)
      ctx.rotate(leaf.rotation + sway)
      ctx.drawImage(sprite, -leaf.size / 2, -leaf.size, leaf.size, leaf.size)
      ctx.restore()
    }
  }

  draw()

  return {
    setRustling(active) { rustling = active }
  }
}
