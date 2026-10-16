import type { PingLossMetricSeries, PingRecord } from '@/utils/rpc'
import { isValidLatencySample } from '@/utils/latencyRating'

export interface PingLossSample {
  failed: number
  total: number
  percent: number
}

export interface PingLossWindow {
  time: string
  end: string
  tasks: Map<number, PingLossSample>
}

export function getPingLossWindowMs(hours: number): number {
  if (hours <= 6)
    return 5 * 60_000
  if (hours <= 12)
    return 10 * 60_000
  if (hours <= 24)
    return 15 * 60_000
  if (hours <= 168)
    return 60 * 60_000
  return Math.max(2, Math.ceil(hours / 240)) * 60 * 60_000
}

export function getPingMetricLossWindowMs(series: PingLossMetricSeries[], hours: number): number {
  const base = getPingLossWindowMs(hours)
  // Older data can have coarser retention. Do not spread one aggregate over invented smaller buckets.
  return series.reduce((step, item) => {
    const interval = item.interval_seconds
    return typeof interval === 'number' && Number.isFinite(interval) && interval > 0
      ? Math.max(step, Math.ceil(interval * 1000 / base) * base)
      : step
  }, base)
}

function createPingLossWindows(hours: number, until: number, step: number, clipStart: boolean): PingLossWindow[] {
  if (!Number.isFinite(hours) || hours <= 0 || !Number.isFinite(until))
    return []
  const from = until - hours * 3_600_000
  const first = Math.floor(from / step) * step
  const last = (Math.ceil(until / step) - 1) * step
  const windows: PingLossWindow[] = []
  for (let time = first; time <= last; time += step) {
    windows.push({
      time: new Date(clipStart ? Math.max(time, from) : time).toISOString(),
      end: new Date(Math.min(time + step, until)).toISOString(),
      tasks: new Map(),
    })
  }
  return windows
}

function addPingLossSample(window: PingLossWindow, taskId: number, failed: number, total: number) {
  const sample = window.tasks.get(taskId) ?? { failed: 0, total: 0, percent: 0 }
  sample.failed += failed
  sample.total += total
  sample.percent = sample.failed / sample.total * 100
  window.tasks.set(taskId, sample)
}

/** Legacy fallback is a ratio of returned samples; it cannot reconstruct probes discarded by sampling. */
export function buildPingLossWindows(records: PingRecord[], hours: number, until: number): PingLossWindow[] {
  const step = getPingLossWindowMs(hours)
  const windows = createPingLossWindows(hours, until, step, true)
  const from = until - hours * 3_600_000
  const first = Math.floor(from / step) * step
  for (const record of records) {
    if (!isValidLatencySample(record))
      continue
    const time = Date.parse(record.time)
    if (time < from || time >= until)
      continue
    const window = windows[Math.floor((time - first) / step)]
    if (!window)
      continue
    addPingLossSample(window, record.task_id, record.value < 0 ? 1 : 0, 1)
  }
  return windows
}

/** Use the loss ratio and its count, never the last latency of a historical bucket. Null stays missing. */
export function buildPingMetricLossWindows(series: PingLossMetricSeries[], hours: number, until: number): PingLossWindow[] {
  const step = getPingMetricLossWindowMs(series, hours)
  const windows = createPingLossWindows(hours, until, step, false)
  const first = Math.floor((until - hours * 3_600_000) / step) * step
  for (const item of series) {
    for (const point of item.points) {
      const taskId = Number(point.tags?.task_id ?? item.tags?.task_id)
      const time = Date.parse(point.time)
      const count = point.count ?? (item.downsampled ? 0 : 1)
      if (!Number.isInteger(taskId) || taskId <= 0 || !Number.isFinite(time) || time < first || time >= until
        || typeof point.value !== 'number' || !Number.isFinite(point.value) || point.value < 0 || point.value > 1
        || !Number.isSafeInteger(count) || count <= 0) {
        continue
      }
      const window = windows[Math.floor((time - first) / step)]
      if (window)
        addPingLossSample(window, taskId, point.value * count, count)
    }
  }
  return windows
}
