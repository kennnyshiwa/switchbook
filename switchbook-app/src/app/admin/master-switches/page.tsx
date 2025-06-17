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

interface EditSuggestion {
  id: string;
  masterSwitchId: string;
  masterSwitch: {
    id: string;
    name: string;
    manufacturer: string;
  };
  editedBy: {
    id: string;
    username: string;
    email: string;
  };
  changedFields: string[];
  newData: any;
  previousData: any;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  editedAt: string;
}

export default function AdminMasterSwitchesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [submissions, setSubmissions] = useState<MasterSwitchSubmission[]>([]);
  const [editSuggestions, setEditSuggestions] = useState<EditSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'submissions' | 'edits'>('submissions');
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null);
  const [expandedEdit, setExpandedEdit] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/master-switches?status=${filter}`);
      if (response.ok) {
        const data = await response.json();
        setSubmissions(data);
      }
    } catch (error) {
      console.error('Failed to fetch submissions:', error);
    }
  }, [filter]);

  const fetchEditSuggestions = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/master-switch-edits?status=${filter}`);
      if (response.ok) {
        const data = await response.json();
        setEditSuggestions(data);
      }
    } catch (error) {
      console.error('Failed to fetch edit suggestions:', error);
    }
  }, [filter]);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session || session.user.role !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }

    setLoading(true);
    Promise.all([
      fetchSubmissions(),
      fetchEditSuggestions()
    ]).finally(() => setLoading(false));
  }, [session, status, router, filter, fetchSubmissions, fetchEditSuggestions]);

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

  const handleApproveEdit = async (id: string) => {
    if (!confirm('Are you sure you want to approve this edit suggestion?')) return;
    
    setProcessingId(id);
    try {
      const response = await fetch(`/api/admin/master-switch-edits/${id}/approve`, {
        method: 'POST',
      });
      
      if (response.ok) {
        await fetchEditSuggestions();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to approve edit');
      }
    } catch (error) {
      console.error('Failed to approve edit:', error);
      alert('Failed to approve edit');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectEdit = async (id: string) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;
    
    setProcessingId(id);
    try {
      const response = await fetch(`/api/admin/master-switch-edits/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      
      if (response.ok) {
        await fetchEditSuggestions();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to reject edit');
      }
    } catch (error) {
      console.error('Failed to reject edit:', error);
      alert('Failed to reject edit');
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Master Switch Management</h1>
          <Link
            href="/admin"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            ← Back to Admin
          </Link>
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
              New Submissions
              {submissions.filter(s => s.status === 'PENDING').length > 0 && (
                <span className="ml-2 bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full text-xs">
                  {submissions.filter(s => s.status === 'PENDING').length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('edits')}
              className={`py-2 px-6 border-b-2 font-medium text-sm ${
                activeTab === 'edits'
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              Edit Suggestions
              {editSuggestions.filter(e => e.status === 'PENDING').length > 0 && (
                <span className="ml-2 bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full text-xs">
                  {editSuggestions.filter(e => e.status === 'PENDING').length}
                </span>
              )}
            </button>
          </nav>
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
                    ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
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

      {/* Content based on active tab */}
      {activeTab === 'submissions' ? (
        <div className="space-y-4">
          {submissions.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">No {filter === 'all' ? '' : filter} submissions found.</p>
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
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {submission.name}
                    </h3>
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                      submission.status === 'PENDING'
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                        : submission.status === 'APPROVED'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
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
                        className="text-blue-600 hover:underline dark:text-blue-400"
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
                    <button
                      onClick={() => setExpandedSubmission(expandedSubmission === submission.id ? null : submission.id)}
                      className="text-blue-600 hover:underline text-sm dark:text-blue-400"
                    >
                      {expandedSubmission === submission.id ? 'Hide Details' : 'View Details'} →
                    </button>
                    
                    <Link
                      href={`/switches/${submission.id}`}
                      target="_blank"
                      className="text-purple-600 hover:underline text-sm dark:text-purple-400"
                    >
                      View Public Page ↗
                    </Link>
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
              
              {/* Expanded Details */}
              {expandedSubmission === submission.id && submission.originalSubmissionData && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Full Switch Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {/* Basic Info */}
                    <div className="space-y-2">
                      <h5 className="font-medium text-gray-700 dark:text-gray-300">Basic Information</h5>
                      {submission.originalSubmissionData.name && (
                        <p className="text-gray-900 dark:text-white"><span className="font-medium">Name:</span> {submission.originalSubmissionData.name}</p>
                      )}
                      {submission.originalSubmissionData.chineseName && (
                        <p className="text-gray-900 dark:text-white"><span className="font-medium">Chinese Name:</span> {submission.originalSubmissionData.chineseName}</p>
                      )}
                      {submission.originalSubmissionData.manufacturer && (
                        <p className="text-gray-900 dark:text-white"><span className="font-medium">Manufacturer:</span> {submission.originalSubmissionData.manufacturer}</p>
                      )}
                      {submission.originalSubmissionData.type && (
                        <p className="text-gray-900 dark:text-white"><span className="font-medium">Type:</span> {submission.originalSubmissionData.type}</p>
                      )}
                      {submission.originalSubmissionData.technology && (
                        <p className="text-gray-900 dark:text-white"><span className="font-medium">Technology:</span> {submission.originalSubmissionData.technology}</p>
                      )}
                    </div>
                    
                    {/* Force Specs */}
                    <div className="space-y-2">
                      <h5 className="font-medium text-gray-700 dark:text-gray-300">Force Specifications</h5>
                      {submission.originalSubmissionData.actuationForce && (
                        <p className="text-gray-900 dark:text-white"><span className="font-medium">Actuation Force:</span> {submission.originalSubmissionData.actuationForce}g</p>
                      )}
                      {submission.originalSubmissionData.bottomOutForce && (
                        <p className="text-gray-900 dark:text-white"><span className="font-medium">Bottom Out Force:</span> {submission.originalSubmissionData.bottomOutForce}g</p>
                      )}
                      {submission.originalSubmissionData.initialForce && (
                        <p className="text-gray-900 dark:text-white"><span className="font-medium">Initial Force:</span> {submission.originalSubmissionData.initialForce}g</p>
                      )}
                      {submission.originalSubmissionData.preTravel && (
                        <p className="text-gray-900 dark:text-white"><span className="font-medium">Pre Travel:</span> {submission.originalSubmissionData.preTravel}mm</p>
                      )}
                      {submission.originalSubmissionData.bottomOut && (
                        <p className="text-gray-900 dark:text-white"><span className="font-medium">Total Travel:</span> {submission.originalSubmissionData.bottomOut}mm</p>
                      )}
                    </div>
                    
                    {/* Materials */}
                    <div className="space-y-2">
                      <h5 className="font-medium text-gray-700 dark:text-gray-300">Materials</h5>
                      {submission.originalSubmissionData.topHousing && (
                        <p className="text-gray-900 dark:text-white"><span className="font-medium">Top Housing:</span> {submission.originalSubmissionData.topHousing}</p>
                      )}
                      {submission.originalSubmissionData.bottomHousing && (
                        <p className="text-gray-900 dark:text-white"><span className="font-medium">Bottom Housing:</span> {submission.originalSubmissionData.bottomHousing}</p>
                      )}
                      {submission.originalSubmissionData.stem && (
                        <p className="text-gray-900 dark:text-white"><span className="font-medium">Stem:</span> {submission.originalSubmissionData.stem}</p>
                      )}
                      {submission.originalSubmissionData.springWeight && (
                        <p className="text-gray-900 dark:text-white"><span className="font-medium">Spring Weight:</span> {submission.originalSubmissionData.springWeight}</p>
                      )}
                      {submission.originalSubmissionData.springLength && (
                        <p className="text-gray-900 dark:text-white"><span className="font-medium">Spring Length:</span> {submission.originalSubmissionData.springLength}</p>
                      )}
                    </div>
                    
                    {/* Additional Info */}
                    <div className="space-y-2">
                      <h5 className="font-medium text-gray-700 dark:text-gray-300">Additional Information</h5>
                      {submission.originalSubmissionData.compatibility && (
                        <p className="text-gray-900 dark:text-white"><span className="font-medium">Compatibility:</span> {submission.originalSubmissionData.compatibility}</p>
                      )}
                      {submission.originalSubmissionData.imageUrl && (
                        <p className="text-gray-900 dark:text-white"><span className="font-medium">Image URL:</span> <a href={submission.originalSubmissionData.imageUrl} target="_blank" className="text-blue-600 hover:underline dark:text-blue-400">View Image</a></p>
                      )}
                      {submission.originalSubmissionData.notes && (
                        <div className="text-gray-900 dark:text-white">
                          <span className="font-medium">Notes:</span>
                          <p className="mt-1 text-gray-600 dark:text-gray-400">{submission.originalSubmissionData.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {editSuggestions.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">No {filter === 'all' ? '' : filter} edit suggestions found.</p>
            </div>
          ) : (
            editSuggestions.map((edit) => (
              <div
                key={edit.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                        Edit Suggestion for {edit.masterSwitch.name}
                      </h3>
                      <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                        edit.status === 'PENDING'
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                          : edit.status === 'APPROVED'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                      }`}>
                        {edit.status}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
                      <div>
                        <span className="font-medium">Switch:</span> {edit.masterSwitch.name} by {edit.masterSwitch.manufacturer}
                      </div>
                      <div>
                        <span className="font-medium">Edited by:</span> {edit.editedBy.username} ({edit.editedBy.email})
                      </div>
                      <div>
                        <span className="font-medium">Submitted:</span> {formatDistanceToNow(new Date(edit.editedAt), { addSuffix: true })}
                      </div>
                      <div>
                        <span className="font-medium">Fields changed:</span> {edit.changedFields.join(', ')}
                      </div>
                    </div>

                    {edit.newData.editReason && (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-3 mb-4">
                        <p className="text-sm text-gray-900 dark:text-white">
                          <span className="font-medium">Edit reason:</span> {edit.newData.editReason}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setExpandedEdit(expandedEdit === edit.id ? null : edit.id)}
                        className="text-blue-600 hover:underline text-sm dark:text-blue-400"
                      >
                        {expandedEdit === edit.id ? 'Hide Changes' : 'View Changes'} →
                      </button>
                      <Link
                        href={`/switches/${edit.masterSwitch.id}`}
                        target="_blank"
                        className="text-purple-600 hover:underline text-sm dark:text-purple-400"
                      >
                        View Switch ↗
                      </Link>
                    </div>
                  </div>

                  {edit.status === 'PENDING' && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleApproveEdit(edit.id)}
                        disabled={processingId === edit.id}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {processingId === edit.id ? 'Processing...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleRejectEdit(edit.id)}
                        disabled={processingId === edit.id}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Expanded Edit Details */}
                {expandedEdit === edit.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Proposed Changes</h4>
                    <div className="space-y-3">
                      {edit.changedFields.map(field => {
                        const previousValue = edit.previousData[field];
                        const newValue = edit.newData[field];
                        
                        return (
                          <div key={field} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                            <div>
                              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1')}
                              </p>
                              <div className="text-sm">
                                <span className="text-red-600 dark:text-red-400">Previous: </span>
                                <span className="text-gray-900 dark:text-white">{previousValue || 'None'}</span>
                              </div>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">&nbsp;</p>
                              <div className="text-sm">
                                <span className="text-green-600 dark:text-green-400">New: </span>
                                <span className="text-gray-900 dark:text-white">{newValue || 'None'}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}