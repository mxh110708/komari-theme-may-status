/** Load is an absolute scheduler count, not CPU percent. Keep a capacity-sized baseline. */
export function getSystemLoadAxisMaximum(peak: number, cpuCores = 1): number {
  const capacity = Number.isSafeInteger(cpuCores) && cpuCores > 0 ? cpuCores : 1
  const observed = Number.isFinite(peak) && peak > 0 ? peak : 0
  return Math.max(capacity, Math.ceil(observed * 1.1))
}
