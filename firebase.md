// firebase webapp name omnimail-web
npm install firebase
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "<REDACTED - retrieve from Firebase Console if needed>",
  authDomain: "omnimail-central-app.firebaseapp.com",
  projectId: "omnimail-central-app",
  storageBucket: "omnimail-central-app.firebasestorage.app",
  messagingSenderId: "74182049300",
  appId: "1:74182049300:web:d2971e572a452c73e0f101"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// This browser API key is not a database credential. Restrict it in Google Cloud
// to the required APIs and authorized websites. Never put Admin SDK credentials
// or OAuth client secrets in browser code or this file.