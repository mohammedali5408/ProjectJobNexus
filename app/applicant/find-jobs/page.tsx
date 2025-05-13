'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, getDocs, query, where, orderBy, limit, startAfter, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Header from '../../components/header';
import Link from 'next/link';
import ResumeEnhancer from '@/app/components/resumeEnhancer';
import { useAuth } from '@/app/lib/authContext';

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
  description: string;
};

export default function FindJobs() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<JobListing[]>([]);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [userRole, setUserRole] = useState<'applicant' | 'recruiter'>('applicant');
  const [filters, setFilters] = useState({
    location: '',
    employmentType: '',
    experienceLevel: '',
    remote: '',
    visaSponsorship: false,
    minSalary: '',
    maxSalary: '',
    skills: [] as string[],
  });
  const [currentSkill, setCurrentSkill] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSkillsOpen, setIsSkillsOpen] = useState(false);
  const [showAIRecommendations, setShowAIRecommendations] = useState(false);
  const [aiJobs, setAiJobs] = useState<JobListing[]>([]);
  
  // Resume enhancement states
  const [showResumeEnhancer, setShowResumeEnhancer] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [notification, setNotification] = useState({ type: '', message: '' });
  
  // Use the auth context hook
  const { user, loading: authLoading } = useAuth();

  // Fetch jobs
  const fetchJobs = useCallback(async () => {
    // Only fetch if authentication state is loaded
    if (authLoading) return;
    
    // If no user is authenticated, redirect to sign in
    if (!user) {
      router.push('/signin');
      return;
    }
    
    setIsLoading(true);
    try {
      // Determine user role from the user document in Firestore
      const userDoc = await getDocs(
        query(collection(db, "users"), where("userId", "==", user.uid))
      );
      
      let role = 'applicant';
      if (!userDoc.empty) {
        role = userDoc.docs[0].data().role || 'applicant';
      }
      setUserRole(role as 'applicant' | 'recruiter');

      const jobsQuery = query(
        collection(db, "jobs"),
        where("status", "==", "active"),
        orderBy("createdAt", "desc"),
        limit(10)
      );

      const querySnapshot = await getDocs(jobsQuery);
      const jobsList: JobListing[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
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
          description: data.description || '',
        });
      });

      setJobs(jobsList);
      setFilteredJobs(jobsList);
      
      // Generate AI recommendations (in a real app this would use ML, here we just simulate it)
      if (role === 'applicant') {
        const recommendedJobs = jobsList
          .slice(0, Math.min(3, jobsList.length))
          .map(job => ({...job, aiMatchScore: Math.floor(Math.random() * (30) + 70)}));
        setAiJobs(recommendedJobs);
      }
      
      if (querySnapshot.docs.length > 0) {
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error fetching jobs:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Load more jobs
  const handleLoadMore = async () => {
    if (!lastVisible || !hasMore || !user) return;
    
    setIsLoading(true);
    try {
      const jobsQuery = query(
        collection(db, "jobs"),
        where("status", "==", "active"),
        orderBy("createdAt", "desc"),
        startAfter(lastVisible),
        limit(10)
      );

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
          description: data.description || '',
        });
      });

      setJobs(prevJobs => [...prevJobs, ...newJobs]);
      applyFiltersAndSort([...jobs, ...newJobs]);
      
      if (querySnapshot.docs.length > 0) {
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error fetching more jobs:", error);
    } finally {
      setIsLoading(false);
    }
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
        job.description.toLowerCase().includes(search) ||
        job.skills.some(skill => skill.toLowerCase().includes(search))
      );
    }
    
    // Apply location filter
    if (filters.location) {
      filtered = filtered.filter(job => 
        job.location.toLowerCase().includes(filters.location.toLowerCase())
      );
    }
    
    // Apply employment type filter
    if (filters.employmentType) {
      filtered = filtered.filter(job => 
        job.employmentType === filters.employmentType
      );
    }
    
    // Apply experience level filter
    if (filters.experienceLevel) {
      filtered = filtered.filter(job => 
        job.experienceLevel === filters.experienceLevel
      );
    }
    
    // Apply remote filter
    if (filters.remote) {
      filtered = filtered.filter(job => 
        job.remote === filters.remote
      );
    }
    
    // Apply visa sponsorship filter
    if (filters.visaSponsorship) {
      filtered = filtered.filter(job => 
        job.visaSponsorship === true
      );
    }
    
    // Apply salary filters
    if (filters.minSalary) {
      filtered = filtered.filter(job => {
        const min = parseInt(job.salary.min);
        return !isNaN(min) && min >= parseInt(filters.minSalary);
      });
    }
    
    if (filters.maxSalary) {
      filtered = filtered.filter(job => {
        const max = parseInt(job.salary.max);
        return !isNaN(max) && max <= parseInt(filters.maxSalary);
      });
    }
    
    // Apply skills filter
    if (filters.skills.length > 0) {
      filtered = filtered.filter(job => 
        filters.skills.every(skill => 
          job.skills.some(jobSkill => 
            jobSkill.toLowerCase().includes(skill.toLowerCase())
          )
        )
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
    } else if (sortBy === 'salary-high') {
      filtered.sort((a, b) => {
        const aMax = parseInt(a.salary.max) || parseInt(a.salary.min) || 0;
        const bMax = parseInt(b.salary.max) || parseInt(b.salary.min) || 0;
        return bMax - aMax;
      });
    } else if (sortBy === 'salary-low') {
      filtered.sort((a, b) => {
        const aMin = parseInt(a.salary.min) || parseInt(a.salary.max) || 0;
        const bMin = parseInt(b.salary.min) || parseInt(b.salary.max) || 0;
        return aMin - bMin;
      });
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

  const handleAddSkill = () => {
    if (currentSkill.trim() && !filters.skills.includes(currentSkill.trim())) {
      setFilters(prev => ({
        ...prev,
        skills: [...prev.skills, currentSkill.trim()]
      }));
      setCurrentSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setFilters(prev => ({
      ...prev,
      skills: prev.skills.filter(skill => skill !== skillToRemove)
    }));
  };

  const resetFilters = () => {
    setSearchTerm('');
    setFilters({
      location: '',
      employmentType: '',
      experienceLevel: '',
      remote: '',
      visaSponsorship: false,
      minSalary: '',
      maxSalary: '',
      skills: [],
    });
    setSortBy('newest');
  };

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

  // Resume enhancement handlers
  const handleEnhanceResume = (jobId: string) => {
    setSelectedJobId(jobId);
    setShowResumeEnhancer(true);
  };

  const handleEnhanceComplete = (resumeId: string) => {
    setShowResumeEnhancer(false);
    
    // Show success notification
    setNotification({
      type: 'success',
      message: 'Your resume has been enhanced and saved to your profile!'
    });
    
    // Clear notification after 5 seconds
    setTimeout(() => {
      setNotification({ type: '', message: '' });
    }, 5000);
  };

  // Show loading while auth is checking
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Header userRole={userRole} isLoggedIn={!!user} />
      
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
      
      {/* Hero section */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl font-bold mb-4">
              {userRole === 'applicant' ? 'Find Your Dream Job' : 'Browse Job Listings'}
            </h1>
            <p className="text-indigo-100 text-xl max-w-2xl">
              {userRole === 'applicant' 
                ? 'Discover opportunities matched to your skills and experience with our AI-powered job search' 
                : 'Browse all active job listings on the platform to see market trends'}
            </p>
          </motion.div>
        </div>
      </div>
      
      <div className="container mx-auto max-w-6xl px-4 -mt-8 pb-16">
        {/* Search and Filter Bar */}
        <motion.div 
          className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
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
                  placeholder="Search jobs, companies, skills, or keywords..."
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
                  <option value="a-z">Title A-Z</option>
                  <option value="z-a">Title Z-A</option>
                  <option value="salary-high">Highest salary</option>
                  <option value="salary-low">Lowest salary</option>
                </select>
              </div>
            </div>
            
            {isFilterOpen && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
                  
                  <div>
                    <label htmlFor="minSalary" className="block text-sm font-medium text-gray-700 mb-1">
                      Minimum Salary
                    </label>
                    <input
                      type="number"
                      id="minSalary"
                      name="minSalary"
                      value={filters.minSalary}
                      onChange={handleFilterChange}
                      placeholder="Minimum yearly salary"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="maxSalary" className="block text-sm font-medium text-gray-700 mb-1">
                      Maximum Salary
                    </label>
                    <input
                      type="number"
                      id="maxSalary"
                      name="maxSalary"
                      value={filters.maxSalary}
                      onChange={handleFilterChange}
                      placeholder="Maximum yearly salary"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    />
                  </div>
                </div>
                
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Required Skills
                    </label>
                    <button 
                      type="button" 
                      onClick={() => setIsSkillsOpen(!isSkillsOpen)}
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      {isSkillsOpen ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  
                  {isSkillsOpen && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2 mb-2">
                        {filters.skills.map((skill) => (
                          <span 
                            key={skill} 
                            className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-indigo-100 text-indigo-800"
                          >
                            {skill}
                            <button
                              type="button"
                              onClick={() => handleRemoveSkill(skill)}
                              className="ml-1.5 inline-flex text-indigo-600 hover:text-indigo-800 focus:outline-none"
                            >
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex">
                        <input
                          type="text"
                          value={currentSkill}
                          onChange={(e) => setCurrentSkill(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleAddSkill()}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                          placeholder="Add a required skill (e.g. React, Python)"
                        />
                        <button
                          type="button"
                          onClick={handleAddSkill}
                          className="px-3 py-2 bg-indigo-600 text-white rounded-r-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 text-sm"
                        >
                          Add
                        </button>
                      </div>
                      <p className="text-xs text-gray-500">
                        Jobs must include all of the skills you add here
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center mb-2">
                  <input
                    id="visaSponsorship"
                    name="visaSponsorship"
                    type="checkbox"
                    checked={filters.visaSponsorship}
                    onChange={handleFilterChange}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mr-2"
                  />
                  <label htmlFor="visaSponsorship" className="font-medium text-gray-700 text-sm">
                    Visa Sponsorship Available
                  </label>
                </div>
                
                <div className="flex justify-end">
                  <button
                    onClick={resetFilters}
                    className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    Reset All Filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
        
        {/* AI Recommendations for job seekers */}
        {userRole === 'applicant' && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-indigo-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
                AI-Powered Job Recommendations
              </h2>
              <button 
                onClick={() => setShowAIRecommendations(!showAIRecommendations)}
                className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center"
              >
                {showAIRecommendations ? 'Hide' : 'Show'} recommendations
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ml-1 transition-transform ${showAIRecommendations ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            
            <AnimatePresence>
              {showAIRecommendations && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    {aiJobs.map((job) => (
                      <motion.div
                        key={job.id}
                        className="bg-gradient-to-r from-indigo-50 to-violet-50 rounded-xl shadow-sm border border-indigo-100 overflow-hidden"
                        whileHover={{ y: -4, transition: { duration: 0.2 } }}
                      >
                        <div className="p-5">
                          <div className="flex items-center mb-3">
                            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-lg">
                              {job.company.charAt(0)}
                            </div>
                            <div className="ml-3">
                              <div className="text-xs text-indigo-600 font-semibold">{job.company}</div>
                              <div className="text-base font-semibold text-gray-900">{job.title}</div>
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center text-sm text-gray-500">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {job.location}
                            </div>
                            <div className="flex items-center">
                              <div className="bg-indigo-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                </svg>
                                {(job as any).aiMatchScore || '85'}% Match
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-1 mb-3">
                            {job.skills.slice(0, 3).map((skill, index) => (
                              <span key={index} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                                {skill}
                              </span>
                            ))}
                            {job.skills.length > 3 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                +{job.skills.length - 3} more
                              </span>
                            )}
                          </div>
                          
                          <div className="text-sm text-gray-700 mb-3">
                            {job.description.length > 100 
                              ? job.description.substring(0, 100) + '...' 
                              : job.description}
                          </div>
                          
                          <div className="pt-3 border-t border-indigo-100 flex justify-between items-center">
                            <div className="text-sm font-medium text-gray-900">
                              {formatSalary(job)}
                            </div>
                            <div className="flex gap-2">
                              <Link
                                href={`/applicant/jobs/${job.id}`}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                              >
                                View Job
                              </Link>
                              <button
                                onClick={() => handleEnhanceResume(job.id)}
                                className="inline-flex items-center px-3 py-1.5 border border-indigo-300 text-xs font-medium rounded shadow-sm text-indigo-700 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                              >
                                <svg className="mr-1 h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                </svg>
                                Enhance
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        
        {/* Results count */}
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-500">
            {filteredJobs.length} {filteredJobs.length === 1 ? 'job' : 'jobs'} found
          </p>
          
          {userRole === 'recruiter' && (
            <Link 
              href="/recruiter/post-job" 
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Post New Job
            </Link>
          )}
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
          ) : filteredJobs.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="mt-2 text-lg font-medium text-gray-900">No jobs found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Try adjusting your search or filter criteria.
              </p>
              <div className="mt-6">
                <button
                  onClick={resetFilters}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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
                              onClick={() => handleEnhanceResume(job.id)}
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
      
      {/* Resume enhancer modal */}
      {showResumeEnhancer && selectedJobId && (
        <ResumeEnhancer 
          jobId={selectedJobId} 
          onClose={() => setShowResumeEnhancer(false)}
          onEnhanceComplete={handleEnhanceComplete}
        />
      )}
    </div>
  );
}