import { Canvas } from '@react-three/fiber'
import { Environment, OrbitControls } from '@react-three/drei'
import { Suspense } from 'react'
import { Helmet } from './Helmet'
import { HelmetWireframe } from './HelmetWireframe'
import { Head } from './Head'
import { ASSETS } from '../config/assets'
import * as THREE from 'three'

export function Hero3D() {
  return (
    <Canvas
      className="hero-canvas"
      camera={{ position: [0, 1, 6], fov: 30 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
      onCreated={({gl}) => {
        gl.toneMapping = THREE.NoToneMapping
      } }
    >
      <color attach="background" args={['#bebebe']} />
      {/* <ambientLight intensity={1} /> */}
      <directionalLight position={[4, 6, 5]} intensity={1} />
      {/* <spotLight position={[-6, 4, 2]} angle={0.5} intensity={1.2} color="#ff8000" /> */}
      <Suspense fallback={null}>
        <Environment files={ASSETS.hdri.light} environmentIntensity={0.5} />
        {/* <Helmet /> */}
        {/* <HelmetWireframe
          autoRotate={false} 
        /> */}
        {/* 面片 + shader 的头部：depth 挤出立体轮廓，normal 做光照，alpha 裁剪 */}
        <Head />
      </Suspense>
      <OrbitControls enablePan={false} enableZoom={false} enableDamping dampingFactor={0.08} />
      {/* <EffectComposer>
        <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.55} luminanceSmoothing={0.25} />
      </EffectComposer> */}
    </Canvas>
  )
}
