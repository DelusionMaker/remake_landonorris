import { useMemo } from 'react'
import { useRef } from 'react'
import * as THREE from 'three'
import { Model } from './Model'
import { ASSETS } from '../config/assets'
import { loadTexture, type ClassifiedTextures } from './textures'

export function Helmet() {
  const group = useRef<THREE.Group>(null!)
  // useFrame(() => {
  //   const y = window.scrollY
  //   if (!group.current) return
  // })

  // 直接加载指定的 4 张 PBR 纹理，并按命名规则匹配到对应材质通道：
  //   - 基础色 (map)         ← gold/Norris_Helmet_mat_BaseColor （sRGB 色彩空间）
  //   - 金属度 (metalnessMap) ← Norris_Helmet_mat_Metallic       （线性数据）
  //   - 法线 (normalMap)      ← Norris_Helmet_mat_Normal          （线性数据）
  //   - 粗糙度 (roughnessMap) ← Norris_Helmet_mat_Roughness       （线性数据）
  const textures = useMemo<ClassifiedTextures>(() => {
    return {
      map: loadTexture(
        '/assets/textures/helmet/gold/Norris_Helmet_mat_BaseColor.webp',
        'map',
      ),
      metalnessMap: loadTexture(
        '/assets/textures/helmet/Norris_Helmet_mat_Metallic.webp',
        'metalnessMap',
      ),
      normalMap: loadTexture(
        '/assets/textures/helmet/Norris_Helmet_mat_Normal.webp',
        'normalMap',
      ),
      roughnessMap: loadTexture(
        '/assets/textures/helmet/Norris_Helmet_mat_Roughness.webp',
        'roughnessMap',
      ),
    }
  }, [])

  // 玻璃部件（glass 节点 / Mesh.028）使用现有的 Norris_Glass PBR 纹理：
  //   - 基础色 (map)         ← Norris_Glass_mat_BaseColor （sRGB 色彩空间）
  //   - 金属度 (metalnessMap) ← Norris_Glass_mat_Metallic （线性数据）
  //   - 法线 (normalMap)      ← Norris_Glass_mat_Normal    （线性数据）
  //   - 粗糙度 (roughnessMap) ← Norris_Glass_mat_Roughness （线性数据）
  const glassTextures = useMemo<ClassifiedTextures>(() => {
    return {
      map: loadTexture(
        '/assets/textures/glass/Norris_Glass_mat_BaseColor.webp',
        'map',
      ),
      metalnessMap: loadTexture(
        '/assets/textures/glass/Norris_Glass_mat_Metallic.webp',
        'metalnessMap',
      ),
      normalMap: loadTexture(
        '/assets/textures/glass/Norris_Glass_mat_Normal.webp',
        'normalMap',
      ),
      roughnessMap: loadTexture(
        '/assets/textures/glass/Norris_Glass_mat_Roughness.webp',
        'roughnessMap',
      ),
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
      />
    </group>
  )
}
