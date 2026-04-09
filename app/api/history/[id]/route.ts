import { NextRequest, NextResponse } from 'next/server'
import { getConversations } from '@/lib/db/sqlite'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const conversations = getConversations(id)
    return NextResponse.json({ conversations })
  } catch {
    return NextResponse.json({ conversations: [] })
  }
}
