import { doc, getFirestore, runTransaction, serverTimestamp } from 'firebase/firestore';
import { saveUserProfile } from './firebaseProfiles';

jest.mock('./firebase', () => ({
  firebaseApp: { name: 'test-app' }
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => 'user-document'),
  getFirestore: jest.fn(() => 'test-database'),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(() => 'server-timestamp')
}));

beforeEach(() => {
  jest.clearAllMocks();
  getFirestore.mockReturnValue('test-database');
  doc.mockReturnValue('user-document');
  serverTimestamp.mockReturnValue('server-timestamp');
});

test('creates a Firestore user profile with UID and server timestamps', async () => {
  const set = jest.fn();
  runTransaction.mockImplementation(async (database, callback) => callback({
    get: async () => ({ exists: () => false }),
    set
  }));
  const user = {
    uid: 'firebase-user-123',
    displayName: 'Taylor Shopper',
    email: 'taylor@example.com',
    photoURL: 'https://example.com/avatar.png'
  };

  await saveUserProfile(user);

  expect(getFirestore).toHaveBeenCalledWith({ name: 'test-app' });
  expect(doc).toHaveBeenCalledWith('test-database', 'users', user.uid);
  expect(set).toHaveBeenCalledWith('user-document', {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
    createdAt: 'server-timestamp',
    updatedAt: 'server-timestamp'
  });
});

test('updates an existing user profile without overwriting createdAt', async () => {
  const set = jest.fn();
  runTransaction.mockImplementation(async (database, callback) => callback({
    get: async () => ({ exists: () => true }),
    set
  }));

  await saveUserProfile({ uid: 'firebase-user-123', email: 'taylor@example.com' });

  expect(set).toHaveBeenCalledWith('user-document', {
    uid: 'firebase-user-123',
    displayName: '',
    email: 'taylor@example.com',
    photoURL: null,
    updatedAt: 'server-timestamp'
  }, { merge: true });
  expect(serverTimestamp).toHaveBeenCalledTimes(1);
});
