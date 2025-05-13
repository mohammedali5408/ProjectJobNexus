'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { addDoc, collection, doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { auth, db, storage } from '@/app/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Link from 'next/link';
import ResumeEnhancer from './resumeEnhancer';
import { createNewApplicationNotification } from '@/app/lib/notification-service';

type ApplicationFormProps = {
  job: {
    id: string;
    title: string;
    company: string;
    recruiterId: string;
    skills?: string[];
    requirements?: string[];
    description?: string;
  };
  onClose: () => void;
  onSuccess: () => void;
  enhancedResumeId?: string;
};

export default function ApplicationForm({ job, onClose, onSuccess, enhancedResumeId: initialEnhancedResumeId }: ApplicationFormProps) {
  const [applySummary, setApplySummary] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState({ type: '', message: '' });
  const [formStep, setFormStep] = useState(1);
  const [availability, setAvailability] = useState('');
  const [salary, setSalary] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  
  // States for resume enhancement
  const [isEnhancerOpen, setIsEnhancerOpen] = useState(false);
  const [enhancedResumeId, setEnhancedResumeId] = useState<string | null>(initialEnhancedResumeId || null);
  const [userResumes, setUserResumes] = useState<any[]>([]);
  const [enhancedResumeName, setEnhancedResumeName] = useState<string | null>(null);
  const [parsedResumeData, setParsedResumeData] = useState<any>(null);
  
  // Added state for application review
  const [showReview, setShowReview] = useState(false);
  const [applicationData, setApplicationData] = useState<any>(null);

  // Fetch user's saved resumes when component mounts - for reference only
  useEffect(() => {
    const fetchUserResumes = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().resumes) {
          setUserResumes(userDoc.data().resumes);
        }
      } catch (error) {
        console.error("Error fetching user resumes:", error);
      }
    };

    fetchUserResumes();
  }, []);

  const handleResumeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setResumeFile(file);
      
      // Reset enhanced resume when new file is uploaded
      setEnhancedResumeId(null);
      setEnhancedResumeName(null);
      
      // Automatically start parsing the uploaded resume
      await parseResumeFile(file);
    }
  };
  
  // Parsing function for the uploaded resume
  const parseResumeFile = async (file: File) => {
    setIsParsing(true);
    setParseProgress(0);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Simulate progress for UX
      const progressInterval = setInterval(() => {
        setParseProgress(prev => Math.min(prev + 10, 90));
      }, 200);
      
      const response = await fetch('/api/resume-parser', {
        method: 'POST',
        body: formData,
      });
      
      clearInterval(progressInterval);
      setParseProgress(100);
      
      if (!response.ok) {
        throw new Error('Failed to parse resume');
      }
      
      const result = await response.json();
      
      if (result.success) {
        setParsedResumeData(result.data);
        setNotification({
          type: 'success',
          message: 'Resume successfully parsed! You can now enhance it for this job.'
        });
      } else {
        throw new Error(result.error || 'Failed to parse resume');
      }
    } catch (error) {
      console.error('Error parsing resume:', error);
      setNotification({
        type: 'error',
        message: 'Failed to parse resume. Please try again or use a different file format.'
      });
    } finally {
      setIsParsing(false);
      setParseProgress(0);
    }
  };
  
  // Handle when resume enhancement is complete
  const handleEnhanceComplete = (enhancedId: string, enhancedData: any = null) => {
  setEnhancedResumeId(enhancedId);
  setIsEnhancerOpen(false);
  
  if (enhancedData) {
    // Store the enhanced resume data
    setParsedResumeData(enhancedData);
    console.log('Enhanced resume data received:', enhancedData);
  }
  
  // Update the enhanced resume name
  const enhancedName = `${job.title} at ${job.company} - Enhanced Resume`;
  setEnhancedResumeName(enhancedName);
  
  // Show success message
  setNotification({
    type: 'success',
    message: 'Resume enhanced successfully! This version will be used in your application.'
  });
};

  
  const validateFirstStep = () => {
    if (!applySummary.trim()) {
      setNotification({
        type: 'error',
        message: 'Please provide a summary of why you are a good fit for this role.'
      });
      return false;
    }
    if (!resumeFile && !enhancedResumeId) {
      setNotification({
        type: 'error',
        message: 'Please upload your resume.'
      });
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateFirstStep()) {
      setFormStep(2);
      setNotification({ type: '', message: '' });
    }
  };

  const handlePrevStep = () => {
    setFormStep(1);
  };
  
  const prepareApplicationData = async () => {
  const user = auth.currentUser;
  if (!user) {
    setNotification({
      type: 'error',
      message: 'You must be signed in to submit an application.'
    });
    return null;
  }
  
  let resumeURL = '';
  
  // Upload the resume file if it exists and no enhanced resume is selected
  if (resumeFile && !enhancedResumeId) {
    try {
      const storageRef = ref(storage, `resumes/${user.uid}/${Date.now()}_${resumeFile.name}`);
      const snapshot = await uploadBytes(storageRef, resumeFile);
      resumeURL = await getDownloadURL(snapshot.ref);
    } catch (error) {
      console.error("Error uploading resume:", error);
      setNotification({
        type: 'error',
        message: 'Failed to upload resume. Please try again.'
      });
      return null;
    }
  }
  
  // Create application data object
  const applicationDataObj = {
    jobId: job.id,
    jobTitle: job.title,
    company: job.company,
    recruiterId: job.recruiterId,
    applicantId: user.uid,
    applicantEmail: user.email,
    applicantName: user.displayName || parsedResumeData?.personalInfo?.name || '',
    applySummary,
    coverLetter,
    availability,
    expectedSalary: salary,
    referralSource,
    resumeURL,
    resumeSubmitted: !!resumeFile || !!enhancedResumeId,
    resumeFilename: resumeFile ? resumeFile.name : (enhancedResumeName || 'Enhanced Resume'),
    enhancedResumeId: enhancedResumeId,
    enhancedResumeName: enhancedResumeName,
    // Important: Always include the parsed/enhanced resume data
    resumeData: parsedResumeData,
    status: 'pending',
    submittedAt: new Date(),
    updatedAt: new Date()
  };
  
  console.log('Prepared application data:', applicationDataObj);
  return applicationDataObj;
};

    
  
  const handleReviewApplication = async () => {
    if (!agreeToTerms) {
      setNotification({
        type: 'error',
        message: 'You must agree to the terms and conditions to submit your application.'
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const appData = await prepareApplicationData();
      if (!appData) {
        setIsSubmitting(false);
        return;
      }
      
      setApplicationData(appData);
      setShowReview(true);
    } catch (error) {
      console.error("Error preparing application:", error);
      setNotification({
        type: 'error',
        message: 'An error occurred while preparing your application. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleSubmitApplication = async () => {
    if (!applicationData) {
      setNotification({
        type: 'error',
        message: 'Application data not available. Please try again.'
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const user = auth.currentUser;
      if (!user) {
        setIsSubmitting(false);
        return;
      }
      
      // Create application record in Firestore
      const applicationRef = await addDoc(collection(db, "applications"), applicationData);
      
      // Get the newly created application ID
      const applicationId = applicationRef.id;
      
      // Create notification for the recruiter using the notification service
      if (job.recruiterId) {
        try {
          await createNewApplicationNotification({
            userId: job.recruiterId,
            applicationId,
            jobId: job.id,
            jobTitle: job.title,
            candidateName: applicationData.applicantName
          });
          console.log("Notification created successfully");
        } catch (notificationError) {
          console.error("Error creating notification:", notificationError);
        }
      }
      
      // Update job application count
      await updateDoc(doc(db, "jobs", job.id), {
        applicants: increment(1)
      });
      
      setNotification({
        type: 'success',
        message: 'Your application has been submitted successfully!'
      });
      
      // Call onSuccess callback after 2 seconds to allow user to see the success message
      setTimeout(() => {
        onSuccess();
      }, 2000);
      
    } catch (error) {
      console.error("Error submitting application:", error);
      setNotification({
        type: 'error',
        message: 'An error occurred while submitting your application. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render the resume upload section
  const renderResumeUpload = () => {
    return (
      <div className="mb-4">
        <label htmlFor="resume" className="block text-sm font-medium text-gray-900 mb-1">
          Resume <span className="text-red-500">*</span>
        </label>
        
        {/* Display enhanced resume info if available */}
        {enhancedResumeId && (
          <div className="mb-3 p-3 bg-indigo-50 border border-indigo-100 rounded-md">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-indigo-500 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium text-indigo-800">Enhanced Resume</span>
                </div>
                <p className="text-xs text-indigo-700 mt-1 ml-7">{enhancedResumeName || "Optimized for this position"}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEnhancedResumeId(null);
                  setEnhancedResumeName(null);
                }}
                className="text-xs text-indigo-600 hover:text-indigo-800"
              >
                Remove
              </button>
            </div>
          </div>
        )}
        
        {!enhancedResumeId && (
          <div className="space-y-3">
            <input
              type="file"
              id="resume"
              accept=".pdf,.doc,.docx"
              onChange={handleResumeChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm text-gray-900"
              required={!enhancedResumeId}
            />
            <p className="mt-1 text-xs text-gray-600">
              Accepted formats: PDF, DOC, DOCX. Maximum size: 5MB
            </p>
          </div>
        )}
        
        {resumeFile && parsedResumeData && !enhancedResumeId && (
          <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-medium text-gray-700">Resume Preview</h4>
              <button
                type="button"
                onClick={() => setIsEnhancerOpen(true)}
                className="px-3 py-1 bg-indigo-50 border border-indigo-200 rounded text-sm text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
              >
                <span className="flex items-center">
                  <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                  </svg>
                  Enhance for this job
                </span>
              </button>
            </div>
            
            <div className="text-sm text-gray-600 space-y-2 max-h-40 overflow-y-auto">
              {parsedResumeData.personalInfo && (
                <div>
                  <p className="font-medium">{parsedResumeData.personalInfo.name || 'Name not found'}</p>
                  {parsedResumeData.personalInfo.email && <p>{parsedResumeData.personalInfo.email}</p>}
                </div>
              )}
              
              {parsedResumeData.summary && (
                <div>
                  <p className="font-medium text-xs text-gray-500">Summary:</p>
                  <p className="text-xs">{parsedResumeData.summary.length > 100 
                    ? `${parsedResumeData.summary.substring(0, 100)}...` 
                    : parsedResumeData.summary}
                  </p>
                </div>
              )}
              
              {parsedResumeData.skills && parsedResumeData.skills.length > 0 && (
                <div>
                  <p className="font-medium text-xs text-gray-500">Skills:</p>
                  <p className="text-xs">
                    {Array.isArray(parsedResumeData.skills) 
                      ? parsedResumeData.skills.slice(0, 5).join(', ') + (parsedResumeData.skills.length > 5 ? '...' : '')
                      : parsedResumeData.skills}
                  </p>
                </div>
              )}
              
              {parsedResumeData.experience && parsedResumeData.experience.length > 0 && (
                <div>
                  <p className="font-medium text-xs text-gray-500">Experience:</p>
                  <p className="text-xs">{parsedResumeData.experience[0].title} at {parsedResumeData.experience[0].company}</p>
                  {parsedResumeData.experience.length > 1 && (
                    <p className="text-xs text-gray-400 italic">
                      + {parsedResumeData.experience.length - 1} more experiences
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        
        {isParsing && (
          <div className="mt-2">
            <div className="flex items-center">
              <svg className="animate-spin h-4 w-4 text-indigo-600 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm text-gray-700">Parsing resume... {parseProgress}%</span>
            </div>
            <div className="mt-1 h-1 w-full bg-gray-200 rounded">
              <div className="h-1 bg-indigo-600 rounded" style={{ width: `${parseProgress}%` }}></div>
            </div>
          </div>
        )}
      </div>
    );
  };
  
  // Render the application review screen
  const renderApplicationReview = () => {
    if (!applicationData) return null;
    
    // Get resume data (either enhanced or parsed)
    const resumeData = applicationData.enhancedResumeData;
    const isEnhanced = !!enhancedResumeId;
    
    return (
      <div className="p-6 text-black">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Review Your Application</h3>
        
        <div className="space-y-6">
          {/* Job Details */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h4 className="text-md font-medium text-gray-900 mb-2">Job Details</h4>
            <div className="text-sm text-gray-800">
              <p><span className="font-medium">Position:</span> {job.title}</p>
              <p><span className="font-medium">Company:</span> {job.company}</p>
            </div>
          </div>
          
          {/* Applicant Details */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h4 className="text-md font-medium text-gray-900 mb-2">Your Information</h4>
            <div className="text-sm text-gray-800">
              <p><span className="font-medium">Name:</span> {applicationData.applicantName}</p>
              <p><span className="font-medium">Email:</span> {applicationData.applicantEmail}</p>
              <p><span className="font-medium">Availability:</span> {applicationData.availability || 'Not specified'}</p>
              <p><span className="font-medium">Expected Salary:</span> {applicationData.expectedSalary || 'Not specified'}</p>
            </div>
          </div>
          
          {/* Resume Details */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-md font-medium text-gray-900">Resume</h4>
              {isEnhanced && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  AI Enhanced
                </span>
              )}
            </div>
            
            {resumeData ? (
              <div className="text-sm text-gray-800">
                {/* Display resume name if enhanced */}
                {enhancedResumeName && (
                  <div className="mb-3">
                    <p className="font-medium">Resume Used:</p>
                    <p className="text-indigo-600">{enhancedResumeName}</p>
                  </div>
                )}
                
                {/* Summary */}
                {resumeData.summary && (
                  <div className="mb-3">
                    <p className="font-medium">Summary:</p>
                    <p className="text-gray-600">{resumeData.summary}</p>
                  </div>
                )}
                
                {/* Skills */}
                {resumeData.skills && (
                  <div className="mb-3">
                    <p className="font-medium">Skills:</p>
                    <p className="text-gray-600">
                      {Array.isArray(resumeData.skills) 
                        ? resumeData.skills.join(', ') 
                        : resumeData.skills}
                    </p>
                  </div>
                )}
                
                {/* Experience Preview */}
                {resumeData.experience && resumeData.experience.length > 0 && (
                  <div>
                    <p className="font-medium">Experience:</p>
                    <div className="ml-2">
                      {(resumeData.experience.slice(0, 2)).map((exp: any, i: number) => (
                        <div key={i} className="mb-2">
                          <p className="font-medium text-gray-700">{exp.title} at {exp.company}</p>
                          <p className="text-xs text-gray-500">{exp.startDate} - {exp.endDate || 'Present'}</p>
                          <p className="text-gray-600 text-sm">{typeof exp.description === 'string' 
                            ? exp.description.length > 150 
                              ? `${exp.description.substring(0, 150)}...` 
                              : exp.description 
                            : ''}
                          </p>
                        </div>
                      ))}
                      {resumeData.experience.length > 2 && (
                        <p className="text-xs text-gray-500 italic">
                          {resumeData.experience.length - 2} more experiences included
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500 italic">
                {applicationData.resumeFilename ? (
                  <p>Resume file: {applicationData.resumeFilename}</p>
                ) : (
                  <p>No resume details available</p>
                )}
              </div>
            )}
          </div>
          
          {/* Application Summary */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h4 className="text-md font-medium text-gray-900 mb-2">Your Application Summary</h4>
            <div className="text-sm text-gray-800">
              <p className="text-gray-600">{applicationData.applySummary}</p>
            </div>
          </div>
          
          {/* Cover Letter (if provided) */}
          {applicationData.coverLetter && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h4 className="text-md font-medium text-gray-900 mb-2">Cover Letter</h4>
              <div className="text-sm text-gray-800">
                <p className="text-gray-600">{applicationData.coverLetter.length > 300 
                  ? `${applicationData.coverLetter.substring(0, 300)}...` 
                  : applicationData.coverLetter}
                </p>
                {applicationData.coverLetter.length > 300 && (
                  <p className="text-xs text-gray-500 italic mt-1">
                    Full cover letter will be included in your application
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="flex justify-between mt-6">
          <button
            type="button"
            onClick={() => setShowReview(false)}
            className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Back to Form
          </button>
          <button
            type="button"
            onClick={handleSubmitApplication}
            disabled={isSubmitting}
            className={`px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
              isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Submitting Application...
              </>
            ) : 'Submit Application'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <motion.div
      className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div 
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-t-lg p-6 text-white">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Apply for {job.title}</h2>
            <button
              onClick={onClose}
              className="text-white hover:text-indigo-100"
            >
              <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-indigo-100 mt-1">{job.company}</p>
          
          {/* Progress indicator */}
          <div className="mt-6 flex items-center">
            <div className={`w-1/3 h-1 rounded-l-full ${formStep === 1 ? 'bg-white' : 'bg-indigo-300'}`}></div>
            <div className={`w-1/3 h-1 ${formStep === 2 ? 'bg-white' : 'bg-indigo-300'}`}></div>
            <div className={`w-1/3 h-1 rounded-r-full ${showReview ? 'bg-white' : 'bg-indigo-300'}`}></div>
          </div>
          <div className="flex justify-between text-xs text-indigo-100 mt-1">
            <span className={formStep === 1 ? 'font-medium text-white' : ''}>Basic Information</span>
            <span className={formStep === 2 ? 'font-medium text-white' : ''}>Additional Details</span>
            <span className={showReview ? 'font-medium text-white' : ''}>Review</span>
          </div>
        </div>
        
        {/* Notification */}
        {notification.message && (
          <div className={`p-4 ${
            notification.type === 'success' ? 'bg-green-50 text-green-800' : 
            notification.type === 'warning' ? 'bg-yellow-50 text-yellow-800' :
            'bg-red-50 text-red-800'
          }`}>
            <div className="flex">
              <div className="flex-shrink-0">
                {notification.type === 'success' ? (
                  <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : notification.type === 'warning' ? (
                  <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
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
            </div>
          </div>
        )}
        
        {showReview ? (
          renderApplicationReview()
        ) : (
          <form onSubmit={(e) => {
            e.preventDefault();
            if (formStep === 1) {
              handleNextStep();
            } else {
              handleReviewApplication();
            }
          }}>
            {/* Form Step 1 */}
            {formStep === 1 && (
              <div className="p-6 text-black">
                <div className="mb-4">
                  <label htmlFor="applySummary" className="block text-sm font-medium text-gray-900 mb-1">
                    Why are you a good fit for this role? <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="applySummary"
                    rows={4}
                    value={applySummary}
                    onChange={(e) => setApplySummary(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm text-gray-900"
                    placeholder="Highlight your key qualifications and experience that make you a strong candidate for this position..."
                    required
                  />
                  <p className="mt-1 text-xs text-gray-600">
                    Keep this concise (150-250 words). You'll have the opportunity to provide more details later.
                  </p>
                </div>
                
                {/* Resume section with enhancement option */}
                {renderResumeUpload()}
                
                <div className="flex justify-between mt-6">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Next Step
                  </button>
                </div>
              </div>
            )}
            
            {/* Form Step 2 */}
            {formStep === 2 && (
              <div className="p-6 text-black">
                <div className="mb-4">
                  <label htmlFor="coverLetter" className="block text-sm font-medium text-gray-900 mb-1">
                    Cover Letter
                  </label>
                  <textarea
                    id="coverLetter"
                    rows={6}
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm text-gray-900"
                    placeholder="Provide additional details about your experience, skills, and why you want to join this company..."
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="availability" className="block text-sm font-medium text-gray-900 mb-1">
                      Availability to Start
                    </label>
                    <select
                      id="availability"
                      value={availability}
                      onChange={(e) => setAvailability(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm text-gray-900"
                    >
                      <option value="">Select an option</option>
                      <option value="immediately">Immediately</option>
                      <option value="2weeks">2 weeks notice</option>
                      <option value="1month">1 month notice</option>
                      <option value="more">More than 1 month</option>
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="salary" className="block text-sm font-medium text-gray-900 mb-1">
                      Expected Salary
                    </label>
                    <input
                      type="text"
                      id="salary"
                      value={salary}
                      onChange={(e) => setSalary(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm text-gray-900"
                      placeholder="E.g. $70,000 - $85,000"
                    />
                  </div>
                </div>
                
                <div className="mb-6">
                  <label htmlFor="referralSource" className="block text-sm font-medium text-gray-900 mb-1">
                    How did you hear about this position?
                  </label>
                  <select
                    id="referralSource"
                    value={referralSource}
                    onChange={(e) => setReferralSource(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm text-gray-900"
                  >
                    <option value="">Select an option</option>
                    <option value="jobBoard">Job Board</option>
                    <option value="companyWebsite">Company Website</option>
                    <option value="socialMedia">Social Media</option>
                    <option value="employeeReferral">Employee Referral</option>
                    <option value="recruitmentAgency">Recruitment Agency</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                
                <div className="mb-6">
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="terms"
                        name="terms"
                        type="checkbox"
                        checked={agreeToTerms}
                        onChange={(e) => setAgreeToTerms(e.target.checked)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="terms" className="font-medium text-gray-900">
                        Terms and Conditions <span className="text-red-500">*</span>
                      </label>
                      <p className="text-gray-600">
                        I agree to the <Link href="#" className="text-indigo-600 hover:text-indigo-500">privacy policy</Link> and consent to the processing of my personal data for the purpose of job application.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between mt-6">
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || isParsing}
                    className={`px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                      (isSubmitting || isParsing) ? 'opacity-70 cursor-not-allowed' : ''
                    }`}
                  >
                    {isParsing ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Parsing resume... {parseProgress}%
                      </>
                    ) : isSubmitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Preparing...
                      </>
                    ) : 'Review Application'}
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
      </motion.div>
      
      {/* Resume Enhancer Modal */}
      {isEnhancerOpen && (
        <ResumeEnhancer 
          jobId={job.id}
          onClose={() => setIsEnhancerOpen(false)}
          onEnhanceComplete={handleEnhanceComplete}
          uploadedResume={parsedResumeData} // Pass the parsed resume data for enhancement
          resumeFile={resumeFile} // Pass the original file for reference
        />
      )}
    </motion.div>
  );
}