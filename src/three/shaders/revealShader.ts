import * as THREE from 'three'

/** 探照灯效果运行时 uniform，由 Model 每帧更新。 */
export type RevealUniforms = {
  /** 无轨迹时的基础透明度 */
  uBaseAlpha: { value: number }
  /** 鼠标是否在画布内（平滑淡入淡出） */
  uHover: { value: number }
  /** 共享鼠标轨迹历史纹理（与背景轨迹同一份数据） */
  uTrail: { value: THREE.Texture | null }
  uTrailSamples: { value: number }
  /** 轨迹光斑衰减速度：越大显现区域越细 */
  uTrailSize: { value: number }
  /** 轨迹强度（0~1）：放大模型显示亮度 */
  uTrailIntensity: { value: number }
  /** 硬边阈值：亮度超过该值显示，否则隐藏（0~1） */
  uRevealThreshold: { value: number }
  /** 轨迹存活时长（秒）：鼠标停止后在该时长内渐渐消失 */
  uTrailDuration: { value: number }
  /** 当前时间（秒），用于轨迹年龄衰减 */
  uTime: { value: number }
}

export function createRevealUniforms(): RevealUniforms {
  return {
    uBaseAlpha: { value: 0 },
    uHover: { value: 0 },
    uTrail: { value: null },
    uTrailSamples: { value: 64 },
    uTrailSize: { value: 14 },
    uTrailIntensity: { value: 1 },
    uRevealThreshold: { value: 0.15 },
    uTrailDuration: { value: 3 },
    uTime: { value: 0 },
  }
}

/** 还原被探照灯修改过的材质（透明/深度写入/onBeforeCompile）。 */
export function restoreReveal(material: THREE.Material): void {
  const mat = material as THREE.MeshStandardMaterial
  mat.transparent = false
  mat.depthWrite = true
  // three 类型中 onBeforeCompile 不可为空，清空时需断言
  mat.onBeforeCompile = undefined as unknown as THREE.Material['onBeforeCompile']
  mat.needsUpdate = true
}

/**
 * 给材质注入「轨迹式探照灯」shader：
 * 头盔显示 = 鼠标轨迹亮度，与背景拖尾共用同一份历史数据。
 * 鼠标移动时产生新轨迹点 → 头盔沿轨迹显现；
 * 鼠标停止后旧点随时间衰减，uTrailDuration 秒内渐渐消失。
 * 该注入必须在纹理贴图之后执行（先贴图再改材质）。
 */
export function injectReveal(material: THREE.Material, uniforms: RevealUniforms): void {
  const mat = material as THREE.MeshStandardMaterial
  // 透明混合保留淡出；深度写入开启：reveal 显示的区域能遮挡后方物体（如线框）。
  // 隐藏区域在片元着色器里 discard，既不输出颜色也不写深度，后方物体照常可见。
  mat.transparent = true
  mat.depthWrite = true

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uBaseAlpha = uniforms.uBaseAlpha
    shader.uniforms.uHover = uniforms.uHover
    shader.uniforms.uTrail = uniforms.uTrail
    shader.uniforms.uTrailSamples = uniforms.uTrailSamples
    shader.uniforms.uTrailSize = uniforms.uTrailSize
    shader.uniforms.uTrailIntensity = uniforms.uTrailIntensity
    shader.uniforms.uRevealThreshold = uniforms.uRevealThreshold
    shader.uniforms.uTrailDuration = uniforms.uTrailDuration
    shader.uniforms.uTime = uniforms.uTime

    // 顶点着色器：把裁剪空间坐标传给片元（对 clip 坐标插值再除 w，透视正确）
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec4 vClipPos;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
vClipPos = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);`,
      )

    // 片元着色器：头盔按「到轨迹点集合的距离」显示（越近越亮），
    // 但边缘用 step 硬阈值二值化 —— 亮度超阈值即全显，否则全隐，无渐变。
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec4 vClipPos;
uniform float uBaseAlpha;
uniform float uHover;
uniform sampler2D uTrail;
uniform float uTrailSamples;
uniform float uTrailSize;
uniform float uTrailIntensity;
uniform float uRevealThreshold;
uniform float uTrailDuration;
uniform float uTime;`,
      )
      .replace(
        '#include <dithering_fragment>',
        `vec2 ndcPos = vClipPos.xy / vClipPos.w;
float brightness = 0.0;
for (int i = 0; i < 64; i++) {
  if (float(i) >= uTrailSamples) break;
  vec4 rec = texture2D(uTrail, vec2((float(i) + 0.5) / uTrailSamples, 0.5));
  float age = uTime - rec.z;
  // 未写入的点 rec.z 为很大的负数，age 必然超过 duration，会被 continue 跳过
  if (age < 0.0 || age >= uTrailDuration) continue;

  float d = distance(ndcPos, rec.xy);
  float weight = 1.0 - age / uTrailDuration; // 时间衰减：越早的越淡（控制拖尾寿命）
  brightness += weight * exp(-d * d * uTrailSize); // 距离衰减：离轨迹越近越亮
}
brightness *= uTrailIntensity;
// 硬边：超过阈值整片显示，否则隐藏，边缘无渐变
float revealAlpha = step(uRevealThreshold, brightness);
float targetAlpha = mix(uBaseAlpha, 1.0, revealAlpha);
gl_FragColor.a *= targetAlpha * uHover;
// 隐藏片元直接丢弃：不输出颜色也不写深度，后方线框等物体照常可见；
// 显示的片元正常写深度，可遮挡后方物体。阈值极小，不影响淡出动画。
if (gl_FragColor.a < 0.01) discard;
#include <dithering_fragment>`,
      )
  }
  mat.needsUpdate = true
}

/** 遍历场景中的所有 mesh 材质并应用注入函数。 */
export function traverseMaterials(
  scene: THREE.Object3D,
  apply: (material: THREE.Material) => void,
): void {
  scene.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return
    const mesh = child as THREE.Mesh
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    mats.forEach((m) => m && apply(m))
  })
}
