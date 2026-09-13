import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCUjEhWCho_Kd6LDLmeUHR070m5v43ZEVA",
  authDomain: "link-574d2.firebaseapp.com",
  projectId: "link-574d2",
  storageBucket: "link-574d2.firebasestorage.app",
  messagingSenderId: "184922100835",
  appId: "1:184922100835:web:784461d6a8bd872519d456"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
