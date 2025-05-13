'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import ResumeEnhancer from './resumeEnhancer';

interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  employmentType: string;
  experienceLevel: string;
  remote: string;
  salary: {
    min: string;
    max: string;
    currency: string;
    period: string;
  };
  skills: string[];
  createdAt: any;
  applicants: number;
  visaSponsorship: boolean;
  status: string;
  description: string;
}

interface JobCardProps {
  job: JobListing;
  userRole: 'applicant' | 'recruiter';
}

export default function JobCardWithEnhanceButton({ job, userRole }: JobCardProps) {
  const [showEnhancer, setShowEnhancer] = useState(false);
  const [enhancedResumeId, setEnhancedResumeId] = useState<string | null>(null);
  const [notification, setNotification] = useState({ type: '', message: '' });

  // Format salary for display
  const formatSalary = (job: JobListing) => {
    if (!job.salary.min && !job.salary.max) return 'Not specified';
    
    const formatValue = (value: string) => {
      if (!value) return '';
      const num = parseInt(value);
      return num >= 1000 ? `${(num / 1000).toFixed(0)}k` : num;
    };
    
    const min = formatValue(job.salary.min);
    const max = formatValue(job.salary.max);
    
    if (min && max) {
      return `${job.salary.currency} ${min}-${max} ${job.salary.period}`;
    } else if (min) {
      return `${job.salary.currency} ${min}+ ${job.salary.period}`;
    } else if (max) {
      return `Up to ${job.salary.currency} ${max} ${job.salary.period}`;
    }
    
    return 'Not specified';
  };

  // Format date for display
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown date';
    
    const date = new Date(timestamp.seconds * 1000);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    } else {
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  // Handle resume enhancement
  const handleEnhanceResume = () => {
    setShowEnhancer(true);
  };

  const handleEnhanceComplete = (resumeId: string) => {
    setEnhancedResumeId(resumeId);
    setShowEnhancer(false);
    
    // Show notification
    setNotification({
      type: 'success',
      message: 'Resume enhanced successfully!'
    });
    
    // Clear notification after 5 seconds
    setTimeout(() => {
      setNotification({ type: '', message: '' });
    }, 5000);
  };

  return (
    <>
      {/* Notification */}
      {notification.message && (
        <div className={`fixed top-20 right-4 z-50 p-4 rounded-md shadow-lg max-w-md ${
          notification.type === 'success' ? 'bg-green-50 text-green-800' : 
          notification.type === 'error' ? 'bg-red-50 text-red-800' :
          'bg-blue-50 text-blue-800'
        }`}>
          <div className="flex">
            <div className="flex-shrink-0">
              {notification.type === 'success' ? (
                <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : notification.type === 'error' ? (
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
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
                  className="inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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

      <motion.div
        className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        whileHover={{ y: -2 }}
      >
        <div className="p-6">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div className="flex-1">
              <div className="flex items-start">
                <div className="h-12 w-12 rounded-md bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-lg">
                  {job.company.charAt(0)}
                </div>
                <div className="ml-4">
                  <Link href={`/applicant/jobs/${job.id}`} className="text-xl font-semibold text-gray-900 hover:text-indigo-600">
                    {job.title}
                  </Link>
                  <div className="text-sm text-gray-500">{job.company}</div>
                </div>
              </div>
              
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {job.employmentType}
                </span>
                <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {job.location}
                </span>
                {job.remote !== 'no' && (
                  <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {job.remote === 'fully' ? 'Fully Remote' : 'Hybrid Remote'}
                  </span>
                )}
                {job.visaSponsorship && (
                  <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    Visa Sponsorship
                  </span>
                )}
                <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  {job.experienceLevel}
                </span>
              </div>
              
              <div className="mt-4">
                <p className="text-sm text-gray-600 line-clamp-2">
                  {job.description}
                </p>
              </div>
              
              <div className="mt-4 flex flex-wrap gap-1">
                {job.skills.slice(0, 5).map((skill, index) => (
                  <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                    {skill}
                  </span>
                ))}
                {job.skills.length > 5 && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                    +{job.skills.length - 5} more
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex flex-col items-end">
              <div className="text-sm text-gray-500">
                Posted {formatDate(job.createdAt)}
              </div>
              <div className="mt-1 text-sm font-medium text-gray-900">
                {formatSalary(job)}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {job.applicants} applicant{job.applicants !== 1 ? 's' : ''}
              </div>
              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <Link
                  href={`/applicant/jobs/${job.id}`}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {userRole === 'applicant' ? 'View & Apply' : 'View Details'}
                </Link>
                
                {userRole === 'applicant' && (
                  <button
                    onClick={handleEnhanceResume}
                    className="inline-flex items-center px-3 py-2 border border-indigo-300 text-sm font-medium rounded-md shadow-sm text-indigo-700 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <svg className="mr-1 h-4 w-4 text-indigo-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                    Enhance Resume
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
      
      {/* Resume enhancer modal */}
      {showEnhancer && (
        <ResumeEnhancer 
          jobId={job.id} 
          onClose={() => setShowEnhancer(false)}
          onEnhanceComplete={handleEnhanceComplete}
        />
      )}
    </>
  );
}