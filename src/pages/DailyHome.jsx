// src/pages/DailyHome.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getTodaySessions, MAX_SESSIONS_PER_DAY, QUESTIONS_PER_SESSION } from "../lib/dailyLearning";
import { generateSessionPDF } from "../lib/generateSessionPDF";

export default function DailyHome() {
  const { user }     = useAuth();
  const navigate     = useNavigate();
  const [data,       setData]    = useState(null);
  const [loading,    setLoading] = useState(true);
  const [error,      setError]   = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

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
  }, [user.uid]);

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

  // PDF Generator Logic
  async function handleDownloadPDF(session, num) {
    setPdfLoading(true);
    try {
      await generateSessionPDF({
        sessionNumber: num,
        date: new Date().toISOString().split("T")[0],
        score: session.score,
        questions: session.questions ?? [], 
        answers: session.answers ?? {},
        subject: session.questions?.[0]?.subject ?? "General",
        year: session.questions?.[0]?.year ?? "",
        durationSeconds: session.durationSeconds ?? null,
      });
    } catch (err) {
      alert("PDF generation failed: " + err.message);
    }
    setPdfLoading(false);
  }

  return (
    <div style={{ minHeight:"100vh", background:"#f4f7f4", fontFamily:"system-ui,-apple-system,sans-serif" }}>

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

        <div style={{ background:"linear-gradient(135deg,#1a237e,#283593)", borderRadius:"16px", padding:"22px 24px", color:"white", marginBottom:"20px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"16px" }}>
            <span style={{ fontSize:"26px" }}>📖</span>
            <div>
              <div style={{ fontWeight:"800", fontSize:"17px" }}>Today's Learning Plan</div>
              <div style={{ fontSize:"12px", opacity:0.75 }}>Day {cycleDay} · 🔥 {progress.streak ?? 0} day streak</div>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"10px", marginBottom:"14px" }}>
            <StatBox label="Sessions" value={`${completedToday}/${MAX_SESSIONS_PER_DAY}`} />
            <StatBox label="Questions" value={`${completedToday * QUESTIONS_PER_SESSION}/${MAX_SESSIONS_PER_DAY * QUESTIONS_PER_SESSION}`} />
            <StatBox label="Total Seen" value={`${progress.seenQuestionIds?.length ?? 0}/${totalQs}`} />
          </div>
          <div style={{ height:"4px", borderRadius:"999px", background:"rgba(255,255,255,0.2)", overflow:"hidden" }}>
            <div style={{ height:"100%", background:"white", width:`${seenPct}%`, transition:"width 0.5s" }}/>
          </div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
          {sessions.map((session, idx) => {
            const num = idx + 1;
            const done = session.completed;
            const unlocked = idx === 0 || sessions[idx-1]?.completed;
            const locked = !unlocked && !done;
            const score = session.score;

            return (
              <div
                key={num}
                onClick={() => !locked && navigate(`/daily/session/${num}`)}
                style={{
                  background:"white",
                  border: done ? "2px solid #9FE1CB" : "1.5px solid #eef2ee",
                  borderRadius:"14px",
                  padding:"18px 20px",
                  cursor: locked ? "not-allowed" : "pointer",
                  opacity: locked ? 0.5 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}
              >
                <div style={{ display:"flex", alignItems:"center", gap: "14px" }}>
                  <div style={{ width:40, height:40, borderRadius:"50%", background:"#f0f4f0", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"bold" }}>
                    {locked ? "🔒" : num}
                  </div>
                  <div>
                    <div style={{ fontWeight:"700" }}>Session {num}</div>
                    <div style={{ fontSize:"12px", color:"#888" }}>
                      {done ? `Score: ${score?.percentage}%` : locked ? "Locked" : "Available"}
                    </div>
                  </div>
                </div>
                
                {done && (
                  <button 
                    disabled={pdfLoading}
                    onClick={(e) => { e.stopPropagation(); handleDownloadPDF(session, num); }}
                    style={{ background:"#1a237e", color:"white", border:"none", borderRadius:"6px", padding:"4px 8px", fontSize:"11px", cursor:"pointer" }}
                  >
                    {pdfLoading ? "..." : "PDF"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div style={{ background:"rgba(255,255,255,0.12)", borderRadius:"10px", padding:"10px 8px", textAlign:"center" }}>
      <div style={{ fontSize:"16px", fontWeight:"800" }}>{value}</div>
      <div style={{ fontSize:"10px", opacity:0.7 }}>{label}</div>
    </div>
  );
}