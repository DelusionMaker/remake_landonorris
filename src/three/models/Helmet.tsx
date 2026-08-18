import { useMemo } from 'react'
import { useRef } from 'react'
import * as THREE from 'three'
import { Model, type RevealConfig } from './Model'
import { ASSETS } from '../../config/assets'
import { loadTexture, type ClassifiedTextures } from '../materials/textures'

type HelmetProps = {
  /** 鼠标局部显示（探照灯）效果配置 */
  reveal?: RevealConfig
}

export function Helmet({ reveal }: HelmetProps) {
  const group = useRef<THREE.Group>(null!)
  // useFrame(() => {
  //   const y = window.scrollY
  //   if (!group.current) return
  // })

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
        textures={textures}
        // 定向把玻璃纹理应用到模型中的 "glass" 节点（Mesh.028）
        texturesByMesh={{ glass: glassTextures }}
        reveal={reveal}
      />
    </group>
  )
}
