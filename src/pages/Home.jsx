import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import StudentHome from "../components/StudentHome";
import AdminHome from "../components/AdminHome";

export default function Home() {
  const { user, profile, isAdmin } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  return (
    <div style={{ maxWidth:"780px", margin:"0 auto", padding:"24px 20px", fontFamily:"system-ui,-apple-system,sans-serif" }}>

      {/* Top bar */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"28px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#1D9E75" }}/>
          <span style={{ fontWeight:"800", fontSize:"17px", color:"#111" }}>Kerala SET prep</span>
          {isAdmin && (
            <span style={{ background:"#FAECE7", color:"#712B13", fontSize:"10px", fontWeight:"700", padding:"3px 10px", borderRadius:"999px" }}>
              Admin
            </span>
          )}
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
          {/* User avatar */}
          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" width="30" height="30" style={{ borderRadius:"50%", objectFit:"cover" }}/>
            ) : (
              <div style={{ width:"30px", height:"30px", borderRadius:"50%", background:"#E1F5EE", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px", fontWeight:"700", color:"#085041" }}>
                {profile?.displayName?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
            <span style={{ fontSize:"13px", color:"#888" }}>{profile?.displayName?.split(" ")[0]}</span>
          </div>

          <button
            onClick={handleLogout}
            style={{ padding:"7px 16px", borderRadius:"8px", border:"1.5px solid #eee", background:"white", cursor:"pointer", fontSize:"13px", color:"#666", fontWeight:"500" }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Role-based content */}
      {isAdmin ? <AdminHome /> : <StudentHome />}
    </div>
  );
}