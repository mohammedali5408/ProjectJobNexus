'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { FcGoogle } from 'react-icons/fc';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { BsBriefcase, BsPersonGear } from 'react-icons/bs';

export default function SignUp() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '', // Changed to empty string as default
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleSignupError, setGoogleSignupError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

 const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string; value: string; } }) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear the Google signup error when role is selected
    if (name === 'role' && value !== '') {
      setGoogleSignupError('');
    }
  };

  const handleSubmit = async (e: { preventDefault: () => void; }) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    // Validate role selection
    if (!formData.role) {
      setError('Please select whether you are a Job Seeker or Recruiter.');
      setIsLoading(false);
      return;
    }
    
    // Password validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setIsLoading(false);
      return;
    }
    
    try {
      // Create user with Firebase
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      );
      
      const user = userCredential.user;
      
      // Update user profile with display name
      await updateProfile(user, {
        displayName: formData.name
      });
      
      // Store additional user data in Firestore
      await setDoc(doc(db, "users", user.uid), {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      });
      
      // Initialize candidate profile if user is an applicant
      if (formData.role === 'applicant') {
        await setDoc(doc(db, "candidateProfiles", user.uid), {
          userId: user.uid,
          name: formData.name,
          email: formData.email,
          phone: '',
          location: '',
          title: '',
          experience: 0,
          skills: [],
          education: [],
          workHistory: [],
          bio: '',
          avatarUrl: '',
          linkedInUrl: '',
          githubUrl: '',
          portfolioUrl: '',
          availability: 'Immediately',
          remote: false,
          relocate: false,
          visaSponsorship: false,
          lastActive: serverTimestamp(),
          profileCompleted: false
        });
      }
      
      console.log('User created:', user);
      
      // Redirect based on role
      if (formData.role === 'recruiter') {
        router.push('/recruiter/recruiterDashboard');
      } else {
        // Redirect to profile completion page for applicants
        router.push('/applicant/profilePage');
      }
    } catch (err) {
      console.error('Registration error:', err);
      // Handle specific Firebase auth errors
      if (typeof err === 'object' && err !== null && 'code' in err) {
        const errorCode = (err as { code: string }).code;
        if (errorCode === 'auth/email-already-in-use') {
          setError('Email already in use. Please use a different email or sign in.');
        } else if (errorCode === 'auth/invalid-email') {
          setError('Invalid email address.');
        } else if (errorCode === 'auth/weak-password') {
          setError('Password is too weak. Please use a stronger password.');
        } else {
          setError('Failed to create account. Please try again.');
        }
      } else {
        setError('Failed to create account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    // Check if role is selected
    if (!formData.role) {
      setGoogleSignupError('Please select whether you are a Job Seeker or Recruiter first.');
      return;
    }

    setIsLoading(true);
    setError('');
    setGoogleSignupError('');
    
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if user already exists in Firestore
      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (userDoc.exists()) {
        // Update the user's role if they already exist
        await setDoc(doc(db, "users", user.uid), {
          role: formData.role,
          lastLoginAt: new Date().toISOString()
        }, { merge: true });
      } else {
        // Create new user document
        await setDoc(doc(db, "users", user.uid), {
          name: user.displayName,
          email: user.email,
          role: formData.role,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          photoURL: user.photoURL
        });
      }
      
      // Initialize candidate profile if user is an applicant
      if (formData.role === 'applicant') {
        const candidateDoc = doc(db, "candidateProfiles", user.uid);
        const candidateSnap = await getDoc(candidateDoc);
        
        if (!candidateSnap.exists()) {
          await setDoc(candidateDoc, {
            userId: user.uid,
            name: user.displayName,
            email: user.email,
            phone: '',
            location: '',
            title: '',
            experience: 0,
            skills: [],
            education: [],
            workHistory: [],
            bio: '',
            avatarUrl: user.photoURL || '',
            linkedInUrl: '',
            githubUrl: '',
            portfolioUrl: '',
            availability: 'Immediately',
            remote: false,
            relocate: false,
            visaSponsorship: false,
            lastActive: serverTimestamp(),
            profileCompleted: false
          });
        }
        
        // Redirect to profile completion page
        router.push('/applicant/profilePage');
      } else {
        router.push('/recruiter/recruiterDashboard');
      }
    } catch (err) {
      console.error('Google sign-up error:', err);
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'auth/popup-closed-by-user') {
        // User closed the popup, no need to show an error
      } else {
        setError('Failed to sign up with Google. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <motion.div 
        className="sm:mx-auto sm:w-full sm:max-w-md"
        initial="hidden"
        animate="visible"
        variants={fadeInUp}
        transition={{ duration: 0.5 }}
      >
        <motion.h1 
          className="text-center text-5xl font-bold mb-2"
          variants={fadeInUp}
          style={{
            background: "linear-gradient(to right, #7c3aed, #4f46e5)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Job Nexus
        </motion.h1>
        <h2 className="text-center text-3xl font-bold text-gray-900">
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/signin" className="font-medium text-indigo-600 hover:text-indigo-500">
            Sign in
          </Link>
        </p>
      </motion.div>

      <motion.div 
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="bg-white py-8 px-4 shadow-xl rounded-2xl sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Role Selection - Moved to top of form */}
            <div>
              <label className="block text-base font-medium text-gray-700 mb-3">
                I want to <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleChange({ target: { name: 'role', value: 'applicant' } })}
                  className={`relative p-4 rounded-xl border-2 transition-all duration-200 ${
                    formData.role === 'applicant'
                      ? 'bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-500 shadow-lg transform scale-[1.02]'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <BsPersonGear 
                    className={`h-8 w-8 mx-auto mb-2 ${
                      formData.role === 'applicant' ? 'text-indigo-600' : 'text-gray-500'
                    }`}
                    style={{ color: formData.role === 'applicant' ? '#4f46e5' : '#6b7280' }}
                  />
                  <div 
                    className={`text-sm font-medium ${
                      formData.role === 'applicant' ? 'text-indigo-700' : 'text-gray-700'
                    }`}
                    style={{ color: formData.role === 'applicant' ? '#4338ca' : '#374151' }}
                  >
                    Find Jobs
                  </div>
                  <div className="text-xs text-gray-500 mt-1" style={{ color: '#6b7280' }}>Job Seeker</div>
                </button>
                
                <button
                  type="button"
                  onClick={() => handleChange({ target: { name: 'role', value: 'recruiter' } })}
                  className={`relative p-4 rounded-xl border-2 transition-all duration-200 ${
                    formData.role === 'recruiter'
                      ? 'bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-500 shadow-lg transform scale-[1.02]'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <BsBriefcase 
                    className={`h-8 w-8 mx-auto mb-2 ${
                      formData.role === 'recruiter' ? 'text-indigo-600' : 'text-gray-500'
                    }`}
                    style={{ color: formData.role === 'recruiter' ? '#4f46e5' : '#6b7280' }}
                  />
                  <div 
                    className={`text-sm font-medium ${
                      formData.role === 'recruiter' ? 'text-indigo-700' : 'text-gray-700'
                    }`}
                    style={{ color: formData.role === 'recruiter' ? '#4338ca' : '#374151' }}
                  >
                    Hire Talent
                  </div>
                  <div className="text-xs text-gray-500 mt-1" style={{ color: '#6b7280' }}>Recruiter</div>
                </button>
              </div>
              {!formData.role && error && <p className="mt-2 text-sm text-red-600" style={{ color: '#dc2626' }}>Please select your role.</p>}
            </div>

            {/* Google Sign-up Button */}
            <div>
              <button
                type="button"
                onClick={handleGoogleSignUp}
                disabled={isLoading || !formData.role}
                className={`w-full flex justify-center items-center py-3 px-4 border-2 rounded-xl shadow-sm text-base font-medium transition-all duration-200 ${
                  !formData.role
                    ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                }`}
                style={{ color: !formData.role ? '#9ca3af' : '#374151' }}
                title={!formData.role ? "Please select your role first" : ""}
              >
                <FcGoogle className="h-5 w-5 mr-3" />
                Continue with Google
              </button>
              {googleSignupError && (
                <p className="mt-2 text-sm text-red-600" style={{ color: '#dc2626' }}>{googleSignupError}</p>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500" style={{ color: '#6b7280' }}>Or continue with email</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1" style={{ color: '#374151' }}>
                  Full name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  style={{ color: '#111827', backgroundColor: '#ffffff' }}
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1" style={{ color: '#374151' }}>
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  style={{ color: '#111827', backgroundColor: '#ffffff' }}
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1" style={{ color: '#374151' }}>
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    style={{ color: '#111827', backgroundColor: '#ffffff' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? 
                      <FiEyeOff className="h-5 w-5" style={{ color: '#6b7280' }} /> : 
                      <FiEye className="h-5 w-5" style={{ color: '#6b7280' }} />
                    }
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1" style={{ color: '#374151' }}>
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    style={{ color: '#111827', backgroundColor: '#ffffff' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? 
                      <FiEyeOff className="h-5 w-5" style={{ color: '#6b7280' }} /> : 
                      <FiEye className="h-5 w-5" style={{ color: '#6b7280' }} />
                    }
                  </button>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500" style={{ color: '#6b7280' }}>
              Password must be at least 6 characters
            </p>

            {error && error !== 'Please select whether you are a Job Seeker or Recruiter.' && (
              <div className="rounded-lg bg-red-50 p-4 border border-red-200">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ color: '#f87171' }}>
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800" style={{ color: '#991b1b' }}>{error}</h3>
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-base font-medium text-white ${
                  isLoading 
                    ? 'bg-indigo-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 transform hover:scale-[1.02] transition-all duration-200'
                }`}
                style={{ color: '#ffffff' }}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" style={{ color: '#ffffff' }}>
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating account...
                  </>
                ) : 'Create account'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <p className="text-center text-xs text-gray-500" style={{ color: '#6b7280' }}>
              By signing up, you agree to our{' '}
              <Link href="/terms" className="font-medium text-indigo-600 hover:text-indigo-500" style={{ color: '#4f46e5' }}>
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="font-medium text-indigo-600 hover:text-indigo-500" style={{ color: '#4f46e5' }}>
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}