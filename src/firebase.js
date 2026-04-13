import { initializeApp } from 'firebase/app';
import {
  addDoc,
  collection,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  where
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
const db = getFirestore(app);

export const voteOptions = ['I', 'II', 'III', 'IV', 'V'];

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

export async function submitVote(voteKey, voterId) {
  if (!voteOptions.includes(voteKey)) {
    throw new Error('Invalid vote option');
  }

  const existingVoteQuery = query(
    collection(db, 'manifestVotes'),
    where('voterId', '==', voterId)
  );

  const existingVotes = await getDocs(existingVoteQuery);

  if (!existingVotes.empty) {
    throw new Error('You have already voted from this browser.');
  }

  await addDoc(collection(db, 'manifestVotes'), {
    vote: voteKey,
    voterId,
    createdAt: serverTimestamp()
  });
}
