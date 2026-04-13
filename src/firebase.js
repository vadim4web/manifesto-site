import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  GoogleAuthProvider,
  getAuth,
  linkWithPopup,
  onAuthStateChanged,
  setPersistence,
  signInAnonymously,
  signInWithPopup
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const firebasePlaceholderValues = new Set([
  '',
  'your_key',
  'your_project.firebaseapp.com',
  'your_project_id',
  'your_project.appspot.com',
  '123456789',
  '1:123456789:web:abcdef'
]);

const invalidFirebaseKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => firebasePlaceholderValues.has(String(value ?? '').trim()))
  .map(([key]) => key);

const firebaseConfigError = invalidFirebaseKeys.length
  ? `Firebase configuration is missing or invalid: ${invalidFirebaseKeys.join(', ')}`
  : '';

let app = null;
let auth = null;
let db = null;
let authPersistenceReady = Promise.resolve(null);
let initialAuthResolved = false;

if (!firebaseConfigError) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  authPersistenceReady = setPersistence(auth, browserLocalPersistence).catch(() => null);
}

export const voteOptions = ['I', 'II', 'III', 'IV', 'V'];
export { auth, db, firebaseConfigError };

function waitForInitialAuthState() {
  if (!auth) {
    return Promise.resolve(null);
  }

  if (initialAuthResolved) {
    return Promise.resolve(auth.currentUser);
  }

  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      initialAuthResolved = true;
      unsubscribe();
      resolve(user);
    });
  });
}

function waitForAuthState() {
  if (!auth) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export function subscribeAuth(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(auth, callback);
}

export async function ensureSignedIn() {
  if (!auth) {
    throw new Error(firebaseConfigError || 'Firebase authentication is unavailable.');
  }

  await authPersistenceReady;
  await waitForInitialAuthState();

  if (auth.currentUser) {
    return auth.currentUser;
  }

  const result = await signInAnonymously(auth);
  return result.user ?? auth.currentUser ?? waitForAuthState();
}

export async function signInWithGoogle() {
  if (!auth) {
    throw new Error(firebaseConfigError || 'Firebase authentication is unavailable.');
  }

  await authPersistenceReady;
  await waitForInitialAuthState();

  const user = auth.currentUser;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  if (user && !user.isAnonymous) {
    return user;
  }

  try {
    if (user?.isAnonymous) {
      const result = await linkWithPopup(user, provider);
      return result.user;
    }

    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    if (error?.code === 'auth/credential-already-in-use') {
      const result = await signInWithPopup(auth, provider);
      return result.user;
    }

    throw error;
  }
}

export function subscribeVoteTotals(callback) {
  if (!db) {
    callback(voteOptions.reduce((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {}));
    return () => {};
  }

  const votesRef = collection(db, 'manifestVotes');

  return onSnapshot(votesRef, (snapshot) => {
    const totals = voteOptions.reduce((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {});

    snapshot.forEach((docSnapshot) => {
      const { vote } = docSnapshot.data();
      if (voteOptions.includes(vote)) {
        totals[vote] += 1;
      }
    });

    callback(totals);
  });
}

export async function submitVote(voteKey) {
  if (!db) {
    throw new Error(firebaseConfigError || 'Firebase database is unavailable.');
  }

  if (!voteOptions.includes(voteKey)) {
    throw new Error('Invalid vote option');
  }

  const user = await ensureSignedIn();

  if (!user?.uid) {
    throw new Error('Authentication failed.');
  }

  const voteRef = doc(db, 'manifestVotes', user.uid);
  const existingVote = await getDoc(voteRef);

  if (existingVote.exists()) {
    throw new Error('You have already voted from this account.');
  }

  await setDoc(voteRef, {
    vote: voteKey,
    userId: user.uid,
    createdAt: serverTimestamp()
  });
}
