# OmniMail Central

OmniMail Central is a local-first unified inbox for managing Gmail messages from multiple Google accounts in one dashboard. The inbox brings together messages from Inbox, Spam, and Trash, with each message labeled by its source account.

## Project Status

The local dashboard and API scaffold are runnable. Google account linking and email sync require the Google OAuth and Firebase Admin credentials described below. The project specification is in [Manual.MD](Manual.MD).

## Planned Features

- Connect multiple Google accounts with Google OAuth 2.0.
- Read messages from Inbox, Spam, and Trash using the Gmail API.
- Search messages and filter by connected account or category.
- View message details in a unified dashboard.
- Store connected-account metadata in Firebase Firestore.

The initial target is 20–30 accounts owned by the operator. Gmail API access is read-only and uses the `https://www.googleapis.com/auth/gmail.readonly` scope.

## Architecture

- **Frontend:** HTML, modern CSS, and JavaScript; React is an alternative under consideration.
- **Backend:** Node.js with Express or serverless functions on Vercel.
- **Authentication and mail:** Google OAuth 2.0 and the Gmail API, using `googleapis` or `google-auth-library`.
- **Database:** Firebase Firestore, using the default database.
- **Hosting:** Vercel is intended for the frontend and serverless API. GitHub Pages can host only a static frontend; it would need a separately hosted backend for OAuth callbacks and Gmail API requests.

### Request Flow

1. The operator links a Google account through OAuth consent.
2. A server-side callback exchanges the authorization code and stores the account email and refresh token in Firestore.
3. A sync endpoint obtains access tokens server-side and requests messages from Gmail.
4. The dashboard presents the aggregated results, including category and source account.

The OAuth callback stores account credentials in Firestore. Sync fetches up to 15 recent messages per category and account directly from Gmail; messages are not cached.

### Firestore Collections

- `connected_accounts`: account email, refresh token, date added, and connection status.
- `cached_emails` (optional): message ID, account email, subject, snippet, date, and category.

Firestore client access is denied by [`firestore.rules`](firestore.rules). The Node server uses Firebase Admin credentials, which bypass Firestore rules; keep that service-account JSON out of source control. Deploy the rules with `npx firebase-tools deploy --only firestore:rules` after signing in to the Firebase CLI and selecting the intended project.

## Security Notes

- Keep OAuth client secrets, Firebase Admin credentials, and refresh tokens on the server. Never expose them to browser code or commit them to the repository.
- Use least-privilege Firestore rules and server-side access controls; restrict access to stored credentials.
- OAuth refresh tokens are not guaranteed to be permanent. They can be revoked or become invalid, so the application should handle reauthorization and token failures.
- Do not request broader Gmail permissions than the read-only scope required by the application.

## Project Structure

```text
omnimail-central/
├── public/
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── api/
│   ├── auth.js
│   ├── fetch-emails.js
│   └── firebase-admin.js
├── .env.local       # Local secrets; do not commit
├── .gitignore
├── package.json
└── vercel.json
```

The dashboard uses a small Node/Express server and static HTML, CSS, and JavaScript. The server binds to `127.0.0.1` for local use.

## Getting Started

Requirements: Node.js 20 or newer and npm. To run the local dashboard:

```sh
npm install
npm start
```

Open `http://localhost:3000`. The dashboard runs without credentials; connecting accounts and syncing remain disabled until Google OAuth and Firebase Admin configuration are provided.

Copy `.env.example` to `.env` when you are ready to configure integrations. In Google Cloud, enable the Gmail API, configure the OAuth consent screen, create an OAuth 2.0 **Web application** client, and add `http://localhost:3000/api/auth/google/callback` as an authorized redirect URI. Add the Google test accounts to the consent screen if the app remains in testing mode.

Create a new Firebase Admin service-account key after revoking any key that has been exposed. Save it locally as `firebase-admin-service-account.json` (or update `GOOGLE_APPLICATION_CREDENTIALS` in `.env`). The browser API key in `firebase.md` is a public client identifier and is not a substitute for the Admin service account. Restrict that key to the required APIs and authorized websites in Google Cloud. Never commit `.env` or expose service-account credentials.

## Deploying to Vercel

The API is served by `api/[...route].js`. Before connecting Gmail accounts, configure these variables in the Vercel project's Production environment:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_JSON` (a newly generated service-account JSON; revoke any exposed key first)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI=https://omnimail-central.vercel.app/api/auth/google/callback`
- `APP_ACCESS_PASSWORD` (a strong private workspace password)
- `APP_SESSION_SECRET` (a unique random secret; generate locally, never commit it)

Add the production callback URL above to the Google OAuth client's authorized redirect URIs. The `/__/auth/handler` Firebase URL is not the callback used by this backend. Set all variables for the Production environment, then redeploy the latest GitHub commit. Mail and account endpoints remain inaccessible until operator authentication is configured.

The shared workspace password is prompted for in each new browser session. Its signed `HttpOnly` cookie is not persisted when the browser session ends and expires server-side after 12 hours.

For local development, copy `.env.example` to `.env`; the local server does not require the production workspace password. Never commit `.env` or any service-account JSON.