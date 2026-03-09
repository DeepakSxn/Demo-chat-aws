import { NextResponse } from 'next/server'
import { createHash } from 'crypto'

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

export async function GET() {
  const apiKey = normalizeApiKey(process.env.CHAT_API_KEY)
  const url = process.env.CHAT_API_URL

  const fingerprint = apiKey
    ? createHash('sha256').update(apiKey, 'utf8').digest('hex').slice(0, 12)
    : null

  return NextResponse.json(
    {
      CHAT_API_URL: url || null,
      CHAT_API_KEY_present: Boolean(apiKey),
      CHAT_API_KEY_length: apiKey?.length ?? 0,
      CHAT_API_KEY_sha256_12: fingerprint,
    },
    { status: 200 }
  )
}

