import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(undefined);
  const [profile, setProfile] = useState(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        setProfile(snap.exists() ? snap.data() : null);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const isAdmin     = profile?.role === "admin";
  const isActive    = profile?.status === "active" || profile?.role === "admin";
  const isPending   = profile?.status === "pending";
  const isSuspended = profile?.status === "suspended";

  if (loading) {
    return (
      <div style={{ display:"flex", justifyContent:"center", alignItems:"center", height:"100vh", flexDirection:"column", gap:"14px" }}>
        <div style={{ width:"38px", height:"38px", border:"3px solid #E1F5EE", borderTop:"3px solid #1D9E75", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
        <p style={{ fontSize:"14px", color:"#aaa", margin:0 }}>Loading...</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin, isActive, isPending, isSuspended, setProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}