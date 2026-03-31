/**
 * Foliage Border — dense tea leaf branches framing the screen edges.
 * Leaves grow from stems that emerge from corners and edges inward.
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

          // Remove white background
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

/**
 * A branch is a curved stem line with leaves growing off it.
 * It originates from an edge/corner and curves inward.
 */
function generateBranches(w, h) {
  const branches = []
  const short = Math.min(w, h)

  // Push origins outside the screen so stems are hidden behind the edge
  const out = short * 0.08 // how far outside the screen origins sit

  const origins = [
    // Corners — multiple branches for density
    { x: -out, y: -out, angle: Math.PI * 0.28 },
    { x: -out, y: -out, angle: Math.PI * 0.38 },
    { x: -out, y: -out, angle: Math.PI * 0.2 },
    { x: w + out, y: -out, angle: Math.PI * 0.62 },
    { x: w + out, y: -out, angle: Math.PI * 0.72 },
    { x: w + out, y: -out, angle: Math.PI * 0.8 },
    { x: -out, y: h + out, angle: -Math.PI * 0.28 },
    { x: -out, y: h + out, angle: -Math.PI * 0.38 },
    { x: -out, y: h + out, angle: -Math.PI * 0.2 },
    { x: w + out, y: h + out, angle: -Math.PI * 0.62 },
    { x: w + out, y: h + out, angle: -Math.PI * 0.72 },
    { x: w + out, y: h + out, angle: -Math.PI * 0.8 },
    // Left edge
    { x: -out, y: h * 0.2, angle: Math.PI * 0.08 },
    { x: -out, y: h * 0.4, angle: Math.PI * 0.03 },
    { x: -out, y: h * 0.6, angle: -Math.PI * 0.03 },
    { x: -out, y: h * 0.8, angle: -Math.PI * 0.08 },
    // Right edge
    { x: w + out, y: h * 0.2, angle: Math.PI * 0.92 },
    { x: w + out, y: h * 0.4, angle: Math.PI * 0.97 },
    { x: w + out, y: h * 0.6, angle: -Math.PI * 0.97 },
    { x: w + out, y: h * 0.8, angle: -Math.PI * 0.92 },
    // Top edge
    { x: w * 0.2, y: -out, angle: Math.PI * 0.46 },
    { x: w * 0.4, y: -out, angle: Math.PI * 0.48 },
    { x: w * 0.6, y: -out, angle: Math.PI * 0.52 },
    { x: w * 0.8, y: -out, angle: Math.PI * 0.54 },
    // Bottom edge
    { x: w * 0.2, y: h + out, angle: -Math.PI * 0.46 },
    { x: w * 0.4, y: h + out, angle: -Math.PI * 0.48 },
    { x: w * 0.6, y: h + out, angle: -Math.PI * 0.52 },
    { x: w * 0.8, y: h + out, angle: -Math.PI * 0.54 },
  ]

  for (const origin of origins) {
    const stemLength = short * (0.18 + Math.random() * 0.14)
    const curve = (Math.random() - 0.5) * 0.4
    const leafCount = 6 + Math.floor(Math.random() * 6)
    const leafSize = short * (0.12 + Math.random() * 0.09)

    // Generate stem points along a curved path
    const stemPoints = []
    for (let t = 0; t <= 1; t += 0.05) {
      const a = origin.angle + curve * t * t
      stemPoints.push({
        x: origin.x + Math.cos(a) * stemLength * t,
        y: origin.y + Math.sin(a) * stemLength * t,
      })
    }

    // Place leaves along the stem
    const leaves = []
    for (let i = 0; i < leafCount; i++) {
      const t = 0.15 + (i / leafCount) * 0.8 + Math.random() * 0.05
      const idx = Math.min(Math.floor(t * stemPoints.length), stemPoints.length - 1)
      const pt = stemPoints[idx]

      // Alternate sides
      const side = i % 2 === 0 ? 1 : -1
      const branchAngle = origin.angle + curve * t * t
      const leafAngle = branchAngle + side * (0.4 + Math.random() * 0.5)

      // Size tapers toward tip
      const taper = 1 - t * 0.4
      const size = leafSize * taper * (0.8 + Math.random() * 0.4)

      // Point leaf tip toward screen center
      const lx = pt.x + Math.cos(leafAngle) * size * 0.3
      const ly = pt.y + Math.sin(leafAngle) * size * 0.3
      const angleToCenter = Math.atan2(h / 2 - ly, w / 2 - lx)

      leaves.push({
        x: lx,
        y: ly,
        size,
        rotation: angleToCenter + Math.PI / 2 + (Math.random() - 0.5) * 0.4,
        spriteIdx: Math.floor(Math.random() * 6),
        swayOffset: Math.random() * Math.PI * 2,
        swaySpeed: 0.3 + Math.random() * 0.4,
        swayAmp: 0.03 + Math.random() * 0.04,
        depth: t, // for brightness
      })
    }

    branches.push({
      origin,
      stemPoints,
      leaves,
      stemLength,
    })
  }

  return branches
}

export async function initFoliageBorder(canvasEl) {
  const ctx = canvasEl.getContext('2d')
  const sprites = await loadLeafSprites()
  if (sprites.length === 0) return

  let w, h, dpr, branches

  function resize() {
    dpr = Math.min(window.devicePixelRatio, 2)
    w = window.innerWidth
    h = window.innerHeight
    canvasEl.width = w * dpr
    canvasEl.height = h * dpr
    canvasEl.style.width = w + 'px'
    canvasEl.style.height = h + 'px'
    branches = generateBranches(w * dpr, h * dpr)
  }

  window.addEventListener('resize', resize)
  resize()

  const startTime = performance.now()

  function draw() {
    requestAnimationFrame(draw)
    const t = (performance.now() - startTime) / 1000

    ctx.clearRect(0, 0, w * dpr, h * dpr)

    for (const branch of branches) {
      // Draw stem line
      ctx.beginPath()
      ctx.moveTo(branch.stemPoints[0].x, branch.stemPoints[0].y)
      for (let i = 1; i < branch.stemPoints.length; i++) {
        ctx.lineTo(branch.stemPoints[i].x, branch.stemPoints[i].y)
      }
      ctx.strokeStyle = 'rgb(45, 70, 38)'
      ctx.lineWidth = 2 * dpr
      ctx.stroke()

      // Draw leaves
      for (const leaf of branch.leaves) {
        const sway = Math.sin(t * leaf.swaySpeed + leaf.swayOffset) * leaf.swayAmp
        const sprite = sprites[leaf.spriteIdx % sprites.length]

        ctx.save()
        ctx.globalAlpha = 1

        // Deeper leaves slightly darker
        const brightness = 0.55 + leaf.depth * 0.35
        ctx.filter = `brightness(${brightness})`

        ctx.translate(leaf.x, leaf.y)
        ctx.rotate(leaf.rotation + sway)
        ctx.drawImage(sprite, -leaf.size / 2, -leaf.size, leaf.size, leaf.size)
        ctx.restore()
      }
    }
  }

  draw()
}
