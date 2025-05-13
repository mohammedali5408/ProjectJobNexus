// File: app/lib/notification-service.ts
// This utility file provides functions to create different types of notifications

import { Timestamp } from 'firebase/firestore';

// Types
export type NotificationType = 
  // Applicant notification types
  | 'application_viewed' 
  | 'status_change' 
  | 'message' 
  | 'interview' 
  | 'job_update' 
  | 'system'
  // Recruiter notification types
  | 'new_application' 
  | 'application_update' 
  | 'candidate_message' 
  | 'job_stats';

export type Action = {
  label: string;
  url: string;
};

export type NotificationData = {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  createdAt: Timestamp;
  read: boolean;
  relatedId?: string; // Job ID or application ID
  jobTitle?: string;
  companyName?: string;
  candidateName?: string;
  actions?: Action[];
};

/**
 * Create a new notification
 */
export async function createNotification(notificationData: Omit<NotificationData, 'createdAt' | 'read'>) {
  try {
    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...notificationData,
        // These fields are set automatically by the server
        // but we include them here for TypeScript
        createdAt: Timestamp.now(),
        read: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create notification');
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: string) {
  try {
    const response = await fetch(`/api/notifications/${notificationId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        read: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to mark notification as read');
    }

    return await response.json();
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string) {
  try {
    const response = await fetch('/api/notifications/read-all', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to mark all notifications as read');
    }

    return await response.json();
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string) {
  try {
    const response = await fetch(`/api/notifications/${notificationId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete notification');
    }

    return await response.json();
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
}

/**
 * Get notification count for a user
 */
export async function getNotificationCount(userId: string, onlyUnread: boolean = true) {
  try {
    const url = new URL('/api/notifications/count', window.location.origin);
    url.searchParams.append('userId', userId);
    if (onlyUnread) {
      url.searchParams.append('read', 'false');
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get notification count');
    }

    const data = await response.json();
    return data.count;
  } catch (error) {
    console.error('Error getting notification count:', error);
    throw error;
  }
}

// Helper functions to create specific types of notifications for applicants

/**
 * Create a notification when a recruiter views an application
 */
export function createApplicationViewedNotification({
  userId,
  applicationId,
  jobTitle,
  companyName,
  recruiterName,
}: {
  userId: string;
  applicationId: string;
  jobTitle: string;
  companyName: string;
  recruiterName: string;
}) {
  return createNotification({
    userId,
    title: 'Application Viewed',
    message: `${recruiterName} from ${companyName} has viewed your application.`,
    type: 'application_viewed',
    relatedId: applicationId,
    jobTitle,
    companyName,
    actions: [
      {
        label: 'View Application',
        url: `/applicant/applications/${applicationId}`,
      },
    ],
  });
}

/**
 * Create a notification when application status changes
 */
export function createStatusChangeNotification({
  userId,
  applicationId,
  jobTitle,
  companyName,
  status,
}: {
  userId: string;
  applicationId: string;
  jobTitle: string;
  companyName: string;
  status: string;
}) {
  let title = 'Application Status Updated';
  let message = `Your application for ${jobTitle} at ${companyName} has been updated to "${status}".`;
  
  if (status === 'shortlisted') {
    title = 'Application Shortlisted';
    message = `Congratulations! Your application for ${jobTitle} at ${companyName} has been shortlisted.`;
  } else if (status === 'rejected') {
    title = 'Application Not Selected';
    message = `We're sorry, your application for ${jobTitle} at ${companyName} was not selected at this time.`;
  } else if (status === 'hired') {
    title = 'Offer Extended';
    message = `Congratulations! ${companyName} would like to extend an offer for the ${jobTitle} position.`;
  }
  
  return createNotification({
    userId,
    title,
    message,
    type: 'status_change',
    relatedId: applicationId,
    jobTitle,
    companyName,
    actions: [
      {
        label: 'View Application',
        url: `/applicant/applications/${applicationId}`,
      },
    ],
  });
}

/**
 * Create a notification for an interview invitation
 */
export function createInterviewNotification({
  userId,
  applicationId,
  jobTitle,
  companyName,
  interviewDate,
}: {
  userId: string;
  applicationId: string;
  jobTitle: string;
  companyName: string;
  interviewDate: Date;
}) {
  // Format date nicely
  const dateString = interviewDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  const timeString = interviewDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
  
  return createNotification({
    userId,
    title: 'Interview Invitation',
    message: `You've been invited to interview for ${jobTitle} at ${companyName} on ${dateString} at ${timeString}.`,
    type: 'interview',
    relatedId: applicationId,
    jobTitle,
    companyName,
    actions: [
      {
        label: 'View Details',
        url: `/applicant/interviews/${applicationId}`,
      },
      {
        label: 'Accept',
        url: `/applicant/interviews/${applicationId}/accept`,
      },
    ],
  });
}

/**
 * Create a notification for a message from a recruiter
 */
export function createRecruiterMessageNotification({
  userId,
  applicationId,
  jobTitle,
  companyName,
  recruiterName,
}: {
  userId: string;
  applicationId: string;
  jobTitle: string;
  companyName: string;
  recruiterName: string;
}) {
  return createNotification({
    userId,
    title: 'New Message',
    message: `${recruiterName} from ${companyName} has sent you a message regarding your application for ${jobTitle}.`,
    type: 'message',
    relatedId: applicationId,
    jobTitle,
    companyName,
    actions: [
      {
        label: 'View Message',
        url: `/applicant/messages/${applicationId}`,
      },
    ],
  });
}

/**
 * Create a notification for a job update
 */
export function createJobUpdateNotification({
  userId,
  jobId,
  jobTitle,
  companyName,
  updateType,
}: {
  userId: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  updateType: 'modified' | 'closed' | 'filled';
}) {
  let title = 'Job Posting Updated';
  let message = `The job posting for ${jobTitle} at ${companyName} has been updated.`;
  
  if (updateType === 'closed') {
    title = 'Job Posting Closed';
    message = `The job posting for ${jobTitle} at ${companyName} has been closed.`;
  } else if (updateType === 'filled') {
    title = 'Job Position Filled';
    message = `The ${jobTitle} position at ${companyName} has been filled.`;
  }
  
  return createNotification({
    userId,
    title,
    message,
    type: 'job_update',
    relatedId: jobId,
    jobTitle,
    companyName,
    actions: [
      {
        label: 'View Job',
        url: `/applicant/jobs/${jobId}`,
      },
    ],
  });
}

// Helper functions to create specific types of notifications for recruiters

/**
 * Create a notification for a new application
 */
export function createNewApplicationNotification({
  userId,
  applicationId,
  jobId,
  jobTitle,
  candidateName,
}: {
  userId: string;
  applicationId: string;
  jobId: string;
  jobTitle: string;
  candidateName: string;
}) {
  return createNotification({
    userId,
    title: 'New Application',
    message: `${candidateName} has applied for the ${jobTitle} position.`,
    type: 'new_application',
    relatedId: applicationId,
    jobTitle,
    candidateName,
    actions: [
      {
        label: 'View Application',
        url: `/recruiter/applications/${applicationId}`,
      },
      {
        label: 'View Job',
        url: `/recruiter/jobs/${jobId}`,
      },
    ],
  });
}

/**
 * Create a notification for application updates (like applicant withdrawn)
 */
export function createApplicationUpdateNotification({
  userId,
  applicationId,
  jobId,
  jobTitle,
  candidateName,
  updateType,
}: {
  userId: string;
  applicationId: string;
  jobId: string;
  jobTitle: string;
  candidateName: string;
  updateType: 'withdrawn' | 'updated' | 'accepted_interview' | 'declined_interview';
}) {
  let title = 'Application Updated';
  let message = `${candidateName}'s application for ${jobTitle} has been updated.`;
  
  if (updateType === 'withdrawn') {
    title = 'Application Withdrawn';
    message = `${candidateName} has withdrawn their application for ${jobTitle}.`;
  } else if (updateType === 'accepted_interview') {
    title = 'Interview Accepted';
    message = `${candidateName} has accepted the interview invitation for ${jobTitle}.`;
  } else if (updateType === 'declined_interview') {
    title = 'Interview Declined';
    message = `${candidateName} has declined the interview invitation for ${jobTitle}.`;
  }
  
  return createNotification({
    userId,
    title,
    message,
    type: 'application_update',
    relatedId: applicationId,
    jobTitle,
    candidateName,
    actions: [
      {
        label: 'View Application',
        url: `/recruiter/applications/${applicationId}`,
      },
    ],
  });
}

/**
 * Create a notification for a message from a candidate
 */
export function createCandidateMessageNotification({
  userId,
  applicationId,
  jobTitle,
  candidateName,
}: {
  userId: string;
  applicationId: string;
  jobTitle: string;
  candidateName: string;
}) {
  return createNotification({
    userId,
    title: 'New Message',
    message: `${candidateName} has sent you a message regarding their application for ${jobTitle}.`,
    type: 'candidate_message',
    relatedId: applicationId,
    jobTitle,
    candidateName,
    actions: [
      {
        label: 'View Message',
        url: `/recruiter/messages/${applicationId}`,
      },
    ],
  });
}

/**
 * Create a notification for job statistics updates
 */
export function createJobStatsNotification({
  userId,
  jobId,
  jobTitle,
  statType,
  value,
}: {
  userId: string;
  jobId: string;
  jobTitle: string;
  statType: 'views' | 'applications' | 'conversion';
  value: number;
}) {
  let title = 'Job Statistics Update';
  let message = `Your job posting for ${jobTitle} has new statistics.`;
  
  if (statType === 'views' && value >= 100) {
    title = 'Job Posting Milestone';
    message = `Your job posting for ${jobTitle} has reached ${value} views.`;
  } else if (statType === 'applications' && value >= 10) {
    title = 'Application Milestone';
    message = `Your job posting for ${jobTitle} has received ${value} applications.`;
  } else if (statType === 'conversion' && value >= 5) {
    title = 'High Conversion Rate';
    message = `Your job posting for ${jobTitle} has a high conversion rate of ${value}%.`;
  }
  
  return createNotification({
    userId,
    title,
    message,
    type: 'job_stats',
    relatedId: jobId,
    jobTitle,
    actions: [
      {
        label: 'View Job',
        url: `/recruiter/jobs/${jobId}`,
      },
    ],
  });
}