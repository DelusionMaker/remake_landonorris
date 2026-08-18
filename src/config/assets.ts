export const ASSETS = {
  models: {
    helmet: '/assets/models/helmet-21.glb',
    disco: '/assets/models/disco-02.glb',
    tracks: '/assets/models/tracks/tracks.glb',
  },
  hdri: {
    light: '/assets/hdri/studio_small_08_1k--light.hdr',
    dark: '/assets/hdri/studio_small_08_1k--dark.hdr',
  },
  rive: {
    signature: '/assets/rive/signature.riv',
    reef: '/assets/rive/reef.riv',
  },
  textures: {
    head: {
      diffuse: '/assets/textures/head/diffuse.webp',
      alpha: '/assets/textures/head/alpha.webp',
      depth: '/assets/textures/head/depth.webp',
      normal: '/assets/textures/head/normal.webp',
    },
    // 头盔 PBR 纹理（按通道分组，替代 Helmet 中的硬编码路径）
    helmet: {
      gold: {
        map: '/assets/textures/helmet/gold/Norris_Helmet_mat_BaseColor.webp',
        metalnessMap: '/assets/textures/helmet/Norris_Helmet_mat_Metallic.webp',
        normalMap: '/assets/textures/helmet/Norris_Helmet_mat_Normal.webp',
        roughnessMap: '/assets/textures/helmet/Norris_Helmet_mat_Roughness.webp',
      },
    },
    // 玻璃部件 PBR 纹理
    glass: {
      map: '/assets/textures/glass/Norris_Glass_mat_BaseColor.webp',
      metalnessMap: '/assets/textures/glass/Norris_Glass_mat_Metallic.webp',
      normalMap: '/assets/textures/glass/Norris_Glass_mat_Normal.webp',
      roughnessMap: '/assets/textures/glass/Norris_Glass_mat_Roughness.webp',
    },
    // 噪声贴图：用于生成边缘不规则的「探照灯」遮罩
    noise: '/assets/textures/noise/noise-03.webp',
  },
  draco: '/draco/',
} as const
