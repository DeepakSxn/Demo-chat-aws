import { NextResponse } from 'next/server'

type LegacyClientBody = {
  sessionId?: string
  message?: string
  from?: string
}

type UpstreamBody = {
  from: string
  text: string
  sessionId?: string
}

const DEFAULT_UPSTREAM_URL =
  'https://slruck3a27.execute-api.ap-south-1.amazonaws.com/prod/chat'

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status })
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function normalizeApiKey(value: string | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

export async function POST(request: Request) {
  const apiKey = normalizeApiKey(process.env.CHAT_API_KEY)
  if (!apiKey) {
    return json(500, {
      error: 'Server misconfigured: missing CHAT_API_KEY',
    })
  }

  const upstreamUrl = process.env.CHAT_API_URL || DEFAULT_UPSTREAM_URL

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return json(400, {
      error: 'Invalid request body. Expected JSON.',
      example: { sessionId: 'sess_001', message: 'Hello' },
    })
  }

  const body = (rawBody ?? {}) as Record<string, unknown>

  // Support both:
  // - Legacy UI shape: { sessionId, message }
  // - Upstream shape: { from, text, sessionId }
  const sessionId = getString(body.sessionId)?.trim() || undefined
  const text = getString(body.text) || getString(body.message) || ''
  const from =
    getString(body.from) ||
    process.env.CHAT_FROM ||
    'whatsapp:+919999999999'

  if (!text.trim()) {
    return json(400, {
      error: 'Invalid request body. Expected message/text.',
      example: { sessionId: 'sess_001', message: 'Hello' },
    })
  }

  const upstreamBody: UpstreamBody = { from, text, ...(sessionId ? { sessionId } : {}) }

  let upstreamResponse: Response
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(upstreamBody),
    })
  } catch (error) {
    return json(502, {
      error: 'Upstream request failed',
      detail: error instanceof Error ? error.message : 'Unknown error',
    })
  }

  let upstreamJson: any = null
  try {
    upstreamJson = await upstreamResponse.json()
  } catch {
    // If upstream returns non-JSON, pass a generic error back.
    return json(502, {
      error: 'Upstream returned invalid JSON',
      status: upstreamResponse.status,
    })
  }

  if (!upstreamResponse.ok) {
    console.error('[mirror proxy] upstream_error', {
      status: upstreamResponse.status,
      upstreamUrl,
      from,
      hasSessionId: Boolean(sessionId),
      bodyKeys: Object.keys(upstreamBody),
      upstreamJson,
    })
    return json(upstreamResponse.status, upstreamJson)
  }

  // Keep response compatible with existing UI expectations.
  return json(200, {
    sessionId: upstreamJson.sessionId,
    reply: upstreamJson.reply ?? upstreamJson.message ?? upstreamJson.response,
    sentinel_status: upstreamJson.sentinel_status,
  })
}

