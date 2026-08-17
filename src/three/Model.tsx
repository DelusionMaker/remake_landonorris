// useGLTF：drei 提供的 hook，用来异步加载并缓存 glTF/GLB 模型
import { useGLTF } from '@react-three/drei'
// useFrame：react-three-fiber 的渲染循环 hook，每一帧都会调用回调（用于动画）
import { useFrame } from '@react-three/fiber'
// useLayoutEffect：在 DOM/场景更新后、浏览器绘制前同步执行，适合做测量与布局调整
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { type ClassifiedTextures, applyTexturesToMaterial } from './textures'

/** 鼠标局部显示（探照灯）效果配置 */
export type RevealConfig = {
  /** 显示半径（NDC 空间，0.42 ≈ 屏幕宽度/高度的 42%） */
  radius?: number
  /** 边缘柔化过渡宽度（NDC） */
  smoothness?: number
  /** 半径之外的基准透明度：0 完全隐藏；0.04 左右保留淡淡轮廓便于引导 */
  baseOpacity?: number
  /** 鼠标是否在画布内（外部用 ref 维护，避免触发 React 重渲染） */
  hoveredRef?: { current: boolean }
}

// 组件接收的属性类型定义
type ModelProps = {
  // 模型文件的路径（.glb / .gltf）
  url: string
  // 是否启用 Draco 压缩解码（针对压缩过的模型）
  draco?: boolean
  // Draco 解码器（wasm）所在的目录路径
  dracoPath?: string
  // 目标尺寸：让模型最长边缩放到该值，便于统一大小
  fit?: number
  // 是否开启自动旋转
  autoRotate?: boolean
  // 自动旋转的速度（弧度/秒）
  rotateSpeed?: number
  // 已按通道分类的纹理集：自动匹配并连接到模型材质的对应通道
  textures?: ClassifiedTextures
  // 按 mesh 名称定向应用的纹理集：key 为 mesh 名称（不区分大小写、子串匹配），
  // 匹配到的 mesh 仅使用该纹理集（替换通用 textures），用于给玻璃等部件单独贴材质
  texturesByMesh?: Record<string, ClassifiedTextures>
  // 鼠标局部显示（探照灯）效果：不传则保持原有行为
  reveal?: RevealConfig
}

