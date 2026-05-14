/**
 * Strip obvious "new outfit" phrases from story text before sending it to the
 * image model when we already have a reference portrait (those lines often
 * bias the model away from the lock). Conservative — only removes sentences
 * that clearly describe putting on / wearing specific garments.
 * @param {string} narration
 * @returns {string}
 */
export function softenWardrobeLanguageForImage(narration) {
  const s = typeof narration === 'string' ? narration.trim() : ''
  if (!s) return ''
  let out = s
  const garment =
    'gown|dress|suit|uniform|armor|armour|cloak|cape|pajamas|pjs|coat|robe|costume|outfit|overalls|jumpsuit|vest|tunic|kimono|helmet|boots|sandals|slippers'
  const replacements = [
    new RegExp(
      `\\b(wearing|wore|dressed in|put on|slipped into|changed into)\\s+(a|an|her|his|their|the)\\s+[^.!?]{2,90}\\b(${garment})\\b[^.!?]*[.!?]`,
      'gi',
    ),
    new RegExp(
      `\\b(in|into)\\s+(a|an|her|his|their)\\s+[^.!?]{2,80}\\b(${garment})\\b[^.!?]*[.!?]`,
      'gi',
    ),
  ]
  for (const re of replacements) {
    out = out.replace(re, ' ')
  }
  return out.replace(/\s{2,}/g, ' ').trim().slice(0, 700)
}
