import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Image from "next/image"
import CollectionStats from "@/components/CollectionStats"
import ForceCurvesButton from "@/components/ForceCurvesButton"
import { SWITCH_TYPE_COLORS } from "@/constants/switchTypes"
import { formatWithUnit } from "@/utils/formatters"

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
                <div className="relative h-48 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  {switchItem.imageUrl ? (
                    <Image
                      src={switchItem.imageUrl}
                      alt={switchItem.name}
                      fill
                      className="object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                      <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-medium">No Image</span>
                    </div>
                  )}
                </div>
                
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      {!switchItem.name && switchItem.chineseName ? (
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{switchItem.chineseName}</h3>
                      ) : (
                        <>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{switchItem.name}</h3>
                          {switchItem.chineseName && (
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{switchItem.chineseName}</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      {switchItem.type ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${SWITCH_TYPE_COLORS[switchItem.type as keyof typeof SWITCH_TYPE_COLORS]}`}>
                          {switchItem.type.replace('_', ' ')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                          No Type
                        </span>
                      )}
                      {switchItem.dateObtained && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {(() => {
                            const date = new Date(switchItem.dateObtained)
                            // Add timezone offset to get the correct local date
                            const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000)
                            return utcDate.toLocaleDateString()
                          })()}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      <span className="font-medium">Manufacturer:</span> {switchItem.manufacturer || 'Unknown'}
                    </p>

                    {switchItem.technology && (
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        <span className="font-medium">Technology:</span> {switchItem.technology.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                    )}


                    {switchItem.compatibility && (
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        <span className="font-medium">Compatibility:</span> {switchItem.compatibility}
                      </p>
                    )}

                    {(switchItem.actuationForce || switchItem.bottomOutForce || switchItem.preTravel || switchItem.bottomOut || switchItem.springWeight || switchItem.springLength) && (
                      <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Specs</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          {switchItem.actuationForce && (
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <span className="font-medium">Actuation:</span> {switchItem.actuationForce}g
                            </p>
                          )}
                          {switchItem.bottomOutForce && (
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <span className="font-medium">Bottom Out:</span> {switchItem.bottomOutForce}g
                            </p>
                          )}
                          {switchItem.preTravel && (
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <span className="font-medium">Pre Travel:</span> {switchItem.preTravel}mm
                            </p>
                          )}
                          {switchItem.bottomOut && (
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <span className="font-medium">Bottom Out:</span> {switchItem.bottomOut}mm
                            </p>
                          )}
                          {switchItem.springWeight && (
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <span className="font-medium">Spring Weight:</span> {formatWithUnit(switchItem.springWeight, 'g')}
                            </p>
                          )}
                          {switchItem.springLength && (
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <span className="font-medium">Spring Length:</span> {formatWithUnit(switchItem.springLength, 'mm')}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {switchItem.technology === 'MAGNETIC' && (switchItem.initialForce || switchItem.totalTravel || switchItem.initialMagneticFlux || switchItem.bottomOutMagneticFlux || switchItem.magnetOrientation || switchItem.magnetPosition || switchItem.pcbThickness || switchItem.magnetPolarity) && (
                      <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Magnet Details</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          {switchItem.initialForce && (
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <span className="font-medium">Initial Force:</span> {switchItem.initialForce}g
                            </p>
                          )}
                          {switchItem.totalTravel && (
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <span className="font-medium">Total Travel:</span> {switchItem.totalTravel}mm
                            </p>
                          )}
                          {switchItem.initialMagneticFlux && (
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <span className="font-medium">Initial Flux:</span> {switchItem.initialMagneticFlux}Gs
                            </p>
                          )}
                          {switchItem.bottomOutMagneticFlux && (
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <span className="font-medium">Bottom Out Flux:</span> {switchItem.bottomOutMagneticFlux}Gs
                            </p>
                          )}
                          {switchItem.magnetOrientation && (
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <span className="font-medium">Pole Orientation:</span> {switchItem.magnetOrientation}
                            </p>
                          )}
                          {switchItem.magnetPosition && (
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <span className="font-medium">Magnet Position:</span> {switchItem.magnetPosition}
                            </p>
                          )}
                          {switchItem.pcbThickness && (
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <span className="font-medium">PCB Thickness:</span> {switchItem.pcbThickness}
                            </p>
                          )}
                          {switchItem.magnetPolarity && (
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <span className="font-medium">Magnet Polarity:</span> {switchItem.magnetPolarity}
                            </p>
                          )}
                        </div>
                      </div>
                    )}


                    {(switchItem.topHousing || switchItem.bottomHousing || switchItem.stem) && (
                      <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Materials</p>
                        {switchItem.topHousing && (
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            <span className="font-medium">Top:</span> {switchItem.topHousing}
                          </p>
                        )}
                        {switchItem.bottomHousing && (
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            <span className="font-medium">Bottom:</span> {switchItem.bottomHousing}
                          </p>
                        )}
                        {switchItem.stem && (
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            <span className="font-medium">Stem:</span> {switchItem.stem}
                          </p>
                        )}
                      </div>
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