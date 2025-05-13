'use client';

import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { generatePDF } from '@/app/lib/pdfGenerator';

interface ResumeViewerProps {
  resume: any;
  onClose: () => void;
  onDownload: () => void;
  onUseResume: () => void;
  isEnhanced?: boolean;
}

export default function ResumeViewer({ 
  resume, 
  onClose, 
  onDownload, 
  onUseResume,
  isEnhanced = false 
}: ResumeViewerProps) {
  const resumeRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
  // Debug logging for resume structure
  useEffect(() => {
    console.log('Resume data in ResumeViewer:', resume);
    // Check if resume data structure is valid
    if (!resume.data) {
      console.warn('Resume data is missing in ResumeViewer');
    } else if (!resume.data.personalInfo) {
      console.warn('Personal info is missing in resume data');
    } else if (!resume.data.experience || !Array.isArray(resume.data.experience)) {
      console.warn('Experience data is missing or not an array');
    }
  }, [resume]);
  
  const handleDownloadPDF = async () => {
    if (!resumeRef.current) {
      console.error('Resume element ref is not available');
      return;
    }
    
    try {
      setIsGeneratingPDF(true);
      
      // Wait for any rendering to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Set styles for better PDF capture
      resumeRef.current.style.width = '800px';
      resumeRef.current.style.maxHeight = 'none';
      
      // Use our improved PDF generator
      await generatePDF(resumeRef.current, resume.name || 'resume');
      
      // Restore original styles
      resumeRef.current.style.width = '';
      resumeRef.current.style.maxHeight = '';
      
      onDownload();
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('There was an error generating the PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <motion.div 
        className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {isEnhanced ? 'Enhanced Resume Preview' : 'Resume Preview'}
            </h2>
            {isEnhanced && (
              <p className="text-sm text-indigo-600">
                AI-optimized for your target position
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Resume Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div id="resume-for-pdf" ref={resumeRef} className="bg-white p-8 shadow-sm border border-gray-200 rounded-lg">
            {/* Header Section */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900">
                {resume.data?.personalInfo?.name || 'Your Name'}
              </h1>
              <p className="text-lg text-gray-600 mt-2">
                {resume.data?.personalInfo?.title || 'Professional Title'}
              </p>
              <div className="mt-3 flex justify-center space-x-4 text-sm text-gray-600">
                {resume.data?.personalInfo?.email && (
                  <span className="flex items-center">
                    <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {resume.data.personalInfo.email}
                  </span>
                )}
                {resume.data?.personalInfo?.phone && (
                  <span className="flex items-center">
                    <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {resume.data.personalInfo.phone}
                  </span>
                )}
                {resume.data?.personalInfo?.location && (
                  <span className="flex items-center">
                    <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {resume.data.personalInfo.location}
                  </span>
                )}
              </div>
            </div>

            {/* Summary Section */}
            {resume.data?.summary && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-800 border-b-2 border-gray-200 pb-2 mb-3">
                  Professional Summary
                </h2>
                <p className="text-gray-700 leading-relaxed">{resume.data.summary}</p>
              </div>
            )}

            {/* Experience Section */}
            {resume.data?.experience && resume.data.experience.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-800 border-b-2 border-gray-200 pb-2 mb-3">
                  Experience
                </h2>
                {resume.data.experience.map((exp: any, index: number) => (
                  <div key={index} className="mb-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">{exp.title}</h3>
                        <p className="text-gray-600">{exp.company}</p>
                      </div>
                      <p className="text-sm text-gray-500">
                        {exp.startDate} - {exp.endDate || 'Present'}
                      </p>
                    </div>
                    <p className="mt-2 text-gray-700">{exp.description}</p>
                    {exp.achievements && exp.achievements.length > 0 && (
                      <ul className="mt-2 list-disc list-inside text-gray-700">
                        {exp.achievements.map((achievement: string, i: number) => (
                          <li key={i}>{achievement}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Education Section */}
            {resume.data?.education && resume.data.education.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-800 border-b-2 border-gray-200 pb-2 mb-3">
                  Education
                </h2>
                {resume.data.education.map((edu: any, index: number) => (
                  <div key={index} className="mb-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">{edu.degree}</h3>
                        <p className="text-gray-600">{edu.institution}</p>
                        {edu.field && <p className="text-gray-600">{edu.field}</p>}
                      </div>
                      <p className="text-sm text-gray-500">
                        {edu.startDate} - {edu.endDate || 'Present'}
                      </p>
                    </div>
                    {edu.gpa && (
                      <p className="text-gray-700 mt-1">GPA: {edu.gpa}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Skills Section */}
            {resume.data?.skills && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-800 border-b-2 border-gray-200 pb-2 mb-3">
                  Skills
                </h2>
                <div className="flex flex-wrap gap-2">
                  {Array.isArray(resume.data.skills) ? (
                    resume.data.skills.map((skill: string, index: number) => (
                      <span 
                        key={index} 
                        className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm"
                      >
                        {skill}
                      </span>
                    ))
                  ) : (
                    <p className="text-gray-700">{String(resume.data.skills)}</p>
                  )}
                </div>
              </div>
            )}
            
            {/* Certifications Section (if available) */}
            {resume.data?.certifications && resume.data.certifications.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-800 border-b-2 border-gray-200 pb-2 mb-3">
                  Certifications
                </h2>
                {resume.data.certifications.map((cert: any, index: number) => (
                  <div key={index} className="mb-3">
                    <h3 className="text-lg font-semibold text-gray-800">{cert.name}</h3>
                    {cert.issuer && <p className="text-gray-600">{cert.issuer}</p>}
                    {cert.date && <p className="text-sm text-gray-500">{cert.date}</p>}
                  </div>
                ))}
              </div>
            )}
            
            {/* Projects Section (if available) */}
            {resume.data?.projects && resume.data.projects.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-800 border-b-2 border-gray-200 pb-2 mb-3">
                  Projects
                </h2>
                {resume.data.projects.map((project: any, index: number) => (
                  <div key={index} className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">{project.name}</h3>
                    <p className="mt-1 text-gray-700">{project.description}</p>
                    {project.skills && project.skills.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {project.skills.map((skill: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                    {project.url && (
                      <a 
                        href={project.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="mt-1 text-indigo-600 hover:text-indigo-800 text-sm inline-block"
                      >
                        Project Link
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Close
          </button>
          <div className="flex gap-3">
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                isGeneratingPDF ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {isGeneratingPDF ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating PDF...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download PDF
                </>
              )}
            </button>
            <button
              onClick={onUseResume}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
            >
              Use This Resume
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}