export function Model({
  url,
  draco = false,
  dracoPath = '/draco/',
  fit = 2.4,
  autoRotate = false,
  rotateSpeed = 0.3,
  textures,
  texturesByMesh,
  reveal,
}: ModelProps) {
  // 加载模型。若开启 draco，则传入解码器路径；否则传 undefined（使用普通加载）
  const gltf = useGLTF(url, draco ? dracoPath : undefined)
  // 用于包裹模型、承载旋转动画的外层 group 的引用
  const spin = useRef<THREE.Group>(null!)

  // 在挂载/更新后重新计算模型的缩放与居中，使其恰好适配 fit 尺寸并位于原点
  useLayoutEffect(() => {
    const obj = gltf.scene
    // 计算模型整体的包围盒（AABB）
    const box = new THREE.Box3().setFromObject(obj)
    // 获取包围盒的尺寸与中心点
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    // 取最长边作为基准维度（避免除以 0 时回退为 1）
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    // 计算缩放比例：目标 fit / 最长边
    const s = fit / maxDim
    // 统一等比缩放模型
    obj.scale.setScalar(s)
    // 将模型平移，使其几何中心对齐到原点（中心点乘以缩放后取负）
    obj.position.set(-center.x * s, -center.y * s, -center.z * s)
  }, [gltf, fit])

  // 将传入的纹理集自动匹配并连接到模型每个材质对应的通道
  useEffect(() => {
    if (!textures && !texturesByMesh) return

    // 根据 mesh 名称查找是否有定向纹理集（不区分大小写、子串匹配）
    const findMatch = (name: string): ClassifiedTextures | undefined => {
      if (!texturesByMesh) return undefined
      const lower = name.toLowerCase()
      for (const [key, set] of Object.entries(texturesByMesh)) {
        if (lower.includes(key.toLowerCase())) return set
      }
      return undefined
    }

    // 记录已应用过纹理的材质实例。
    // glTF 中未显式声明 material 的 mesh 会共享同一个默认材质实例，
    // 若不 clone，后一个 mesh 的纹理赋值会覆盖前一个，导致所有部件显示同一套纹理。
    const assignedMaterials = new Set<THREE.Material>()

    gltf.scene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return
      const mesh = child as THREE.Mesh
      const material = mesh.material
      const mats = Array.isArray(material) ? material : [material]

      // 先尝试定向纹理集，未命中（或集为空）则回退到通用纹理
      const matched = findMatch(mesh.name)
      const set = matched && Object.keys(matched).length > 0 ? matched : textures
      if (!set) return

      mats.forEach((m, i) => {
        if (!m) return
        if (assignedMaterials.has(m)) {
          // 该材质实例已被其他 mesh 使用：克隆一份独立材质，避免互相覆盖
          const clone = m.clone()
          if (Array.isArray(mesh.material)) {
            mesh.material[i] = clone
          } else {
            mesh.material = clone
          }
          applyTexturesToMaterial(clone, set)
        } else {
          assignedMaterials.add(m)
          applyTexturesToMaterial(m, set)
        }
      })
    })
  }, [gltf, textures, texturesByMesh])

  // ---------- 新增：鼠标局部显示（探照灯）效果 ----------
  // 用 ref 保存最新配置，避免 reveal 对象每次渲染变化时重复注入
  const revealRef = useRef(reveal)
  revealRef.current = reveal

  // 所有材质共享同一组 uniform，每帧只更新一次
  const revealUniforms = useMemo(
    () => ({
      uMouse: { value: new THREE.Vector2(0, 0) },
      uRadius: { value: 0.4 },
      uSmooth: { value: 0.15 },
      uAspect: { value: 1 },
      uBaseAlpha: { value: 0 },
      uHover: { value: 0 },
    }),
    [],
  )

  // 配置变化同步到 uniform
  useEffect(() => {
    const cfg = revealRef.current
    if (!cfg) return
    revealUniforms.uRadius.value = cfg.radius ?? 0.4
    revealUniforms.uSmooth.value = cfg.smoothness ?? 0.15
    revealUniforms.uBaseAlpha.value = cfg.baseOpacity ?? 0
  }, [revealUniforms, reveal])

  // 给所有 mesh 材质注入「鼠标局部显示」shader
  // 注意：此 effect 必须放在「应用纹理」的 useEffect 之后，先贴图再改材质
  useEffect(() => {
    const restore = (material: THREE.Material) => {
      const mat = material as THREE.MeshStandardMaterial
      mat.transparent = false
      mat.depthWrite = true
      // three 类型中 onBeforeCompile 不可为空，清空时需断言
      mat.onBeforeCompile = undefined as unknown as THREE.Material['onBeforeCompile']
      mat.needsUpdate = true
    }
    const inject = (material: THREE.Material) => {
      const mat = material as THREE.MeshStandardMaterial
      // 透明混合 + 关闭深度写入：隐藏区域的片元完全不遮挡其他部件
      mat.transparent = true
      mat.depthWrite = false

      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uMouse = revealUniforms.uMouse
        shader.uniforms.uRadius = revealUniforms.uRadius
        shader.uniforms.uSmooth = revealUniforms.uSmooth
        shader.uniforms.uAspect = revealUniforms.uAspect
        shader.uniforms.uBaseAlpha = revealUniforms.uBaseAlpha
        shader.uniforms.uHover = revealUniforms.uHover

        // 顶点着色器：把裁剪空间坐标传给片元（对 clip 坐标插值再除 w，透视正确）
        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            `#include <common>
varying vec4 vClipPos;`,
          )
          .replace(
            '#include <worldpos_vertex>',
            `#include <worldpos_vertex>
vClipPos = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);`,
          )

        // 片元着色器：片元 NDC 与鼠标 NDC 的距离 → 半径内 alpha=1，半径外 alpha=0
        // uAspect 修正宽高比，让"半径"在屏幕上接近正圆
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>
varying vec4 vClipPos;
uniform vec2 uMouse;
uniform float uRadius;
uniform float uSmooth;
uniform float uAspect;
uniform float uBaseAlpha;
uniform float uHover;`,
          )
          .replace(
            '#include <dithering_fragment>',
            `vec2 ndcOffset = vClipPos.xy / vClipPos.w - uMouse;
float ndcDist = length(vec2(ndcOffset.x * uAspect, ndcOffset.y));
float revealMask = 1.0 - smoothstep(uRadius - uSmooth, uRadius + uSmooth, ndcDist);
float targetAlpha = mix(uBaseAlpha, 1.0, revealMask);
gl_FragColor.a *= targetAlpha * uHover;
#include <dithering_fragment>`,
          )
      }
      mat.needsUpdate = true
    }

    if (!reveal) {
      // 关闭效果时还原材质
      gltf.scene.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh) return
        const mesh = child as THREE.Mesh
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        mats.forEach((m) => m && restore(m))
      })
      return
    }

    gltf.scene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return
      const mesh = child as THREE.Mesh
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      mats.forEach((m) => m && inject(m))
    })
  }, [gltf, revealUniforms, reveal])

  // 每帧：更新鼠标位置与淡入淡出（鼠标离开画布后平滑消失）
  useFrame((state, delta) => {
    if (!revealRef.current) return
    revealUniforms.uMouse.value.set(state.pointer.x, state.pointer.y)
    revealUniforms.uAspect.value = state.viewport.aspect
    const hovered = revealRef.current.hoveredRef?.current ?? true
    const target = hovered ? 1 : 0
    revealUniforms.uHover.value = THREE.MathUtils.damp(
      revealUniforms.uHover.value,
      target,
      5,
      delta,
    )
  })
  // ---------- 新增结束 ----------

  return (
    // 外层 group 承载自动旋转；内层直接挂载加载好的模型场景
    <group ref={spin}>
      <primitive object={gltf.scene} />
    </group>
  )
}
