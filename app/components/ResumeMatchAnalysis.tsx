// app/components/ResumeMatchAnalysis.tsx
import React from 'react';
import { motion } from 'framer-motion';

interface ResumeMatchProps {
  matchData: any;
  onClose: () => void;
}

export default function ResumeMatchAnalysis({ matchData, onClose }: ResumeMatchProps) {
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600 bg-green-100';
    if (score >= 70) return 'text-blue-600 bg-blue-100';
    if (score >= 50) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getMatchLevelColor = (matchLevel: string) => {
    switch (matchLevel) {
      case 'Excellent Match':
        return 'text-green-800 bg-green-100 border border-green-200';
      case 'Strong Match':
        return 'text-blue-800 bg-blue-100 border border-blue-200';
      case 'Good Match':
        return 'text-indigo-800 bg-indigo-100 border border-indigo-200';
      case 'Fair Match':
        return 'text-yellow-800 bg-yellow-100 border border-yellow-200';
      default:
        return 'text-red-800 bg-red-100 border border-red-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Resume Match Analysis</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Overall Match Score */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center">
              <div className={`text-5xl font-bold ${getScoreColor(matchData.overallScore).split(' ')[0]}`}>
                {matchData.overallScore}%
              </div>
              <div className="ml-4">
                <div className={`px-4 py-2 rounded-full text-sm font-medium ${getMatchLevelColor(matchData.matchLevel)}`}>
                  {matchData.matchLevel}
                </div>
              </div>
            </div>
            <p className="mt-3 text-gray-600 text-lg">{matchData.summary?.overallAssessment}</p>
            <div className={`mt-3 inline-flex items-center px-6 py-2 rounded-full ${
              matchData.summary?.recommendation === 'Strongly Recommend' ? 'bg-green-600 text-white' :
              matchData.summary?.recommendation === 'Recommend' ? 'bg-blue-600 text-white' :
              matchData.summary?.recommendation === 'Consider' ? 'bg-yellow-500 text-white' :
              'bg-red-600 text-white'
            }`}>
              {matchData.summary?.recommendation}
            </div>
          </div>

          {/* Key Matching Factors */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Matching Factors</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {matchData.keyMatchingFactors?.map((factor: any, index: number) => (
                <div 
                  key={index}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-gray-900">{factor.factor}</h4>
                    <span className={`text-sm font-bold px-3 py-1 rounded-full ${getScoreColor(factor.score)}`}>
                      {factor.score}%
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{factor.explanation}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Skills Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Required Skills</h3>
              <div className="space-y-3">
                {matchData.skillsAnalysis?.required?.map((skill: any, index: number) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center">
                      {skill.hasSkill ? (
                        <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      <span className="text-gray-900">{skill.skill}</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      skill.proficiency === 'Expert' ? 'bg-purple-100 text-purple-800' :
                      skill.proficiency === 'Advanced' ? 'bg-blue-100 text-blue-800' :
                      skill.proficiency === 'Intermediate' ? 'bg-green-100 text-green-800' :
                      skill.proficiency === 'Basic' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {skill.proficiency}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Preferred Skills</h3>
              <div className="space-y-3">
                {matchData.skillsAnalysis?.preferred?.map((skill: any, index: number) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center">
                      {skill.hasSkill ? (
                        <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      <span className="text-gray-900">{skill.skill}</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      skill.proficiency === 'Expert' ? 'bg-purple-100 text-purple-800' :
                      skill.proficiency === 'Advanced' ? 'bg-blue-100 text-blue-800' :
                      skill.proficiency === 'Intermediate' ? 'bg-green-100 text-green-800' :
                      skill.proficiency === 'Basic' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {skill.proficiency}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Experience Analysis */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Experience Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-indigo-600">
                  {matchData.experienceAnalysis?.totalYears}
                </div>
                <div className="text-sm text-gray-600">Total Years</div>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-purple-600">
                  {matchData.experienceAnalysis?.relevantYears}
                </div>
                <div className="text-sm text-gray-600">Relevant Years</div>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-xl font-bold text-indigo-600">
                  {matchData.experienceAnalysis?.experienceLevel}
                </div>
                <div className="text-sm text-gray-600">Experience Level</div>
              </div>
            </div>
            
            <h4 className="font-medium text-gray-900 mb-3">Relevant Roles</h4>
            <div className="space-y-4">
              {matchData.experienceAnalysis?.relevantRoles?.map((role: any, index: number) => (
                <div key={index} className="bg-white rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h5 className="font-medium text-gray-900">{role.position}</h5>
                      <p className="text-sm text-gray-600">{role.company}</p>
                    </div>
                    <span className={`text-sm font-bold px-3 py-1 rounded-full ${getScoreColor(role.relevanceScore)}`}>
                      {role.relevanceScore}% Relevant
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-sm font-medium text-gray-700">Key Contributions:</p>
                    <ul className="mt-1 space-y-1">
                      {role.keyContributions?.map((contribution: string, idx: number) => (
                        <li key={idx} className="text-sm text-gray-600 flex items-start">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 mr-2 mt-2" />
                          {contribution}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Strengths and Gaps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Strengths</h3>
              <div className="space-y-4">
                {matchData.strengths?.map((strength: any, index: number) => (
                  <div key={index} className="border-l-4 border-green-500 pl-4">
                    <h4 className="font-medium text-gray-900">{strength.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{strength.description}</p>
                    {strength.relevantExperience?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-gray-500">Relevant Experience:</p>
                        <ul className="mt-1 space-y-1">
                          {strength.relevantExperience.map((exp: string, idx: number) => (
                            <li key={idx} className="text-xs text-gray-600 flex items-start">
                              <span className="h-1 w-1 rounded-full bg-green-500 mr-2 mt-1.5" />
                              {exp}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Gaps</h3>
              <div className="space-y-4">
                {matchData.gaps?.map((gap: any, index: number) => (
                  <div key={index} className="border-l-4 border-red-500 pl-4">
                    <div className="flex justify-between items-start">
                      <h4 className="font-medium text-gray-900">{gap.requirement}</h4>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        gap.importance === 'High' ? 'bg-red-100 text-red-800' :
                        gap.importance === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {gap.importance} Priority
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{gap.suggestion}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-indigo-900 mb-3">For Recruiter</h4>
                <div className="space-y-3">
                  {matchData.recommendations?.forRecruiter?.map((rec: any, index: number) => (
                    <div key={index} className="bg-white p-3 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-medium text-gray-900">{rec.action}</p>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          rec.priority === 'High' ? 'bg-red-100 text-red-800' :
                          rec.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {rec.priority}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{rec.reasoning}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-medium text-indigo-900 mb-3">For Candidate</h4>
                <div className="space-y-3">
                  {matchData.recommendations?.forCandidate?.map((rec: any, index: number) => (
                    <div key={index} className="bg-white p-3 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-medium text-gray-900">{rec.improvement}</p>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          rec.timeline === 'Immediate' ? 'bg-red-100 text-red-800' :
                          rec.timeline === 'Short-term' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {rec.timeline}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{rec.benefit}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-indigo-600 text-white rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">Top Strengths</h4>
                <ul className="space-y-2">
                  {matchData.summary?.topStrengths?.map((strength: string, index: number) => (
                    <li key={index} className="flex items-center">
                      <svg className="h-5 w-5 text-green-300 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Top Concerns</h4>
                <ul className="space-y-2">
                  {matchData.summary?.topConcerns?.map((concern: string, index: number) => (
                    <li key={index} className="flex items-center">
                      <svg className="h-5 w-5 text-red-300 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      {concern}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Close
          </button>
          <button
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Contact Candidate
          </button>
        </div>
      </motion.div>
    </div>
  );
}