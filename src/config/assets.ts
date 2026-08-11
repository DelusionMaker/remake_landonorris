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
  },
  draco: '/draco/',
} as const
