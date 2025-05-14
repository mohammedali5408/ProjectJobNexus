'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuth } from '@/app/lib/authContext';
import { useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,  LineChart, Line } from 'recharts';

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5 }
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};
// 1. Add proper interface for userData state
interface UserData {
  name?: string;
  role?: string;
  email?: string;
  photoURL?: string;
  [key: string]: unknown;// For any additional properties
}

// 2. Define interface for job items
interface Job {
  id: string;
  position: string;
  applications: number;
  status: string;
  posted: Date;
  views: number;
  formattedDate: string;
}

// 3. Define interface for candidate items
interface Candidate {
  id: string;
  name: string;
  position: string;
  match: string;
  status: string;
  avatarColor: string;
}

// 4. Define interface for application items
interface Application {
  id: string;
  applicantId?: string;
  applicantName?: string;
  jobTitle?: string;
  status?: string;
  [key: string]: unknown; // For any additional fields
}

// 5. Define interface for stats
interface Stats {
  activeJobs: number;
  totalApplications: number;
  interviewsScheduled: number;
  newCandidates: number;
}

// 6. Define interfaces for chart data
interface ChartDataItem {
  name: string;
  applications?: number;
  days?: number;
  value?: number;
}



export default function RecruiterDashboard() {
  const [activeTab, setActiveTab] = useState('jobs');
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [stats, setStats] = useState<Stats>({
    activeJobs: 0,
    totalApplications: 0,
    interviewsScheduled: 0,
    newCandidates: 0
  });
  const [applicationsByPosition, setApplicationsByPosition] = useState<ChartDataItem[]>([]);
  const [timeToFill, setTimeToFill] = useState<ChartDataItem[]>([]);
  const [hiringFunnel, setHiringFunnel] = useState<ChartDataItem[]>([]);
  // Error handling
  const [error, setError] = useState("");

  // Helper function to calculate match score
  // Change this function to actually use the parameters
const calculateMatchScore = (applicantId: string, position: string): string => {
  // Generate deterministic score based on applicantId and position
  const seed = (applicantId.length + position.length) % 10;
  return `${Math.floor(Math.random() * 15) + 75 + seed}%`;
};
  
  // Helper function to get a random color
  const getRandomColor = () => {
    const colors = [
      'bg-emerald-500', 'bg-sky-500', 'bg-violet-500', 
      'bg-amber-500', 'bg-pink-500', 'bg-blue-500', 
      'bg-indigo-500', 'bg-red-500', 'bg-green-500'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };
  
  // Format date for display
  interface FirestoreTimestamp {
    seconds: number;
    nanoseconds?: number;
    toDate?: () => Date;
  }

  type FormatDateInput = FirestoreTimestamp | Date | { toDate: () => Date } | null | undefined;

  const formatDate = (timestamp: FormatDateInput): string => {
    if (!timestamp) return 'Unknown date';

    let date: Date;
    if ((timestamp as FirestoreTimestamp).seconds) {
      date = new Date((timestamp as FirestoreTimestamp).seconds * 1000);
    } else if ((timestamp as { toDate: () => Date }).toDate) {
      date = (timestamp as { toDate: () => Date }).toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      return 'Invalid date';
    }

    // Format as YYYY-MM-DD
    return date.toISOString().split('T')[0];
  };

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    console.log('Fetching dashboard data');
    try {
      // Fetch jobs posted by this recruiter
      if (!user) {
        setError("User not found. Please sign in again.");
        setIsLoading(false);
        return;
      }
      const jobsQuery = query(
        collection(db, "jobs"),
        where("recruiterId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      
      console.log('Executing jobs query');
      const jobsSnapshot = await getDocs(jobsQuery);
      console.log('Jobs snapshot size:', jobsSnapshot.size);
      
      const jobsData: Job[] = [];
      const applicationsByPositionData: Record<string, number> = {};
      let totalApplications = 0;
      let activeJobs = 0;
      
      jobsSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('Job data:', data);
        
        const jobItem = {
          id: doc.id,
          position: data.title || 'Untitled Position',
          applications: data.applicants || data.applicants1 || 0,
          status: data.status || 'active',
          posted: data.createdAt ? new Date(data.createdAt.seconds * 1000) : new Date(),
          views: data.views || 0,
          formattedDate: formatDate(data.createdAt)
        };
        
        // Update stats
        totalApplications += (data.applicants || data.applicants1 || 0);
        if (data.status === 'active') {
          activeJobs++;
        }
        
        // Update applications by position data for chart
        applicationsByPositionData[data.title || 'Untitled Position'] = data.applicants || data.applicants1 || 0;
        
        jobsData.push(jobItem);
      });
      
      console.log('Jobs data processed:', jobsData.length);
      setJobs(jobsData);
      
      // Format applications by position for chart
      const chartData = Object.entries(applicationsByPositionData).map(([name, value]) => ({
        name,
        applications: value
      }));
      
      setApplicationsByPosition(chartData);
      
      // Fetch applications
      console.log('Fetching applications');
      const applicationsQuery = query(
        collection(db, "applications"),
        where("recruiterId", "==", user.uid)
      );
      
      const applicationsSnapshot = await getDocs(applicationsQuery);
      console.log('Applications snapshot size:', applicationsSnapshot.size);
      
      const applicationsData: Application[] = [];
      const candidatesMap = new Map();
      let interviewsScheduled = 0;
      
      // Set up hiring funnel data
      const funnel = {
        applied: 0,
        reviewed: 0,
        interviewed: 0,
        offered: 0,
        hired: 0
      };
      
      applicationsSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('Application data:', data);
        
        // Process application for funnel
        funnel.applied++;
        
        if (data.status === 'reviewed' || data.status === 'interview' || 
            data.status === 'shortlisted' || data.status === 'offered' || 
            data.status === 'hired') {
          funnel.reviewed++;
        }
        
        if (data.status === 'interview' || data.status === 'offered' || 
            data.status === 'hired') {
          funnel.interviewed++;
          interviewsScheduled++;
        }
        
        if (data.status === 'offered' || data.status === 'hired') {
          funnel.offered++;
        }
        
        if (data.status === 'hired') {
          funnel.hired++;
        }
        
        // Add to applications list
        applicationsData.push({
          id: doc.id,
          ...data
        });
        
        // Process candidate info if not already in map
        if (data.applicantId && !candidatesMap.has(data.applicantId)) {
          const candidateData = {
            id: data.applicantId,
            name: data.applicantName || 'Anonymous Candidate',
            position: data.jobTitle || 'Unknown Position',
            match: calculateMatchScore(data.applicantId, data.jobTitle || ''),
            status: data.status || 'pending',
            avatarColor: getRandomColor()
          };
          
          candidatesMap.set(data.applicantId, candidateData);
        }
      });
      
      setApplications(applicationsData);
      
      // Convert candidates map to array and sort by match score
      const candidatesArray = Array.from(candidatesMap.values())
        .sort((a, b) => parseFloat(b.match) - parseFloat(a.match));
      
      console.log('Candidates processed:', candidatesArray.length);
      setCandidates(candidatesArray);
      
      // Create hiring funnel data for chart
      const funnelData = [
        { name: 'Applied', value: funnel.applied },
        { name: 'Reviewed', value: funnel.reviewed },
        { name: 'Interviewed', value: funnel.interviewed },
        { name: 'Offered', value: funnel.offered },
        { name: 'Hired', value: funnel.hired }
      ];
      
      setHiringFunnel(funnelData);
      
      // Generate time to fill data (mock data for now)
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
      const timeToFillData = months.map(month => ({
        name: month,
        days: Math.floor(Math.random() * 30) + 10
      }));
      
      setTimeToFill(timeToFillData);
      
      // Set dashboard stats
      setStats({
        activeJobs,
        totalApplications,
        interviewsScheduled,
        newCandidates: candidatesArray.filter(c => c.status === 'pending' || c.status === 'new').length
      });
      
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setError("Failed to load dashboard data. Please try again.");
    } finally {
      setIsLoading(false);
      console.log('Total applications:', applications.length);
    }
  }, [user]); // Add dependencies for the useCallback

  // Check authentication and user role
  useEffect(() => {
    console.log('RecruiterDashboard component mounted');
    const checkUser = async () => {
      if (!loading) {
        if (!user) {
          console.log('No user found, redirecting to signin');
          // Redirect to sign in if not authenticated
          router.push('/signin');
        } else {
          console.log('User authenticated, fetching user data');
          // Fetch user data from Firestore to verify role
          try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
              const data = userDoc.data();
              console.log('User data fetched:', data);
              setUserData(data);
              
              // If user is not a recruiter, redirect to appropriate page
              if (data.role !== 'recruiter') {
                console.log('User is not a recruiter, redirecting');
                router.push('/applicant/applicantDashboard');
              } else {
                console.log('User is a recruiter, fetching dashboard data');
                fetchDashboardData();
              }
            } else {
              // If user document doesn't exist, check userPreferences as fallback
              const userPrefDoc = await getDoc(doc(db, "userPreferences", user.uid));
              if (userPrefDoc.exists()) {
                const prefData = userPrefDoc.data();
                console.log('User preferences data fetched:', prefData);
                setUserData(prefData);
                
                if (prefData.role !== 'recruiter') {
                  console.log('User is not a recruiter, redirecting');
                  router.push('/applicant/applicantDashboard');
                } else {
                  console.log('User is a recruiter, fetching dashboard data');
                  fetchDashboardData();
                }
              } else {
                console.log('No user document found, using default data');
                // Assume recruiter if no document exists
                setUserData({ name: user.displayName || 'Recruiter', role: 'recruiter' });
                fetchDashboardData();
              }
            }
          } catch (error) {
            console.error("Error fetching user data:", error);
            setError("Failed to load user data. Please try again.");
            setIsLoading(false);
          }
        }
      }
    };
    
    checkUser();
  }, [user, loading, router, fetchDashboardData]);

  // Show loading state while checking authentication
  if (loading || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-t-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
          >
            <h1 className="text-3xl font-bold mb-2">Recruiter Dashboard</h1>
            <p className="text-indigo-100">Welcome, {userData?.name || (user && user.displayName) || 'Recruiter'}</p>
            <p className="text-indigo-100">Manage your job listings and find the perfect candidates</p>
          </motion.div>
        </div>
      </div>
      
      <div className="container mx-auto max-w-6xl px-4 -mt-8">
        {/* Display error if any */}
        {error && (
          <div className="bg-red-100 border border-red-200 text-red-800 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}
        
        {/* Stats */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <motion.div 
            className="bg-white rounded-xl shadow-sm p-6"
            variants={fadeInUp}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
          >
            <div className="flex items-center">
              <div className="flex-shrink-0 h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
                <svg className="h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <div className="text-3xl font-bold text-gray-900 mb-1">{stats.activeJobs}</div>
                <div className="text-gray-600 text-sm">Active Job Listings</div>
              </div>
            </div>
          </motion.div>
          
          <motion.div 
            className="bg-white rounded-xl shadow-sm p-6"
            variants={fadeInUp}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
          >
            <div className="flex items-center">
              <div className="flex-shrink-0 h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
                <svg className="h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <div className="text-3xl font-bold text-gray-900 mb-1">{stats.totalApplications}</div>
                <div className="text-gray-600 text-sm">Total Applications</div>
              </div>
            </div>
          </motion.div>
          
          <motion.div 
            className="bg-white rounded-xl shadow-sm p-6"
            variants={fadeInUp}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
          >
            <div className="flex items-center">
              <div className="flex-shrink-0 h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                <svg className="h-6 w-6 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <div className="text-3xl font-bold text-gray-900 mb-1">{stats.interviewsScheduled}</div>
                <div className="text-gray-600 text-sm">Interviews Scheduled</div>
              </div>
            </div>
          </motion.div>
          
          <motion.div 
            className="bg-white rounded-xl shadow-sm p-6"
            variants={fadeInUp}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
          >
            <div className="flex items-center">
              <div className="flex-shrink-0 h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg className="h-6 w-6 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <div className="text-3xl font-bold text-gray-900 mb-1">{stats.newCandidates}</div>
                <div className="text-gray-600 text-sm">New Candidates</div>
              </div>
            </div>
          </motion.div>
        </motion.div>
        
        {/* Action buttons */}
        <motion.div 
          className="flex flex-col sm:flex-row gap-4 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Link 
            href="/recruiter/post-job" 
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg flex items-center justify-center hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Post New Job
          </Link>
          <Link 
            href="/recruiter/candidates" 
            className="px-6 py-3 bg-white text-indigo-600 border border-indigo-200 rounded-lg flex items-center justify-center hover:bg-indigo-50 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Find Candidates
          </Link>
        </motion.div>
        
        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-8">
          <div className="flex border-b border-gray-200">
            <button 
              className={`px-6 py-4 text-sm font-medium ${activeTab === 'jobs' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-600 hover:text-gray-900'}`}
              onClick={() => setActiveTab('jobs')}
            >
              Your Job Listings
            </button>
            <button 
              className={`px-6 py-4 text-sm font-medium ${activeTab === 'candidates' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-600 hover:text-gray-900'}`}
              onClick={() => setActiveTab('candidates')}
            >
              Top Candidates
            </button>
            <button 
              className={`px-6 py-4 text-sm font-medium ${activeTab === 'analytics' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-600 hover:text-gray-900'}`}
              onClick={() => setActiveTab('analytics')}
            >
              Hiring Analytics
            </button>
          </div>
          
          <div className="p-6">
            {activeTab === 'jobs' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">Active and Recent Job Listings</h2>
                  <Link 
                    href="/recruiter/job-history" 
                    className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center"
                  >
                    <span>View All Listings</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
                
                {jobs.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-8 text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No job listings yet</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Get started by creating your first job posting.
                    </p>
                    <div className="mt-6">
                      <Link
                        href="/recruiter/post-job"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                      >
                        Post a Job
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applications</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Posted</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Views</th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {jobs.map((job) => (
                          <motion.tr 
                            key={job.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                            whileHover={{ backgroundColor: '#f9fafb' }}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{job.position}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span 
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                ${job.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                              >
                                {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{job.applications}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {job.formattedDate}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {job.views}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex justify-end space-x-3">
                                <Link href={`/recruiter/jobs/${job.id}`} className="text-indigo-600 hover:text-indigo-900">
                                  View
                                </Link>
                                <Link href={`/recruiter/jobs/${job.id}/edit`} className="text-indigo-600 hover:text-indigo-900">
                                  Edit
                                </Link>
                                {job.status === 'active' ? (
                                  <Link href={`/recruiter/jobs/${job.id}/close`} className="text-red-600 hover:text-red-900">
                                    Close
                                  </Link>
                                ) : (
                                  <Link href={`/recruiter/jobs/${job.id}/reopen`} className="text-green-600 hover:text-green-900">
                                    Reopen
                                  </Link>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                {jobs.length > 0 && (
                  <div className="mt-6 text-center">
                    <Link
                      href="/recruiter/job-history"
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      View All Job Listings
                    </Link>
                  </div>
                )}
              </motion.div>
            )}
            
            {activeTab === 'candidates' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">AI-Matched Top Candidates</h2>
                  <span className="text-sm text-gray-500">Based on skills and experience matching</span>
                </div>
                
                {candidates.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-8 text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No candidates yet</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Post a job to start receiving applications from qualified candidates.
                    </p>
                    <div className="mt-6">
                      <Link
                        href="/recruiter/post-job"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                      >
                        Post a Job
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {candidates.slice(0, 6).map((candidate) => (
                      <motion.div 
                        key={candidate.id}
                        className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
                        whileHover={{ y: -5, transition: { duration: 0.2 } }}
                      >
                        <div className="p-6">
                          <div className="flex items-center mb-4">
                            <div className={`h-12 w-12 rounded-full ${candidate.avatarColor} flex items-center justify-center text-white font-bold text-xl`}>
                              {candidate.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="ml-4">
                              <div className="text-lg font-semibold text-gray-900">{candidate.name}</div>
                              <div className="text-sm text-gray-600">{candidate.position}</div>
                            </div>
                          </div>
                          <div className="flex justify-between items-center mb-4">
                            <div className="bg-green-100 text-green-800 text-sm font-semibold px-2.5 py-0.5 rounded">
                              AI Match: {candidate.match}
                            </div>
                            <div className={`text-xs font-semibold px-2.5 py-0.5 rounded
                              ${candidate.status === 'pending' || candidate.status === 'new' ? 'bg-blue-100 text-blue-800' : 
                              candidate.status === 'interview' || candidate.status === 'shortlisted' ? 'bg-purple-100 text-purple-800' : 
                              candidate.status === 'hired' ? 'bg-green-100 text-green-800' :
                              candidate.status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'}`}
                            >
                              {candidate.status.charAt(0).toUpperCase() + candidate.status.slice(1)}
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                            <Link 
                              href={`/recruiter/candidates/${candidate.id}`}
                              className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                            >
                              View Profile
                            </Link>
                            <Link 
                              href={`/recruiter/candidates/${candidate.id}/contact`}
                              className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition-colors"
                            >
                              Contact
                            </Link>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
                
                {candidates.length > 6 && (
                  <div className="mt-6 text-center">
                    <Link 
                      href="/recruiter/candidates" 
                      className="text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center justify-center"
                    >
                      <span>View All Candidates</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                )}
              </motion.div>
            )}
            
            {activeTab === 'analytics' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">Hiring Performance</h2>
                  <select className="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50">
                    <option>Last 30 days</option>
                    <option>Last quarter</option>
                    <option>Last year</option>
                    <option>All time</option>
                  </select>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  {/* Applications by Position Chart */}
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-sm font-medium text-gray-600 mb-4">Applications by Position</h3>
                    {applicationsByPosition.length > 0 ? (
                      <div className="h-60">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={applicationsByPosition}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="applications" fill="#4f46e5" name="Applications" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-60 bg-gray-50 rounded-lg flex items-center justify-center">
                        <p className="text-gray-500">No application data available yet</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Time to Fill Chart */}
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-sm font-medium text-gray-600 mb-4">Time to Fill (Days)</h3>
                    <div className="h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={timeToFill}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="days" stroke="#7c3aed" activeDot={{ r: 8 }} name="Days to Fill" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
                
                {/* Hiring Funnel */}
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm mb-6">
                  <h3 className="text-sm font-medium text-gray-600 mb-4">Hiring Funnel</h3>
                  {hiringFunnel.length > 0 ? (
                    <div className="h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={hiringFunnel}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                          layout="vertical"
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" />
                          <Tooltip />
                          <Bar dataKey="value" fill="#10b981" name="Candidates" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-60 bg-gray-50 rounded-lg flex items-center justify-center">
                      <p className="text-gray-500">No funnel data available yet</p>
                    </div>
                  )}
                </div>
                
                {/* AI Insights */}
                <div className="bg-indigo-50 rounded-xl p-6">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-indigo-800">AI Insights</h3>
                      <div className="mt-2 text-sm text-indigo-700">
                        {jobs.length > 0 ? (
                          <p>
                            Based on your hiring data, we recommend enhancing your job descriptions 
                            with more specific skills requirements. Jobs with detailed requirements receive
                            30% more qualified applicants on average.
                          </p>
                        ) : (
                          <p>
                            Post your first job to receive AI-powered insights on your hiring process
                            and recommendations to improve candidate quality.
                          </p>
                        )}
                      </div>
                      <div className="mt-4">
                        <Link
                          href="/recruiter/insights"
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                        >
                          View detailed recommendations
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
        
        {/* Job Postings Reminder Card */}
        {jobs.length === 0 && (
          <motion.div
            className="bg-gradient-to-r from-indigo-100 to-purple-100 rounded-xl p-6 mb-8 border border-indigo-200"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="flex items-center space-x-4">
              <div className="bg-white rounded-full p-3">
                <svg className="h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Create Your First Job Posting</h3>
                <p className="text-gray-600 mt-1">Start attracting top talent by creating a compelling job listing.</p>
              </div>
              <div className="ml-auto">
                <Link 
                  href="/recruiter/post-job" 
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg inline-flex items-center hover:bg-indigo-700 transition-colors"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </motion.div>
        )}
        
        {/* Quick Actions */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl shadow-sm p-6 border border-indigo-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Post Jobs</h3>
              <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <svg className="h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Create and manage job listings to reach qualified candidates.
            </p>
            <Link 
              href="/recruiter/post-job" 
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Post New Job
            </Link>
          </div>
          
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl shadow-sm p-6 border border-emerald-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Manage Applications</h3>
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg className="h-5 w-5 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Review and track applicants through your hiring pipeline.
            </p>
            <Link 
              href="/recruiter/applications" 
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700"
            >
              View Applications
            </Link>
          </div>
          
          <div className="bg-gradient-to-br from-blue-50 to-sky-50 rounded-xl shadow-sm p-6 border border-blue-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">AI Candidate Matching</h3>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <svg className="h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Find the perfect candidates using our AI matching technology.
            </p>
            <Link 
              href="/recruiter/candidates"  
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              Find Candidates
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}