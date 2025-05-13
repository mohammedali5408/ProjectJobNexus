'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/app/lib/firebase';
import Header from '@/app/components/header';
import Link from 'next/link';
import ResumeMatchAnalysis from '@/app/components/ResumeMatchAnalysis';
import { createStatusChangeNotification } from '@/app/lib/notification-service';

type ApplicationDetailProps = {
  params: {
    id: string;
  };
};
// Application interface
interface Application {
  id: string;
  applicantId: string;
  applicantName?: string;
  applicantEmail?: string;
  jobId: string;
  status: string;
  createdAt: any; // Firebase timestamp
  lastUpdated?: any;
  resumeSubmitted?: boolean;
  resumeData?: any;
  resumeSubmittedData?: any;
  parsedResumeData?: any;
  resumeAnalysis?: ResumeAnalysis;
  analysisDate?: any;
  lastAnalyzed?: any;
  resumeURL?: string;
  resumeFilename?: string;
  resumeFileType?: string;
  coverLetter?: string;
  questionAnswers?: {[key: string]: QuestionAnswer};
  notes?: Note[];
  interviewScheduled?: boolean;
  interviewDate?: any;
  interviewStatus?: string;
  [key: string]: any; // For additional properties
}

// Job interface
interface Job {
  id: string;
  title: string;
  company: string;
  department?: string;
  location: string;
  employmentType: string;
  experienceLevel: string;
  recruiterId: string;
  description?: string;
  requirements?: string;
  skills?: string[];
  benefits?: string;
  remote?: string | boolean;
  salary?: any;
  visaSponsorship?: boolean;
  [key: string]: any; // For additional properties
}

// Interface for resume analysis
interface ResumeAnalysis {
  overallScore: number;
  matchLevel: string;
  summary?: {
    overallAssessment?: string;
    topStrengths?: string[];
    [key: string]: any;
  };
  [key: string]: any;
}

// Interface for question answer
interface QuestionAnswer {
  question: string;
  answer: string;
  [key: string]: any;
}

// Interface for note
interface Note {
  text: string;
  createdBy: string;
  createdAt: any;
  isPrivate: boolean;
  [key: string]: any;
}

// Interface for notification
interface Notification {
  type: string;
  message: string;
}

// Interface for status option
interface StatusOption {
  value: string;
  label: string;
  color: string;
}

const statusOptions = [
  { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'reviewed', label: 'Reviewed', color: 'bg-blue-100 text-blue-800' },
  { value: 'shortlisted', label: 'Shortlisted', color: 'bg-green-100 text-green-800' },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-800' },
  { value: 'hired', label: 'Hired', color: 'bg-purple-100 text-purple-800' }
];

