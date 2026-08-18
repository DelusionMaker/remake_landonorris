import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TRAIL_SAMPLES, trailHistory } from '../trail/TrailHistory'

type MouseTrailProps = {
  /** 轨迹颜色 */
  color?: string
  /** 整体强度（0~1）：同时作为半透明色的透明度上限 */
  intensity?: number
  /** 光斑衰减速度：越大轨迹越细、拖尾越短 */
  size?: number
  /** 硬边阈值（0~1）：亮度超过该值显示，否则隐藏，边缘无渐变 */
  threshold?: number
  /** 轨迹存活时长（秒），即拖尾长度 */
  duration?: number
  /** 平面位置 */
  position?: [number, number, number]
  /** 平面尺寸，需足够大以覆盖整个视锥 */
  planeSize?: number
  /** 鼠标是否在画布内：不在时停止记录新点，轨迹自然淡出 */
  hoveredRef?: { current: boolean }
}

/**
 * 顶层鼠标轨迹：把鼠标 NDC 历史写入共享的 TrailHistory，
 * 片元着色器遍历所有历史点按「距离 + 年龄」衰减累加，再用硬边阈值二值化。
 * 渲染层级在 Head 之后、Helmet 之前（renderOrder=1）：
 * 覆盖 Head，但头盔显示区域绘制在轨迹之上，因此不影响头盔的 reveal。
 */
export function MouseTrail({
  color = '#dbdbdbff',
  intensity = 0.5,
  size = 20,
  threshold = 0.15,
  duration = 3,
  position = [0, 0, -4],
  planeSize = 20,
  hoveredRef,
}: MouseTrailProps) {
  const mesh = useRef<THREE.Mesh>(null!)

  const uniforms = useMemo(
    () => ({
      uTrail: { value: trailHistory.texture },
      uSamples: { value: TRAIL_SAMPLES },
      uTime: { value: 0 },
      uDuration: { value: duration },
      uSize: { value: size },
      uIntensity: { value: intensity },
      uThreshold: { value: threshold },
      uColor: { value: new THREE.Color(color) },
    }),
    [duration, size, intensity, threshold, color],
  )

  // 记录上次写入的位置，用于判断鼠标是否真的在移动
  const lastRecord = useRef<{ x: number; y: number } | null>(null)

  useFrame((state) => {
    // 平面始终面向相机，避免旋转时露出边缘
    if (mesh.current) mesh.current.lookAt(state.camera.position)

    uniforms.uTime.value = state.clock.elapsedTime

    // 鼠标在画布内才记录新轨迹点；离开后旧点按年龄自然淡出
    const hovered = hoveredRef?.current ?? true
    if (!hovered) {
      lastRecord.current = null
      return
    }

    const { x, y } = state.pointer
    // 静止检测：位置未明显变化则不写入新点，
    // 这样鼠标停止移动后轨迹点不再刷新，3 秒内按年龄自然消失
    if (lastRecord.current) {
      const dx = x - lastRecord.current.x
      const dy = y - lastRecord.current.y
      if (dx * dx + dy * dy < 1e-6) return
    }
    lastRecord.current = { x, y }
    // 写入共享历史（同帧时间戳去重，头盔 shader 读取同一份数据）
    trailHistory.record(x, y, state.clock.elapsedTime)
  })

  return (
    <mesh
      ref={mesh}
      position={position}
      // 渲染层级在 Head（0）之后、Helmet（2）之前：覆盖 Head，被头盔显示区域覆盖
      renderOrder={1}
      frustumCulled={false}
    >
      <planeGeometry args={[planeSize, planeSize]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        depthTest={false}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          varying vec2 vNdc;

          void main() {
            vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            vNdc = clip.xy / clip.w;
            gl_Position = clip;
          }
        `}
        fragmentShader={/* glsl */ `
          precision highp float;

          uniform sampler2D uTrail;
          uniform float uSamples;
          uniform float uTime;
          uniform float uDuration;
          uniform float uSize;
          uniform float uIntensity;
          uniform float uThreshold;
          uniform vec3 uColor;

          varying vec2 vNdc;

          void main() {
            float brightness = 0.0;
            for (int i = 0; i < 64; i++) {
              if (float(i) >= uSamples) break;
              vec4 rec = texture2D(uTrail, vec2((float(i) + 0.5) / uSamples, 0.5));
              float age = uTime - rec.z;
              // 未写入的点 rec.z 为很大的负数，age 必然超过 duration，会被 continue 跳过
              if (age < 0.0 || age >= uDuration) continue;

              float d = distance(vNdc, rec.xy);
              float weight = 1.0 - age / uDuration; // 时间衰减：越早的越淡
              brightness += weight * exp(-d * d * uSize); // 距离衰减：离鼠标越近越亮
            }
            // 硬边：超过阈值显示，否则隐藏，边缘无渐变
            float alpha = step(uThreshold, brightness) * uIntensity;
            gl_FragColor = vec4(uColor, alpha);
          }
        `}
      />
    </mesh>
  )
}
