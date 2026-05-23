import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

// TODO: O usuário precisará substituir isso pelas suas credenciais
const firebaseConfig = {
  apiKey: "AIzaSyDlpu4MYT_7M_2N-w1gCFfqv0E0_5Bm80g",
  authDomain: "xadrez-b6b68.firebaseapp.com",
  projectId: "xadrez-b6b68",
  storageBucket: "xadrez-b6b68.appspot.com",
  messagingSenderId: "1075078825390", // from screenshot
  appId: "1:1075078825390:web:61e20a428ab959090b743f"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const functions = getFunctions(app);
