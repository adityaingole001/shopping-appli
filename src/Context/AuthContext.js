import { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from 'firebase/auth';
import { firebaseAuth, isFirebaseConfigured } from '../firebase';
import { saveUserProfile } from '../firebaseProfiles';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!firebaseAuth) {
      setLoading(false);
      return undefined;
    }

    return onAuthStateChanged(
      firebaseAuth,
      async (currentUser) => {
        setUser(currentUser);
        setLoading(false);
        if (currentUser) {
          try {
            await saveUserProfile(currentUser);
          } catch (error) {
            console.error('Unable to save the signed-in user profile:', error);
          }
        }
      },
      (error) => {
        console.error('Unable to restore the Firebase sign-in session:', error);
        setLoading(false);
      }
    );
  }, []);

  const requireConfiguredAuth = () => {
    if (!firebaseAuth) {
      throw new Error('Account sign-in is not configured. Add the Firebase web app settings to your root .env.local file and restart the app.');
    }
    return firebaseAuth;
  };

  const signIn = async (email, password) => {
    const credential = await signInWithEmailAndPassword(
      requireConfiguredAuth(),
      email.trim(),
      password
    );
    setUser(credential.user);
    await saveUserProfile(credential.user);
    return credential;
  };

  const createAccount = async (name, email, password) => {
    const credential = await createUserWithEmailAndPassword(
      requireConfiguredAuth(),
      email.trim(),
      password
    );
    if (name.trim()) {
      await updateProfile(credential.user, { displayName: name.trim() });
    }
    setUser(credential.user);
    await saveUserProfile(credential.user);
    return credential;
  };

  const signInWithGoogle = async () => {
    const credential = await signInWithPopup(requireConfiguredAuth(), new GoogleAuthProvider());
    setUser(credential.user);
    await saveUserProfile(credential.user);
    return credential;
  };

  const logout = () => signOut(requireConfiguredAuth());

  const value = {
    user,
    loading,
    configured: isFirebaseConfigured,
    signIn,
    createAccount,
    signInWithGoogle,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider.');
  return context;
}
