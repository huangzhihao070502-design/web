'use client'
import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function floatingMistGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(3.5, 16, 16)
  const pos = geo.attributes.position.array as Float32Array
  const scale = new Float32Array(pos.length / 3)
  for (let i = 0; i < scale.length; i++) {
    scale[i] = 0.4 + Math.random() * 1.2
  }
  geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1))
  return geo
}

function FloatingMist() {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const count = 8
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const geometry = useMemo(() => floatingMistGeometry(), [])

  const transforms = useMemo(() => {
    const t = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      t[i * 3] = (Math.random() - 0.5) * 14
      t[i * 3 + 1] = (Math.random() - 0.5) * 10
      t[i * 3 + 2] = (Math.random() - 0.5) * 8 - 2
    }
    return t
  }, [])

  const phases = useMemo(() => Float32Array.from({ length: count }, () => Math.random() * Math.PI * 2), [])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * 0.04
    for (let i = 0; i < count; i++) {
      const p = phases[i]
      const tx = transforms[i * 3] + Math.sin(t * 0.5 + p) * 0.4
      const ty = transforms[i * 3 + 1] + Math.cos(t * 0.3 + p * 0.7) * 0.3
      const tz = transforms[i * 3 + 2] + Math.sin(t * 0.2 + p * 1.2) * 0.2
      dummy.position.set(tx, ty, tz)
      const s = 0.8 + Math.sin(t * 0.4 + p) * 0.3
      dummy.scale.setScalar(s)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, count]} frustumCulled={false}>
      <meshBasicMaterial
        color="#1A1A1A"
        transparent
        opacity={0.05}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  )
}

function DistantMountains() {
  const lineRef = useRef<THREE.Line>(null!)
  const pointCount = 180
  const positions = useMemo(() => {
    const pos = new Float32Array(pointCount * 3)
    for (let i = 0; i < pointCount; i++) {
      const x = (i / (pointCount - 1)) * 18 - 9
      const y = (
        Math.sin(i * 0.12) * 0.9 +
        Math.sin(i * 0.07 + 1.3) * 0.6 +
        Math.sin(i * 0.03 + 2.7) * 1.2 +
        1.5 +
        (Math.random() - 0.5) * 0.15
      )
      pos[i * 3] = x
      pos[i * 3 + 1] = y * 0.5
      pos[i * 3 + 2] = -4.5
    }
    return pos
  }, [])

  const positions2 = useMemo(() => {
    const pos = new Float32Array(pointCount * 3)
    for (let i = 0; i < pointCount; i++) {
      const x = (i / (pointCount - 1)) * 20 - 10
      const y = (
        Math.cos(i * 0.09 + 0.5) * 0.7 +
        Math.sin(i * 0.05 + 2.1) * 0.5 +
        Math.cos(i * 0.02 + 1.8) * 1.0 +
        2.0 +
        (Math.random() - 0.5) * 0.1
      )
      pos[i * 3] = x
      pos[i * 3 + 1] = y * 0.45
      pos[i * 3 + 2] = -5.5
    }
    return pos
  }, [])

  useFrame(({ clock }) => {
    if (!lineRef.current) return
    const t = clock.getElapsedTime() * 0.015
    const pos = lineRef.current.geometry.attributes.position.array as Float32Array
    for (let i = 0; i < pointCount; i++) {
      const xBase = (i / (pointCount - 1)) * 18 - 9
      pos[i * 3] = xBase + Math.sin(t + i * 0.02) * 0.08
      pos[i * 3 + 1] += Math.sin(t * 0.5 + i * 0.1) * 0.0002
    }
    lineRef.current.geometry.attributes.position.needsUpdate = true
  })

  const lineGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3))
    return g
  }, [])

  const lineGeo2 = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions2.slice(), 3))
    return g
  }, [])

  return (
    <group>
      <line geometry={lineGeo}>
        <lineBasicMaterial color="#1A1A1A" transparent opacity={0.035} depthWrite={false} />
      </line>
      <line geometry={lineGeo2}>
        <lineBasicMaterial color="#1A1A1A" transparent opacity={0.025} depthWrite={false} />
      </line>
    </group>
  )
}

