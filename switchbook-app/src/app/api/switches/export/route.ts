import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all switches for the user
    const switches = await prisma.switch.findMany({
      where: { userId: session.user.id },
      orderBy: [
        { manufacturer: 'asc' },
        { name: 'asc' }
      ]
    })

    // Define headers matching the bulk upload template
    const headers = [
      'Switch Name',
      'Chinese Name',
      'Type',
      'Technology',
      'Magnetic Pole Orientation',
      'Magnet Position',
      'Magnet Polarity',
      'Initial Force (g)',
      'Initial Magnetic Flux (Gs)',
      'Bottom Out Magnetic Flux (Gs)',
      'PCB Thickness',
      'Compatibility',
      'Manufacturer',
      'Spring Weight',
      'Spring Length',
      'Actuation Force (g)',
      'Bottom Out Force (g)',
      'Pre-travel (mm)',
      'Bottom Out (mm)',
      'Top Housing',
      'Bottom Housing',
      'Stem',
      'Franken Top',
      'Franken Bottom',
      'Franken Stem',
      'Notes',
      'Image URL',
      'Date Obtained'
    ]

    // Convert switches to CSV rows
    const rows = switches.map(switchItem => [
      switchItem.name || '',
      switchItem.chineseName || '',
      switchItem.type || '',
      switchItem.technology || '',
      switchItem.magnetOrientation || '',
      switchItem.magnetPosition || '',
      switchItem.magnetPolarity || '',
      switchItem.initialForce?.toString() || '',
      switchItem.initialMagneticFlux?.toString() || '',
      switchItem.bottomOutMagneticFlux?.toString() || '',
      switchItem.pcbThickness || '',
      switchItem.compatibility || '',
      switchItem.manufacturer || '',
      switchItem.springWeight || '',
      switchItem.springLength || '',
      switchItem.actuationForce?.toString() || '',
      switchItem.bottomOutForce?.toString() || '',
      switchItem.preTravel?.toString() || '',
      switchItem.bottomOut?.toString() || '',
      switchItem.topHousing || '',
      switchItem.bottomHousing || '',
      switchItem.stem || '',
      switchItem.frankenTop || '',
      switchItem.frankenBottom || '',
      switchItem.frankenStem || '',
      switchItem.notes || '',
      switchItem.imageUrl || '',
      switchItem.dateObtained ? new Date(switchItem.dateObtained).toISOString().split('T')[0] : ''
    ])

    // Create CSV content
    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="switchbook-collection-${new Date().toISOString().split('T')[0]}.csv"`
      }
    })
  } catch (error) {
    console.error('Error exporting switches:', error)
    return NextResponse.json({ error: 'Failed to export switches' }, { status: 500 })
  }
}