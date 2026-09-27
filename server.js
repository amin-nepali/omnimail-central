require('dotenv').config();

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { google } = require('googleapis');
const { extractMessage } = require('./lib/messages');

const app = express();
const port = Number(process.env.PORT) || 3000;
const projectId = process.env.FIREBASE_PROJECT_ID || 'omnimail-central-app';
const redirectUri = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${port}/api/auth/google/callback`;
const oauthReady = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const firestoreReady = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
  (serviceAccountPath && fs.existsSync(path.resolve(serviceAccountPath))));
const production = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
const appAccessPassword = process.env.APP_ACCESS_PASSWORD;
const appSessionSecret = process.env.APP_SESSION_SECRET;
const appAuthConfigured = Boolean(appAccessPassword && appSessionSecret);
const gmailScope = 'https://www.googleapis.com/auth/gmail.readonly';
const stateCookie = 'omnimail_oauth_state';
const sessionCookie = 'omnimail_session';
const sessionLifetimeSeconds = 12 * 60 * 60;

let firestore;
let firebaseInitializationError;

function getFirestore() {
  if (firestore) return firestore;
  if (firebaseInitializationError) throw firebaseInitializationError;

  try {
    const admin = require('firebase-admin');
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
      : JSON.parse(fs.readFileSync(path.resolve(serviceAccountPath), 'utf8'));
    const appInstance = admin.apps[0] ?? admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    });
    firestore = appInstance.firestore();
    return firestore;
  } catch (error) {
    firebaseInitializationError = new Error(`Firebase Admin setup failed: ${error.message}`);
    throw firebaseInitializationError;
  }
}

function getOAuthClient() {
  if (!oauthReady) {
    const error = new Error('Google OAuth is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.');
    error.status = 503;
    throw error;
  }
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, redirectUri);
}

function setStateCookie(response, value) {
  const attributes = [`${stateCookie}=${value}`, 'HttpOnly', 'SameSite=Lax', 'Path=/api/auth/google', 'Max-Age=600'];
  if (production) attributes.push('Secure');
  response.setHeader('Set-Cookie', attributes.join('; '));
}

function clearStateCookie(response) {
  response.setHeader('Set-Cookie', `${stateCookie}=; HttpOnly; SameSite=Lax; Path=/api/auth/google; Max-Age=0`);
}

function readCookie(request, name) {
  const cookie = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : '';
}

function sessionSignature(expiresAt) {
  return crypto.createHmac('sha256', appSessionSecret).update(expiresAt).digest('base64url');
}

function hasValidSession(request) {
  if (!appAuthConfigured) return !production;
  const [expiresAt, signature, extra] = readCookie(request, sessionCookie).split('.');
  if (!expiresAt || !signature || extra || !/^\d+$/.test(expiresAt) || Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(sessionSignature(expiresAt));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function setSessionCookie(response) {
  const expiresAt = String(Math.floor(Date.now() / 1000) + sessionLifetimeSeconds);
  const token = `${expiresAt}.${sessionSignature(expiresAt)}`;
  const attributes = [`${sessionCookie}=${token}`, 'HttpOnly', 'SameSite=Lax', 'Path=/'];
  if (production) attributes.push('Secure');
  response.setHeader('Set-Cookie', attributes.join('; '));
}

function clearSessionCookie(response) {
  const attributes = [`${sessionCookie}=`, 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=0'];
  if (production) attributes.push('Secure');
  response.setHeader('Set-Cookie', attributes.join('; '));
}

function requireOperator(request, response, next) {
  if (!production) return next();
  if (!appAuthConfigured) {
    return response.status(503).json({ error: 'Owner access is not configured. Set APP_ACCESS_PASSWORD and APP_SESSION_SECRET.' });
  }
  if (!hasValidSession(request)) return response.status(401).json({ error: 'Sign in to the private workspace.' });
  next();
}

function requireConfiguredServices(request, response, next) {
  if (!oauthReady || !firestoreReady) {
    return response.status(503).json({
      error: 'Account linking and mail sync are not configured yet.',
      missing: [!oauthReady && 'Google OAuth credentials', !firestoreReady && 'Firebase Admin service account'].filter(Boolean),
    });
  }
  next();
}

function safeError(response, error) {
  const status = error.status && Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) console.error(error);
  response.status(status).json({ error: status >= 500 ? 'The request could not be completed.' : error.message });
}

app.use(express.json({ limit: '32kb' }));
app.use(express.static('public'));

app.get('/api/session', (request, response) => {
  response.json({
    authenticated: hasValidSession(request),
    required: production,
    configured: appAuthConfigured || !production,
  });
});

app.post('/api/session', (request, response) => {
  if (!production) return response.json({ authenticated: true, required: false, configured: true });
  if (!appAuthConfigured) return response.status(503).json({ error: 'Owner access is not configured yet.' });
  const suppliedPassword = Buffer.from(typeof request.body?.password === 'string' ? request.body.password : '');
  const expectedPassword = Buffer.from(appAccessPassword);
  if (suppliedPassword.length !== expectedPassword.length || !crypto.timingSafeEqual(suppliedPassword, expectedPassword)) {
    return response.status(401).json({ error: 'Incorrect password.' });
  }
  setSessionCookie(response);
  response.json({ authenticated: true, required: true, configured: true });
});

app.delete('/api/session', (_request, response) => {
  clearSessionCookie(response);
  response.json({ authenticated: false });
});

app.get('/api/status', (_request, response) => {
  response.json({
    app: 'OmniMail Central',
    ready: oauthReady && firestoreReady,
    services: { googleOAuth: oauthReady, firebaseAdmin: firestoreReady },
    operatorAuthConfigured: appAuthConfigured || !production,
    projectId,
  });
});

app.get('/api/auth/google', requireOperator, (request, response) => {
  try {
    if (!oauthReady) {
      return response.status(503).json({ error: 'Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env to enable Google account linking.' });
    }
    const state = crypto.randomBytes(32).toString('hex');
    setStateCookie(response, state);
    const authorizationUrl = getOAuthClient().generateAuthUrl({
      access_type: 'offline',
      prompt: 'select_account consent',
      scope: [gmailScope, 'email', 'openid'],
      state,
    });
    response.redirect(authorizationUrl);
  } catch (error) {
    safeError(response, error);
  }
});

app.get('/api/auth/google/callback', requireOperator, requireConfiguredServices, async (request, response) => {
  const expectedState = readCookie(request, stateCookie);
  const receivedState = typeof request.query.state === 'string' ? request.query.state : '';
  const expectedStateBuffer = Buffer.from(expectedState);
  const receivedStateBuffer = Buffer.from(receivedState);
  clearStateCookie(response);
  if (!expectedState || !receivedState || expectedStateBuffer.length !== receivedStateBuffer.length ||
      !crypto.timingSafeEqual(expectedStateBuffer, receivedStateBuffer)) {
    return response.status(400).send('OAuth state validation failed. Return to the dashboard and try again.');
  }
  if (request.query.error) return response.status(400).send('Google account linking was cancelled or denied.');

  try {
    const oauth = getOAuthClient();
    const { tokens } = await oauth.getToken(String(request.query.code ?? ''));
    oauth.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth });
    const { data: profile } = await oauth2.userinfo.get();
    if (!profile.email) throw new Error('Google did not return an account email.');

    const db = getFirestore();
    const accountId = crypto.createHash('sha256').update(profile.email.toLowerCase()).digest('hex');
    const accountRef = db.collection('connected_accounts').doc(accountId);
    const existing = await accountRef.get();
    const account = {
      email: profile.email,
      status: 'connected',
      addedAt: existing.exists ? existing.data().addedAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (tokens.refresh_token) account.refreshToken = tokens.refresh_token;
    else if (!existing.exists) throw new Error('Google did not issue a refresh token. Remove this app from your Google account permissions and link it again.');
    await accountRef.set(account, { merge: true });
    response.redirect('/?connected=1');
  } catch (error) {
    safeError(response, error);
  }
});

app.get('/api/accounts', requireOperator, requireConfiguredServices, async (_request, response) => {
  try {
    const snapshot = await getFirestore().collection('connected_accounts').orderBy('email').get();
    response.json({ accounts: snapshot.docs.map((document) => {
      const { email, status, addedAt } = document.data();
      return { email, status, addedAt };
    }) });
  } catch (error) {
    safeError(response, error);
  }
});

app.post('/api/emails/sync', requireOperator, requireConfiguredServices, async (_request, response) => {
  try {
    const db = getFirestore();
    const accountSnapshot = await db.collection('connected_accounts').orderBy('email').get();
    const messages = [];
    const failures = [];
    const categories = [
      { name: 'Inbox', query: 'in:inbox' },
      { name: 'Spam', query: 'in:spam' },
      { name: 'Trash', query: 'in:trash' },
    ];

    for (const accountDocument of accountSnapshot.docs) {
      const account = accountDocument.data();
      if (!account.refreshToken) {
        failures.push({ email: account.email, error: 'No refresh token. Reconnect this account.' });
        continue;
      }
      try {
        const auth = getOAuthClient();
        auth.setCredentials({ refresh_token: account.refreshToken });
        const gmail = google.gmail({ version: 'v1', auth });
        for (const category of categories) {
          const list = await gmail.users.messages.list({ userId: 'me', q: category.query, maxResults: 15 });
          for (const item of list.data.messages ?? []) {
            const { data } = await gmail.users.messages.get({ userId: 'me', id: item.id, format: 'full' });
            messages.push(extractMessage(data, account.email, category.name));
          }
        }
      } catch (error) {
        failures.push({ email: account.email, error: error.message });
      }
    }

    messages.sort((left, right) => right.internalDate - left.internalDate);
    response.json({ messages, failures, syncedAt: new Date().toISOString() });
  } catch (error) {
    safeError(response, error);
  }
});

app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));

if (require.main === module) {
  app.listen(port, '127.0.0.1', () => {
    console.log(`OmniMail Central is running at http://localhost:${port}`);
  });
}

module.exports = app;