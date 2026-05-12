// src/components/DailyLearningCard.jsx
// Shown on the student home page — entry point to the daily learning module

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { todayString } from "../lib/dailyLearning";

export default function DailyLearningCard() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const [info,     setInfo]    = useState(null);
  const [loading,  setLoading] = useState(true);

  useEffect(() => {
    async function loadInfo() {
      try {
        const snap = await getDoc(doc(db, "dailyLearning", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setInfo({
            todayDone:   data.todayCompleted && data.lastSeenDate === todayString(),
            streak:      data.streak ?? 0,
            cycleDay:    data.cycleDay ?? 1,
            seenCount:   (data.seenQuestionIds ?? []).length,
          });
        }
      } catch (e) { /* first time — no doc yet */ }
      setLoading(false);
    }
    loadInfo();
  }, []);

  const isNew   = !info;
  const isDone  = info?.todayDone;

  return (
    <div style={{
      background: isDone
        ? "linear-gradient(135deg,#0F6E56,#1D9E75)"
        : "linear-gradient(135deg,#1a237e,#283593)",
      borderRadius:"16px", padding:"22px 24px", color:"white",
      cursor:"pointer", transition:"opacity 0.2s", marginBottom:"20px",
      position:"relative", overflow:"hidden",
    }}
      onClick={() => navigate("/daily")}
      onMouseEnter={e => e.currentTarget.style.opacity="0.92"}
      onMouseLeave={e => e.currentTarget.style.opacity="1"}
    >
      {/* Background decoration */}
      <div style={{ position:"absolute", right:"-20px", top:"-20px", width:"100px", height:"100px", borderRadius:"50%", background:"rgba(255,255,255,0.06)" }}/>
      <div style={{ position:"absolute", right:"20px", bottom:"-30px", width:"140px", height:"140px", borderRadius:"50%", background:"rgba(255,255,255,0.04)" }}/>

      <div style={{ position:"relative" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"12px" }}>
          <span style={{ fontSize:"24px" }}>{isDone ? "✅" : "📖"}</span>
          <div>
            <div style={{ fontWeight:"800", fontSize:"16px" }}>Daily Learning</div>
            <div style={{ fontSize:"11px", opacity:0.75 }}>
              {isDone ? "Completed today!" : isNew ? "Start your learning journey" : "20 new questions today"}
            </div>
          </div>
          {!isDone && (
            <div style={{ marginLeft:"auto", background:"rgba(255,255,255,0.2)", borderRadius:"999px", padding:"5px 14px", fontSize:"12px", fontWeight:"700" }}>
              Start →
            </div>
          )}
        </div>

        {!loading && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"8px" }}>
            {[
              { label:"Questions",  value: "20" },
              { label:"Streak",     value: info ? `${info.streak}d` : "0d" },
              { label:"Seen total", value: info ? `${info.seenCount}` : "0" },
            ].map(({ label, value }) => (
              <div key={label} style={{ background:"rgba(255,255,255,0.12)", borderRadius:"10px", padding:"10px 8px", textAlign:"center" }}>
                <div style={{ fontSize:"18px", fontWeight:"800", lineHeight:1 }}>{value}</div>
                <div style={{ fontSize:"10px", opacity:0.7, marginTop:"3px" }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {isDone && (
          <div style={{ marginTop:"12px", fontSize:"13px", opacity:0.85, display:"flex", alignItems:"center", gap:"6px" }}>
            <span>🔥</span>
            <span>{info.streak} day streak! Come back tomorrow for more.</span>
          </div>
        )}
      </div>
    </div>
  );
}