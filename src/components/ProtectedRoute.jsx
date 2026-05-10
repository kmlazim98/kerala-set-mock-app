import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, profile, isAdmin, isActive, isPending, isSuspended } = useAuth();
  const location = useLocation();

  // Not logged in → go to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Logged in but no Firestore profile yet (edge case) → loading
  if (profile === undefined) {
    return (
      <div style={{ display:"flex", justifyContent:"center", alignItems:"center", height:"100vh" }}>
        <p style={{ color:"#aaa" }}>Loading your profile...</p>
      </div>
    );
  }

  // Admin-only route accessed by non-admin
  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  // Suspended account
  if (isSuspended) {
    return <SuspendedScreen />;
  }

  // Pending approval — show waiting screen instead of the app
  if (isPending && !isAdmin) {
    return <PendingScreen user={user} />;
  }

  // Active student or admin — allow access
  return children;
}

// ── Pending approval screen ───────────────────────────────────────────────────
function PendingScreen({ user }) {
  async function handleSignOut() {
    await signOut(auth);
    window.location.href = "/login";
  }

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f4f7f4", fontFamily:"system-ui,-apple-system,sans-serif" }}>
      <div style={{ background:"white", border:"1px solid #e8eee8", borderRadius:"20px", padding:"52px 44px", textAlign:"center", maxWidth:"420px", width:"90%" }}>

        <div style={{ width:"64px", height:"64px", borderRadius:"50%", background:"#FAEEDA", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 24px", fontSize:"28px" }}>
          ⏳
        </div>

        <h1 style={{ fontSize:"22px", fontWeight:"800", color:"#111", marginBottom:"10px" }}>
          Awaiting Approval
        </h1>
        <p style={{ color:"#888", fontSize:"14px", lineHeight:"1.7", marginBottom:"28px" }}>
          Your account <strong style={{ color:"#333" }}>{user.email}</strong> has been registered and is waiting for admin approval. You'll get access once an admin activates your account.
        </p>

        <div style={{ background:"#f8fbf8", border:"1px solid #e8eee8", borderRadius:"12px", padding:"16px", marginBottom:"24px", textAlign:"left" }}>
          <p style={{ fontSize:"13px", fontWeight:"600", color:"#333", margin:"0 0 10px" }}>What happens next?</p>
          {[
            "Admin reviews your registration",
            "Your account gets activated",
            "Sign in again to access the app",
          ].map((step, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom: i < 2 ? "8px" : "0" }}>
              <div style={{ width:"22px", height:"22px", borderRadius:"50%", background:"#E1F5EE", color:"#085041", fontSize:"11px", fontWeight:"700", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{i+1}</div>
              <span style={{ fontSize:"13px", color:"#666" }}>{step}</span>
            </div>
          ))}
        </div>

        <button
          onClick={handleSignOut}
          style={{ width:"100%", padding:"12px", borderRadius:"10px", border:"1.5px solid #e0e0e0", background:"white", cursor:"pointer", fontSize:"14px", fontWeight:"600", color:"#666" }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

// ── Suspended screen ──────────────────────────────────────────────────────────
function SuspendedScreen() {
  async function handleSignOut() {
    await signOut(auth);
    window.location.href = "/login";
  }

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f4f7f4", fontFamily:"system-ui,-apple-system,sans-serif" }}>
      <div style={{ background:"white", border:"1px solid #F7C1C1", borderRadius:"20px", padding:"52px 44px", textAlign:"center", maxWidth:"400px", width:"90%" }}>
        <div style={{ width:"64px", height:"64px", borderRadius:"50%", background:"#FCEBEB", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 24px", fontSize:"28px" }}>
          🚫
        </div>
        <h1 style={{ fontSize:"22px", fontWeight:"800", color:"#E24B4A", marginBottom:"10px" }}>Account Suspended</h1>
        <p style={{ color:"#888", fontSize:"14px", lineHeight:"1.7", marginBottom:"24px" }}>
          Your account has been suspended. Please contact the administrator for more information.
        </p>
        <button onClick={handleSignOut} style={{ width:"100%", padding:"12px", borderRadius:"10px", border:"1.5px solid #e0e0e0", background:"white", cursor:"pointer", fontSize:"14px", fontWeight:"600", color:"#666" }}>
          Sign out
        </button>
      </div>
    </div>
  );
}