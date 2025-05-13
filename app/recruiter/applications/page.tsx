'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { auth, db } from '@/app/lib/firebase';
import Header from '@/app/components/header';
import Link from 'next/link';

// Application interface
interface Application {
  id: string;
  applicantId: string;
  applicantName?: string;
  applicantEmail?: string;
  jobId: string;
  jobTitle?: string;
  jobCompany?: string;
  status: string;
  createdAt: any; // Firebase timestamp
  lastUpdated?: any;
  resumeSubmitted?: boolean;
  resumeAnalysis?: {
    overallScore?: number;
    matchLevel?: string;
  };
  interviewScheduled?: boolean;
  interviewDate?: any;
  [key: string]: any; // For additional properties
}

// Job interface
interface Job {
  id: string;
  title: string;
  company: string;
  department?: string;
  location: string;
  status: string;
  createdAt: any;
  lastUpdated?: any;
  applications?: Application[];
  [key: string]: any; // For additional properties
}

// Interface for filter options
interface FilterOptions {
  status: string;
  dateRange: string;
  sortBy: string;
  jobId: string;
}

export default function Applications() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [allApplications, setAllApplications] = useState<Application[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    dateRange: 'all',
    sortBy: 'newest',
    jobId: 'all',
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Status options for the filter and display
  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'reviewed', label: 'Reviewed', color: 'bg-blue-100 text-blue-800' },
    { value: 'shortlisted', label: 'Shortlisted', color: 'bg-green-100 text-green-800' },
    { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-800' },
    { value: 'hired', label: 'Hired', color: 'bg-purple-100 text-purple-800' }
  ];

  // Date range options for the filter
  const dateRangeOptions = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'year', label: 'This Year' }
  ];

  // Sort options
  const sortOptions = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'name_asc', label: 'Name (A-Z)' },
    { value: 'name_desc', label: 'Name (Z-A)' },
    { value: 'score_desc', label: 'Match Score (High-Low)' },
    { value: 'score_asc', label: 'Match Score (Low-High)' }
  ];

  useEffect(() => {
    const fetchJobsAndApplications = async (userId: string) => {
      try {
        setIsLoading(true);
        
        // First fetch all jobs associated with this recruiter
        const jobsQuery = query(
          collection(db, "jobs"),
          where("recruiterId", "==", userId),
          orderBy("createdAt", "desc")
        );
        
        const jobsSnapshot = await getDocs(jobsQuery);
        
        if (jobsSnapshot.empty) {
          setJobs([]);
          setAllApplications([]);
          setIsLoading(false);
          return;
        }
        
        // Create job objects from snapshot
        const jobsData: Job[] = jobsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          applications: []
        } as Job));
        
        // Now fetch all applications for all these jobs
        const applicationsPromises = jobsData.map(job => {
          const applicationsQuery = query(
            collection(db, "applications"),
            where("jobId", "==", job.id),
            orderBy("createdAt", "desc")
          );
          
          return getDocs(applicationsQuery);
        });
        
        const applicationsSnapshots = await Promise.all(applicationsPromises);
        
        // Process each application and attach them to the corresponding job
        const allApps: Application[] = [];
        
        applicationsSnapshots.forEach((snapshot, index) => {
          const jobId = jobsData[index].id;
          const jobTitle = jobsData[index].title;
          const jobCompany = jobsData[index].company;
          
          const applications: Application[] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            jobTitle,
            jobCompany
          } as Application));
          
          // Add applications to the job
          jobsData[index].applications = applications;
          
          // Add to the flat list of all applications
          allApps.push(...applications);
        });
        
        setJobs(jobsData);
        setAllApplications(allApps);
      } catch (error) {
        console.error('Error fetching jobs and applications:', error);
        setError('Failed to load jobs and applications. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    
    // Set up authentication state listener
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchJobsAndApplications(user.uid);
      } else {
        setError('You must be logged in to view applications');
        setIsLoading(false);
        // Redirect to login
        setTimeout(() => {
          router.push('/signin');
        }, 2000);
      }
    });
    
    // Cleanup subscription
    return () => unsubscribe();
  }, [router]);

  // Function to filter applications based on current filters
  const filteredApplications = allApplications.filter(app => {
    // Filter by status
    if (filters.status !== 'all' && app.status !== filters.status) {
      return false;
    }
    
    // Filter by job
    if (filters.jobId !== 'all' && app.jobId !== filters.jobId) {
      return false;
    }
    
    // Filter by date range
    if (filters.dateRange !== 'all') {
      const appDate = app.createdAt?.toDate?.() || new Date(app.createdAt);
      const now = new Date();
      
      switch (filters.dateRange) {
        case 'today':
          if (appDate.toDateString() !== now.toDateString()) {
            return false;
          }
          break;
        case 'week':
          const weekAgo = new Date();
          weekAgo.setDate(now.getDate() - 7);
          if (appDate < weekAgo) {
            return false;
          }
          break;
        case 'month':
          const monthAgo = new Date();
          monthAgo.setMonth(now.getMonth() - 1);
          if (appDate < monthAgo) {
            return false;
          }
          break;
        case 'year':
          const yearAgo = new Date();
          yearAgo.setFullYear(now.getFullYear() - 1);
          if (appDate < yearAgo) {
            return false;
          }
          break;
      }
    }
    
    // Filter by search term (search in name and email)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const nameMatch = app.applicantName?.toLowerCase().includes(term) || false;
      const emailMatch = app.applicantEmail?.toLowerCase().includes(term) || false;
      const jobTitleMatch = app.jobTitle?.toLowerCase().includes(term) || false;
      
      if (!(nameMatch || emailMatch || jobTitleMatch)) {
        return false;
      }
    }
    
    return true;
  });

  // Function to sort the filtered applications
  const sortedApplications = [...filteredApplications].sort((a, b) => {
    switch (filters.sortBy) {
      case 'newest':
        return new Date(b.createdAt?.toDate?.() || b.createdAt).getTime() - 
               new Date(a.createdAt?.toDate?.() || a.createdAt).getTime();
      case 'oldest':
        return new Date(a.createdAt?.toDate?.() || a.createdAt).getTime() - 
               new Date(b.createdAt?.toDate?.() || b.createdAt).getTime();
      case 'name_asc':
        return (a.applicantName || '').localeCompare(b.applicantName || '');
      case 'name_desc':
        return (b.applicantName || '').localeCompare(a.applicantName || '');
      case 'score_desc':
        return (b.resumeAnalysis?.overallScore || 0) - (a.resumeAnalysis?.overallScore || 0);
      case 'score_asc':
        return (a.resumeAnalysis?.overallScore || 0) - (b.resumeAnalysis?.overallScore || 0);
      default:
        return 0;
    }
  });

  // Function to format date from firebase timestamp
  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'Unknown date';
    
    let date: Date;
    if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else if (timestamp.toDate) {
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
      month: 'short', 
      day: 'numeric'
    });
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
          <p className="mt-4 text-gray-600">Loading applications...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center">
        <Header userRole="recruiter" isLoggedIn={true} />
        <div className="py-24 text-center">
          <svg className="mx-auto h-12 w-12 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Error Loading Applications</h3>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
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
      
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 pt-16">
        <div className="container mx-auto max-w-7xl px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">All Applications</h1>
              <p className="mt-1 text-sm text-gray-500">View and manage all candidate applications across your jobs</p>
            </div>
            <div>
              <Link
                href="/recruiter/jobs"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                View Jobs
              </Link>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto max-w-7xl px-4 py-8">
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Search */}
              <div>
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                  Search
                </label>
                <input
                  type="text"
                  id="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name or email"
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                />
              </div>
              
              {/* Job Filter */}
              <div>
                <label htmlFor="job-filter" className="block text-sm font-medium text-gray-700 mb-1">
                  Job
                </label>
                <select
                  id="job-filter"
                  value={filters.jobId}
                  onChange={(e) => setFilters({ ...filters, jobId: e.target.value })}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                  <option value="all">All Jobs</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title} at {job.company}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Status Filter */}
              <div>
                <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  id="status-filter"
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Date Range Filter */}
              <div>
                <label htmlFor="date-filter" className="block text-sm font-medium text-gray-700 mb-1">
                  Date Range
                </label>
                <select
                  id="date-filter"
                  value={filters.dateRange}
                  onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                  {dateRangeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Sort By */}
              <div>
                <label htmlFor="sort-by" className="block text-sm font-medium text-gray-700 mb-1">
                  Sort By
                </label>
                <select
                  id="sort-by"
                  value={filters.sortBy}
                  onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Reset Filters Button */}
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setFilters({
                      status: 'all',
                      dateRange: 'all',
                      sortBy: 'newest',
                      jobId: 'all',
                    });
                    setSearchTerm('');
                  }}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Reset Filters
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Applications List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Applications ({sortedApplications.length})
              </h2>
              
              {/* Export Button (Not implemented) */}
              <button
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <svg className="mr-2 -ml-1 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Export CSV
              </button>
            </div>
            
            {sortedApplications.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No applications found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Try adjusting your filters to find more applications.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Applicant
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Job
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Applied Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Match Score
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedApplications.map((application, index) => (
                      <motion.tr 
                        key={application.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
                        className="hover:bg-gray-50"
                      >
                        {/* Applicant */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                              {application.applicantName?.charAt(0).toUpperCase() || 'A'}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {application.applicantName || 'Anonymous Applicant'}
                              </div>
                              <div className="text-sm text-gray-500">
                                {application.applicantEmail || 'No email provided'}
                              </div>
                            </div>
                          </div>
                        </td>
                        
                        {/* Job */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{application.jobTitle || 'Unknown Job'}</div>
                          <div className="text-sm text-gray-500">{application.jobCompany || 'Unknown Company'}</div>
                        </td>
                        
                        {/* Date */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(application.createdAt)}
                        </td>
                        
                        {/* Status */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            statusOptions.find(option => option.value === application.status)?.color || 'bg-gray-100 text-gray-800'
                          }`}>
                            {application.status?.charAt(0).toUpperCase() + application.status?.slice(1) || 'Unknown'}
                          </span>
                        </td>
                        
                        {/* Match Score */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {application.resumeAnalysis?.overallScore ? (
                            <div className="flex items-center">
                              <span className={`text-sm font-medium ${
                                application.resumeAnalysis.overallScore >= 85 ? 'text-green-600' :
                                application.resumeAnalysis.overallScore >= 70 ? 'text-blue-600' :
                                application.resumeAnalysis.overallScore >= 50 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {application.resumeAnalysis.overallScore}%
                              </span>
                              <span className="ml-2 text-xs text-gray-500">
                                {application.resumeAnalysis.matchLevel}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500">Not analyzed</span>
                          )}
                        </td>
                        
                        {/* Actions */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Link
                            href={`/recruiter/application/${application.id}`}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            View
                          </Link>
                          <Link
                            href={`/recruiter/job/${application.jobId}`}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            Job Details
                          </Link>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        
        {/* Job Applications Summary */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {jobs.map((job) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
            >
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{job.title}</h3>
                <p className="text-sm text-gray-500 mb-4">{job.company}</p>
                
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-gray-400 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1a1 1 0h-1.5v-1a5 5 0 00-5-5H8a5 5 0 00-5 5v1H1a1 1 0 000 2h18a1 1 0 100-2h-1zM3 16v-1a3 3 0 013-3h4a3 3 0 013 3v1H3z" />
                    </svg>
                    <span className="text-sm font-medium">
                      {job.applications?.length || 0} Applicants
                    </span>
                  </div>
                  
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-gray-400 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-gray-500">
                      Posted on {formatDate(job.createdAt)}
                    </span>
                  </div>
                </div>
                
                {/* Application Status Summary */}
                <div className="space-y-2 mb-6">
                  <h4 className="text-sm font-medium text-gray-700">Application Statuses</h4>
                  
                  <div className="bg-gray-100 rounded-lg p-3">
                    <div className="grid grid-cols-5 gap-2">
                      {/* Pending */}
                      <div className="text-center">
                        <div className="text-lg font-bold text-yellow-800">
                          {job.applications?.filter(app => app.status === 'pending').length || 0}
                        </div>
                        <div className="text-xs text-gray-500">Pending</div>
                      </div>
                      
                      {/* Reviewed */}
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-800">
                          {job.applications?.filter(app => app.status === 'reviewed').length || 0}
                        </div>
                        <div className="text-xs text-gray-500">Reviewed</div>
                      </div>
                      
                      {/* Shortlisted */}
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-800">
                          {job.applications?.filter(app => app.status === 'shortlisted').length || 0}
                        </div>
                        <div className="text-xs text-gray-500">Shortlisted</div>
                      </div>
                      
                      {/* Rejected */}
                      <div className="text-center">
                        <div className="text-lg font-bold text-red-800">
                          {job.applications?.filter(app => app.status === 'rejected').length || 0}
                        </div>
                        <div className="text-xs text-gray-500">Rejected</div>
                      </div>
                      
                      {/* Hired */}
                      <div className="text-center">
                        <div className="text-lg font-bold text-purple-800">
                          {job.applications?.filter(app => app.status === 'hired').length || 0}
                        </div>
                        <div className="text-xs text-gray-500">Hired</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Recent Applicants (Top 3) */}
                {job.applications && job.applications.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Applicants</h4>
                    <ul className="space-y-3">
                      {job.applications.slice(0, 3).map((app) => (
                        <li key={app.id} className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                              {app.applicantName?.charAt(0).toUpperCase() || 'A'}
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-gray-900">
                                {app.applicantName || 'Anonymous Applicant'}
                              </p>
                              <p className="text-xs text-gray-500">
                                Applied {formatDate(app.createdAt)}
                              </p>
                            </div>
                          </div>
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            statusOptions.find(option => option.value === app.status)?.color || 'bg-gray-100 text-gray-800'
                          }`}>
                            {app.status?.charAt(0).toUpperCase() + app.status?.slice(1) || 'Unknown'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <Link
                    href={`/recruiter/job/${job.id}#applications`}
                    className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    View All Applicants
                  </Link>
                  
                  <Link
                    href={`/recruiter/job/${job.id}`}
                    className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Job Details
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}