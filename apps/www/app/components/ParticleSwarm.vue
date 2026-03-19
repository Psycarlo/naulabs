<template>
  <div ref="containerRef" class="particle-swarm" />
</template>

<script setup lang="ts">
  import * as THREE from 'three'
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

  const containerRef = useTemplateRef<HTMLDivElement>('containerRef')

  const COUNT = 20_000
  const SPEED_MULT = 1

  const PARAMS: Record<string, number> = {
    scale: 30,
    waveSpeed: 0.3,
    windForce: 6.6,
    rowSpeed: 1.1
  }

  const addControl = (
    id: string,
    _label: string,
    _min: number,
    _max: number,
    val: number
  ): number => (PARAMS[id] !== undefined ? PARAMS[id] : val)

  let animationId: number | null = null

  onMounted(() => {
    const container = containerRef.value
    if (!container) {
      return
    }

    const scene = new THREE.Scene()

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      2000
    )
    camera.position.set(0, 80, 100)

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    })
    renderer.setClearColor(0x00_00_00, 0)
    renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.autoRotate = false
    controls.enableZoom = false

    const dummy = new THREE.Object3D()
    const color = new THREE.Color()
    const target = new THREE.Vector3()

    const geometry = new THREE.TetrahedronGeometry(0.25)
    const material = new THREE.MeshBasicMaterial({ color: 0xff_ff_ff })
    const mesh = new THREE.InstancedMesh(geometry, material, COUNT)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    scene.add(mesh)

    const positions: THREE.Vector3[] = []
    for (let i = 0; i < COUNT; i++) {
      positions.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 100,
          (Math.random() - 0.5) * 100,
          (Math.random() - 0.5) * 100
        )
      )
      mesh.setColorAt(i, color.setHex(0x00_ff_88))
    }

    const clock = new THREE.Clock()

    const computeShipParticle = (
      i: number,
      count: number,
      time: number
    ): {
      x: number
      y: number
      z: number
      h: number
      s: number
      l: number
    } | null => {
      const scale = addControl('scale', 'Ship Scale', 10, 100, 45)
      const waveSpeed = addControl('waveSpeed', 'Sea Wave Speed', 0, 5, 2.0)
      const windForce = addControl('windForce', 'Wind Force', 0, 20, 10.0)
      const rowSpeed = addControl('rowSpeed', 'Rowing Speed', 0, 10, 6.0)

      const u = i / count
      if (u >= 0.8) {
        return null
      }

      const r1 = Math.sin(i * 13.412)
      const r2 = Math.cos(i * 37.193)
      const r3 = Math.sin(i * 73.912)
      const r4 = Math.cos(i * 103.11)

      let x = 0
      let y = 0
      let z = 0
      let h = 0
      let s = 0
      let l = 0

      if (u < 0.4) {
        z = r1 * 1.3
        const wp = 1.0 - (z * z) / 1.69
        const shell = r2 > 0 ? 1 : -1
        x = shell * 0.4 * wp * (0.8 + 0.2 * r3)
        const hp = (r4 * 0.5 + 0.5) * 0.4
        y = hp + Math.abs(z) ** 2.5 * 0.25

        h = 0
        s = 0
        l = 0.1 + y * 0.15

        if (z < -1.1) {
          x = r2 * 0.05
          const sternCurve = Math.abs(r4) * 0.4
          z = -1.1 - sternCurve
          y = 0.4 + sternCurve ** 1.5 * 3.0 + r3 * 0.05
        }
      } else if (u < 0.55) {
        const oarId = Math.floor((u - 0.4) * count)
        const oarIndex = Math.floor(oarId / 20)
        const maxOars = Math.floor((0.15 * count) / 20)
        const oarZ = (oarIndex / maxOars) * 2.0 - 1.0
        const side = oarIndex % 2 === 0 ? 1 : -1
        const oarT = (oarId % 20) / 19.0

        const rowPhase = time * rowSpeed + oarZ * 2.0
        const dip = Math.sin(rowPhase)
        const sweep = Math.cos(rowPhase)

        x = side * (0.35 + oarT * 0.7) + side * sweep * oarT * 0.25
        y = 0.35 + dip * oarT * 0.2
        z = oarZ - sweep * oarT * 0.4

        h = 0
        s = 0
        l = 0.08 + oarT * 0.1
      } else if (u < 0.75) {
        const sx = r1 * 0.9
        const sy = (r2 * 0.5 + 0.5) * 1.5 + 0.5

        let billow = Math.sin(sx * 2.0) * 0.15 + Math.sin(sy * 1.5) * 0.15
        billow += Math.sin(time * waveSpeed + sy) * (windForce * 0.005)
        const cornerPull = Math.abs(sx) ** 2.0 * 0.4

        x = -sx
        y = sy
        z = -(0.1 + billow - cornerPull)

        h = 0
        s = 0
        l = 0.2 + r3 * 0.08
      } else {
        const subU = (u - 0.75) / 0.05
        if (subU < 0.5) {
          x = r1 * 0.04
          z = r2 * 0.04 + 0.1
          y = (r3 * 0.5 + 0.5) * 2.1
          h = 0
          s = 0
          l = 0.08
        } else {
          const shieldId = Math.floor((subU - 0.5) * 2.0 * count)
          const sIdx = Math.floor(shieldId / 15)
          const sSide = sIdx % 2 === 0 ? 1 : -1
          const sz = ((sIdx / 30) * 2.2 - 1.1) % 1.2
          const wpS = 1.0 - (sz * sz) / 1.69

          x = sSide * 0.42 * wpS + r1 * 0.03
          y = 0.45 + r2 * 0.04 + Math.abs(sz) ** 2.5 * 0.3
          z = sz + r3 * 0.03
          h = 0
          s = 0
          l = 0.12 + Math.abs(r1) * 0.1
        }
      }

      // Apply ship motion
      const shipPitch = Math.sin(time * waveSpeed * 0.6) * 0.08
      const shipRoll = Math.cos(time * waveSpeed * 0.8) * 0.05
      const shipY = Math.sin(time * waveSpeed * 1.2) * 0.05

      let ny = y * Math.cos(shipPitch) - z * Math.sin(shipPitch)
      const nz = y * Math.sin(shipPitch) + z * Math.cos(shipPitch)
      y = ny
      z = nz

      const nx = x * Math.cos(shipRoll) - y * Math.sin(shipRoll)
      ny = x * Math.sin(shipRoll) + y * Math.cos(shipRoll)
      x = nx
      y = ny
      y += shipY

      return { x: x * scale, y: y * scale, z: z * scale, h, s, l }
    }

    const CAM_RADIUS = 100
    const SWING_DEG = 12
    const SWING_RAD = (SWING_DEG * Math.PI) / 180
    const SWING_SPEED = 0.3

    const animate = () => {
      animationId = requestAnimationFrame(animate)
      const time = clock.getElapsedTime() * SPEED_MULT

      // Oscillate camera between -12 and +12 degrees, facing the side
      const baseAngle = Math.PI / 2
      const swing = Math.sin(time * SWING_SPEED) * SWING_RAD
      const angle = baseAngle + swing
      camera.position.x = Math.sin(angle) * CAM_RADIUS
      camera.position.z = Math.cos(angle) * CAM_RADIUS
      camera.lookAt(0, 0, 0)

      controls.update()

      for (let i = 0; i < COUNT; i++) {
        const pos = positions[i]
        if (!pos) {
          continue
        }

        const result = computeShipParticle(i, COUNT, time)
        if (result) {
          target.set(result.x, result.y, result.z)
          color.setHSL(result.h, result.s, result.l)
        } else {
          target.set(0, -9999, 0)
          color.setHSL(0, 0, 0)
        }

        pos.lerp(target, 0.1)
        dummy.position.copy(pos)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        mesh.setColorAt(i, color)
      }
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true
      }

      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      if (!container) {
        return
      }
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }
    window.addEventListener('resize', onResize)

    onBeforeUnmount(() => {
      window.removeEventListener('resize', onResize)
      if (animationId !== null) {
        cancelAnimationFrame(animationId)
      }
      renderer.dispose()
      geometry.dispose()
      material.dispose()
      controls.dispose()
    })
  })
</script>

<style scoped>
  .particle-swarm {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
</style>
