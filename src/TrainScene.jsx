import React, { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Float, OrbitControls, Sparkles, useFBX, useTexture } from '@react-three/drei'

const FRONT_MODEL = '/assets/lrt_new.fbx'
const FRONT_TEXTURE = '/assets/lrt_new.png'
const WAGON_MODEL = '/assets/lrt_gerbong_new.fbx'
const WAGON_DEFAULT_TEXTURE = '/assets/lrt_gerbong_new.png'

function prepareModel(source, texture, targetLength = 4.1) {
  const model = source.clone(true)

  model.traverse((child) => {
    if (!child.isMesh) return
    child.castShadow = true
    child.receiveShadow = true

    const materials = Array.isArray(child.material) ? child.material : [child.material]
    child.material = materials.map((sourceMaterial) => {
      const material = sourceMaterial?.clone?.() || new THREE.MeshStandardMaterial()
      material.map = texture
      material.color = new THREE.Color('#ffffff')
      material.transparent = false
      material.opacity = 1
      material.side = THREE.DoubleSide
      material.needsUpdate = true
      if ('roughness' in material) material.roughness = 0.72
      if ('metalness' in material) material.metalness = 0.08
      return material
    })
    if (child.material.length === 1) child.material = child.material[0]
  })

  let box = new THREE.Box3().setFromObject(model)
  let size = new THREE.Vector3()
  box.getSize(size)

  if (size.z > size.x) {
    model.rotation.y = Math.PI / 2
    box = new THREE.Box3().setFromObject(model)
    box.getSize(size)
  }

  const scale = targetLength / Math.max(size.x, 0.001)
  model.scale.setScalar(scale)
  model.updateMatrixWorld(true)

  box = new THREE.Box3().setFromObject(model)
  const center = new THREE.Vector3()
  box.getCenter(center)

  model.position.x -= center.x
  model.position.z -= center.z
  model.position.y -= box.min.y

  return model
}

function TrainCar({ kind, textureUrl, position, length = 4.1 }) {
  const source = useFBX(kind === 'front' ? FRONT_MODEL : WAGON_MODEL)
  const texture = useTexture(kind === 'front' ? FRONT_TEXTURE : textureUrl || WAGON_DEFAULT_TEXTURE)

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace
    // FBX UV coordinates expect the conventional Three.js texture orientation.
    // Using flipY=false (GLTF-style) made the atlas appear on the wrong parts of
    // the LRT, e.g. the face showing up on the roof.
    texture.flipY = true
    texture.anisotropy = 8
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    texture.needsUpdate = true
  }, [texture])

  const model = useMemo(
    () => prepareModel(source, texture, length),
    [source, texture, length],
  )

  return <primitive object={model} position={position} />
}

