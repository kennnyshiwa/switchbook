'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface UserSubmission {
  id: string;
  name: string;
  manufacturer: string;
  type?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: {
    username: string;
  };
}

interface EditSuggestion {
  id: string;
  masterSwitch: {
    id: string;
    name: string;
    manufacturer: string;
  };
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  editedAt: string;
  approvedAt?: string;
  approvedBy?: {
    username: string;
  };
  changedFields: string[];
}

export default function UserSubmissionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [submissions, setSubmissions] = useState<UserSubmission[]>([]);
  const [editSuggestions, setEditSuggestions] = useState<EditSuggestion[]>([]);
  const [activeTab, setActiveTab] = useState<'submissions' | 'edits'>('submissions');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/auth/login');
      return;
    }

    fetchSubmissions();
  }, [session, status, router]);

  const fetchSubmissions = async () => {
    try {
      const response = await fetch('/api/user/submissions');
      if (response.ok) {
        const data = await response.json();
        setSubmissions(data.submissions || []);
        setEditSuggestions(data.editSuggestions || []);
      }
    } catch (error) {
      console.error('Failed to fetch submissions:', error);
    } finally {
      setLoading(false);
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
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Submissions</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Track the status of your submitted switches and edit suggestions
            </p>
          </div>
          <div className="flex gap-4">
            <Link
              href="/switches/submit"
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
            >
              Submit New Switch
            </Link>
            <Link
              href="/dashboard"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveTab('submissions')}
              className={`py-2 px-6 border-b-2 font-medium text-sm ${
                activeTab === 'submissions'
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              New Switches ({submissions.length})
            </button>
            <button
              onClick={() => setActiveTab('edits')}
              className={`py-2 px-6 border-b-2 font-medium text-sm ${
                activeTab === 'edits'
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              Edit Suggestions ({editSuggestions.length})
            </button>
          </nav>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {activeTab === 'submissions' ? submissions.length : editSuggestions.length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total {activeTab === 'submissions' ? 'Submissions' : 'Edit Suggestions'}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-yellow-600">
            {activeTab === 'submissions' 
              ? submissions.filter(s => s.status === 'PENDING').length
              : editSuggestions.filter(s => s.status === 'PENDING').length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Pending Review</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-green-600">
            {activeTab === 'submissions'
              ? submissions.filter(s => s.status === 'APPROVED').length
              : editSuggestions.filter(s => s.status === 'APPROVED').length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Approved</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-red-600">
            {activeTab === 'submissions'
              ? submissions.filter(s => s.status === 'REJECTED').length
              : editSuggestions.filter(s => s.status === 'REJECTED').length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Rejected</div>
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'submissions' ? (
        // Master Switch Submissions Tab
        submissions.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">You haven&apos;t submitted any master switches yet.</p>
            <Link
              href="/switches/submit"
              className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Submit Your First Switch
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {submissions.map((submission) => (
              <div
                key={submission.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {submission.name}
                      </h3>
                      <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                        submission.status === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
                          : submission.status === 'APPROVED'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                      }`}>
                        {submission.status}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
                      <div>
                        <span className="font-medium">Manufacturer:</span> {submission.manufacturer}
                      </div>
                      {submission.type && (
                        <div>
                          <span className="font-medium">Type:</span> {submission.type}
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Submitted:</span>{' '}
                        {formatDistanceToNow(new Date(submission.createdAt), { addSuffix: true })}
                      </div>
                      {submission.approvedAt && (
                        <div>
                          <span className="font-medium">
                            {submission.status === 'APPROVED' ? 'Approved' : 'Rejected'}:
                          </span>{' '}
                          {formatDistanceToNow(new Date(submission.approvedAt), { addSuffix: true })}
                          {submission.approvedBy && ` by ${submission.approvedBy.username}`}
                        </div>
                      )}
                    </div>

                    {submission.status === 'REJECTED' && submission.rejectionReason && (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 mb-3">
                        <p className="text-sm text-red-700 dark:text-red-300">
                          <span className="font-medium">Rejection reason:</span> {submission.rejectionReason}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-4">
                      <Link
                        href={`/switches/${submission.id}`}
                        className="text-blue-600 hover:underline text-sm dark:text-blue-400"
                      >
                        View Details →
                      </Link>
                      
                      {submission.status === 'APPROVED' && (
                        <Link
                          href={`/switches/${submission.id}/suggest-edit`}
                          className="text-purple-600 hover:underline text-sm dark:text-purple-400"
                        >
                          Suggest Edit →
                        </Link>
                      )}
                      
                      {submission.status === 'REJECTED' && (
                        <Link
                          href={`/switches/submit?prefill=${submission.id}`}
                          className="text-gray-600 hover:underline text-sm dark:text-gray-400"
                        >
                          Resubmit with Changes →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        // Edit Suggestions Tab
        editSuggestions.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">You haven&apos;t suggested any edits yet.</p>
            <Link
              href="/switches/browse"
              className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
            >
              Browse Master Database
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {editSuggestions.map((edit) => (
              <div
                key={edit.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                        Edit for: {edit.masterSwitch.name}
                      </h3>
                      <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                        edit.status === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
                          : edit.status === 'APPROVED'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                      }`}>
                        {edit.status}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
                      <div>
                        <span className="font-medium">Switch:</span> {edit.masterSwitch.manufacturer} {edit.masterSwitch.name}
                      </div>
                      <div>
                        <span className="font-medium">Fields Changed:</span> {edit.changedFields.length}
                      </div>
                      <div>
                        <span className="font-medium">Submitted:</span>{' '}
                        {formatDistanceToNow(new Date(edit.editedAt), { addSuffix: true })}
                      </div>
                      {edit.approvedAt && (
                        <div>
                          <span className="font-medium">
                            {edit.status === 'APPROVED' ? 'Approved' : 'Rejected'}:
                          </span>{' '}
                          {formatDistanceToNow(new Date(edit.approvedAt), { addSuffix: true })}
                          {edit.approvedBy && ` by ${edit.approvedBy.username}`}
                        </div>
                      )}
                    </div>

                    {edit.status === 'REJECTED' && edit.rejectionReason && (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 mb-3">
                        <p className="text-sm text-red-700 dark:text-red-300">
                          <span className="font-medium">Rejection reason:</span> {edit.rejectionReason}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-4">
                      <Link
                        href={`/switches/${edit.masterSwitch.id}`}
                        className="text-blue-600 hover:underline text-sm dark:text-blue-400"
                      >
                        View Switch →
                      </Link>
                      
                      {edit.status === 'REJECTED' && (
                        <Link
                          href={`/switches/${edit.masterSwitch.id}/suggest-edit`}
                          className="text-gray-600 hover:underline text-sm dark:text-gray-400"
                        >
                          Submit New Edit →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}