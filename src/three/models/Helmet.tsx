import { useMemo } from 'react'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Model, type RevealConfig } from './Model'
import { ASSETS } from '../../config/assets'
import { loadTexture, type ClassifiedTextures } from '../materials/textures'

type HelmetProps = {
  /** 鼠标局部显示（探照灯）效果配置 */
  reveal?: RevealConfig
  /** 模型目标尺寸：默认比 HelmetWireframe（2.4）略大，reveal 时能完全遮住线框 */
  fit?: number
  /** 跟随指针的最大倾斜角（弧度），与 Head 保持一致 */
  tilt?: number
  /** 指针响应的阻尼系数（0~1，越小越平滑），与 Head 保持一致 */
  damping?: number
}

export function Helmet({
  reveal,
  fit = 2.6,
  tilt = 0.1,
  damping = 0.06,
}: HelmetProps) {
  const group = useRef<THREE.Group>(null!)

  // 与 Head 相同的指针跟随倾斜：让头盔像「浮空立牌」一样随鼠标晃动
  useFrame((state) => {
    const g = group.current
    if (!g) return
    g.rotation.x += (state.pointer.y * tilt - g.rotation.x) * damping
    g.rotation.y += (-state.pointer.x * tilt - g.rotation.y) * damping
  })

  // 由 config/assets.ts 集中维护的 helmet/gold PBR 纹理（按通道分组）
  const textures = useMemo<ClassifiedTextures>(() => {
    const gold = ASSETS.textures.helmet.gold
    return {
      map: loadTexture(gold.map, 'map'),
      metalnessMap: loadTexture(gold.metalnessMap, 'metalnessMap'),
      normalMap: loadTexture(gold.normalMap, 'normalMap'),
      roughnessMap: loadTexture(gold.roughnessMap, 'roughnessMap'),
    }
  }, [])

  // 玻璃部件由 config/assets.ts 的 glass 纹理集提供
  const glassTextures = useMemo<ClassifiedTextures>(() => {
    const glass = ASSETS.textures.glass
    return {
      map: loadTexture(glass.map, 'map'),
      metalnessMap: loadTexture(glass.metalnessMap, 'metalnessMap'),
      normalMap: loadTexture(glass.normalMap, 'normalMap'),
      roughnessMap: loadTexture(glass.roughnessMap, 'roughnessMap'),
    }
  }, [])

  return (
    <group ref={group}>
      <Model
        url={ASSETS.models.helmet}
        draco
        dracoPath={ASSETS.draco}
        fit={fit}
        textures={textures}
        // 定向把玻璃纹理应用到模型中的 "glass" 节点（Mesh.028）
        texturesByMesh={{ glass: glassTextures }}
        reveal={reveal}
      />
    </group>
  )
}
