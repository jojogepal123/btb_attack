import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function Particles({ count = 600 }) {
  const ref = useRef()

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20
      const green = 0.5 + Math.random() * 0.5
      col[i * 3] = 0.1
      col[i * 3 + 1] = green
      col[i * 3 + 2] = 0.2
    }
    return [pos, col]
  }, [count])

  const geo = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return geometry
  }, [positions, colors])

  useFrame((state) => {
    const time = state.clock.getElapsedTime() * 0.08
    if (ref.current) {
      ref.current.rotation.y = time
      ref.current.rotation.x = Math.sin(time * 0.5) * 0.1
    }
  })

  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial size={0.03} vertexColors transparent opacity={0.8} sizeAttenuation />
    </points>
  )
}

function WireframeShape({ position, rotation, scale = 1, speed = 1 }) {
  const ref = useRef()
  const baseRotation = useRef(rotation)

  useFrame((state) => {
    const time = state.clock.getElapsedTime() * speed
    if (ref.current) {
      ref.current.rotation.x = baseRotation.current[0] + time * 0.3
      ref.current.rotation.y = baseRotation.current[1] + time * 0.2
      ref.current.position.y = position[1] + Math.sin(time * 0.8) * 0.3
    }
  })

  return (
    <mesh ref={ref} position={position} scale={scale}>
      <icosahedronGeometry args={[1, 1]} />
      <meshBasicMaterial color="#22c55e" wireframe transparent opacity={0.15} />
    </mesh>
  )
}

function GlowingRing({ radius = 2, tube = 0.02, position = [0, 0, 0] }) {
  const ref = useRef()

  useFrame((state) => {
    const time = state.clock.getElapsedTime()
    if (ref.current) {
      ref.current.rotation.x = Math.sin(time * 0.3) * 0.5
      ref.current.rotation.y = time * 0.2
    }
  })

  return (
    <mesh ref={ref} position={position}>
      <torusGeometry args={[radius, tube, 16, 100]} />
      <meshBasicMaterial color="#22c55e" transparent opacity={0.2} />
    </mesh>
  )
}

function StarField() {
  const ref = useRef()

  const geo = useMemo(() => {
    const count = 1200
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 50
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return geometry
  }, [])

  useFrame((state) => {
    const time = state.clock.getElapsedTime() * 0.02
    if (ref.current) {
      ref.current.rotation.y = time
    }
  })

  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial size={0.05} color="#ffffff" transparent opacity={0.4} sizeAttenuation />
    </points>
  )
}

function MouseReactive({ children }) {
  const group = useRef()

  useFrame((state) => {
    if (group.current) {
      const x = (state.pointer.x * Math.PI) / 4
      const y = (state.pointer.y * Math.PI) / 4
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, x, 0.05)
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -y, 0.05)
    }
  })

  return <group ref={group}>{children}</group>
}

export default function Scene() {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />

        <MouseReactive>
          <Particles count={600} />
          <WireframeShape position={[-3, 1, -2]} rotation={[0.5, 0.3, 0]} scale={0.8} speed={0.6} />
          <WireframeShape position={[3.5, -1, -3]} rotation={[0.2, 0.7, 0]} scale={0.6} speed={0.8} />
          <WireframeShape position={[0, 2.5, -4]} rotation={[0.8, 0.1, 0]} scale={1} speed={0.4} />
          <WireframeShape position={[-2, -2, -1]} rotation={[0.3, 0.5, 0]} scale={0.5} speed={1} />
          <GlowingRing radius={3} tube={0.015} position={[0, 0, -2]} />
          <GlowingRing radius={2} tube={0.01} position={[1, -0.5, -3]} />
          <GlowingRing radius={4} tube={0.008} position={[-1, 0.5, -4]} />
        </MouseReactive>

        <StarField />

        <fog attach="fog" args={['#030712', 4, 15]} />
      </Canvas>
    </div>
  )
}
