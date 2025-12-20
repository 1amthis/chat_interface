import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/googledrive';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    // Redirect back to app with error
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('auth_error', error);
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('auth_error', 'No authorization code received');
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    // Create a response that will store tokens in localStorage via a client-side script
    // This is because we can't directly access localStorage from the server
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Google Drive Authentication</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .success { color: #22c55e; }
    .spinner {
      border: 3px solid #f3f3f3;
      border-top: 3px solid #3b82f6;
      border-radius: 50%;
      width: 30px;
      height: 30px;
      animation: spin 1s linear infinite;
      margin: 1rem auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <h2 class="success">Successfully Connected!</h2>
    <div class="spinner"></div>
    <p>Saving authentication...</p>
  </div>
  <script>
    try {
      // Get existing settings from localStorage
      const existingSettings = JSON.parse(localStorage.getItem('chat_settings') || '{}');

      // Update with Google Drive tokens
      const updatedSettings = {
        ...existingSettings,
        googleDriveEnabled: true,
        googleDriveAccessToken: '${tokens.accessToken}',
        googleDriveRefreshToken: '${tokens.refreshToken}',
        googleDriveTokenExpiry: ${Date.now() + tokens.expiresIn * 1000},
      };

      // Save updated settings
      localStorage.setItem('chat_settings', JSON.stringify(updatedSettings));

      // Redirect to main app
      window.location.href = '/?auth_success=google_drive';
    } catch (e) {
      console.error('Failed to save tokens:', e);
      window.location.href = '/?auth_error=Failed to save authentication';
    }
  </script>
</body>
</html>
    `;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('auth_error', 'Failed to complete authentication');
    return NextResponse.redirect(redirectUrl);
  }
}
