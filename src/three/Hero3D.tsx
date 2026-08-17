import { Canvas } from '@react-three/fiber'
import { Environment, OrbitControls } from '@react-three/drei'
import { Suspense, useRef } from 'react'
import { Helmet } from './Helmet'
import { HelmetWireframe } from './HelmetWireframe'
import { Head } from './Head'
import { ASSETS } from '../config/assets'
import * as THREE from 'three'

export function Hero3D() {
  // 用 ref 维护 hovered，避免每次鼠标进出都触发 Canvas 子树重渲染
  const hovered = useRef(false)

  return (
    <Canvas
      className="hero-canvas"
      camera={{ position: [0, 1, 6], fov: 30 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
      onCreated={({gl}) => {
        gl.toneMapping = THREE.NoToneMapping
      } }
      onPointerOver={() => (hovered.current = true)}
      onPointerLeave={() => (hovered.current = false)}
    >
      <color attach="background" args={['#bebebe']} />
      {/* <ambientLight intensity={1} /> */}
      <directionalLight position={[4, 6, 5]} intensity={1} />
      {/* <spotLight position={[-6, 4, 2]} angle={0.5} intensity={1.2} color="#ff8000" /> */}
      <Suspense fallback={null}>
        <Environment files={ASSETS.hdri.light} environmentIntensity={0.5} />
        <Helmet
          reveal={{
            radius: 0.42,      // 显示半径，可调
            smoothness: 0.2,   // 边缘柔化宽度
            baseOpacity: 0.04, // 半径外保留淡淡轮廓，方便用户找到头盔
            hoveredRef: hovered,
          }}
        />
        {/* <HelmetWireframe
          autoRotate={false} 
        /> */}
      </Suspense>
      <OrbitControls enablePan={false} enableZoom={false} enableDamping dampingFactor={0.08} />
      {/* <EffectComposer>
        <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.55} luminanceSmoothing={0.25} />
      </EffectComposer> */}
    </Canvas>
  )
}
