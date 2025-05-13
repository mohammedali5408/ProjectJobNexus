// File: app/api/notifications/count/route.ts
// This API endpoint returns just the count of unread notifications for a user

import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export async function GET(request: Request) {
  try {
    // Parse URL and get query parameters
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    // Query unread notifications for this user
    const notificationsRef = collection(db, 'notifications');
    const unreadQuery = query(
      notificationsRef, 
      where('userId', '==', userId),
      where('read', '==', false)
    );
    
    const unreadSnapshot = await getDocs(unreadQuery);
    
    return NextResponse.json({
      count: unreadSnapshot.size
    });
  } catch (error) {
    console.error('Error fetching notification count:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification count' },
      { status: 500 }
    );
  }
}