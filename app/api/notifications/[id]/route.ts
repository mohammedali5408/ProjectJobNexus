// File: app/api/notifications/[id]/route.ts
// This API endpoint handles getting, updating, and deleting a single notification

import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';

// Get a single notification
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const notificationDoc = await getDoc(doc(db, 'notifications', id));
    
    if (!notificationDoc.exists()) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      id: notificationDoc.id,
      ...notificationDoc.data()
    });
  } catch (error) {
    console.error('Error fetching notification:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification' },
      { status: 500 }
    );
  }
}

// Update a notification (e.g., mark as read)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const body = await request.json();
    
    // Get notification to verify it exists
    const notificationDoc = await getDoc(doc(db, 'notifications', id));
    
    if (!notificationDoc.exists()) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }
    
    // Update notification
    await updateDoc(doc(db, 'notifications', id), body);
    
    return NextResponse.json({
      id,
      ...notificationDoc.data(),
      ...body
    });
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    );
  }
}

// Delete a notification
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    
    // Get notification to verify it exists
    const notificationDoc = await getDoc(doc(db, 'notifications', id));
    
    if (!notificationDoc.exists()) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }
    
    // Delete notification
    await deleteDoc(doc(db, 'notifications', id));
    
    return NextResponse.json({
      id,
      deleted: true
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json(
      { error: 'Failed to delete notification' },
      { status: 500 }
    );
  }
}
