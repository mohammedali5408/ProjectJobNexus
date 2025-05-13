// ResumeDropZone.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';

interface ResumeDropZoneProps {
  onFileUpload: (file: File) => void;
  isUploading: boolean;
  uploadProgress: number;
}

export default function ResumeDropZone({ 
  onFileUpload, 
  isUploading,
  uploadProgress 
}: ResumeDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  
  // Reset file error when upload starts
  useEffect(() => {
    if (isUploading) {
      setFileError(null);
    }
  }, [isUploading]);
  
  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // This helps with handling when dragging over child elements
    if (e.type === 'dragenter') {
      setDragCounter(prev => prev + 1);
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setDragCounter(prev => prev - 1);
      if (dragCounter - 1 === 0) {
        setIsDragging(false);
      }
    }
  }, [dragCounter]);
  
  // Reset drag counter when drag ends
  const handleDragEnd = useCallback(() => {
    setDragCounter(0);
    setIsDragging(false);
  }, []);
  
  // Handle drop event
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    handleDragEnd();
    
    console.log('File dropped');
    setFileError(null);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      console.log('Dropped file:', file.name, file.type, file.size);
      
      // Check if file is PDF, Word, or plain text
      const validTypes = [
        'application/pdf', 
        'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];
      
      // Check file size (10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      
      if (!validTypes.includes(file.type)) {
        console.error('Invalid file type:', file.type);
        setFileError('Please upload a PDF, Word document, or plain text file.');
        return;
      }
      
      if (file.size > maxSize) {
        console.error('File too large:', file.size);
        setFileError('File is too large. Maximum size is 10MB.');
        return;
      }
      
      console.log('Valid file detected, processing file...');
      onFileUpload(file);
    }
  }, [onFileUpload, handleDragEnd]);
  
  // Handle file input change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    setFileError(null);
    
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      console.log('File selected from input:', file.name, file.type, file.size);
      
      // Check file size (10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      
      if (file.size > maxSize) {
        console.error('File too large:', file.size);
        setFileError('File is too large. Maximum size is 10MB.');
        return;
      }
      
      onFileUpload(file);
    }
  }, [onFileUpload]);
  
  // Handle click to open file dialog
  const openFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // Get progress status text
  const getProgressStatusText = () => {
    if (uploadProgress < 25) return 'Reading file...';
    if (uploadProgress < 50) return 'Extracting content...';
    if (uploadProgress < 75) return 'Analyzing resume...';
    if (uploadProgress < 100) return 'Finalizing parsing...';
    return 'Resume parsed successfully!';
  };
  
  return (
    <div 
      className={`relative w-full p-6 border-2 ${
        isDragging 
          ? 'border-indigo-500 bg-indigo-50' 
          : fileError 
            ? 'border-red-300 bg-red-50'
            : 'border-dashed border-gray-300 bg-gray-50'
      } rounded-lg transition-colors duration-300 ease-in-out`}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      onClick={!isUploading ? openFileDialog : undefined}
      style={{ cursor: isUploading ? 'default' : 'pointer' }}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.txt"
        onChange={handleChange}
        disabled={isUploading}
      />
      
      {isUploading ? (
        <div className="text-center">
          <div className="mb-2 flex justify-center">
            <svg className="animate-spin h-10 w-10 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          
          <div className="mt-4">
            <div className="relative w-full h-2 bg-gray-200 rounded-full">
              <div 
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300 ease-in-out" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="mt-3 text-sm font-medium text-gray-700">
              {getProgressStatusText()}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Please don't refresh the page while parsing is in progress.
            </p>
          </div>
        </div>
      ) : (
        <div className="text-center">
          {fileError ? (
            <div className="text-red-500 mb-2">
              <svg className="mx-auto h-10 w-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="mt-2 text-sm font-medium">{fileError}</p>
              <p className="mt-1 text-xs">Please try again with a different file.</p>
            </div>
          ) : (
            <>
              <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="mt-2 text-sm text-gray-600">
                Drag and drop your resume here, or{' '}
                <span className="text-indigo-600 font-medium">click to browse</span>
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Supports PDF, Word document (.doc, .docx), or plain text file (.txt)
              </p>
            </>
          )}
        </div>
      )}
      
      {/* Supported file types */}
      <div className="mt-4 flex justify-center space-x-4">
        <div className="flex items-center text-xs text-gray-500">
          <svg className="h-4 w-4 mr-1 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
          PDF
        </div>
        <div className="flex items-center text-xs text-gray-500">
          <svg className="h-4 w-4 mr-1 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
          DOC/DOCX
        </div>
        <div className="flex items-center text-xs text-gray-500">
          <svg className="h-4 w-4 mr-1 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
          TXT
        </div>
      </div>
    </div>
  );
}