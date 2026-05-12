import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchActivePapers } from "../lib/uploadPaper";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import DailyLearningCard from "./DailyLearningCard";

const PARTS = 4;

export default function StudentHome() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [papers, setPapers] = useState([]);
  const [attempts, setAttempts] = useState({});
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const ps = await fetchActivePapers();
      setPapers(ps);

      const snap = await getDocs(
        query(collection(db, "attemptedQuizzes"),
          where("userId", "==", user.uid),
          where("status", "==", "SUBMITTED"))
      );

      const all = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.submittedAt?.seconds ?? 0) - (a.submittedAt?.seconds ?? 0));

      setHistory(all.slice(0, 5));

      const map = {};
      all.forEach(d => {
        if (!d.paperId) return;
        const n = d.partNumber ?? 0;
        const key = `${d.paperId}_part${n}`;
        if (map[key] === undefined || d.score.percentage > map[key]) {
          map[key] = d.score.percentage;
        }
      });
      setAttempts(map);
      setLoading(false);
    }
    load();
  }, [user.uid]);

  // Performance calculations
  const allScores = Object.values(attempts);
  const totalTests = allScores.length;
  const bestScore = totalTests ? Math.max(...allScores) : null;
  const avgScore = totalTests ? Math.round(allScores.reduce((a, b) => a + b, 0) / totalTests) : null;

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "40vh" }}>
      <div className="spinner" />
    </div>
  );

  return (
    <div className="student-dashboard">
      
      {/* 1. Profile Section */}
      <section className="glass-card" style={{ marginBottom: '30px' }}>
        <h2 style={{ color: 'var(--accent-color)', fontSize: '18px', marginBottom: '20px' }}>Student Profile</h2>
        <div className="profile-info-grid">
          <div className="input-group">
            <label>Full Name</label>
            <input 
              type="text" 
              defaultValue={profile?.displayName || user?.displayName || ""} 
              placeholder="Your Name"
            />
          </div>
          <div className="input-group">
            <label>Email Address</label>
            <input 
              type="email" 
              value={user?.email || ""} 
              disabled 
              style={{ background: '#f0f0f0', cursor: 'not-allowed' }}
            />
          </div>
        </div>
        <button className="btn-primary" style={{ marginTop: '20px' }}>Update Profile</button>
      </section>

      {/* 2. Performance Stats Section (Dynamic) */}
      {totalTests > 0 && (
        <div className="glass-card" style={{ marginBottom: '30px', background: 'linear-gradient(135deg, #1a237e, #283593)', color: 'white' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '800' }}>{totalTests}</div>
              <div style={{ fontSize: '12px', opacity: 0.8 }}>Tests Taken</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '800' }}>{bestScore}%</div>
              <div style={{ fontSize: '12px', opacity: 0.8 }}>Best Score</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '800' }}>{avgScore}%</div>
              <div style={{ fontSize: '12px', opacity: 0.8 }}>Average</div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Action Cards */}
      <div className="dashboard-grid" style={{ marginBottom: '40px' }}>
        
        {/* Practice Test Card */}
        <div className="glass-card action-card">
          <div className="icon-circle">📝</div>
          <h3>Practice Test</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '10px 0 20px' }}>
            Access Kerala SET English previous year questions and subject-wise mock exams.
          </p>
          <button 
            className="btn-primary" 
            style={{ width: '100%' }}
            onClick={() => {
              // Automatically scrolls user to the paper list below or opens first paper
              document.getElementById('paper-list').scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Start Practice
          </button>
        </div>

        {/* Daily Learning Card (Component) */}
        <DailyLearningCard />

      </div>

      {/* 4. Active Papers List */}
      <div id="paper-list">
        <h3 style={{ marginBottom: '20px', fontSize: '16px', color: 'var(--text-muted)' }}>Available Question Papers</h3>
        {papers.map(paper => (
          <div key={paper.id} className="glass-card" style={{ marginBottom: '15px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: '700' }}>{paper.subject}</span>
                <span style={{ marginLeft: '10px', fontSize: '12px', color: '#888' }}>{paper.year}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {Array.from({ length: PARTS }, (_, i) => {
                  const s = attempts[`${paper.id}_part${i + 1}`];
                  return (
                    <div 
                      key={i} 
                      style={{ 
                        width: '10px', height: '10px', borderRadius: '50%', 
                        background: s !== undefined ? (s >= 55 ? "#2e7d32" : "#c62828") : "#ddd" 
                      }} 
                    />
                  );
                })}
              </div>
            </div>
            
            {/* Quick Part Selection */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '15px' }}>
              {[1, 2, 3, 4].map(num => (
                <button
                  key={num}
                  className="btn-secondary"
                  style={{ fontSize: '11px', padding: '8px' }}
                  onClick={() => navigate(`/quiz/${paper.id}/part/${num}`)}
                >
                  Part {num}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}