'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Notification {
  id: string;
  type: 'submission_approved' | 'submission_rejected' | 'edit_approved' | 'edit_rejected';
  title: string;
  message: string;
  link?: string;
  linkText?: string;
  createdAt: string;
  read: boolean;
}

interface NotificationBannerProps {
  userId: string;
}

export default function NotificationBanner({ userId }: NotificationBannerProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/user/notifications');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.filter((n: Notification) => !n.read));
      }
    } catch (error) {
      // Failed to fetch notifications
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/user/notifications/${notificationId}/read`, {
        method: 'POST',
      });
      setNotifications(notifications.filter(n => n.id !== notificationId));
    } catch (error) {
      // Failed to mark notification as read
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/user/notifications/read-all', {
        method: 'POST',
      });
      setNotifications([]);
    } catch (error) {
      // Failed to mark all notifications as read
    }
  };

  if (isLoading || notifications.length === 0 || !showBanner) {
    return null;
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'submission_approved':
      case 'edit_approved':
        return 'bg-green-50 dark:bg-green-900/50 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200';
      case 'submission_rejected':
      case 'edit_rejected':
        return 'bg-red-50 dark:bg-red-900/50 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200';
      default:
        return 'bg-blue-50 dark:bg-blue-900/50 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200';
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'submission_approved':
      case 'edit_approved':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'submission_rejected':
      case 'edit_rejected':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div className="fixed bottom-4 right-4 max-w-lg z-50 space-y-2">
      {notifications.slice(0, 3).map((notification) => (
        <div
          key={notification.id}
          className={`border rounded-lg p-4 shadow-lg ${getNotificationColor(notification.type)}`}
        >
          <div className="flex items-start">
            <div className="flex-shrink-0 mr-3">
              {getIcon(notification.type)}
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-sm">{notification.title}</h4>
              <p className="text-sm mt-1">{notification.message}</p>
              {notification.link && (
                <Link
                  href={notification.link}
                  className="text-sm font-medium underline mt-2 inline-block"
                  onClick={() => markAsRead(notification.id)}
                >
                  {notification.linkText || 'View Details'} →
                </Link>
              )}
            </div>
            <button
              onClick={() => markAsRead(notification.id)}
              className="ml-4 flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      ))}
      
      {notifications.length > 3 && (
        <div className="text-center">
          <button
            onClick={markAllAsRead}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Clear all {notifications.length} notifications
          </button>
        </div>
      )}
    </div>
  );
}