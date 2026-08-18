import { Canvas } from '@react-three/fiber'
import { Environment, OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { Suspense, type ReactNode, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { ASSETS } from '../../config/assets'

export type AssetCanvasProps = {
  /** 画布内要渲染的 3D 内容 */
  children: ReactNode
  /** 背景色；不传则透明（alpha） */
  background?: string
  /** 相机位置 */
  cameraPosition?: [number, number, number]
  /** 相机 fov */
  cameraFov?: number
  /** 环境贴图（HDR）路径 */
  hdri?: string
  /** 环境光强度 */
  environmentIntensity?: number
  /** 是否开启 Bloom 后处理 */
  bloom?: boolean
  /** 平行光强度 */
  directionalLight?: number
  /** 是否允许拖拽旋转（OrbitControls） */
  enableControls?: boolean
  /** 鼠标是否在画布内的 ref，传入后绑定指针进出事件 */
  hoveredRef?: MutableRefObject<boolean>
  /** 自定义 toneMapping（默认 ACESFilmic） */
  toneMapping?: THREE.ToneMapping
  className?: string
}

/**
 * 通用 3D 画布：统一封装相机、灯光、环境贴图、后处理、控制器与指针交互，
 * 替代原先分散的 AssetCanvas 与 Hero3D 两个几乎重复的 Canvas 容器。
 */
export function AssetCanvas({
  children,
  background,
  cameraPosition = [0, 0, 5],
  cameraFov = 35,
  hdri = ASSETS.hdri.dark,
  environmentIntensity = 1,
  bloom = true,
  directionalLight = 1.2,
  enableControls = false,
  hoveredRef,
  toneMapping = THREE.ACESFilmicToneMapping,
  className,
}: AssetCanvasProps) {
  return (
    <Canvas
      className={className}
      camera={{ position: cameraPosition, fov: cameraFov }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: background === undefined }}
      onCreated={({ gl }) => {
        gl.toneMapping = toneMapping
      }}
      onPointerOver={hoveredRef ? () => (hoveredRef.current = true) : undefined}
      onPointerLeave={hoveredRef ? () => (hoveredRef.current = false) : undefined}
    >
      {background !== undefined && <color attach="background" args={[background]} />}
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 4]} intensity={directionalLight} />
      <Suspense fallback={null}>
        <Environment files={hdri} environmentIntensity={environmentIntensity} />
        {children}
      </Suspense>
      {enableControls && (
        <OrbitControls enablePan={false} enableZoom={false} enableDamping dampingFactor={0.08} />
      )}
      {bloom && (
        <EffectComposer>
          <Bloom mipmapBlur intensity={0.7} luminanceThreshold={0.6} luminanceSmoothing={0.2} />
        </EffectComposer>
      )}
    </Canvas>
  )
}
