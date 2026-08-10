import { Canvas } from '@react-three/fiber'
import { Environment, OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { Suspense } from 'react'
import { Model } from './Model'
import { ASSETS } from '../config/assets'

type AssetCanvasProps = {
  url: string
  draco?: boolean
  hdri?: string
  bloom?: boolean
  fit?: number
  rotateSpeed?: number
  cameraZ?: number
  enableControls?: boolean
  className?: string
}

export function AssetCanvas({
  url,
  draco = false,
  hdri = ASSETS.hdri.dark,
  bloom = true,
  fit = 2.4,
  rotateSpeed = 0.3,
  cameraZ = 5,
  enableControls = false,
  className,
}: AssetCanvasProps) {
  return (
    <Canvas
      className={className}
      camera={{ position: [0, 0, cameraZ], fov: 35 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 4]} intensity={1.2} />
      <Suspense fallback={null}>
        <Environment files={hdri} />
        <Model url={url} draco={draco} dracoPath={ASSETS.draco} fit={fit} rotateSpeed={rotateSpeed} />
      </Suspense>
      {enableControls && <OrbitControls enablePan={false} enableZoom={false} />}
      {bloom && (
        <EffectComposer>
          <Bloom mipmapBlur intensity={0.7} luminanceThreshold={0.6} luminanceSmoothing={0.2} />
        </EffectComposer>
      )}
    </Canvas>
  )
}
