import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/sqlite'

export async function GET() {
  try {
    const db = getDb()
    const cases = db.prepare(`
      SELECT c.id, c.title, c.created_at,
             COUNT(cv.id) as messages
      FROM cases c
      LEFT JOIN conversations cv ON cv.case_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT 50
    `).all() as Array<{ id: string; title: string; created_at: string; messages: number }>

    return NextResponse.json({ cases })
  } catch {
    return NextResponse.json({ cases: [] })
  }
}
