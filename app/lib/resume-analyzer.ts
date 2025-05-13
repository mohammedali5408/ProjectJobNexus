// app/lib/resumeAnalyzer.ts

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

// Define interfaces for resume data
export interface ResumeWorkExperience {
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
}

export interface ResumeEducation {
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  current: boolean;
}

export interface ResumeProject {
  name: string;
  description: string;
  skills: string[];
  url: string;
}

export interface ResumeCertification {
  name: string;
  issuer: string;
  date: string;
  url: string;
}

export interface ParsedResumeData {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  skills: string[];
  workExperience: ResumeWorkExperience[];
  education: ResumeEducation[];
  projects: ResumeProject[];
  certifications: ResumeCertification[];
}

export interface JobDetails {
  title: string;
  company: string;
  description: string;
  skills: string[];
  requirements: string[];
  experienceLevel?: string;
}

export interface ResumeAnalysisResult {
  parsedResume: ParsedResumeData;
  skillsMatch?: {
    matched: string[];
    missing: string[];
    score: number;
  };
  suggestions?: string[];
}

/**
 * Resume analyzer service for processing resume data using AI
 */
export class ResumeAnalyzer {
  private model: GenerativeModel;
  
  /**
   * Creates a new instance of the ResumeAnalyzer
   * @param apiKey The Gemini API key
   */
  constructor(apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: 'gemini-pro' });
  }
  
  /**
   * Parses resume text into structured data
   * @param resumeText Raw resume text
   * @returns Structured resume data
   */
  async parseResume(resumeText: string): Promise<ParsedResumeData> {
    const promptText = `
    You are a resume parsing expert. Extract structured information from this resume text. 
    Return a JSON object with the following structure:
    {
      "name": "Full Name",
      "title": "Professional Title",
      "email": "email@example.com",
      "phone": "phone number",
      "location": "City, State/Province, Country",
      "summary": "Professional summary",
      "skills": ["Skill 1", "Skill 2", ...],
      "workExperience": [
        {
          "company": "Company Name",
          "position": "Job Title",
          "startDate": "YYYY-MM",
          "endDate": "YYYY-MM",
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
    Your response should be ONLY valid JSON with no other text.
    
    Resume text:
    ${resumeText}
    `;
    
    try {
      const result = await this.model.generateContent(promptText);
      const responseText = result.response.text();
      
      // Extract the JSON object from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from AI response');
      }
      
      return JSON.parse(jsonMatch[0]) as ParsedResumeData;
    } catch (error) {
      console.error('Error parsing resume with AI:', error);
      throw error;
    }
  }
  
  /**
   * Enhances or fills missing resume data using AI
   * @param resumeData Partial resume data
   * @returns Enhanced resume data with filled missing fields
   */
  async enhanceResumeData(resumeData: Partial<ParsedResumeData>): Promise<ParsedResumeData> {
    const promptText = `
    You are a resume enhancement expert. Given this partial resume data, fill in any missing or incomplete fields.
    Return a complete JSON object with all fields filled with reasonable values based on the available information.
    
    Partial resume data:
    ${JSON.stringify(resumeData, null, 2)}
    
    Return a JSON object with all these fields completed with reasonable values:
    {
      "name": "Full Name",
      "title": "Professional Title",
      "email": "email@example.com",
      "phone": "phone number",
      "location": "City, State/Province, Country",
      "summary": "Professional summary",
      "skills": ["Skill 1", "Skill 2", ...],
      "workExperience": [...],
      "education": [...],
      "projects": [...],
      "certifications": [...]
    }
    
    Your response should be ONLY valid JSON with no other text.
    `;
    
    try {
      const result = await this.model.generateContent(promptText);
      const responseText = result.response.text();
      
      // Extract the JSON object from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from AI response');
      }
      
      return JSON.parse(jsonMatch[0]) as ParsedResumeData;
    } catch (error) {
      console.error('Error enhancing resume data with AI:', error);
      throw error;
    }
  }
  
  /**
   * Optimizes resume data for a specific job
   * @param resumeData Current resume data
   * @param jobDetails Job details to optimize for
   * @returns Optimized resume data
   */
  async optimizeForJob(resumeData: ParsedResumeData, jobDetails: JobDetails): Promise<ParsedResumeData> {
    const promptText = `
    You are a resume optimization expert. Optimize this resume for the following job. 
    Return an optimized JSON object with the same structure as the input resume.
    
    Job details:
    ${JSON.stringify(jobDetails, null, 2)}
    
    Current resume:
    ${JSON.stringify(resumeData, null, 2)}
    
    Optimize by:
    1. Tailoring the summary to emphasize relevant experience for this job
    2. Prioritizing skills that match the job requirements
    3. Highlighting relevant work experience
    4. Emphasizing relevant projects
    5. DO NOT fabricate or add false information
    6. DO NOT invent new work experiences
    
    Return ONLY the optimized JSON with the same structure as the input.
    `;
    
    try {
      const result = await this.model.generateContent(promptText);
      const responseText = result.response.text();
      
      // Extract the JSON object from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from AI response');
      }
      
      return JSON.parse(jsonMatch[0]) as ParsedResumeData;
    } catch (error) {
      console.error('Error optimizing resume with AI:', error);
      throw error;
    }
  }
  
  /**
   * Analyzes resume against job requirements
   * @param resumeData Resume data
   * @param jobDetails Job details
   * @returns Analysis result with matches and suggestions
   */
  async analyzeResumeJobMatch(resumeData: ParsedResumeData, jobDetails: JobDetails): Promise<ResumeAnalysisResult> {
    const promptText = `
    You are a resume analysis expert. Analyze this resume against the job requirements.
    
    Job details:
    ${JSON.stringify(jobDetails, null, 2)}
    
    Resume:
    ${JSON.stringify(resumeData, null, 2)}
    
    Return a JSON object with:
    1. Matched skills between resume and job
    2. Missing skills required by the job
    3. A match score from 0-100
    4. Specific suggestions to improve the resume
    
    Format:
    {
      "skillsMatch": {
        "matched": ["skill1", "skill2", ...],
        "missing": ["skill3", "skill4", ...],
        "score": 75
      },
      "suggestions": [
        "Suggestion 1",
        "Suggestion 2",
        ...
      ]
    }
    
    Return ONLY valid JSON with no other text.
    `;
    
    try {
      const result = await this.model.generateContent(promptText);
      const responseText = result.response.text();
      
      // Extract the JSON object from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from AI response');
      }
      
      const analysis = JSON.parse(jsonMatch[0]);
      
      return {
        parsedResume: resumeData,
        ...analysis
      };
    } catch (error) {
      console.error('Error analyzing resume with AI:', error);
      throw error;
    }
  }
  
  /**
   * Extracts skills from resume text
   * @param resumeText Resume text
   * @returns Extracted skills array
   */
  async extractSkills(resumeText: string): Promise<string[]> {
    const promptText = `
    You are a skills extraction expert. Extract all professional skills from this resume text.
    Return ONLY a JSON array of skills with no other text.
    
    Resume text:
    ${resumeText}
    `;
    
    try {
      const result = await this.model.generateContent(promptText);
      const responseText = result.response.text();
      
      // Extract the JSON array from the response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from AI response');
      }
      
      return JSON.parse(jsonMatch[0]) as string[];
    } catch (error) {
      console.error('Error extracting skills with AI:', error);
      throw error;
    }
  }
}

// Singleton instance for use throughout the application
let resumeAnalyzerInstance: ResumeAnalyzer | null = null;

/**
 * Gets the ResumeAnalyzer instance
 * @param apiKey The Gemini API key (required for initialization)
 * @returns The ResumeAnalyzer instance
 */
export function getResumeAnalyzer(apiKey?: string): ResumeAnalyzer {
  if (!resumeAnalyzerInstance) {
    if (!apiKey) {
      throw new Error('API key is required for initialization');
    }
    resumeAnalyzerInstance = new ResumeAnalyzer(apiKey);
  }
  return resumeAnalyzerInstance;
}