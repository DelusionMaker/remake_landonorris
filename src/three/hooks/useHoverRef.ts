import { useRef } from 'react'

/**
 * 维护鼠标是否在画布内的 ref，避免每次指针进出触发 Canvas 子树重渲染。
 * 直接返回 { current: boolean }，可透传给 3D 组件的 reveal 配置。
 */
export function useHoverRef() {
  return useRef(false)
}
