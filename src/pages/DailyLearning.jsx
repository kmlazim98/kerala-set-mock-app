// src/pages/DailyHome.jsx
// Shows today's 5 sessions — student picks which to start or continue

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getTodaySessions, MAX_SESSIONS_PER_DAY, QUESTIONS_PER_SESSION } from "../lib/dailyLearning";

export default function DailyLearning() {
  const { user }     = useAuth();
  const navigate     = useNavigate();
  const [data,       setData]    = useState(null);
  const [loading,    setLoading] = useState(true);
  const [error,      setError]   = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await getTodaySessions(user.uid);
        if (res.error) { setError(res.error); setLoading(false); return; }
        setData(res);
      } catch (err) { setError(err.message); }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", gap:"14px", background:"#f4f7f4", fontFamily:"system-ui,-apple-system,sans-serif" }}>
      <div style={{ width:"40px", height:"40px", border:"3px solid #E1F5EE", borderTop:"3px solid #1D9E75", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
      <p style={{ color:"#1D9E75", fontWeight:"600", margin:0 }}>Loading today's plan...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );

  if (error) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", gap:"14px", fontFamily:"system-ui,-apple-system,sans-serif" }}>
      <p style={{ color:"#E24B4A", fontWeight:"600" }}>{error}</p>
      <button onClick={() => navigate("/")} style={{ padding:"10px 20px", borderRadius:"8px", border:"none", background:"#1D9E75", color:"white", cursor:"pointer" }}>← Home</button>
    </div>
  );
 
  const { sessions, progress, cycleDay, totalQs } = data;
  const completedToday = sessions.filter(s => s.completed).length;
  const seenPct = totalQs > 0 ? Math.round((progress.seenQuestionIds?.length ?? 0) / totalQs * 100) : 0;

  return (
    <div style={{ minHeight:"100vh", background:"#f4f7f4", fontFamily:"system-ui,-apple-system,sans-serif" }}>

      {/* Top bar */}
      <div style={{ background:"white", borderBottom:"1px solid #e8eee8", padding:"0 20px", height:"54px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#1D9E75" }}/>
          <span style={{ fontWeight:"700", fontSize:"14px", color:"#111" }}>Daily Learning</span>
        </div>
        <button onClick={() => navigate("/")} style={{ padding:"7px 14px", borderRadius:"8px", border:"1.5px solid #eee", background:"white", cursor:"pointer", fontSize:"12px", color:"#888" }}>
          ← Home
        </button>
      </div>

      <div style={{ maxWidth:"600px", margin:"0 auto", padding:"24px 20px" }}>

        {/* Header stats */}
        <div style={{ background:"linear-gradient(135deg,#1a237e,#283593)", borderRadius:"16px", padding:"22px 24px", color:"white", marginBottom:"20px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"16px" }}>
            <span style={{ fontSize:"26px" }}>📖</span>
            <div>
              <div style={{ fontWeight:"800", fontSize:"17px" }}>Today's Learning Plan</div>
              <div style={{ fontSize:"12px", opacity:0.75 }}>Day {cycleDay} of {data.cycleDays ?? 30} · 🔥 {progress.streak ?? 0} day streak</div>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"10px", marginBottom:"14px" }}>
            {[
              { label:"Sessions done",  value:`${completedToday}/${MAX_SESSIONS_PER_DAY}` },
              { label:"Questions today",value:`${completedToday * QUESTIONS_PER_SESSION}/${MAX_SESSIONS_PER_DAY * QUESTIONS_PER_SESSION}` },
              { label:"Total seen",     value:`${progress.seenQuestionIds?.length ?? 0}/${totalQs}` },
            ].map(({ label, value }) => (
              <div key={label} style={{ background:"rgba(255,255,255,0.12)", borderRadius:"10px", padding:"10px 8px", textAlign:"center" }}>
                <div style={{ fontSize:"16px", fontWeight:"800" }}>{value}</div>
                <div style={{ fontSize:"10px", opacity:0.7, marginTop:"2px" }}>{label}</div>
              </div>
            ))}
          </div>
          {/* Question pool progress */}
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:"11px", opacity:0.7, marginBottom:"4px" }}>
              <span>Question pool progress</span>
              <span>{seenPct}% seen</span>
            </div>
            <div style={{ height:"4px", borderRadius:"999px", background:"rgba(255,255,255,0.2)", overflow:"hidden" }}>
              <div style={{ height:"100%", background:"white", width:`${seenPct}%`, borderRadius:"999px", transition:"width 0.5s" }}/>
            </div>
            {seenPct >= 100 && (
              <p style={{ fontSize:"11px", opacity:0.8, marginTop:"6px" }}>🎉 All questions seen! Cycle resets in {30 - cycleDay} days.</p>
            )}
          </div>
        </div>

        {/* Session cards */}
        <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
          {sessions.map((session, idx) => {
            const num      = idx + 1;
            const exists   = session.exists !== false;
            const done     = session.completed;
            const inProg   = exists && !done && Object.keys(session.answers ?? {}).length > 0;
            const unlocked = session.unlocked !== false ||
                             (idx === 0) ||
                             sessions[idx-1]?.completed === true;
            const locked   = !unlocked && !exists && !done;

            // Score info
            const score     = session.score;
            const answered  = Object.keys(session.answers ?? {}).length;
            const scoreColor= score ? (score.percentage >= 55 ? "#1D9E75" : "#E24B4A") : "#888";

            return (
              <div
                key={num}
                onClick={() => !locked && navigate(`/daily/session/${num}`)}
                style={{
                  background:"white",
                  border: done
                    ? `2px solid ${score?.percentage >= 55 ? "#9FE1CB" : "#F7C1C1"}`
                    : inProg ? "2px solid #FAC775"
                    : "1.5px solid #eef2ee",
                  borderRadius:"14px",
                  padding:"18px 20px",
                  cursor: locked ? "not-allowed" : "pointer",
                  opacity: locked ? 0.45 : 1,
                  transition:"all 0.18s",
                  position:"relative",
                  overflow:"hidden",
                }}
                onMouseEnter={e => { if(!locked) { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 6px 20px rgba(0,0,0,0.07)"; }}}
                onMouseLeave={e => { e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="none"; }}
              >
                {/* Status ribbon */}
                {done && (
                  <div style={{ position:"absolute", top:0, right:0, background:score?.percentage>=55?"#1D9E75":"#E24B4A", color:"white", fontSize:"9px", fontWeight:"800", padding:"3px 10px", borderRadius:"0 12px 0 8px", letterSpacing:"0.05em" }}>
                    {score?.percentage >= 55 ? "PASSED" : "DONE"}
                  </div>
                )}
                {inProg && (
                  <div style={{ position:"absolute", top:0, right:0, background:"#BA7517", color:"white", fontSize:"9px", fontWeight:"800", padding:"3px 10px", borderRadius:"0 12px 0 8px", letterSpacing:"0.05em" }}>
                    IN PROGRESS
                  </div>
                )}

                <div style={{ display:"flex", alignItems:"center", gap:"14px" }}>
                  {/* Session number circle */}
                  <div style={{
                    width:"46px", height:"46px", borderRadius:"50%", flexShrink:0,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:"18px", fontWeight:"800",
                    background: done ? (score?.percentage>=55?"#E1F5EE":"#FCEBEB")
                               : inProg ? "#FAEEDA"
                               : locked ? "#f5f5f5" : "#f0f4f0",
                    color: done ? scoreColor : inProg ? "#BA7517" : locked ? "#ccc" : "#555",
                  }}>
                    {locked ? "🔒" : done ? (score?.percentage>=55?"✓":"✓") : num}
                  </div>

                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:"700", fontSize:"15px", color:"#111", marginBottom:"3px" }}>
                      Session {num}
                      {!exists && !done && !locked && (
                        <span style={{ marginLeft:"8px", fontSize:"11px", background:"#E1F5EE", color:"#085041", padding:"2px 8px", borderRadius:"999px", fontWeight:"600" }}>New</span>
                      )}
                    </div>
                    <div style={{ fontSize:"12px", color:"#aaa" }}>
                      {done
                        ? `${score?.correct ?? 0} correct · ${score?.wrong ?? 0} wrong · ${score?.percentage ?? 0}%`
                        : inProg
                        ? `${answered}/${QUESTIONS_PER_SESSION} answered — tap to continue`
                        : locked
                        ? `Complete session ${num-1} to unlock`
                        : `${QUESTIONS_PER_SESSION} random questions · ~10 min`
                      }
                    </div>
                  </div>

                  {/* Score or arrow */}
                  {done ? (
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ fontSize:"20px", fontWeight:"800", color:scoreColor }}>{score?.percentage ?? 0}%</div>
                      <div style={{ fontSize:"10px", color:"#aaa" }}>{score?.correct}/{QUESTIONS_PER_SESSION}</div>
                    </div>
                  ) : !locked && (
                    <div style={{ color:"#ccc", fontSize:"20px" }}>→</div>
                  )}
                </div>

                {/* Progress bar for in-progress */}
                {inProg && (
                  <div style={{ marginTop:"12px" }}>
                    <div style={{ height:"4px", borderRadius:"999px", background:"#f0f0f0", overflow:"hidden" }}>
                      <div style={{ height:"100%", background:"#BA7517", width:`${Math.round(answered/QUESTIONS_PER_SESSION*100)}%`, borderRadius:"999px" }}/>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {completedToday === MAX_SESSIONS_PER_DAY && (
          <div style={{ marginTop:"20px", background:"linear-gradient(135deg,#0F6E56,#1D9E75)", borderRadius:"14px", padding:"20px", color:"white", textAlign:"center" }}>
            <div style={{ fontSize:"36px", marginBottom:"8px" }}>🏆</div>
            <div style={{ fontWeight:"800", fontSize:"17px", marginBottom:"4px" }}>All done for today!</div>
            <div style={{ fontSize:"13px", opacity:0.85 }}>Come back tomorrow for 5 new sessions. 🔥 {progress.streak} day streak!</div>
          </div>
        )}
      </div>
    </div>
  );
}