import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export async function POST() {
  return NextResponse.json({ sessionId: `sess_${randomUUID()}` }, { status: 200 })
}

