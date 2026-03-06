import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, GOOGLE_DRIVE_OAUTH_STATE_KEY } from '@/lib/googledrive';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');
  const expectedState = request.cookies.get(GOOGLE_DRIVE_OAUTH_STATE_KEY)?.value;

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

  if (!state) {
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('auth_error', 'Missing OAuth state');
    return NextResponse.redirect(redirectUrl);
  }

  if (!expectedState || state !== expectedState) {
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('auth_error', 'Invalid OAuth state');
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete(GOOGLE_DRIVE_OAUTH_STATE_KEY);
    return response;
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const tokenPayload = JSON.stringify({
      oauthState: state,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiry: Date.now() + tokens.expiresIn * 1000,
    }).replace(/</g, '\\u003c');
    const nonce = crypto.randomUUID().replace(/-/g, '');

    // Create a response that will store tokens in localStorage via a client-side script
    // This is because we can't directly access localStorage from the server
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Google Drive Authentication</title>
  <style nonce="${nonce}">
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
  <script nonce="${nonce}">
    const payload = ${tokenPayload};
    try {
      const expectedState = sessionStorage.getItem('${GOOGLE_DRIVE_OAUTH_STATE_KEY}');
      if (!expectedState || expectedState !== payload.oauthState) {
        sessionStorage.removeItem('${GOOGLE_DRIVE_OAUTH_STATE_KEY}');
        window.location.replace('/?auth_error=Invalid OAuth state');
      } else {
        sessionStorage.removeItem('${GOOGLE_DRIVE_OAUTH_STATE_KEY}');

      // Get existing settings from localStorage
      const existingSettings = JSON.parse(localStorage.getItem('chat_settings') || '{}');

      // Update with Google Drive tokens
      const updatedSettings = {
        ...existingSettings,
        googleDriveEnabled: true,
        googleDriveAccessToken: payload.accessToken,
        googleDriveRefreshToken: payload.refreshToken,
        googleDriveTokenExpiry: payload.tokenExpiry,
      };

      // Save updated settings
      localStorage.setItem('chat_settings', JSON.stringify(updatedSettings));

      // Redirect to main app
        window.location.replace('/?auth_success=google_drive');
      }
    } catch (e) {
      console.error('Failed to save tokens:', e);
      sessionStorage.removeItem('${GOOGLE_DRIVE_OAUTH_STATE_KEY}');
      window.location.replace('/?auth_error=Failed to save authentication');
    }
  </script>
</body>
</html>
    `;

    const response = new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
        Pragma: 'no-cache',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
      },
    });
    response.cookies.delete(GOOGLE_DRIVE_OAUTH_STATE_KEY);
    return response;
  } catch (error) {
    console.error('OAuth callback error:', error);
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('auth_error', 'Failed to complete authentication');
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete(GOOGLE_DRIVE_OAUTH_STATE_KEY);
    return response;
  }
}
