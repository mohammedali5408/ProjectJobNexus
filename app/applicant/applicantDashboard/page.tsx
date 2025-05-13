'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { collection, query, where, getDocs, orderBy, limit, getDoc, doc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/authContext';
import { useRouter } from 'next/navigation';
import Header from '@/app/components/header';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

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

// Define necessary interfaces

// Interface for application data
interface Application {
  id: string;
  company: string;
  jobTitle: string;
  status: string;
  date: Date;
  applySummary: string;
  jobId: string;
  createdAt: any; // Firebase timestamp
}

// Interface for monthly application data
interface MonthlyApplicationData {
  name: string;
  applications: number;
  interviews: number;
  shortlisted?: number;
  rejected?: number;
}

// Interface for job recommendation
interface JobRecommendation {
  id: string;
  company: string;
  position: string;
  location: string;
  match: number;
  skills: string[];
  logoColor: string;
}

// Interface for resume data
interface Resume {
  id: string;
  title: string;
  lastUpdated: Date;
  description: string;
  matchRate: number;
}

// Interface for stats
interface Stats {
  totalApplications: number;
  interviewsScheduled: number;
  newJobMatches: number;
  profileCompletion: number;
}

// Interface for user profile
interface UserProfile {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  bio?: string;
  education?: any[];
  experience?: any;
  skills?: string[];
  linkedin?: string;
  github?: string;
  [key: string]: any; // For other properties
}


export default function ApplicantDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('applications');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Use the AuthContext hook
  const { user, loading: authLoading } = useAuth();
  
  // State for data
 const [applications, setApplications] = useState<Application[]>([]);
