/**
 * Read UTF-8 body from a Node-style IncomingMessage (Vercel + Vite dev).
 * @param {import('http').IncomingMessage} req
 * @param {number} [limitBytes]
 */
export function readRequestBody(req, limitBytes = 1_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    req.on('data', (chunk) => {
      total += chunk.length
      if (total > limitBytes) {
        req.destroy()
        reject(new Error('Body too large'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}
