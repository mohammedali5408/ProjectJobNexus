'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { auth, db } from '@/app/lib/firebase';
import ResumeViewer from './resumeViewer';

interface ResumeEnhancerProps {
  jobId: string;
  onClose: () => void;
  onEnhanceComplete: (enhancedResumeId: string, enhancedData?: any) => void;
  uploadedResume?: any; // Added to accept parsed resume data
  resumeFile?: File | null; // Added to accept the original file
}

interface ChangeHighlight {
  section: string;
  type: 'add' | 'modify' | 'remove';
  original?: string;
  enhanced?: string;
  explanation: string;
}

export default function ResumeEnhancer({ 
  jobId, 
  onClose,
  onEnhanceComplete,
  uploadedResume,
  resumeFile
}: ResumeEnhancerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [job, setJob] = useState<any>(null);
  const [enhancing, setEnhancing] = useState(false);
  const [enhancementProgress, setEnhancementProgress] = useState(0);
  const [notification, setNotification] = useState({ type: '', message: '' });
  const [enhancementDetails, setEnhancementDetails] = useState<string[]>([]);
  const [enhancedResume, setEnhancedResume] = useState<any>(null);
  const [originalResume, setOriginalResume] = useState<any>(null);
  const [changeHighlights, setChangeHighlights] = useState<ChangeHighlight[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<'original' | 'enhanced' | 'changes'>('original');
  const [showResumeViewer, setShowResumeViewer] = useState(false);
  const [resumeForViewing, setResumeForViewing] = useState<any>(null);
  const [skipResumeSelection, setSkipResumeSelection] = useState(false);

  // Fetch job details
  useEffect(() => {
    const fetchJobData = async () => {
      setIsLoading(true);
      
      try {
        const user = auth.currentUser;
        if (!user) {
          setNotification({
            type: 'error',
            message: 'You need to be logged in to enhance your resume'
          });
          return;
        }
        
        // Fetch job details
        if (jobId) {
          const jobDoc = await getDoc(doc(db, "jobs", jobId));
          if (jobDoc.exists()) {
            const jobData = { ...jobDoc.data(), id: jobDoc.id };
            setJob(jobData);
          } else {
            setNotification({
              type: 'error',
              message: 'Job not found'
            });
          }
        } else {
          setNotification({
            type: 'error',
            message: 'No job selected for enhancement'
          });
        }
        
        // If uploaded resume data is provided, we can skip the resume selection step
        if (uploadedResume) {
          setSkipResumeSelection(true);
          setOriginalResume(uploadedResume);
        }
        
      } catch (error) {
        console.error("Error fetching job data:", error);
        setNotification({
          type: 'error',
          message: 'Failed to load job data'
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchJobData();
  }, [jobId, uploadedResume]);

  // Start enhancement process
  const enhanceResume = async () => {
    if (!job) {
      setNotification({
        type: 'error',
        message: 'Job details not available for enhancement'
      });
      return;
    }
    
    if (!originalResume && !uploadedResume) {
      setNotification({
        type: 'error',
        message: 'Resume data not available for enhancement'
      });
      return;
    }
    
    setEnhancing(true);
    setEnhancementProgress(10);
    setEnhancementDetails(['Analyzing job requirements...']);
    
    let progressInterval = setInterval(() => {
      setEnhancementProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        
        if (prev === 20) {
          setEnhancementDetails(prev => [...prev, 'Extracting key skills from job description...']);
        } else if (prev === 40) {
          setEnhancementDetails(prev => [...prev, 'Tailoring resume content to job requirements...']);
        } else if (prev === 60) {
          setEnhancementDetails(prev => [...prev, 'Optimizing work experience descriptions...']);
        } else if (prev === 80) {
          setEnhancementDetails(prev => [...prev, 'Finalizing enhanced resume...']);
        }
        return prev + 5;
      });
    }, 300);
    
    try {
      const resumeToEnhance = originalResume || uploadedResume;
      
      const payload = {
        resume: resumeToEnhance,
        job: {
          title: job.title,
          company: job.company,
          description: job.description,
          requirements: job.requirements,
          skills: job.skills,
          experienceLevel: job.experienceLevel
        }
      };
      
      const response = await fetch('/api/resume-enhancer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      clearInterval(progressInterval);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to enhance resume');
      }
      
      const result = await response.json();
      
      if (!result.success || !result.data) {
        throw new Error('Failed to enhance resume');
      }
      
      const enhancedResumeData = result.data;
      const highlights = generateChangeHighlights(resumeToEnhance, enhancedResumeData, job);
      
      const enhancedResumeObj = {
        id: `resume_${Date.now()}`,
        name: `${job.title} at ${job.company} - Optimized Resume`,
        data: enhancedResumeData,
        createdAt: new Date(),
        updatedAt: new Date(),
        isAiEnhanced: true,
        originalResumeData: resumeToEnhance,
        resumeFileName: resumeFile?.name || 'uploaded-resume',
        changeHighlights: highlights,
        jobId: jobId,
        jobTitle: job.title,
        jobCompany: job.company
      };
      
      setEnhancedResume(enhancedResumeObj);
      setChangeHighlights(highlights);
      setEnhancementProgress(100);
      setEnhancementDetails(prev => [...prev, 'Resume enhancement completed!']);
      
      setNotification({
        type: 'success',
        message: `Resume optimized for ${job.title} at ${job.company}!`
      });
      
      setShowPreview(true);
      
    } catch (error) {
      console.error("Error enhancing resume:", error);
      clearInterval(progressInterval);
      
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Error enhancing resume'
      });
    } finally {
      setTimeout(() => {
        if (enhancementProgress < 100) {
          setEnhancementProgress(100);
        }
        setTimeout(() => {
          setEnhancing(false);
        }, 1000);
      }, 500);
    }
  };

  // Save enhanced resume to user's profile
  const saveEnhancedResume = async () => {
    try {
      const user = auth.currentUser;
      if (!user || !enhancedResume) {
        setNotification({
          type: 'error',
          message: 'Unable to save enhanced resume'
        });
        return;
      }
      
      await updateDoc(doc(db, "users", user.uid), {
        "resumes": arrayUnion(enhancedResume)
      });
      
      onEnhanceComplete(enhancedResume.id, enhancedResume.data);
      setShowPreview(false);
      onClose();
    } catch (error) {
      console.error("Error saving enhanced resume:", error);
      setNotification({
        type: 'error',
        message: 'Failed to save enhanced resume'
      });
    }
  };

  // Generate change highlights
  const generateChangeHighlights = (original: any, enhanced: any, jobData: any) => {
    const highlights: ChangeHighlight[] = [];
    const jobSkills = jobData.skills || [];
    
    // Summary changes
    if (original.summary && enhanced.summary && original.summary !== enhanced.summary) {
      highlights.push({
        section: 'Summary',
        type: 'modify',
        original: original.summary,
        enhanced: enhanced.summary,
        explanation: 'Tailored summary to highlight relevant skills and qualifications for this position'
      });
    } else if (!original.summary && enhanced.summary) {
      highlights.push({
        section: 'Summary',
        type: 'add',
        enhanced: enhanced.summary,
        explanation: 'Added a professional summary tailored to the job requirements'
      });
    }
    
    // Skills enhancements
    if (original.skills && enhanced.skills) {
      const originalSkills = Array.isArray(original.skills) ? original.skills : [original.skills];
      const enhancedSkills = Array.isArray(enhanced.skills) ? enhanced.skills : [enhanced.skills];
      
      // Find new skills that were added
      const newSkills: string[] = enhancedSkills.filter((skill: string) => !originalSkills.includes(skill));
      
      if (newSkills.length > 0) {
        highlights.push({
          section: 'Skills',
          type: 'add',
          enhanced: newSkills.join(', '),
          explanation: 'Added skills that match the job requirements'
        });
      }
    }
    
    // Experience enhancements
    if (original.experience && enhanced.experience) {
      // Examine the first few experiences
      for (let i = 0; i < Math.min(original.experience.length, enhanced.experience.length); i++) {
        const originalExp = original.experience[i];
        const enhancedExp = enhanced.experience[i];
        
        if (originalExp && enhancedExp && originalExp.description !== enhancedExp.description) {
          highlights.push({
            section: `Experience: ${enhancedExp.title} at ${enhancedExp.company}`,
            type: 'modify',
            original: originalExp.description || '',
            enhanced: enhancedExp.description || '',
            explanation: 'Enhanced job description to focus on achievements and skills relevant to the position'
          });
        }
      }
      
      // Check for added achievements in experience
      for (let i = 0; i < enhanced.experience.length; i++) {
        const enhancedExp = enhanced.experience[i];
        if (enhancedExp.achievements && enhancedExp.achievements.length > 0) {
          // Find the corresponding original experience
          const originalExp = original.experience.find((exp: any) => 
            exp.company === enhancedExp.company && exp.title === enhancedExp.title
          );
          
          if (!originalExp || 
              !originalExp.achievements || 
              originalExp.achievements.length < enhancedExp.achievements.length) {
            highlights.push({
              section: `Experience: ${enhancedExp.title} at ${enhancedExp.company}`,
              type: 'add',
              enhanced: 'Added key achievements: ' + enhancedExp.achievements.join('; '),
              explanation: 'Added quantifiable achievements to highlight your impact and results'
            });
          }
        }
      }
    }
    
    return highlights;
  };

  // Handle preview actions
  const handlePreviewOriginal = () => {
    if (originalResume || uploadedResume) {
      const resumeObj = {
        id: 'original_resume',
        name: resumeFile?.name || 'Original Resume',
        data: originalResume || uploadedResume,
        createdAt: new Date(),
        updatedAt: new Date(),
        isAiEnhanced: false
      };
      setResumeForViewing(resumeObj);
      setShowResumeViewer(true);
    }
  };

  const handlePreviewEnhanced = () => {
    if (enhancedResume) {
      setResumeForViewing(enhancedResume);
      setShowResumeViewer(true);
    }
  };

  // Resume viewer handlers
  const handleDownloadResume = () => {
    setNotification({
      type: 'success',
      message: 'Resume downloaded successfully!'
    });
  };

  const handleUseResume = async () => {
    setShowResumeViewer(false);
    await saveEnhancedResume();
  };

  // Auto-start enhancement if resume is provided
  useEffect(() => {
    if (skipResumeSelection && job && originalResume && !enhancing && !enhancedResume && !showPreview) {
      // Start enhancement automatically after a small delay
      const timer = setTimeout(() => {
        enhanceResume();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [skipResumeSelection, job, originalResume, enhancing, enhancedResume, showPreview]);

  // Render the changes preview
  const renderChangesPreview = () => {
    return (
      <div className="space-y-6 p-4">
        <h3 className="text-lg font-medium text-gray-900">Resume Optimization for {job?.title}</h3>
        
        <div className="flex space-x-4 border-b border-gray-200">
          <button
            className={`pb-2 px-1 ${activeTab === 'original' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('original')}
          >
            Original
          </button>
          <button
            className={`pb-2 px-1 ${activeTab === 'enhanced' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('enhanced')}
          >
            Enhanced
          </button>
          <button
            className={`pb-2 px-1 ${activeTab === 'changes' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('changes')}
          >
            Changes
          </button>
        </div>
        
        {activeTab === 'original' && (originalResume || uploadedResume) && (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-700">Original Resume</h4>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-80 overflow-y-auto">
              {/* Summary */}
              {(originalResume || uploadedResume).summary && (
                <div className="mb-4">
                  <h5 className="font-medium text-gray-900">Summary</h5>
                  <p className="text-gray-700">{(originalResume || uploadedResume).summary}</p>
                </div>
              )}
              
              {/* Experience */}
              {(originalResume || uploadedResume).experience && (originalResume || uploadedResume).experience.length > 0 && (
                <div className="mb-4">
                  <h5 className="font-medium text-gray-900">Experience</h5>
                  {(originalResume || uploadedResume).experience.map((exp: any, i: number) => (
                    <div key={i} className="mb-2">
                      <div className="font-medium">{exp.title} at {exp.company}</div>
                      <div className="text-sm text-gray-500">{exp.startDate} - {exp.endDate || 'Present'}</div>
                      <p className="text-gray-700">{exp.description}</p>
                      {exp.achievements && exp.achievements.length > 0 && (
                        <ul className="text-sm text-gray-600 list-disc list-inside mt-1">
                          {exp.achievements.map((achievement: string, index: number) => (
                            <li key={index}>{achievement}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Skills */}
              {(originalResume || uploadedResume).skills && (
                <div>
                  <h5 className="font-medium text-gray-900">Skills</h5>
                  <p className="text-gray-700">
                    {Array.isArray((originalResume || uploadedResume).skills) 
                      ? (originalResume || uploadedResume).skills.join(', ') 
                      : (originalResume || uploadedResume).skills}
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={handlePreviewOriginal}
              className="mt-4 inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Preview Original
            </button>
          </div>
        )}
        
        {activeTab === 'enhanced' && enhancedResume && (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-700">Enhanced Resume</h4>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-80 overflow-y-auto">
              {/* Summary */}
              {enhancedResume.data.summary && (
                <div className="mb-4">
                  <h5 className="font-medium text-gray-900">Summary</h5>
                  <p className="text-gray-700">{enhancedResume.data.summary}</p>
                </div>
              )}
              
              {/* Experience */}
              {enhancedResume.data.experience && enhancedResume.data.experience.length > 0 && (
                <div className="mb-4">
                  <h5 className="font-medium text-gray-900">Experience</h5>
                  {enhancedResume.data.experience.map((exp: any, i: number) => (
                    <div key={i} className="mb-2">
                      <div className="font-medium">{exp.title} at {exp.company}</div>
                      <div className="text-sm text-gray-500">{exp.startDate} - {exp.endDate || 'Present'}</div>
                      <p className="text-gray-700">{exp.description}</p>
                      {exp.achievements && exp.achievements.length > 0 && (
                        <ul className="text-sm text-gray-600 list-disc list-inside mt-1">
                          {exp.achievements.map((achievement: string, index: number) => (
                            <li key={index}>{achievement}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Skills */}
              {enhancedResume.data.skills && (
                <div>
                  <h5 className="font-medium text-gray-900">Skills</h5>
                  <p className="text-gray-700">
                    {Array.isArray(enhancedResume.data.skills) 
                      ? enhancedResume.data.skills.join(', ') 
                      : enhancedResume.data.skills}
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={handlePreviewEnhanced}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Preview Enhanced
            </button>
          </div>
        )}
        
        {activeTab === 'changes' && (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-700">Key Optimizations</h4>
            <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
              {changeHighlights.map((change, index) => (
                <div key={index} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex items-start">
                    <div className={`mt-0.5 mr-2 flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center ${
                      change.type === 'add' ? 'bg-green-100' : 
                      change.type === 'modify' ? 'bg-yellow-100' : 
                      'bg-red-100'
                    }`}>
                      {change.type === 'add' ? (
                        <svg className="h-3 w-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      ) : change.type === 'modify' ? (
                        <svg className="h-3 w-3 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      ) : (
                        <svg className="h-3 w-3 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <h5 className="text-sm font-medium text-gray-900">{change.section}</h5>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          change.type === 'add' ? 'bg-green-100 text-green-800' : 
                          change.type === 'modify' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-red-100 text-red-800'
                        }`}>
                          {change.type === 'add' ? 'Added' : change.type === 'modify' ? 'Modified' : 'Removed'}
                        </span>
                      </div>
                      
                      {change.original && (
                        <div className="mt-2">
                          <div className="text-xs text-gray-500 mb-1">Original:</div>
                          <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{change.original}</div>
                        </div>
                      )}
                      
                      {change.enhanced && (
                        <div className="mt-2">
                          <div className="text-xs text-gray-500 mb-1">Enhanced:</div>
                          <div className="text-sm text-indigo-700 bg-indigo-50 p-2 rounded">{change.enhanced}</div>
                        </div>
                      )}
                      
                      <div className="mt-2">
                        <div className="text-xs text-gray-500 mb-1">Why this change:</div>
                        <div className="text-sm text-gray-600">{change.explanation}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
        <motion.div 
          className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">
              AI Resume Enhancement
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Notification */}
          {notification.message && (
            <div className={`m-4 p-3 rounded-md ${
              notification.type === 'success' ? 'bg-green-50 text-green-800' : 
              notification.type === 'error' ? 'bg-red-50 text-red-800' :
              'bg-blue-50 text-blue-800'
            }`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  {notification.type === 'success' ? (
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : notification.type === 'error' ? (
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">{notification.message}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Content */}
          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <svg className="animate-spin h-10 w-10 text-indigo-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : enhancing ? (
              <div className="py-6">
                <div className="mb-4 text-center">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Enhancing Resume</h3>
                  <p className="text-sm text-gray-500">
                    Our AI is optimizing your resume for {job?.title} at {job?.company}
                  </p>
                </div>
                
                <div className="mb-6">
                  <div className="relative w-full h-2 bg-gray-200 rounded-full">
                    <div 
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-300 ease-in-out" 
                      style={{ width: `${enhancementProgress}%` }}
                    ></div>
                  </div>
                  <div className="mt-2 text-right">
                    <span className="text-sm font-medium text-gray-700">{enhancementProgress}%</span>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Enhancement Progress</h4>
                  <ul className="space-y-2">
                    {enhancementDetails.map((detail, index) => (
                      <motion.li
                        key={index}
                        className="flex items-start text-sm"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <svg className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span>{detail}</span>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : showPreview ? (
              renderChangesPreview()
            ) : (
              <>
                {job && (
                  <div className="mb-6 bg-gradient-to-r from-indigo-50 to-violet-50 rounded-lg p-4 border border-indigo-100">
                    <h3 className="text-md font-medium text-gray-900 mb-2">Enhancing Resume For:</h3>
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-lg">
                        {job.company.charAt(0)}
                      </div>
                      <div className="ml-3">
                        <div className="text-sm text-indigo-600 font-semibold">{job.company}</div>
                        <div className="text-base font-semibold text-gray-900">{job.title}</div>
                      </div>
                    </div>
                    
                    {job.skills && job.skills.length > 0 && (
                      <div className="mt-3">
                        <h4 className="text-xs font-medium text-gray-700 mb-1">Required Skills</h4>
                        <div className="flex flex-wrap gap-1">
                          {job.skills.map((skill: string, index: number) => (
                            <span key={index} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {skipResumeSelection && uploadedResume ? (
                  <div className="mb-6">
                    <h3 className="text-md font-medium text-gray-900 mb-3">Your Resume</h3>
                    <div className="p-3 rounded-lg cursor-pointer border transition-colors bg-indigo-50 border-indigo-300">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium text-gray-900">{resumeFile?.name || 'Uploaded Resume'}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Ready for enhancement
                          </div>
                        </div>
                        <svg className="h-5 w-5 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mb-6">
                    <h3 className="text-md font-medium text-gray-900 mb-3">Your resume is being prepared for enhancement</h3>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <svg className="animate-spin h-10 w-10 text-indigo-600 mx-auto" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <p className="mt-2 text-sm text-gray-600">
                        Please wait while we prepare your resume for enhancement...
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">How AI Enhancement Works</h3>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start">
                      <svg className="h-5 w-5 text-indigo-500 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Analyzes the job description and required skills</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="h-5 w-5 text-indigo-500 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Tailors your resume's language to match job requirements</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="h-5 w-5 text-indigo-500 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Highlights relevant skills and experience</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="h-5 w-5 text-indigo-500 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Creates a new version without modifying your original resume</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="h-5 w-5 text-indigo-500 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Shows you all changes before finalizing</span>
                    </li>
                  </ul>
                </div>
              </>
            )}
          </div>
          
          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
            
            {!enhancing && !isLoading && !showPreview && !skipResumeSelection && (
              <button
                onClick={enhanceResume}
                disabled={!originalResume || !job}
                className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                  !originalResume || !job
                    ? 'bg-indigo-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                }`}
              >
                Enhance Resume with AI
              </button>
            )}
            
            {showPreview && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Back
                </button>
                <button
                  onClick={handlePreviewEnhanced}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Preview Enhanced Resume
                </button>
                <button
                  onClick={saveEnhancedResume}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Use Enhanced Resume
                </button>
              </div>
            )}
            
            {enhancing && enhancementProgress === 100 && (
              <button
                onClick={() => setShowPreview(true)}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Review Enhancements
              </button>
            )}
          </div>
        </motion.div>
      </div>
      
      {/* Resume Viewer Modal */}
      {showResumeViewer && resumeForViewing && (
        <ResumeViewer
          resume={resumeForViewing}
          onClose={() => setShowResumeViewer(false)}
          onDownload={handleDownloadResume}
          onUseResume={handleUseResume}
          isEnhanced={resumeForViewing.isAiEnhanced || false}
        />
      )}
    </>
  );
}