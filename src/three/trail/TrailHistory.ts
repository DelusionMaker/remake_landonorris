import * as THREE from 'three'

/** 轨迹历史采样点数（各 shader 内写死上限 64） */
export const TRAIL_SAMPLES = 64

/**
 * 全局共享的鼠标轨迹历史：背景轨迹平面与头盔「轨迹式显示」共用同一份数据，
 * 保证头盔的显现区域与背景拖尾完全同步。
 */
class TrailHistory {
  readonly texture: THREE.DataTexture
  readonly data: Float32Array
  private head = 0
  private lastRecordedTime = -Infinity

  constructor() {
    // 每个历史点一个 texel（RGBA）：R=x, G=y, B=记录时刻, A=1
    // 时间通道初始为很大的负数，保证未写入的点在年龄计算时被跳过
    const data = new Float32Array(TRAIL_SAMPLES * 4).fill(-1000)
    this.data = data
    this.texture = new THREE.DataTexture(
      data,
      TRAIL_SAMPLES,
      1,
      THREE.RGBAFormat,
      THREE.FloatType,
    )
    this.texture.needsUpdate = true
  }

  /** 记录一个轨迹点（同一时间戳去重，避免多组件同帧重复写入） */
  record(x: number, y: number, time: number): void {
    if (time === this.lastRecordedTime) return
    this.lastRecordedTime = time
    const i = this.head
    this.data[i * 4 + 0] = x
    this.data[i * 4 + 1] = y
    this.data[i * 4 + 2] = time
    this.data[i * 4 + 3] = 1
    this.head = (i + 1) % TRAIL_SAMPLES
    this.texture.needsUpdate = true
  }
}

export const trailHistory = new TrailHistory()
