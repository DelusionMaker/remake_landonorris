import { Helmet } from '../../three/models/Helmet'
import { AssetCanvas } from '../../three/scenes/AssetCanvas'
import { ASSETS } from '../../config/assets'
import { useHoverRef } from '../../three/hooks/useHoverRef'
import * as THREE from 'three'
import { HelmetWireframe } from '../../three/models/HelmetWireframe'
import { Head } from '../../three/models/Head'
import { MouseTrail } from '../../three/models/MouseTrail'

// 头盔与背景轨迹共用同一组参数，保证两者显示区域精确对齐。
// 注意：头盔的 trailIntensity 需保持 1（与背景亮度计算一致），
// 背景的 intensity 只控制半透明色的 alpha，不影响显示边界。
const TRAIL_SIZE = 20 // 轨迹光斑粗细：越大越细
const TRAIL_THRESHOLD = 0.15 // 硬边阈值
const TRAIL_DURATION = 0.5 // 鼠标停止后的消失时长（秒）

export function Hero3D() {
  // 用 ref 维护 hovered，避免每次鼠标进出都触发 Canvas 子树重渲染
  const hovered = useHoverRef()

  return (
    <AssetCanvas
      className="hero-canvas"
      background="#bebebe"
      cameraPosition={[0, 0, 6]}
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
          baseOpacity: 0, // 无轨迹时完全隐藏
          hoveredRef: hovered,
          trailSize: TRAIL_SIZE, // 与背景一致
          trailIntensity: 1, // 保持 1，亮度计算与背景一致才能精确对齐
          revealThreshold: TRAIL_THRESHOLD, // 与背景一致
          trailDuration: TRAIL_DURATION, // 与背景一致
        }}
      />
      <HelmetWireframe />
      <Head />
      {/* 背景鼠标轨迹：与头盔共用同一份轨迹数据与参数，停止后同步淡出 */}
      <MouseTrail
        hoveredRef={hovered}
        size={TRAIL_SIZE}
        threshold={TRAIL_THRESHOLD}
        duration={TRAIL_DURATION}
      />
    </AssetCanvas>
  )
}
