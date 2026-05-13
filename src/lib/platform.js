/**
 * Real iPhone / iPod / iPad from the user agent.
 *
 * We intentionally do **not** use `MacIntel` + `maxTouchPoints` here: that pattern matches many
 * macOS laptops (trackpad) and wrongly triggers iOS-only speech behavior on a Mac.
 *
 * iPadOS “desktop” Safari sometimes omits “iPad” from the UA; those devices may be treated like
 * desktop for auto-speak until Apple exposes a reliable signal.
 */
export function isIOSLikeDevice() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/i.test(navigator.userAgent)
}
