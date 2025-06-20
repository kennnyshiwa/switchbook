'use client'

import { useState } from 'react'
import Image from 'next/image'

export default function TestImagesPage() {
  const [testUrls] = useState([
    'https://img.notionusercontent.com/s3/prod-files-secure%2Fae23ef8d-1ebb-81e6-864d-0003ac2b6baf%2Fdabf5dfc-aefb-4ca8-980a-e16651fcc9c9%2FCIY_Asura_front.jpg/size/w=2000?exp=1749151284&sig=R_2FHrXDH5MnVMf-KjBY4GCk7PXUP20y_JPsFpmX_P0&id=1ff3ef8d-1ebb-818d-9785-fa31b8cb89b6&table=block&userId=1fcd872b-594c-81d2-bbda-0002ac6e2734',
    'https://90a1c75758623581b3f8-5c119c3de181c9857fcb2784776b17ef.ssl.cf2.rackcdn.com/668085_589192_03_front_zoom.jpg',
    'https://m.media-amazon.com/images/I/61DpIuIZDBL._AC_SL1500_.jpg',
    'https://assets3.razerzone.com/LVoafWegNoN6Ao0kFx94E2ogYyc=/1500x1000/https%3A%2F%2Fmedias-p1.phoenix.razer.com%2Fsys-master-phoenix-images-container%2Fh3a%2Fha5%2F9633034797086%2F2308107-mechanical-switches-pack-orange-1500x1000-2.jpg',
    'https://www.gloriousgaming.com/cdn/shop/files/GLO-KB-ACC-SWT-PANDA-LUBED_Web_Gallery_Switch.webp'
  ])

  const [imageStatuses, setImageStatuses] = useState<Record<string, 'loading' | 'success' | 'error'>>({})

  const handleImageLoad = (url: string) => {
    setImageStatuses(prev => ({ ...prev, [url]: 'success' }))
  }

  const handleImageError = (url: string) => {
    setImageStatuses(prev => ({ ...prev, [url]: 'error' }))
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <h1 className="text-2xl font-bold mb-8">Image Loading Test</h1>
      
      <div className="space-y-8">
        {testUrls.map((url, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 p-4 rounded-lg">
            <p className="text-sm mb-2 break-all">URL: {url}</p>
            <p className="text-sm mb-4">Status: {imageStatuses[url] || 'loading'}</p>
            
            <div className="flex gap-4">
              {/* Next.js Image component */}
              <div className="w-48 h-48 relative bg-gray-200">
                <p className="text-xs mb-1">Next.js Image:</p>
                <Image
                  src={url}
                  alt={`Test ${index}`}
                  fill
                  className="object-cover"
                  onLoad={() => handleImageLoad(url)}
                  onError={() => handleImageError(url)}
                  unoptimized={true}
                />
              </div>
              
              {/* Regular img tag for comparison */}
              <div className="w-48 h-48">
                <p className="text-xs mb-1">Regular img:</p>
                <img
                  src={url}
                  alt={`Test ${index}`}
                  className="w-full h-full object-cover"
                  onLoad={() => console.log('Regular img loaded:', url)}
                  onError={() => console.log('Regular img error:', url)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}