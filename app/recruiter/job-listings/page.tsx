'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { collection, getDocs, query, where, orderBy, limit, startAfter, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Header from '../../components/header';
import Link from 'next/link';
import { useAuth } from '@/app/lib/authContext';
import { doc, getDoc } from 'firebase/firestore';

type JobListing = {
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
  recruiterId: string;
  recruiterEmail: string;
  views: number;
};

export default function RecruiterJobListings() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<JobListing[]>([]);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    location: '',
    employmentType: '',
    experienceLevel: '',
    remote: '',
    visaSponsorship: false,
  });
  const [sortBy, setSortBy] = useState('newest');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('myJobs'); // 'myJobs' or 'allJobs'
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'applicant' | 'recruiter' | null>(null);
  
  // Use the AuthContext hook
  const { user, loading: authLoading } = useAuth();

  // Check authentication and set current user ID
  useEffect(() => {
    const checkAuth = async () => {
      if (!authLoading) {
        if (!user) {
          router.push('/signin');
          return;
        }
        
        try {
          // Get user role from Firestore
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUserRole(userData.role as 'applicant' | 'recruiter');
            
            // If user is not a recruiter, redirect to applicant dashboard
            if (userData.role !== 'recruiter') {
              router.push('/applicant/applicantDashboard');
              return;
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }
    };

    checkAuth();
  }, [user, authLoading, router]);

  // Only fetch jobs when we have a valid user and userRole is 'recruiter'
  useEffect(() => {
    if (user && userRole === 'recruiter') {
      console.log("Fetching jobs for user ID:", user.uid);
      fetchJobs();
    }
  }, [user, userRole, activeTab]);

  const fetchJobs = async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      let jobsQuery;
      
      if (activeTab === 'myJobs') {
        // Query for jobs posted by the current user
        console.log("Querying for jobs with recruiterId:", user.uid);
        jobsQuery = query(
          collection(db, "jobs"),
          where("recruiterId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(10)
        );
      } else {
        // Query for all active jobs
        jobsQuery = query(
          collection(db, "jobs"),
          where("status", "==", "active"),
          orderBy("createdAt", "desc"),
          limit(10)
        );
      }

      console.log("Executing query...");
      const querySnapshot = await getDocs(jobsQuery);
      console.log(`Query returned ${querySnapshot.docs.length} results`);
      
      const jobsList: JobListing[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log("Job data:", data);
        
        jobsList.push({
          id: doc.id,
          title: data.title || '',
          company: data.company || '',
          location: data.location || '',
          employmentType: data.employmentType || '',
          experienceLevel: data.experienceLevel || '',
          remote: data.remote || 'no',
          salary: data.salary || { min: '', max: '', currency: 'USD', period: 'yearly' },
          skills: data.skills || [],
          createdAt: data.createdAt,
          applicants: data.applicants || 0,
          visaSponsorship: data.visaSponsorship || false,
          status: data.status || 'active',
          recruiterId: data.recruiterId || '',
          recruiterEmail: data.recruiterEmail || '',
          views: data.views || 0,
        });
      });

      console.log("Processed jobs:", jobsList);
      setJobs(jobsList);
      setFilteredJobs(jobsList);
      
      if (querySnapshot.docs.length > 0) {
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
        setHasMore(querySnapshot.docs.length >= 10);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error fetching jobs:", error);
      setError("Error fetching jobs. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  // Load more jobs
  const handleLoadMore = async () => {
    if (!lastVisible || !hasMore || !user) return;
    
    setIsLoading(true);
    try {
      let jobsQuery;
      
      if (activeTab === 'myJobs') {
        jobsQuery = query(
          collection(db, "jobs"),
          where("recruiterId", "==", user.uid),
          orderBy("createdAt", "desc"),
          startAfter(lastVisible),
          limit(10)
        );
      } else {
        jobsQuery = query(
          collection(db, "jobs"),
          where("status", "==", "active"),
          orderBy("createdAt", "desc"),
          startAfter(lastVisible),
          limit(10)
        );
      }

      const querySnapshot = await getDocs(jobsQuery);
      const newJobs: JobListing[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        newJobs.push({
          id: doc.id,
          title: data.title || '',
          company: data.company || '',
          location: data.location || '',
          employmentType: data.employmentType || '',
          experienceLevel: data.experienceLevel || '',
          remote: data.remote || 'no',
          salary: data.salary || { min: '', max: '', currency: 'USD', period: 'yearly' },
          skills: data.skills || [],
          createdAt: data.createdAt,
          applicants: data.applicants || 0,
          visaSponsorship: data.visaSponsorship || false,
          status: data.status || 'active',
          recruiterId: data.recruiterId || '',
          recruiterEmail: data.recruiterEmail || '',
          views: data.views || 0,
        });
      });

      setJobs([...jobs, ...newJobs]);
      applyFiltersAndSort([...jobs, ...newJobs]);
      
      if (querySnapshot.docs.length > 0) {
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
        setHasMore(querySnapshot.docs.length >= 10);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error fetching more jobs:", error);
      setError("Error loading more jobs. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle tab change
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setJobs([]);
    setFilteredJobs([]);
    setLastVisible(null);
    setHasMore(true);
    setError(null);
  };

  // Apply filters and search
  const applyFiltersAndSort = (jobsToFilter = jobs) => {
    let filtered = [...jobsToFilter];
    
    // Apply search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(job => 
        job.title.toLowerCase().includes(search) || 
        job.company.toLowerCase().includes(search) || 
        job.location.toLowerCase().includes(search) ||
        (job.skills && job.skills.some(skill => skill.toLowerCase().includes(search)))
      );
    }
    
    // Apply filters
    if (filters.location) {
      filtered = filtered.filter(job => 
        job.location.toLowerCase().includes(filters.location.toLowerCase())
      );
    }
    
    if (filters.employmentType) {
      filtered = filtered.filter(job => 
        job.employmentType === filters.employmentType
      );
    }
    
    if (filters.experienceLevel) {
      filtered = filtered.filter(job => 
        job.experienceLevel === filters.experienceLevel
      );
    }
    
    if (filters.remote) {
      filtered = filtered.filter(job => 
        job.remote === filters.remote
      );
    }
    
    if (filters.visaSponsorship) {
      filtered = filtered.filter(job => 
        job.visaSponsorship === true
      );
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
    } else if (sortBy === 'a-z') {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'z-a') {
      filtered.sort((a, b) => b.title.localeCompare(a.title));
    } else if (sortBy === 'most-views') {
      filtered.sort((a, b) => (b.views || 0) - (a.views || 0));
    } else if (sortBy === 'most-applicants') {
      filtered.sort((a, b) => (b.applicants || 0) - (a.applicants || 0));
    }
    
    setFilteredJobs(filtered);
  };

  // Handle search and filter changes
  useEffect(() => {
    applyFiltersAndSort();
  }, [searchTerm, filters, sortBy]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFilters(prev => ({
        ...prev,
        [name]: checked
      }));
    } else {
      setFilters(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setFilters({
      location: '',
      employmentType: '',
      experienceLevel: '',
      remote: '',
      visaSponsorship: false,
    });
    setSortBy('newest');
  };

  const refreshJobs = () => {
    setJobs([]);
    setFilteredJobs([]);
    setLastVisible(null);
    setHasMore(true);
    fetchJobs();
  };

  const formatSalary = (job: JobListing) => {
    if (!job.salary || (!job.salary.min && !job.salary.max)) return 'Not specified';
    
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

  // Show loading state while checking authentication or fetching user role
  if (authLoading || (user && !userRole)) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Header userRole={userRole} isLoggedIn={!!user} />
      
      {/* Hero section */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white pt-10 pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl font-bold mb-2">
              Manage Your Job Listings
            </h1>
            <p className="text-indigo-100">
              Track applications, update listings, and find the perfect candidates
            </p>
            {user && (
              <p className="text-indigo-200 text-sm mt-2">
                Logged in as: {user.email}
              </p>
            )}
          </motion.div>
        </div>
      </div>
      
      <div className="container mx-auto max-w-6xl px-4 -mt-8 pb-16">
        {/* Debug info */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            <p>{error}</p>
          </div>
        )}
        
        {/* Tabs */}
        <motion.div 
          className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => handleTabChange('myJobs')}
              className={`flex-1 py-4 px-4 text-center font-medium text-sm ${
                activeTab === 'myJobs'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              My Job Listings
            </button>
            <button
              onClick={() => handleTabChange('allJobs')}
              className={`flex-1 py-4 px-4 text-center font-medium text-sm ${
                activeTab === 'allJobs'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              All Job Listings
            </button>
          </div>
        </motion.div>
        
        {/* Search and Filter Bar */}
        <motion.div 
          className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search jobs, companies, or skills..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center"
                >
                  <svg className="h-5 w-5 mr-2 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                  </svg>
                  Filters
                </button>
                
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="a-z">A-Z</option>
                  <option value="z-a">Z-A</option>
                  <option value="most-views">Most views</option>
                  <option value="most-applicants">Most applicants</option>
                </select>
                
                <button
                  onClick={refreshJobs}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center"
                >
                  <svg className="h-5 w-5 mr-2 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                  Refresh
                </button>
              </div>
            </div>
            
            {isFilterOpen && (
              <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    id="location"
                    name="location"
                    value={filters.location}
                    onChange={handleFilterChange}
                    placeholder="Any location"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  />
                </div>
                
                <div>
                  <label htmlFor="employmentType" className="block text-sm font-medium text-gray-700 mb-1">
                    Employment Type
                  </label>
                  <select
                    id="employmentType"
                    name="employmentType"
                    value={filters.employmentType}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  >
                    <option value="">Any type</option>
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Temporary">Temporary</option>
                    <option value="Internship">Internship</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="experienceLevel" className="block text-sm font-medium text-gray-700 mb-1">
                    Experience Level
                  </label>
                  <select
                    id="experienceLevel"
                    name="experienceLevel"
                    value={filters.experienceLevel}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  >
                    <option value="">Any level</option>
                    <option value="Entry level">Entry level</option>
                    <option value="Mid level">Mid level</option>
                    <option value="Senior level">Senior level</option>
                    <option value="Executive">Executive</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="remote" className="block text-sm font-medium text-gray-700 mb-1">
                    Remote Work
                  </label>
                  <select
                    id="remote"
                    name="remote"
                    value={filters.remote}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  >
                    <option value="">Any</option>
                    <option value="fully">Fully remote</option>
                    <option value="hybrid">Hybrid remote</option>
                    <option value="no">On-site</option>
                  </select>
                </div>
                
                <div className="flex items-end">
                  <div className="flex items-center h-5 mb-2">
                    <input
                      id="visaSponsorship"
                      name="visaSponsorship"
                      type="checkbox"
                      checked={filters.visaSponsorship}
                      onChange={handleFilterChange}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mr-2"
                    />
                    <label htmlFor="visaSponsorship" className="font-medium text-gray-700 text-sm">
                      Visa Sponsorship
                    </label>
                  </div>
                  
                  <button
                    onClick={resetFilters}
                    className="ml-auto text-sm text-indigo-600 hover:text-indigo-500"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
        
        {/* Results count and action buttons */}
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-500">
            {filteredJobs.length} {filteredJobs.length === 1 ? 'job' : 'jobs'} found
            {activeTab === 'myJobs' && ' posted by you'}
          </p>
          
          <Link 
            href="/recruiter/post-job" 
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Post New Job
          </Link>
        </div>
        
        {/* Job listings */}
        <div className="space-y-4">
          {isLoading && jobs.length === 0 ? (
            <div className="flex justify-center py-12">
              <svg className="animate-spin h-12 w-12 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : filteredJobs.length === 0 && !isLoading ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="mt-2 text-lg font-medium text-gray-900">No jobs found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {activeTab === 'myJobs' 
                  ? "You haven't posted any jobs yet, or try adjusting your search criteria."
                  : "Try adjusting your search or filter criteria."}
              </p>
              <div className="mt-6 flex justify-center gap-4">
                {activeTab === 'myJobs' && (
                  <Link
                    href="/recruiter/post-job"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Post Your First Job
                  </Link>
                )}
                <button
                  onClick={resetFilters}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Clear Filters
                  </button>
              </div>
            </div>
          ) : (
            <>
              {filteredJobs.map((job) => (
                <motion.div
                  key={job.id}
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
                            <Link 
                              href={`/recruiter/jobs/${job.id}`} 
                              className="text-xl font-semibold text-gray-900 hover:text-indigo-600"
                            >
                              {job.title}
                            </Link>
                            <div className="text-sm text-gray-500">{job.company}</div>
                            {job.recruiterId === user?.uid && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-1">
                                Posted by you
                              </span>
                            )}
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
                        </div>
                        
                        <div className="mt-4 flex flex-wrap gap-1">
                          {job.skills && job.skills.slice(0, 5).map((skill, index) => (
                            <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                              {skill}
                            </span>
                          ))}
                          {job.skills && job.skills.length > 5 && (
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
                          {job.views || 0} view{job.views !== 1 ? 's' : ''} • {job.applicants || 0} applicant{job.applicants !== 1 ? 's' : ''}
                        </div>
                        <div className="mt-4 flex gap-2">
                          <Link
                            href={`/recruiter/jobs/${job.id}`}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            {job.recruiterId === user?.uid ? 'View Applicants' : 'View Details'}
                          </Link>
                          {job.recruiterId === user?.uid && (
                            <Link
                              href={`/recruiter/jobs/${job.id}/edit`}
                              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                              Edit
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              
              {hasMore && (
                <div className="flex justify-center pt-6">
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoading}
                    className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center"
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Loading...
                      </>
                    ) : (
                      <>
                        Load More Jobs
                        <svg className="ml-1 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}