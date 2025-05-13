// app/api/resume-match/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: NextRequest) {
  try {
    // Get resume data and job details from request
    const { resumeData, jobDetails } = await request.json();

    if (!resumeData || !jobDetails) {
      return NextResponse.json({ error: 'Missing resume data or job details' }, { status: 400 });
    }

    // Call Gemini API to analyze match
    const matchResult = await analyzeResumeJobMatch(resumeData, jobDetails);

    return NextResponse.json(matchResult);
  } catch (error) {
    console.error('❌ Resume matching error:', error);
    return NextResponse.json({ 
      error: 'Failed to analyze resume match',
      message: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

async function analyzeResumeJobMatch(resumeData: any, jobDetails: any): Promise<any> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('Gemini API key not found in environment variables');
  }
  
  const API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent';
  
  const promptText = `
  You are an expert recruiter analyzing how well a candidate matches a job position.
  
  Given a resume and job details, analyze and provide a detailed match assessment.
  Return ONLY a JSON object with the following structure:
  
  {
    "overallScore": <number between 0-100>,
    "matchLevel": "<Excellent Match|Strong Match|Good Match|Fair Match|Poor Match>",
    "keyMatchingFactors": [
      {
        "factor": "<factor name>",
        "score": <number between 0-100>,
        "explanation": "<brief explanation>"
      }
    ],
    "strengths": [
      {
        "title": "<strength title>",
        "description": "<detailed description>",
        "relevantExperience": ["<specific experience from resume>"]
      }
    ],
    "gaps": [
      {
        "requirement": "<missing requirement>",
        "importance": "<High|Medium|Low>",
        "suggestion": "<recommendation to address gap>"
      }
    ],
    "skillsAnalysis": {
      "required": [
        {
          "skill": "<skill name>",
          "required": true,
          "hasSkill": boolean,
          "proficiency": "<Expert|Advanced|Intermediate|Basic|None>"
        }
      ],
      "preferred": [
        {
          "skill": "<skill name>",
          "required": false,
          "hasSkill": boolean,
          "proficiency": "<Expert|Advanced|Intermediate|Basic|None>"
        }
      ]
    },
    "experienceAnalysis": {
      "totalYears": <number>,
      "relevantYears": <number>,
      "matchesRequirement": boolean,
      "experienceLevel": "<Junior|Mid-Level|Senior|Executive>",
      "relevantRoles": [
        {
          "company": "<company name>",
          "position": "<position>",
          "relevanceScore": <number between 0-100>,
          "keyContributions": ["<contribution 1>", "<contribution 2>"]
        }
      ]
    },
    "educationAnalysis": {
      "meetsRequirements": boolean,
      "educationScore": <number between 0-100>,
      "relevantDegrees": [
        {
          "degree": "<degree name>",
          "institution": "<institution>",
          "relevance": "<High|Medium|Low>"
        }
      ]
    },
    "cultureFit": {
      "score": <number between 0-100>,
      "indicators": ["<indicator 1>", "<indicator 2>"],
      "assessments": ["<assessment 1>", "<assessment 2>"]
    },
    "recommendations": {
      "forRecruiter": [
        {
          "action": "<recommended action>",
          "reasoning": "<why this is recommended>",
          "priority": "<High|Medium|Low>"
        }
      ],
      "forCandidate": [
        {
          "improvement": "<suggested improvement>",
          "benefit": "<how this will help>",
          "timeline": "<Immediate|Short-term|Long-term>"
        }
      ]
    },
    "summary": {
      "overallAssessment": "<2-3 sentence executive summary>",
      "topStrengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
      "topConcerns": ["<concern 1>", "<concern 2>", "<concern 3>"],
      "recommendation": "<Strongly Recommend|Recommend|Consider|Not Recommended>"
    }
  }
  
  Resume Data:
  ${JSON.stringify(resumeData, null, 2)}
  
  Job Details:
  ${JSON.stringify(jobDetails, null, 2)}
  `;
  
  const payload = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      temperature: 0.3,
      topK: 40,
      topP: 0.9,
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
    
    const matchData = JSON.parse(jsonMatch[0]);
    return matchData;
  } catch (error) {
    console.error('❌ Error with Gemini API:', error);
    throw new Error('Failed to analyze resume match with Gemini API');
  }
}