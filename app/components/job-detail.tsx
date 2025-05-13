'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { doc, getDoc, updateDoc, increment, addDoc, collection, getDocs, query, where, limit } from 'firebase/firestore';
import { auth, db } from '@/app/lib/firebase';
import Header from '@/app/components/header';
import Link from 'next/link';
import ResumeEnhancer from './resumeEnhancer';
import ApplicationForm from './applicationForm';
import { useAuth } from '../lib/authContext';

type JobDetailProps = {
  params: {
    id: string;
  };
};

export default function JobDetail({ params }: JobDetailProps) {
  const router = useRouter();
  const jobId = params.id;
  
  const [isLoading, setIsLoading] = useState(true);
  const [job, setJob] = useState<any>(null);
  const [userRole, setUserRole] = useState<'applicant' | 'recruiter'>('applicant');
  const [hasApplied, setHasApplied] = useState(false);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [showResumeEnhancer, setShowResumeEnhancer] = useState(false);
  const [enhancedResumeId, setEnhancedResumeId] = useState<string | null>(null);
  const [notification, setNotification] = useState({ type: '', message: '' });
  const [similarJobs, setSimilarJobs] = useState<any[]>([]);
  const { user, loading: authLoading } = useAuth();
  const [jobSimulation, setJobSimulation] = useState<any>(null);
  
  useEffect(() => {
    console.log('JobDetail component mounted. Job ID:', jobId);
    
    const checkAuth = async () => {
      const user = auth.currentUser;
      if (!user) {
        console.log('No user found, redirecting to signin');
        router.push('/signin');
        return;
      }
      
      // For demo, we can set role from session storage or query userRole from Firestore
      const storedRole = sessionStorage.getItem('userRole') || 'applicant';
      setUserRole(storedRole as 'applicant' | 'recruiter');
      
      // Fetch job data
      try {
        console.log('Fetching job document from Firestore with ID:', jobId);
        // Get job document from Firestore
        const jobDoc = await getDoc(doc(db, "jobs", jobId));
        
        if (jobDoc.exists()) {
          console.log('Job document exists:', jobDoc.data());
          const jobData = jobDoc.data();
          setJob({
            id: jobDoc.id,
            ...jobData
          });
          
          // Increment view count if user is an applicant
          if (storedRole === 'applicant') {
            console.log('Incrementing view count for job');
            await updateDoc(doc(db, "jobs", jobId), {
              views: increment(1)
            });
          }
          
          // Check if user has already applied to this job
          if (storedRole === 'applicant') {
            console.log('Checking if user has already applied to this job');
            const applicationsQuery = query(
              collection(db, "applications"),
              where("jobId", "==", jobId),
              where("applicantId", "==", user.uid)
            );
            
            const applicationsSnapshot = await getDocs(applicationsQuery);
            setHasApplied(!applicationsSnapshot.empty);
            console.log('User has applied:', !applicationsSnapshot.empty);
          }
          
          // Fetch similar jobs
          if (jobData && jobData.skills && jobData.skills.length > 0) {
            console.log('Fetching similar jobs based on skills');
            const similarJobsQuery = query(
              collection(db, "jobs"),
              where("status", "==", "active"),
              limit(3)
            );
            
            const similarJobsSnapshot = await getDocs(similarJobsQuery);
            const similarJobsList: any[] = [];
            
            similarJobsSnapshot.forEach((doc) => {
              const data = doc.data();
              // Don't include the current job
              if (doc.id !== jobId) {
                // Calculate similarity score based on matching skills
                const matchingSkills = data.skills ? 
                  data.skills.filter((skill: string) => 
                    jobData.skills.includes(skill)
                  ).length : 0;
                
                if (matchingSkills > 0) {
                  similarJobsList.push({
                    id: doc.id,
                    ...data,
                    matchingSkills
                  });
                }
              }
            });
            
            // Sort by number of matching skills
            similarJobsList.sort((a, b) => b.matchingSkills - a.matchingSkills);
            setSimilarJobs(similarJobsList.slice(0, 3));
            console.log('Similar jobs found:', similarJobsList.length);
          }
          
          // Check for job simulation
          if (jobData.jobSimulation) {
            console.log('Job has simulation data');
            setJobSimulation({
              description: jobData.jobSimulation,
              skills: jobData.skills || []
            });
          }
        } else {
          // Job not found
          console.log('Job not found, redirecting to find-jobs');
          router.push('/find-jobs');
        }
      } catch (error) {
        console.error("Error fetching job:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, [jobId, router]);
  
  // Resume enhancement handler
  const handleEnhanceComplete = (resumeId: string) => {
    setEnhancedResumeId(resumeId);
    setShowResumeEnhancer(false);
    
    // Show success notification
    setNotification({
      type: 'success',
      message: 'Your resume has been enhanced and saved to your profile!'
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

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown date';
    
    let date;
    if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else if (timestamp.toDate) {
      date = timestamp.toDate();
    } else {
      date = new Date(timestamp);
    }
    
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center">
        <Header userRole={userRole} />
        <div className="py-24">
          <div className="animate-spin h-12 w-12 rounded-full border-4 border-indigo-600 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  if (!job) {
    console.log('No job data available');
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center">
        <Header userRole={userRole} />
        <div className="py-24">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Job Not Found</h2>
            <p className="text-gray-700 mb-4">The job you're looking for doesn't exist or has been removed.</p>
            <Link 
              href="/find-jobs"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Browse Jobs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  console.log('Rendering job details:', job);

  return (
    <div className="bg-gray-100 min-h-screen">
      <Header userRole="applicant" isLoggedIn={!!user} />
      
      {/* Notification */}
      {notification.message && (
        <div className={`fixed top-20 right-4 z-50 p-4 rounded-md shadow-lg max-w-md ${
          notification.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          <div className="flex">
            <div className="flex-shrink-0">
              {notification.type === 'success' ? (
                <svg className="h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{notification.message}</p>
            </div>
            <div className="ml-auto pl-3">
              <div className="-mx-1.5 -my-1.5">
                <button
                  onClick={() => setNotification({ type: '', message: '' })}
                  className={`inline-flex rounded-md p-1.5 ${
                    notification.type === 'success' ? 'text-green-500 hover:bg-green-100' : 'text-red-500 hover:bg-red-100'
                  } focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    notification.type === 'success' ? 'focus:ring-green-500' : 'focus:ring-red-500'
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
        </div>
      )}
      
      {/* Job header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white pt-24 pb-16 px-4 shadow-xl">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col lg:flex-row lg:items-center">
            <motion.div 
              className="flex-1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center mb-4">
                <div className="h-16 w-16 rounded-lg bg-white text-indigo-700 flex items-center justify-center font-bold text-2xl shadow-lg">
                  {job.company ? job.company.charAt(0).toUpperCase() : 'J'}
                </div>
                <div className="ml-4">
                  <h1 className="text-3xl font-bold text-white">{job.title || 'Job Position'}</h1>
                  <p className="text-indigo-100">{job.company || 'Company'} • {job.location || 'Location'}</p>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-800 text-white">
                  {job.employmentType || 'Full-time'}
                </span>
                {job.remote !== 'no' && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-800 text-white">
                    {job.remote === 'fully' ? 'Fully Remote' : 'Hybrid Remote'}
                  </span>
                )}
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-800 text-white">
                  {job.experienceLevel || 'Entry Level'}
                </span>
                {job.visaSponsorship && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-800 text-white">
                    Visa Sponsorship
                  </span>
                )}
              </div>
              
              <div className="flex flex-wrap gap-6 text-sm">
                <div>
                  <span className="block text-indigo-200">Salary</span>
                  <span className="font-medium text-white">{formatSalary(job.salary)}</span>
                </div>
                <div>
                  <span className="block text-indigo-200">Posted</span>
                  <span className="font-medium text-white">{formatDate(job.createdAt)}</span>
                </div>
                <div>
                  <span className="block text-indigo-200">Applications</span>
                  <span className="font-medium text-white">{job.applicants || job.applicants1 || 0}</span>
                </div>
              </div>
            </motion.div>
            
            <motion.div
              className="mt-6 lg:mt-0 lg:ml-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
            {userRole === 'applicant' && (
              hasApplied ? (
                <div className="bg-white rounded-lg p-6 text-center shadow-lg">
                  <svg className="mx-auto h-12 w-12 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="mt-2 text-lg font-medium text-gray-900">Application Submitted</h3>
                  <p className="mt-1 text-sm text-gray-600">You have already applied to this job</p>
                  <Link
                    href="/applicant/applications"
                    className="mt-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    View Your Applications
                  </Link>
                </div>
              ) : showApplyForm ? (
                <ApplicationForm 
                  job={{
                    id: job.id,
                    title: job.title || 'Job Position',
                    company: job.company || 'Company',
                    recruiterId: job.recruiterId || ''
                  }}
                  onClose={() => setShowApplyForm(false)}
                  onSuccess={() => {
                    setHasApplied(true);
                    setShowApplyForm(false);
                    setNotification({
                      type: 'success',
                      message: 'Your application has been submitted successfully!'
                    });
                  }}
                />
              ) : (
                <>
                  <div className="bg-white p-6 rounded-lg shadow-lg">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Ready to Apply?</h3>
                    <div className="flex flex-col space-y-3">
                      <button
                        onClick={() => setShowApplyForm(true)}
                        className="w-full inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                      >
                        Apply Now
                      </button>
                      
                      <button
                        onClick={() => setShowResumeEnhancer(true)}
                        className="w-full inline-flex justify-center items-center px-6 py-3 border border-indigo-600 text-base font-medium rounded-md shadow-sm text-indigo-600 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                      >
                        <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                        Enhance Resume First
                      </button>
                    </div>
                    <div className="mt-3 text-sm text-center text-gray-500">
                      {job.applicants || job.applicants1 || 0} applicants so far
                    </div>
                  </div>
                </>
              )
            )}
            </motion.div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2">
            <motion.div
              className="bg-white rounded-xl shadow-sm p-6 mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Job Description</h2>
              <div className="prose prose-indigo max-w-none">
                {job.description ? job.description.split('\n').map((paragraph: string, idx: number) => (
                  paragraph.trim() ? <p key={idx} className="mb-4 text-gray-800">{paragraph}</p> : null
                )) : (
                  <p className="text-gray-800">No description provided.</p>
                )}
              </div>
            </motion.div>
            
            <motion.div
              className="bg-white rounded-xl shadow-sm p-6 mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Requirements</h2>
              <div className="prose prose-indigo max-w-none">
                {job.requirements ? job.requirements.split('\n').map((requirement: string, idx: number) => (
                  requirement.trim() ? (
                    <div key={idx} className="flex items-start mb-3">
                      <svg className="h-5 w-5 text-indigo-500 mr-2 mt-0.5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <p className="text-gray-800">{requirement}</p>
                    </div>
                  ) : null
                )) : job.keyQualifications && job.keyQualifications.length > 0 ? (
                  job.keyQualifications.map((qualification: string, idx: number) => (
                    <div key={idx} className="flex items-start mb-3">
                      <svg className="h-5 w-5 text-indigo-500 mr-2 mt-0.5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <p className="text-gray-800">{qualification}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-800">No specific requirements provided.</p>
                )}
              </div>
            </motion.div>
            
            {job.benefits && (
              <motion.div
                className="bg-white rounded-xl shadow-sm p-6 mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Benefits & Perks</h2>
                <div className="prose prose-indigo max-w-none">
                  {job.benefits.split('\n').map((benefit: string, idx: number) => (
                    benefit.trim() ? (
                      <div key={idx} className="flex items-start mb-3">
                        <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <p className="text-gray-800">{benefit}</p>
                      </div>
                    ) : null
                  ))}
                </div>
              </motion.div>
            )}
            
            {/* Job Simulation section - only show if exists */}
            {jobSimulation && (
              <motion.div
                className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl shadow-sm p-6 mb-6 border border-indigo-100"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <div className="flex items-center mb-4">
                  <svg className="h-6 w-6 text-indigo-600 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <h2 className="text-xl font-semibold text-gray-900">Job Simulation Experience</h2>
                </div>
                
                <p className="text-gray-800 mb-4">{jobSimulation.description}</p>
                
                <div className="flex flex-wrap gap-4 mb-4">
                  {jobSimulation.skills && jobSimulation.skills.map((skill: string, idx: number) => (
                    <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
                      {skill}
                    </span>
                  ))}
                </div>
                
                <Link 
                  href={`/job-simulation/${jobId}`}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                >
                  Start Simulation
                  <svg className="ml-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </Link>
              </motion.div>
            )}
          </div>
          
          {/* Sidebar */}
          <div>
            <motion.div
              className="bg-white rounded-xl shadow-sm p-6 mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Details</h2>
              
              <div className="space-y-4">
                <div className="flex border-b border-gray-100 pb-3">
                  <div className="w-1/3">
                    <h3 className="text-sm font-medium text-gray-500">Employment</h3>
                  </div>
                  <div className="w-2/3">
                    <p className="text-sm font-medium text-gray-900">{job.employmentType || 'Full-time'}</p>
                  </div>
                </div>
                
                <div className="flex border-b border-gray-100 pb-3">
                  <div className="w-1/3">
                    <h3 className="text-sm font-medium text-gray-500">Experience</h3>
                  </div>
                  <div className="w-2/3">
                    <p className="text-sm font-medium text-gray-900">{job.experienceLevel || 'Entry Level'}</p>
                  </div>
                </div>
                
                <div className="flex border-b border-gray-100 pb-3">
                  <div className="w-1/3">
                    <h3 className="text-sm font-medium text-gray-500">Location</h3>
                  </div>
                  <div className="w-2/3">
                    <p className="text-sm font-medium text-gray-900">{job.location || 'Remote'}</p>
                  </div>
                </div>
                
                <div className="flex border-b border-gray-100 pb-3">
                  <div className="w-1/3">
                    <h3 className="text-sm font-medium text-gray-500">Remote Work</h3>
                  </div>
                  <div className="w-2/3">
                    <p className="text-sm font-medium text-gray-900">
                      {job.remote === 'fully' ? 'Fully Remote' : job.remote === 'hybrid' ? 'Hybrid Remote' : 'On-site'}
                    </p>
                  </div>
                </div>
                
                <div className="flex border-b border-gray-100 pb-3">
                  <div className="w-1/3">
                    <h3 className="text-sm font-medium text-gray-500">Salary</h3>
                  </div>
                  <div className="w-2/3">
                    <p className="text-sm font-medium text-gray-900">{formatSalary(job.salary)}</p>
                  </div>
                </div>
                
                {job.visaSponsorship && (
                  <div className="flex border-b border-gray-100 pb-3">
                    <div className="w-1/3">
                      <h3 className="text-sm font-medium text-gray-500">Visa</h3>
                    </div>
                    <div className="w-2/3">
                      <p className="text-sm font-medium text-gray-900">Sponsorship Available</p>
                    </div>
                  </div>
                )}
                
                <div className="flex">
                  <div className="w-1/3">
                    <h3 className="text-sm font-medium text-gray-500">Posted</h3>
                  </div>
                  <div className="w-2/3">
                    <p className="text-sm font-medium text-gray-900">{formatDate(job.createdAt)}</p>
                  </div>
                </div>
                
                {job.applicationType && (
                  <div className="flex border-t border-gray-100 pt-3">
                    <div className="w-1/3">
                      <h3 className="text-sm font-medium text-gray-500">Application</h3>
                    </div>
                    <div className="w-2/3">
                      <p className="text-sm font-medium text-gray-900 capitalize">{job.applicationType} Process</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
            
            <motion.div
              className="bg-white rounded-xl shadow-sm p-6 mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Required Skills</h2>
              
              <div className="flex flex-wrap gap-2">
                {job.skills && job.skills.length > 0 ? (
                  job.skills.map((skill: string, idx: number) => (
                    <span key={idx} className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-indigo-100 text-indigo-800 mb-2">
                      {skill}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No specific skills listed for this position.</p>
                )}
              </div>
            </motion.div>
            
            {userRole === 'applicant' && similarJobs.length > 0 && (
              <motion.div
                className="bg-white rounded-xl shadow-sm p-6 mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.6 }}
              >
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Similar Jobs</h2>
                
                <div className="space-y-4">
                  {similarJobs.map((similarJob) => (
                    <Link 
                      href={`/applicant/jobs/${similarJob.id}`} 
                      key={similarJob.id}
                      className="block hover:bg-gray-50 -mx-3 px-3 py-3 rounded-lg transition-colors border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-md bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center text-white font-bold shadow-sm">
                            {similarJob.company ? similarJob.company.charAt(0).toUpperCase() : 'C'}
                          </div>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-gray-900">{similarJob.title || 'Job Position'}</h3>
                          <p className="text-xs text-gray-500">{similarJob.company || 'Company'} • {similarJob.location || 'Location'}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {similarJob.skills && similarJob.skills.slice(0, 2).map((skill: string, idx: number) => (
                              <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                                {skill}
                              </span>
                            ))}
                            {similarJob.skills && similarJob.skills.length > 2 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                +{similarJob.skills.length - 2} more
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <Link
                    href="/applicant/find-jobs"
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center justify-center"
                  >
                    View all similar jobs
                    <svg className="ml-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </Link>
                </div>
              </motion.div>
            )}
            
            {userRole === 'applicant' && (
              <motion.div
                className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl shadow-sm p-6 border border-indigo-100 mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.7 }}
              >
                <div className="flex items-center">
                  <svg className="h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <h2 className="ml-2 text-lg font-semibold text-gray-900">AI Resume Enhancement</h2>
                </div>
                
                <div className="mt-4">
                  <p className="text-sm text-gray-700 mb-4">
                    Our AI will tailor your resume for this job, highlighting your relevant skills and experience that match the requirements.
                  </p>
                  
                  <button
                    onClick={() => setShowResumeEnhancer(true)}
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                  >
                    <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                    Enhance Your Resume for This Job
                  </button>
                  
                  {enhancedResumeId && (
                    <div className="mt-3 text-center">
                      <Link
                        href={`/applicant/resumeBuilder?resumeId=${enhancedResumeId}`}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        View your enhanced resume
                      </Link>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </div>
        
        {/* Call to action for applicants */}
        {userRole === 'applicant' && !hasApplied && !showApplyForm && (
          <motion.div
            className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-xl shadow-lg p-8 mt-8 text-white text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
          >
            <h2 className="text-2xl font-bold mb-3">Ready to take the next step in your career?</h2>
            <p className="text-indigo-100 mb-6 max-w-2xl mx-auto">This opportunity aligns with your skills and could be the perfect match for your career growth. Don't miss out on this chance to join a great company.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button
                onClick={() => setShowApplyForm(true)}
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-indigo-700 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white transition-colors"
              >
                Apply Now
              </button>
              <button
                onClick={() => setShowResumeEnhancer(true)}
                className="inline-flex items-center justify-center px-6 py-3 border border-white border-opacity-50 text-base font-medium rounded-md shadow-sm text-white bg-indigo-700 bg-opacity-50 hover:bg-opacity-70 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white transition-colors"
              >
                <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
                Enhance Resume First
              </button>
            </div>
          </motion.div>
        )}
        
        {/* Back to jobs */}
        <div className="mt-8 text-center">
          <Link
            href="/find-jobs"
            className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to all jobs
          </Link>
        </div>
      </div>
      
      {/* Resume enhancer modal */}
      {showResumeEnhancer && (
        <ResumeEnhancer 
          jobId={jobId} 
          onClose={() => setShowResumeEnhancer(false)}
          onEnhanceComplete={handleEnhanceComplete}
        />
      )}
    </div>
  );
}