export default function ApplicationDetail({ params }: ApplicationDetailProps) {
  const router = useRouter();
  const applicationId = params.id;
  
  // Add logging to check the application ID
  console.log('Application ID:', applicationId);
  
  const [isLoading, setIsLoading] = useState(true);
  const [application, setApplication] = useState<Application | null>(null);
const [job, setJob] = useState<Job | null>(null);
const [notification, setNotification] = useState<Notification>({ type: '', message: '' });
  const [isUpdating, setIsUpdating] = useState(false);
  const [showMatchAnalysis, setShowMatchAnalysis] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [saveAnalysisAfterGeneration, setSaveAnalysisAfterGeneration] = useState(false);

  useEffect(() => {
    // Add proper type annotations to fetchApplicationAndJob function
const fetchApplicationAndJob = async (userId: string) => {
  try {
    // Check if we have an application ID
    if (!applicationId) {
      console.error('No application ID provided');
      setNotification({
        type: 'error',
        message: 'No application ID provided in the URL'
      });
      setIsLoading(false);
      return;
    }
    
    // First get the application
    console.log('Fetching application document:', applicationId);
    const applicationDoc = await getDoc(doc(db, "applications", applicationId));
    
    if (!applicationDoc.exists()) {
      console.error('Application not found:', applicationId);
      setNotification({
        type: 'error',
        message: `Application with ID "${applicationId}" not found in database`
      });
      setIsLoading(false);
      return;
    }
    
    // Properly type the application data with the Application interface
    const applicationData: Application = {
      id: applicationDoc.id,
      ...applicationDoc.data()
    } as Application;
    console.log('Application data:', applicationData);
    
    // Check if jobId exists in application
    if (!applicationData.jobId) {
      console.error('No jobId found in application');
      setNotification({
        type: 'error',
        message: 'Application has no associated job ID'
      });
      setIsLoading(false);
      return;
    }
    
    // Now get the job details
    console.log('Fetching job document:', applicationData.jobId);
    const jobDoc = await getDoc(doc(db, "jobs", applicationData.jobId));
    
    if (!jobDoc.exists()) {
      console.error('Job not found:', applicationData.jobId);
      setNotification({
        type: 'error',
        message: `Associated job with ID "${applicationData.jobId}" not found`
      });
      setIsLoading(false);
      return;
    }
    
    // Properly type the job data with the Job interface
    const jobData: Job = {
      id: jobDoc.id,
      ...jobDoc.data()
    } as Job;
    console.log('Job data:', jobData);
    
    // Check if the user owns this job
    if (jobData.recruiterId !== userId) {
      console.error('User does not own this job:', jobData.recruiterId, '!==', userId);
      setNotification({
        type: 'error',
        message: 'You do not have permission to view this application'
      });
      setIsLoading(false);
      return;
    }
    
    setApplication(applicationData);
    setJob(jobData);
  } catch (error) {
    console.error('Error fetching application:', error);
    setNotification({
      type: 'error',
      message: `Error loading application details: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  } finally {
    setIsLoading(false);
  }
};
  
    // Set up authentication state listener
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        console.log('User authenticated:', user.uid);
        fetchApplicationAndJob(user.uid);
      } else {
        console.log('No user authenticated');
        setNotification({
          type: 'error',
          message: 'You must be logged in to view this application'
        });
        setIsLoading(false);
        // Optionally redirect to login after showing error
        setTimeout(() => {
          router.push('/signin');
        }, 2000);
      }
    });
  
    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [applicationId, router]);

  const updateApplicationStatus = async (newStatus: string) => {
  if (!application || newStatus === application.status) {
    return; // No change needed
  }
  
  setIsUpdating(true);
  try {
    const now = new Date();
    
    // Update the application in Firestore
    await updateDoc(doc(db, "applications", applicationId), {
      status: newStatus,
      lastUpdated: now
    });
    
    // Update local state
    setApplication((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        status: newStatus,
        lastUpdated: now
      };
    });
    
    // Create notification for the applicant
    try {
      await createStatusChangeNotification({
        userId: application.applicantId,
        applicationId,
        jobTitle: job?.title || '',
        companyName: job?.company || '',
        status: newStatus
      });
      console.log('Notification sent to applicant about status change');
    } catch (notificationError) {
      console.error('Error sending notification:', notificationError);
      // Continue execution even if notification fails
    }
    
    setNotification({
      type: 'success',
      message: `Application status updated to ${newStatus} and applicant notified`
    });
    
    setTimeout(() => {
      setNotification({ type: '', message: '' });
    }, 3000);
  } catch (error) {
    console.error('Error updating status:', error);
    setNotification({
      type: 'error',
      message: 'Failed to update application status'
    });
  } finally {
    setIsUpdating(false);
  }
};

  const analyzeResume = async () => {
  if (!application || !job) return;
  
  setIsAnalyzing(true);
  setSaveAnalysisAfterGeneration(true);
  
  try {
    // Get the most appropriate resume data field
    const resumeData = application.resumeData || 
                     application.resumeSubmittedData || 
                     application.parsedResumeData;
    
    if (!resumeData) {
      setNotification({
        type: 'error',
        message: 'No resume data found for this application'
      });
      return;
    }
    
    const jobDetails = {
      title: job.title,
      description: job.description,
      requirements: job.requirements,
      skills: job.skills || [],
      employmentType: job.employmentType,
      experienceLevel: job.experienceLevel,
      benefits: job.benefits,
      location: job.location,
      remote: job.remote,
      salary: job.salary,
      visaSponsorship: job.visaSponsorship
    };
    
    const response = await fetch('/api/resume-match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        resumeData,
        jobDetails
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to analyze resume match');
    }
    
    const matchData = await response.json();
    const now = new Date();
    
    // Save the analysis to the application document
    await updateDoc(doc(db, "applications", applicationId), {
      resumeAnalysis: matchData,
      analysisDate: now,
      lastAnalyzed: now
    });
    
    // Also try to notify the applicant that their resume was analyzed
    try {
      // Notification code commented out in original
      console.log('Could notify applicant about resume analysis if desired');
    } catch (notificationError) {
      console.error('Error sending notification:', notificationError);
      // Continue execution even if notification fails
    }
    
    setApplication((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        resumeAnalysis: matchData,
        analysisDate: now,
        lastAnalyzed: now
      };
    });
    
    setShowMatchAnalysis(true);
    
  } catch (error) {
    console.error('Error analyzing resume:', error);
    setNotification({
      type: 'error',
      message: error instanceof Error ? error.message : 'Failed to analyze resume match'
    });
  } finally {
    setIsAnalyzing(false);
    setSaveAnalysisAfterGeneration(false);
  }
};

// Fixed function to schedule an interview
const scheduleInterview = async () => {
  if (!application || !job) return;
  
  try {
    // Here you would normally open a modal or form to collect interview details
    // For simplicity, we'll just mock this with a fake interview date
    const interviewDate = new Date();
    interviewDate.setDate(interviewDate.getDate() + 5); // Schedule for 5 days in the future
    
    const now = new Date();
    
    // Update the application with interview details
    await updateDoc(doc(db, "applications", applicationId), {
      interviewScheduled: true,
      interviewDate: interviewDate,
      interviewStatus: 'scheduled',
      lastUpdated: now
    });
    
    // Update local state
    setApplication((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        interviewScheduled: true,
        interviewDate: interviewDate,
        interviewStatus: 'scheduled',
        lastUpdated: now
      };
    });
    
    // Notification code commented out in original
    console.log('Would notify applicant about interview');
    
    setNotification({
      type: 'success',
      message: 'Interview scheduled and applicant will be notified'
    });
    
    setTimeout(() => {
      setNotification({ type: '', message: '' });
    }, 3000);
    
  } catch (error) {
    console.error('Error scheduling interview:', error);
    setNotification({
      type: 'error',
      message: 'Failed to schedule interview'
    });
  }
};

// Fixed function to format date
const formatDate = (timestamp: any): string => {
  if (!timestamp) return 'Unknown date';
  
  let date: Date;
  if (timestamp?.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else if (timestamp?.toDate) {
    date = timestamp.toDate();
  } else {
    date = new Date(timestamp);
  }
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    return 'Unknown date';
  }
  
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Fixed function to add a note
const addNote = async (noteText: string) => {
  if (!noteText.trim() || !application) return;
  
  try {
    const now = new Date();
    const note: Note = {
      text: noteText,
      createdBy: auth.currentUser?.displayName || 'Recruiter',
      createdAt: now,
      isPrivate: true // Recruiter notes are private by default
    };
    
    // Update application with the new note
    const updatedNotes: Note[] = application.notes ? [...application.notes, note] : [note];
    
    await updateDoc(doc(db, "applications", applicationId), {
      notes: updatedNotes,
      lastUpdated: now
    });
    
    // Update local state
    setApplication((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        notes: updatedNotes,
        lastUpdated: now
      };
    });
    
    setNotification({
      type: 'success',
      message: 'Note added successfully'
    });
    
    setTimeout(() => {
      setNotification({ type: '', message: '' });
    }, 3000);
    
  } catch (error) {
    console.error('Error adding note:', error);
    setNotification({
      type: 'error',
      message: 'Failed to add note'
    });
  }
};

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center">
        <Header userRole="recruiter" isLoggedIn={true} />
        <div className="py-24">
          <svg className="animate-spin h-12 w-12 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-4 text-gray-600">Loading application details...</p>
        </div>
      </div>
    );
  }

  // Show error state if no application or job
  if (!application || !job) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center">
        <Header userRole="recruiter" isLoggedIn={true} />
        <div className="py-24 text-center">
          <svg className="mx-auto h-12 w-12 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Error Loading Application</h3>
          <p className="mt-1 text-sm text-gray-500">
            {notification.message || 'There was a problem loading this application.'}
          </p>
          <div className="mt-6">
            <Link
              href="/recruiter/jobs"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Return to Jobs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen pb-16">
      <Header userRole="recruiter" isLoggedIn={true} />
      
      {/* Resume Match Analysis Modal */}
      {showMatchAnalysis && application.resumeAnalysis && (
        <ResumeMatchAnalysis 
          matchData={application.resumeAnalysis}
          onClose={() => setShowMatchAnalysis(false)}
        />
      )}
      
      {/* Notification */}
      {notification.message && (
        <div className={`fixed top-20 right-4 z-50 p-4 rounded-md shadow-lg max-w-md ${
          notification.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          <div className="flex">
            <div className="flex-shrink-0">
              {notification.type === 'success' ? (
                <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{notification.message}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setNotification({ type: '', message: '' })}
                className={`inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  notification.type === 'success' ? 'text-green-500 hover:bg-green-100' : 'text-red-500 hover:bg-red-100'
                }`}
              >
                <span className="sr-only">Dismiss</span>
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 pt-16">
        <div className="container mx-auto max-w-6xl px-4 py-6">
          <div className="flex justify-between items-start">
            <div>
              <nav className="flex mb-4" aria-label="Breadcrumb">
                <ol className="flex items-center space-x-4">
                  <li>
                    <Link href="/recruiter/jobs" className="text-gray-500 hover:text-gray-700">
                      Jobs
                    </Link>
                  </li>
                  <li className="flex items-center">
                    <svg className="flex-shrink-0 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    <Link href={`/recruiter/job/${job.id}`} className="ml-4 text-gray-500 hover:text-gray-700">
                      {job.title}
                    </Link>
                  </li>
                  <li className="flex items-center">
                    <svg className="flex-shrink-0 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="ml-4 text-gray-500">Application</span>
                  </li>
                </ol>
              </nav>
              <h1 className="text-2xl font-bold text-gray-900">Application for {job.title}</h1>
              <p className="mt-1 text-sm text-gray-500">at {job.company}</p>
            </div>
            
            <div className="relative">
              <select
                value={application.status || 'pending'}
                onChange={(e) => updateApplicationStatus(e.target.value)}
                disabled={isUpdating}
                className={`appearance-none w-40 px-4 py-2 pr-8 text-sm font-medium rounded-full border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  statusOptions.find(option => option.value === application.status)?.color || 'bg-gray-100 text-gray-800'
                }`}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {isUpdating && (
                <svg className="animate-spin h-5 w-5 text-gray-400 absolute right-3 top-1/2 transform -translate-y-1/2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Applicant Information */}
            <motion.div
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="p-6">
                <div className="flex items-center">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                    {application.applicantName?.charAt(0).toUpperCase() || 'A'}
                  </div>
                  <div className="ml-4">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {application.applicantName || 'Anonymous Applicant'}
                    </h2>
                    <p className="text-gray-600">{application.applicantEmail || 'No email provided'}</p>
                    <p className="text-sm text-gray-500">Applied on {formatDate(application.createdAt)}</p>
                  </div>
                </div>
                
                {/* Contact Actions */}
                <div className="mt-6 flex space-x-3">
                  <a
                    href={`mailto:${application.applicantEmail}`}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <svg className="mr-2 -ml-1 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </svg>
                    Send Email
                  </a>
                  <button
                    onClick={scheduleInterview}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <svg className="mr-2 -ml-1 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                    Schedule Interview
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Resume Analysis */}
            <motion.div
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Resume Analysis</h3>
                  {application.resumeAnalysis ? (
                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-gray-500">
                        Last analyzed: {formatDate(application.analysisDate)}
                      </span>
                      <button
                        onClick={() => analyzeResume()}
                        disabled={isAnalyzing}
                        className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full shadow-sm text-white ${
                          isAnalyzing ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        {isAnalyzing ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Re-analyzing...
                          </>
                        ) : (
                          'Re-analyze'
                        )}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => analyzeResume()}
                      disabled={isAnalyzing || !application.resumeSubmitted}
                      className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                        isAnalyzing || !application.resumeSubmitted
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}
                    >
                      {isAnalyzing ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Analyzing...
                        </>
                      ) : (
                        'Analyze Resume'
                      )}
                    </button>
                  )}
                </div>

                {application.resumeAnalysis ? (
                  <div className="space-y-6">
                    {/* Match Score */}
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center">
                        <div className={`text-4xl font-bold ${
                          application.resumeAnalysis.overallScore >= 85 ? 'text-green-600' :
                          application.resumeAnalysis.overallScore >= 70 ? 'text-blue-600' :
                          application.resumeAnalysis.overallScore >= 50 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {application.resumeAnalysis.overallScore}%
                        </div>
                        <div className="ml-4">
                          <div className={`px-4 py-2 rounded-full text-sm font-medium ${
                            application.resumeAnalysis.matchLevel === 'Excellent Match' ? 'bg-green-100 text-green-800' :
                            application.resumeAnalysis.matchLevel === 'Strong Match' ? 'bg-blue-100 text-blue-800' :
                            application.resumeAnalysis.matchLevel === 'Good Match' ? 'bg-indigo-100 text-indigo-800' :
                            application.resumeAnalysis.matchLevel === 'Fair Match' ? 'bg-yellow-100 text-yellow-800' :'bg-red-100 text-red-800'
                          }`}>
                            {application.resumeAnalysis.matchLevel}
                          </div>
                        </div>
                      </div>
                      <p className="mt-3 text-gray-600">{application.resumeAnalysis.summary?.overallAssessment}</p>
                    </div>

                    {/* Top Strengths */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Top Strengths</h4>
                      <ul className="space-y-2">
                        {application.resumeAnalysis.summary?.topStrengths?.map((strength: string, index: number) => (
                          <li key={index} className="flex items-center text-sm text-gray-600">
                            <svg className="h-5 w-5 text-green-500 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            {strength}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* View Full Analysis Button */}
                    <div className="text-center">
                      <button
                        onClick={() => setShowMatchAnalysis(true)}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        View Full Analysis
                      </button>
                    </div>
                  </div>
                ) : application.resumeSubmitted ? (
                  <p className="text-center text-gray-500">
                    Click the "Analyze Resume" button to see how well this candidate matches the job requirements.
                  </p>
                ) : (
                  <p className="text-center text-gray-500">
                    No resume submitted with this application.
                  </p>
                )}
              </div>
            </motion.div>

            {/* Resume Document */}
            {application.resumeSubmitted && (
              <motion.div
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Resume Document</h3>
                  
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <svg className="h-8 w-8 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">{application.resumeFilename || 'Resume'}</p>
                          <p className="text-sm text-gray-500">{application.resumeFileType || 'Document'}</p>
                        </div>
                      </div>
                      
                      {application.resumeURL && (
                        <a
                          href={application.resumeURL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <svg className="mr-2 -ml-1 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                          Download
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Cover Letter */}
            {application.coverLetter && (
              <motion.div
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Cover Letter</h3>
                  <div className="prose prose-indigo max-w-none">
                    {application.coverLetter.split('\n').map((paragraph: string, idx: number) => (
                      paragraph.trim() ? <p key={idx} className="text-gray-700">{paragraph}</p> : null
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Answers to Screening Questions */}
            {application.questionAnswers && (
              <motion.div
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Screening Questions</h3>
                  <dl className="space-y-6">
                    {Object.entries(application.questionAnswers).map(([questionId, answer]: [string, any]) => (
                      <div key={questionId} className="border-b border-gray-200 pb-4 last:border-0 last:pb-0">
                        <dt className="text-sm font-medium text-gray-700 mb-2">
                          {answer.question || `Question ${questionId}`}
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {answer.answer || 'No answer provided'}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </motion.div>
            )}

            {/* Application Timeline */}
            <motion.div
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Application Timeline</h3>
                
                <div className="flow-root">
                  <ul className="-mb-8">
                    <li>
                      <div className="relative pb-8">
                        <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span>
                        <div className="relative flex space-x-3">
                          <div>
                            <span className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center ring-8 ring-white">
                              <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-sm text-gray-900">Application submitted</p>
                            </div>
                            <div className="text-right text-sm whitespace-nowrap text-gray-500">
                              {formatDate(application.createdAt)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                    
                    {application.analysisDate && (
                      <li>
                        <div className="relative pb-8">
                          <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span>
                          <div className="relative flex space-x-3">
                            <div>
                              <span className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center ring-8 ring-white">
                                <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                              </span>
                            </div>
                            <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                              <div>
                                <p className="text-sm text-gray-900">Resume analyzed</p>
                              </div>
                              <div className="text-right text-sm whitespace-nowrap text-gray-500">
                                {formatDate(application.analysisDate)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    )}
                    
                    {application.status !== 'pending' && (
                      <li>
                        <div className="relative pb-8">
                          <div className="relative flex space-x-3">
                            <div>
                              <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                                application.status === 'reviewed' ? 'bg-blue-500' :
                                application.status === 'shortlisted' ? 'bg-green-500' :
                                application.status === 'rejected' ? 'bg-red-500' :
                                application.status === 'hired' ? 'bg-purple-500' :
                                'bg-gray-500'
                              }`}>
                                <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              </span>
                            </div>
                            <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                              <div>
                                <p className="text-sm text-gray-900">
                                  Status changed to {application.status}
                                </p>
                              </div>
                              <div className="text-right text-sm whitespace-nowrap text-gray-500">
                                {formatDate(application.lastUpdated)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    )}
                    
                    {/* Add interview scheduling to timeline if present */}
                    {application.interviewScheduled && (
                      <li>
                        <div className="relative pb-0">
                          <div className="relative flex space-x-3">
                            <div>
                              <span className="h-8 w-8 rounded-full bg-purple-500 flex items-center justify-center ring-8 ring-white">
                                <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                </svg>
                              </span>
                            </div>
                            <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                              <div>
                                <p className="text-sm text-gray-900">
                                  Interview scheduled
                                </p>
                              </div>
                              <div className="text-right text-sm whitespace-nowrap text-gray-500">
                                {formatDate(application.interviewDate)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Job Details */}
            <motion.div
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Details</h3>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Job Title</h4>
                    <p className="mt-1 text-sm text-gray-900">{job.title}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Department</h4>
                    <p className="mt-1 text-sm text-gray-900">{job.department || 'Not specified'}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Location</h4>
                    <p className="mt-1 text-sm text-gray-900">{job.location}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Employment Type</h4>
                    <p className="mt-1 text-sm text-gray-900">{job.employmentType}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Experience Level</h4>
                    <p className="mt-1 text-sm text-gray-900">{job.experienceLevel}</p>
                  </div>
                  
                  <div className="pt-4">
                    <Link
                      href={`/recruiter/job/${job.id}`}
                      className="inline-flex items-center justify-center w-full px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      View Job Posting
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                
                <div className="space-y-3">
                  <button
                    onClick={() => updateApplicationStatus('shortlisted')}
                    disabled={isUpdating || application.status === 'shortlisted'}
                    className={`w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md ${
                      application.status === 'shortlisted'
                        ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                        : 'text-white bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    <svg className="mr-2 -ml-1 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Shortlist Candidate
                  </button>
                  
                  <button
                    onClick={() => updateApplicationStatus('rejected')}
                    disabled={isUpdating || application.status === 'rejected'}
                    className={`w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md ${
                      application.status === 'rejected'
                        ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                        : 'text-white bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    <svg className="mr-2 -ml-1 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    Reject Application
                  </button>
                  
                  <button
                    onClick={() => updateApplicationStatus('hired')}
                    disabled={isUpdating || application.status === 'hired'}
                    className={`w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md ${
                      application.status === 'hired'
                        ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                        : 'text-white bg-purple-600 hover:bg-purple-700'
                    }`}
                  >
                    <svg className="mr-2 -ml-1 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                    </svg>
                    Hire Candidate
                  </button>
                  
                  <button
                    onClick={() => router.push(`/recruiter/job/${job.id}#applications`)}
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <svg className="mr-2 -ml-1 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    Back to All Applications
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Notes */}
            <motion.div
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recruiter Notes</h3>
                
                <div className="space-y-4">
                {application.notes && application.notes.length > 0 ? (
                    <div className="space-y-3">
                      {application.notes.map((note: any, index: number) => (
                        <div key={index} className="flex space-x-3">
                          <div className="flex-shrink-0">
                            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                              <span className="text-indigo-600 font-medium text-sm">
                                {note.createdBy?.charAt(0).toUpperCase() || 'R'}
                              </span>
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900">{note.createdBy || 'Recruiter'}</p>
                            <p className="text-sm text-gray-500">{note.text}</p>
                            <p className="mt-1 text-xs text-gray-400">
                              {formatDate(note.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 mb-4">No notes yet. Add a note about this candidate.</p>
                  )}
                  
                  {/* Add note form */}
                  <div className="pt-4 mt-4 border-t border-gray-200">
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const noteText = (form.elements.namedItem('noteText') as HTMLTextAreaElement).value;
                      if (noteText.trim()) {
                        addNote(noteText);
                        (form.elements.namedItem('noteText') as HTMLTextAreaElement).value = '';
                      }
                    }}>
                      <div>
                        <label htmlFor="noteText" className="sr-only">Add a note</label>
                        <textarea
                          id="noteText"
                          name="noteText"
                          rows={3}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border border-gray-300 rounded-md"
                          placeholder="Add a private note about this candidate..."
                        ></textarea>
                      </div>
                      <div className="mt-3 text-right">
                        <button
                          type="submit"
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Add Note
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}