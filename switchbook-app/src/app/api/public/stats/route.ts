import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const totalSwitches = await prisma.switch.count()
    
    return NextResponse.json({
      totalSwitches
    })
  } catch (error) {
    console.error('Failed to fetch public stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}