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

Create a Firebase Admin service account with access to the project's Firestore database. Put its JSON contents in `FIREBASE_SERVICE_ACCOUNT_JSON` as a single-line JSON value. The browser config in `firebase.md` is public client configuration and is not a substitute for the Admin service account. Never commit `.env` or expose service-account credentials.

This initial server is local-only. Do not expose it to the public internet or deploy it until dashboard/operator authentication and production hosting configuration have been added.