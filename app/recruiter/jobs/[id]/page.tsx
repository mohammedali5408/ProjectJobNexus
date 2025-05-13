'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { doc, getDoc, updateDoc, collection, getDocs, query, where, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/app/lib/firebase';
import Header from '@/app/components/header';
import Link from 'next/link';
import ResumeMatchAnalysis from '@/app/components/ResumeMatchAnalysis';
import { useAuth } from '@/app/lib/authContext';
import Image from 'next/image';

type RecruiterJobDetailProps = {
  params: {
    id: string;
  };
};

export default function RecruiterJobDetail({ params }: RecruiterJobDetailProps) {
  const router = useRouter();
  const jobId = params.id;
  
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [job, setJob] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [notification, setNotification] = useState({ type: '', message: '' });
  const [isOwner, setIsOwner] = useState(false);
  const [jobStatus, setJobStatus] = useState('active'); 
  const [activeTab, setActiveTab] = useState('applications');
  const [userRole, setUserRole] = useState<'applicant' | 'recruiter' | null>(null);
  const [analytics, setAnalytics] = useState({
    views: 0,
    applicants: 0,
    conversionRate: 0,
    averageQualificationMatch: 0,
    topSourceChannels: [] as {source: string, count: number}[],
  });
  
  // Resume matching states
  const [showMatchAnalysis, setShowMatchAnalysis] = useState(false);
  const [matchAnalysisData, setMatchAnalysisData] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      if (authLoading) return;
      
      if (!user) {
        router.push('/signin');
        return;
      }
      
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserRole(userData.role as 'applicant' | 'recruiter');
          
          if (userData.role !== 'recruiter') {
            router.push('/applicant/applicantDashboard');
            return;
          }
        }
        
        const jobDoc = await getDoc(doc(db, "jobs", jobId));
        
        if (jobDoc.exists()) {
          const jobData = jobDoc.data();
          setJob({
            id: jobDoc.id,
            ...jobData
          });
          
          setJobStatus(jobData.status || 'active');
          setIsOwner(jobData.recruiterId === user.uid);
          
          setAnalytics({
            views: jobData.views || 0,
            applicants: jobData.applicants || 0,
            conversionRate: jobData.views ? Math.round((jobData.applicants / jobData.views) * 100) : 0,
            averageQualificationMatch: 75,
            topSourceChannels: [
              { source: 'Direct', count: Math.floor(Math.random() * 50) + 10 },
              { source: 'LinkedIn', count: Math.floor(Math.random() * 40) + 5 },
              { source: 'Indeed', count: Math.floor(Math.random() * 30) + 3 }
            ],
          });
          
          try {
            const applicationsQuery = query(
              collection(db, "applications"),
              where("jobId", "==", jobId),
              orderBy("submittedAt", "desc")
            );
            
            const applicationsSnapshot = await getDocs(applicationsQuery);
            
            const applicationsData: any[] = [];
            
            applicationsSnapshot.forEach((doc) => {
              const data = doc.data();
              applicationsData.push({
                id: doc.id,
                ...data,
                createdAt: data.submittedAt || data.createdAt
              });
            });
            
            setApplications(applicationsData);
            
          } catch (error: any) {
            console.error("Error fetching applications:", error);
            
            if (error.code === 'failed-precondition') {
              const simpleQuery = query(
                collection(db, "applications"),
                where("jobId", "==", jobId)
              );
              
              const simpleSnapshot = await getDocs(simpleQuery);
              
              const simpleApplicationsData: any[] = [];
              
              simpleSnapshot.forEach((doc) => {
                const data = doc.data();
                simpleApplicationsData.push({
                  id: doc.id,
                  ...data,
                  createdAt: data.submittedAt || data.createdAt
                });
              });
              
              simpleApplicationsData.sort((a, b) => {
                const dateA = a.createdAt?.seconds ? a.createdAt.seconds : 0;
                const dateB = b.createdAt?.seconds ? b.createdAt.seconds : 0;
                return dateB - dateA;
              });
              
              setApplications(simpleApplicationsData);
            } else {
              setNotification({
                type: 'error',
                message: 'Error loading applications: ' + error.message
              });
            }
          }
        } else {
          router.push('/recruiter/jobs');
        }
      } catch (error: any) {
        console.error("Error fetching job data:", error);
        setNotification({
          type: 'error',
          message: 'Error loading job data: ' + error.message
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuthAndFetchData();
  }, [jobId, router, user, authLoading]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'details' || hash === 'applications') {
        setActiveTab(hash);
      }
    }
  }, []);
  
  // Function to send notifications to applicants
  const sendNotificationToApplicants = async (newStatus: 'paused' | 'closed' | 'active') => {
    if (!user || applications.length === 0) return;
    
    const statusMessages = {
      paused: `The job "${job.title}" at ${job.company} has been temporarily paused. We'll notify you when it becomes active again.`,
      closed: `The job "${job.title}" at ${job.company} has been closed. Thank you for your interest.`,
      active: `The job "${job.title}" at ${job.company} is now active again and accepting applications.`
    };
    
    const message = statusMessages[newStatus];
    if (!message) return;
    
    // Send notification to each applicant
    for (const application of applications) {
      if (application.applicantId) {
        try {
          // Create a notification
          await addDoc(collection(db, "notifications"), {
            userId: application.applicantId,
            type: 'job_status_update',
            jobId: jobId,
            jobTitle: job.title,
            company: job.company,
            message: message,
            read: false,
            createdAt: serverTimestamp(),
            metadata: {
              newStatus: newStatus,
              previousStatus: jobStatus
            }
          });
          
          // Also send a message if there's an existing conversation
          const conversationsQuery = query(
            collection(db, "conversations"),
            where("participants", "array-contains", user.uid)
          );
          
          const conversationsSnapshot = await getDocs(conversationsQuery);
          let conversationId = null;
          
          conversationsSnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.participants.includes(application.applicantId)) {
              conversationId = doc.id;
            }
          });
          
          if (conversationId) {
            // If conversation exists, send a message
            await addDoc(collection(db, "messages"), {
              conversationId: conversationId,
              senderId: user.uid,
              receiverId: application.applicantId,
              content: message,
              timestamp: serverTimestamp(),
              read: false,
              type: 'system_notification'
            });
            
            // Update conversation's last message
            await updateDoc(doc(db, "conversations", conversationId), {
              lastMessage: message,
              lastMessageTimestamp: serverTimestamp()
            });
          } else {
            // Create a new conversation if none exists
            const conversationData = {
              participants: [user.uid, application.applicantId],
              participantDetails: {
                [user.uid]: {
                  name: user.displayName || user.email,
                  role: 'recruiter',
                  email: user.email
                },
                [application.applicantId]: {
                  name: application.applicantName || 'Applicant',
                  role: 'applicant',
                  email: application.applicantEmail || ''
                }
              },
              lastMessage: message,
              lastMessageTimestamp: serverTimestamp(),
              unreadCount: {
                [user.uid]: 0,
                [application.applicantId]: 1
              }
            };
            
            const newConversationRef = await addDoc(collection(db, "conversations"), conversationData);
            
            // Send the initial message
            await addDoc(collection(db, "messages"), {
              conversationId: newConversationRef.id,
              senderId: user.uid,
              receiverId: application.applicantId,
              content: message,
              timestamp: serverTimestamp(),
              read: false,
              type: 'system_notification'
            });
          }
        } catch (error) {
          console.error(`Error sending notification to applicant ${application.applicantId}:`, error);
        }
      }
    }
  };
  
  const updateJobStatus = async (newStatus: string) => {
    if (isUpdatingStatus) return;
    
    setIsUpdatingStatus(true);
    
    try {
      await updateDoc(doc(db, "jobs", jobId), {
        status: newStatus,
        updatedAt: new Date()
      });
      
      // Send notifications to applicants
      await sendNotificationToApplicants(newStatus);
      
      setJobStatus(newStatus);
      setNotification({
        type: 'success',
        message: `Job status updated to ${newStatus} and applicants have been notified`
      });
      
      setTimeout(() => {
        setNotification({ type: '', message: '' });
      }, 5000);
    } catch (error) {
      console.error("Error updating job status:", error);
      setNotification({
        type: 'error',
        message: 'Error updating job status'
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };
  
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown date';
    
    let date;
    if (timestamp?.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else if (timestamp?.toDate) {
      date = timestamp.toDate();
    } else {
      date = new Date(timestamp);
    }
    
    if (isNaN(date.getTime())) {
      return 'Unknown date';
    }
    
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };
  
  const formatSalary = (salary: any) => {
    if (!salary || (!salary.min && !salary.max)) return 'Not specified';
    
    const formatValue = (value: string) => {
      if (!value) return '';
      const num = parseInt(value);
      return num >= 1000 ? `${(num / 1000).toFixed(0)}k` : num;
    };
    
    const min = formatValue(salary.min);
    const max = formatValue(salary.max);
    
    if (min && max) {
      return `${salary.currency} ${min}-${max} ${salary.period}`;
    } else if (min) {
      return `${salary.currency} ${min}+ ${salary.period}`;
    } else if (max) {
      return `Up to ${salary.currency} ${max} ${salary.period}`;
    }
    
    return 'Not specified';
  };
  
  const analyzeResume = async (application: any) => {
    setIsAnalyzing(true);
    setSelectedApplication(application);
    
    try {
      if (application.resumeAnalysis) {
        setMatchAnalysisData(application.resumeAnalysis);
        setShowMatchAnalysis(true);
        return;
      }
      
      const resumeData = application.resumeData || application.resumeSubmittedData;
      
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
        throw new Error('Failed to analyze resume match');
      }
      
      const matchData = await response.json();
      
      await updateDoc(doc(db, "applications", application.id), {
        resumeAnalysis: matchData,
        analysisDate: new Date(),
        lastAnalyzed: new Date()
      });
      
      const updatedApplications = applications.map(app => {
        if (app.id === application.id) {
          return { ...app, resumeAnalysis: matchData };
        }
        return app;
      });
      setApplications(updatedApplications);
      
      setMatchAnalysisData(matchData);
      setShowMatchAnalysis(true);
      
    } catch (error) {
      console.error('Error analyzing resume:', error);
      setNotification({
        type: 'error',
        message: 'Failed to analyze resume match'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center">
        <Header userRole={userRole} isLoggedIn={!!user} />
        <div className="py-24">
          <svg className="animate-spin h-12 w-12 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-4 text-gray-600">Loading job details...</p>
        </div>
      </div>
    );
  }
  
  if (!job) return null;
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Header userRole={userRole} isLoggedIn={true} />
      
      {/* Resume Match Analysis Modal */}
      {showMatchAnalysis && matchAnalysisData && (
        <ResumeMatchAnalysis 
          matchData={matchAnalysisData}
          onClose={() => {
            setShowMatchAnalysis(false);
            setMatchAnalysisData(null);
            setSelectedApplication(null);
          }}
        />
      )}
      
      {/* Notification */}
      {notification.message && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`fixed top-20 right-4 z-50 p-4 rounded-lg shadow-lg max-w-md ${
            notification.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {notification.type === 'success' ? (
                <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{notification.message}</p>
            </div>
            <button
              onClick={() => setNotification({ type: '', message: '' })}
              className="ml-4 text-gray-400 hover:text-gray-500"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
      
      {/* Modern Header Section */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-8">
          <div className="lg:flex lg:items-center lg:justify-between">
            <div className="flex-1 min-w-0">
              {/* Company Logo and Title */}
              <div className="flex items-center">
                <div className="h-16 w-16 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                  {job.company.charAt(0)}
                </div>
                <div className="ml-4">
                  <h1 className="text-3xl font-bold text-gray-900">{job.title}</h1>
                  <div className="mt-1 flex items-center text-sm text-gray-500">
                    <span className="font-medium text-gray-700">{job.company}</span>
                    <span className="mx-2">•</span>
                    <span>{job.location}</span>
                    <span className="mx-2">•</span>
                    <span>{formatDate(job.createdAt)}</span>
                  </div>
                </div>
              </div>
              
              {/* Tags */}
              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                  jobStatus === 'active' ? 'bg-green-100 text-green-800' : 
                  jobStatus === 'paused' ? 'bg-yellow-100 text-yellow-800' : 
                  'bg-red-100 text-red-800'
                }`}>
                  {jobStatus.charAt(0).toUpperCase() + jobStatus.slice(1)}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  {job.employmentType}
                </span>
                {job.remote !== 'no' && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    {job.remote === 'fully' ? 'Fully Remote' : 'Hybrid Remote'}
                  </span>
                )}
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {job.experienceLevel}
                </span>
                {job.visaSponsorship && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    Visa Sponsorship
                  </span>
                )}
              </div>
            </div>
            
            {/* Action Buttons */}
            {isOwner && (
              <div className="mt-5 flex lg:mt-0 lg:ml-4">
                <Link
                  href={`/recruiter/jobs/${jobId}/edit`}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <svg className="-ml-1 mr-2 h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </Link>
                
                {jobStatus === 'active' ? (
                  <button
                    onClick={() => updateJobStatus('paused')}
                    disabled={isUpdatingStatus}
                    className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {isUpdatingStatus ? 'Updating...' : 'Pause'}
                  </button>
                ) : jobStatus === 'paused' ? (
                  <button
                    onClick={() => updateJobStatus('active')}
                    disabled={isUpdatingStatus}
                    className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {isUpdatingStatus ? 'Updating...' : 'Activate'}
                  </button>
                ) : null}
                
                {(jobStatus === 'active' || jobStatus === 'paused') && (
                  <button
                    onClick={() => updateJobStatus('closed')}
                    disabled={isUpdatingStatus}
                    className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {isUpdatingStatus ? 'Updating...' : 'Close'}
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* Stats */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm font-medium text-gray-500">Salary Range</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">{formatSalary(job.salary)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm font-medium text-gray-500">Total Views</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">{analytics.views}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm font-medium text-gray-500">Applications</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">{applications.length}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm font-medium text-gray-500">Conversion Rate</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">
                {job.views > 0 ? Math.round((applications.length / job.views) * 100) : 0}%
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="lg:grid lg:grid-cols-3 lg:gap-8">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Tabs */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex">
                  <button
                    onClick={() => setActiveTab('applications')}
                    className={`w-1/2 py-4 px-6 text-center border-b-2 font-medium text-sm ${
                      activeTab === 'applications' 
                        ? 'border-indigo-500 text-indigo-600' 
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Applications ({applications.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('details')}
                    className={`w-1/2 py-4 px-6 text-center border-b-2 font-medium text-sm ${
                      activeTab === 'details' 
                        ? 'border-indigo-500 text-indigo-600' 
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Job Details
                  </button>
                </nav>
              </div>
              
              {/* Applications Tab */}
              {activeTab === 'applications' && (
                <div className="p-6">
                  {applications.length === 0 ? (
                    <div className="text-center py-12">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <h3 className="mt-2 text-lg font-medium text-gray-900">No applications yet</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Your job posting hasn't received any applications yet.
                      </p>
                      <div className="mt-6">
                        <Link 
                          href="/recruiter/candidates"
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                        >
                          Browse candidates
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {applications.map((application) => (
                        <div key={application.id} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center">
                              <div className="h-12 w-12 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold">
                                {application.applicantName ? application.applicantName.charAt(0).toUpperCase() : 'A'}
                              </div>
                              <div className="ml-4">
                                <h3 className="text-lg font-medium text-gray-900">
                                  {application.applicantName || 'Anonymous Applicant'}
                                </h3>
                                <p className="text-sm text-gray-500">
                                  {application.applicantEmail || 'No email provided'}
                                </p>
                                <div className="mt-1 flex items-center text-sm text-gray-500">
                                  <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  {formatDate(application.createdAt)}
                                </div>
                              </div>
                            </div>
                            
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                              application.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              application.status === 'reviewed' ? 'bg-blue-100 text-blue-800' :
                              application.status === 'shortlisted' ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {application.status ? application.status.charAt(0).toUpperCase() + application.status.slice(1) : 'Pending'}
                            </span>
                          </div>
                          
                          <div className="mt-4 grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-sm font-medium text-gray-500">Resume</div>
                              {application.resumeSubmitted ? (
                                <div className="mt-1 flex items-center">
                                  <span className="text-sm text-green-600">Attached</span>
                                  {application.resumeURL && (
                                    <a 
                                      href={application.resumeURL} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="ml-2 text-indigo-600 hover:text-indigo-500"
                                    >
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <div className="mt-1 text-sm text-gray-500">No resume</div>
                              )}
                            </div>
                            
                            <div>
                              <div className="text-sm font-medium text-gray-500">Match Analysis</div>
                              {application.resumeSubmitted ? (
                                <div className="mt-1">
                                  {application.resumeAnalysis ? (
                                    <div className="flex items-center">
                                      <span className={`text-sm font-medium ${
                                        application.resumeAnalysis.overallScore >= 80 ? 'text-green-600' :
                                        application.resumeAnalysis.overallScore >= 60 ? 'text-blue-600' :
                                        'text-yellow-600'
                                      }`}>
                                        {application.resumeAnalysis.overallScore}% Match
                                      </span>
                                      <button
                                        onClick={() => {
                                          setMatchAnalysisData(application.resumeAnalysis);
                                          setSelectedApplication(application);
                                          setShowMatchAnalysis(true);
                                        }}
                                        className="ml-2 text-sm text-indigo-600 hover:text-indigo-500"
                                      >
                                        View Details
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => analyzeResume(application)}
                                      disabled={isAnalyzing && selectedApplication?.id === application.id}
                                      className={`text-sm font-medium ${
                                        isAnalyzing && selectedApplication?.id === application.id
                                          ? 'text-gray-400'
                                          : 'text-indigo-600 hover:text-indigo-500'
                                      }`}
                                    >
                                      {isAnalyzing && selectedApplication?.id === application.id ? 'Analyzing...' : 'Analyze Match'}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div className="mt-1 text-sm text-gray-500">No resume to analyze</div>
                              )}
                            </div>
                          </div>
                          
                          <div className="mt-4 flex space-x-4">
                            <Link 
                              href={`/recruiter/applications/${application.id}`}
                              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                            >
                              View Details
                            </Link>
                            <Link
                              href={`/recruiter/messages?to=${application.applicantId}`}
                              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                            >
                              Message
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {/* Job Details Tab */}
              {activeTab === 'details' && (
                <div className="p-6">
                  <div className="space-y-8">
                    {/* Job Description */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Description</h3>
                      <div className="prose prose-gray max-w-none">
                        {job.description && job.description.split('\n').map((paragraph: string, idx: number) => (
                          paragraph.trim() ? <p key={idx} className="text-gray-700 mb-4">{paragraph}</p> : null
                        ))}
                      </div>
                    </div>
                    
                    {/* Requirements */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Requirements</h3>
                      <div className="space-y-3">
                        {job.requirements && job.requirements.split('\n').map((requirement: string, idx: number) => (
                          requirement.trim() ? (
                            <div key={idx} className="flex items-start">
                              <svg className="h-5 w-5 text-indigo-500 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <p className="text-gray-700">{requirement}</p>
                            </div>
                          ) : null
                        ))}
                      </div>
                    </div>
                    
                    {/* Benefits */}
                    {job.benefits && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Benefits & Perks</h3>
                        <div className="space-y-3">
                          {job.benefits.split('\n').map((benefit: string, idx: number) => (
                            benefit.trim() ? (
                              <div key={idx} className="flex items-start">
                                <svg className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <p className="text-gray-700">{benefit}</p>
                              </div>
                            ) : null
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Skills */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Required Skills</h3>
                      <div className="flex flex-wrap gap-2">
                        {job.skills && job.skills.map((skill: string, idx: number) => (
                          <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Job Simulation Section */}
            {job.jobSimulation && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">AI Job Simulation</h2>
                  <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full">
                    AI Generated
                  </span>
                </div>
                
                <div className="prose prose-gray max-w-none">
                  <p className="text-sm text-gray-600 mb-4">
                    This simulation helps candidates understand what a day in this role might look like.
                  </p>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    {job.jobSimulation.split('\n').map((paragraph: string, idx: number) => (
                      paragraph.trim() ? <p key={idx} className="text-gray-700 mb-3">{paragraph}</p> : null
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Sidebar */}
          <div className="mt-8 lg:mt-0 space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              
              <div className="space-y-3">
                <Link
                  href="/recruiter/candidates"
                  className="flex items-center p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors group"
                >
                  <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                    <svg className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">Browse Candidates</p>
                    <p className="text-sm text-gray-500">Find potential matches</p>
                  </div>
                </Link>
                
                <Link
                  href="/recruiter/messages"
                  className="flex items-center p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors group"
                >
                  <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                    <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">Messages</p>
                    <p className="text-sm text-gray-500">Contact candidates</p>
                  </div>
                </Link>
                
                <Link
                  href={`/post-job?template=${jobId}`}
                  className="flex items-center p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors group"
                >
                  <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                    <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">Create Similar Job</p>
                    <p className="text-sm text-gray-500">Use this as template</p>
                  </div>
                </Link>
              </div>
            </div>
            
            {/* Job Details Summary */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Summary</h2>
              
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-gray-500">Experience Level</div>
                  <div className="mt-1 text-base text-gray-900">{job.experienceLevel}</div>
                </div>
                
                <div>
                  <div className="text-sm font-medium text-gray-500">Employment Type</div>
                  <div className="mt-1 text-base text-gray-900">{job.employmentType}</div>
                </div>
                
                <div>
                  <div className="text-sm font-medium text-gray-500">Location</div>
                  <div className="mt-1 text-base text-gray-900">{job.location}</div>
                </div>
                
                <div>
                  <div className="text-sm font-medium text-gray-500">Remote Work</div>
                  <div className="mt-1 text-base text-gray-900">
                    {job.remote === 'fully' ? 'Fully Remote' : job.remote === 'hybrid' ? 'Hybrid Remote' : 'On-site'}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm font-medium text-gray-500">Visa Sponsorship</div>
                  <div className="mt-1 text-base text-gray-900">
                    {job.visaSponsorship ? 'Available' : 'Not Available'}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Status Information */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Status</h2>
              
              <div className={`p-4 rounded-lg ${
                jobStatus === 'active' ? 'bg-green-50 text-green-800' : 
                jobStatus === 'paused' ? 'bg-yellow-50 text-yellow-800' : 
                'bg-red-50 text-red-800'
              }`}>
                <p className="text-sm font-medium">
                  {jobStatus === 'active' 
                    ? 'This job is visible to all candidates'
                    : jobStatus === 'paused'
                    ? 'This job is temporarily hidden from candidates'
                    : 'This job is closed and no longer accepting applications'
                  }
                </p>
              </div>
              
              {jobStatus !== 'active' && applications.length > 0 && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    All {applications.length} applicants have been notified about this status change.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Back to Jobs Link */}
        <div className="mt-8 text-center">
          <Link
            href="/recruiter/jobs"
            className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to all jobs
          </Link>
        </div>
      </div>
    </div>
  );
}