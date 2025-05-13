'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { doc, getDoc, updateDoc,  arrayUnion } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import Header from '@/app/components/header';
import Link from 'next/link';
import ResumeDropZone from '@/app/components/resumeDropZone'; // Import the ResumeDropZone component
import { useAuth } from '@/app/lib/authContext'; // Import the auth context

export default function ResumeBuilder() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams?.get('jobId');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Use the auth context
  const { user, loading: authLoading } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isJobLoading, setIsJobLoading] = useState(!!jobId);
  const [job, setJob] = useState<any>(null);
  const [savedResumes, setSavedResumes] = useState<any[]>([]);
  const [currentResume, setCurrentResume] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [notification, setNotification] = useState({ type: '', message: '' });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [suggestedSkills, setSuggestedSkills] = useState<string[]>([]);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [userRole, setUserRole] = useState<'applicant' | 'recruiter'>('applicant');
  
  // Resume form state
  const [resumeData, setResumeData] = useState({
    name: '',
    title: '',
    email: '',
    phone: '',
    location: '',
    summary: '',
    skills: [] as string[],
    workExperience: [{ 
      company: '', 
      position: '', 
      startDate: '', 
      endDate: '', 
      current: false,
      description: '' 
    }],
    education: [{ 
      institution: '', 
      degree: '', 
      field: '', 
      startDate: '', 
      endDate: '', 
      current: false 
    }],
    projects: [{ 
      name: '', 
      description: '', 
      skills: [] as string[], 
      url: '' 
    }],
    certifications: [{ 
      name: '', 
      issuer: '', 
      date: '', 
      url: '' 
    }]
  });
  
  // Fetch user data, saved resumes, and job details
  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      // Don't do anything if auth is still loading
      if (authLoading) return;
      
      // If no user is authenticated, redirect to sign in
      if (!user) {
        router.push('/signin');
        return;
      }
      
      try {
        // Fetch user profile
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Set user role
          setUserRole(userData.role || 'applicant');
          
          // Update form with user data if available
          if (userData.name || userData.email) {
            setResumeData(prev => ({
              ...prev,
              name: userData.name || prev.name,
              email: userData.email || user.email || prev.email,
              phone: userData.phone || prev.phone,
              location: userData.location || prev.location
            }));
          }
          
          // Get saved resumes
          if (userData.resumes && userData.resumes.length > 0) {
            setSavedResumes(userData.resumes);
          }
        }
        
        // Fetch job details if jobId is provided
        if (jobId) {
          const jobDoc = await getDoc(doc(db, "jobs", jobId));
          if (jobDoc.exists()) {
            const jobData = jobDoc.data();
            setJob(jobData);
            
            // Extract skills from the job for suggestions
            if (jobData.skills && jobData.skills.length > 0) {
              setSuggestedSkills(jobData.skills);
            }
          }
          setIsJobLoading(false);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        setNotification({
          type: 'error',
          message: 'Error loading user data'
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuthAndFetchData();
  }, [router, jobId, user, authLoading]);
  
  // Handle skill selection
  const toggleSkill = (skill: string) => {
    setResumeData(prev => {
      const skills = [...prev.skills];
      const index = skills.indexOf(skill);
      
      if (index === -1) {
        skills.push(skill);
      } else {
        skills.splice(index, 1);
      }
      
      return {
        ...prev,
        skills
      };
    });
  };
  
  // Add/remove work experience
  const addWorkExperience = () => {
    setResumeData(prev => ({
      ...prev,
      workExperience: [
        ...prev.workExperience,
        { company: '', position: '', startDate: '', endDate: '', current: false, description: '' }
      ]
    }));
  };
  
  const removeWorkExperience = (index: number) => {
    setResumeData(prev => ({
      ...prev,
      workExperience: prev.workExperience.filter((_, i) => i !== index)
    }));
  };
  
  // Add/remove education
  const addEducation = () => {
    setResumeData(prev => ({
      ...prev,
      education: [
        ...prev.education,
        { institution: '', degree: '', field: '', startDate: '', endDate: '', current: false }
      ]
    }));
  };
  
  const removeEducation = (index: number) => {
    setResumeData(prev => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== index)
    }));
  };
  
  // Add/remove project
  const addProject = () => {
    setResumeData(prev => ({
      ...prev,
      projects: [
        ...prev.projects,
        { name: '', description: '', skills: [], url: '' }
      ]
    }));
  };
  
  const removeProject = (index: number) => {
    setResumeData(prev => ({
      ...prev,
      projects: prev.projects.filter((_, i) => i !== index)
    }));
  };
  
  // Add/remove certification
  const addCertification = () => {
    setResumeData(prev => ({
      ...prev,
      certifications: [
        ...prev.certifications,
        { name: '', issuer: '', date: '', url: '' }
      ]
    }));
  };
  
  const removeCertification = (index: number) => {
    setResumeData(prev => ({
      ...prev,
      certifications: prev.certifications.filter((_, i) => i !== index)
    }));
  };
  
  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, section?: string, index?: number, field?: string) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    
    if (section && index !== undefined && field) {
      // Update nested field in a section array
      setResumeData(prev => {
        const updatedSection = [...prev[section as keyof typeof prev] as any[]];
        if (type === 'checkbox') {
          updatedSection[index] = { ...updatedSection[index], [field]: checked };
        } else {
          updatedSection[index] = { ...updatedSection[index], [field]: value };
        }
        
        return {
          ...prev,
          [section]: updatedSection
        };
      });
    } else {
      // Update top-level field
      setResumeData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };
  
  // Handle project skill changes
  const handleProjectSkillChange = (index: number, skills: string[]) => {
    setResumeData(prev => {
      const updatedProjects = [...prev.projects];
      updatedProjects[index] = { ...updatedProjects[index], skills };
      
      return {
        ...prev,
        projects: updatedProjects
      };
    });
  };
  
  // Save resume
  const saveResume = async () => {
    if (!user) {
      router.push('/signin');
      return;
    }
    
    try {
      // Generate resume name if not provided
      const resumeName = resumeData.title || `Resume - ${new Date().toLocaleDateString()}`;
      
      // Create resume object
      const newResume = {
        id: currentResume?.id || `resume_${Date.now()}`,
        name: resumeName,
        data: resumeData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Update user document with the new resume
      if (currentResume) {
        // Update existing resume
        await updateDoc(doc(db, "users", user.uid), {
          "resumes": savedResumes.map(r => r.id === currentResume.id ? newResume : r)
        });
      } else {
        // Add new resume
        await updateDoc(doc(db, "users", user.uid), {
          "resumes": arrayUnion(newResume)
        });
      }
      
      // Update local state
      if (currentResume) {
        setSavedResumes(prev => prev.map(r => r.id === currentResume.id ? newResume : r));
      } else {
        setSavedResumes(prev => [...prev, newResume]);
      }
      
      setCurrentResume(newResume);
      setNotification({
        type: 'success',
        message: 'Resume saved successfully!'
      });
      
      // Clear notification after 3 seconds
      setTimeout(() => {
        setNotification({ type: '', message: '' });
      }, 3000);
    } catch (error) {
      console.error("Error saving resume:", error);
      setNotification({
        type: 'error',
        message: 'Error saving resume'
      });
    }
  };
  
  // Load saved resume
  const loadResume = (resume: any) => {
    setCurrentResume(resume);
    setResumeData(resume.data);
    setIsEditing(true);
  };
  
  // Create new resume
  const createNewResume = () => {
    setCurrentResume(null);
    setResumeData({
      name: user?.displayName || '',
      title: '',
      email: user?.email || '',
      phone: '',
      location: '',
      summary: '',
      skills: [],
      workExperience: [{ 
        company: '', 
        position: '', 
        startDate: '', 
        endDate: '', 
        current: false,
        description: '' 
      }],
      education: [{ 
        institution: '', 
        degree: '', 
        field: '', 
        startDate: '', 
        endDate: '', 
        current: false 
      }],
      projects: [{ 
        name: '', 
        description: '', 
        skills: [], 
        url: '' 
      }],
      certifications: [{ 
        name: '', 
        issuer: '', 
        date: '', 
        url: '' 
      }]
    });
    setIsEditing(true);
  };
  
  // Handle resume file upload and parsing - main function for both file input and drag-drop
  const handleResumeUpload = async (file: File) => {
    setResumeFile(file);
    setIsUploading(true);
    setUploadProgress(10);
    
    // Progress animation interval
    let progressInterval: NodeJS.Timeout | null = null;
    
    try {
      // Create form data for API request
      const formData = new FormData();
      formData.append('file', file);
      
      // Show progress to user while parsing
      progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            if (progressInterval) clearInterval(progressInterval);
            return 90;
          }
          return prev + 5;
        });
      }, 300);
      
      console.log('Sending resume to parser API...', file.name, file.type);
      
      // Send file to server-side API for parsing
      const response = await fetch('/api/resume-parser', {
        method: 'POST',
        body: formData,
      });
      
      // Clear the progress interval
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      
      // Handle response
      if (!response.ok) {
        const errorData = await response.json();
        console.error('API error response:', errorData);
        throw new Error(errorData.error || 'Failed to parse resume');
      }
      
      const result = await response.json();
      console.log('Parser API response:', result);
      
      if (!result.success || !result.data) {
        throw new Error('Failed to extract resume data');
      }
      
      // Update progress to near completion
      setUploadProgress(95);
      
      // Get the parsed resume data
      const parsedResumeData = result.data;
      const fileUrl = result.fileUrl || null;
      
      console.log('Parsed resume data:', parsedResumeData);
      
      // Fill in any missing information with current user data
      if (user) {
        if (!parsedResumeData.name || parsedResumeData.name.trim() === '') {
          parsedResumeData.name = user.displayName || '';
        }
        
        if (!parsedResumeData.email || parsedResumeData.email.trim() === '') {
          parsedResumeData.email = user.email || '';
        }
      }
      
      // Update resume data state
      setResumeData(parsedResumeData);
      setUploadProgress(100);
      
      // Create a new resume entry
      const newResume = {
        id: `resume_${Date.now()}`,
        name: `Uploaded Resume - ${file.name}`,
        data: parsedResumeData,
        createdAt: new Date(),
        updatedAt: new Date(),
        fileUrl: fileUrl
      };
      
      setCurrentResume(newResume);
      
      // Save to user's resumes collection in Firestore
      if (user) {
        await updateDoc(doc(db, "users", user.uid), {
          "resumes": arrayUnion(newResume)
        });
        
        setSavedResumes(prev => [...prev, newResume]);
      }
      
      // Check if we have a job ID and generate job-specific skill suggestions
      if (job && job.skills && job.skills.length > 0) {
        // Find matched and missing skills
        const matchedSkills = parsedResumeData.skills.filter(skill => 
          job.skills.some(jobSkill => 
            jobSkill.toLowerCase() === skill.toLowerCase()
          )
        );
        
        const missingSkills = job.skills.filter(skill => 
          !parsedResumeData.skills.some(resumeSkill => 
            resumeSkill.toLowerCase() === skill.toLowerCase()
          )
        );
        
        // Add job-specific skills to suggestions
        setSuggestedSkills(prevSkills => {
          const allSkills = [...prevSkills];
          missingSkills.forEach(skill => {
            if (!allSkills.includes(skill)) {
              allSkills.push(skill);
            }
          });
          return allSkills;
        });
        
        // Show a notification about the job match
        const matchPercentage = Math.round((matchedSkills.length / job.skills.length) * 100);
        setNotification({
          type: 'info',
          message: `Your resume matches ${matchPercentage}% of the skills required for this job. Consider adding the suggested skills.`
        });
      } else {
        setNotification({
          type: 'success',
          message: 'Resume uploaded and parsed successfully!'
        });
      }
      
      // Switch to editing mode
      setIsEditing(true);
      
    } catch (error) {
      // Clear the progress interval if it exists
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      
      console.error("Error parsing resume:", error);
      
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Error parsing resume file'
      });
    } finally {
      setIsUploading(false);
      
      // Ensure progress is reset after a delay for UI feedback
      setTimeout(() => {
        if (uploadProgress !== 100) {
          setUploadProgress(0);
        }
      }, 1000);
      
      // Clear notification after 5 seconds
      setTimeout(() => {
        setNotification({ type: '', message: '' });
      }, 5000);
    }
  };
  
  // Handle file input change (for file selector)
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleResumeUpload(e.target.files[0]);
    }
  };
  
  // Generate AI-enhanced resume based on job requirements
  const generateAIResume = async () => {
    if (!job) {
      setNotification({
        type: 'error',
        message: 'No job selected for optimization'
      });
      return;
    }

    // Check if we have a resume to enhance
    if (!currentResume) {
      setNotification({
        type: 'error',
        message: 'Please create or upload a resume first'
      });
      return;
    }

    setAiGenerating(true);
    
    try {
      // Check if user is authenticated
      if (!user) {
        router.push('/signin');
        return;
      }

      // Create a payload with the current resume data and job requirements
      const payload = {
        resume: resumeData,
        job: {
          title: job.title,
          company: job.company,
          description: job.description,
          requirements: job.requirements,
          skills: job.skills,
          experienceLevel: job.experienceLevel
        }
      };

      // Call the AI optimization API
      const response = await fetch('/api/resume-enhancer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to enhance resume');
      }

      // Get the enhanced resume
      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error('Failed to enhance resume');
      }

      // Update the resume data with AI enhancements
      const enhancedResumeData = result.data;

      // Create a new AI-enhanced resume object
      const enhancedResume = {
        id: `resume_${Date.now()}`,
        name: `${job.title} at ${job.company} - Optimized Resume`,
        data: enhancedResumeData,
        createdAt: new Date(),
        updatedAt: new Date(),
        isAiEnhanced: true
      };

      // Save to user's resumes collection in Firestore
      await updateDoc(doc(db, "users", user.uid), {
        "resumes": arrayUnion(enhancedResume)
      });

      // Update local state
      setSavedResumes(prev => [...prev, enhancedResume]);
      setCurrentResume(enhancedResume);
      setResumeData(enhancedResumeData);
      setIsEditing(true);

      // Show success notification
      setNotification({
        type: 'success',
        message: `Resume optimized for ${job.title} at ${job.company}!`
      });

    } catch (error) {
      console.error("Error enhancing resume:", error);
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Error enhancing resume'
      });
    } finally {
      setAiGenerating(false);
      
      // Clear notification after 5 seconds
      setTimeout(() => {
        setNotification({ type: '', message: '' });
      }, 5000);
    }
  };

  // Delete resume
  const deleteResume = async (resumeId: string) => {
    if (!user) {
      router.push('/signin');
      return;
    }

    try {
      // Remove resume from saved list
      const updatedResumes = savedResumes.filter(r => r.id !== resumeId);
      
      // Update Firestore
      await updateDoc(doc(db, "users", user.uid), {
        "resumes": updatedResumes
      });
      
      // Update local state
      setSavedResumes(updatedResumes);
      
      // If the currently selected resume is being deleted, clear it
      if (currentResume && currentResume.id === resumeId) {
        setCurrentResume(null);
        setIsEditing(false);
      }
      
      setNotification({
        type: 'success',
        message: 'Resume deleted successfully'
      });
      
      // Clear notification after 3 seconds
      setTimeout(() => {
        setNotification({ type: '', message: '' });
      }, 3000);
    } catch (error) {
      console.error("Error deleting resume:", error);
      setNotification({
        type: 'error',
        message: 'Error deleting resume'
      });
    }
  };

