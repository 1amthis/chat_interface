import { GoogleDriveFile, GoogleDriveSearchResult, GoogleDriveSearchResponse } from '@/types';

// Google OAuth configuration
// These should be set via environment variables in production
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';

// Google Drive API endpoints
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Scopes needed for Drive search
export const GOOGLE_DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
];

// Generate OAuth authorization URL
export function getGoogleAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: GOOGLE_DRIVE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: GOOGLE_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

// Refresh access token using refresh token
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh access token: ${error}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

// Search Google Drive files
export async function searchGoogleDrive(
  query: string,
  accessToken: string,
  maxResults: number = 10
): Promise<GoogleDriveSearchResponse> {
  // Build the search query for Google Drive
  // fullText contains 'query' searches file content and metadata
  const driveQuery = `fullText contains '${query.replace(/'/g, "\\'")}'`;

  const params = new URLSearchParams({
    q: driveQuery,
    pageSize: maxResults.toString(),
    fields: 'files(id,name,mimeType,modifiedTime,webViewLink,iconLink,owners,size)',
    orderBy: 'modifiedTime desc',
  });

  const response = await fetch(`${DRIVE_API_BASE}/files?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    if (response.status === 401) {
      throw new Error('UNAUTHORIZED: Access token expired or invalid');
    }
    throw new Error(`Google Drive API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const files: GoogleDriveFile[] = data.files || [];

  const results: GoogleDriveSearchResult[] = files.map((file) => ({
    fileId: file.id,
    fileName: file.name,
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime,
    webViewLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
    owner: file.owners?.[0]?.displayName || file.owners?.[0]?.emailAddress,
    size: file.size,
    snippet: getMimeTypeDescription(file.mimeType),
  }));

  return {
    query,
    results,
    timestamp: Date.now(),
  };
}

// Get a readable description for common MIME types
function getMimeTypeDescription(mimeType: string): string {
  const mimeDescriptions: Record<string, string> = {
    'application/vnd.google-apps.document': 'Google Doc',
    'application/vnd.google-apps.spreadsheet': 'Google Sheet',
    'application/vnd.google-apps.presentation': 'Google Slides',
    'application/vnd.google-apps.form': 'Google Form',
    'application/vnd.google-apps.drawing': 'Google Drawing',
    'application/vnd.google-apps.folder': 'Folder',
    'application/pdf': 'PDF Document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel Spreadsheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint Presentation',
    'text/plain': 'Text File',
    'text/csv': 'CSV File',
    'image/jpeg': 'JPEG Image',
    'image/png': 'PNG Image',
    'image/gif': 'GIF Image',
    'video/mp4': 'MP4 Video',
    'audio/mpeg': 'MP3 Audio',
  };

  return mimeDescriptions[mimeType] || mimeType.split('/').pop() || 'File';
}

// Format search results for inclusion in chat context
export function formatGoogleDriveResultsForContext(searchResponse: GoogleDriveSearchResponse): string {
  if (searchResponse.results.length === 0) {
    return `Google Drive search for "${searchResponse.query}" returned no results.`;
  }

  let formatted = `Google Drive search results for "${searchResponse.query}":\n\n`;

  searchResponse.results.forEach((result, index) => {
    const date = new Date(result.modifiedTime).toLocaleDateString();
    formatted += `[${index + 1}] ${result.fileName}\n`;
    formatted += `    Type: ${result.snippet}\n`;
    formatted += `    Modified: ${date}`;
    if (result.owner) {
      formatted += ` | Owner: ${result.owner}`;
    }
    formatted += `\n`;
    formatted += `    Link: ${result.webViewLink}\n\n`;
  });

  return formatted;
}

// Get file content (for supported file types)
export async function getGoogleDriveFileContent(
  fileId: string,
  accessToken: string,
  mimeType: string
): Promise<string | null> {
  // For Google Docs types, we need to export them
  const exportMimeTypes: Record<string, string> = {
    'application/vnd.google-apps.document': 'text/plain',
    'application/vnd.google-apps.spreadsheet': 'text/csv',
    'application/vnd.google-apps.presentation': 'text/plain',
  };

  const exportMimeType = exportMimeTypes[mimeType];

  try {
    let response: Response;

    if (exportMimeType) {
      // Export Google Workspace files
      const params = new URLSearchParams({ mimeType: exportMimeType });
      response = await fetch(`${DRIVE_API_BASE}/files/${fileId}/export?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } else if (mimeType.startsWith('text/') || mimeType === 'application/json') {
      // Download text-based files directly
      response = await fetch(`${DRIVE_API_BASE}/files/${fileId}?alt=media`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } else {
      // Can't get content for binary files
      return null;
    }

    if (!response.ok) {
      return null;
    }

    const content = await response.text();
    // Limit content length to avoid overwhelming the context
    const maxLength = 10000;
    if (content.length > maxLength) {
      return content.substring(0, maxLength) + '\n\n[Content truncated...]';
    }
    return content;
  } catch {
    return null;
  }
}

// Check if Google Drive is properly configured
export function isGoogleDriveConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID);
}