const [applicationMonthlyData, setApplicationMonthlyData] = useState<MonthlyApplicationData[]>([]);
const [recommendations, setRecommendations] = useState<JobRecommendation[]>([]);
const [resumes, setResumes] = useState<Resume[]>([]);
const [profileData, setProfileData] = useState<UserProfile | null>(null);
const [stats, setStats] = useState<Stats>({
  totalApplications: 0,
  interviewsScheduled: 0,
  newJobMatches: 0,
  profileCompletion: 0
});


  useEffect(() => {
    console.log('ApplicantDashboard component mounted');
    // Only fetch data if authentication state is loaded
    if (authLoading) return;
    
    // If no user is authenticated, redirect to sign in
    if (!user) {
      console.log('No user found, redirecting to signin');
      router.push('/signin');
      return;
    }
    
    const fetchData = async () => {
      setIsLoading(true);
      setError('');
      
      try {
        console.log('Fetching applications data for user:', user.uid);
        // Fetch applications data
        const applicationsQuery = query(
          collection(db, "applications"),
          where("applicantId", "==", user.uid)
        );
        
        const applicationsSnapshot = await getDocs(applicationsQuery);
        console.log('Applications snapshot size:', applicationsSnapshot.size);
        
        const applicationsData: Application[] = [];
        applicationsSnapshot.forEach((doc) => {
          const data = doc.data();
          console.log('Application data:', data);
          
          applicationsData.push({
            id: doc.id,
            company: data.company || '',
            jobTitle: data.jobTitle || '',
            status: data.status || 'pending',
            date: data.createdAt ? new Date(data.createdAt.seconds * 1000) : new Date(),
            applySummary: data.applySummary || '',
            jobId: data.jobId || '',
            createdAt: data.createdAt
          });
        });
        
        console.log('Total applications found:', applicationsData.length);
        setApplications(applicationsData);
        
        // Generate monthly application data for chart
        const monthlyData = generateMonthlyApplicationData(applicationsData);
        setApplicationMonthlyData(monthlyData);
        
        // Fetch job recommendations
        try {
          console.log('Fetching job recommendations');
          
          // First fetch user profile to get skills
          const userProfileRef = doc(db, "userProfiles", user.uid);
          const userProfileSnap = await getDoc(userProfileRef);
          
          let userProfile = null;
          let userSkills = [];
          
          if (userProfileSnap.exists()) {
            console.log('User profile found');
            userProfile = userProfileSnap.data();
            userSkills = userProfile.skills || [];
            setProfileData(userProfile);
          } else {
            console.log('No user profile found, trying userPreferences collection');
            // Try userPreferences collection as fallback
            const userPreferencesQuery = query(
              collection(db, "userPreferences"),
              where("userId", "==", user.uid),
              limit(1)
            );
            
            const userPreferencesSnapshot = await getDocs(userPreferencesQuery);
            
            if (!userPreferencesSnapshot.empty) {
              const preferencesData = userPreferencesSnapshot.docs[0].data();
              userSkills = preferencesData.skills || [];
              setProfileData(preferencesData);
            }
          }
          
          // Calculate profile completion percentage
          const profileCompletionPercentage = calculateProfileCompletion(userProfile);
          
          // Fetch recent jobs
          console.log('Fetching recent active jobs');
          const jobsQuery = query(
            collection(db, "jobs"),
            where("status", "==", "active"),
            limit(3)
          );
          
          const jobsSnapshot = await getDocs(jobsQuery);
          console.log('Jobs snapshot size:', jobsSnapshot.size);
          
            const recommendationsData: JobRecommendation[] = [];
          jobsSnapshot.forEach((doc) => {
            const data = doc.data();
            console.log('Job data:', data);
            
            // Calculate a match score based on shared skills
            let matchScore = 75; // Base score
            if (userSkills.length > 0 && data.skills && data.skills.length > 0) {
              const jobSkills = data.skills || [];
                const sharedSkills: string[] = userSkills.filter((skill: string) => jobSkills.includes(skill));
              const matchPercentage = Math.min(95, Math.round(75 + (sharedSkills.length / Math.max(1, userSkills.length) * 20)));
              matchScore = matchPercentage;
            }
            
            recommendationsData.push({
              id: doc.id,
              company: data.company || '',
              position: data.title || '',
              location: data.location || 'Remote',
              match: matchScore,
              skills: data.skills || [],
              logoColor: getRandomColor()
            });
          });
          
          console.log('Total job recommendations:', recommendationsData.length);
          setRecommendations(recommendationsData);
          
          // Fetch resumes
          console.log('Fetching resumes for user:', user.uid);
          const resumesQuery = query(
            collection(db, "resumes"),
            where("userId", "==", user.uid)
          );
          
          const resumesSnapshot = await getDocs(resumesQuery);
          console.log('Resumes snapshot size:', resumesSnapshot.size);
          
            const resumesData: Resume[] = [];
          resumesSnapshot.forEach((doc) => {
            const data = doc.data();
            resumesData.push({
              id: doc.id,
              title: data.title || 'Resume',
              lastUpdated: data.updatedAt ? new Date(data.updatedAt.seconds * 1000) : new Date(),
              description: data.description || '',
              matchRate: data.matchRate || calculateResumeMatchRate(data, userSkills)
            });
          });
          
          console.log('Total resumes found:', resumesData.length);
          setResumes(resumesData);
          
          // Calculate dashboard stats
          const interviewsCount = applicationsData.filter(app => 
            app.status === 'shortlisted' || app.status === 'interview').length;
          
          setStats({
            totalApplications: applicationsData.length,
            interviewsScheduled: interviewsCount,
            newJobMatches: recommendationsData.length,
            profileCompletion: profileCompletionPercentage
          });
          
        } catch (profileError) {
          console.error("Error fetching profile or recommendations:", profileError);
          // Continue with partial data if possible
        }
        
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        setError("Failed to load dashboard data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [user, authLoading, router]);
  
  // Helper function to calculate profile completion
  const calculateProfileCompletion = (profile: UserProfile | null): number => {
  if (!profile) return 45;
  
  const fields = [
    'name', 'email', 'phone', 'location', 'bio', 
    'education', 'experience', 'skills', 'linkedin', 'github'
  ];
  
  let filledFields = 0;
  let totalFields = fields.length;
  
  fields.forEach(field => {
    if (profile[field]) {
      if (Array.isArray(profile[field])) {
        if (profile[field].length > 0) filledFields++;
      } else if (typeof profile[field] === 'object') {
        if (Object.keys(profile[field]).length > 0) filledFields++;
      } else {
        filledFields++;
      }
    }
  });
  
  return Math.round((filledFields / totalFields) * 100);
};
  
  // Helper function to calculate resume match rate
  const calculateResumeMatchRate = (resume: any, userSkills: string[] | undefined): number => {
  // In a real app, this would be more sophisticated
  if (!resume || !resume.skills || !userSkills || userSkills.length === 0) {
    return Math.floor(Math.random() * 20) + 70; // Random value between 70-90
  }
  
  const resumeSkills = resume.skills;
  const matchingSkills = resumeSkills.filter((skill: string) => userSkills.includes(skill));
  const matchRate = Math.round((matchingSkills.length / userSkills.length) * 100);
  
  return Math.min(95, Math.max(60, matchRate)); // Ensure between 60-95
};

// Fixed function with proper types
const generateMonthlyApplicationData = (applications: Application[]): MonthlyApplicationData[] => {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  
  const monthlyData: {[key: string]: MonthlyApplicationData} = {};
  
  // Initialize with all months (last 6 months)
  const today = new Date();
  for (let i = 0; i < 6; i++) {
    const monthIndex = (today.getMonth() - i + 12) % 12;
    const year = today.getFullYear() - (today.getMonth() < monthIndex ? 1 : 0);
    const monthName = `${months[monthIndex]} ${year}`;
    monthlyData[monthName] = {
      name: monthName,
      applications: 0,
      interviews: 0,
      shortlisted: 0,
      rejected: 0
    };
  }
  
  // Count applications by month
  applications.forEach(app => {
    if (!app.date) return;
    
    const appDate = app.date;
    const monthName = `${months[appDate.getMonth()]} ${appDate.getFullYear()}`;
    
    if (monthlyData[monthName]) {
      monthlyData[monthName].applications++;
      
      if (app.status === 'shortlisted') {
        monthlyData[monthName].shortlisted!++;
      } else if (app.status === 'interview') {
        monthlyData[monthName].interviews++;
      } else if (app.status === 'rejected') {
        monthlyData[monthName].rejected!++;
      }
    }
  });
  
  // Convert to array and reverse for chronological order
  return Object.values(monthlyData).reverse();
};

// Fixed function with proper types
const getRandomColor = (): string => {
  const colors = [
    'bg-emerald-500', 'bg-sky-500', 'bg-violet-500', 
    'bg-amber-500', 'bg-pink-500', 'bg-blue-500', 
    'bg-indigo-500', 'bg-red-500', 'bg-green-500'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

// Fixed function with proper types
const formatDate = (date: Date | undefined): string => {
  if (!date) return 'Unknown date';
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

// Sample data functions with proper types
const getSampleData = (): MonthlyApplicationData[] => {
  if (applicationMonthlyData.length > 0) return applicationMonthlyData;
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  return months.map(month => ({
    name: `${month} 2025`,
    applications: Math.floor(Math.random() * 5),
    interviews: Math.floor(Math.random() * 3),
    rejected: Math.floor(Math.random() * 2)
  }));
};

// Fixed interface for application status data
interface StatusData {
  name: string;
  value: number;
}

// Compute application status data from applications
const applicationStatusData: StatusData[] = useMemo(() => {
  if (!applications || applications.length === 0) return [];
  const statusCount: { [key: string]: number } = {};
  applications.forEach(app => {
    statusCount[app.status] = (statusCount[app.status] || 0) + 1;
  });
  return Object.entries(statusCount).map(([name, value]) => ({ name, value }));
}, [applications]);

// Fixed function with proper types
const getSampleStatusData = (): StatusData[] => {
  if (applicationStatusData.length > 0) return applicationStatusData;
  
  return [
    { name: 'pending', value: 3 },
    { name: 'reviewed', value: 2 },
    { name: 'shortlisted', value: 1 }
  ];
};
  
  // Colors for pie chart
  const COLORS = ['#4f46e5', '#7c3aed', '#06b6d4', '#10b981', '#f43f5e', '#f59e0b'];

  

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-t-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen">
      <Header userRole="applicant" isLoggedIn={!!user} />
      
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
          >
            <h1 className="text-3xl font-bold mb-2">Your Dashboard</h1>
            <p className="text-indigo-100">Track your applications and discover new opportunities</p>
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
                <div className="text-gray-600 text-sm">Interviews</div>
              </div>
            </div>
          </motion.div>
          
          <motion.div 
            className="bg-white rounded-xl shadow-sm p-6"
            variants={fadeInUp}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
          >
            <div className="flex items-center">
              <div className="flex-shrink-0 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="h-6 w-6 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <div className="text-3xl font-bold text-gray-900 mb-1">{stats.newJobMatches}</div>
                <div className="text-gray-600 text-sm">New Job Matches</div>
              </div>
            </div>
          </motion.div>
          
          <motion.div 
            className="bg-white rounded-xl shadow-sm p-6"
            variants={fadeInUp}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
          >
            <div className="flex items-center">
              <div className="flex-shrink-0 h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <svg className="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <div className="flex items-center space-x-2">
                  <div className="text-3xl font-bold text-gray-900">{stats.profileCompletion}%</div>
                  <Link href="/applicant/profile" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                    Complete
                  </Link>
                </div>
                <div className="text-gray-600 text-sm">Profile Completion</div>
              </div>
            </div>
          </motion.div>
        </motion.div>
        
        {/* Analysis and Charts */}
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Application Analytics</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Application Status Pie Chart */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-lg font-medium text-gray-800 mb-4">Application Status</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={getSampleStatusData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {getSampleStatusData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} applications`, 'Count']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Monthly Applications Bar Chart */}
              <div className="lg:col-span-2 bg-gray-50 rounded-xl p-4">
                <h3 className="text-lg font-medium text-gray-800 mb-4">Monthly Activity</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={getSampleData()}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="applications" fill="#4f46e5" name="Applications" />
                      <Bar dataKey="interviews" fill="#10b981" name="Interviews" />
                      <Bar dataKey="rejected" fill="#f43f5e" name="Rejected" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
        
        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-8">
          <div className="flex border-b border-gray-200">
            <button 
              className={`px-6 py-4 text-sm font-medium ${activeTab === 'applications' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-600 hover:text-gray-900'}`}
              onClick={() => setActiveTab('applications')}
            >
              Recent Applications
            </button>
            <button 
              className={`px-6 py-4 text-sm font-medium ${activeTab === 'recommendations' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-600 hover:text-gray-900'}`}
              onClick={() => setActiveTab('recommendations')}
            >
              Job Recommendations
            </button>
            <button 
              className={`px-6 py-4 text-sm font-medium ${activeTab === 'resume' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-600 hover:text-gray-900'}`}
              onClick={() => setActiveTab('resume')}
            >
              Resume Management
            </button>
          </div>
          
          <div className="p-6">
            {activeTab === 'applications' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">Your Applications</h2>
                  <Link 
                    href="/applicant/applications" 
                    className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center"
                  >
                    <span>View All Applications</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
                
                {applications.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-8 text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No applications yet</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Start applying to jobs to track your applications here.
                    </p>
                    <div className="mt-6">
                      <Link
                        href="/applicant/find-jobs"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                      >
                        View Available Jobs
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Applied</th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {applications.slice(0, 5).map((app) => (
                          <motion.tr 
                            key={app.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                            whileHover={{ backgroundColor: '#f9fafb' }}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className={`flex-shrink-0 h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold`}>
                                  {app.company ? app.company.charAt(0).toUpperCase() : 'C'}
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">{app.company}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{app.jobTitle}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span 
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                ${app.status === 'interview' || app.status === 'shortlisted' ? 'bg-green-100 text-green-800' : 
                                  app.status === 'pending' || app.status === 'applied' ? 'bg-blue-100 text-blue-800' : 
                                  app.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                  app.status === 'hired' ? 'bg-purple-100 text-purple-800' :
                                  'bg-gray-100 text-gray-800'}`}
                              >
                                {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {app.date ? formatDate(app.date) : 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <Link 
                                href={`/applicant/jobs/${app.jobId}`} 
                                className="text-indigo-600 hover:text-indigo-900"
                              >
                                View
                              </Link>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                {applications.length > 5 && (
                  <div className="mt-6 text-center">
                    <Link
                      href="/applicant/applications"
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      View All ({applications.length}) Applications
                    </Link>
                  </div>
                )}
              </motion.div>
            )}
            
            {activeTab === 'recommendations' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">AI-Powered Job Recommendations</h2>
                  <span className="text-sm text-gray-500">Based on your profile and skills</span>
                </div>
                
                {recommendations.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-8 text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No recommendations yet</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Complete your profile and add skills to get personalized job recommendations.
                    </p>
                    <div className="mt-6">
                      <Link
                        href="/applicant/profile"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                      >
                        Update Profile
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {recommendations.map((job) => (
                      <motion.div 
                        key={job.id}
                        className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
                        whileHover={{ y: -5, transition: { duration: 0.2 } }}
                      >
                        <div className="p-6">
                          <div className="flex items-start">
                            <div className={`h-12 w-12 rounded-md bg-indigo-600 flex items-center justify-center text-white font-bold text-xl`}>
                              {job.company.charAt(0).toUpperCase()}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-500">{job.company}</div>
                              <div className="text-md font-semibold text-gray-900">{job.position}</div>
                            </div>
                          </div>
                          
                          <div className="mt-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center text-sm text-gray-500">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {job.location}
                              </div>
                              <div className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                                {job.match}% Match
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-1 mb-4">
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
                          </div>
                          
                          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                            <Link 
                              href={`/applicant/jobs/${job.id}`} 
                              className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                            >
                              View Details
                            </Link>
                            <Link
                              href={`/applicant/jobs/${job.id}`}
                              className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition-colors"
                            >
                              Apply Now
                            </Link>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
                
                <div className="mt-6 text-center">
                  <Link
                    href="/applicant/find-jobs"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Browse All Jobs
                  </Link>
                </div>
              </motion.div>
            )}
            
            {activeTab === 'resume' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">Resume Management</h2>
                  <Link
                    href="/applicant/resume/new"
                    className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition-colors flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Create New Resume
                  </Link>
                </div>
                
                {profileData && profileData.skills && profileData.skills.length > 0 && (
                  <div className="bg-indigo-50 rounded-xl p-6 mb-6">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-indigo-800">AI Resume Tips</h3>
                        <div className="mt-2 text-sm text-indigo-700">
                          <p>Based on your profile, we recommend highlighting these top skills in your resume:</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {profileData.skills.slice(0, 5).map((skill, index) => (
                              <span key={index} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-200 text-indigo-800">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {resumes.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-8 text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No resumes yet</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Create a resume to start applying for jobs.
                    </p>
                    <div className="mt-6">
                      <Link
                        href="/applicant/resume/new"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                      >
                        Create First Resume
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {resumes.map(resume => (
                      <div key={resume.id} className="border border-gray-200 rounded-xl p-6 bg-white">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">{resume.title}</h3>
                            <p className="text-sm text-gray-500 mt-1">Last updated on {formatDate(resume.lastUpdated)}</p>
                          </div>
                          <div className="flex space-x-2">
                            <Link 
                              href={`/applicant/resume/${resume.id}/edit`}
                              className="p-2 text-gray-500 hover:text-indigo-600"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </Link>
                            <Link 
                              href={`/applicant/resume/${resume.id}/download`}
                              className="p-2 text-gray-500 hover:text-indigo-600"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            </Link>
                          </div>
                        </div>
                        <div className="mt-4 flex">
                          <div className="flex-shrink-0">
                            <div className="h-12 w-9 bg-indigo-100 rounded flex items-center justify-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                          </div>
                          <div className="ml-4 flex-1">
                            <p className="text-sm text-gray-500">{resume.description || `This resume is optimized for ${resume.title.toLowerCase()} roles.`}</p>
                            
                            <div className="mt-2 flex flex-col sm:flex-row sm:justify-between">
                              <div className="flex space-x-4">
                                <Link href={`/applicant/resume/${resume.id}`} className="text-sm text-indigo-600 font-medium">Preview</Link>
                                <Link href={`/applicant/resume/${resume.id}/optimize`} className="text-sm text-indigo-600 font-medium">Optimize with AI</Link>
                              </div>
                              
                              <div className="mt-2 sm:mt-0 flex items-center">
                                <div className="mr-2 text-sm text-gray-500">Match Rate:</div>
                                <div className="flex items-center">
                                  <div className="relative w-24 h-2 bg-gray-200 rounded-full">
                                    <div 
                                      className={`absolute left-0 top-0 h-2 rounded-full ${
                                        resume.matchRate >= 80 ? 'bg-green-500' : 
                                        resume.matchRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                      }`}
                                      style={{ width: `${resume.matchRate}%` }}
                                    ></div>
                                  </div>
                                  <span className="ml-2 text-sm font-medium text-gray-900">{resume.matchRate}%</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
        
        {/* Job Application Activity */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Application Activity</h2>
              <Link 
                href="/applicant/applications" 
                className="text-sm text-indigo-600 hover:text-indigo-700"
              >
                View All
              </Link>
            </div>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={getSampleData()}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="applications" stroke="#4f46e5" activeDot={{ r: 8 }} name="Applications" />
                  <Line type="monotone" dataKey="interviews" stroke="#10b981" name="Interviews" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
        
        {/* Quick Actions */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl shadow-sm p-6 border border-indigo-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Find Jobs</h3>
                <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                  <svg className="h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Discover new job opportunities matching your skills and preferences.
              </p>
              <Link 
                href="/applicant/find-jobs" 
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Browse Jobs
              </Link>
            </div>
            
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-sm p-6 border border-green-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Update Profile</h3>
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="h-5 w-5 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Keep your profile updated to improve job matches and application success.
              </p>
              <Link 
                href="/applicant/profilePage" 
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
              >
                Edit Profile
              </Link>
            </div>
            
            <div className="bg-gradient-to-br from-blue-50 to-sky-50 rounded-xl shadow-sm p-6 border border-blue-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">AI Resume Builder</h3>
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg className="h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Create or optimize your resume with our AI tools to stand out to employers.
              </p>
              <Link 
                href="/applicant/resume-builder" 
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                Build Resume
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}