import { signInWithPopup } from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, provider, db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useEffect } from "react";

export default function Login() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, isActive, isAdmin } = useAuth();

  useEffect(() => {
    if (user && (isActive || isAdmin)) {
      navigate(location.state?.from?.pathname || "/", { replace: true });
    }
  }, [user, isActive, isAdmin]);

  async function handleLogin() {
    try {
      const result = await signInWithPopup(auth, provider);
      const u = result.user;
      const userRef = doc(db, "users", u.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        // New user — create with pending status
        await setDoc(userRef, {
          displayName:  u.displayName,
          email:        u.email,
          photoURL:     u.photoURL,
          role:         "student",
          status:       "pending",   // ← must be approved by admin
          createdAt:    serverTimestamp(),
          lastLoginAt:  serverTimestamp(),
        });
      } else {
        await setDoc(userRef, { lastLoginAt: serverTimestamp() }, { merge: true });
      }

      // Reload page so AuthContext re-reads the profile
      window.location.href = "/";
    } catch (err) {
      console.error("Login failed:", err.message);
      alert("Login failed: " + err.message);
    }
  }

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f4f7f4", fontFamily:"system-ui,-apple-system,sans-serif" }}>
      <div style={{ background:"white", border:"1px solid #e8eee8", borderRadius:"20px", padding:"52px 44px", textAlign:"center", maxWidth:"400px", width:"90%" }}>

        <div style={{ width:"56px", height:"56px", borderRadius:"16px", background:"#E1F5EE", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 22px", fontSize:"26px" }}>
          📚
        </div>

        <h1 style={{ fontSize:"24px", fontWeight:"800", marginBottom:"8px", color:"#111" }}>
          Kerala SET Prep
        </h1>
        <p style={{ color:"#999", fontSize:"14px", marginBottom:"36px", lineHeight:"1.6" }}>
          Sign in to access mock tests and<br/>previous year papers
        </p>

        <button
          onClick={handleLogin}
          style={{ width:"100%", padding:"14px", borderRadius:"12px", border:"1.5px solid #e0e0e0", background:"white", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"12px", fontSize:"15px", fontWeight:"600", color:"#333", transition:"all 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor="#1D9E75"; e.currentTarget.style.background="#f8fffc"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor="#e0e0e0"; e.currentTarget.style.background="white"; }}
        >
          <img src="https://www.google.com/favicon.ico" width="18" height="18" alt="Google"/>
          Continue with Google
        </button>

        <div style={{ marginTop:"24px", padding:"14px 16px", background:"#f8fbf8", borderRadius:"10px", border:"1px solid #e8eee8" }}>
          <p style={{ fontSize:"12px", color:"#888", margin:0, lineHeight:"1.6" }}>
            New accounts require <strong style={{ color:"#1D9E75" }}>admin approval</strong> before access is granted. You'll see a waiting screen after signing in.
          </p>
        </div>

        <p style={{ marginTop:"20px", fontSize:"12px", color:"#ccc" }}>
          Free to use · Kerala SET exam preparation
        </p>
      </div>
    </div>
  );
}