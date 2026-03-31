import * as THREE from 'three'

const TEAL = new THREE.Color(0x2dd4a8)
const TEAL_DIM = new THREE.Color(0x1a7a60)
const GOLD = new THREE.Color(0xe8c9a0)

const PARTICLE_COUNT = 140
const RING_COUNT = 3
const CONNECT_DIST = 1.0
const MOUSE_RADIUS = 2.0

export function initBgScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 50)
  camera.position.z = 5

  // --- Particles ---
  const positions = new Float32Array(PARTICLE_COUNT * 3)
  const colors = new Float32Array(PARTICLE_COUNT * 3)
  const sizes = new Float32Array(PARTICLE_COUNT)
  const meta = []

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const ring = i % RING_COUNT
    const radius = 1.2 + ring * 0.9
    const angle = Math.random() * Math.PI * 2
    const speed = (0.06 + Math.random() * 0.05) * (ring % 2 === 0 ? 1 : -1)
    const baseY = (Math.random() - 0.5) * 2.0

    meta.push({ ring, angle, speed, radius, baseY })

    positions[i * 3] = Math.cos(angle) * radius
    positions[i * 3 + 1] = baseY
    positions[i * 3 + 2] = Math.sin(angle) * radius * 0.3

    const c = ring === 0 ? TEAL : ring === 1 ? TEAL_DIM : GOLD
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b

    sizes[i] = 4.0 + Math.random() * 4.0
  }

  const particleGeo = new THREE.BufferGeometry()
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  particleGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

  const particleMat = new THREE.ShaderMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uPixelRatio: { value: renderer.getPixelRatio() } },
    vertexShader: `
      attribute float size;
      varying vec3 vColor;
      varying float vSize;
      uniform float uPixelRatio;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * uPixelRatio * (4.0 / -mv.z);
        vSize = gl_PointSize;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vSize;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        // soft glow: bright core + wide falloff
        float core = 1.0 - smoothstep(0.0, 0.4, d);
        float glow = 1.0 - smoothstep(0.0, 1.0, d);
        float alpha = core * 0.9 + glow * 0.35;
        gl_FragColor = vec4(vColor * (core * 1.5 + 0.5), alpha);
      }
    `
  })

  const points = new THREE.Points(particleGeo, particleMat)
  scene.add(points)

  // --- Connection lines ---
  const MAX_LINES = 400
  const linePositions = new Float32Array(MAX_LINES * 6)
  const lineColors = new Float32Array(MAX_LINES * 6)
  const lineGeo = new THREE.BufferGeometry()
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3))
  lineGeo.setAttribute('color', new THREE.BufferAttribute(lineColors, 3))
  lineGeo.setDrawRange(0, 0)

  const lineMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
  const lines = new THREE.LineSegments(lineGeo, lineMat)
  scene.add(lines)

  // --- Mouse tracking (listen on window since canvas is pointer-events:none) ---
  const mouse = new THREE.Vector2(9999, 9999)
  const mouseWorld = new THREE.Vector3()
  const raycaster = new THREE.Raycaster()
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)

  function onPointerMove(e) {
    const x = e.touches ? e.touches[0].clientX : e.clientX
    const y = e.touches ? e.touches[0].clientY : e.clientY
    mouse.x = (x / window.innerWidth) * 2 - 1
    mouse.y = -(y / window.innerHeight) * 2 + 1
  }

  function onPointerLeave() {
    mouse.set(9999, 9999)
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('touchmove', onPointerMove, { passive: true })
  document.addEventListener('mouseleave', onPointerLeave)

  // --- Resize ---
  function resize() {
    const w = window.innerWidth
    const h = window.innerHeight
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    particleMat.uniforms.uPixelRatio.value = renderer.getPixelRatio()
  }

  window.addEventListener('resize', resize)
  resize()

  // --- Animate ---
  const clock = new THREE.Clock()
  const pos = particleGeo.attributes.position

  function animate() {
    requestAnimationFrame(animate)
    const t = clock.getElapsedTime()

    // Project mouse into world space
    raycaster.setFromCamera(mouse, camera)
    raycaster.ray.intersectPlane(plane, mouseWorld)

    // Update particles
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const m = meta[i]
      m.angle += m.speed * 0.008
      const wobble = Math.sin(t * 0.5 + i) * 0.08

      let x = Math.cos(m.angle) * (m.radius + wobble)
      let y = m.baseY + Math.sin(t * 0.3 + m.angle * 2) * 0.2
      let z = Math.sin(m.angle) * m.radius * 0.3

      // Mouse repulsion
      const dx = x - mouseWorld.x
      const dy = y - mouseWorld.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < MOUSE_RADIUS && dist > 0.01) {
        const force = (1 - dist / MOUSE_RADIUS) * 0.8
        x += (dx / dist) * force
        y += (dy / dist) * force
      }

      pos.array[i * 3] = x
      pos.array[i * 3 + 1] = y
      pos.array[i * 3 + 2] = z
    }
    pos.needsUpdate = true

    // Update connections
    let lineIdx = 0
    for (let i = 0; i < PARTICLE_COUNT && lineIdx < MAX_LINES; i++) {
      for (let j = i + 1; j < PARTICLE_COUNT && lineIdx < MAX_LINES; j++) {
        const ax = pos.array[i * 3], ay = pos.array[i * 3 + 1], az = pos.array[i * 3 + 2]
        const bx = pos.array[j * 3], by = pos.array[j * 3 + 1], bz = pos.array[j * 3 + 2]
        const d = Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2)
        if (d < CONNECT_DIST) {
          const o = lineIdx * 6
          linePositions[o] = ax; linePositions[o + 1] = ay; linePositions[o + 2] = az
          linePositions[o + 3] = bx; linePositions[o + 4] = by; linePositions[o + 5] = bz

          const fade = 1 - d / CONNECT_DIST
          lineColors[o] = TEAL.r * fade; lineColors[o + 1] = TEAL.g * fade; lineColors[o + 2] = TEAL.b * fade
          lineColors[o + 3] = TEAL.r * fade; lineColors[o + 4] = TEAL.g * fade; lineColors[o + 5] = TEAL.b * fade
          lineIdx++
        }
      }
    }
    lineGeo.setDrawRange(0, lineIdx * 2)
    lineGeo.attributes.position.needsUpdate = true
    lineGeo.attributes.color.needsUpdate = true

    // Subtle camera sway
    camera.position.x = Math.sin(t * 0.1) * 0.15
    camera.position.y = Math.cos(t * 0.08) * 0.1
    camera.lookAt(0, 0, 0)

    renderer.render(scene, camera)
  }

  animate()
}
