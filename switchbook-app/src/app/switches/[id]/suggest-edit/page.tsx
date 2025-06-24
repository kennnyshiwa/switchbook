'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { MasterSwitchEditForm } from '@/components/MasterSwitchEditForm';

interface MasterSwitchData {
  id: string;
  name: string;
  chineseName?: string;
  manufacturer: string;
  brand?: string;
  type?: string;
  technology?: string;
  compatibility?: string;
  actuationForce?: number;
  bottomOutForce?: number;
  preTravel?: number;
  bottomOut?: number;
  springWeight?: string;
  springLength?: string;
  topHousing?: string;
  bottomHousing?: string;
  stem?: string;
  stemColor?: string;
  preLubed?: boolean;
  releaseYear?: number;
  lifespan?: string;
  productUrl?: string;
  notes?: string;
  status: string;
}

export default function SuggestEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session, status } = useSession();
  const [switchData, setSwitchData] = useState<MasterSwitchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSwitchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/master-switches/${id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.status !== 'APPROVED') {
          alert('You can only suggest edits for approved switches');
          router.push(`/switches/${id}`);
          return;
        }
        setSwitchData(data);
      } else {
        router.push('/switches/browse');
      }
    } catch (error) {
      console.error('Failed to fetch switch:', error);
      router.push('/switches/browse');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/auth/login');
      return;
    }

    fetchSwitchData();
  }, [session, status, router, id, fetchSwitchData]);

  const handleSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/master-switches/${id}/suggest-edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit edit suggestion');
      }

      const result = await response.json();
      router.push(`/dashboard/submissions?editSubmitted=true`);
    } catch (error) {
      console.error('Submission error:', error);
      alert(error instanceof Error ? error.message : 'Failed to submit edit suggestion');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!switchData) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <Link
          href={`/switches/${id}`}
          className="inline-flex items-center text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 mb-6"
        >
          ← Back to Switch Details
        </Link>

        <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">Suggest Edit for {switchData.name}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Help improve our database by suggesting corrections or additional information for this switch.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Your edit suggestion will be reviewed by our moderators before being applied.
        </p>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-8">
          <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Guidelines for Edits</h3>
          <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
            <li>Only submit verifiable information from official sources</li>
            <li>Provide a clear explanation of what you&apos;re changing and why</li>
            <li>Include sources or references for your changes when possible</li>
            <li>Respect existing accurate information - only change what needs correction</li>
          </ul>
        </div>

        <MasterSwitchEditForm 
          currentData={switchData}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}