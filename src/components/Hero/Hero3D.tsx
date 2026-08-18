import { Helmet } from '../../three/models/Helmet'
import { AssetCanvas } from '../../three/scenes/AssetCanvas'
import { ASSETS } from '../../config/assets'
import { useHoverRef } from '../../three/hooks/useHoverRef'
import * as THREE from 'three'

export function Hero3D() {
  // 用 ref 维护 hovered，避免每次鼠标进出都触发 Canvas 子树重渲染
  const hovered = useHoverRef()

  return (
    <AssetCanvas
      className="hero-canvas"
      background="#bebebe"
      cameraPosition={[0, 1, 6]}
      cameraFov={30}
      hdri={ASSETS.hdri.light}
      environmentIntensity={0.5}
      toneMapping={THREE.NoToneMapping}
      directionalLight={1}
      enableControls
      hoveredRef={hovered}
    >
      <Helmet
        reveal={{
          radius: 0.42, // 显示半径，可调
          smoothness: 0.2, // 边缘柔化宽度
          baseOpacity: 0.04, // 半径外保留淡淡轮廓，方便用户找到头盔
          hoveredRef: hovered,
        }}
      />
    </AssetCanvas>
  )
}
