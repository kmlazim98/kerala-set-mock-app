// src/pages/Home.jsx
import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import StudentHome from "../components/StudentHome";
import AdminHome from "../components/AdminHome";

export default function Home() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const [role, setRole] = useState(null);

  useEffect(() => {
    async function loadRole() {
      const snap = await getDoc(doc(db, "users", user.uid));
      setRole(snap.data()?.role ?? "student");
    }
    loadRole();
  }, []);

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  if (!role) return (
    <div style={{ display:"flex", justifyContent:"center", alignItems:"center", height:"100vh" }}>
      <p>Loading...</p>
    </div>
  );

  return (
    <div style={{ maxWidth:"720px", margin:"0 auto", padding:"24px 16px" }}>
      {/* Top bar */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#1D9E75" }}/>
          <span style={{ fontWeight:"600", fontSize:"16px" }}>Kerala SET prep</span>
          {role === "admin" && (
            <span style={{ background:"#FAECE7", color:"#712B13", fontSize:"10px",
              fontWeight:"500", padding:"2px 8px", borderRadius:"999px" }}>Admin</span>
          )}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <span style={{ fontSize:"13px", color:"#888" }}>{user.displayName?.split(" ")[0]}</span>
          <button onClick={handleLogout} style={{ padding:"6px 14px", borderRadius:"8px",
            border:"1px solid #ddd", background:"white", cursor:"pointer", fontSize:"12px" }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Role-based content */}
      {role === "admin" ? <AdminHome /> : <StudentHome />}
    </div>
  );
}