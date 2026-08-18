import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { ASSETS } from '../../config/assets'
import { HEAD_FRAGMENT_SHADER, HEAD_VERTEX_SHADER } from '../shaders/headShaders'

type HeadProps = {
  /** 头部高度（世界单位），面片宽度按贴图比例自动适配 */
  height?: number
  /** 深度位移强度：控制「浮雕」突出程度 */
  depthScale?: number
  /** 跟随指针的最大倾斜角（弧度） */
  tilt?: number
  /** 指针响应的阻尼系数（0~1，越小越平滑） */
  damping?: number
}

export function Head({
  height = 5,
  depthScale = 0.35,
  tilt = 0.10,
  damping = 0.06,
}: HeadProps) {
  const group = useRef<THREE.Group>(null!)

  // useTexture 内部通过 Suspense 挂起，纹理加载完成后才会渲染
  const textures = useTexture({
    uDiffuse: ASSETS.textures.head.diffuse,
    uAlpha: ASSETS.textures.head.alpha,
    uDepth: ASSETS.textures.head.depth,
    uNormal: ASSETS.textures.head.normal,
  })

  // 依据漫反射贴图的实际比例设置面片宽高，避免拉伸变形
  const [aspect, setAspect] = useState(1)
  useLayoutEffect(() => {
    const img = textures.uDiffuse.image as HTMLImageElement | undefined
    if (img && img.width && img.height) {
      setAspect(img.width / img.height)
    }
  }, [textures])

  // 漫反射是颜色贴图，使用 sRGB；其余为数据贴图，保持线性数据并开启各向异性过滤
  useLayoutEffect(() => {
    textures.uDiffuse.colorSpace = THREE.SRGBColorSpace
    textures.uDiffuse.needsUpdate = true
    for (const t of [textures.uAlpha, textures.uDepth, textures.uNormal]) {
      t.colorSpace = THREE.NoColorSpace
      t.anisotropy = 8
      t.needsUpdate = true
    }
  }, [textures])

  const uniforms = useMemo(
    () => ({
      uDiffuse: { value: textures.uDiffuse },
      uAlpha: { value: textures.uAlpha },
      uDepth: { value: textures.uDepth },
      uNormal: { value: textures.uNormal },
      uDepthScale: { value: depthScale },
      uLightDir: { value: new THREE.Vector3(0.5, 0.8, 1).normalize() },
      uLightColor: { value: new THREE.Color('#ffffff') },
      uLightStrength: { value: 1 },
      uAmbientColor: { value: new THREE.Color('#ffffff') },
      uRimColor: { value: new THREE.Color('#ffffff') },
      uRimStrength: { value: 0.5 },
      uNormalStrength: { value: 1.0 },
      uAlphaCutoff: { value: 0.35 },
    }),
    [textures, depthScale],
  )

  // 指针轻微跟随：让头部像「浮空立牌」一样随鼠标晃动，强化立体感
  useFrame((state) => {
    const g = group.current
    if (!g) return
    g.rotation.x += (state.pointer.y * tilt - g.rotation.x) * damping
    g.rotation.y += (-state.pointer.x * tilt - g.rotation.y) * damping
  })

  return (
    <group ref={group}>
      <mesh position={[0, 0, -0.5]} scale={[height * aspect, height, 1]}>
        {/* 视差贴图在片元着色器完成，平面无需高细分，降低开销 */}
        <planeGeometry args={[1, 1, 32, 32]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={HEAD_VERTEX_SHADER}
          fragmentShader={HEAD_FRAGMENT_SHADER}
          transparent
          side={THREE.FrontSide}
          depthWrite
        />
      </mesh>
    </group>
  )
}
