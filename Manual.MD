Here are the complete architecture details and a **Master Prompt** specifically designed for **GitHub Copilot** in VS Code.

---

## 🛠️ Complete Project Identifiers & Configuration Details

Below are the exact naming conventions and settings to use across Google Cloud, Firebase, GitHub, and VS Code:

| Identifier | Suggested Name / Setting | Details |
| --- | --- | --- |
| **Project Name** | `OmniMail Central` | Display name for your project |
| **GitHub Repository** | `omnimail-central` | Public/Private repo on GitHub |
| **Firebase Project Name** | `omnimail-central-app` | Project created inside [Firebase Console](https://console.firebase.google.com/?utm_source=gemini) |
| **Firebase Project ID** | `omnimail-central-app` | Auto-generated system ID |
| **Firebase Web App Name** | `omnimail-web` | Web app registered under Firebase project settings |
| **Firestore Database Name** | `(default)` | Default database created automatically in Firestore (Native Mode) |
| **Hosting Platform** | **Vercel** / **GitHub Pages** | Free static site + serverless functions support |
| **Google Cloud API** | **Gmail API** | Enabled via Google Cloud Console under `omnimail-central-app` |
| **Google OAuth Scope** | `[https://www.googleapis.com/auth/gmail.readonly](https://www.googleapis.com/auth/gmail.readonly)` | Permission scope for reading inbox/spam/trash |

---

## 🤖 GitHub Copilot Master Prompt

Copy and paste the prompt below into **GitHub Copilot Chat** inside VS Code (`Ctrl+Alt+I` / `Cmd+Alt+I` or `@workspace`).

```markdown
You are an expert full-stack developer specializing in Node.js, JavaScript/TypeScript, Firebase, and Google APIs.

### PROJECT OVERVIEW:
I am building a web application named "OmniMail Central" hosted on Vercel/GitHub Pages with a Firebase backend.
The purpose of this app is to serve as a Single Unified Inbox Manager for 20-30 individual Google accounts that I own.
It must display emails from Inbox, Spam, and Trash categories across all connected Google accounts simultaneously.

### TECHNICAL SPECIFICATIONS:
1. **Frontend**: HTML5, Modern CSS (Tailwind CSS via CDN), Vanilla JavaScript / React.
2. **Backend**: Node.js / Express or Vercel Serverless Functions.
3. **Database**: Firebase Firestore (`(default)` database).
4. **Authentication / OAuth**: Google OAuth 2.0 with Gmail API (`https://www.googleapis.com/auth/gmail.readonly`).

### CORE FEATURES TO BUILD:
1. **Google OAuth Linker ("Add Account")**:
   - A button triggering Google OAuth 2.0 with parameters `access_type=offline` and `prompt=select_account consent` to obtain permanent Refresh Tokens for each account added.
   - An endpoint `/api/auth/google/callback` that receives the Authorization Code, exchanges it for `access_token` and `refresh_token`, and securely saves the account email and refresh token into Firestore under the `connected_accounts` collection.

2. **Aggregated Email Sync & Fetching Engine**:
   - An endpoint `/api/emails/sync` that loops through all stored accounts in Firestore.
   - For each account, uses the saved `refresh_token` to get a valid `access_token` via `google-auth-library` or `googleapis` SDK.
   - Queries Gmail API (`users.messages.list`) for messages matching `in:inbox`, `in:spam`, and `in:trash`.
   - Batch fetches full message details (`users.messages.get` format: `full` or `metadata`) and parses subject, sender, snippet, category (Inbox/Spam/Trash), timestamp, and account source email.

3. **Unified Frontend Dashboard**:
   - Clean, modern dashboard UI with sidebar navigation: [All Inboxes], [Inbox], [Spam], [Trash], [Connected Accounts].
   - Search bar and filtering by specific connected email account.
   - Email list displaying Sender, Subject, Snippet, Time, Category badge, and Source Account badge.
   - Email detail viewer modal to view full email content.

4. **Security & Data Structure**:
   - Firestore schema:
     - Collection: `connected_accounts` -> Docs: `{ email, refreshToken, addedAt, status }`
     - Collection: `cached_emails` (optional) -> Docs: `{ messageId, accountEmail, subject, snippet, date, category }`

### WHAT I NEED YOU TO DO FIRST:
1. Provide the complete project folder structure.
2. Supply `package.json` with all necessary dependencies (`googleapis`, `firebase-admin`, `dotenv`, `express`, etc.).
3. Write the serverless/Node.js API code for Google OAuth authentication and token storage in Firestore.
4. Write the core utility function that iterates through all connected accounts and fetches messages from the Gmail API.
5. Create a clean HTML/JS dashboard UI template connecting to these API endpoints.

Let's begin step-by-step. Start by showing the project folder structure and setting up package.json.

```

---

### Recommended Folder Structure for Copilot

```
omnimail-central/
├── public/
│   ├── index.html        # Main Unified Inbox Interface
│   ├── app.js            # Frontend logic & API calls
│   └── styles.css        # Dashboard styling / Tailwind
├── api/
│   ├── auth.js           # Handles Google OAuth redirect & token exchange
│   ├── fetch-emails.js   # Queries Gmail API for all 20-30 accounts
│   └── firebase-admin.js # Firebase Admin SDK initialization
├── .env.local            # Environment variables (Google Client ID/Secret, Firebase Keys)
├── .gitignore
├── package.json
└── vercel.json           # Serverless deployment configuration

```