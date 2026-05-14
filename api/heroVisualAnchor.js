/**
 * Deterministic "look bible" for the hero so scene illustrations stay visually
 * consistent across requests (stateless server — same hero+genre → same anchor).
 * @param {string} heroName
 * @param {string} genre
 * @returns {string} English phrase block for image prompts (no PII beyond the name).
 */
export function buildHeroVisualAnchor(heroName, genre) {
  const hero = typeof heroName === 'string' && heroName.trim() ? heroName.trim().slice(0, 40) : 'Hero'
  const g = typeof genre === 'string' && genre.trim() ? genre.trim().slice(0, 60) : 'Story'
  const key = `${hero.toLowerCase()}|${g.toLowerCase()}`
  const h = hashString(key)

  const skins = [
    'warm light skin',
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
  const outfits = [
    'a simple teal zip hoodie and dark jeans',
    'a red t-shirt and olive cargo shorts',
    'a yellow raincoat over blue pants',
    'a purple striped sweater and gray pants',
    'a denim jacket over a white tee and khakis',
    'a green hoodie and black joggers',
  ]
  const faces = [
    'round friendly face, soft expressive eyes, small nose',
    'oval face, bright eyes, light freckles on nose',
    'heart-shaped face, big curious eyes',
    'round face with cheerful dimples',
  ]

  const skin = skins[h % skins.length]
  const hair = hairs[(h >> 3) % hairs.length]
  const outfit = outfits[(h >> 7) % outfits.length]
  const face = faces[(h >> 11) % faces.length]

  return (
    `VISUAL CONTINUITY (mandatory): The protagonist "${hero}" must look the SAME in every illustration in this story: ` +
    `kid about 7–9 years old, ${skin}, ${hair}, ${face}, wearing ${outfit}. ` +
    `Keep the same body proportions, hair length, skin tone, and outfit colors in every image; only pose, facial expression, and background may change. ` +
    `Genre mood is ${g} — reflect that in setting and props, not by redesigning the hero.`
  )
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
