import { APIError } from '@anthropic-ai/sdk'

const MAX_DETAIL = 280

/**
 * Map thrown errors to HTTP status + JSON body (no secrets).
 * @param {unknown} err
 * @returns {{ status: number, body: Record<string, unknown> }}
 */
export function mapStoryGenerationError(err) {
  const e = err instanceof Error ? err : new Error(String(err))

  if (e.code === 'MISSING_API_KEY') {
    return {
      status: 503,
      body: {
        error: 'Story server is not configured (missing ANTHROPIC_API_KEY).',
        code: 'MISSING_API_KEY',
      },
    }
  }

  if (e.code === 'PARSE_ERROR' || e.message.startsWith('Scene JSON was not valid')) {
    return {
      status: 502,
      body: {
        error:
          'Claude returned something we could not read as scene JSON. Try again, or tighten the prompt later.',
        code: 'PARSE_ERROR',
        detail: e.message.slice(0, MAX_DETAIL),
      },
    }
  }

  if (
    e.message.startsWith('Invalid scene:') ||
    e.message === 'Empty model response' ||
    e.message === 'No JSON object in model response' ||
    e.message === 'No text content in model response'
  ) {
    return {
      status: 502,
      body: {
        error:
          'The story response was missing narration or choices. Try again in a moment.',
        code: 'PARSE_ERROR',
        detail: e.message.slice(0, MAX_DETAIL),
      },
    }
  }

  if (err instanceof APIError) {
    const status = err.status
    const detail = (e.message || '').slice(0, MAX_DETAIL)

    if (status === 401) {
      return {
        status: 502,
        body: {
          error:
            'Anthropic rejected the API key (401). Check ANTHROPIC_API_KEY in .env or Vercel.',
          code: 'AUTH_ERROR',
        },
      }
    }

    if (status === 403) {
      return {
        status: 502,
        body: {
          error:
            'Anthropic returned 403 (forbidden). Your account may not have API access or billing enabled for this model.',
          code: 'FORBIDDEN',
          detail,
        },
      }
    }

    if (status === 404) {
      return {
        status: 502,
        body: {
          error:
            'That model ID was not found. In .env set ANTHROPIC_MODEL=claude-sonnet-4-6 (see Anthropic model docs).',
          code: 'BAD_MODEL',
          detail,
        },
      }
    }

    if (status === 400 && /model|not_found/i.test(detail)) {
      return {
        status: 502,
        body: {
          error:
            'Anthropic rejected the model name. Set ANTHROPIC_MODEL to a valid id for your account.',
          code: 'BAD_MODEL',
          detail,
        },
      }
    }

    if (status === 400) {
      return {
        status: 502,
        body: {
          error: 'Anthropic returned 400 (bad request). Check the request or your account.',
          code: 'BAD_REQUEST',
          detail,
        },
      }
    }

    if (status === 429) {
      return {
        status: 502,
        body: {
          error: 'Rate limited by Anthropic. Wait a moment and try again.',
          code: 'RATE_LIMIT',
          detail,
        },
      }
    }

    return {
      status: 502,
      body: {
        error: 'Could not generate the next scene. Try again in a moment.',
        code: 'API_ERROR',
        detail,
      },
    }
  }

  return {
    status: 502,
    body: {
      error: 'Could not generate the next scene. Try again in a moment.',
      code: 'GENERATION_FAILED',
      detail: e.message.slice(0, MAX_DETAIL),
    },
  }
}
