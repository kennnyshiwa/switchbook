'use client';

import { useState, useEffect } from 'react';
import { Switch } from '@prisma/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface MasterSwitchUpdatesNotificationProps {
  switches: Switch[];
  userId: string;
}

interface SwitchUpdateStatus {
  switchId: string;
  switchName: string;
  hasUpdates: boolean;
}

export default function MasterSwitchUpdatesNotification({ switches, userId }: MasterSwitchUpdatesNotificationProps) {
  const router = useRouter();
  const [updatesAvailable, setUpdatesAvailable] = useState<SwitchUpdateStatus[]>([]);
  const [isChecking, setIsChecking] = useState(true);
  const [showNotification, setShowNotification] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [highestMasterVersion, setHighestMasterVersion] = useState<number>(0);

  useEffect(() => {
    const checkForUpdates = async () => {
      const switchesWithMaster = switches.filter(s => s.masterSwitchId);
      
      if (switchesWithMaster.length === 0) {
        setIsChecking(false);
        return;
      }

      // First check if user has dismissed this notification
      let dismissedVersion = 0;
      try {
        const dismissalResponse = await fetch('/api/user/dismissed-notifications');
        if (dismissalResponse.ok) {
          const dismissals = await dismissalResponse.json();
          const masterUpdatesDismissal = dismissals.find((d: any) => d.type === 'MASTER_UPDATES');
          if (masterUpdatesDismissal && masterUpdatesDismissal.lastMasterUpdateVersion) {
            dismissedVersion = masterUpdatesDismissal.lastMasterUpdateVersion;
          }
        }
      } catch (error) {
        console.error('Failed to check dismissals:', error);
      }

      const updateStatuses: SwitchUpdateStatus[] = [];
      let maxVersion = 0;
      
      // Check each switch for updates
      await Promise.all(
        switchesWithMaster.map(async (switchItem) => {
          try {
            const response = await fetch(`/api/switches/${switchItem.id}/sync-master`);
            if (response.ok) {
              const data = await response.json();
              if (data.hasUpdates) {
                updateStatuses.push({
                  switchId: switchItem.id,
                  switchName: switchItem.name,
                  hasUpdates: true
                });
              }
              if (data.masterVersion > maxVersion) {
                maxVersion = data.masterVersion;
              }
            }
          } catch (error) {
            console.error(`Failed to check updates for switch ${switchItem.id}:`, error);
          }
        })
      );

      // Only show notification if there are updates AND the master version is newer than what was dismissed
      if (updateStatuses.length > 0 && maxVersion > dismissedVersion) {
        setUpdatesAvailable(updateStatuses);
        setHighestMasterVersion(maxVersion);
        setShowNotification(true);
      } else {
        setShowNotification(false);
      }
      
      setIsChecking(false);
    };

    checkForUpdates();
  }, [switches]);

  if (isChecking || updatesAvailable.length === 0 || !showNotification) {
    return null;
  }

  const handleUpdateAll = async () => {
    setIsUpdating(true);
    try {
      const response = await fetch('/api/switches/sync-all-master', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        // Refresh the page to show updated switches
        router.refresh();
        setShowNotification(false);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update switches');
      }
    } catch (error) {
      console.error('Failed to update switches:', error);
      alert('Failed to update switches');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDismiss = async () => {
    try {
      await fetch('/api/user/dismiss-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'MASTER_UPDATES',
          lastMasterUpdateVersion: highestMasterVersion
        }),
      });
      setShowNotification(false);
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
    }
  };

  return (
    <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/50 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
      <div className="flex items-start">
        <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            Master Switch Updates Available
          </h3>
          <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
            {updatesAvailable.length} of your switches have updates from the master database.
          </p>
          <div className="mt-2">
            <div className="text-sm text-yellow-700 dark:text-yellow-300">
              Switches with updates:
              <ul className="mt-1 list-disc list-inside">
                {updatesAvailable.slice(0, 3).map((update) => (
                  <li key={update.switchId}>{update.switchName}</li>
                ))}
                {updatesAvailable.length > 3 && (
                  <li>and {updatesAvailable.length - 3} more...</li>
                )}
              </ul>
            </div>
            
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={handleUpdateAll}
                disabled={isUpdating}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isUpdating ? 'Updating...' : 'Update All Switches'}
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2 bg-yellow-200 hover:bg-yellow-300 dark:bg-yellow-800 dark:hover:bg-yellow-700 text-yellow-800 dark:text-yellow-200 rounded-md text-sm font-medium transition-colors"
              >
                Dismiss (Keep Current)
              </button>
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowNotification(false)}
          className="ml-4 text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300 flex-shrink-0"
          title="Hide temporarily"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}