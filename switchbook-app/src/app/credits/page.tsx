import Image from 'next/image'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function CreditsPage() {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect('/auth/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Community Credits</h1>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          {/* Main Contributors in 2 columns */}
          <div className="p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* SwitchOddities Column */}
              <div>
                <div className="flex flex-col items-center mb-6 h-[168px]">
                  <div className="flex-1 flex items-center">
                    <Image
                      src="/switch-odd-02_4.png"
                      alt="SwitchOddities"
                      width={180}
                      height={72}
                    />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">SwitchOddities</h2>
                </div>

                <div className="prose prose-lg dark:prose-invert max-w-none">
                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    The mechanical keyboard community owes an immense debt of gratitude to SwitchOddities for their 
                    years of dedicated service. What started as a passion project has grown into an invaluable resource 
                    that has shaped how enthusiasts discover, understand, and appreciate mechanical switches.
                  </p>

                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Switch Samples & Accessibility</h3>
                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    SwitchOddities has democratized switch exploration by providing affordable sample packs that allow 
                    newcomers and veterans alike to experience switches before committing to full sets. Their meticulous 
                    curation has introduced countless enthusiasts to switches they might never have discovered otherwise.
                  </p>

                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Rare Finds & Preservation</h3>
                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    SwitchOddities has developed a remarkable talent for sourcing rare and discontinued switches. Their 
                    connections and dedication have preserved keyboard history by making vintage and limited switches 
                    available to the community when they would otherwise be lost to time.
                  </p>

                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Knowledge & Education</h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    Perhaps most importantly, SwitchOddities has been a fountain of knowledge, sharing deep insights into 
                    switch design, manufacturing processes, and the rich history behind our favorite switches. Their 
                    detailed documentation and willingness to share expertise has educated an entire generation of 
                    keyboard enthusiasts about the nuances that make each switch unique.
                  </p>
                </div>
              </div>

              {/* ThereminGoat Column */}
              <div>
                <div className="flex flex-col items-center mb-6 h-[168px]">
                  <div className="flex-1 flex items-center">
                    <Image
                      src="/theremingoat.jpg"
                      alt="ThereminGoat"
                      width={120}
                      height={120}
                      className="rounded-full"
                    />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">ThereminGoat</h2>
                </div>

                <div className="prose prose-lg dark:prose-invert max-w-none">
                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    ThereminGoat has become the gold standard for mechanical switch documentation and analysis. Their 
                    comprehensive switch reviews go beyond simple impressions, providing detailed measurements, historical 
                    context, and technical analysis that has elevated the entire community&apos;s understanding of switches.
                  </p>

                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Force Curve Database</h3>
                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    The force curve repository maintained by ThereminGoat has become an invaluable resource, providing 
                    objective data that allows enthusiasts to compare switches based on actual measurements rather than 
                    subjective feel alone. This scientific approach has transformed how we discuss and evaluate switches.
                  </p>

                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">In-Depth Reviews</h3>
                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    Through meticulously detailed reviews, ThereminGoat has documented hundreds of switches with a level 
                    of thoroughness unmatched in the community. Each review includes historical background, manufacturing 
                    details, and comparative analysis that serves as both entertainment and education.
                  </p>

                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Community Education</h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    By consistently providing high-quality, objective content, ThereminGoat has raised the bar for switch 
                    analysis and helped countless enthusiasts develop a deeper appreciation for the engineering and artistry 
                    behind mechanical switches.
                  </p>
                </div>
              </div>
            </div>

            {/* Visit buttons */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
              <div className="flex justify-center">
                <a
                  href="https://switchoddities.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
                >
                  Visit SwitchOddities
                  <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
              <div className="flex justify-center">
                <a
                  href="https://www.theremingoat.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
                >
                  Visit ThereminGoat
                  <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Thank you quote */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mt-8">
              <p className="text-blue-800 dark:text-blue-200 text-center italic">
                &quot;Thank you to all who have contributed to making the mechanical keyboard community what it is today. 
                Your passion, dedication, and willingness to share knowledge have created something truly special.&quot;
              </p>
            </div>
          </div>

          {/* Additional Credits Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Additional Thanks</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">The Mechanical Keyboard Community</h3>
                <p className="text-gray-700 dark:text-gray-300">
                  To all the enthusiasts, collectors, reviewers, and makers who share their knowledge and passion, 
                  making this hobby what it is today. Every contribution, from detailed IC posts to simple collection 
                  photos, helps build our collective understanding and appreciation.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Open Source Contributors</h3>
                <p className="text-gray-700 dark:text-gray-300">
                  To everyone who contributes to open source keyboard projects, making the hobby more accessible 
                  and fostering innovation through shared knowledge.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}