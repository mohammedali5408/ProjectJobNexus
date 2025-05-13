// app/api/proxy-file/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Get the URL from the query parameter
  const url = request.nextUrl.searchParams.get('url');
  
  if (!url) {
    return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
  }
  
  try {
    // Fetch the file from Firebase Storage
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }
    
    // Get the file as a blob
    const blob = await response.blob();
    
    // Return the file with appropriate headers
    return new NextResponse(blob, {
      headers: {
        'Content-Type': blob.type,
        'Content-Disposition': 'inline'
      }
    });
  } catch (error) {
    console.error('Error fetching file:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch file',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}