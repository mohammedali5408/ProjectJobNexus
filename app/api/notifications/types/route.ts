// File: app/api/notifications/types/route.ts
// This API endpoint returns counts of notifications grouped by type

import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export async function GET(request: Request) {
  try {
    // Parse URL and get query parameters
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const readParam = searchParams.get('read'); // Optional: filter by read status
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    // Base query
    let q = query(
      collection(db, 'notifications'), 
      where('userId', '==', userId)
    );
    
    // Add read filter if provided
    if (readParam !== null) {
      const readStatus = readParam === 'true';
      q = query(q, where('read', '==', readStatus));
    }
    
    const snapshot = await getDocs(q);
    
    // Count notifications by type
    const typeCounts: Record<string, number> = {};
    snapshot.forEach((doc) => {
      const data = doc.data();
      const type = data.type;
      
      if (typeCounts[type]) {
        typeCounts[type]++;
      } else {
        typeCounts[type] = 1;
      }
    });
    
    return NextResponse.json({
      typeCounts,
      total: snapshot.size
    });
  } catch (error) {
    console.error('Error fetching notification type counts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification type counts' },
      { status: 500 }
    );
  }
}