import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { type ClassifiedTextures, applyTexturesToMaterial } from '../materials/textures'
import { useModelFit } from '../hooks/useModelFit'
import { TRAIL_SAMPLES, trailHistory } from '../trail/TrailHistory'
import {
  createRevealUniforms,
  injectReveal,
  restoreReveal,
  traverseMaterials,
} from '../shaders/revealShader'

/** 鼠标局部显示（轨迹式探照灯）效果配置 */
export type RevealConfig = {
  /** 鼠标是否在画布内（外部用 ref 维护，避免触发 React 重渲染） */
  hoveredRef?: { current: boolean }
  /** 无轨迹时的基础透明度：0 完全隐藏；0.04 左右保留淡淡轮廓便于引导 */
  baseOpacity?: number
  /** 轨迹光斑衰减速度：越大显现区域越细 */
  trailSize?: number
  /** 轨迹强度（0~1）：放大模型显示亮度 */
  trailIntensity?: number
  /** 硬边阈值（0~1）：亮度超过该值显示，否则隐藏，边缘无渐变 */
  revealThreshold?: number
  /** 轨迹存活时长（秒）：鼠标停止后在该时长内渐渐消失 */
  trailDuration?: number
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
  // 是否开启自动旋转（保留接口，当前由外层 group 驱动）
  _autoRotate?: boolean
  // 自动旋转的速度（弧度/秒）
  _rotateSpeed?: number
  // 已按通道分类的纹理集：自动匹配并连接到模型材质的对应通道
  textures?: ClassifiedTextures
  // 按 mesh 名称定向应用的纹理集：key 为 mesh 名称（不区分大小写、子串匹配），
  // 匹配到的 mesh 仅使用该纹理集（替换通用 textures），用于给玻璃等部件单独贴材质
  texturesByMesh?: Record<string, ClassifiedTextures>
  // 鼠标局部显示（轨迹式探照灯）效果：不传则保持原有行为
  reveal?: RevealConfig
}

export function Model({
  url,
  draco = false,
  dracoPath = '/draco/',
  fit = 2.4,
  _autoRotate = false,
  _rotateSpeed = 0.3,
  textures,
  texturesByMesh,
  reveal,
}: ModelProps) {
  // 加载模型。若开启 draco，则传入解码器路径；否则传 undefined（使用普通加载）
  const gltf = useGLTF(url, draco ? dracoPath : undefined)
  // 用于包裹模型、承载旋转动画的外层 group 的引用
  const spin = useRef<THREE.Group>(null!)

  // 在挂载/更新后重新计算模型的缩放与居中，使其恰好适配 fit 尺寸并位于原点
  useModelFit(gltf.scene, fit)

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

  // ---------- 鼠标局部显示（轨迹式探照灯）效果 ----------
  // 用 ref 保存最新配置，避免 reveal 对象每次渲染变化时重复注入
  const revealRef = useRef(reveal)
  revealRef.current = reveal

  // 所有材质共享同一组 uniform，每帧只更新一次
  const revealUniforms = useMemo(() => createRevealUniforms(), [])

  // 配置变化同步到 uniform
  useEffect(() => {
    const cfg = revealRef.current
    if (!cfg) return
    revealUniforms.uBaseAlpha.value = cfg.baseOpacity ?? 0
    revealUniforms.uTrailSize.value = cfg.trailSize ?? 14
    revealUniforms.uTrailIntensity.value = cfg.trailIntensity ?? 1
    revealUniforms.uRevealThreshold.value = cfg.revealThreshold ?? 0.15
    revealUniforms.uTrailDuration.value = cfg.trailDuration ?? 3
    revealUniforms.uTrail.value = trailHistory.texture
    revealUniforms.uTrailSamples.value = TRAIL_SAMPLES
  }, [revealUniforms, reveal])

  // 给所有 mesh 材质注入「鼠标局部显示」shader
  // 注意：此 effect 必须放在「应用纹理」的 useEffect 之后，先贴图再改材质
  useEffect(() => {
    if (!reveal) {
      // 关闭效果时还原材质与渲染层级
      traverseMaterials(gltf.scene, restoreReveal)
      gltf.scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) child.renderOrder = 0
      })
      return
    }

    // 头盔显示区域绘制在轨迹平面（renderOrder=1）之上，
    // 这样灰色轨迹覆盖 Head 但不会盖住头盔的 reveal 显示
    gltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) child.renderOrder = 2
    })
    traverseMaterials(gltf.scene, (m) => injectReveal(m, revealUniforms))
  }, [gltf, revealUniforms, reveal])

  // 每帧：更新轨迹时间与淡入淡出（鼠标离开画布后平滑消失）
  useFrame((state, delta) => {
    if (!revealRef.current) return
    revealUniforms.uTime.value = state.clock.elapsedTime
    const hovered = revealRef.current.hoveredRef?.current ?? true
    const target = hovered ? 1 : 0
    revealUniforms.uHover.value = THREE.MathUtils.damp(
      revealUniforms.uHover.value,
      target,
      5,
      delta,
    )
  })
  // ---------- 轨迹式探照灯效果结束 ----------

  return (
    // 外层 group 承载自动旋转；内层直接挂载加载好的模型场景
    <group ref={spin}>
      <primitive object={gltf.scene} />
    </group>
  )
}
