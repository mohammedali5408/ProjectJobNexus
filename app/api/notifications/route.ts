// File: app/api/notifications/route.ts
// This API endpoint handles fetching all notifications for a user and creating new notifications

import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import { collection, addDoc, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';

// Get all notifications for a user
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
    
    // Query notifications for this user
    const notificationsRef = collection(db, 'notifications');
    const notificationsQuery = query(
      notificationsRef, 
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const notificationsSnapshot = await getDocs(notificationsQuery);
    
    const notifications: { id: string; }[] = [];
    notificationsSnapshot.forEach((doc) => {
      notifications.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

// Create a new notification
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.userId || !body.title || !body.message || !body.type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Create notification object
    const notification = {
      userId: body.userId,
      title: body.title,
      message: body.message,
      type: body.type,
      createdAt: Timestamp.now(),
      read: false,
      relatedId: body.relatedId || null,
      jobTitle: body.jobTitle || null,
      companyName: body.companyName || null,
      candidateName: body.candidateName || null,
      actions: body.actions || []
    };
    
    // Add to Firestore
    const docRef = await addDoc(collection(db, 'notifications'), notification);
    
    return NextResponse.json({
      id: docRef.id,
      ...notification
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    );
  }
}
