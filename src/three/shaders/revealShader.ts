import * as THREE from 'three'

/** 探照灯效果运行时 uniform，由 Model 每帧更新。 */
export type RevealUniforms = {
  uMouse: { value: THREE.Vector2 }
  uRadius: { value: number }
  uSmooth: { value: number }
  uAspect: { value: number }
  uBaseAlpha: { value: number }
  uHover: { value: number }
}

export function createRevealUniforms(): RevealUniforms {
  return {
    uMouse: { value: new THREE.Vector2(0, 0) },
    uRadius: { value: 0.4 },
    uSmooth: { value: 0.15 },
    uAspect: { value: 1 },
    uBaseAlpha: { value: 0 },
    uHover: { value: 0 },
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
 * 给材质注入「鼠标局部显示（探照灯）」shader：
 * 半径内 alpha=1，半径外 alpha=uBaseAlpha，并通过 uHover 平滑淡入淡出。
 * 该注入必须在纹理贴图之后执行（先贴图再改材质）。
 */
export function injectReveal(material: THREE.Material, uniforms: RevealUniforms): void {
  const mat = material as THREE.MeshStandardMaterial
  // 透明混合 + 关闭深度写入：隐藏区域的片元完全不遮挡其他部件
  mat.transparent = true
  mat.depthWrite = false

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uMouse = uniforms.uMouse
    shader.uniforms.uRadius = uniforms.uRadius
    shader.uniforms.uSmooth = uniforms.uSmooth
    shader.uniforms.uAspect = uniforms.uAspect
    shader.uniforms.uBaseAlpha = uniforms.uBaseAlpha
    shader.uniforms.uHover = uniforms.uHover

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

    // 片元着色器：片元 NDC 与鼠标 NDC 的距离 → 半径内 alpha=1，半径外 alpha=0
    // uAspect 修正宽高比，让"半径"在屏幕上接近正圆
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec4 vClipPos;
uniform vec2 uMouse;
uniform float uRadius;
uniform float uSmooth;
uniform float uAspect;
uniform float uBaseAlpha;
uniform float uHover;`,
      )
      .replace(
        '#include <dithering_fragment>',
        `vec2 ndcOffset = vClipPos.xy / vClipPos.w - uMouse;
float ndcDist = length(vec2(ndcOffset.x * uAspect, ndcOffset.y));
float revealMask = 1.0 - smoothstep(uRadius - uSmooth, uRadius + uSmooth, ndcDist);
float targetAlpha = mix(uBaseAlpha, 1.0, revealMask);
gl_FragColor.a *= targetAlpha * uHover;
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