// Export resume to PDF
const exportResumeToPDF = () => {
  if (!currentResume) {
    setNotification({
      type: 'error',
      message: 'No resume selected for export'
    });
    return;
  }
  
  // Set notification for better UX
  setNotification({
    type: 'info',
    message: 'Preparing PDF for download...'
  });
  
  try {
    // Delay to allow notification to show
    setTimeout(async () => {
      try {
        // Create a data object with resume information
        const pdfData = {
          resumeData,
          includeHeader: true,
          templateStyle: 'professional' // or 'modern', 'minimal', etc.
        };
        
        // Call the PDF generation API
        const response = await fetch('/api/generate-pdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(pdfData)
        });
        
        if (!response.ok) {
          throw new Error('Failed to generate PDF');
        }
        
        // Get the PDF blob
        const blob = await response.blob();
        
        // Create a download link and click it
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${resumeData.name} - Resume.pdf`;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        setNotification({
          type: 'success',
          message: 'Resume downloaded as PDF'
        });
      } catch (error) {
        console.error("Error generating PDF:", error);
        
        // Fallback: If API fails, try client-side PDF generation
        try {
          const resumeElement = document.querySelector('.resume-preview') as HTMLElement;
          if (!resumeElement) throw new Error('Resume preview element not found');
          
          // Use html2canvas and jsPDF for client-side generation
          // Note: You would need to import these libraries
          // import html2canvas from 'html2canvas';
          // import { jsPDF } from 'jspdf';
          
          /*
          html2canvas(resumeElement).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const width = pdf.internal.pageSize.getWidth();
            const height = (canvas.height * width) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, width, height);
            pdf.save(`${resumeData.name} - Resume.pdf`);
            
            setNotification({
              type: 'success',
              message: 'Resume downloaded as PDF (client-side)'
            });
          });
          */
          
          // Since we haven't imported the libraries, show a message
          setNotification({
            type: 'error',
            message: 'PDF generation failed. Please try again later.'
          });
        } catch (fallbackError) {
          console.error("Client-side PDF generation also failed:", fallbackError);
          setNotification({
            type: 'error',
            message: 'PDF generation failed. Please try again later.'
          });
        }
      }
      
      // Clear notification after 3 seconds
      setTimeout(() => {
        setNotification({ type: '', message: '' });
      }, 3000);
    }, 500);
  } catch (error) {
    console.error("Error in PDF export process:", error);
    setNotification({
      type: 'error',
      message: 'Error exporting resume to PDF'
    });
  }
};

// Preview/Edit toggle function
const previewResume = () => {
  // Toggle between editing and preview modes
  setIsEditing(!isEditing);
  
  // If switching to preview mode and we have unsaved changes, ask to save
  if (isEditing && currentResume) {
    const hasChanges = JSON.stringify(resumeData) !== JSON.stringify(currentResume.data);
    
    if (hasChanges) {
      const confirmSave = window.confirm('You have unsaved changes. Would you like to save before previewing?');
      
      if (confirmSave) {
        saveResume();
      }
    }
  }
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
          notification.type === 'info' ? 'bg-blue-50 text-blue-800' : 'bg-gray-50 text-gray-800'
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
                  className={`inline-flex rounded-md p-1.5 ${
                    notification.type === 'success' ? 'text-green-500 hover:bg-green-100' : 
                    notification.type === 'error' ? 'text-red-500 hover:bg-red-100' :
                    'text-blue-500 hover:bg-blue-100'
                  } focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    notification.type === 'success' ? 'focus:ring-green-500' : 
                    notification.type === 'error' ? 'focus:ring-red-500' : 
                    'focus:ring-blue-500'
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
      
      {/* Hero section */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl font-bold mb-4">AI-Powered Resume Builder</h1>
            <p className="text-indigo-100 text-xl max-w-2xl">
              Create and customize your resume to match job requirements and improve your chances of getting hired.
            </p>
            
            {job && (
              <div className="mt-4 p-4 bg-white bg-opacity-10 rounded-lg">
                <div className="flex items-center">
                  <svg className="h-6 w-6 text-indigo-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <p className="ml-2 text-white">
                    Optimizing for: <span className="font-bold">{job.title}</span> at <span className="font-bold">{job.company}</span>
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
      
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <motion.div
              className="bg-white rounded-xl shadow-sm p-6 mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
              
              <div className="space-y-4">
                <button
                  onClick={createNewResume}
                  className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Create New Resume
                </button>
                
                {/* Replace the old file upload button with a hidden input */}
                <input
                  id="resumeUpload"
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={handleFileInputChange}
                />
                
                {/* Add ResumeDropZone component */}
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Upload Resume</h3>
                  <ResumeDropZone 
                    onFileUpload={handleResumeUpload}
                    isUploading={isUploading}
                    uploadProgress={uploadProgress}
                  />
                </div>
                
                {job && !isJobLoading && (
                  <button
                    onClick={generateAIResume}
                    className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    disabled={aiGenerating}
                  >
                    {aiGenerating ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Optimizing Resume...
                      </>
                    ) : (
                      <>
                        <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                        </svg>
                        Optimize for This Job
                      </>
                    )}
                  </button>
                )}
                
                {currentResume && (
                  <>
                    <button
                      onClick={previewResume}
                      className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <svg className="mr-2 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                      {isEditing ? 'Preview Resume' : 'Edit Resume'}
                    </button>
                    
                    <button
                      onClick={saveResume}
                      className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Save Resume
                    </button>
                    
                    <button
                      onClick={exportResumeToPDF}
                      className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <svg className="mr-2 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 10a1 1 0 10-2 0v3a1 1 0 102 0v-3zm4-1a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                      Export to PDF
                    </button>
                  </>
                )}
              </div>
            </motion.div>
            
            {savedResumes.length > 0 && (
              <motion.div
                className="bg-white rounded-xl shadow-sm p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Saved Resumes</h2>
                
                <div className="space-y-3">
                  {savedResumes.map((resume) => (
                    <div 
                      key={resume.id}
                      className={`p-3 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                        currentResume?.id === resume.id ? 'bg-indigo-50 border border-indigo-100' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div 
                          className="flex-1 truncate font-medium text-gray-900"
                          onClick={() => loadResume(resume)}
                        >
                          {resume.name}
                        </div>
                        <button
                          onClick={() => deleteResume(resume.id)}
                          className="ml-2 text-gray-400 hover:text-red-500"
                        >
                          <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Last updated: {resume.updatedAt?.toDate ? resume.updatedAt.toDate().toLocaleDateString() : 'Unknown'}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
          
          {/* Main content */}
          <div className="lg:col-span-3">
            {isEditing ? (
              <motion.div
                className="bg-white rounded-xl shadow-sm p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {currentResume ? 'Edit Resume' : 'Create New Resume'}
                  </h2>
                </div>
                
                {/* Resume form fields */}
                <div className="space-y-8">
                  {/* Basic Information */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name</label>
                        <input
                          type="text"
                          name="name"
                          id="name"
                          value={resumeData.name}
                          onChange={handleInputChange}
                          className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label htmlFor="title" className="block text-sm font-medium text-gray-700">Professional Title</label>
                        <input
                          type="text"
                          name="title"
                          id="title"
                          value={resumeData.title}
                          onChange={handleInputChange}
                          className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                        <input
                          type="email"
                          name="email"
                          id="email"
                          value={resumeData.email}
                          onChange={handleInputChange}
                          className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone</label>
                        <input
                          type="text"
                          name="phone"
                          id="phone"
                          value={resumeData.phone}
                          onChange={handleInputChange}
                          className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="location" className="block text-sm font-medium text-gray-700">Location</label>
                        <input
                          type="text"
                          name="location"
                          id="location"
                          value={resumeData.location}
                          onChange={handleInputChange}
                          className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          placeholder="City, State/Province, Country"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Professional Summary */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Professional Summary</h3>
                    <div>
                      <label htmlFor="summary" className="block text-sm font-medium text-gray-700 sr-only">Summary</label>
                      <textarea
                        name="summary"
                        id="summary"
                        rows={4}
                        value={resumeData.summary}
                        onChange={handleInputChange}
                        className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        placeholder="Write a short professional summary about yourself..."
                      />
                    </div>
                  </div>
                  
                  {/* Skills */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Skills</h3>
                    
                    {/* Current skills */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Your Skills</label>
                      <div className="flex flex-wrap gap-2">
                        {resumeData.skills.map((skill, index) => (
                          <div key={index} className="bg-indigo-100 text-indigo-800 rounded-full px-3 py-1 text-sm font-medium flex items-center">
                            <span>{skill}</span>
                            <button
                              type="button"
                              onClick={() => toggleSkill(skill)}
                              className="ml-1.5 text-indigo-600 hover:text-indigo-900 focus:outline-none"
                            >
                              <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        ))}
                        
                        {resumeData.skills.length === 0 && (
                          <p className="text-sm text-gray-500 italic">No skills added yet. Add skills from suggestions below or enter your own.</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Add custom skill */}
                    <div className="mb-4">
                      <label htmlFor="newSkill" className="block text-sm font-medium text-gray-700 mb-1">Add a Skill</label>
                      <div className="flex">
                        <input
                          type="text"
                          id="newSkill"
                          className="focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-l-md"
                          placeholder="Enter a skill..."
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const input = e.target as HTMLInputElement;
                              if (input.value.trim()) {
                                toggleSkill(input.value.trim());
                                input.value = '';
                              }
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-r-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          onClick={() => {
                            const input = document.getElementById('newSkill') as HTMLInputElement;
                            if (input.value.trim()) {
                              toggleSkill(input.value.trim());
                              input.value = '';
                            }
                          }}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                    
                    {/* Suggested skills */}
                    {suggestedSkills.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Suggested Skills</label>
                        <div className="flex flex-wrap gap-2">
                          {suggestedSkills.filter(skill => !resumeData.skills.includes(skill)).map((skill, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => toggleSkill(skill)}
                              className="bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full px-3 py-1 text-sm font-medium transition-colors"
                            >
                              + {skill}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Work Experience */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium text-gray-900">Work Experience</h3>
                      <button
                        type="button"
                        onClick={addWorkExperience}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        <svg className="mr-1.5 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        Add Position
                      </button>
                    </div>
                    
                    {resumeData.workExperience.map((experience, index) => (
                      <div key={index} className="mb-6 p-4 border border-gray-200 rounded-md bg-gray-50">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="text-md font-medium text-gray-900">Position {index + 1}</h4>
                          {index > 0 && (
                            <button
                              type="button"
                              onClick={() => removeWorkExperience(index)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Company</label>
                          <input
                            type="text"
                            value={experience.company}
                            onChange={(e) => handleInputChange(e, 'workExperience', index, 'company')}
                            className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Position</label>
                          <input
                            type="text"
                            value={experience.position}
                            onChange={(e) => handleInputChange(e, 'workExperience', index, 'position')}
                            className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Start Date</label>
                          <input
                            type="month"
                            value={experience.startDate}
                            onChange={(e) => handleInputChange(e, 'workExperience', index, 'startDate')}
                            className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">End Date</label>
                          <div className="flex items-center">
                            <input
                              type="month"
                              value={experience.endDate}
                              onChange={(e) => handleInputChange(e, 'workExperience', index, 'endDate')}
                              disabled={experience.current}
                              className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                            />
                          </div>
                        </div>
                        <div className="md:col-span-2 flex items-start">
                          <input
                            type="checkbox"
                            id={`current-job-${index}`}
                            checked={experience.current}
                            onChange={(e) => handleInputChange(e, 'workExperience', index, 'current')}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mt-1"
                          />
                          <label htmlFor={`current-job-${index}`} className="ml-2 block text-sm text-gray-700">
                            I currently work here
                          </label>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700">Description</label>
                          <textarea
                            rows={3}
                            value={experience.description}
                            onChange={(e) => handleInputChange(e, 'workExperience', index, 'description')}
                            className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                            placeholder="Describe your responsibilities and achievements..."
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Education */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Education</h3>
                    <button
                      type="button"
                      onClick={addEducation}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <svg className="mr-1.5 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                      Add Education
                    </button>
                  </div>
                  
                  {resumeData.education.map((edu, index) => (
                    <div key={index} className="mb-6 p-4 border border-gray-200 rounded-md bg-gray-50">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="text-md font-medium text-gray-900">Education {index + 1}</h4>
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={() => removeEducation(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Institution</label>
                          <input
                            type="text"
                            value={edu.institution}
                            onChange={(e) => handleInputChange(e, 'education', index, 'institution')}
                            className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Degree</label>
                          <input
                            type="text"
                            value={edu.degree}
                            onChange={(e) => handleInputChange(e, 'education', index, 'degree')}
                            className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Field of Study</label>
                          <input
                            type="text"
                            value={edu.field}
                            onChange={(e) => handleInputChange(e, 'education', index, 'field')}
                            className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                        <div className="flex flex-col md:flex-row gap-4">
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700">Start Date</label>
                            <input
                              type="month"
                              value={edu.startDate}
                              onChange={(e) => handleInputChange(e, 'education', index, 'startDate')}
                              className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700">End Date</label>
                            <input
                              type="month"
                              value={edu.endDate}
                              onChange={(e) => handleInputChange(e, 'education', index, 'endDate')}
                              disabled={edu.current}
                              className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                            />
                          </div>
                        </div>
                        <div className="md:col-span-2 flex items-start">
                          <input
                            type="checkbox"
                            id={`current-edu-${index}`}
                            checked={edu.current}
                            onChange={(e) => handleInputChange(e, 'education', index, 'current')}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mt-1"
                          />
                          <label htmlFor={`current-edu-${index}`} className="ml-2 block text-sm text-gray-700">
                            I am currently studying here
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Projects */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Projects</h3>
                    <button
                      type="button"
                      onClick={addProject}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <svg className="mr-1.5 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                      Add Project
                    </button>
                  </div>
                  
                  {resumeData.projects.map((project, index) => (
                    <div key={index} className="mb-6 p-4 border border-gray-200 rounded-md bg-gray-50">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="text-md font-medium text-gray-900">Project {index + 1}</h4>
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={() => removeProject(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Project Name</label>
                          <input
                            type="text"
                            value={project.name}
                            onChange={(e) => handleInputChange(e, 'projects', index, 'name')}
                            className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">URL</label>
                          <input
                            type="url"
                            value={project.url}
                            onChange={(e) => handleInputChange(e, 'projects', index, 'url')}
                            className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                            placeholder="https://..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Description</label>
                          <textarea
                            rows={3}
                            value={project.description}
                            onChange={(e) => handleInputChange(e, 'projects', index, 'description')}
                            className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                            placeholder="Describe what the project does and your role in it..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Skills Used</label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {project.skills.map((skill, skillIndex) => (
                              <div key={skillIndex} className="bg-indigo-100 text-indigo-800 rounded-full px-3 py-1 text-sm font-medium flex items-center">
                                <span>{skill}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updatedSkills = [...project.skills];
                                    updatedSkills.splice(skillIndex, 1);
                                    handleProjectSkillChange(index, updatedSkills);
                                  }}
                                  className="ml-1.5 text-indigo-600 hover:text-indigo-900 focus:outline-none"
                                >
                                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                          
                          <div className="flex">
                            <input
                              type="text"
                              className="focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-l-md"
                              placeholder="Add a skill..."
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const input = e.target as HTMLInputElement;
                                  if (input.value.trim()) {
                                    handleProjectSkillChange(index, [...project.skills, input.value.trim()]);
                                    input.value = '';
                                  }
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-r-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                              onClick={(e) => {
                                const input = e.currentTarget.previousSibling as HTMLInputElement;
                                if (input.value.trim()) {
                                  handleProjectSkillChange(index, [...project.skills, input.value.trim()]);
                                  input.value = '';
                                }
                              }}
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Certifications */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Certifications</h3>
                    <button
                      type="button"
                      onClick={addCertification}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <svg className="mr-1.5 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                      Add Certification
                    </button>
                  </div>
                  
                  {resumeData.certifications.map((cert, index) => (
                    <div key={index} className="mb-6 p-4 border border-gray-200 rounded-md bg-gray-50">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="text-md font-medium text-gray-900">Certification {index + 1}</h4>
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={() => removeCertification(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Certification Name</label>
                          <input
                            type="text"
                            value={cert.name}
                            onChange={(e) => handleInputChange(e, 'certifications', index, 'name')}
                            className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Issuing Organization</label>
                          <input
                            type="text"
                            value={cert.issuer}
                            onChange={(e) => handleInputChange(e, 'certifications', index, 'issuer')}
                            className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Date</label>
                          <input
                            type="month"
                            value={cert.date}
                            onChange={(e) => handleInputChange(e, 'certifications', index, 'date')}
                            className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">URL</label>
                          <input
                            type="url"
                            value={cert.url}
                            onChange={(e) => handleInputChange(e, 'certifications', index, 'url')}
                            className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                            placeholder="https://..."
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Action buttons */}
                <div className="flex justify-end space-x-3 pt-5">
                  <button
                    type="button"
                    onClick={saveResume}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Save Resume
                  </button>
                  <button
                    type="button"
                    onClick={previewResume}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <svg className="mr-2 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                    Preview
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              className="bg-white rounded-xl shadow-sm p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              {currentResume ? (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {resumeData.name}
                    </h2>
                    <div className="flex space-x-2">
                      <button
                        onClick={previewResume}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        <svg className="mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                        Edit
                      </button>
                      <button
                        onClick={exportResumeToPDF}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        <svg className="mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
                        </svg>
                        Download PDF
                      </button>
                    </div>
                  </div>
                  
                  {/* Resume Preview */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                    <div className="text-center mb-6">
                      <h1 className="text-2xl font-bold text-gray-900">{resumeData.name}</h1>
                      {resumeData.title && <p className="text-lg text-gray-600 mt-1">{resumeData.title}</p>}
                      
                      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm text-gray-600">
                        {resumeData.email && (
                          <div className="flex items-center">
                            <svg className="h-4 w-4 mr-1 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                            </svg>
                            <span>{resumeData.email}</span>
                          </div>
                        )}
                        
                        {resumeData.phone && (
                          <div className="flex items-center">
                            <svg className="h-4 w-4 mr-1 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                            </svg>
                            <span>{resumeData.phone}</span>
                          </div>
                        )}
                        
                        {resumeData.location && (
                          <div className="flex items-center">
                            <svg className="h-4 w-4 mr-1 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                            </svg>
                            <span>{resumeData.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {resumeData.summary && (
                      <div className="mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-3">Professional Summary</h2>
                        <p className="text-gray-700">{resumeData.summary}</p>
                      </div>
                    )}
                    
                    {resumeData.skills && resumeData.skills.length > 0 && (
                      <div className="mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-3">Skills</h2>
                        <div className="flex flex-wrap gap-2">
                          {resumeData.skills.map((skill, index) => (
                            <span key={index} className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-medium">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {resumeData.workExperience && resumeData.workExperience.length > 0 && resumeData.workExperience[0].company && (
                      <div className="mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-3">Work Experience</h2>
                        {resumeData.workExperience.map((experience, index) => (
                          <div key={index} className="mb-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="text-md font-medium text-gray-900">{experience.position}</h3>
                                <p className="text-gray-600">{experience.company}</p>
                              </div>
                              <div className="text-sm text-gray-500">
                                {experience.startDate && (
                                  <>
                                    {new Date(experience.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                                    {' - '}
                                    {experience.current ? 
                                      'Present' : 
                                      experience.endDate ? 
                                        new Date(experience.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : 
                                        ''
                                    }
                                  </>
                                )}
                              </div>
                            </div>
                            {experience.description && (
                              <p className="text-gray-700 mt-2 text-sm">{experience.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {resumeData.education && resumeData.education.length > 0 && resumeData.education[0].institution && (
                      <div className="mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-3">Education</h2>
                        {resumeData.education.map((edu, index) => (
                          <div key={index} className="mb-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="text-md font-medium text-gray-900">{edu.degree}{edu.field ? `, ${edu.field}` : ''}</h3>
                                <p className="text-gray-600">{edu.institution}</p>
                              </div>
                              <div className="text-sm text-gray-500">
                                {edu.startDate && (
                                  <>
                                    {new Date(edu.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                                    {' - '}
                                    {edu.current ? 
                                      'Present' : 
                                      edu.endDate ? 
                                        new Date(edu.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : 
                                        ''
                                    }
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {resumeData.projects && resumeData.projects.length > 0 && resumeData.projects[0].name && (
                      <div className="mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-3">Projects</h2>
                        {resumeData.projects.map((project, index) => (
                          <div key={index} className="mb-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="text-md font-medium text-gray-900">
                                  {project.name}
                                  {project.url && (
                                    <a href={project.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-indigo-600 hover:text-indigo-800 text-sm">
                                      <svg className="h-4 w-4 inline" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                                        <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                                      </svg>
                                    </a>
                                  )}
                                </h3>
                              </div>
                            </div>
                            {project.description && (
                              <p className="text-gray-700 mt-1 text-sm">{project.description}</p>
                            )}
                            {project.skills && project.skills.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {project.skills.map((skill, skillIndex) => (
                                  <span key={skillIndex} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {resumeData.certifications && resumeData.certifications.length > 0 && resumeData.certifications[0].name && (
                      <div className="mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-3">Certifications</h2>
                        {resumeData.certifications.map((cert, index) => (
                          <div key={index} className="mb-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="text-md font-medium text-gray-900">{cert.name}</h3>
                                <p className="text-gray-600">{cert.issuer}</p>
                              </div>
                              <div className="text-sm text-gray-500">
                                {cert.date && new Date(cert.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                              </div>
                            </div>
                            {cert.url && (
                              <a href={cert.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 text-sm">
                                View Certification
                                <svg className="h-4 w-4 inline ml-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                                  <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                                </svg>
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No resume selected</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Get started by creating a new resume or uploading an existing one.
                  </p>
                  <div className="mt-6 flex justify-center gap-3">
                    <button
                      onClick={createNewResume}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                      New Resume
                    </button>
                    
                    {/* Now add the resume drop zone here too for empty state */}
                    <div className="mt-8 w-full max-w-md">
                      <ResumeDropZone 
                        onFileUpload={handleResumeUpload}
                        isUploading={isUploading}
                        uploadProgress={uploadProgress}
                      />
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
      
      {/* Job-specific resume tips */}
      {job && (
        <motion.div
          className="mt-8 bg-gradient-to-r from-indigo-50 to-violet-50 rounded-xl shadow-sm p-6 border border-indigo-100"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="mr-2 h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            Resume Tips for {job.title} at {job.company}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="text-md font-medium text-indigo-800 mb-2">Key Skills to Highlight</h3>
              <ul className="space-y-1 text-gray-700">
                {job.skills?.slice(0, 5).map((skill: string, index: number) => (
                  <li key={index} className="flex items-start">
                    <svg className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {skill}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="text-md font-medium text-indigo-800 mb-2">Experience to Emphasize</h3>
              <ul className="space-y-1 text-gray-700">
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-indigo-500 mr-2 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Projects related to {job.skills?.slice(0, 2).join(' or ')}
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-indigo-500 mr-2 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Experience with {job.experienceLevel?.toLowerCase() || 'relevant'} roles
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-indigo-500 mr-2 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Achievements that demonstrate problem-solving ability
                </li>
              </ul>
            </div>
          </div>
          
          <div className="mt-4 bg-white rounded-lg p-4 shadow-sm">
            <h3 className="text-md font-medium text-indigo-800 mb-2">Resume Summary Suggestion</h3>
            <p className="text-gray-700">
              Consider a summary that highlights your expertise in {job.skills?.slice(0, 3).join(', ')} 
              and experience in {job.experienceLevel?.toLowerCase() || 'relevant'} positions. 
              Mention your accomplishments that align with {job.company}'s needs for this {job.title} role.
            </p>
          </div>
        </motion.div>
      )}
      
      {/* Back to dashboard */}
      <div className="mt-8 text-center">
        <Link
          href="/applicant/applicantDashboard"
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
       