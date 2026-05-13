import 'dotenv/config'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import illustrationHandler from './api/illustration.js'
import { generateStoryScene, normalizeStoryPayload } from './api/generateScene.js'
import { mapStoryGenerationError } from './api/mapStoryGenerationError.js'
import { synthesizeNeuralSpeech } from './api/neuralTtsRun.js'
import { resolveNeuralTtsProvider } from './api/resolveNeuralTts.js'
import { readRequestBody } from './api/readRequestBody.js'
import { STUB_SCENE_RESPONSE } from './api/_stubPayload.js'

function apiStoryPlugin() {
  return {
    name: 'api-story',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split('?')[0] ?? ''
        if (pathname !== '/api/story') {
          next()
          return
        }

        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
          res.statusCode = 204
          res.end()
          return
        }

        if (req.method !== 'POST') {
          res.setHeader('Allow', 'POST, OPTIONS')
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        void (async () => {
          res.setHeader('Content-Type', 'application/json')
          try {
            if (!process.env.ANTHROPIC_API_KEY?.trim()) {
              res.statusCode = 200
              res.end(JSON.stringify(STUB_SCENE_RESPONSE))
              return
            }

            const raw = await readRequestBody(req)
            let body = {}
            if (raw) {
              try {
                body = JSON.parse(raw)
              } catch {
                res.statusCode = 400
                res.end(JSON.stringify({ error: 'Invalid JSON body' }))
                return
              }
            }

            const payload = normalizeStoryPayload(body)
            const scene = await generateStoryScene(payload)
            res.statusCode = 200
            res.end(JSON.stringify(scene))
          } catch (err) {
            console.error('[api/story dev]', err)
            const { status, body } = mapStoryGenerationError(err)
            res.statusCode = status
            res.end(JSON.stringify(body))
          }
        })()
      })
    },
  }
}

function apiTtsPlugin() {
  return {
    name: 'api-tts',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split('?')[0] ?? ''
        if (pathname !== '/api/tts') {
          next()
          return
        }

        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
          res.statusCode = 204
          res.end()
          return
        }

        if (req.method !== 'POST') {
          res.setHeader('Allow', 'POST, OPTIONS')
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        void (async () => {
          const ttsResolved = resolveNeuralTtsProvider()
          if (!ttsResolved.ok) {
            const messages = {
              MISSING_OPENAI_KEY: 'Neural narration: set OPENAI_API_KEY or choose another provider.',
              MISSING_GEMINI_KEY:
                'Neural narration: set GEMINI_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY) or choose another provider.',
              MISSING_NEURAL_TTS:
                'Neural narration is not configured. Set OPENAI_API_KEY and/or GEMINI_API_KEY (optional TTS_PROVIDER).',
              INVALID_TTS_PROVIDER: 'Invalid TTS_PROVIDER. Use auto, openai, or gemini.',
            }
            res.statusCode = 503
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                error: messages[ttsResolved.code] ?? 'Neural narration is not configured.',
                code: ttsResolved.code,
              }),
            )
            return
          }

          try {
            const raw = await readRequestBody(req)
            const body = raw ? JSON.parse(raw) : {}
            const text = typeof body.text === 'string' ? body.text.trim() : ''
            if (!text) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Missing text' }))
              return
            }

            const { buffer: buf, contentType } = await synthesizeNeuralSpeech(text)
            res.statusCode = 200
            res.setHeader('Content-Type', contentType)
            res.setHeader('Cache-Control', 'no-store')
            res.end(buf)
          } catch (err) {
            console.error('[api/tts dev]', err)
            res.statusCode = 502
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Could not generate speech.', code: 'TTS_FAILED' }))
          }
        })()
      })
    },
  }
}

function apiIllustrationPlugin() {
  return {
    name: 'api-illustration',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split('?')[0] ?? ''
        if (pathname !== '/api/illustration') {
          next()
          return
        }
        void (async () => {
          try {
            await illustrationHandler(req, res)
          } catch (err) {
            console.error('[api/illustration dev]', err)
            if (!res.headersSent) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Illustration handler failed.' }))
            }
          }
        })()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react(), apiStoryPlugin(), apiTtsPlugin(), apiIllustrationPlugin()],
})
