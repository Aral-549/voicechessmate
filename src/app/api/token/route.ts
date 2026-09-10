// ============================================================
// VoiceChessmate — Token Minting API Route
// Mints short-lived AssemblyAI tokens for browser WebSocket auth
// NEVER expose the API key to the client
// ============================================================

import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;

  console.log(`[Token Route] API key present: ${!!apiKey}, length: ${apiKey?.length || 0}, starts with: ${apiKey?.slice(0, 4) || 'N/A'}...`);

  if (!apiKey || apiKey === 'your_api_key_here') {
    return NextResponse.json(
      { error: 'ASSEMBLYAI_API_KEY not configured. Edit .env.local and restart the dev server.' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      'https://agents.assemblyai.com/v1/token?expires_in_seconds=300&max_session_duration_seconds=3600',
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token minting failed:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to mint token' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Token minting error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
