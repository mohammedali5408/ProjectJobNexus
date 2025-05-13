'use client';

import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function SeedJobsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sampleJobs = [
    {
      title: "Backend Engineer (Node.js/Express)",
      company: "ServerStack Solutions",
      location: "Austin, TX (Hybrid)",
      employmentType: "Full-time",
      experienceLevel: "Mid level",
      salary: { 
        min: "110000", 
        max: "140000", 
        period: "yearly", 
        currency: "USD" 
      },
      description: "Design and implement scalable APIs and microservices for our growing SaaS platform. You'll work with our team to architect backend solutions, optimize database performance, and ensure high availability of our services.",
      requirements: "3+ years experience with Node.js/Express\nStrong knowledge of RESTful API design\nExperience with MongoDB and SQL databases\nFamiliarity with message queues (RabbitMQ, Kafka)\nUnderstanding of containerization (Docker, Kubernetes)\nExperience with unit and integration testing",
      benefits: "Competitive salary + equity\nComprehensive health benefits\n401(k) matching program\nFlexible work schedule\nLearning stipend\n20 days PTO + holidays",
      skills: ["Node.js", "Express", "MongoDB", "RESTful APIs", "Docker", "Microservices"],
      applicationType: "internal",
      externalUrl: "",
      remote: "hybrid",
      visaSponsorship: true,
      jobSimulation: "You'll start your day reviewing API performance metrics and identifying bottlenecks. Mid-morning, you'll collaborate with the team on designing a new microservice. After lunch, you'll implement new endpoints following our API standards and write comprehensive tests. You'll wrap up by documenting your work and participating in code reviews.",
      keyQualifications: [
        "Built and maintained production Node.js applications",
        "Experience with database optimization",
        "Strong understanding of API security best practices"
      ],
      status: "active",
      recruiterId: "UWGIkDkoWWQLuhN51Y81fuMVhWr2",
      recruiterEmail: "amitsamantscience@gmail.com",
      applicants: 0,
      views: 0
    },
    {
      title: "Full Stack Developer (React/Node.js)",
      company: "Unified Technologies",
      location: "Remote (US Based)",
      employmentType: "Full-time",
      experienceLevel: "Mid level",
      salary: { 
        min: "115000", 
        max: "145000", 
        period: "yearly", 
        currency: "USD" 
      },
      description: "Join our product team to build and maintain our customer-facing web applications. You'll work across the entire stack, implementing new features, fixing bugs, and continuously improving our codebase.",
      requirements: "3+ years of full stack development experience\nProficiency with React and Node.js\nExperience with TypeScript\nFamiliarity with SQL and NoSQL databases\nUnderstanding of CI/CD pipelines\nGood communication skills",
      benefits: "Fully remote work\nCompetitive salary\nHealth, dental, and vision insurance\nUnlimited PTO\nHome office stipend\nProfessional development budget",
      skills: ["React", "Node.js", "TypeScript", "MongoDB", "PostgreSQL", "Git"],
      applicationType: "internal",
      externalUrl: "",
      remote: "fully",
      visaSponsorship: false,
      jobSimulation: "Your day begins with a team standup to discuss priorities. You might spend the morning working on a new React component for our customer dashboard, then switch to backend work after lunch, implementing a new API endpoint. You'll regularly collaborate with product managers to refine requirements and with QA engineers to ensure quality.",
      keyQualifications: [
        "Experience with modern JavaScript frameworks",
        "Built end-to-end features across frontend and backend",
        "Strong problem-solving skills"
      ],
      status: "active",
      recruiterId: "UWGIkDkoWWQLuhN51Y81fuMVhWr2",
      recruiterEmail: "amitsamantscience@gmail.com",
      applicants: 0,
      views: 0
    },
    {
      title: "Mobile Developer (React Native)",
      company: "AppFusion",
      location: "Seattle, WA (Hybrid)",
      employmentType: "Full-time",
      experienceLevel: "Senior level",
      salary: { 
        min: "130000", 
        max: "160000", 
        period: "yearly", 
        currency: "USD" 
      },
      description: "Lead the development of our cross-platform mobile applications using React Native. You'll create smooth, intuitive user experiences while ensuring high performance and reliability across iOS and Android platforms.",
      requirements: "4+ years of mobile development experience\nProven expertise with React Native\nExperience with native module integration\nFamiliarity with app store deployment processes\nStrong UI/UX sensibilities\nExperience with state management solutions",
      benefits: "Competitive salary package\nGenerous equity options\nComprehensive healthcare\nFlexible work arrangements\nGym membership\nAnnual company retreat",
      skills: ["React Native", "JavaScript", "TypeScript", "Redux", "Mobile UI/UX", "Native Modules"],
      applicationType: "internal",
      externalUrl: "",
      remote: "hybrid",
      visaSponsorship: true,
      jobSimulation: "In the morning, you'll debug a performance issue affecting older Android devices. By midday, you'll work on implementing a new feature using native modules. In the afternoon, you'll collaborate with designers to refine animations and transitions. You'll finish the day by preparing a build for QA testing and reviewing PRs from junior developers.",
      keyQualifications: [
        "Shipped multiple React Native apps to production",
        "Experience optimizing app performance",
        "Familiar with both iOS and Android ecosystems"
      ],
      status: "active",
      recruiterId: "UWGIkDkoWWQLuhN51Y81fuMVhWr2",
      recruiterEmail: "amitsamantscience@gmail.com",
      applicants: 0,
      views: 0
    },
    {
      title: "Product Manager (B2B SaaS)",
      company: "SolutionSphere",
      location: "Denver, CO (On-site)",
      employmentType: "Full-time",
      experienceLevel: "Senior level",
      salary: { 
        min: "125000", 
        max: "155000", 
        period: "yearly", 
        currency: "USD" 
      },
      description: "Drive the strategy and execution of our B2B SaaS platform. You'll work closely with customers, engineers, and stakeholders to identify opportunities, define requirements, and deliver valuable features that solve real customer problems.",
      requirements: "4+ years of product management experience in SaaS\nExperience with B2B products\nStrong analytical and prioritization skills\nExcellent communication abilities\nBasic technical understanding\nData-driven decision making",
      benefits: "Competitive base salary plus bonus\nComprehensive benefits package\nUnlimited PTO policy\nRegular team events\nContinuing education stipend\nParental leave policy",
      skills: ["Product Strategy", "Roadmapping", "User Research", "Agile Methodologies", "Data Analysis", "Stakeholder Management"],
      applicationType: "internal",
      externalUrl: "",
      remote: "no",
      visaSponsorship: false,
      jobSimulation: "Your morning begins with analyzing user feedback and usage metrics to identify pain points. You'll then lead a prioritization session with engineering and design teams. After lunch, you'll conduct customer interviews to validate new feature concepts. The day ends with drafting detailed requirements for your next sprint and updating stakeholders on roadmap progress.",
      keyQualifications: [
        "Successfully launched SaaS products/features",
        "Experience gathering and translating user requirements",
        "Track record of data-driven product decisions"
      ],
      status: "active",
      recruiterId: "UWGIkDkoWWQLuhN51Y81fuMVhWr2",
      recruiterEmail: "amitsamantscience@gmail.com",
      applicants: 0,
      views: 0
    },
    {
      title: "Cybersecurity Analyst",
      company: "SecureDefense Technologies",
      location: "Remote (US Based)",
      employmentType: "Full-time",
      experienceLevel: "Mid level",
      salary: { 
        min: "105000", 
        max: "135000", 
        period: "yearly", 
        currency: "USD" 
      },
      description: "Protect our organization's digital assets from cyber threats. You'll monitor security systems, perform vulnerability assessments, respond to incidents, and implement security best practices across our infrastructure.",
      requirements: "3+ years experience in cybersecurity\nRelevant certifications (CISSP, CEH, Security+)\nExperience with SIEM tools\nKnowledge of network security protocols\nFamiliarity with compliance frameworks (SOC2, GDPR, HIPAA)\nIncident response experience",
      benefits: "Fully remote position\nCompetitive salary\nComprehensive benefits package\nCertification reimbursement\nHome office stipend\nProfessional development budget",
      skills: ["Vulnerability Assessment", "Penetration Testing", "SIEM", "Network Security", "Incident Response", "Security Automation"],
      applicationType: "internal",
      externalUrl: "",
      remote: "fully",
      visaSponsorship: false,
      jobSimulation: "You'll start your day reviewing security alerts from the previous night and prioritizing responses. Mid-morning, you'll conduct a vulnerability scan on a new application before deployment. After lunch, you'll update security policies based on new compliance requirements. You'll finish by documenting your findings and collaborating with IT on implementing security patches.",
      keyQualifications: [
        "Experience with threat hunting and incident response",
        "Familiarity with cloud security principles",
        "Strong documentation and communication skills"
      ],
      status: "active",
      recruiterId: "UWGIkDkoWWQLuhN51Y81fuMVhWr2",
      recruiterEmail: "amitsamantscience@gmail.com",
      applicants: 0,
      views: 0
    },
    {
      title: "Technical Support Engineer",
      company: "AppWorks",
      location: "Remote (Global)",
      employmentType: "Full-time",
      experienceLevel: "Mid level",
      salary: { 
        min: "70000", 
        max: "90000", 
        period: "yearly", 
        currency: "USD" 
      },
      description: "Provide exceptional technical support for our developer tools platform. You'll troubleshoot complex issues, create documentation, and serve as the bridge between customers and our engineering team.",
      requirements: "2+ years technical support experience\nStrong troubleshooting skills\nBasic programming knowledge (JavaScript/Python)\nExcellent written communication\nExperience with support ticketing systems\nAbility to explain technical concepts clearly",
      benefits: "Fully remote work\nFlexible scheduling\n$1,000 annual learning budget\nQuarterly team meetups\nWellness stipend\nCompany-provided hardware",
      skills: ["Troubleshooting", "Technical Documentation", "Customer Support", "JavaScript", "API Knowledge"],
      applicationType: "internal",
      externalUrl: "",
      remote: "fully",
      visaSponsorship: false,
      jobSimulation: "A typical day starts with reviewing your support queue and prioritizing urgent issues. You'll replicate a customer's API integration problem in your test environment, then work through potential solutions. After resolving the issue, you'll document the solution in our knowledge base and follow up with the customer. In the afternoon, you'll join a product meeting to provide feedback on common pain points you're seeing from customers.",
      keyQualifications: [
        "Experience supporting developer tools/APIs",
        "Created technical documentation or tutorials",
        "Strong problem-solving methodology"
      ],
      status: "active",
      recruiterId: "UWGIkDkoWWQLuhN51Y81fuMVhWr2",
      recruiterEmail: "amitsamantscience@gmail.com",
      applicants: 0,
      views: 0
    }
  ];

  const seedJobs = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      for (const job of sampleJobs) {
        await addDoc(collection(db, 'jobs'), {
          ...job,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      setSuccess(true);
    } catch (err) {
      console.error('Error seeding jobs:', err);
      setError('Failed to seed jobs. Please check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6 text-center">Seed Jobs</h1>
        
        <button
          onClick={seedJobs}
          disabled={isLoading}
          className={`w-full py-2 px-4 rounded-md text-white ${
            isLoading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isLoading ? 'Adding Jobs...' : 'Add 10 Sample Jobs'}
        </button>

        {success && (
          <div className="mt-4 p-3 bg-green-100 text-green-700 rounded-md text-center">
            Successfully added 10 jobs!
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}