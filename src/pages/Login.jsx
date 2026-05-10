import { signInWithPopup } from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, provider, db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useEffect } from "react";

export default function Login() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useAuth();

  // If already logged in, go straight to home
  useEffect(() => {
    if (user) {
      const destination = location.state?.from?.pathname || "/";
      navigate(destination, { replace: true });
    }
  }, [user]);

  async function handleLogin() {
    try {
      const result = await signInWithPopup(auth, provider);
      const u      = result.user;

      const userRef = doc(db, "users", u.uid);
      const snap    = await getDoc(userRef);

      if (!snap.exists()) {
        await setDoc(userRef, {
          displayName:  u.displayName,
          email:        u.email,
          photoURL:     u.photoURL,
          role:         "student",
          createdAt:    serverTimestamp(),
          lastLoginAt:  serverTimestamp(),
        });
      } else {
        await setDoc(userRef, { lastLoginAt: serverTimestamp() }, { merge: true });
      }

      // Navigate to where they were trying to go, or home
      const destination = location.state?.from?.pathname || "/";
      navigate(destination, { replace: true });

    } catch (err) {
      console.error("Login failed:", err.message);
      alert("Login failed: " + err.message);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", background: "#f8fffe"
    }}>
      <div style={{
        background: "white", border: "1px solid #e0e0e0", borderRadius: "16px",
        padding: "48px 40px", textAlign: "center", maxWidth: "380px", width: "90%"
      }}>
        <div style={{
          width: "48px", height: "48px", borderRadius: "50%",
          background: "#E1F5EE", display: "flex", alignItems: "center",
          justifyContent: "center", margin: "0 auto 20px", fontSize: "22px"
        }}>📚</div>
        <h1 style={{ fontSize: "22px", fontWeight: "600", marginBottom: "8px", color: "#111" }}>
          Kerala SET Prep
        </h1>
        <p style={{ color: "#666", fontSize: "14px", marginBottom: "32px" }}>
          Sign in to access mock tests and previous year papers
        </p>
        <button
          onClick={handleLogin}
          style={{
            width: "100%", padding: "12px", borderRadius: "8px",
            border: "1px solid #ddd", background: "white", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: "10px", fontSize: "14px", fontWeight: "500", color: "#333"
          }}
        >
          <img src="https://www.google.com/favicon.ico" width="18" height="18" alt="" />
          Continue with Google
        </button>
        <p style={{ marginTop: "20px", fontSize: "12px", color: "#aaa" }}>
          Free to use · No credit card required
        </p>
      </div>
    </div>
  );
}