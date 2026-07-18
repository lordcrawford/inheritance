import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useRef, useMemo, useEffect } from 'react'

function CDMesh({ phase, onInsertDone, hoveredRef }) {
  const { scene } = useGLTF('/cd.glb')
  const groupRef = useRef()
  const progressRef = useRef(0)
  const doneFiredRef = useRef(false)
  const spinSpeedRef = useRef(0.5)

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse(child => {
      if (child.isMesh) {
        child.material = child.material.clone()
        child.material.transparent = true
        child.material.opacity = 1
      }
    })
    return clone
  }, [scene])

  useEffect(() => {
    progressRef.current = 0
    doneFiredRef.current = false
    // Reset visual state when returning to floating (eject)
    const g = groupRef.current
    if (phase === 'floating' && g) {
      g.scale.setScalar(1)
      g.position.y = 0
      clonedScene.traverse(child => {
        if (child.isMesh) child.material.opacity = 1
      })
    }
  }, [phase, clonedScene])

  useFrame((_, delta) => {
    const g = groupRef.current
    if (!g) return

    if (phase === 'floating') {
      const targetSpeed = hoveredRef?.current ? 1.6 : 0.5
      spinSpeedRef.current += (targetSpeed - spinSpeedRef.current) * Math.min(1, delta * 4)
      g.rotation.y += delta * spinSpeedRef.current
    } else if (phase === 'inserting') {
      progressRef.current = Math.min(1, progressRef.current + delta * 0.85)
      const t = progressRef.current
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      g.scale.setScalar(Math.max(0.001, 1 - ease * 0.97))
      g.position.y = -ease * 2.5
      const opacity = Math.max(0, 1 - t * 1.8)
      clonedScene.traverse(child => {
        if (child.isMesh) child.material.opacity = opacity
      })
      if (t >= 1 && !doneFiredRef.current) {
        doneFiredRef.current = true
        onInsertDone?.()
      }
    }
  })

  return (
    <group ref={groupRef} rotation={[-Math.PI * 0.22, 0, 0]}>
      <primitive object={clonedScene} scale={1.6} />
    </group>
  )
}

export default function CDViewer({ phase, onClick, onInsertDone, size = 310 }) {
  const hoveredRef = useRef(false)
  return (
    <div
      onClick={phase === 'floating' ? onClick : undefined}
      onMouseEnter={() => { hoveredRef.current = true }}
      onMouseLeave={() => { hoveredRef.current = false }}
      title={phase === 'floating' ? 'Click to insert' : ''}
      className={phase === 'floating' ? 'cd-hover' : undefined}
      style={{ width: size, height: size, cursor: phase === 'floating' ? 'pointer' : 'default', flexShrink: 0 }}
    >
      <Canvas
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [0, 3, 14], fov: 50 }}
        style={{ width: '100%', height: '100%' }}
        resize={{ offsetSize: true }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 8, 5]} intensity={1.8} />
        <pointLight position={[-3, 1, 4]} intensity={0.6} color="#aaddff" />
        <CDMesh phase={phase} onInsertDone={onInsertDone} hoveredRef={hoveredRef} />
      </Canvas>
    </div>
  )
}
