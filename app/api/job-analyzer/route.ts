// app/api/job-analyzer/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: NextRequest) {
  try {
    // Get job description from request
    const body = await request.json();
    const { description } = body;
    
    if (!description) {
      return NextResponse.json({ 
        error: 'Job description is required' 
      }, { status: 400 });
    }

    // Call Gemini API to analyze the job description
    const analysisResult = await analyzeJobWithGemini(description);
    
    return NextResponse.json({
      success: true,
      ...analysisResult
    });
    
  } catch (error) {
    console.error('Job analysis error:', error);
    return NextResponse.json({ 
      error: 'Failed to analyze job description',
      message: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

/**
 * Analyze job description using Gemini API
 */
async function analyzeJobWithGemini(description: string): Promise<any> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('Gemini API key not found in environment variables');
  }
  
  const API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent';
  
  const promptText = `
  You are an AI job posting analyzer and enhancer. Your task is to analyze a job description and provide useful feedback and enhancements.

  Please analyze the following job description and provide:
  1. A list of 5-10 skills that are relevant to this job but may not be explicitly mentioned
  2. A list of 3-5 improvement tips to make the job posting more attractive
  3. A quality score (0-100) based on the completeness and clarity of the description
  4. A job simulation that describes what a typical day might look like in this role (about 150-200 words)
  5. A list of 5-7 key qualifications for this role extracted from the job description

  Return ONLY a JSON object with the following structure:
  {
    "skills": ["skill1", "skill2", ...],
    "improvementTips": ["tip1", "tip2", ...],
    "qualityScore": number,
    "jobSimulation": "string",
    "keyQualifications": ["qualification1", "qualification2", ...]
  }

  Here is the job description to analyze:
  ${description}
  `;
  
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
    
    try {
      const parsedData = JSON.parse(jsonMatch[0]);
      console.log('Successfully analyzed job with Gemini API');
      
      return parsedData;
    } catch (parseError) {
      console.error('Error parsing Gemini API JSON response:', parseError);
      throw new Error('Failed to parse job analysis data');
    }
  } catch (error) {
    console.error('Error with Gemini API:', error);
    throw new Error('Failed to analyze job with Gemini API');
  }
}