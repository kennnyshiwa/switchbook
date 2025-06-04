import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Image from "next/image"
import CollectionStats from "@/components/CollectionStats"
import ForceCurvesButton from "@/components/ForceCurvesButton"

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
    LINEAR: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    TACTILE: 'bg-brown-100 text-brown-800 dark:bg-brown-900/20 dark:text-brown-400',
    CLICKY: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    SILENT_LINEAR: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    SILENT_TACTILE: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{user.username}&apos;s Switch Collection</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{user.switches.length} switches in collection</p>
        </div>

        {user.switches.length > 0 && (
          <div className="mb-8">
            <CollectionStats switches={user.switches} />
          </div>
        )}

        {user.switches.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No switches in this collection yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {user.switches.map((switchItem) => (
              <div key={switchItem.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                {switchItem.imageUrl && (
                  <div className="relative h-48 bg-gray-100 dark:bg-gray-700">
                    <Image
                      src={switchItem.imageUrl}
                      alt={switchItem.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{switchItem.name}</h3>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeColors[switchItem.type]}`}>
                        {switchItem.type.replace('_', ' ')}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Manufacturer:</span> {switchItem.manufacturer || 'Unknown'}
                    </p>

                    {switchItem.springWeight && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Spring Weight:</span> {switchItem.springWeight}g
                      </p>
                    )}

                    {switchItem.springLength && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Spring Length:</span> {switchItem.springLength}mm
                      </p>
                    )}


                    {switchItem.notes && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{switchItem.notes}</p>
                    )}

                    {/* Force Curves Button */}
                    <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                      <ForceCurvesButton 
                        switchName={switchItem.name}
                        manufacturer={switchItem.manufacturer}
                        variant="button"
                        className="w-full justify-center"
                      />
                    </div>
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