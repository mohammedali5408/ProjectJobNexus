'use client';

import { useParams, useRouter } from 'next/navigation';
import JobDetail from '@/app/components/job-detail';
import { useAuth } from '@/app/lib/authContext';
import { useEffect, useState } from 'react';

export default function JobPage() {
  const params = useParams();
  const id = params.id as string;
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  
  // Redirect to sign in page if not authenticated
  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/signin');
      } else {
        setIsLoading(false);
      }
    }
  }, [user, loading, router]);
  
  // Show loading state while authentication is being checked
  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex justify-center items-center">
        <div className="animate-spin rounded-full h-14 w-14 border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }
  
  // Only render JobDetail if user is authenticated
  if (!user) {
    return null; // Will redirect from the useEffect
  }
  
  return <JobDetail params={{ id }} />;
}