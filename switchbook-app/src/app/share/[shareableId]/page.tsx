import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Image from "next/image"
import CollectionStats from "@/components/CollectionStats"

interface SharePageProps {
  params: Promise<{ shareableId: string }>
}

export default async function SharePage({ params }: SharePageProps) {
  const { shareableId } = await params
  
  const user = await prisma.user.findUnique({
    where: { shareableId },
    include: {
      switches: {
        orderBy: { createdAt: "desc" }
      }
    }
  })

  if (!user) {
    notFound()
  }

  const typeColors = {
    LINEAR: 'bg-red-100 text-red-800',
    TACTILE: 'bg-brown-100 text-brown-800',
    CLICKY: 'bg-blue-100 text-blue-800',
    SILENT_LINEAR: 'bg-gray-100 text-gray-800',
    SILENT_TACTILE: 'bg-purple-100 text-purple-800',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{user.username}&apos;s Switch Collection</h1>
          <p className="text-gray-600 mt-1">{user.switches.length} switches in collection</p>
        </div>

        {user.switches.length > 0 && (
          <div className="mb-8">
            <CollectionStats switches={user.switches} />
          </div>
        )}

        {user.switches.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No switches in this collection yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {user.switches.map((switchItem) => (
              <div key={switchItem.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                {switchItem.imageUrl && (
                  <div className="relative h-48 bg-gray-100">
                    <Image
                      src={switchItem.imageUrl}
                      alt={switchItem.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{switchItem.name}</h3>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeColors[switchItem.type]}`}>
                        {switchItem.type.replace('_', ' ')}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Manufacturer:</span> {switchItem.manufacturer}
                    </p>

                    {switchItem.springWeight && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Spring:</span> {switchItem.springWeight}
                      </p>
                    )}

                    {switchItem.travel && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Travel:</span> {switchItem.travel}
                      </p>
                    )}

                    {switchItem.notes && (
                      <p className="text-sm text-gray-500 mt-2">{switchItem.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}