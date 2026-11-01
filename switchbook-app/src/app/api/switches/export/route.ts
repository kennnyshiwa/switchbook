import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { switchesToCsv } from '@/lib/switchCsv'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all switches for the user
    const switches = await prisma.switch.findMany({
      where: { userId: session.user.id },
      include: { images: { orderBy: { order: 'asc' } } },
      orderBy: [
        { manufacturer: 'asc' },
        { name: 'asc' }
      ]
    })

    // Columns, escaping and value encoding are shared with the bulk-upload
    // importer (src/lib/switchCsv.ts) so an export re-imports losslessly.
    const csvContent = switchesToCsv(switches)

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="switchbook-collection-${new Date().toISOString().split('T')[0]}.csv"`
      }
    })
  } catch (error) {
    console.error('Error exporting switches:', error)
    return NextResponse.json({ error: 'Failed to export switches' }, { status: 500 })
  }
}
