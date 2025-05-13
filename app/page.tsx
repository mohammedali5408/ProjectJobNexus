'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.6 }
  }
};

const staggerChildren = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center">
        <div className="container mx-auto px-4">
          <motion.div 
            className="max-w-3xl mx-auto text-center"
            initial="hidden"
            animate="visible"
            variants={staggerChildren}
          >
          <motion.h1 
  className="text-6xl font-bold mb-6 bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent"
  variants={fadeInUp}
>
  Job Nexus
</motion.h1>
            <motion.p 
              className="text-2xl text-gray-700 mb-8"
              variants={fadeInUp}
            >
              Where AI connects talent with opportunity
            </motion.p>
            <motion.p 
              className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto"
              variants={fadeInUp}
            >
              Simplify your job search with our AI-powered platform that understands your skills and matches you with the perfect opportunities.
            </motion.p>
            <motion.div 
              className="flex flex-col sm:flex-row gap-4 justify-center"
              variants={fadeInUp}
            >
              <Link 
                href="/signup" 
                className="px-8 py-3 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium hover:opacity-90 transition-opacity shadow-lg"
              >
                Get Started
              </Link>
              <Link 
                href="/jobs" 
                className="px-8 py-3 rounded-lg border border-indigo-200 text-indigo-700 font-medium hover:bg-indigo-50 transition-colors"
              >
                Browse Jobs
              </Link>
            </motion.div>
          </motion.div>
        </div>
        
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden -z-10">
          <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-violet-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
          <div className="absolute bottom-1/3 left-1/4 w-64 h-64 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl font-bold text-gray-800 mb-4">How Job Nexus Works</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">Our AI-powered platform simplifies every step of the job search process.</p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {/* Feature 1 */}
            <motion.div 
              className="p-8 rounded-2xl bg-gradient-to-br from-indigo-50 to-white shadow-sm border border-indigo-100"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
            >
              <div className="w-14 h-14 bg-violet-100 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">AI Resume Builder</h3>
              <p className="text-gray-600">Create professional resumes tailored for specific job descriptions with our AI-powered tools.</p>
            </motion.div>
            
            {/* Feature 2 */}
            <motion.div 
              className="p-8 rounded-2xl bg-gradient-to-br from-indigo-50 to-white shadow-sm border border-indigo-100"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
            >
              <div className="w-14 h-14 bg-violet-100 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">Smart Job Search</h3>
              <p className="text-gray-600">Find the perfect job using advanced filters and AI matching that understands your skills and career goals.</p>
            </motion.div>
            
            {/* Feature 3 */}
            <motion.div 
              className="p-8 rounded-2xl bg-gradient-to-br from-indigo-50 to-white shadow-sm border border-indigo-100"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
            >
              <div className="w-14 h-14 bg-violet-100 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">Application Tracking</h3>
              <p className="text-gray-600">Monitor the status of your applications in real-time and receive personalized insights to improve your chances.</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* For Job Seekers & Recruiters */}
      <section className="py-20 bg-gradient-to-br from-indigo-50 to-violet-50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* For Job Seekers */}
            <motion.div 
              className="p-10 rounded-2xl bg-white shadow-lg"
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h3 className="text-2xl font-bold mb-6 text-gray-800">For Job Seekers</h3>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <svg className="h-6 w-6 text-violet-500 mr-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-gray-700">AI-powered resume building and optimization</p>
                </li>
                <li className="flex items-start">
                  <svg className="h-6 w-6 text-violet-500 mr-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-gray-700">Personalized job recommendations</p>
                </li>
                <li className="flex items-start">
                  <svg className="h-6 w-6 text-violet-500 mr-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-gray-700">Advanced filtering including visa-friendly options</p>
                </li>
                <li className="flex items-start">
                  <svg className="h-6 w-6 text-violet-500 mr-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-gray-700">Real-time application tracking</p>
                </li>
              </ul>
              <div className="mt-8">
                <Link 
                  href="/auth/signup?role=jobseeker" 
                  className="inline-block px-6 py-3 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 transition-colors"
                >
                  Sign Up as Job Seeker
                </Link>
              </div>
            </motion.div>
            
            {/* For Recruiters */}
            <motion.div 
              className="p-10 rounded-2xl bg-white shadow-lg"
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h3 className="text-2xl font-bold mb-6 text-gray-800">For Recruiters</h3>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <svg className="h-6 w-6 text-indigo-500 mr-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-gray-700">AI-enhanced job listing creation</p>
                </li>
                <li className="flex items-start">
                  <svg className="h-6 w-6 text-indigo-500 mr-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-gray-700">Intelligent candidate matching and filtering</p>
                </li>
                <li className="flex items-start">
                  <svg className="h-6 w-6 text-indigo-500 mr-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-gray-700">Automated resume screening with AI insights</p>
                </li>
                <li className="flex items-start">
                  <svg className="h-6 w-6 text-indigo-500 mr-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-gray-700">Comprehensive hiring analytics and reporting</p>
                </li>
              </ul>
              <div className="mt-8">
                <Link 
                  href="/auth/signup?role=recruiter" 
                  className="inline-block px-6 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
                >
                  Sign Up as Recruiter
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
        <motion.div 
          className="container mx-auto px-4 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Transform Your Job Search?</h2>
          <p className="text-lg md:text-xl max-w-2xl mx-auto mb-8 opacity-90">Join thousands of job seekers and recruiters who are already using Job Nexus to connect talent with opportunity.</p>
          <Link 
            href="/auth/signup" 
            className="inline-block px-8 py-4 rounded-lg bg-white text-indigo-700 font-medium hover:bg-opacity-95 transition-colors shadow-md"
          >
            Create Free Account
          </Link>
        </motion.div>
      </section>

      {/* Simple Footer */}
      <footer className="py-8 bg-gray-50 border-t border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <p className="text-gray-600 text-sm">© {new Date().getFullYear().toString()} Job Nexus. All rights reserved.</p>
            </div>
            <div className="flex space-x-8">
              <Link href="/about" className="text-gray-600 hover:text-indigo-600 text-sm transition-colors">About</Link>
              <Link href="/contact" className="text-gray-600 hover:text-indigo-600 text-sm transition-colors">Contact</Link>
              <Link href="/privacy" className="text-gray-600 hover:text-indigo-600 text-sm transition-colors">Privacy</Link>
              <Link href="/terms" className="text-gray-600 hover:text-indigo-600 text-sm transition-colors">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}