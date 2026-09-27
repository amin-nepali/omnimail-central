# OmniMail Central

OmniMail Central is a planned unified inbox for managing Gmail messages from multiple Google accounts in one dashboard. The intended inbox view brings together messages from Inbox, Spam, and Trash, with each message labeled by its source account.

## Project Status

This repository is at the planning stage. The project specification is in [Manual.MD](Manual.MD); the application, API, and deployment configuration described below have not yet been implemented.

## Planned Features

- Connect multiple Google accounts with Google OAuth 2.0.
- Read messages from Inbox, Spam, and Trash using the Gmail API.
- Search messages and filter by connected account or category.
- View message details in a unified dashboard.
- Store connected-account metadata in Firebase Firestore.

The initial target is 20–30 accounts owned by the operator. Gmail API access is read-only and uses the `https://www.googleapis.com/auth/gmail.readonly` scope.

## Planned Architecture

- **Frontend:** HTML, modern CSS, and JavaScript; React is an alternative under consideration.
- **Backend:** Node.js with Express or serverless functions on Vercel.
- **Authentication and mail:** Google OAuth 2.0 and the Gmail API, using `googleapis` or `google-auth-library`.
- **Database:** Firebase Firestore, using the default database.
- **Hosting:** Vercel is intended for the frontend and serverless API. GitHub Pages can host only a static frontend; it would need a separately hosted backend for OAuth callbacks and Gmail API requests.

### Proposed Request Flow

1. The operator links a Google account through OAuth consent.
2. A server-side callback exchanges the authorization code and stores the account email and refresh token in Firestore.
3. A sync endpoint obtains access tokens server-side and requests messages from Gmail.
4. The dashboard presents the aggregated results, including category and source account.

The callback and sync endpoint paths are proposals from the project specification, not implemented endpoints.

### Proposed Firestore Collections

- `connected_accounts`: account email, refresh token, date added, and connection status.
- `cached_emails` (optional): message ID, account email, subject, snippet, date, and category.

## Security Notes

- Keep OAuth client secrets, Firebase Admin credentials, and refresh tokens on the server. Never expose them to browser code or commit them to the repository.
- Use least-privilege Firestore rules and server-side access controls; restrict access to stored credentials.
- OAuth refresh tokens are not guaranteed to be permanent. They can be revoked or become invalid, so the application should handle reauthorization and token failures.
- Do not request broader Gmail permissions than the read-only scope required by the application.

## Planned Project Structure

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

This is a proposed starting structure; filenames and framework choices may change during implementation.

## Getting Started

There is no runnable application or install/build command yet. The first implementation step in the project specification is to establish the project structure and `package.json`, then build the server-side OAuth flow and Gmail sync before connecting the dashboard.

Before implementing OAuth and deployment, create/configure the Google Cloud and Firebase project, enable the Gmail API, register the OAuth client and callback URL, and configure the required secrets in the hosting environment. Keep local environment files out of version control.