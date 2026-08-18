import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { ASSETS } from '../../config/assets'
import { useModelFit, type ModelBounds } from '../hooks/useModelFit'
import {
  applyWireframeScan,
  createWireframeScanUniforms,
} from '../shaders/wireframeScan'

type HelmetWireframeProps = {
  // 是否自动旋转（轮播展示效果）
  autoRotate?: boolean
  // 旋转速度（弧度/秒）
  rotateSpeed?: number
  // 是否启用扫描动画
  scan?: boolean
  // 扫描速度（每秒从顶部扫到底部的循环次数）
  scanSpeed?: number
  // 扫描亮带的宽度（模型高度范围的比例）
  scanWidth?: number
  // 扫描亮带处的线框颜色
  wireColor?: string
}

export function HelmetWireframe({
  autoRotate = true,
  rotateSpeed = 0.4,
  scan = true,
  scanSpeed = 0.5,
  scanWidth = 0.5,
  wireColor = '#cccccc',
}: HelmetWireframeProps) {
  // 复用 useGLTF 的缓存加载模型，深克隆出一份独立 scene，
  // 避免修改共享的 gltf.scene（否则会同时影响 Helmet / Model 组件的材质与变换）
  const gltf = useGLTF(ASSETS.models.helmet, ASSETS.draco)
  const scene = useMemo(() => gltf.scene.clone(true), [gltf])

  const spin = useRef<THREE.Group>(null!)
  const scanPlane = useRef<THREE.Mesh>(null!)
  // 记录模型在 y 方向的范围（缩放居中后），作为扫描往复的区间
  const bounds = useRef<ModelBounds | null>(null)

  // 所有材质共享同一组 uniform，每帧只需更新一次。
  const uniforms = useMemo(() => createWireframeScanUniforms(wireColor), [wireColor])

  // props 变化时同步进 uniform，保证对象引用稳定
  useEffect(() => {
    uniforms.uColor.value.set(wireColor)
    uniforms.uScanWidth.value = scanWidth
  }, [uniforms, wireColor, scanWidth])

  // 等比缩放到 2.4 并居中到原点，同时记录扫描范围
  useModelFit(scene, 2.4, (b) => {
    bounds.current = b
  })

  // 给所有 mesh 换成独立的线框材质，并注入「扫描亮度渐变」shader
  useLayoutEffect(() => {
    scene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return
      const mesh = child as THREE.Mesh
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      mats.forEach((_, i) => {
        const m = new THREE.MeshBasicMaterial()
        if (scan) applyWireframeScan(m, uniforms, wireColor)
        if (Array.isArray(mesh.material)) mesh.material[i] = m
        else mesh.material = m
      })
    })
  }, [scene, uniforms, scan, wireColor])

  // 驱动旋转与扫描动画
  useFrame((state, delta) => {
    if (autoRotate && spin.current) {
      spin.current.rotation.y += delta * rotateSpeed
    }
    if (!scan || !bounds.current) return
    const { minY, maxY } = bounds.current
    // 从顶部向底部线性扫描（循环），到底后回到顶部重新开始。
    // 上下各延伸 15% 的行程，让扫描带完全离开模型后再回到顶部，避免顶部闪现。
    const span = maxY - minY
    const pad = span * 0.15
    const total = span + pad * 2
    const p = ((state.clock.elapsedTime * scanSpeed) % 1 + 1) % 1
    const y = maxY + pad - p * total
    uniforms.uScanY.value = y
    if (scanPlane.current) scanPlane.current.position.y = y
  })

  return (
    <group ref={spin}>
      <primitive object={scene} />
      {scan && (
        // 可见的发光扫描带
        <mesh ref={scanPlane} rotation={[-Math.PI / 2, 0, 0]}>
          <meshBasicMaterial
            color={wireColor}
            transparent
            opacity={0.45}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  )
}
