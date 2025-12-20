import { NextRequest, NextResponse } from 'next/server';
import { searchGoogleDrive, refreshAccessToken } from '@/lib/googledrive';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, accessToken, refreshToken, tokenExpiry } = body as {
      query: string;
      accessToken: string;
      refreshToken?: string;
      tokenExpiry?: number;
    };

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    if (!accessToken) {
      return NextResponse.json({ error: 'Access token is required' }, { status: 400 });
    }

    let currentAccessToken = accessToken;
    let newTokenData: { accessToken?: string; expiresIn?: number } | null = null;

    // Check if token is expired and we have a refresh token
    if (tokenExpiry && refreshToken && Date.now() > tokenExpiry) {
      try {
        const refreshed = await refreshAccessToken(refreshToken);
        currentAccessToken = refreshed.accessToken;
        newTokenData = {
          accessToken: refreshed.accessToken,
          expiresIn: refreshed.expiresIn,
        };
      } catch (refreshError) {
        console.error('Failed to refresh token:', refreshError);
        return NextResponse.json(
          { error: 'Token expired and refresh failed. Please re-authenticate.' },
          { status: 401 }
        );
      }
    }

    try {
      const result = await searchGoogleDrive(query, currentAccessToken);

      // Include new token data if we refreshed
      if (newTokenData) {
        return NextResponse.json({
          ...result,
          newAccessToken: newTokenData.accessToken,
          newTokenExpiry: Date.now() + (newTokenData.expiresIn || 3600) * 1000,
        });
      }

      return NextResponse.json(result);
    } catch (searchError) {
      const errorMessage = searchError instanceof Error ? searchError.message : 'Unknown error';

      // Handle expired token error
      if (errorMessage.includes('UNAUTHORIZED') && refreshToken) {
        try {
          const refreshed = await refreshAccessToken(refreshToken);
          const result = await searchGoogleDrive(query, refreshed.accessToken);

          return NextResponse.json({
            ...result,
            newAccessToken: refreshed.accessToken,
            newTokenExpiry: Date.now() + (refreshed.expiresIn || 3600) * 1000,
          });
        } catch (retryError) {
          console.error('Retry after token refresh failed:', retryError);
          return NextResponse.json(
            { error: 'Authentication failed. Please re-authenticate with Google Drive.' },
            { status: 401 }
          );
        }
      }

      throw searchError;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Drive search API error:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