function InkParticles() {
  const meshRef = useRef<THREE.Points>(null!)
  const count = 220
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16
      pos[i * 3 + 1] = (Math.random() - 0.5) * 12
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10 - 1
    }
    return pos
  }, [])

  const velocities = useMemo(() => {
    const v = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      v[i * 3] = (Math.random() - 0.5) * 0.004
      v[i * 3 + 1] = (Math.random() - 0.5) * 0.003
      v[i * 3 + 2] = (Math.random() - 0.5) * 0.002
    }
    return v
  }, [])

  const phases2 = useMemo(() => Float32Array.from({ length: count }, () => Math.random() * Math.PI * 2), [])

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const t = clock.getElapsedTime() * 0.02
    const pos = meshRef.current.geometry.attributes.position.array as Float32Array
    for (let i = 0; i < count; i++) {
      pos[i * 3] += velocities[i * 3] + Math.sin(t + phases2[i]) * 0.001
      pos[i * 3 + 1] += velocities[i * 3 + 1] + Math.cos(t * 0.7 + phases2[i] * 0.5) * 0.001
      pos[i * 3 + 2] += velocities[i * 3 + 2] + Math.sin(t * 0.5 + phases2[i] * 0.3) * 0.0005

      // Wrap around when out of bounds
      if (Math.abs(pos[i * 3]) > 9) pos[i * 3] *= -0.9
      if (Math.abs(pos[i * 3 + 1]) > 7) pos[i * 3 + 1] *= -0.9
      if (Math.abs(pos[i * 3 + 2]) > 6) pos[i * 3 + 2] *= -0.9
    }
    meshRef.current.geometry.attributes.position.needsUpdate = true
  })

  const sizes = useMemo(() => {
    const s = new Float32Array(count)
    for (let i = 0; i < count; i++) s[i] = 0.01 + Math.random() * 0.04
    return s
  }, [])

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        color="#1A1A1A"
        transparent
        opacity={0.05}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}

function random1D(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function noise2D(x: number, y: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)

  const n00 = random1D(ix + iy * 57.0)
  const n10 = random1D(ix + 1 + iy * 57.0)
  const n01 = random1D(ix + (iy + 1) * 57.0)
  const n11 = random1D(ix + 1 + (iy + 1) * 57.0)

  const nx0 = n00 + (n10 - n00) * sx
  const nx1 = n01 + (n11 - n01) * sx
  return nx0 + (nx1 - nx0) * sy
}

function TransparentNoise() {
  const meshRef = useRef<THREE.Mesh>(null!)
  const gridW = 48
  const gridH = 32

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(16, 12, gridW, gridH)
    geo.rotateX(-Math.PI / 2)
    return geo
  }, [])

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const t = clock.getElapsedTime() * 0.03
    const colors = meshRef.current.geometry.attributes.color as THREE.BufferAttribute
    if (!colors) return
    const colArray = colors.array as Float32Array
    const posArray = meshRef.current.geometry.attributes.position.array as Float32Array
    const vertexCount = (gridW + 1) * (gridH + 1)

    for (let i = 0; i < vertexCount; i++) {
      const px = posArray[i * 3]
      const py = posArray[i * 3 + 1]
      const n = noise2D(px * 0.5 + t, py * 0.5 + t * 0.7)
      const alpha = Math.max(0, n * 0.05)
      colArray[i * 4] = 0.1
      colArray[i * 4 + 1] = 0.1
      colArray[i * 4 + 2] = 0.1
      colArray[i * 4 + 3] = alpha
    }
    colors.needsUpdate = true
  })

  const initialColors = useMemo(() => {
    const len = (gridW + 1) * (gridH + 1)
    const c = new Float32Array(len * 4)
    for (let i = 0; i < len; i++) {
      c[i * 4] = 0.1
      c[i * 4 + 1] = 0.1
      c[i * 4 + 2] = 0.1
      c[i * 4 + 3] = 0
    }
    return c
  }, [])

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshBasicMaterial
        transparent
        opacity={1}
        depthWrite={false}
        side={THREE.DoubleSide}
      >
        <bufferAttribute
          attachObject={['attributes', 'color']}
          count={(gridW + 1) * (gridH + 1)}
          array={initialColors}
          itemSize={4}
        />
      </meshBasicMaterial>
    </mesh>
  )
}

function PaperDepth() {
  const count = 15
  const meshes = useRef<THREE.Mesh[]>([])

  const fibers = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      x: (Math.random() - 0.5) * 14,
      y: (Math.random() - 0.5) * 10,
      z: (Math.random() - 0.5) * 6 - 1,
      rotation: Math.random() * Math.PI,
      length: 0.3 + Math.random() * 1.2,
      thickness: 0.002 + Math.random() * 0.004,
      phase: Math.random() * Math.PI * 2,
    }))
  }, [])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * 0.02
    meshes.current.forEach((mesh, i) => {
      if (!mesh) return
      const f = fibers[i]
      const offsetX = Math.sin(t + f.phase) * 0.02
      const offsetY = Math.cos(t * 0.7 + f.phase * 0.5) * 0.02
      mesh.position.x = f.x + offsetX
      mesh.position.y = f.y + offsetY
    })
  })

  return (
    <group>
      {fibers.map((f, i) => (
        <mesh
          key={i}
          ref={(el) => { if (el) meshes.current[i] = el }}
          position={[f.x, f.y, f.z]}
          rotation={[Math.random() * 0.2, Math.random() * 0.2, f.rotation]}
        >
          <planeGeometry args={[f.length, f.thickness]} />
          <meshBasicMaterial
            color="#1A1A1A"
            transparent
            opacity={0.03}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}

export default function MistEngine() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 60 }}
        gl={{ alpha: true, antialias: false }}
        style={{ background: 'transparent' }}
      >
        <FloatingMist />
        <DistantMountains />
        <InkParticles />
        <TransparentNoise />
        <PaperDepth />
      </Canvas>
    </div>
  )
}
