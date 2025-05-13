'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { collection, addDoc, serverTimestamp, getDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Header from '../../components/header';
import { debounce } from 'lodash';
import { useAuth } from '@/app/lib/authContext';
interface FormData {
  title: string;
  company: string;
  location: string;
  employmentType: string;
  experienceLevel: string;
  salary: {
    min: string;
    max: string;
    period: string;
    currency: string;
  };
  description: string;
  requirements: string;
  benefits: string;
  skills: string[];
  applicationType: string;
  externalUrl: string;
  remote: string;
  visaSponsorship: boolean;
  jobSimulation: string;
  keyQualifications: string[];
  [key: string]: any; // This allows for dynamic property access
}


export default function PostJob() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState<FormData>({
  title: '',
  company: '',
  location: '',
  employmentType: 'Full-time',
  experienceLevel: '',
  salary: { min: '', max: '', period: 'yearly', currency: 'USD' },
  description: '',
  requirements: '',
  benefits: '',
  skills: [],
  applicationType: 'internal',
  externalUrl: '',
  remote: 'no', // 'no', 'hybrid', 'fully'
  visaSponsorship: false,
  jobSimulation: '', // Added for AI job simulation
  keyQualifications: [], // Added for AI suggested qualifications
});

  const [currentSkill, setCurrentSkill] = useState('');
  const [recruiterInfo, setRecruiterInfo] = useState({
    name: '',
    company: '',
    email: ''
  });
  
  // AI Analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState({
    suggestedSkills: [] as string[],
    improvementTips: [] as string[],
    qualityScore: 0,
    jobSimulation: '',
  });
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);
  const [userRole, setUserRole] = useState<'applicant' | 'recruiter' | null>(null);
  

  // Check auth state
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
          
          // Set recruiter info
          setRecruiterInfo(prev => ({
            ...prev,
            email: user.email || '',
            name: user.displayName || '',
            company: userData.company || ''
          }));
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        router.push('/signin');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserRoleAndData();
  }, [user, authLoading, router]);

  // Set up template handling if template param exists
  useEffect(() => {
    const loadTemplate = async () => {
      // Only proceed if we have a user and they're a recruiter
      if (!user || userRole !== 'recruiter') return;
      
      // Get template ID from URL params if it exists
      const urlParams = new URLSearchParams(window.location.search);
      const templateId = urlParams.get('template');
      
      if (templateId) {
        try {
          setIsLoading(true);
          const jobDoc = await getDoc(doc(db, "jobs", templateId));
          
          if (jobDoc.exists()) {
            const jobData = jobDoc.data();
            // Copy template data but remove specific fields
            const { id, recruiterId, createdAt, updatedAt, applicants, views, status, ...templateData } = jobData;
            
            setFormData(prev => ({
              ...prev,
              ...templateData,
              title: `${templateData.title} (Copy)`,
            }));
            
            setMessage({ 
              type: 'info', 
              text: 'Job template loaded. You can modify it before posting.'
            });
          }
        } catch (error) {
          console.error("Error loading template:", error);
          setMessage({ 
            type: 'error', 
            text: 'Failed to load job template. Please create a new job.'
          });
        } finally {
          setIsLoading(false);
        }
      }
    };
    
    loadTemplate();
  }, [user, userRole]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  const { name, value } = e.target;
  
  // Handle nested objects like salary
  if (name.includes('.')) {
    const [parent, child] = name.split('.');
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...(prev[parent] as object), // Cast to object to resolve the spread operator issue
        [child]: value
      }
    }));
  } else {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // If description is updated, trigger AI analysis
    if (name === 'description' && value.length > 100) {
      debouncedAnalyzeJob(value);
    }
  }
};
  // Analyze job description with AI
  const analyzeJobDescription = async (description: string) => {
    if (description.length < 100) return;
    
    setIsAnalyzing(true);
    
    try {
      const response = await fetch('/api/job-analyzer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to analyze job description');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setAiSuggestions({
          suggestedSkills: data.skills || [],
          improvementTips: data.improvementTips || [],
          qualityScore: data.qualityScore || 0,
          jobSimulation: data.jobSimulation || '',
        });
        
        // Add job simulation to the form data
        setFormData(prev => ({
          ...prev,
          jobSimulation: data.jobSimulation || '',
          keyQualifications: data.keyQualifications || [],
        }));
        
        setShowAiSuggestions(true);
      }
    } catch (error) {
      console.error("Error analyzing job:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Debounce the analysis to avoid too many API calls
  const debouncedAnalyzeJob = useCallback(
    debounce((description: string) => {
      analyzeJobDescription(description);
    }, 1000),
    []
  );

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const handleAddSkill = (e?: React.MouseEvent | React.KeyboardEvent) => {
  // Prevent form submission if this was triggered by an event
  if (e) {
    e.preventDefault();
  }
  
  if (currentSkill.trim() && !formData.skills.includes(currentSkill.trim())) {
    setFormData(prev => ({
      ...prev,
      skills: [...prev.skills, currentSkill.trim()]
    }));
    setCurrentSkill('');
  }
};

  const handleAddSuggestedSkill = (skill: string) => {
    if (!formData.skills.includes(skill)) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, skill]
      }));
      
      // Remove from suggested skills
      setAiSuggestions(prev => ({
        ...prev,
        suggestedSkills: prev.suggestedSkills.filter(s => s !== skill)
      }));
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(skill => skill !== skillToRemove)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      if (!user) {
        router.push('/signin');
        return;
      }

      // Create job posting in Firestore
      const jobData = {
        ...formData,
        recruiterId: user.uid,
        recruiterEmail: user.email,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        applicants: 0,
        views: 0
      };

      const docRef = await addDoc(collection(db, "jobs"), jobData);
      
      setMessage({ 
        type: 'success', 
        text: 'Job posting created successfully! Redirecting to job detail page...' 
      });
      
      // Redirect to job detail page instead of dashboard
      setTimeout(() => {
        router.push(`/recruiter/jobs/${docRef.id}`);
      }, 2000);
      
    } catch (error) {
      console.error("Error creating job posting:", error);
      setMessage({ 
        type: 'error', 
        text: 'Failed to create job posting. Please try again.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center">
        <div className="py-24">
          <svg className="animate-spin h-12 w-12 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Header userRole={userRole} isLoggedIn={!!user} />
      
      {/* Hero section with gradient */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white pt-20 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl font-bold mb-2">Post a New Job</h1>
            <p className="text-indigo-100">Create a compelling job posting to attract top talent</p>
          </motion.div>
        </div>
      </div>
      
      <div className="container mx-auto max-w-4xl px-4 -mt-8 pb-16">
        <motion.div 
          className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {message.text && (
                <div className={`p-4 rounded-md ${
                  message.type === 'success' ? 'bg-green-50 text-green-800' : 
                  message.type === 'error' ? 'bg-red-50 text-red-800' : 
                  'bg-blue-50 text-blue-800'
                }`}>
                  {message.text}
                </div>
              )}
              
              {/* Job Basics */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Job Details</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                      Job Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="title"
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      required
                      placeholder="e.g. Senior Frontend Developer"
                    />
                  </div>
                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
                      Company Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="company"
                      name="company"
                      value={formData.company}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                      Location <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="location"
                      name="location"
                      value={formData.location}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      required
                      placeholder="e.g. San Francisco, CA"
                    />
                  </div>
                  <div>
                    <label htmlFor="employmentType" className="block text-sm font-medium text-gray-700 mb-1">
                      Employment Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="employmentType"
                      name="employmentType"
                      value={formData.employmentType}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    >
                      <option value="Full-time">Full-time</option>
                      <option value="Part-time">Part-time</option>
                      <option value="Contract">Contract</option>
                      <option value="Temporary">Temporary</option>
                      <option value="Internship">Internship</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="experienceLevel" className="block text-sm font-medium text-gray-700 mb-1">
                      Experience Level <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="experienceLevel"
                      name="experienceLevel"
                      value={formData.experienceLevel}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    >
                      <option value="">Select experience level</option>
                      <option value="Entry level">Entry level</option>
                      <option value="Mid level">Mid level</option>
                      <option value="Senior level">Senior level</option>
                      <option value="Executive">Executive</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="remote" className="block text-sm font-medium text-gray-700 mb-1">
                      Remote Work <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="remote"
                      name="remote"
                      value={formData.remote}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    >
                      <option value="no">No remote work</option>
                      <option value="hybrid">Hybrid remote</option>
                      <option value="fully">Fully remote</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Salary Range (Optional)
                    </label>
                    <div className="flex space-x-3 items-center">
                      <div className="flex-1">
                        <input
                          type="number"
                          name="salary.min"
                          value={formData.salary.min}
                          onChange={handleChange}
                          placeholder="Min"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <span className="text-gray-500">-</span>
                      <div className="flex-1">
                        <input
                          type="number"
                          name="salary.max"
                          value={formData.salary.max}
                          onChange={handleChange}
                          placeholder="Max"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-end space-x-3">
                    <div className="flex-1">
                      <label htmlFor="salary.currency" className="block text-sm font-medium text-gray-700 mb-1">
                        Currency
                      </label>
                      <select
                        id="salary.currency"
                        name="salary.currency"
                        value={formData.salary.currency}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                        <option value="CAD">CAD</option>
                        <option value="AUD">AUD</option>
                        <option value="INR">INR</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label htmlFor="salary.period" className="block text-sm font-medium text-gray-700 mb-1">
                        Period
                      </label>
                      <select
                        id="salary.period"
                        name="salary.period"
                        value={formData.salary.period}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="yearly">Yearly</option>
                        <option value="monthly">Monthly</option>
                        <option value="weekly">Weekly</option>
                        <option value="hourly">Hourly</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Job Description */}
              <div className="space-y-4 pt-6 border-t border-gray-100">
                <h3 className="text-lg font-medium text-gray-900">Job Description</h3>
                
                <div className="relative">
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    Job Description <span className="text-red-500">*</span>
                    {isAnalyzing && (
                      <span className="ml-2 inline-flex items-center text-xs text-indigo-500">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        AI is analyzing your description...
                      </span>
                    )}
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows={6}
                    value={formData.description}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    required
                    placeholder="Describe the role, responsibilities, and your company..."
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Pro tip: Be specific about the role and what success looks like. Include information about your company and culture.
                  </p>
                </div>
                
                {/* AI Suggestions Section */}
                {showAiSuggestions && (
                  <div className="bg-gradient-to-r from-indigo-50 to-violet-50 rounded-lg p-4 border border-indigo-100 mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-md font-medium text-indigo-800 flex items-center">
                        <svg className="h-5 w-5 text-indigo-600 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                        </svg>
                        AI Job Analysis
                      </h4>
                      <div className="flex items-center">
                        <div className="bg-white rounded-full w-24 h-3 overflow-hidden">
                          <div 
                            className={`h-full ${
                              aiSuggestions.qualityScore >= 80 ? 'bg-green-500' : 
                              aiSuggestions.qualityScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                            }`} 
                            style={{ width: `${aiSuggestions.qualityScore}%` }}
                          ></div>
                        </div>
                        <span className="ml-2 text-xs font-medium">
                          {aiSuggestions.qualityScore}% Complete
                        </span>
                      </div>
                    </div>
                    
                    {/* Suggested Skills */}
                    {aiSuggestions.suggestedSkills.length > 0 && (
                      <div className="mb-3">
                        <h5 className="text-sm font-medium text-indigo-700 mb-2">Suggested Skills:</h5>
                        <div className="flex flex-wrap gap-2">
                          {aiSuggestions.suggestedSkills.slice(0, 8).map((skill, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => handleAddSuggestedSkill(skill)}
                              className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-white text-indigo-800 hover:bg-indigo-100 transition-colors"
                            >
                              + {skill}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Improvement Tips */}
                    {aiSuggestions.improvementTips.length > 0 && (
                      <div className="mb-3">
                        <h5 className="text-sm font-medium text-indigo-700 mb-2">Suggested Improvements:</h5>
                        <ul className="text-sm text-indigo-900 space-y-1">
                          {aiSuggestions.improvementTips.map((tip, index) => (
                            <li key={index} className="flex items-start">
                              <svg className="h-4 w-4 text-indigo-600 mr-1 mt-0.5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                              </svg>
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                
                <div>
                  <label htmlFor="requirements" className="block text-sm font-medium text-gray-700 mb-1">
                    Requirements <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="requirements"
                    name="requirements"
                    rows={4}
                    value={formData.requirements}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    required
                    placeholder="List the requirements for this position..."
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Add must-have qualifications, experience, and skills needed for the role.
                  </p>
                </div>
                
                <div>
                  <label htmlFor="benefits" className="block text-sm font-medium text-gray-700 mb-1">
                    Benefits & Perks
                  </label>
                  <textarea
                    id="benefits"
                    name="benefits"
                    rows={4}
                    value={formData.benefits}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="List benefits, perks, and other incentives..."
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Highlight healthcare, flexible hours, remote options, professional development, etc.
                  </p>
                </div>
                
               <div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Key Skills <span className="text-red-500">*</span>
  </label>
  <div className="flex flex-wrap gap-2 mb-2">
    {formData.skills.map((skill) => (
      <span 
        key={skill} 
        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800"
      >
        {skill}
        <button
          type="button"
          onClick={() => handleRemoveSkill(skill)}
          className="ml-2 inline-flex text-indigo-600 hover:text-indigo-800 focus:outline-none"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleAddSkill(e);
        }
      }}
      className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
      placeholder="Add a skill (e.g. React, Python, Project Management)"
    />
    <button
      type="button"
      onClick={(e) => handleAddSkill(e)}
      className="px-4 py-2 bg-indigo-600 text-white rounded-r-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
    >
      Add
    </button>
  </div>
  <p className="mt-1 text-sm text-gray-500">
    Add relevant skills to help our AI match the right candidates.
  </p>
</div>
              </div>
              
              {/* Job Simulation Section (AI Generated) */}
              {formData.jobSimulation && (
                <div className="space-y-4 pt-6 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">AI-Generated Job Simulation</h3>
                    <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full">
                      AI Generated
                    </span>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-sm text-gray-700 mb-2">
                      This job simulation helps candidates understand what a day in this role might look like. It will be shown to applicants to help them prepare.
                    </p>
                    
                    <textarea
                      name="jobSimulation"
                      rows={6}
                      value={formData.jobSimulation}
                      onChange={handleChange}
                      className="w-full px-3 py-2 mt-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="AI will generate a job simulation based on your description..."
                    />
                  </div>
                </div>
              )}
              
              {/* Additional Options */}
              <div className="space-y-4 pt-6 border-t border-gray-100">
                <h3 className="text-lg font-medium text-gray-900">Additional Options</h3>
                
                <div>
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="visaSponsorship"
                        name="visaSponsorship"
                        type="checkbox"
                        checked={formData.visaSponsorship}
                        onChange={handleCheckboxChange}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="visaSponsorship" className="font-medium text-gray-700">Visa Sponsorship Available</label>
                      <p className="text-gray-500">Check this if your company can sponsor work visas for this position.</p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label htmlFor="applicationType" className="block text-sm font-medium text-gray-700 mb-1">
                    Application Method <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="applicationType"
                    name="applicationType"
                    value={formData.applicationType}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  >
                    <option value="internal">Apply through Job Nexus</option>
                    <option value="external">Apply through external website</option>
                  </select>
                  
                  {formData.applicationType === 'external' && (
                    <div className="mt-3">
                      <label htmlFor="externalUrl" className="block text-sm font-medium text-gray-700 mb-1">
                        External Application URL <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="url"
                        id="externalUrl"
                        name="externalUrl"
                        value={formData.externalUrl}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="https://company.com/careers/job-application"
                        required={formData.applicationType === 'external'}
                      />
                    </div>
                  )}
                </div>
              </div>
              
              {/* AI Assistant */}
              <div className="bg-violet-50 rounded-lg p-4 border border-violet-100">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-violet-800">AI Job Optimization</h3>
                    <div className="mt-2 text-sm text-violet-700">
                      <p>
                        Our AI has analyzed your job posting and found it to be {aiSuggestions.qualityScore >= 80 ? 'highly effective' : aiSuggestions.qualityScore >= 50 ? 'somewhat effective' : 'needing improvements'}.
                        {aiSuggestions.qualityScore < 80 && ' Consider adding more details about the role responsibilities and requirements.'}
                      </p>
                      <p className="mt-2">
                        Job posts with detailed descriptions, clear requirements, and specific benefits receive 75% more qualified applicants.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Submit */}
              <div className="pt-6 border-t border-gray-100 flex justify-end">
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`inline-flex justify-center py-3 px-6 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                    isLoading ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Posting Job...
                    </>
                  ) : (
                    'Post Job'
                  )}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}