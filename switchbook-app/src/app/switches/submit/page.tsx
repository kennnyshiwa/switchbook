'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { MasterSwitchSubmissionForm } from '@/components/MasterSwitchSubmissionForm';

export default function SubmitMasterSwitchPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/master-switches/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit master switch');
      }

      const result = await response.json();
      router.push(`/switches/${result.id}?submitted=true`);
    } catch (error) {
      console.error('Submission error:', error);
      alert(error instanceof Error ? error.message : 'Failed to submit master switch');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/switches/browse"
          className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-6"
        >
          ← Back to Browse
        </Link>

        <h1 className="text-3xl font-bold mb-2">Submit New Master Switch</h1>
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

        <MasterSwitchSubmissionForm 
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}