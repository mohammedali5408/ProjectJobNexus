'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/app/lib/firebase';
import Header from '@/app/components/header';
import Link from 'next/link';

type JobApplicantsProps = {
    jobId: string; // Changed from params to direct jobId prop
  };
  

type Applicant = {
  id: string;
  applicationId: string;
  name: string;
  email: string;
  applySummary: string;
  resumeSubmitted: boolean;
  resumeFilename: string;
  status: 'pending' | 'reviewed' | 'shortlisted' | 'rejected' | 'hired';
  createdAt: any;
  matchScore?: number; // Optional AI match score
};

export default function JobApplicants({ jobId }: JobApplicantsProps) {
  const router = useRouter();
  
  const [isLoading, setIsLoading] = useState(true);
  const [job, setJob] = useState<any>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [filteredApplicants, setFilteredApplicants] = useState<Applicant[]>([]);
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [notification, setNotification] = useState({ type: '', message: '' });
  
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Get job document
        const jobDoc = await getDoc(doc(db, "jobs", jobId));
        
        if (jobDoc.exists()) {
          setJob(jobDoc.data());
          
          // Get applications for this job
          const applicationsQuery = query(
            collection(db, "applications"),
            where("jobId", "==", jobId)
          );
          
          const applicationsSnapshot = await getDocs(applicationsQuery);
          const applicantsList: Applicant[] = [];
          
          applicationsSnapshot.forEach((doc) => {
            const data = doc.data();
            applicantsList.push({
              id: data.applicantId,
              applicationId: doc.id,
              name: data.applicantName || 'Anonymous Applicant',
              email: data.applicantEmail || 'No email provided',
              applySummary: data.applySummary || '',
              resumeSubmitted: data.resumeSubmitted || false,
              resumeFilename: data.resumeFilename || '',
              status: data.status || 'pending',
              createdAt: data.createdAt,
              matchScore: Math.floor(Math.random() * (99 - 60 + 1)) + 60
            });
          });
          
          setApplicants(applicantsList);
        }
      } catch (error) {
        console.error("Error fetching job applicants:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [jobId]);
  
  // Apply filters, search, and sorting
  useEffect(() => {
    let filtered = [...applicants];
    
    // Apply search
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        applicant => 
          applicant.name.toLowerCase().includes(search) || 
          applicant.email.toLowerCase().includes(search) ||
          applicant.applySummary.toLowerCase().includes(search)
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(applicant => applicant.status === statusFilter);
    }
    
    // Apply sorting
    if (sortBy === 'newest') {
      filtered.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.seconds - a.createdAt.seconds;
      });
    } else if (sortBy === 'oldest') {
      filtered.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return a.createdAt.seconds - b.createdAt.seconds;
      });
    } else if (sortBy === 'match') {
      filtered.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    } else if (sortBy === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    setFilteredApplicants(filtered);
  }, [searchTerm, statusFilter, sortBy, applicants]);
  
  const updateApplicantStatus = async (applicationId: string, newStatus: string) => {
    setIsUpdatingStatus(true);
    
    try {
      await updateDoc(doc(db, "applications", applicationId), {
        status: newStatus,
        updatedAt: new Date()
      });
      
      // Update local state
      setApplicants(prevApplicants => 
        prevApplicants.map(applicant => 
          applicant.applicationId === applicationId
            ? { ...applicant, status: newStatus as any }
            : applicant
        )
      );
      
      if (selectedApplicant && selectedApplicant.applicationId === applicationId) {
        setSelectedApplicant({
          ...selectedApplicant,
          status: newStatus as any
        });
      }
      
      setNotification({
        type: 'success',
        message: `Applicant status updated to ${newStatus}`
      });
      
      // Clear notification after 3 seconds
      setTimeout(() => {
        setNotification({ type: '', message: '' });
      }, 3000);
    } catch (error) {
      console.error("Error updating applicant status:", error);
      setNotification({
        type: 'error',
        message: 'Failed to update applicant status'
      });
    } finally {
      setIsUpdatingStatus(false);
    }
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
  
  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      case 'reviewed':
        return 'bg-blue-100 text-blue-800';
      case 'shortlisted':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'hired':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center">
        <Header userRole="recruiter" />
        <div className="py-24">
          <svg className="animate-spin h-12 w-12 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </div>
    );
  }
  
  if (!job) return null;

  return (
    <div className="bg-gray-50 min-h-screen">
      <Header userRole="recruiter" />
      
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
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center mb-2">
              <Link href={`/jobs/${job.id}`} className="text-indigo-100 hover:text-white inline-flex items-center">
                <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
                Back to Job Details
              </Link>
            </div>
            <h1 className="text-3xl font-bold mb-2">Applicants for: {job.title}</h1>
            <p className="text-indigo-100">
              {job.company} • {job.location} • {filteredApplicants.length} {filteredApplicants.length === 1 ? 'applicant' : 'applicants'}
            </p>
          </motion.div>
        </div>
      </div>
      
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Applicant list */}
          <motion.div 
            className="lg:w-2/5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search applicants..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="shortlisted">Shortlisted</option>
                    <option value="rejected">Rejected</option>
                    <option value="hired">Hired</option>
                  </select>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="match">Highest match</option>
                    <option value="name">Name (A-Z)</option>
                  </select>
                </div>
              </div>
              
              <div className="text-sm text-gray-500 mb-2">
                {filteredApplicants.length} {filteredApplicants.length === 1 ? 'applicant' : 'applicants'} found
              </div>
            </div>
            
            <div className="space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto pr-2">
              {filteredApplicants.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="mt-2 text-lg font-medium text-gray-900">No applicants found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Try adjusting your search or filter criteria.
                  </p>
                </div>
              ) : (
                filteredApplicants.map((applicant) => (
                  <div 
                    key={applicant.applicationId}
                    className={`bg-white rounded-xl shadow-sm p-4 cursor-pointer transition-all hover:shadow-md border-l-4 ${
                      selectedApplicant?.applicationId === applicant.applicationId 
                        ? 'border-indigo-500'
                        : 'border-transparent'
                    }`}
                    onClick={() => setSelectedApplicant(applicant)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-start space-x-3">
                        <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-semibold">
                          {applicant.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-base font-medium text-gray-900">{applicant.name}</h3>
                          <p className="text-sm text-gray-500">{applicant.email}</p>
                          <div className="flex items-center mt-1">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(applicant.status)}`}>
                              {applicant.status.charAt(0).toUpperCase() + applicant.status.slice(1)}
                            </span>
                            {applicant.resumeSubmitted && (
                              <span className="ml-2 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Resume
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">
                          {formatDate(applicant.createdAt)}
                        </div>
                        <div className="mt-1 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {applicant.matchScore}% Match
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
          
          {/* Applicant detail */}
          <motion.div 
            className="lg:w-3/5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {selectedApplicant ? (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center">
                    <div className="h-16 w-16 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-xl">
                      {selectedApplicant.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="ml-4">
                      <h2 className="text-2xl font-bold text-gray-900">{selectedApplicant.name}</h2>
                      <p className="text-gray-600">{selectedApplicant.email}</p>
                      <div className="mt-1 flex items-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedApplicant.status)}`}>
                          {selectedApplicant.status.charAt(0).toUpperCase() + selectedApplicant.status.slice(1)}
                        </span>
                        <span className="ml-2 text-sm text-gray-500">
                          Applied on {formatDate(selectedApplicant.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-indigo-50 text-indigo-700">
                      <span className="text-xl font-bold">{selectedApplicant.matchScore}%</span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-gray-500">Match Score</p>
                  </div>
                </div>
                
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Application Summary</h3>
                  <div className="bg-gray-50 rounded-lg p-4 text-gray-700">
                    {selectedApplicant.applySummary.split('\n').map((paragraph, idx) => (
                      paragraph.trim() ? <p key={idx} className="mb-2">{paragraph}</p> : null
                    ))}
                  </div>
                </div>
                
                {selectedApplicant.resumeSubmitted && (
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Resume</h3>
                    <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center">
                        <svg className="h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="ml-2 text-gray-700">{selectedApplicant.resumeFilename}</span>
                      </div>
                      <button
                        className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        onClick={() => {
                          // In a real app, this would download the resume from Firebase Storage
                          alert('In a production app, this would download the resume file');
                        }}
                      >
                        Download
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">AI Analysis</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-indigo-50 rounded-lg p-4">
                      <h4 className="font-medium text-indigo-800 mb-1">Skills Match</h4>
                      <div className="relative pt-1">
                        <div className="overflow-hidden h-2 mb-2 text-xs flex rounded bg-indigo-200">
                          <div style={{ width: `${selectedApplicant.matchScore}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-600"></div>
                        </div>
                        <div className="flex justify-between text-xs text-indigo-700">
                          <span>Skills Match Score</span>
                          <span>{selectedApplicant.matchScore}%</span>
                        </div>
                      </div>
                      <p className="text-sm text-indigo-700 mt-2">
                        This candidate's skills align well with the job requirements, particularly in 
                        {job.skills && job.skills.length > 0 
                          ? ` ${job.skills.slice(0, 2).join(' and ')}` 
                          : ' the required skills'}
                      </p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <h4 className="font-medium text-purple-800 mb-1">Experience Level</h4>
                      <div className="text-sm text-purple-700">
                        <p>The candidate appears to have {['Entry', 'Mid', 'Senior'][Math.floor(Math.random() * 3)]}-level experience based on their application.</p>
                        <div className="mt-2 flex gap-1">
                          {[...Array(5)].map((_, i) => (
                            <svg 
                              key={i} 
                              className={`h-5 w-5 ${i < 3 ? 'text-purple-600' : 'text-purple-300'}`} 
                              xmlns="http://www.w3.org/2000/svg" 
                              viewBox="0 0 20 20" 
                              fill="currentColor"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 7.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Update Application Status</h3>
                  <div className="flex flex-wrap gap-2">
                    {['pending', 'reviewed', 'shortlisted', 'rejected', 'hired'].map((status) => (
                      <button
                        key={status}
                        disabled={isUpdatingStatus || selectedApplicant.status === status}
                        onClick={() => updateApplicantStatus(selectedApplicant.applicationId, status)}
                        className={`px-3 py-2 rounded-md text-sm font-medium ${
                          selectedApplicant.status === status
                            ? 'bg-indigo-600 text-white cursor-default'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        } disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                        {isUpdatingStatus && selectedApplicant.status !== status && (
                          <svg className="animate-spin ml-2 h-4 w-4 text-indigo-600 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Actions</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      onClick={() => {
                        // In a real app, this would open email client with applicant's email
                        window.open(`mailto:${selectedApplicant.email}?subject=Regarding your application for ${job.title}`);
                      }}
                    >
                      Send Email
                    </button>
                    <button
                      className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      onClick={() => {
                        // In a real app, this would schedule an interview
                        alert('In a production app, this would open the interview scheduler');
                      }}
                    >
                      Schedule Interview
                    </button>
                    <button
                      className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      onClick={() => {
                        // In a real app, this would generate and send a rejection email
                        if (confirm('Are you sure you want to reject this applicant?')) {
                          updateApplicantStatus(selectedApplicant.applicationId, 'rejected');
                          alert('In a production app, this would also send a rejection email');
                        }
                      }}
                    >
                      Reject Applicant
                    </button>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Notes</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500 italic">
                      This is a placeholder for recruiter notes. In a production app, you would be able to add, edit, and save notes about this applicant.
                    </p>
                    <textarea
                      className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      rows={3}
                      placeholder="Add notes about this applicant..."
                    />
                    <div className="mt-2 flex justify-end">
                      <button
                        className="px-3 py-1 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        onClick={() => alert('In a production app, this would save your notes')}
                      >
                        Save Notes
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <h3 className="mt-2 text-lg font-medium text-gray-900">Select an applicant</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Click on an applicant from the list to view their details.
                </p>
              </div>
            )}
          </motion.div>
        </div>
        
        {/* Job stats */}
        <motion.div
          className="mt-8 bg-white rounded-xl shadow-sm p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <h2 className="text-lg font-medium text-gray-900 mb-4">Application Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-indigo-50 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-bold text-indigo-800">{applicants.length}</h3>
                  <p className="text-sm text-indigo-600">Total Applicants</p>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-bold text-green-800">
                    {applicants.filter(a => a.status === 'shortlisted' || a.status === 'hired').length}
                  </h3>
                  <p className="text-sm text-green-600">Shortlisted</p>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-yellow-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-bold text-yellow-800">
                    {applicants.filter(a => a.status === 'pending').length}
                  </h3>
                  <p className="text-sm text-yellow-600">Pending Review</p>
                </div>
              </div>
            </div>
            
            <div className="bg-red-50 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-bold text-red-800">
                    {applicants.filter(a => a.status === 'rejected').length}
                  </h3>
                  <p className="text-sm text-red-600">Rejected</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
        
        {/* Back to jobs */}
        <div className="mt-8 text-center">
          <Link
            href="/recruiter/recruiterDashboard"
            className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}