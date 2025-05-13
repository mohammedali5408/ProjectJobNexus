// File: app/api/notifications/read-all/route.ts
// This API endpoint handles marking all notifications as read for a user

import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import { collection, query, where, getDocs, writeBatch } from 'firebase/firestore';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    // Get all unread notifications for this user
    const notificationsRef = collection(db, 'notifications');
    const unreadQuery = query(
      notificationsRef, 
      where('userId', '==', body.userId),
      where('read', '==', false)
    );
    
    const unreadSnapshot = await getDocs(unreadQuery);
    
    // If no unread notifications, return early
    if (unreadSnapshot.empty) {
      return NextResponse.json({ success: true, count: 0 });
    }
    
    // Use batched writes for better performance
    const batch = writeBatch(db);
    
    unreadSnapshot.forEach((doc) => {
      batch.update(doc.ref, { read: true });
    });
    
    // Commit the batch
    await batch.commit();
    
    return NextResponse.json({
      success: true,
      count: unreadSnapshot.size
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark notifications as read' },
      { status: 500 }
    );
  }
}
