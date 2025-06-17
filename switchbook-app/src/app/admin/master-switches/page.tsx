'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface MasterSwitchSubmission {
  id: string;
  name: string;
  manufacturer: string;
  type?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedBy: {
    id: string;
    username: string;
    email: string;
  };
  createdAt: string;
  originalSubmissionData?: any;
}

export default function AdminMasterSwitchesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [submissions, setSubmissions] = useState<MasterSwitchSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session || session.user.role !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }

    fetchSubmissions();
  }, [session, status, router, filter, fetchSubmissions]);

  const fetchSubmissions = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/master-switches?status=${filter}`);
      if (response.ok) {
        const data = await response.json();
        setSubmissions(data);
      }
    } catch (error) {
      console.error('Failed to fetch submissions:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const handleApprove = async (id: string) => {
    if (!confirm('Are you sure you want to approve this submission?')) return;
    
    setProcessingId(id);
    try {
      const response = await fetch(`/api/admin/master-switches/${id}/approve`, {
        method: 'POST',
      });
      
      if (response.ok) {
        await fetchSubmissions();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to approve submission');
      }
    } catch (error) {
      console.error('Failed to approve:', error);
      alert('Failed to approve submission');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;
    
    setProcessingId(id);
    try {
      const response = await fetch(`/api/admin/master-switches/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      
      if (response.ok) {
        await fetchSubmissions();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to reject submission');
      }
    } catch (error) {
      console.error('Failed to reject:', error);
      alert('Failed to reject submission');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Master Switch Submissions</h1>
          <Link
            href="/admin"
            className="text-blue-600 hover:text-blue-700"
          >
            ← Back to Admin
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex">
            {(['pending', 'all', 'approved', 'rejected'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`py-2 px-6 border-b-2 font-medium text-sm ${
                  filter === status
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
                {status === 'pending' && submissions.length > 0 && (
                  <span className="ml-2 bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full text-xs">
                    {submissions.filter(s => s.status === 'PENDING').length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Submissions List */}
      <div className="space-y-4">
        {submissions.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">No {filter === 'all' ? '' : filter} submissions found.</p>
          </div>
        ) : (
          submissions.map((submission) => (
            <div
              key={submission.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold">
                      {submission.name}
                    </h3>
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                      submission.status === 'PENDING'
                        ? 'bg-yellow-100 text-yellow-800'
                        : submission.status === 'APPROVED'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {submission.status}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
                    <div>
                      <span className="font-medium">Manufacturer:</span> {submission.manufacturer}
                    </div>
                    {submission.type && (
                      <div>
                        <span className="font-medium">Type:</span> {submission.type}
                      </div>
                    )}
                    <div>
                      <span className="font-medium">Submitted by:</span>{' '}
                      <Link
                        href={`/admin/users?search=${submission.submittedBy.email}`}
                        className="text-blue-600 hover:underline"
                      >
                        {submission.submittedBy.username}
                      </Link>
                    </div>
                    <div>
                      <span className="font-medium">Submitted:</span>{' '}
                      {formatDistanceToNow(new Date(submission.createdAt), { addSuffix: true })}
                    </div>
                  </div>

                  {/* View Details */}
                  <div className="flex items-center gap-4">
                    <Link
                      href={`/switches/${submission.id}`}
                      target="_blank"
                      className="text-blue-600 hover:underline text-sm"
                    >
                      View Details →
                    </Link>
                    
                    {submission.originalSubmissionData && (
                      <button
                        onClick={() => {
                          const data = submission.originalSubmissionData;
                          alert(JSON.stringify(data, null, 2));
                        }}
                        className="text-gray-600 hover:underline text-sm"
                      >
                        View Raw Submission
                      </button>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {submission.status === 'PENDING' && (
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleApprove(submission.id)}
                      disabled={processingId === submission.id}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processingId === submission.id ? 'Processing...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleReject(submission.id)}
                      disabled={processingId === submission.id}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}