/**
 * Scene art is opt-in. Accept common truthy strings (env files vary).
 * @returns {boolean}
 */
export function isSceneIllustrationsEnabled() {
  const raw = process.env.SCENE_ILLUSTRATIONS
  if (typeof raw !== 'string') return false
  const v = raw.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}
