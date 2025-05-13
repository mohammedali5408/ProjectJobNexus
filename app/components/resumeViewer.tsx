import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { saveAs } from 'file-saver';

interface ResumeViewerProps {
  resume: any;
  onClose: () => void;
  onDownload?: () => void;
  onUseResume?: () => void;
  isEnhanced?: boolean;
}

export default function ResumeViewer({ resume, onClose, onDownload, onUseResume, isEnhanced = false }: ResumeViewerProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'download'>('preview');
  const [isDownloading, setIsDownloading] = useState(false);
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const [fetchingPdf, setFetchingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    // If the resume has a PDF URL, prepare it for viewing
    if (resume.pdfUrl) {
      const fetchPdf = async () => {
        setFetchingPdf(true);
        setPdfError(null);
        try {
          const response = await fetch(resume.pdfUrl);
          if (!response.ok) throw new Error('Failed to fetch PDF');
          
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          setPdfObjectUrl(objectUrl);
        } catch (error) {
          console.error('Error fetching PDF:', error);
          setPdfError('Could not load PDF for preview. You can still download it or view the text version.');
        } finally {
          setFetchingPdf(false);
        }
      };
      
      fetchPdf();
    }
    
    return () => {
      // Clean up the object URL when component unmounts
      if (pdfObjectUrl) {
        URL.revokeObjectURL(pdfObjectUrl);
      }
    };
  }, [resume.pdfUrl]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      if (resume.pdfUrl) {
        // If we have a direct PDF URL, download it
        const response = await fetch(resume.pdfUrl);
        if (!response.ok) throw new Error('Failed to fetch PDF');
        
        const blob = await response.blob();
        saveAs(blob, `${resume.name.replace(/\s+/g, '_')}.pdf`);
      } else if (resume.data) {
        // Otherwise, generate a PDF from the resume data
        const response = await fetch('/api/generate-resume-pdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            resumeData: resume.data,
            jobTitle: resume.jobTitle || 'Job Application',
            company: resume.jobCompany || 'Company'
          })
        });
        
        if (!response.ok) throw new Error('Failed to generate PDF');
        
        const blob = await response.blob();
        saveAs(blob, `${resume.name.replace(/\s+/g, '_')}.pdf`);
      } else {
        throw new Error('No resume data available for download');
      }
      
      if (onDownload) {
        onDownload();
      }
    } catch (error) {
      console.error('Error downloading resume:', error);
      alert('Failed to download resume: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsDownloading(false);
    }
  };

  const renderTextPreview = () => {
    return (
      <div className="bg-white p-6 border border-gray-200 rounded-lg max-w-3xl mx-auto" style={{ color: 'black' }}>
        <div className="space-y-6">
          {/* Personal Info */}
          {resume.data?.personalInfo && (
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold" style={{ color: 'black' }}>
                {resume.data.personalInfo.name || 'Full Name'}
              </h1>
              <div className="mt-1" style={{ color: 'black' }}>
                {[
                  resume.data.personalInfo.email,
                  resume.data.personalInfo.phone,
                  resume.data.personalInfo.location
                ].filter(Boolean).join(' • ')}
              </div>
            </div>
          )}
          
          {/* Summary */}
          {resume.data?.summary && (
            <div>
              <h2 className="text-lg font-bold border-b border-gray-200 pb-1 mb-2" style={{ color: 'black' }}>
                Summary
              </h2>
              <p style={{ color: 'black' }}>{resume.data.summary}</p>
            </div>
          )}
          
          {/* Experience */}
          {resume.data?.experience && resume.data.experience.length > 0 && (
            <div>
              <h2 className="text-lg font-bold border-b border-gray-200 pb-1 mb-2" style={{ color: 'black' }}>
                Professional Experience
              </h2>
              <div className="space-y-4">
                {resume.data.experience.map((exp: any, index: number) => (
                  <div key={index}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold" style={{ color: 'black' }}>{exp.title}</h3>
                        <p style={{ color: 'black' }}>{exp.company}</p>
                      </div>
                      <div className="text-sm" style={{ color: 'black' }}>
                        {exp.startDate} - {exp.endDate || 'Present'}
                      </div>
                    </div>
                    {exp.description && (
                      <p className="mt-2" style={{ color: 'black' }}>{exp.description}</p>
                    )}
                    {exp.achievements && exp.achievements.length > 0 && (
                      <ul className="list-disc list-inside mt-2" style={{ color: 'black' }}>
                        {exp.achievements.map((achievement: string, i: number) => (
                          <li key={i}>{achievement}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Skills */}
          {resume.data?.skills && (
            <div>
              <h2 className="text-lg font-bold border-b border-gray-200 pb-1 mb-2" style={{ color: 'black' }}>
                Skills
              </h2>
              <div className="flex flex-wrap gap-2">
                {Array.isArray(resume.data.skills) ? (
                  resume.data.skills.map((skill: string, index: number) => (
                    <span 
                      key={index}
                      className="bg-gray-100 px-2 py-1 rounded text-sm"
                      style={{ color: 'black' }}
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <p style={{ color: 'black' }}>{resume.data.skills}</p>
                )}
              </div>
            </div>
          )}
          
          {/* Education */}
          {resume.data?.education && resume.data.education.length > 0 && (
            <div>
              <h2 className="text-lg font-bold border-b border-gray-200 pb-1 mb-2" style={{ color: 'black' }}>
                Education
              </h2>
              <div className="space-y-4">
                {resume.data.education.map((edu: any, index: number) => (
                  <div key={index}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold" style={{ color: 'black' }}>{edu.degree || 'Degree'}</h3>
                        <p style={{ color: 'black' }}>{edu.institution || 'Institution'}</p>
                      </div>
                      <div className="text-sm" style={{ color: 'black' }}>
                        {edu.startDate && edu.endDate ? `${edu.startDate} - ${edu.endDate}` : 
                         edu.endDate ? `Completed ${edu.endDate}` : 
                         edu.startDate ? `Started ${edu.startDate}` : ''}
                      </div>
                    </div>
                    {edu.description && (
                      <p className="mt-2" style={{ color: 'black' }}>{edu.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <motion.div 
        className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center" 
             style={{ backgroundColor: '#e0e7ff', color: 'black' }}>
          <h2 className="text-xl font-semibold" style={{ color: 'black' }}>
            {resume.name} {isEnhanced && (
              <span className="ml-2 text-sm px-2 py-0.5 rounded-full" 
                    style={{ backgroundColor: '#c7d2fe', color: '#4338ca' }}>
                AI Enhanced
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800"
            style={{ color: 'black' }}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-gray-200" style={{ backgroundColor: 'white' }}>
          <button
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === 'preview' 
              ? 'border-b-2 border-indigo-500 text-indigo-600' 
              : 'text-gray-700 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('preview')}
            style={{ color: activeTab === 'preview' ? '#4f46e5' : 'black' }}
          >
            Preview
          </button>
          <button
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === 'download' 
              ? 'border-b-2 border-indigo-500 text-indigo-600' 
              : 'text-gray-700 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('download')}
            style={{ color: activeTab === 'download' ? '#4f46e5' : 'black' }}
          >
            Download
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-auto p-4" style={{ backgroundColor: 'white' }}>
          {activeTab === 'preview' && (
            <div className="h-full">
              {fetchingPdf ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <svg className="animate-spin h-10 w-10 text-indigo-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-gray-700">Loading PDF preview...</p>
                </div>
              ) : pdfObjectUrl && !pdfError ? (
                // If we have a PDF URL, show PDF viewer
                <iframe 
                  src={`${pdfObjectUrl}#toolbar=0`}
                  className="w-full h-full border border-gray-300 rounded"
                  title="Resume Preview"
                  style={{ minHeight: '500px' }}
                />
              ) : (
                // Show error or text preview
                <>
                  {pdfError && (
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4" style={{ color: 'black' }}>
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p style={{ color: 'black' }}>{pdfError}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {renderTextPreview()}
                </>
              )}
            </div>
          )}
          
          {activeTab === 'download' && (
            <div className="max-w-2xl mx-auto p-4">
              <div className="border border-gray-300 rounded-lg p-6 text-center" 
                   style={{ backgroundColor: '#f3f4f6', color: 'black' }}>
                <svg className="h-16 w-16 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                     style={{ color: '#4f46e5' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                
                <h3 className="text-lg font-medium mb-2" style={{ color: 'black' }}>Download Resume</h3>
                <p className="mb-4" style={{ color: 'black' }}>
                  Download your resume as a PDF file that you can share or print.
                </p>
                
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium"
                  style={{ 
                    backgroundColor: isDownloading ? '#6366f1' : '#4f46e5', 
                    color: 'white',
                    opacity: isDownloading ? '0.7' : '1', 
                    cursor: isDownloading ? 'not-allowed' : 'pointer',
                    border: 'none'
                  }}
                >
                  {isDownloading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Downloading...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download PDF
                    </>
                  )}
                </button>
              </div>
              
              {isEnhanced && (
                <div className="mt-6 rounded-lg p-6" 
                     style={{ backgroundColor: '#e0e7ff', border: '1px solid #c7d2fe', color: 'black' }}>
                  <h3 className="text-md font-medium mb-2" style={{ color: 'black' }}>Enhanced Resume Benefits</h3>
                  <ul className="space-y-2 text-sm" style={{ color: 'black' }}>
                    <li className="flex items-start">
                      <svg className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"
                           style={{ color: '#4f46e5' }}>
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Tailored to highlight skills relevant to the job</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"
                           style={{ color: '#4f46e5' }}>
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Optimized descriptions aligned with job requirements</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"
                           style={{ color: '#4f46e5' }}>
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Professionally formatted for better readability</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"
                           style={{ color: '#4f46e5' }}>
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Increased chances of getting past application tracking systems</span>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between"
             style={{ backgroundColor: 'white' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-md shadow-sm text-sm font-medium"
            style={{ 
              backgroundColor: 'white', 
              color: 'black',
              border: '1px solid #d1d5db'
            }}
          >
            Close
          </button>
          
          <div className="flex space-x-3">
            <button
              onClick={handleDownload}
              className="px-4 py-2 border rounded-md shadow-sm text-sm font-medium"
              style={{ 
                backgroundColor: 'white', 
                color: 'black',
                border: '1px solid #d1d5db'
              }}
            >
              Download
            </button>
            
            {isEnhanced && onUseResume && (
              <button
                onClick={onUseResume}
                className="px-4 py-2 border rounded-md shadow-sm text-sm font-medium"
                style={{ 
                  backgroundColor: '#4f46e5', 
                  color: 'white',
                  border: 'none'
                }}
              >
                Use This Resume
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}