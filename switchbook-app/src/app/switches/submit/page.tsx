'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { MasterSwitchSubmissionForm } from '@/components/MasterSwitchSubmissionForm';

interface SimilarSwitch {
  id: string;
  name: string;
  manufacturer: string;
  similarity: number;
}

export default function SubmitMasterSwitchPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    similarSwitches: SimilarSwitch[];
    pendingData: any;
  } | null>(null);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Sign In Required</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You need to be signed in to submit master switches.
          </p>
          <Link 
            href="/auth/signin" 
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (data: any, confirmNotDuplicate = false) => {
    setIsSubmitting(true);
    try {
      const submissionData = confirmNotDuplicate 
        ? { ...data, confirmNotDuplicate: true }
        : data;
        
      const response = await fetch('/api/master-switches/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData),
      });

      const responseData = await response.json();
      
      if (response.status === 409) {
        // Duplicate warning - show similar switches
        setDuplicateWarning({
          similarSwitches: responseData.similarSwitches,
          pendingData: data
        });
        setIsSubmitting(false);
        return;
      }
      
      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to submit master switch');
      }

      router.push(`/switches/${responseData.id}?submitted=true`);
    } catch (error) {
      console.error('Submission error:', error);
      alert(error instanceof Error ? error.message : 'Failed to submit master switch');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleConfirmSubmission = () => {
    if (duplicateWarning) {
      handleSubmit(duplicateWarning.pendingData, true);
      setDuplicateWarning(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/switches/browse"
          className="inline-flex items-center text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 mb-6"
        >
          ← Back to Browse
        </Link>

        <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">Submit New Master Switch</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Help expand our database by submitting a new switch. Your submission will be reviewed by our moderators before being published.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Fields marked with <span className="text-red-500">*</span> are required. All other fields are optional - fill in as much information as you have available.
        </p>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-8">
          <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Before You Submit</h3>
          <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
            <li>Search the existing database to ensure this switch hasn&apos;t already been added</li>
            <li>Provide as much accurate information as possible</li>
            <li>Include official specifications from the manufacturer when available</li>
            <li>Submissions typically take 24-48 hours to review</li>
          </ul>
        </div>

        {duplicateWarning && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-4">
              Similar Switches Found
            </h3>
            <p className="text-red-700 dark:text-red-300 mb-4">
              We found switches with similar names. Please review them to ensure you&apos;re not submitting a duplicate:
            </p>
            <div className="space-y-2 mb-6">
              {duplicateWarning.similarSwitches.map((sw) => (
                <div key={sw.id} className="bg-white dark:bg-gray-800 rounded p-3 flex justify-between items-center">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">{sw.name}</span>
                    <span className="text-gray-600 dark:text-gray-400 ml-2">by {sw.manufacturer}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {Math.round(sw.similarity * 100)}% similar
                    </span>
                    <Link
                      href={`/switches/${sw.id}`}
                      target="_blank"
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      View →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleConfirmSubmission}
                disabled={isSubmitting}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Continue Anyway'}
              </button>
              <button
                onClick={() => setDuplicateWarning(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel & Edit
              </button>
            </div>
          </div>
        )}
        
        <MasterSwitchSubmissionForm 
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}