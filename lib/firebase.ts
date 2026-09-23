import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC0c3DKERwfSw9mrobgQzcT4LHVz9ZtvQE",
  authDomain: "studylab-f252f.firebaseapp.com",
  projectId: "studylab-f252f",
  storageBucket: "studylab-f252f.firebasestorage.app",
  messagingSenderId: "1064199094493",
  appId: "1:1064199094493:web:a69712d5aa6a4b1ec41b34",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);