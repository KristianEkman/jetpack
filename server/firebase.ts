import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  initializeApp,
  cert,
  getApps,
  applicationDefault,
  App,
} from "firebase-admin/app";
import { getDatabase, Database } from "firebase-admin/database";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_KEY_FILENAME =
  "jetpack-a9e21-firebase-adminsdk-fbsvc-8b7404d427.json";
const DEFAULT_KEY_PATH = path.join(__dirname, DEFAULT_KEY_FILENAME);
const DATABASE_URL = "https://jetpack-a9e21-default-rtdb.firebaseio.com";

let initializedApp: App | null = null;

/**
 * Initializes and returns the Firebase Admin App instance.
 * Supports loading key from local file or process environment.
 */
export function initFirebaseAdmin(): App | null {
  if (initializedApp) {
    return initializedApp;
  }

  const existingApps = getApps();
  if (existingApps.length > 0 && existingApps[0]) {
    initializedApp = existingApps[0];
    return initializedApp;
  }

  // 1. Check for raw JSON string in environment variable (e.g. for Azure App Service)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
      }
      initializedApp = initializeApp({
        credential: cert(serviceAccount),
        databaseURL: DATABASE_URL,
      });
      console.log(
        "🔥 Firebase Admin SDK initialized using FIREBASE_SERVICE_ACCOUNT_JSON env var.",
      );
      return initializedApp;
    } catch (err) {
      console.error(
        "❌ Failed to parse or initialize Firebase Admin SDK from FIREBASE_SERVICE_ACCOUNT_JSON env var:",
        err,
      );
    }
  }

  // 2. Check for key file path
  const keyPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || DEFAULT_KEY_PATH;

  if (fs.existsSync(keyPath)) {
    try {
      const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));
      initializedApp = initializeApp({
        credential: cert(serviceAccount),
        databaseURL: DATABASE_URL,
      });
      console.log(
        "🔥 Firebase Admin SDK initialized successfully with service account.",
      );
      return initializedApp;
    } catch (err) {
      console.error(
        "❌ Failed to initialize Firebase Admin SDK with key file:",
        err,
      );
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      initializedApp = initializeApp({
        credential: applicationDefault(),
        databaseURL: DATABASE_URL,
      });
      console.log(
        "🔥 Firebase Admin SDK initialized using default application credentials.",
      );
      return initializedApp;
    } catch (err) {
      console.error(
        "❌ Failed to initialize Firebase Admin SDK with default credentials:",
        err,
      );
    }
  } else {
    console.warn(
      `⚠️ Firebase service account key not found at "${keyPath}". Firebase Admin features will be unavailable.`,
    );
  }

  return null;
}

/**
 * Returns the Firebase Realtime Database instance, or null if initialization failed.
 */
export function getFirebaseDatabase(): Database | null {
  const app = initFirebaseAdmin();
  if (!app) return null;
  return getDatabase(app);
}
