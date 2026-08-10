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

type TextureSetMap = Record<string, ClassifiedTextures>

/**
 * 通过 Vite 的 import.meta.glob 在构建期静态收集指定目录下的所有纹理图片，
 * 并按“子目录 = 一个纹理集（对应一个模型/材质变体）”自动分组，
 * 同时根据文件名为每个文件识别通道类型。
 *
 * 目录结构示例：
 *   /public/assets/textures/helmet/
 *     ├─ gold/   → 纹理集 "gold"（对应某模型/变体）
 *     └─ disco/  → 纹理集 "disco"
 *
 * 返回结构：{ gold: { metalnessMap, normalMap, roughnessMap }, disco: { map, matcap, ... } }
 */
/**
 * 根据 import.meta.glob 收集到的模块表，按“子目录 = 一个纹理集（对应一个模型/材质变体）”
 * 自动分组，并依据文件名为每个文件识别通道类型。
 *
 * 注意：Vite 的 import.meta.glob 只接受“字面量”模式，因此实际的 glob 调用必须写在
 * 调用方（如 Helmet.tsx）并传入此处。baseDir 仅用于从路径中解析出子目录名。
 *
 * @param modules import.meta.glob(pattern) 的结果（路径 -> 模块）的键集合
 * @param baseDir 纹理根目录，例如 "/public/assets/textures/helmet"
 */
export function discoverTextureSets(
  modules: Record<string, unknown>,
  baseDir: string,
): TextureSetMap {
  // 规范化路径，确保以 "/" 开头、不以 "/" 结尾（相对于项目根目录）
  const base = (baseDir.startsWith('/') ? baseDir : `/${baseDir}`).replace(/\/$/, '')

  const sets: TextureSetMap = {}

  for (const path of Object.keys(modules)) {
    // public 下的文件在运行时以根路径提供（去掉 "/public" 前缀即为可访问的 URL）
    // 例如 /public/assets/textures/helmet/gold/Norris_Helmet_mat_Normal.webp
    //   -> 运行时 URL：/assets/textures/helmet/gold/Norris_Helmet_mat_Normal.webp
    const url = path.replace(/^\/public/, '')

    // 从路径中提取当前文件所在的子目录名，作为纹理集 key
    const afterBase = path.slice(base.length + 1) // 去掉基础路径前缀
    const segments = afterBase.split('/').filter(Boolean)
    const setName = segments.length > 1 ? segments[0] : 'default'
    const fileName = segments[segments.length - 1] ?? path

    const channel = classifyChannel(fileName)
    if (!channel) continue // 无法识别的纹理跳过（如纯装饰图）

    if (!sets[setName]) sets[setName] = {}
    // 同一通道若被多个文件命中，保留第一个（命名优先级已隐含在 CHANNEL_PATTERNS 顺序中）
    if (!sets[setName][channel]) {
      sets[setName][channel] = loadTexture(url, channel)
    }
  }

  return sets
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

/** 合并多个纹理集，后者覆盖前者同名通道（用于把多个变体拼成完整 PBR 材质）。 */
export function mergeTextureSets(...sets: ClassifiedTextures[]): ClassifiedTextures {
  return Object.assign({}, ...sets)
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

    // textures.ts 的 applyTexturesToMaterial 内，处理 metalnessMap 时：
    if (channel === 'metalnessMap') {
      const std = material as THREE.MeshStandardMaterial
      std.metalness = 1        // 关键：确保贴图生效
      std.metalnessMap = tex
      continue
    }

    if (channel === 'roughnessMap') {
      const std = material as THREE.MeshStandardMaterial
      std.roughness = 0.1        // 确保 roughness 贴图生效
      std.roughnessMap = tex
      continue
    }

    // // 自发光贴图需要同时开启自发光颜色，否则不可见
    // if (channel === 'emissiveMap') {
    //   const std = material as THREE.MeshStandardMaterial
    //   if (std.emissive) std.emissive.setRGB(1, 1, 1)
    //   else std.emissive = new THREE.Color(0xffffff)
    //   std.emissiveIntensity = 0.6
    // }
  }
  material.needsUpdate = true
}
