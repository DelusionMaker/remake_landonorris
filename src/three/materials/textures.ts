import * as THREE from 'three'

/**
 * 材质通道类型：对应 three.js 标准材质（MeshStandardMaterial 等）的贴图槽位。
 * 命名与 three.js 的材质属性保持一致，便于直接赋值。
 */
export type TextureChannel =
  | 'map' // 漫反射 / 基础色 / albedo
  | 'normalMap' // 法线
  | 'roughnessMap' // 粗糙度
  | 'metalnessMap' // 金属度
  | 'aoMap' // 环境光遮蔽
  | 'emissiveMap' // 自发光
  | 'displacementMap' // 位移 / 高度
  | 'alphaMap' // 透明度
  | 'bumpMap' // 凹凸
  | 'matcap' // 材质捕捉（仅 MeshMatcapMaterial 使用）

/**
 * 每个通道对应的文件名关键字（不区分大小写）。
 * 顺序即匹配优先级：靠前的通道先匹配，一旦命中即认定类型。
 * 通过这套规则即可根据命名自动识别纹理类型。
 */
const CHANNEL_PATTERNS: Record<TextureChannel, RegExp[]> = {
  map: [/base[_-]?color/i, /albedo/i, /diffuse/i, /(^|[_-])color/i],
  normalMap: [/normal/i],
  roughnessMap: [/roughness/i, /rough/i],
  metalnessMap: [/metal(ness|ic)?/i],
  aoMap: [/ambient[_-]?occlusion/i, /(^|[_-])ao([_-]|$)/i],
  emissiveMap: [/emissive/i, /emission/i, /lens[_-]?flare/i, /flare/i, /glow/i],
  displacementMap: [/displacement/i, /height/i],
  alphaMap: [/alpha/i, /opacity/i, /(^|[_-])mask/i],
  bumpMap: [/bump/i],
  matcap: [/matcap/i],
}

/** 颜色类通道：需要 sRGB 色彩空间；其余为数据类通道，使用线性空间。 */
const COLOR_CHANNELS = new Set<TextureChannel>(['map', 'emissiveMap', 'matcap'])

export type ClassifiedTextures = Partial<Record<TextureChannel, THREE.Texture>>

/**
 * 依据文件名关键字识别纹理属于哪个材质通道。
 * 返回 null 表示无法识别（如纯蒙版/特殊用途贴图）。
 */
export function classifyChannel(filename: string): TextureChannel | null {
  for (const channel of Object.keys(CHANNEL_PATTERNS) as TextureChannel[]) {
    if (CHANNEL_PATTERNS[channel].some((re) => re.test(filename))) {
      return channel
    }
  }
  return null
}

/** 加载单个纹理，并按通道设置正确的色彩空间与朝向（适配 glTF 模型）。 */
export function loadTexture(url: string, channel: TextureChannel): THREE.Texture {
  // 用 onLoad 回调等待图片真正下载完成后再设置 needsUpdate，
  // 避免“Texture marked for update but no image data found”警告。
  const tex = new THREE.TextureLoader().load(url, (loaded) => {
    loaded.needsUpdate = true
  })
  // glTF 约定纹理不翻转 Y，保持与模型 UV 一致
  tex.flipY = false
  tex.colorSpace = COLOR_CHANNELS.has(channel)
    ? THREE.SRGBColorSpace
    : THREE.NoColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  return tex
}

/**
 * 将已分类的纹理应用到材质上。
 * - 标准通道（map / normalMap / roughnessMap ...）直接赋值；
 * - matcap 仅在材质本身为 MeshMatcapMaterial 时赋值，避免破坏 PBR 材质；
 * - 应用后统一标记 needsUpdate。
 */
export function applyTexturesToMaterial(
  material: THREE.Material,
  textures: ClassifiedTextures,
): void {
  for (const [channel, tex] of Object.entries(textures) as [
    TextureChannel,
    THREE.Texture,
  ][]) {
    if (!tex) continue

    if (channel === 'matcap') {
      // matcap 仅对 MeshMatcapMaterial 有效
      if ((material as THREE.MeshMatcapMaterial).isMeshMatcapMaterial) {
        ;(material as THREE.MeshMatcapMaterial).matcap = tex
      }
      continue
    }

    // 其余通道均为 MeshStandardMaterial 等标准材质的通用属性
    ;(material as unknown as Record<string, THREE.Texture>)[channel] = tex

    if (channel === 'metalnessMap') {
      const std = material as THREE.MeshStandardMaterial
      std.metalness = 1 // 关键：确保贴图生效
      std.metalnessMap = tex
      continue
    }

    if (channel === 'roughnessMap') {
      const std = material as THREE.MeshStandardMaterial
      std.roughness = 0.1 // 确保 roughness 贴图生效
      std.roughnessMap = tex
      continue
    }
  }
  material.needsUpdate = true
}
