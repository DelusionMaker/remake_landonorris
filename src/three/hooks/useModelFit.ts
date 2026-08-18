import { useLayoutEffect } from 'react'
import * as THREE from 'three'

export type ModelBounds = { minY: number; maxY: number }

/**
 * 将对象等比缩放到 fit 尺寸并居中到原点（复用 Model / HelmetWireframe 的相同逻辑）。
 * 返回 ref 回调，可在动画中读取模型在 y 方向的范围。
 */
export function useModelFit(
  object: THREE.Object3D,
  fit: number,
  onBounds?: (bounds: ModelBounds) => void,
): void {
  useLayoutEffect(() => {
    const box = new THREE.Box3().setFromObject(object)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    const s = fit / maxDim
    object.scale.setScalar(s)
    object.position.set(-center.x * s, -center.y * s, -center.z * s)

    onBounds?.({
      minY: (box.min.y - center.y) * s,
      maxY: (box.max.y - center.y) * s,
    })
  }, [object, fit, onBounds])
}
