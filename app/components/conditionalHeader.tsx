'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Header from './header';
import { useAuth } from '../lib/authContext';// Make sure the casing is correct

export default function ConditionalHeader() {
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<'applicant' | 'recruiter' | null>(null);
  const [isRoleLoading, setIsRoleLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();

  // Pages where we don't want to show the header
  const noHeaderPaths = ['/', '/signin', '/signup'];
  const shouldShowHeader = !noHeaderPaths.includes(pathname);

  useEffect(() => {
    const fetchUserRole = async () => {
      setIsRoleLoading(true);
      if (user) {
        try {
          // Get user role from Firestore
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUserRole(userData.role as 'applicant' | 'recruiter');
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
        }
      } else {
        setUserRole(null);
      }
      setIsRoleLoading(false);
    };

    // Only fetch role if auth is loaded and we should show header
    if (!authLoading && shouldShowHeader) {
      fetchUserRole();
    } else if (!shouldShowHeader) {
      setIsRoleLoading(false);
    }
  }, [shouldShowHeader, user, authLoading]);

  // Don't render anything until both auth and role are loaded
  if (authLoading || (isRoleLoading && shouldShowHeader)) {
    return (
      <header className="bg-white shadow-sm fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-center">
        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-indigo-600"></div>
      </header>
    );
  }

  return <Header userRole={userRole} isLoggedIn={!!user} />;
}