import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { ASSETS } from '../config/assets'

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

// 顶点着色器：采样 depth 贴图，把每个顶点沿着视线方向挤出，
// 让平面的头部获得真实的立体轮廓，并随相机转动产生视差。
const HEAD_VERTEX_SHADER = /* glsl */ `
  uniform sampler2D uDepth;
  uniform float uDepthScale;

  varying vec2 vUv;
  varying vec3 vViewDir;
  varying mat3 vRot;

  void main() {
    vUv = uv;

    // depth 贴图里越亮表示离相机越近，沿视线方向挤出顶点
    float depth = texture2D(uDepth, uv).r;

    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vec3 toCamera = cameraPosition - worldPos.xyz;
    vec3 viewDir = normalize(toCamera);
    worldPos.xyz += viewDir * depth * uDepthScale;

    // 模型的旋转矩阵，用于把切线空间法线贴图变换到世界空间
    vRot = mat3(modelMatrix);
    vViewDir = -viewDir;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

// 片元着色器：法线贴图做细节光照 + 边缘光，alpha 贴图裁剪背景，diffuse 提供颜色。
const HEAD_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D uDiffuse;
  uniform sampler2D uAlpha;
  uniform sampler2D uNormal;

  uniform vec3 uLightDir;
  uniform vec3 uLightColor;
  uniform float uLightStrength;
  uniform vec3 uAmbientColor;
  uniform vec3 uRimColor;
  uniform float uRimStrength;
  uniform float uNormalStrength;
  uniform float uAlphaCutoff;

  varying vec2 vUv;
  varying vec3 vViewDir;
  varying mat3 vRot;

  void main() {
    vec4 diffuse = texture2D(uDiffuse, vUv);
    vec4 alphaMap = texture2D(uAlpha, vUv);
    vec3 normalMap = texture2D(uNormal, vUv).xyz;

    // sRGB → 线性：diffuse 是颜色贴图，直接在 gamma 空间做光照乘法会让颜色变灰发闷。
    // 先解码到线性空间计算，最后再编码回 sRGB 输出。
    vec3 albedo = pow(diffuse.rgb, vec3(2.2));

    // 法线贴图 → 世界空间光照（uNormalStrength 可整体调弱法线强度）
    vec3 nTex = normalMap * 2.0 - 1.0;
    nTex.xy *= uNormalStrength;
    vec3 N = normalize(vRot * normalize(nTex));
    vec3 L = normalize(uLightDir);
    vec3 V = normalize(vViewDir);

    // 半兰伯特 + wrap：暗部保留一定亮度，避免阴影死黑导致画面灰暗
    float diff = max(dot(N, L), 0.0);
    float wrap = diff * 0.6 + 0.4;

    // 边缘光：让头部边缘带一层冷色描边，更有「全息投影」的感觉
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);

    vec3 color = albedo * (uAmbientColor + uLightColor * uLightStrength * wrap);
    color += uRimColor * rim * uRimStrength;

    // 线性 → sRGB：恢复到显示器上的正确颜色
    color = pow(color, vec3(1.0 / 2.2));

    gl_FragColor = vec4(color, alphaMap.r);
  }
`

export function Head({
  height = 5,
  depthScale = 1.1,
  tilt = 0.12,
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
      uLightStrength: { value: 0.8 },
      uAmbientColor: { value: new THREE.Color('#3f4452') },
      uRimColor: { value: new THREE.Color('#7fb2ff') },
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
    g.rotation.x += (-state.pointer.y * tilt - g.rotation.x) * damping
    g.rotation.y += (state.pointer.x * tilt - g.rotation.y) * damping
  })

  return (
    <group ref={group}>
      <mesh position={[0,0,-0.5]} scale={[height * aspect, height, 1]}>
        {/* 足够多的细分，深度位移才能平滑 */}
        <planeGeometry args={[1, 1, 256, 256]} />
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
