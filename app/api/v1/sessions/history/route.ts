import { NextResponse } from 'next/server'

type UpstreamHistoryBody = {
  from: string
  sessionId: string
}

const DEFAULT_CHAT_URL =
  'https://slruck3a27.execute-api.ap-south-1.amazonaws.com/prod/chat'
const DEFAULT_HISTORY_URL =
  'https://slruck3a27.execute-api.ap-south-1.amazonaws.com/prod/history'

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status })
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function deriveHistoryUrl(): string {
  if (process.env.CHAT_HISTORY_URL) return process.env.CHAT_HISTORY_URL
  const chatUrl = process.env.CHAT_API_URL || DEFAULT_CHAT_URL
  return chatUrl.endsWith('/chat') ? chatUrl.replace(/\/chat$/, '/history') : DEFAULT_HISTORY_URL
}

export async function GET(request: Request) {
  // Backwards-compatible convenience: allow GET ?sessionId=...&from=...
  // If `from` is omitted, fallback to CHAT_FROM so local UI can keep working.
  const url = new URL(request.url)
  const sessionId = url.searchParams.get('sessionId')?.trim()
  const from = (url.searchParams.get('from') || process.env.CHAT_FROM || '').trim()

  if (!sessionId || !from) {
    return json(400, { error: 'Missing required query params: from, sessionId' })
  }

  const proxyRequest = new Request(request.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ from, sessionId }),
  })

  return POST(proxyRequest)
}

export async function POST(request: Request) {
  const apiKey = process.env.CHAT_API_KEY
  if (!apiKey) {
    return json(500, {
      error: 'Server misconfigured: missing CHAT_API_KEY',
    })
  }

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return json(400, {
      error: 'Invalid request body. Expected JSON.',
      example: { from: 'whatsapp:+919999999999', sessionId: 'uuid-v4' },
    })
  }

  const body = (rawBody ?? {}) as Record<string, unknown>
  const from = getString(body.from)?.trim()
  const sessionId = getString(body.sessionId)?.trim()

  if (!from || !sessionId) {
    return json(400, { error: 'Missing required fields: from, sessionId' })
  }

  const upstreamUrl = deriveHistoryUrl()
  const upstreamBody: UpstreamHistoryBody = { from, sessionId }

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
    return json(502, {
      error: 'Upstream returned invalid JSON',
      status: upstreamResponse.status,
    })
  }

  if (!upstreamResponse.ok) {
    return json(upstreamResponse.status, upstreamJson)
  }

  const items = Array.isArray(upstreamJson?.history) ? upstreamJson.history : []
  const messages = items
    .filter(
      (m: any) =>
        (m?.Role === 'user' || m?.Role === 'assistant') &&
        typeof m?.Content === 'string' &&
        m.Content.trim().length > 0
    )
    .map((m: any) => ({
      role: m.Role,
      content: m.Content,
      timestamp: m.Timestamp,
      userId: m.UserId,
    }))

  return json(200, {
    sessionId: upstreamJson.sessionId ?? sessionId,
    profile: upstreamJson.profile ?? {},
    messages,
  })
}

