// Kept dependency-free so any system can request a save without import cycles.

let savePending = false

export function requestSave() {
  savePending = true
}

export function consumeSaveRequest(): boolean {
  const p = savePending
  savePending = false
  return p
}
