import { parseHeroGender } from './heroGender.js'

/** @typedef {'girl' | 'boy' | 'neutral'} HeroGender */

/**
 * Deterministic "look bible" for the hero so scene illustrations stay visually
 * consistent across requests (stateless server — same hero+genre+gender → same anchor).
 * @param {string} heroName
 * @param {string} genre
 * @param {unknown} [heroGenderRaw] 'girl' | 'boy' | 'neutral' from client
 * @returns {{ lockBlock: string, lockRecap: string }} Long lock + one-line recap for the end of the prompt.
 */
export function buildHeroVisualLock(heroName, genre, heroGenderRaw) {
  const hero = typeof heroName === 'string' && heroName.trim() ? heroName.trim().slice(0, 40) : 'Hero'
  const g = typeof genre === 'string' && genre.trim() ? genre.trim().slice(0, 60) : 'Story'
  /** @type {HeroGender} */
  const heroGender = parseHeroGender(heroGenderRaw)
  const key = `${hero.toLowerCase()}|${g.toLowerCase()}|${heroGender}`
  const h = hashString(key)

  const skins = [
    'warm light peach skin',
    'light tan skin',
    'medium brown skin',
    'deep brown skin',
    'olive skin',
  ]
  /** Kid-appropriate; aligned with reader gender choice for clearer art. */
  const hairs = {
    girl: [
      'shoulder-length chestnut hair with a soft side part',
      'black hair in two neat braids',
      'wavy auburn hair tied back with a simple band',
      'straight dark-brown hair in a chin-length bob',
      'curly brown hair in a puff with a headband',
    ],
    boy: [
      'short sandy hair with a neat fringe',
      'black hair buzzed short on the sides',
      'wavy brown hair cropped above the ears',
      'straight dark hair with a side part',
      'short curly hair with a rounded silhouette',
    ],
    neutral: [
      'short dark hair in a simple rounded cut',
      'chin-length brown hair tucked behind the ears',
      'fluffy black hair in a soft mushroom shape',
      'straight blond hair in a simple bowl cut',
      'wavy dark hair kept short and tidy',
    ],
  }
  const faces = [
    'round friendly face, bright eyes, small nose, gentle smile',
    'oval face, expressive eyes, light freckles across the nose',
    'heart-shaped face, big dark eyes, cheerful dimples',
    'round face with wide-set eyes and a curious smile',
  ]
  const outfits = {
    girl: [
      'a teal zip hoodie over a lavender tee, navy leggings, and gray sneakers',
      'a red crewneck sweater, denim skirt over leggings, and white sneakers',
      'a yellow raincoat over a sky-blue shirt, navy pants, and yellow boots',
      'a purple striped cardigan, gray pants, and brown shoes',
      'a light denim jacket over a white tee, olive joggers, and green sneakers',
    ],
    boy: [
      'a teal zip hoodie with dark-blue jeans and gray sneakers',
      'a red crewneck tee with olive cargo shorts and white sneakers',
      'a yellow raincoat over a sky-blue shirt, navy pants, and yellow boots',
      'a forest-green hoodie with black joggers and blue sneakers',
      'a light denim jacket over a white tee, khaki pants, and green sneakers',
    ],
    neutral: [
      'a teal zip hoodie with dark-blue jeans and gray sneakers',
      'a mustard hoodie, gray straight-leg pants, and white sneakers',
      'a navy windbreaker, khaki pants, and blue sneakers',
      'a rust-orange crewneck, dark joggers, and brown shoes',
      'a sage-green cardigan over a cream tee, navy pants, and gray sneakers',
    ],
  }
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

  const genderAuthority =
    heroGender === 'girl'
      ? 'Depict the protagonist clearly as a young girl (about 7–9, she/her). Match this in face and body; do not show facial hair or adult masculine cues.'
      : heroGender === 'boy'
        ? 'Depict the protagonist clearly as a young boy (about 7–9, he/him). Match this in face and body; keep presentation kid-appropriate.'
        : 'Depict the protagonist as a young child with neutral presentation (about 7–9, they/them); avoid strong gender stereotypes; soft kid features.'

  const skin = skins[h % skins.length]
  const hairList = hairs[heroGender]
  const hair = hairList[h % hairList.length]
  const face = faces[(h >> 7) % faces.length]
  const outfitList = outfits[heroGender]
  const outfit = outfitList[(h >> 11) % outfitList.length]
  const build = builds[(h >> 15) % builds.length]
  const accessory = accessories[(h >> 19) % accessories.length]

  const lockBlock =
    `[CHARACTER LOCK — same in every image of this story] ` +
    `PROTAGONIST GENDER (authoritative — overrides any conflicting visual cue in scene text): ${genderAuthority} ` +
    `The protagonist "${hero}" is always the same child: about 7–9 years old, ${build}, ${skin}, ${hair}, ${face}. ` +
    `They always wear this exact base outfit: ${outfit}. ` +
    `Always include this identifying detail: ${accessory}. ` +
    `Keep the same face shape, eye spacing, nose shape, hair length, hair color, skin tone, and clothing colors in every picture. ` +
    `Only change pose, expression, camera angle, lighting, and background. ` +
    `Genre is ${g}: show that in environment and props, not by redesigning the hero. ` +
    `Other characters may vary, but "${hero}" must match this lock exactly every time.`

  const lockRecap =
    `FINAL CHECK: "${hero}" must match the CHARACTER LOCK above — same gender presentation, face, hair, skin, outfit colors, and accessory; only pose and scene change.`

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
