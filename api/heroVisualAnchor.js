/**
 * Deterministic "look bible" for the hero so scene illustrations stay visually
 * consistent across requests (stateless server — same hero+genre → same anchor).
 * @param {string} heroName
 * @param {string} genre
 * @returns {{ lockBlock: string, lockRecap: string }} Long lock + one-line recap for the end of the prompt.
 */
export function buildHeroVisualLock(heroName, genre) {
  const hero = typeof heroName === 'string' && heroName.trim() ? heroName.trim().slice(0, 40) : 'Hero'
  const g = typeof genre === 'string' && genre.trim() ? genre.trim().slice(0, 60) : 'Story'
  const key = `${hero.toLowerCase()}|${g.toLowerCase()}`
  const h = hashString(key)

  const skins = [
    'warm light peach skin',
    'light tan skin',
    'medium brown skin',
    'deep brown skin',
    'olive skin',
  ]
  const hairs = [
    'short dark curly hair',
    'straight brown hair in a simple bob',
    'black hair in a neat puff bun',
    'wavy blond shoulder-length hair',
    'auburn hair in two braids',
    'short black hair with a side part',
  ]
  const faces = [
    'round friendly face, soft brown eyes, small nose, faint eyebrows',
    'oval face, bright hazel eyes, light freckles across the nose',
    'heart-shaped face, big dark eyes, gentle smile lines',
    'round face with cheerful dimples and wide-set brown eyes',
  ]
  const outfits = [
    'a teal zip hoodie with dark-blue jeans and gray sneakers',
    'a red crewneck tee with olive cargo shorts and white sneakers',
    'a yellow raincoat over a sky-blue shirt, navy pants, and yellow boots',
    'a purple striped sweater with gray pants and brown shoes',
    'a light denim jacket over a white tee, khaki pants, and green sneakers',
    'a forest-green hoodie with black joggers and blue sneakers',
  ]
  const builds = [
    'average kid height, slim build',
    'average kid height, slightly stocky build',
    'a bit tall for their age, lean build',
    'petite kid frame',
  ]
  const accessories = [
    'a small round yellow pin on the jacket',
    'a thin blue woven bracelet on one wrist',
    'a simple green canvas belt',
    'no jewelry; keep clothing plain',
  ]

  const skin = skins[h % skins.length]
  const hair = hairs[(h >> 3) % hairs.length]
  const face = faces[(h >> 7) % faces.length]
  const outfit = outfits[(h >> 11) % outfits.length]
  const build = builds[(h >> 15) % builds.length]
  const accessory = accessories[(h >> 19) % accessories.length]

  const lockBlock =
    `[CHARACTER LOCK — same in every image of this story] ` +
    `The protagonist "${hero}" is always the same child: about 7–9 years old, ${build}, ${skin}, ${hair}, ${face}. ` +
    `They always wear this exact base outfit: ${outfit}. ` +
    `Always include this identifying detail: ${accessory}. ` +
    `Keep the same face shape, eye spacing, nose shape, hair length, hair color, skin tone, and clothing colors in every picture. ` +
    `Only change pose, expression, camera angle, lighting, and background. ` +
    `Genre is ${g}: show that in environment and props, not by redesigning the hero. ` +
    `Other characters may vary, but "${hero}" must match this lock exactly every time.`

  const lockRecap =
    `FINAL CHECK: "${hero}" must match the CHARACTER LOCK above — same face, hair, skin, outfit colors, and accessory; only pose and scene change.`

  return { lockBlock, lockRecap }
}

/** @param {string} s */
function hashString(s) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}