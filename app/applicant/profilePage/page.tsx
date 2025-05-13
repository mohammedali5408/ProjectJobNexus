'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/app/lib/firebase';
import Header from '@/app/components/header';
import Image from 'next/image';
import { useAuth } from '@/app/lib/authContext';

// Interface for education item
interface Education {
  institution: string;
  degree: string;
  field: string;
  year: string;
}

// Interface for work history item
interface WorkHistory {
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  description: string;
}

export default function ApplicantProfilePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Use the auth context hook
  const { user, loading: authLoading } = useAuth();
  
  // Profile data state
  const [profileData, setProfileData] = useState<ProfileData>({
  name: '',
  email: '',
  phone: '',
  location: '',
  title: '',
  experience: 0,
  skills: [],
  newSkill: '',
  education: [
    {
      institution: '',
      degree: '',
      field: '',
      year: ''
    }
  ],
  workHistory: [
    {
      company: '',
      position: '',
      startDate: '',
      endDate: '',
      description: ''
    }
  ],
  bio: '',
  avatarUrl: '',
  linkedInUrl: '',
  githubUrl: '',
  portfolioUrl: '',
  availability: 'Immediately',
  remote: false,
  relocate: false,
  visaSponsorship: false,
  profileCompleted: false
});

  
  // Avatar handling states
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
const [previewUrl, setPreviewUrl] = useState<string>('');

  // Fetch profile data
  useEffect(() => {
    // Only fetch profile if authentication state is loaded
    if (authLoading) return;
    
    // If no user is authenticated, redirect to sign in
    if (!user) {
      router.push('/signin');
      return;
    }

    const fetchProfile = async () => {
      try {
        setIsLoading(true);
        const userId = user.uid;
        const profileRef = doc(db, "candidateProfiles", userId);
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
          const data = profileSnap.data();
          setProfileData(prevState => ({
            ...prevState,
            name: data.name || '',
            email: data.email || user.email || '',
            phone: data.phone || '',
            location: data.location || '',
            title: data.title || '',
            experience: data.experience || 0,
            skills: data.skills || [],
            education: data.education || [{ institution: '', degree: '', field: '', year: '' }],
            workHistory: data.workHistory || [{ company: '', position: '', startDate: '', endDate: '', description: '' }],
            bio: data.bio || '',
            avatarUrl: data.avatarUrl || '',
            linkedInUrl: data.linkedInUrl || '',
            githubUrl: data.githubUrl || '',
            portfolioUrl: data.portfolioUrl || '',
            availability: data.availability || 'Immediately',
            remote: data.remote || false,
            relocate: data.relocate || false,
            visaSponsorship: data.visaSponsorship || false,
            newSkill: ''
          }));
        } else {
          // Initialize with user data if profile doesn't exist
          setProfileData(prevState => ({
            ...prevState,
            name: user.displayName || '',
            email: user.email || '',
            userId: user.uid
          }));
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        setMessage({
          type: 'error',
          text: 'Failed to load profile data. Please try again.'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [user, authLoading, router]);

  // Handle avatar file selection
  // Interface for education item
interface Education {
  institution: string;
  degree: string;
  field: string;
  year: string;
}

// Interface for work history item
interface WorkHistory {
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  description: string;
}

// Interface for profile data
interface ProfileData {
  name: string;
  email: string;
  phone: string;
  location: string;
  title: string;
  experience: number;
  skills: string[];
  newSkill: string;
  education: Education[];
  workHistory: WorkHistory[];
  bio: string;
  avatarUrl: string;
  linkedInUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  availability: string;
  remote: boolean;
  relocate: boolean;
  visaSponsorship: boolean;
  profileCompleted: boolean;
}

// Type for message state
interface Message {
  type: string;
  text: string;
}


  // Handle input changes
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    setAvatarFile(file);
    const fileReader = new FileReader();
    fileReader.onload = (e: ProgressEvent<FileReader>) => {
      setPreviewUrl(e.target?.result as string);
    };
    fileReader.readAsDataURL(file);
  }
};

// Fix event handling with proper types
const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  const { name, value, type } = e.target;
  let fieldValue: string | boolean = value;
  if (type === 'checkbox' && 'checked' in e.target) {
    fieldValue = (e.target as HTMLInputElement).checked;
  }
  setProfileData(prevState => ({
    ...prevState,
    [name]: fieldValue
  }));
};


  // Handle skills
  const addSkill = () => {
  if (profileData.newSkill.trim() && !profileData.skills.includes(profileData.newSkill.trim())) {
    setProfileData(prevState => ({
      ...prevState,
      skills: [...prevState.skills, prevState.newSkill.trim()],
      newSkill: ''
    }));
  }
};

  const removeSkill = (skillToRemove: string) => {
  setProfileData(prevState => ({
    ...prevState,
    skills: prevState.skills.filter(skill => skill !== skillToRemove)
  }));
};

  // Handle education
 const addEducation = () => {
  setProfileData(prevState => ({
    ...prevState,
    education: [
      ...prevState.education,
      {
        institution: '',
        degree: '',
        field: '',
        year: ''
      }
    ]
  }));
};

const removeEducation = (index: number) => {
  const updatedEducation = [...profileData.education];
  updatedEducation.splice(index, 1);
  setProfileData(prevState => ({
    ...prevState,
    education: updatedEducation
  }));
};

const handleEducationChange = (index: number, field: keyof Education, value: string) => {
  const updatedEducation = [...profileData.education];
  updatedEducation[index][field] = value;
  setProfileData(prevState => ({
    ...prevState,
    education: updatedEducation
  }));
};

// Fix work history handlers with proper types
const addWorkHistory = () => {
  setProfileData(prevState => ({
    ...prevState,
    workHistory: [
      ...prevState.workHistory,
      {
        company: '',
        position: '',
        startDate: '',
        endDate: '',
        description: ''
      }
    ]
  }));
};

const removeWorkHistory = (index: number) => {
  const updatedWorkHistory = [...profileData.workHistory];
  updatedWorkHistory.splice(index, 1);
  setProfileData(prevState => ({
    ...prevState,
    workHistory: updatedWorkHistory
  }));
};

const handleWorkHistoryChange = (index: number, field: keyof WorkHistory, value: string) => {
  const updatedWorkHistory = [...profileData.workHistory];
  updatedWorkHistory[index][field] = value;
  setProfileData(prevState => ({
    ...prevState,
    workHistory: updatedWorkHistory
  }));
};

  // Save profile
  const handleSubmit = async (e: { preventDefault: () => void; }) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ type: '', text: '' });

    try {
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Upload avatar if provided
      let avatarUrl = profileData.avatarUrl;
      if (avatarFile) {
        const avatarRef = ref(storage, `avatars/${user.uid}_${Date.now()}`);
        await uploadBytes(avatarRef, avatarFile);
        avatarUrl = await getDownloadURL(avatarRef);
      }

      // Check if all required fields are filled for a complete profile
      const isProfileComplete = 
        profileData.name.trim() !== '' &&
        profileData.email.trim() !== '' &&
        profileData.location.trim() !== '' &&
        profileData.title.trim() !== '' &&
        profileData.skills.length > 0 &&
        profileData.education.some(edu => 
          edu.institution.trim() !== '' && 
          edu.degree.trim() !== '' && 
          edu.field.trim() !== '' && 
          edu.year.trim() !== ''
        ) &&
        profileData.workHistory.some(work => 
          work.company.trim() !== '' && 
          work.position.trim() !== '' && 
          work.startDate.trim() !== '' && 
          work.description.trim() !== ''
        ) &&
        profileData.bio.trim() !== '';

      // Prepare profile data
      const profileToSave = {
        userId: user.uid,
        name: profileData.name,
        email: profileData.email,
        phone: profileData.phone,
        location: profileData.location,
        title: profileData.title,
        experience: profileData.experience || 0,
        skills: profileData.skills,
        education: profileData.education,
        workHistory: profileData.workHistory,
        bio: profileData.bio,
        avatarUrl: avatarUrl,
        linkedInUrl: profileData.linkedInUrl,
        githubUrl: profileData.githubUrl,
        portfolioUrl: profileData.portfolioUrl,
        availability: profileData.availability,
        remote: profileData.remote,
        relocate: profileData.relocate,
        visaSponsorship: profileData.visaSponsorship,
        lastActive: serverTimestamp(),
        profileCompleted: isProfileComplete
      };

      // Save to Firestore
      await setDoc(doc(db, "candidateProfiles", user.uid), profileToSave);

      setMessage({
        type: 'success',
        text: 'Profile saved successfully!'
      });

      // If profile is complete, redirect to dashboard
      if (isProfileComplete) {
        setTimeout(() => {
          router.push('/applicant/applicantDashboard');
        }, 1500);
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      setMessage({
        type: 'error',
        text: 'Failed to save profile. Please try again.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Show loading while auth is checking or profile is loading
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header userRole="applicant" isLoggedIn={!!user} />
        <div className="flex justify-center items-center h-96">
          <svg className="animate-spin h-12 w-12 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userRole="applicant" isLoggedIn={!!user} />
      
      {/* Hero section */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white pt-20 pb-14 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl font-bold mb-2">Complete Your Profile</h1>
            <p className="text-indigo-100 max-w-2xl">
              A complete profile increases your chances of getting noticed by recruiters.
              Make sure to provide detailed information about your skills and experience.
            </p>
          </motion.div>
        </div>
      </div>
      
      <div className="container mx-auto max-w-4xl px-4 py-10">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white shadow-sm rounded-lg"
        >
          {message.text && (
            <div className={`p-4 rounded-t-lg ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              {message.text}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="p-6 space-y-8">
            {/* Basic Information */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-4">
                Basic Information
              </h2>
              
              <div className="flex flex-col md:flex-row gap-6">
                <div className="md:w-3/4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={profileData.name}
                        onChange={handleChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                        Email *
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={profileData.email}
                        onChange={handleChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={profileData.phone}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                        Location *
                      </label>
                      <input
                        type="text"
                        id="location"
                        name="location"
                        value={profileData.location}
                        onChange={handleChange}
                        required
                        placeholder="City, State, Country"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                        Professional Title *
                      </label>
                      <input
                        type="text"
                        id="title"
                        name="title"
                        value={profileData.title}
                        onChange={handleChange}
                        required
                        placeholder="e.g. Frontend Developer"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="experience" className="block text-sm font-medium text-gray-700 mb-1">
                        Years of Experience *
                      </label>
                      <input
                        type="number"
                        id="experience"
                        name="experience"
                        min="0"
                        max="50"
                        value={profileData.experience}
                        onChange={handleChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="md:w-1/4 flex flex-col items-center">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Profile Photo
                  </label>
                  <div className="h-32 w-32 bg-gray-100 rounded-full overflow-hidden mb-2 flex items-center justify-center border border-gray-200">
                    {previewUrl || profileData.avatarUrl ? (
                      <Image 
                        src={previewUrl || profileData.avatarUrl} 
                        alt="Profile" 
                        width={128} 
                        height={128}
                        className="h-full w-full object-cover" 
                      />
                    ) : (
                      <svg className="h-16 w-16 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    )}
                  </div>
                  <input
                    type="file"
                    id="avatar"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="avatar"
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                  >
                    {profileData.avatarUrl ? 'Change Photo' : 'Upload Photo'}
                  </label>
                </div>
              </div>
            </div>
            
            {/* About */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-4">
                About
              </h2>
              
              <div>
                <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
                  Professional Bio *
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  rows={5}
                  value={profileData.bio}
                  onChange={handleChange}
                  required
                  placeholder="Write a professional summary of yourself, your skills, interests, and career goals..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            
            {/* Skills */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-4">
                Skills *
              </h2>
              
              <div className="mb-4">
                <div className="flex">
                  <input
                    type="text"
                    id="newSkill"
                    name="newSkill"
                    value={profileData.newSkill}
                    onChange={handleChange}
                    placeholder="Add a skill (e.g. JavaScript, Project Management)"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                  />
                  <button
                    type="button"
                    onClick={addSkill}
                    className="px-4 py-2 border border-transparent rounded-r-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Add
                  </button>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-2">
                {profileData.skills.length === 0 && (
                  <p className="text-sm text-gray-500">No skills added yet. Add at least one skill.</p>
                )}
                
                {profileData.skills.map((skill, index) => (
                  <div
                    key={index}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="ml-1.5 h-4 w-4 rounded-full inline-flex items-center justify-center text-indigo-600 hover:text-indigo-900 focus:outline-none"
                    >
                      <span className="sr-only">Remove skill</span>
                      <svg className="h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Education */}
            <div>
              <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Education *
                </h2>
                <button
                  type="button"
                  onClick={addEducation}
                  className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <svg className="h-4 w-4 text-gray-500 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Add Education
                </button>
              </div>
              
              {profileData.education.map((edu, index) => (
                <div key={index} className="border border-gray-200 rounded-md p-4 mb-4">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Education #{index + 1}</h3>
                    {profileData.education.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEducation(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Institution *
                      </label>
                      <input
                        type="text"
                        value={edu.institution}
                        onChange={(e) => handleEducationChange(index, 'institution', e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Degree *
                      </label>
                      <input
                        type="text"
                        value={edu.degree}
                        onChange={(e) => handleEducationChange(index, 'degree', e.target.value)}
                        required
                        placeholder="e.g. Bachelor's, Master's"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Field of Study *
                      </label>
                      <input
                        type="text"
                        value={edu.field}
                        onChange={(e) => handleEducationChange(index, 'field', e.target.value)}
                        required
                        placeholder="e.g. Computer Science"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Year of Graduation *
                      </label>
                      <input
                        type="text"
                        value={edu.year}
                        onChange={(e) => handleEducationChange(index, 'year', e.target.value)}
                        required
                        placeholder="e.g. 2022"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Work Experience */}
            <div>
              <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Work Experience *
                </h2>
                <button
                  type="button"
                  onClick={addWorkHistory}
                  className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <svg className="h-4 w-4 text-gray-500 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Add Experience
                  Add Experience
                </button>
              </div>
              
              {profileData.workHistory.map((work, index) => (
                <div key={index} className="border border-gray-200 rounded-md p-4 mb-4">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Experience #{index + 1}</h3>
                    {profileData.workHistory.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeWorkHistory(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Company *
                      </label>
                      <input
                        type="text"
                        value={work.company}
                        onChange={(e) => handleWorkHistoryChange(index, 'company', e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Position *
                      </label>
                      <input
                        type="text"
                        value={work.position}
                        onChange={(e) => handleWorkHistoryChange(index, 'position', e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Date *
                      </label>
                      <input
                        type="month"
                        value={work.startDate}
                        onChange={(e) => handleWorkHistoryChange(index, 'startDate', e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Date (leave blank if current)
                      </label>
                      <input
                        type="month"
                        value={work.endDate}
                        onChange={(e) => handleWorkHistoryChange(index, 'endDate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description *
                    </label>
                    <textarea
                      rows={3}
                      value={work.description}
                      onChange={(e) => handleWorkHistoryChange(index, 'description', e.target.value)}
                      required
                      placeholder="Describe your responsibilities, achievements, and projects..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              ))}
            </div>
            
            {/* Social Links */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-4">
                Online Presence
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="linkedInUrl" className="block text-sm font-medium text-gray-700 mb-1">
                    LinkedIn Profile URL
                  </label>
                  <input
                    type="url"
                    id="linkedInUrl"
                    name="linkedInUrl"
                    value={profileData.linkedInUrl}
                    onChange={handleChange}
                    placeholder="https://linkedin.com/in/yourprofile"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="githubUrl" className="block text-sm font-medium text-gray-700 mb-1">
                    GitHub Profile URL
                  </label>
                  <input
                    type="url"
                    id="githubUrl"
                    name="githubUrl"
                    value={profileData.githubUrl}
                    onChange={handleChange}
                    placeholder="https://github.com/yourusername"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="portfolioUrl" className="block text-sm font-medium text-gray-700 mb-1">
                    Portfolio URL
                  </label>
                  <input
                    type="url"
                    id="portfolioUrl"
                    name="portfolioUrl"
                    value={profileData.portfolioUrl}
                    onChange={handleChange}
                    placeholder="https://yourportfolio.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
            
            {/* Preferences */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-4">
                Job Preferences
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="availability" className="block text-sm font-medium text-gray-700 mb-1">
                    Availability
                  </label>
                  <select
                    id="availability"
                    name="availability"
                    value={profileData.availability}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="Immediately">Immediately</option>
                    <option value="2 weeks">2 weeks notice</option>
                    <option value="1 month">1 month notice</option>
                    <option value="Passively looking">Passively looking</option>
                  </select>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      id="remote"
                      name="remote"
                      type="checkbox"
                      checked={profileData.remote}
                      onChange={handleChange}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="remote" className="ml-2 block text-sm text-gray-700">
                      Open to remote work
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      id="relocate"
                      name="relocate"
                      type="checkbox"
                      checked={profileData.relocate}
                      onChange={handleChange}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="relocate" className="ml-2 block text-sm text-gray-700">
                      Willing to relocate
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      id="visaSponsorship"
                      name="visaSponsorship"
                      type="checkbox"
                      checked={profileData.visaSponsorship}
                      onChange={handleChange}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="visaSponsorship" className="ml-2 block text-sm text-gray-700">
                      Need visa sponsorship
                    </label>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Submit */}
            <div className="pt-4 border-t border-gray-200 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className={`inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  'Save Profile'
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}