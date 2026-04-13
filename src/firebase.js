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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const authPersistenceReady = setPersistence(auth, browserLocalPersistence).catch(() => null);
let initialAuthResolved = false;

export const voteOptions = ['I', 'II', 'III', 'IV', 'V'];
export { auth, db };

function waitForInitialAuthState() {
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
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export function subscribeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function ensureSignedIn() {
  await authPersistenceReady;
  await waitForInitialAuthState();

  if (auth.currentUser) {
    return auth.currentUser;
  }

  const result = await signInAnonymously(auth);
  return result.user ?? auth.currentUser ?? waitForAuthState();
}

export async function signInWithGoogle() {
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