function Rails() {
  const sleepers = useMemo(() => Array.from({ length: 42 }, (_, i) => i), [])
  return (
    <group position={[0, -0.08, 0]}>
      <mesh position={[0, 0, 1.15]} receiveShadow>
        <boxGeometry args={[24, 0.09, 0.11]} />
        <meshStandardMaterial color="#556070" metalness={0.65} roughness={0.38} />
      </mesh>
      <mesh position={[0, 0, -1.15]} receiveShadow>
        <boxGeometry args={[24, 0.09, 0.11]} />
        <meshStandardMaterial color="#556070" metalness={0.65} roughness={0.38} />
      </mesh>
      {sleepers.map((i) => (
        <mesh key={i} position={[-11.5 + i * 0.56, -0.09, 0]} receiveShadow>
          <boxGeometry args={[0.28, 0.12, 3.05]} />
          <meshStandardMaterial color={i % 2 ? '#855e4c' : '#936751'} roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

function Landscape() {
  const puffs = [
    [-8, 5.5, -8, 1.8],
    [-5.8, 6.1, -8.4, 1.2],
    [5.8, 5.9, -8, 1.55],
    [8.1, 5.1, -7.8, 1.1],
  ]
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.25, 0]} receiveShadow>
        <planeGeometry args={[60, 30]} />
        <meshStandardMaterial color="#8fdc72" roughness={1} />
      </mesh>
      <mesh position={[0, 2.3, -10]}>
        <planeGeometry args={[40, 13]} />
        <meshBasicMaterial color="#78c9ff" />
      </mesh>
      {puffs.map(([x, y, z, s], index) => (
        <Float key={index} speed={0.65 + index * 0.05} floatIntensity={0.18} rotationIntensity={0}>
          <group position={[x, y, z]} scale={s}>
            <mesh position={[-0.8, 0, 0]}><sphereGeometry args={[0.7, 24, 24]} /><meshStandardMaterial color="white" roughness={1} /></mesh>
            <mesh position={[0, 0.22, 0]}><sphereGeometry args={[1, 24, 24]} /><meshStandardMaterial color="white" roughness={1} /></mesh>
            <mesh position={[0.9, -0.02, 0]}><sphereGeometry args={[0.72, 24, 24]} /><meshStandardMaterial color="white" roughness={1} /></mesh>
          </group>
        </Float>
      ))}
      <Float speed={1.25} floatIntensity={0.55} rotationIntensity={0.12}>
        <mesh position={[8.4, 5.35, -5.6]}>
          <sphereGeometry args={[1.2, 32, 32]} />
          <meshStandardMaterial color="#ffd850" emissive="#ffb815" emissiveIntensity={0.18} />
        </mesh>
      </Float>
    </>
  )
}

const TRAIN_RIDE_HEIGHT = 0.52

function Train({ textureUrl, arrivalKey }) {
  const group = useRef()
  const start = useRef(performance.now())

  useEffect(() => {
    start.current = performance.now()
  }, [arrivalKey])

  useFrame(() => {
    if (!group.current) return
    const elapsed = (performance.now() - start.current) / 1000
    const t = Math.min(1, elapsed / 1.8)
    const eased = 1 - Math.pow(1 - t, 3)
    group.current.position.x = THREE.MathUtils.lerp(-13, -0.8, eased)
    group.current.rotation.y = -0.12 + Math.sin(performance.now() * 0.00045) * 0.012
  })

  return (
    <group ref={group} position={[-0.8, TRAIN_RIDE_HEIGHT, 0]}>
      <TrainCar kind="front" position={[-4.3, 0, 0]} length={4.6} />
      <TrainCar kind="wagon" textureUrl={textureUrl} position={[0.25, 0, 0]} length={4.25} />
      <TrainCar kind="wagon" textureUrl={textureUrl} position={[4.55, 0, 0]} length={4.25} />
    </group>
  )
}

function Scene({ textureUrl, arrivalKey }) {
  return (
    <>
      <color attach="background" args={['#78c9ff']} />
      <fog attach="fog" args={['#90d6ff', 15, 34]} />
      <ambientLight intensity={1.05} />
      <hemisphereLight args={['#eaf8ff', '#6f9a55', 1.35]} />
      <directionalLight position={[-8, 12, 9]} intensity={2.4} castShadow shadow-mapSize={[2048, 2048]} />
      <Landscape />
      <Rails />
      <Suspense fallback={null}>
        <Train textureUrl={textureUrl} arrivalKey={arrivalKey} />
      </Suspense>
      <Sparkles count={35} scale={[18, 8, 6]} size={4} speed={0.25} color="#ffe56c" position={[0, 4.5, 0]} />
      <ContactShadows position={[0, -0.08, 0]} opacity={0.3} scale={24} blur={2.7} far={9} />
      <OrbitControls
        target={[0, 1.7, 0]}
        enablePan={false}
        minDistance={9}
        maxDistance={21}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 2.05}
        autoRotate={false}
      />
    </>
  )
}

export default function TrainScene({ textureUrl, arrivalKey }) {
  return (
    <Canvas
      shadows
      camera={{ position: [8.8, 5.3, 12.8], fov: 38 }}
      dpr={[1, 1.6]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
    >
      <Scene textureUrl={textureUrl} arrivalKey={arrivalKey} />
    </Canvas>
  )
}
