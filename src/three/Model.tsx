// useGLTF：drei 提供的 hook，用来异步加载并缓存 glTF/GLB 模型
import { useGLTF } from '@react-three/drei'
// useFrame：react-three-fiber 的渲染循环 hook，每一帧都会调用回调（用于动画）
import { useFrame } from '@react-three/fiber'
// useLayoutEffect：在 DOM/场景更新后、浏览器绘制前同步执行，适合做测量与布局调整
import { useEffect, useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { type ClassifiedTextures, applyTexturesToMaterial } from './textures'

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

  return (
    // 外层 group 承载自动旋转；内层直接挂载加载好的模型场景
    <group ref={spin}>
      <primitive object={gltf.scene} />
    </group>
  )
}
