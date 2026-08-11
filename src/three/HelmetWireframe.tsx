import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { ASSETS } from '../config/assets'

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
  const bounds = useRef<{ minY: number; maxY: number } | null>(null)

  // 所有材质共享同一组 uniform，每帧只需更新一次。
  // 初始值用默认色，props 变化由下方的 useEffect 同步进 uniform，保证对象引用稳定。
  const uniforms = useMemo(
    () => ({
      uScanY: { value: 0 },
      uColor: { value: new THREE.Color('#cccccc') },
      uScanWidth: { value: 0.5 },
    }),
    [],
  )

  useEffect(() => {
    uniforms.uColor.value.set(wireColor)
    uniforms.uScanWidth.value = scanWidth
  }, [uniforms, wireColor, scanWidth])

  // 与 Model 组件保持一致：等比缩放到 2.4 并居中到原点，同时记录扫描范围
  useLayoutEffect(() => {
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    const s = 2.4 / maxDim
    scene.scale.setScalar(s)
    scene.position.set(-center.x * s, -center.y * s, -center.z * s)
    bounds.current = {
      minY: (box.min.y - center.y) * s,
      maxY: (box.max.y - center.y) * s,
    }
  }, [scene])

  // 给所有 mesh 换成独立的线框材质，并注入「扫描亮度渐变」shader
  useLayoutEffect(() => {
    scene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return
      const mesh = child as THREE.Mesh
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      mats.forEach((_, i) => {
        const m = new THREE.MeshBasicMaterial({
          wireframe: true,
          color: wireColor,
          side: THREE.DoubleSide,
          // 开启透明，让远离扫描带的线框淡出到全透明
          transparent: true,
        })
        // 叠加在实体模型之上时略微偏向相机，避免线框被深度遮挡
        m.polygonOffset = true
        m.polygonOffsetFactor = -1
        m.polygonOffsetUnits = -1
        // 透明材质关闭深度写入，避免透明线框间相互遮挡产生错误的叠加效果
        m.depthWrite = false

        if (scan) {
          m.onBeforeCompile = (shader) => {
            shader.uniforms.uScanY = uniforms.uScanY
            shader.uniforms.uColor = uniforms.uColor
            shader.uniforms.uScanWidth = uniforms.uScanWidth

            // 顶点着色器：把世界坐标传给片元
            shader.vertexShader = shader.vertexShader
              .replace(
                '#include <common>',
                `#include <common>
                varying vec3 vWorldPos;`,
              )
              .replace(
                '#include <worldpos_vertex>',
                `#include <worldpos_vertex>
                vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
              )

            // 片元着色器：按与扫描高度 uScanY 的距离计算亮度 glow，
            // 颜色始终用线框主色，alpha 随 glow 淡出 → 远离扫描带的部分完全透明
            shader.fragmentShader = shader.fragmentShader
              .replace(
                '#include <common>',
                `#include <common>
                varying vec3 vWorldPos;
                uniform float uScanY;
                uniform vec3 uColor;
                uniform float uScanWidth;`,
              )
              .replace(
                '#include <dithering_fragment>',
                `float scanDist = abs(vWorldPos.y - uScanY);
                float glow = 1.0 - smoothstep(0.0, uScanWidth, scanDist);
                gl_FragColor.rgb = uColor;
                gl_FragColor.a = glow;
                #include <dithering_fragment>`,
              )
          }
        }

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
          {/* <planeGeometry args={[3.4, 0.16]} /> */}
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
