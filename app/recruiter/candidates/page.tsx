'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { collection, getDocs, query, orderBy, limit, startAfter, where, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/app/lib/firebase';
import Header from '@/app/components/header';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/app/lib/authContext';

// Interface for candidate data
interface Candidate {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  title: string;
  experience: number;
  skills: string[];
  education: Education[];
  workHistory: WorkHistory[];
  bio: string;
  avatarUrl: string;
  linkedInUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  availability: string;
  remote: boolean;
  relocate: boolean;
  visaSponsorship: boolean;
  lastActive: any; // Firestore timestamp
  profileCompleted: boolean;
  matchScore?: number;
}

// Interface for job listing
interface JobListing {
  id: string;
  title: string;
  company: string;
}

// Interface for education
interface Education {
  institution: string;
  degree: string;
  field: string;
  year: string;
}

// Interface for work history
interface WorkHistory {
  company: string;
  position: string;
  startDate: any; // Firestore timestamp or string
  endDate?: any; // Firestore timestamp or string
  description?: string;
}

// Interface for filters
interface Filters {
  location: string;
  remote: boolean;
  relocate: boolean;
  visaSponsorship: boolean;
  minExperience: string;
  skills: string[];
  availability: string;
}

export default function RecruiterCandidatesPage() {
  const router = useRouter();
   const [userRole, setUserRole] = useState<'applicant' | 'recruiter' | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
const [filteredCandidates, setFilteredCandidates] = useState<Candidate[]>([]);
const [lastVisible, setLastVisible] = useState<any>(null);
const [hasMore, setHasMore] = useState<boolean>(true);
const [searchTerm, setSearchTerm] = useState<string>('');
const [showFilters, setShowFilters] = useState<boolean>(false);
const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
const [showModal, setShowModal] = useState<boolean>(false);
const [error, setError] = useState<string>('');
const [isLoading, setIsLoading] = useState<boolean>(true);
  
const [skillOptions, setSkillOptions] = useState<string[]>([]);
const [filters, setFilters] = useState<Filters>({
  location: '',
  remote: false,
  relocate: false,
  visaSponsorship: false,
  minExperience: '',
  skills: [],
  availability: ''
});
  
// Job posting to match candidates against
const [selectedJob, setSelectedJob] = useState<string>('');
const [jobListings, setJobListings] = useState<JobListing[]>([]);
  
  // Use the AuthContext hook at the top of your component
const { user, loading: authLoading } = useAuth();

// Replace your existing useEffect with this one
useEffect(() => {
  // Only proceed if authentication state is loaded
  if (authLoading) return;
  
  // If no user is authenticated, redirect to sign in
  if (!user) {
    router.push('/signin');
    return;
  }
  
  const fetchUserRoleAndData = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // Check if the user has recruiter role
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
      
      // Fetch job listings for the recruiter
      const jobsQuery = query(
        collection(db, "jobs"),
        where("status", "==", "active"),
        limit(10)
      );
      
      const jobsSnapshot = await getDocs(jobsQuery);
      
      const jobsList: JobListing[] = [];
      jobsSnapshot.forEach((doc) => {
        jobsList.push({
          id: doc.id,
          title: doc.data().title,
          company: doc.data().company
        });
      });
      
      setJobListings(jobsList);
      
      // Fetch candidate profiles
      let candidatesQuery = query(
        collection(db, "candidateProfiles"),
        orderBy("lastActive", "desc"),
        limit(20)
      );
      
      const candidatesSnapshot = await getDocs(candidatesQuery);
      
      if (candidatesSnapshot.empty) {
        console.log("No candidate profiles found in database.");
        setIsLoading(false);
        return;
      }
      
      // Define a type for Firestore candidate document data
      interface FirestoreCandidateData {
        userId?: string;
        name?: string;
        email?: string;
        phone?: string;
        location?: string;
        title?: string;
        experience?: number;
        skills?: string[];
        education?: Education[];
        workHistory?: WorkHistory[];
        bio?: string;
        avatarUrl?: string;
        linkedInUrl?: string;
        githubUrl?: string;
        portfolioUrl?: string;
        availability?: string;
        remote?: boolean;
        relocate?: boolean;
        visaSponsorship?: boolean;
        lastActive?: any;
        profileCompleted?: boolean;
      }

      const candidatesList: Candidate[] = [];
      const allSkills = new Set();
      
      candidatesSnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Add all skills to the set for filter options
        (data.skills as string[] | undefined)?.forEach((skill: string) => allSkills.add(skill));
        
        // Add random match score for demo purposes (in a real app this would be calculated)
        const matchScore = Math.floor(Math.random() * 30) + 70; // Score between 70-99
        
        // Make sure to handle missing fields with defaults
        candidatesList.push({
          id: doc.id,
          userId: data.userId || '',
          name: data.name || 'Anonymous Candidate',
          email: data.email || '',
          phone: data.phone || '',
          location: data.location || 'Remote',
          title: data.title || 'Professional',
          experience: data.experience || 0,
          skills: data.skills || [],
          education: data.education || [],
          workHistory: data.workHistory || [],
          bio: data.bio || '',
          avatarUrl: data.avatarUrl || '',
          linkedInUrl: data.linkedInUrl || '',
          githubUrl: data.githubUrl || '',
          portfolioUrl: data.portfolioUrl || '',
          availability: data.availability || 'Available',
          remote: data.remote || false,
          relocate: data.relocate || false,
          visaSponsorship: data.visaSponsorship || false,
          lastActive: data.lastActive || null,
          profileCompleted: data.profileCompleted || false,
          matchScore
        });
      });
      
      setCandidates(candidatesList);
      setFilteredCandidates(candidatesList);
      setSkillOptions(Array.from(allSkills) as string[]);
      
      if (candidatesSnapshot.docs.length > 0) {
        setLastVisible(candidatesSnapshot.docs[candidatesSnapshot.docs.length - 1]);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error fetching candidates:", error);
      setError("Failed to load candidates. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  fetchUserRoleAndData();
}, [user, authLoading, router]);
  
  // Load more candidates
  const handleLoadMore = async () => {
    if (!lastVisible || !hasMore) return;
    
    setIsLoading(true);
    try {
      const candidatesQuery = query(
        collection(db, "candidateProfiles"),
        orderBy("lastActive", "desc"),
        startAfter(lastVisible),
        limit(10)
      );
      
      const candidatesSnapshot = await getDocs(candidatesQuery);
      
      if (candidatesSnapshot.empty) {
        setHasMore(false);
        setIsLoading(false);
        return;
      }
      
      const newCandidates: Candidate[] = [];
      
      candidatesSnapshot.forEach((doc) => {
        const data = doc.data();
        const matchScore = Math.floor(Math.random() * 30) + 70;
        
        newCandidates.push({
          id: doc.id,
          userId: data.userId || '',
          name: data.name || 'Anonymous Candidate',
          email: data.email || '',
          phone: data.phone || '',
          location: data.location || 'Remote',
          title: data.title || 'Professional',
          experience: data.experience || 0,
          skills: data.skills || [],
          education: data.education || [],
          workHistory: data.workHistory || [],
          bio: data.bio || '',
          avatarUrl: data.avatarUrl || '',
          linkedInUrl: data.linkedInUrl || '',
          githubUrl: data.githubUrl || '',
          portfolioUrl: data.portfolioUrl || '',
          availability: data.availability || 'Available',
          remote: data.remote || false,
          relocate: data.relocate || false,
          visaSponsorship: data.visaSponsorship || false,
          lastActive: data.lastActive || null,
          profileCompleted: data.profileCompleted || false,
          matchScore
        });
      });
      
      const combinedCandidates = [...candidates, ...newCandidates];
      setCandidates(combinedCandidates);
      applyFilters(combinedCandidates);
      
      if (candidatesSnapshot.docs.length > 0) {
        setLastVisible(candidatesSnapshot.docs[candidatesSnapshot.docs.length - 1]);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error fetching more candidates:", error);
      setError("Failed to load more candidates. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
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

const handleSkillFilterChange = (skill: string) => {
  setFilters(prev => {
    const updatedSkills = prev.skills.includes(skill)
      ? prev.skills.filter(s => s !== skill)
      : [...prev.skills, skill];
      
    return {
      ...prev,
      skills: updatedSkills
    };
  });
};

const resetFilters = () => {
  setSearchTerm('');
  setFilters({
    location: '',
    remote: false,
    relocate: false,
    visaSponsorship: false,
    minExperience: '',
    skills: [],
    availability: ''
  });
  setSelectedJob('');
};

const handleViewDetails = (candidate: Candidate) => {
  setSelectedCandidate(candidate);
  setShowModal(true);
};

// Fixed formatting functions with proper type annotations
const formatDate = (timestamp: any): string => {
  if (!timestamp) return 'N/A';
  
  let date: Date;
  if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else if (timestamp.toDate) {
    date = timestamp.toDate();
  } else {
    try {
      date = new Date(timestamp);
    } catch (err) {
      return 'Invalid date';
    }
  }
  
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short'
  });
};

const formatExperience = (years: number): string => {
  if (years < 1) {
    return '< 1 year';
  } else if (years === 1) {
    return '1 year';
  } else {
    return `${years} years`;
  }
};

// Fixed apply filters function
const applyFilters = (candidatesToFilter: Candidate[] = candidates) => {
  let filtered = [...candidatesToFilter];
  
  // Apply search term
  if (searchTerm) {
    const search = searchTerm.toLowerCase();
    filtered = filtered.filter(candidate => 
      candidate.name.toLowerCase().includes(search) || 
      candidate.title.toLowerCase().includes(search) || 
      candidate.location.toLowerCase().includes(search) ||
      candidate.skills.some(skill => skill.toLowerCase().includes(search))
    );
  }
  
  // Apply location filter
  if (filters.location) {
    filtered = filtered.filter(candidate => 
      candidate.location.toLowerCase().includes(filters.location.toLowerCase())
    );
  }
  
  // Apply remote filter
  if (filters.remote) {
    filtered = filtered.filter(candidate => candidate.remote);
  }
  
  // Apply relocate filter
  if (filters.relocate) {
    filtered = filtered.filter(candidate => candidate.relocate);
  }
  
  // Apply visa filter
  if (filters.visaSponsorship) {
    filtered = filtered.filter(candidate => candidate.visaSponsorship);
  }
  
  // Apply minimum experience filter
  if (filters.minExperience) {
    const minExp = parseInt(filters.minExperience);
    filtered = filtered.filter(candidate => candidate.experience >= minExp);
  }
  
  // Apply skills filter
  if (filters.skills.length > 0) {
    filtered = filtered.filter(candidate => 
      filters.skills.every(skill => candidate.skills.includes(skill))
    );
  }
  
  // Apply availability filter
  if (filters.availability) {
    filtered = filtered.filter(candidate => candidate.availability === filters.availability);
  }
  
  // Sort by match score if a job is selected
  if (selectedJob) {
    filtered.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
  }
  
  setFilteredCandidates(filtered);
};
  
  return (
    <div className="bg-gray-50 min-h-screen">
      <Header userRole={userRole} isLoggedIn={!!user} />
      
      {/* Hero section */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white pt-20 pb-14 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl font-bold mb-2">Talent Pool</h1>
            <p className="text-indigo-100 max-w-2xl">
              Browse candidates, filter by skills and experience, and find the perfect match for your open positions.
            </p>
          </motion.div>
        </div>
      </div>
      
      <div className="container mx-auto max-w-6xl px-4 -mt-8 pb-16">
        {/* Search, Filter, and Job Selection Bar */}
        <motion.div 
          className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="p-5">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search candidates by name, title, skills..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center"
                >
                  <svg className="h-5 w-5 mr-2 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                  </svg>
                  Filters
                </button>
                
                <select
                  value={selectedJob}
                  onChange={(e) => setSelectedJob(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <option value="">All Candidates</option>
                  {jobListings.map(job => (
                    <option key={job.id} value={job.id}>Match for: {job.title}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {showFilters && (
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
                    <label htmlFor="minExperience" className="block text-sm font-medium text-gray-700 mb-1">
                      Minimum Experience (years)
                    </label>
                    <select
                      id="minExperience"
                      name="minExperience"
                      value={filters.minExperience}
                      onChange={handleFilterChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    >
                      <option value="">Any experience</option>
                      <option value="1">1+ years</option>
                      <option value="3">3+ years</option>
                      <option value="5">5+ years</option>
                      <option value="7">7+ years</option>
                      <option value="10">10+ years</option>
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="availability" className="block text-sm font-medium text-gray-700 mb-1">
                      Availability
                    </label>
                    <select
                      id="availability"
                      name="availability"
                      value={filters.availability}
                      onChange={handleFilterChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    >
                      <option value="">Any availability</option>
                      <option value="Immediately">Immediately</option>
                      <option value="2 weeks">2 weeks notice</option>
                      <option value="1 month">1 month notice</option>
                      <option value="Passively looking">Passively looking</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 items-center mb-4">
                  <span className="text-sm font-medium text-gray-700">Preferences:</span>
                  
                  <label className="inline-flex items-center ml-4">
                    <input
                      type="checkbox"
                      name="remote"
                      checked={filters.remote}
                      onChange={handleFilterChange}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Remote</span>
                  </label>
                  
                  <label className="inline-flex items-center ml-4">
                    <input
                      type="checkbox"
                      name="relocate"
                      checked={filters.relocate}
                      onChange={handleFilterChange}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Willing to relocate</span>
                  </label>
                  
                  <label className="inline-flex items-center ml-4">
                    <input
                      type="checkbox"
                      name="visaSponsorship"
                      checked={filters.visaSponsorship}
                      onChange={handleFilterChange}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Needs visa sponsorship</span>
                  </label>
                </div>
                
                {skillOptions.length > 0 && (
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Skills (select multiple)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {skillOptions.slice(0, 15).map(skill => (
                        <button
                          key={skill}
                          onClick={() => handleSkillFilterChange(skill)}
                          className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm ${
                            filters.skills.includes(skill)
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          }`}
                        >
                          {skill}
                          {filters.skills.includes(skill) && (
                            <svg className="ml-1.5 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex justify-end mt-4">
                  <button
                    onClick={resetFilters}
                    className="text-sm text-indigo-600 hover:text-indigo-900"
                  >
                    Reset all filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
        
        {/* Results count */}
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-500">
            {filteredCandidates.length} {filteredCandidates.length === 1 ? 'candidate' : 'candidates'} found
          </p>
          
          <div className="flex items-center text-sm text-gray-500">
            {selectedJob && (
              <span className="mr-4">Sorted by match score for selected job</span>
            )}
          </div>
        </div>
        
        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
              </div>
            </div>
          </div>
        )}
        
        {/* Candidate cards */}
        {isLoading && candidates.length === 0 ? (
          <div className="flex justify-center py-12">
            <svg className="animate-spin h-12 w-12 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">
              {candidates.length > 0 ? 'No candidates match your filters' : 'No candidates found'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {candidates.length > 0 
                ? 'Try adjusting your search or filter criteria.' 
                : 'There are no candidate profiles in the database yet. Applicants need to complete their profiles to appear here.'}
            </p>
            <div className="mt-6">
              {candidates.length > 0 && (
                <button
                  onClick={resetFilters}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCandidates.map((candidate) => (
              <motion.div
                key={candidate.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                whileHover={{ y: -2 }}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <div className="h-12 w-12 rounded-full overflow-hidden bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                        {candidate.avatarUrl ? (
                          <Image src={candidate.avatarUrl} alt={candidate.name} width={48} height={48} className="h-full w-full object-cover" />
                        ) : (
                          candidate.name.charAt(0)
                        )}
                      </div>
                      <div className="ml-4">
                        <h3 className="text-lg font-semibold text-gray-900">{candidate.name}</h3>
                        <p className="text-sm text-gray-500">{candidate.title}</p>
                      </div>
                    </div>
                    
                    {selectedJob && (
                      <div className="flex flex-col items-center">
                        <div className="text-lg font-bold text-indigo-600">{candidate.matchScore}%</div>
                        <div className="text-xs text-gray-500">Match</div>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-start text-sm">
                    <svg className="h-5 w-5 text-gray-400 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-600">{candidate.location}</span>
                    </div>
                    
                    <div className="flex items-start text-sm">
                      <svg className="h-5 w-5 text-gray-400 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5z" />
                      </svg>
                      <span className="text-gray-600">{formatExperience(candidate.experience)} experience</span>
                    </div>
                    
                    {candidate.availability && (
                      <div className="flex items-start text-sm">
                        <svg className="h-5 w-5 text-gray-400 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        <span className="text-gray-600">Available {candidate.availability}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-1 mb-4">
                    {candidate.skills && candidate.skills.slice(0, 4).map((skill, index) => (
                      <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                        {skill}
                      </span>
                    ))}
                    {candidate.skills && candidate.skills.length > 4 && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        +{candidate.skills.length - 4} more
                      </span>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mt-4">
                    {candidate.remote && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Remote
                      </span>
                    )}
                    
                    {candidate.relocate && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Will Relocate
                      </span>
                    )}
                    
                    {candidate.visaSponsorship && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        Needs Visa
                      </span>
                    )}
                    
                    {candidate.lastActive && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Active {formatDate(candidate.lastActive)}
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-5 flex justify-between">
                    <button
                      onClick={() => handleViewDetails(candidate)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      View Profile
                    </button>
                    
                    <div className="flex space-x-2">
                      <Link
                        href={`/recruiter/messages?to=${candidate.id}`}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        <svg className="h-4 w-4 text-gray-500 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                        </svg>
                        Message
                      </Link>
                      
                      <div className="relative inline-block text-left">
                        <button 
                          type="button"
                          className="inline-flex items-center px-2 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          <svg className="h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
        
        {/* Load more */}
        {hasMore && filteredCandidates.length > 0 && (
          <div className="flex justify-center mt-8">
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
                  Load More Candidates
                  <svg className="ml-1 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </>
              )}
            </button>
          </div>
        )}
      </div>
      
      {/* Candidate detail modal */}
      {showModal && selectedCandidate && (
        <div className="fixed inset-0 overflow-y-auto z-50">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div 
              className="fixed inset-0 transition-opacity" 
              aria-hidden="true"
              onClick={() => setShowModal(false)}
            >
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="relative"
              >
                {/* Modal header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex justify-between items-center">
                  <h3 className="text-lg font-medium text-white">Candidate Profile</h3>
                  <button 
                    onClick={() => setShowModal(false)} 
                    className="text-white hover:text-indigo-100"
                  >
                    <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="p-6 max-h-[80vh] overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left column - Profile info */}
                    <div className="md:col-span-1">
                      <div className="flex flex-col items-center text-center mb-6">
                        <div className="h-24 w-24 rounded-full overflow-hidden bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white text-3xl font-bold mb-4">
                          {selectedCandidate.avatarUrl ? (
                            <Image src={selectedCandidate.avatarUrl} alt={selectedCandidate.name} width={96} height={96} className="h-full w-full object-cover" />
                          ) : (
                            selectedCandidate.name.charAt(0)
                          )}
                        </div>
                        
                        <h2 className="text-xl font-bold text-gray-900">{selectedCandidate.name}</h2>
                        <p className="text-gray-500">{selectedCandidate.title}</p>
                        
                        <div className="mt-2 flex items-center text-sm text-gray-500">
                          <svg className="h-4 w-4 text-gray-400 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                          </svg>
                          {selectedCandidate.location}
                        </div>
                        
                        {selectedJob && (
                          <div className="mt-4 bg-indigo-100 text-indigo-800 px-4 py-2 rounded-full">
                            <span className="font-medium">{selectedCandidate.matchScore}%</span> match for selected job
                          </div>
                        )}
                      </div>
                      
                      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                        <div>
                          <div className="text-sm font-medium text-gray-500">Experience</div>
                          <div className="font-medium">{formatExperience(selectedCandidate.experience)}</div>
                        </div>
                        
                        <div>
                          <div className="text-sm font-medium text-gray-500">Email</div>
                          <div className="font-medium">{selectedCandidate.email}</div>
                        </div>
                        
                        {selectedCandidate.phone && (
                          <div>
                            <div className="text-sm font-medium text-gray-500">Phone</div>
                            <div className="font-medium">{selectedCandidate.phone}</div>
                          </div>
                        )}
                        
                        <div>
                          <div className="text-sm font-medium text-gray-500">Availability</div>
                          <div className="font-medium">{selectedCandidate.availability}</div>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          {selectedCandidate.remote && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Remote
                            </span>
                          )}
                          
                          {selectedCandidate.relocate && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Will Relocate
                            </span>
                          )}
                          
                          {selectedCandidate.visaSponsorship && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              Needs Visa
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="mt-4 space-y-2">
                        {selectedCandidate.linkedInUrl && (
                          <a 
                            href={selectedCandidate.linkedInUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center text-sm text-indigo-600 hover:text-indigo-900"
                          >
                            <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 0C4.477 0 0 4.477 0 10c0 5.523 4.477 10 10 10 5.523 0 10-4.477 10-10 0-5.523-4.477-10-10-10zM7.5 14h-2v-6h2v6zm-1-6.75c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25zM15 14h-2v-3c0-.55-.45-1-1-1s-1 .45-1 1v3h-2v-6h2v1.5c.34-.72 1.07-1.5 1.75-1.5 1.55 0 2.25 1.15 2.25 2.75V14z"></path>
                            </svg>
                            LinkedIn Profile
                          </a>
                        )}
                        
                        {selectedCandidate.githubUrl && (
                          <a 
                            href={selectedCandidate.githubUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center text-sm text-indigo-600 hover:text-indigo-900"
                          >
                            <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 0C4.477 0 0 4.477 0 10c0 4.42 2.87 8.17 6.84 9.5.5.09.68-.22.68-.48v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02.8-.22 1.65-.33 2.5-.33.85 0 1.7.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85V19c0 .27.18.57.69.48C17.14 18.16 20 14.42 20 10c0-5.523-4.477-10-10-10z"></path>
                            </svg>
                            GitHub Profile
                          </a>
                        )}
                        
                        {selectedCandidate.portfolioUrl && (
                          <a 
                            href={selectedCandidate.portfolioUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center text-sm text-indigo-600 hover:text-indigo-900"
                          >
                            <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm9 4a1 1 0 10-2 0v6a1 1 0 102 0V7zm-3 2a1 1 0 10-2 0v4a1 1 0 102 0V9zm-3 3a1 1 0 10-2 0v1a1 1 0 102 0v-1z"></path>
                            </svg>
                            Portfolio
                          </a>
                        )}
                      </div>
                      
                      <div className="mt-6 flex flex-col space-y-3">
                        <Link
                          href={`/recruiter/messages?to=${selectedCandidate.id}`}
                          className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          <svg className="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                          </svg>
                          Message Candidate
                        </Link>
                        
                        <button
                          className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          <svg className="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                          </svg>
                          Add to Talent Pool
                        </button>
                      </div>
                    </div>
                    
                    {/* Right column - Skills, experience, education */}
                    <div className="md:col-span-2 space-y-6">
                      {/* Bio section */}
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">About</h3>
                        <div className="prose prose-indigo text-gray-700">
                          {selectedCandidate.bio.split('\n').map((paragraph, idx) => (
                            paragraph.trim() ? <p key={idx} className="mb-3">{paragraph}</p> : null
                          ))}
                        </div>
                      </div>
                      
                      {/* Skills section */}
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Skills</h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedCandidate.skills && selectedCandidate.skills.map((skill, idx) => (
                            <span key={idx} className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-indigo-100 text-indigo-800">
                              {skill}
                            </span>
                          ))}
                          {(!selectedCandidate.skills || selectedCandidate.skills.length === 0) && (
                            <p className="text-sm text-gray-500">No skills listed</p>
                          )}
                        </div>
                      </div>
                      
                      {/* Work experience */}
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-3">Work Experience</h3>
                        {selectedCandidate.workHistory && selectedCandidate.workHistory.length > 0 ? (
                          <div className="space-y-4">
                            {selectedCandidate.workHistory.map((job, idx) => (
                              <div key={idx} className="flex">
                                <div className="mr-4 flex-shrink-0">
                                  <div className="h-10 w-10 rounded-md bg-indigo-100 flex items-center justify-center text-indigo-600">
                                    <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                </div>
                                <div>
                                  <h4 className="text-base font-medium text-gray-900">{job.position}</h4>
                                  <p className="text-sm text-gray-500">{job.company}</p>
                                  <p className="text-sm text-gray-500">
                                    {formatDate(job.startDate)} – {job.endDate ? formatDate(job.endDate) : 'Present'}
                                  </p>
                                  <div className="mt-2 text-sm text-gray-700">
                                    {job.description && job.description.split('\n').map((paragraph, pidx) => (
                                      paragraph.trim() ? <p key={pidx} className="mb-2">{paragraph}</p> : null
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No work experience listed</p>
                        )}
                      </div>
                      
                      {/* Education */}
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-3">Education</h3>
                        {selectedCandidate.education && selectedCandidate.education.length > 0 ? (
                          <div className="space-y-4">
                            {selectedCandidate.education.map((edu, idx) => (
                              <div key={idx} className="flex">
                                <div className="mr-4 flex-shrink-0">
                                  <div className="h-10 w-10 rounded-md bg-indigo-100 flex items-center justify-center text-indigo-600">
                                    <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path d="M12 14l9-5-9-5-9 5 9 5z" />
                                      <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                                    </svg>
                                  </div>
                                </div>
                                <div>
                                  <h4 className="text-base font-medium text-gray-900">{edu.degree} in {edu.field}</h4>
                                  <p className="text-sm text-gray-500">{edu.institution}</p>
                                  <p className="text-sm text-gray-500">Graduated: {edu.year}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No education listed</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Modal footer */}
                <div className="bg-gray-50 px-6 py-4 flex justify-between">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Close
                  </button>
                  
                  <div className="flex space-x-3">
                    <Link
                      href={`/recruiter/messages?to=${selectedCandidate.id}`}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Message
                    </Link>
                    
                    <div className="relative inline-block text-left">
                      <button 
                        type="button"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Actions
                        <svg className="ml-1 -mr-1 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}