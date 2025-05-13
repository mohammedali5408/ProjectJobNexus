// app/api/resume-parser/route.tsx
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// For debugging
const DEBUG = true;

// Helper function for logging
function log(message: string, data?: any) {
  if (DEBUG) {
    console.log(`🔍 ${message}`);
    if (data) console.log(JSON.stringify(data, null, 2));
  }
}

export async function POST(request: NextRequest) {
  try {
    log('📄 Received resume parsing request');

    // Get file from request
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      console.error('❌ No file provided');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const fileType = file.type;
    const supportedTypes = [
      'application/pdf', 
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/tiff'
    ];

    if (!supportedTypes.includes(fileType)) {
      console.error('❌ Invalid file type:', fileType);
      return NextResponse.json({ 
        error: 'Invalid file type. Please upload a PDF, Word document, image, or plain text file.' 
      }, { status: 400 });
    }

    log('✅ Valid file received', { name: file.name, type: fileType });

    // Create temp directory for processing
    const tempDir = path.join(os.tmpdir(), 'resume-parser');
    try {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
    } catch (error) {
      console.error('❌ Error creating temp directory:', error);
      return NextResponse.json({ error: 'Server error while processing file' }, { status: 500 });
    }

    // Save file to temp directory
    const tempFilePath = path.join(tempDir, file.name);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    fs.writeFileSync(tempFilePath, buffer);
    log('✅ File saved to temp directory', { path: tempFilePath });

    let extractedText = '';
    
    // Process file based on type
    if (fileType === 'text/plain') {
      // For text files, read directly
      extractedText = fs.readFileSync(tempFilePath, 'utf-8');
      log('✅ Text read directly from file');
    } else if (fileType.startsWith('image/')) {
      // For images, use Google Cloud Vision API
      extractedText = await extractTextWithVision(buffer);
      log('✅ Text extracted from image using Cloud Vision API');
    } else {
      // For PDFs and other documents, use LlamaIndex
      extractedText = await extractTextWithLlamaIndex(tempFilePath, file.name);
      log('✅ Text extracted using LlamaIndex');
    }

    // Clean up temp files
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (error) {
      console.error('Error cleaning up temp files:', error);
    }

    // Use Gemini API to parse the extracted text into structured resume data
    const parsedResumeData = await parseResumeWithGemini(extractedText);
    
    // Transform the data to match expected component structure
    const transformedData = transformResumeData(parsedResumeData);
    
    const resumeId = `resume_${Date.now()}`;
    
    return NextResponse.json({
      success: true,
      data: transformedData,
      id: resumeId,
      method: 'llamaindex-vision-gemini'
    });
    
  } catch (error) {
    console.error('❌ Resume parsing error:', error);
    return NextResponse.json({ 
      error: 'Failed to parse resume',
      message: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

/**
 * Transform the parsed resume data to match expected component structure
 */
function transformResumeData(rawData: any) {
  // Create a restructured object that matches your component expectations
  const transformed = {
    personalInfo: {
      name: rawData.name || '',
      title: rawData.title || '',
      email: rawData.email || '',
      phone: rawData.phone || '',
      location: rawData.location || ''
    },
    summary: rawData.summary || '',
    // Transform workExperience to experience
    experience: (rawData.workExperience || []).map((item: any) => ({
      title: item.position || '',  // Map position to title
      company: item.company || '',
      startDate: item.startDate || '',
      endDate: item.current ? 'Present' : (item.endDate || ''),
      description: item.description || '',
      achievements: []  // Add empty achievements array
    })),
    education: (rawData.education || []).map((item: any) => ({
      degree: item.degree || '',
      institution: item.institution || '',
      field: item.field || '',
      startDate: item.startDate || '',
      endDate: item.current ? 'Present' : (item.endDate || ''),
      gpa: ''  // Add empty GPA field
    })),
    skills: rawData.skills || [],
    certifications: rawData.certifications || [],
    projects: rawData.projects || []
  };
  
  log('✅ Transformed resume data to match component structure', transformed);
  return transformed;
}

/**
 * Extract text from images using Google Cloud Vision API
 */
async function extractTextWithVision(imageBuffer: Buffer): Promise<string> {
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
  
  if (!apiKey) {
    throw new Error('Google Cloud API key not found in environment variables');
  }
  
  // Convert buffer to base64
  const base64Image = imageBuffer.toString('base64');
  
  const API_URL = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
  
  const payload = {
    requests: [
      {
        image: {
          content: base64Image
        },
        features: [
          {
            type: 'TEXT_DETECTION',
            maxResults: 1
          }
        ]
      }
    ]
  };
  
  try {
    const response = await axios.post(API_URL, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    // Extract the full text from the response
    const textAnnotations = response?.data?.responses?.[0]?.textAnnotations;
    
    if (!textAnnotations || textAnnotations.length === 0) {
      return 'No text detected in the image.';
    }
    
    // The first element contains the entire text
    return textAnnotations[0].description || '';
    
  } catch (error) {
    console.error('❌ Error with Google Cloud Vision API:', error);
    throw new Error('Failed to extract text from image with Cloud Vision API');
  }
}

/**
 * Extract text from documents using LlamaIndex
 */
async function extractTextWithLlamaIndex(filePath: string, fileName: string): Promise<string> {
  try {
    log('🦙 Using LlamaIndex to extract text from document');
    
    // Use dynamic import to avoid server-side issues
    const { LlamaParseReader } = await import('llamaindex');
    
    // Create LlamaIndex parser with your API key
    const reader = new LlamaParseReader({ 
      apiKey: process.env.LLAMAINDEX_API_KEY || 'llx-HQONPgSL2bZa0GmuE3pdj9KodjGc3O2QesIemhzHj2kY7at8', 
      resultType: 'text' 
    });
    
    // Parse the document
    const documents = await reader.loadData(filePath);
    
    if (!documents || documents.length === 0) {
      throw new Error('No documents returned from LlamaIndex');
    }
    
    // Combine all document text
    const extractedText = documents.map(doc => doc.text || '').join('\n\n');
    log('✅ Successfully extracted text using LlamaIndex');
    
    return extractedText;
  } catch (error) {
    console.error('❌ Error with LlamaIndex:', error);
    
    // Fallback for Gemini processing
    return `[This is a document file named "${fileName}" that needs to be parsed as a resume. LlamaIndex extraction failed.]`;
  }
}

/**
 * Parse resume text using Gemini API
 */
async function parseResumeWithGemini(textContent: string): Promise<any> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('Gemini API key not found in environment variables');
  }
  
  log('🤖 Using Gemini API for structured parsing');
  
  const API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent';
  
  const promptText = `
  You are a resume parsing expert. I'm providing you with text extracted from a resume.
  Extract all structured information and return ONLY a JSON object with the following structure:
  {
    "name": "Full Name",
    "title": "Professional Title or what position they seem most suited for based on experience",
    "email": "email@example.com",
    "phone": "phone number",
    "location": "City, State/Province, Country",
    "summary": "Professional summary (max 3 sentences)",
    "skills": ["Skill 1", "Skill 2", ...],
    "workExperience": [
      {
        "company": "Company Name",
        "position": "Job Title",
        "startDate": "YYYY-MM", 
        "endDate": "YYYY-MM", // Empty string if current position
        "current": boolean,
        "description": "Job description"
      }
    ],
    "education": [
      {
        "institution": "University Name",
        "degree": "Degree Type",
        "field": "Field of Study",
        "startDate": "YYYY-MM",
        "endDate": "YYYY-MM",
        "current": boolean
      }
    ],
    "projects": [
      {
        "name": "Project Name",
        "description": "Project description",
        "skills": ["Skill 1", "Skill 2", ...],
        "url": "Project URL"
      }
    ],
    "certifications": [
      {
        "name": "Certification Name",
        "issuer": "Issuing Organization",
        "date": "YYYY-MM",
        "url": "Verification URL"
      }
    ]
  }
  
  If you can't find information for a field, use empty strings or empty arrays as appropriate.
  Parse dates in YYYY-MM format when possible.
  For 'current' fields, set to true if the text suggests this is their current position/education.
  Your response should be ONLY valid JSON with no other text.
  
  Here is the content to extract information from:
  ${textContent}
  `;
  
  // Set up request payload for Gemini API
  const payload = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      temperature: 0.2,
      topK: 40,
      topP: 0.8,
      maxOutputTokens: 2048,
    },
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      }
    ]
  };
  
  try {
    const response = await axios.post(API_URL, payload, {
      params: { key: apiKey },
      headers: { 'Content-Type': 'application/json' }
    });
    
    const generatedText = response?.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) {
      throw new Error('Invalid response from Gemini API');
    }
    
    const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from Gemini API response');
    }
    
    const parsedData = JSON.parse(jsonMatch[0]);
    log('✅ Successfully parsed resume data using Gemini API');
    
    return parsedData;
  } catch (error) {
    console.error('❌ Error with Gemini API:', error);
    throw new Error('Failed to parse resume with Gemini API');
  }
}