// app/api/resume-enhancer/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// For debugging
const DEBUG = process.env.NODE_ENV !== 'production';

// Helper function for logging
function log(message: string, data?: any) {
  if (DEBUG) {
    console.log(`🤖 ${message}`);
    if (data) console.log(JSON.stringify(data, null, 2));
  }
}

export async function POST(request: NextRequest) {
  try {
    log('Received resume enhancement request');

    // Parse the request body
    const body = await request.json();
    const { resume, job } = body;
    
    if (!resume || !job) {
      return NextResponse.json({ 
        error: 'Resume and job data are required' 
      }, { status: 400 });
    }

    // Log information for debugging, but protect personal information
    log('Resume data received', { 
      hasPersonalInfo: !!resume.personalInfo,
      hasExperience: Array.isArray(resume.experience) ? resume.experience.length : 0,
      hasSkills: Array.isArray(resume.skills) ? resume.skills.length : 0,
      hasSummary: !!resume.summary
    });
    
    log('Job data received', { 
      jobTitle: job.title,
      jobCompany: job.company,
      jobSkills: Array.isArray(job.skills) ? job.skills.length : 0
    });

    // Call Gemini API to enhance the resume
    const enhancedResumeData = await enhanceResumeWithGemini(resume, job);
    
    return NextResponse.json({
      success: true,
      data: enhancedResumeData,
      method: 'gemini-ai'
    });
    
  } catch (error) {
    console.error('❌ Resume enhancement error:', error);
    return NextResponse.json({ 
      error: 'Failed to enhance resume',
      message: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

/**
 * Enhance resume using Gemini API
 */
async function enhanceResumeWithGemini(resumeData: any, jobData: any): Promise<any> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('Gemini API key not found in environment variables');
  }
  
  log('Using Gemini API for resume enhancement');
  
  const API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent';
  
  // Format resume data for the API
  const formattedResumeData = {
    personalInfo: resumeData.personalInfo || {},
    summary: resumeData.summary || '',
    skills: resumeData.skills || [],
    experience: resumeData.experience || [],
    education: resumeData.education || [],
    certifications: resumeData.certifications || [],
    projects: resumeData.projects || []
  };
  
  // Create a prompt that instructs Gemini on how to enhance the resume
  const promptText = `
  You are an expert resume optimizer. I'm providing you with a person's resume and a job description. 
  Your task is to enhance the resume to better align with the job requirements.
  
  Please analyze both the resume and job requirements carefully and return a modified version of the resume that:
  
  1. Better emphasizes skills that match the job requirements
  2. Tailors the professional summary to highlight relevant experience
  3. Rephrases work experience descriptions to better match job requirements
  4. Prioritizes the most relevant skills, experiences, and achievements
  5. Adds quantifiable achievements to experience descriptions where possible
  6. Uses relevant keywords from the job description
  7. Creates a more compelling professional story
  
  The goal is to optimize the resume without inventing false information. Only work with the facts provided, but phrase them in a way that maximizes appeal for this specific job.
  
  For each work experience entry, try to highlight specific achievements and use metrics where possible.
  Make sure to maintain the EXACT SAME DATA STRUCTURE as the input resume.
  
  Return ONLY a JSON object that follows exactly the same structure as the original resume, with your enhancements applied.

  Here is the resume to enhance:
  ${JSON.stringify(formattedResumeData)}
  
  Here is the job information:
  ${JSON.stringify(jobData)}
  
  Your response should contain only the enhanced resume JSON with no other text and follow the exact same structure as the original.
  `;
  
  // Set up request payload for Gemini API
  const payload = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      temperature: 0.2,
      topK: 40,
      topP: 0.8,
      maxOutputTokens: 4096,
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
    
    try {
      const parsedData = JSON.parse(jsonMatch[0]);
      log('Successfully enhanced resume using Gemini API');
      
      // Validate the enhanced resume structure
      if (!validateResumeStructure(parsedData)) {
        log('Enhanced resume has invalid structure, using fallback enhancement');
        return applyFallbackEnhancement(resumeData, jobData);
      }
      
      return parsedData;
    } catch (parseError) {
      console.error('Error parsing Gemini API JSON response:', parseError);
      log('Error parsing JSON, using fallback enhancement');
      return applyFallbackEnhancement(resumeData, jobData);
    }
  } catch (error) {
    console.error('Error with Gemini API:', error);
    log('API error, using fallback enhancement');
    return applyFallbackEnhancement(resumeData, jobData);
  }
}

/**
 * Validate that the enhanced resume has the correct structure
 */
function validateResumeStructure(enhancedResume: any): boolean {
  // Check for required top-level properties
  if (!enhancedResume.personalInfo || 
      !Array.isArray(enhancedResume.skills) ||
      !Array.isArray(enhancedResume.experience)) {
    console.log('Resume structure validation failed - missing required properties');
    return false;
  }
  
  // Check experience array structure if it exists
  if (enhancedResume.experience && enhancedResume.experience.length > 0) {
    const firstExp = enhancedResume.experience[0];
    if (!firstExp.title || !firstExp.company || firstExp.description === undefined) {
      console.log('Resume structure validation failed - invalid experience structure');
      return false;
    }
  }
  
  // Validate other expected properties
  if (!enhancedResume.summary) {
    console.log('Resume structure has no summary - adding empty one');
    enhancedResume.summary = '';
  }
  
  console.log('Resume structure validation passed');
  return true;
}
  
  

/**
 * Apply a fallback enhancement if the Gemini API fails
 */
function applyFallbackEnhancement(resumeData: any, jobData: any): any {
  log('Applying fallback enhancement strategy');
  
  // Create a deep copy of the resume
  const enhancedResume = JSON.parse(JSON.stringify(resumeData));
  
  // Extract job keywords from the job data
  const jobKeywords = extractJobKeywords(jobData);
  
  // Enhance the summary if it exists
  if (enhancedResume.summary) {
    enhancedResume.summary = enhanceSummary(enhancedResume.summary, jobData, jobKeywords);
  }
  
  // Enhance skills - prioritize those mentioned in job description
  if (Array.isArray(enhancedResume.skills) && enhancedResume.skills.length > 0) {
    enhancedResume.skills = enhanceSkills(enhancedResume.skills, jobKeywords);
  }
  
  // Enhance experience descriptions
  if (Array.isArray(enhancedResume.experience) && enhancedResume.experience.length > 0) {
    enhancedResume.experience = enhancedResume.experience.map((exp: { [key: string]: any }) => ({
      ...exp,
      description: enhanceDescription(exp.description, jobKeywords),
      // Add achievements array if it doesn't exist
      achievements: exp.achievements || []
    }));
  }
  
  return enhancedResume;
}

/**
 * Extract keywords from the job data
 */
function extractJobKeywords(jobData: any): string[] {
  const keywords: string[] = [];
  
  // Add skills from job data
  if (Array.isArray(jobData.skills)) {
    keywords.push(...jobData.skills);
  }
  
  // Add title words
  if (jobData.title) {
    keywords.push(...jobData.title.split(/\s+/).filter((word: string) => word.length > 3));
  }
  
  // Add requirements if available
  if (Array.isArray(jobData.requirements)) {
    const requirementWords = jobData.requirements
      .join(' ')
      .split(/\s+/)
      .filter((word: string) => word.length > 3 && !keywords.includes(word));
    
    keywords.push(...requirementWords);
  }
  
  // Add description words if available
  if (jobData.description) {
    const descriptionWords = jobData.description
      .split(/\s+/)
      .filter((word: string) => word.length > 3 && !keywords.includes(word));
    
    // Add the most frequent words from description (up to 10)
    const wordFrequency: {[key: string]: number} = {};
    descriptionWords.forEach((word: string) => {
      wordFrequency[word] = (wordFrequency[word] || 0) + 1;
    });
    
    const topWords = Object.keys(wordFrequency)
      .sort((a, b) => wordFrequency[b] - wordFrequency[a])
      .slice(0, 10);
    
    keywords.push(...topWords);
  }
  
  // Remove duplicates and return
  return [...new Set(keywords)];
}

/**
 * Enhance the summary with job-specific keywords
 */
function enhanceSummary(summary: string, jobData: any, keywords: string[]): string {
  // If summary is very short, expand it a bit
  if (summary.length < 50) {
    return `Experienced professional with expertise in ${keywords.slice(0, 3).join(', ')}, seeking the ${jobData.title} position at ${jobData.company}. ${summary}`;
  }
  
  // Otherwise, keep the summary but add a job-specific sentence at the end
  if (!summary.includes(jobData.title) && !summary.includes(jobData.company)) {
    return `${summary} Seeking to leverage these skills as a ${jobData.title} at ${jobData.company}.`;
  }
  
  return summary;
}

/**
 * Enhance skills list - prioritize those matching job keywords
 */
function enhanceSkills(skills: string[], jobKeywords: string[]): string[] {
  // First identify skills that match job keywords
  const matchingSkills = skills.filter(skill => 
    jobKeywords.some(keyword => 
      skill.toLowerCase().includes(keyword.toLowerCase()) || 
      keyword.toLowerCase().includes(skill.toLowerCase())
    )
  );
  
  // Then add remaining skills
  const remainingSkills = skills.filter(skill => !matchingSkills.includes(skill));
  
  // Return matching skills first, then others
  return [...matchingSkills, ...remainingSkills];
}

/**
 * Enhance work experience descriptions with job-relevant content
 */
function enhanceDescription(description: string, jobKeywords: string[]): string {
  if (!description) return '';
  
  // If description already mentions relevant keywords, leave it as is
  const mentionsKeywords = jobKeywords.some(keyword => 
    description.toLowerCase().includes(keyword.toLowerCase())
  );
  
  if (mentionsKeywords) return description;
  
  // Otherwise, add a sentence with relevant keywords
  const relevantKeywords = jobKeywords.slice(0, 3).join(', ');
  return `${description} Developed expertise in ${relevantKeywords} through this role.`;
}