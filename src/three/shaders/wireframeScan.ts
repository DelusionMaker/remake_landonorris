import * as THREE from 'three'

/** 线框扫描效果运行时 uniform，由 HelmetWireframe 每帧更新。 */
export type WireframeScanUniforms = {
  uScanY: { value: number }
  uColor: { value: THREE.Color }
  uScanWidth: { value: number }
}

export function createWireframeScanUniforms(defaultColor: string): WireframeScanUniforms {
  return {
    uScanY: { value: 0 },
    uColor: { value: new THREE.Color(defaultColor) },
    uScanWidth: { value: 0.5 },
  }
}

/**
 * 把线框材质替换为带「扫描亮度渐变」的 shader：
 * 颜色始终用线框主色，alpha 随与扫描高度 uScanY 的距离淡出，
 * 远离扫描带的部分完全透明。
 */
export function applyWireframeScan(
  material: THREE.Material,
  uniforms: WireframeScanUniforms,
  wireColor: string,
): void {
  const m = material as THREE.MeshBasicMaterial
  m.wireframe = true
  m.color.set(wireColor)
  m.side = THREE.DoubleSide
  // 开启透明，让远离扫描带的线框淡出到全透明
  m.transparent = true
  // 叠加在实体模型之上时略微偏向相机，避免线框被深度遮挡
  m.polygonOffset = true
  m.polygonOffsetFactor = -1
  m.polygonOffsetUnits = -1
  // 透明材质关闭深度写入，避免透明线框间相互遮挡产生错误的叠加效果
  m.depthWrite = false

  m.onBeforeCompile = (shader) => {
    shader.uniforms.uScanY = uniforms.uScanY
    shader.uniforms.uColor = uniforms.uColor
    shader.uniforms.uScanWidth = uniforms.uScanWidth

    // 顶点着色器：把世界坐标传给片元
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWorldPos;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      )

    // 片元着色器：按与扫描高度 uScanY 的距离计算亮度 glow
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWorldPos;
        uniform float uScanY;
        uniform vec3 uColor;
        uniform float uScanWidth;`,
      )
      .replace(
        '#include <dithering_fragment>',
        `float scanDist = abs(vWorldPos.y - uScanY);
        float glow = 1.0 - smoothstep(0.0, uScanWidth, scanDist);
        gl_FragColor.rgb = uColor;
        gl_FragColor.a = glow;
        #include <dithering_fragment>`,
      )
  }
  m.needsUpdate = true
}
