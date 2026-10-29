import {
  doc,
  getFirestore,
  runTransaction,
  serverTimestamp
} from 'firebase/firestore';
import { firebaseApp } from './firebase';

export async function saveUserProfile(user) {
  if (!firebaseApp) {
    throw new Error('Firebase is not configured.');
  }
  if (!user || !user.uid) {
    throw new Error('A signed-in Firebase user is required to save a profile.');
  }

  const db = getFirestore(firebaseApp);
  const userRef = doc(db, 'users', user.uid);
  const profile = {
    uid: user.uid,
    displayName: user.displayName || '',
    email: user.email || '',
    photoURL: user.photoURL || null
  };

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(userRef);
    if (snapshot.exists()) {
      transaction.set(userRef, {
        ...profile,
        updatedAt: serverTimestamp()
      }, { merge: true });
      return;
    }

    transaction.set(userRef, {
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });
}
