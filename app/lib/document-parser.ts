// app/lib/documentParser.ts

/**
 * Document parser service for extracting text from various file formats
 * Handles PDF, Word documents, and text files
 */

import { Buffer } from 'buffer';

// Define interfaces for document parsing
interface ParsedDocument {
  text: string;
  metadata?: Record<string, any>;
}

interface ParserOptions {
  includeMetadata?: boolean;
  maxPages?: number;
}

/**
 * Extracts text from a PDF file
 * @param buffer The PDF file buffer
 * @param options Parser options
 * @returns Extracted text and metadata
 */
export async function parsePDF(buffer: Buffer, options: ParserOptions = {}): Promise<ParsedDocument> {
  // Import pdf-parse dynamically to avoid server/client mismatch
  const pdfParse = (await import('pdf-parse')).default;
  
  try {
    const result = await pdfParse(buffer, {
      max: options.maxPages || undefined,
    });
    
    const parsed: ParsedDocument = {
      text: result.text,
    };
    
    if (options.includeMetadata) {
      parsed.metadata = {
        info: result.info,
        pageCount: result.numpages,
        version: result.version,
      };
    }
    
    return parsed;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to parse PDF document');
  }
}

/**
 * Extracts text from a Word document (DOCX/DOC)
 * @param buffer The Word document buffer
 * @param options Parser options
 * @returns Extracted text and metadata
 */
export async function parseWord(buffer: Buffer, options: ParserOptions = {}): Promise<ParsedDocument> {
  // Import mammoth dynamically to avoid server/client mismatch
  const mammoth = (await import('mammoth')).default;
  
  try {
    const result = await mammoth.extractRawText({
      buffer: buffer,
    });
    
    const parsed: ParsedDocument = {
      text: result.value,
    };
    
    if (options.includeMetadata && result.messages) {
      parsed.metadata = {
        messages: result.messages,
      };
    }
    
    return parsed;
  } catch (error) {
    console.error('Error parsing Word document:', error);
    throw new Error('Failed to parse Word document');
  }
}

/**
 * Extracts text from a plain text file
 * @param buffer The text file buffer
 * @returns Extracted text
 */
export function parseText(buffer: Buffer): ParsedDocument {
  try {
    const textDecoder = new TextDecoder('utf-8');
    return {
      text: textDecoder.decode(buffer),
    };
  } catch (error) {
    console.error('Error parsing text file:', error);
    throw new Error('Failed to parse text file');
  }
}

/**
 * Extracts text from a file based on its MIME type
 * @param buffer The file buffer
 * @param mimeType The MIME type of the file
 * @param options Parser options
 * @returns Extracted text and metadata
 */
export async function parseDocument(
  buffer: Buffer,
  mimeType: string,
  options: ParserOptions = {}
): Promise<ParsedDocument> {
  switch (mimeType) {
    case 'application/pdf':
      return parsePDF(buffer, options);
      
    case 'application/msword':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return parseWord(buffer, options);
      
    case 'text/plain':
      return parseText(buffer);
      
    default:
      throw new Error(`Unsupported file type: ${mimeType}`);
  }
}

/**
 * Extracts text from a File object
 * @param file The File object
 * @param options Parser options
 * @returns Extracted text and metadata
 */
export async function parseFile(file: File, options: ParserOptions = {}): Promise<ParsedDocument> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  return parseDocument(buffer, file.type, options);
}

/**
 * Processes resume text to clean and normalize it
 * @param text Raw resume text
 * @returns Cleaned and normalized text
 */
export function preprocessResumeText(text: string): string {
  // Remove excessive whitespace
  let processed = text.replace(/\s+/g, ' ');
  
  // Normalize line breaks
  processed = processed.replace(/\r\n/g, '\n');
  
  // Normalize bullet points and special characters
  processed = processed.replace(/[•●○◦◘□]/g, '* ');
  
  // Remove non-printable characters
  processed = processed.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Fix common OCR errors in resumes
  const ocrCorrections: Record<string, string> = {
    'Objeclive': 'Objective',
    'Educalion': 'Education',
    'Expehence': 'Experience',
    'Skílls': 'Skills',
    'Achievemenls': 'Achievements',
  };
  
  Object.entries(ocrCorrections).forEach(([error, correction]) => {
    processed = processed.replace(new RegExp(error, 'gi'), correction);
  });
  
  return processed;
}

/**
 * Extracts sections from resume text
 * @param text Preprocessed resume text
 * @returns Object with sections extracted from the resume
 */
export function extractResumeSections(text: string): Record<string, string> {
  const sections: Record<string, string> = {};
  
  // Common section titles in resumes
  const sectionPatterns = [
    { name: 'summary', pattern: /\b(summary|profile|objective|about|professional\s+summary)\b/i },
    { name: 'education', pattern: /\b(education|academic|qualification|degree)\b/i },
    { name: 'experience', pattern: /\b(experience|employment|work\s+history|professional\s+experience)\b/i },
    { name: 'skills', pattern: /\b(skills|technical\s+skills|core\s+competencies|expertise)\b/i },
    { name: 'projects', pattern: /\b(projects|personal\s+projects|project\s+experience)\b/i },
    { name: 'certifications', pattern: /\b(certifications|certificates|credentials|qualifications)\b/i },
  ];
  
  // Split text into lines
  const lines = text.split('\n');
  
  let currentSection = 'other';
  let sectionContent: string[] = [];
  
  // Process each line and identify sections
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // Check if this line might be a section header
    if (trimmedLine.length < 50 && /[A-Z]/.test(trimmedLine[0])) {
      let newSectionFound = false;
      
      // Check against our section patterns
      for (const { name, pattern } of sectionPatterns) {
        if (pattern.test(trimmedLine)) {
          // Save the current section if it has content
          if (sectionContent.length > 0) {
            sections[currentSection] = sectionContent.join('\n');
          }
          
          // Start a new section
          currentSection = name;
          sectionContent = [];
          newSectionFound = true;
          break;
        }
      }
      
      if (!newSectionFound) {
        sectionContent.push(trimmedLine);
      }
    } else {
      sectionContent.push(trimmedLine);
    }
  }
  
  // Save the last section
  if (sectionContent.length > 0) {
    sections[currentSection] = sectionContent.join('\n');
  }
  
  return sections;
}