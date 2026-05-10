// src/components/AdminHome.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { validatePaperJSON, uploadPaperToFirestore } from "../lib/uploadPaper";
import {
  collection, getDocs, query, where,
  updateDoc, doc, deleteDoc
} from "firebase/firestore";
import { db } from "../firebase";

export default function AdminHome() {
  const { user } = useAuth();
  const [tab, setTab]           = useState("upload");
  const [dragging, setDragging] = useState(false);
  const [parsed, setParsed]     = useState(null);   // parsed JSON preview
  const [errors, setErrors]     = useState([]);
  const [uploading, setUploading] = useState(false);
  const [papers, setPapers]     = useState([]);

  useEffect(() => { loadPapers(); }, []);

  async function loadPapers() {
    const snap = await getDocs(collection(db, "papers"));
    setPapers(snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => b.year - a.year));
  }

  function handleFile(file) {
    if (!file || !file.name.endsWith(".json")) {
      alert("Please upload a .json file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const errs = validatePaperJSON(data);
        setErrors(errs);
        setParsed(errs.length === 0 ? data : null);
      } catch {
        setErrors(["Invalid JSON — could not parse file"]);
        setParsed(null);
      }
    };
    reader.readAsText(file);
  }

  async function handleUpload() {
    if (!parsed) return;
    setUploading(true);
    try {
      await uploadPaperToFirestore(parsed, user.uid);
      alert(`✅ "${parsed.meta.title}" uploaded successfully!`);
      setParsed(null);
      setErrors([]);
      loadPapers();
      setTab("manage");
    } catch (err) {
      alert("Upload failed: " + err.message);
    }
    setUploading(false);
  }

  async function toggleVisibility(paper) {
    await updateDoc(doc(db, "papers", paper.id), { isActive: !paper.isActive });
    loadPapers();
  }

  async function handleDelete(paper) {
    if (!window.confirm(`Delete "${paper.title}"? This cannot be undone.`)) return;
    await deleteDoc(doc(db, "papers", paper.id));
    loadPapers();
  }

  const s = (style) => style; // passthrough for readability

  return (
    <div>
      {/* Tabs */}
      <div style={s({ display:"flex", borderBottom:"0.5px solid #e0e0e0", marginBottom:"20px" })}>
        {[["upload","Upload paper"],["manage","Manage papers"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={s({
            padding:"10px 18px", border:"none", background:"transparent", cursor:"pointer",
            fontSize:"13px", fontWeight: tab===key ? "500" : "400",
            color: tab===key ? "#1D9E75" : "#888",
            borderBottom: tab===key ? "2px solid #1D9E75" : "2px solid transparent",
          })}>{label}</button>
        ))}
      </div>

      {tab === "upload" && (
        <div>
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => document.getElementById("json-input").click()}
            style={s({
              border: `1.5px dashed ${dragging ? "#1D9E75" : "#ccc"}`,
              background: dragging ? "#E1F5EE" : "#fafafa",
              borderRadius:"12px", padding:"32px", textAlign:"center", cursor:"pointer",
              marginBottom:"16px",
            })}
          >
            <div style={s({ fontSize:"28px", marginBottom:"8px" })}>📂</div>
            <div style={s({ fontWeight:"500", marginBottom:"4px" })}>
              {parsed ? parsed.meta.title : "Drop JSON file here or click to browse"}
            </div>
            <div style={s({ fontSize:"12px", color:"#888" })}>One file per paper · must match Kerala SET JSON schema</div>
            <input
              id="json-input" type="file" accept=".json"
              style={s({ display:"none" })}
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div style={s({ background:"#FCEBEB", border:"1px solid #F09595", borderRadius:"10px", padding:"14px", marginBottom:"16px" })}>
              <div style={s({ fontWeight:"500", color:"#A32D2D", marginBottom:"8px" })}>
                {errors.length} error{errors.length > 1 ? "s" : ""} found — fix the JSON and re-upload
              </div>
              {errors.map((e, i) => (
                <div key={i} style={s({ fontSize:"13px", color:"#791F1F" })}>• {e}</div>
              ))}
            </div>
          )}

          {/* Preview */}
          {parsed && (
            <div style={s({ border:"1px solid #e0e0e0", borderRadius:"12px", padding:"16px", marginBottom:"16px" })}>
              <div style={s({ fontWeight:"500", marginBottom:"12px" })}>Preview — {parsed.questions.length} questions</div>
              <div style={s({ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"8px", marginBottom:"14px" })}>
                {[
                  ["Paper",    parsed.meta.paperType.replace("PAPER_","Paper ")],
                  ["Subject",  parsed.meta.subject],
                  ["Year",     parsed.meta.year],
                  ["Questions",parsed.questions.length],
                ].map(([label, val]) => (
                  <div key={label} style={s({ background:"#f5f5f5", borderRadius:"8px", padding:"10px" })}>
                    <div style={s({ fontSize:"11px", color:"#888" })}>{label}</div>
                    <div style={s({ fontWeight:"500", marginTop:"2px" })}>{val}</div>
                  </div>
                ))}
              </div>

              {/* First 3 questions */}
              <div style={s({ border:"1px solid #eee", borderRadius:"8px", overflow:"hidden", marginBottom:"12px" })}>
                <div style={s({ display:"grid", gridTemplateColumns:"36px 1fr 60px", padding:"8px 12px",
                  background:"#fafafa", fontSize:"11px", color:"#888", fontWeight:"500",
                  borderBottom:"1px solid #eee" })}>
                  <span>#</span><span>Question</span><span>Answer</span>
                </div>
                {parsed.questions.slice(0, 3).map((q, i) => (
                  <div key={i} style={s({ display:"grid", gridTemplateColumns:"36px 1fr 60px",
                    padding:"9px 12px", fontSize:"12px", borderBottom:"1px solid #eee" })}>
                    <span style={s({ color:"#aaa" })}>{q.number ?? i+1}</span>
                    <span style={s({ color:"#444" })}>{q.text.slice(0, 60)}...</span>
                    <span style={s({ fontWeight:"600", color:"#1D9E75" })}>{q.correctAnswer}</span>
                  </div>
                ))}
              </div>
              <div style={s({ fontSize:"12px", color:"#888", marginBottom:"12px" })}>
                Showing 3 of {parsed.questions.length} · all valid ✓
              </div>
              <div style={s({ display:"flex", gap:"8px" })}>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  style={s({ padding:"10px 20px", borderRadius:"8px", border:"none",
                    background: uploading ? "#ccc" : "#1D9E75", color:"white",
                    cursor: uploading ? "not-allowed" : "pointer", fontWeight:"500" })}
                >
                  {uploading ? "Uploading..." : `Upload ${parsed.questions.length} questions`}
                </button>
                <button
                  onClick={() => { setParsed(null); setErrors([]); }}
                  style={s({ padding:"10px 16px", borderRadius:"8px",
                    border:"1px solid #ddd", background:"white", cursor:"pointer" })}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Schema reference */}
          <div style={s({ background:"#1a1a2e", borderRadius:"10px", padding:"16px",
            fontFamily:"monospace", fontSize:"12px", color:"#a8d8a8", lineHeight:"1.8" })}>
            <div style={s({ color:"#888", marginBottom:"8px", fontFamily:"sans-serif", fontSize:"11px" })}>
              Expected JSON format
            </div>
{`{
  "meta": {
    "title": "Kerala SET 2023 — Paper 2 English",
    "year": 2023,
    "paperType": "PAPER_2",
    "subject": "English Literature",
    "durationMinutes": 120
  },
  "questions": [
    {
      "number": 1,
      "text": "Britain entered World War I to defend:",
      "options": { "A": "Belgium", "B": "France", "C": "Serbia", "D": "Russia" },
      "correctAnswer": "A"
    }
  ]
}`}
          </div>
        </div>
      )}

      {tab === "manage" && (
        <div>
          <div style={s({ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" })}>
            <span style={s({ fontWeight:"500" })}>{papers.length} paper{papers.length !== 1 ? "s" : ""} uploaded</span>
            <button onClick={() => setTab("upload")}
              style={s({ padding:"8px 14px", borderRadius:"8px", border:"none",
                background:"#1D9E75", color:"white", cursor:"pointer", fontSize:"13px" })}>
              + Add paper
            </button>
          </div>
          {papers.length === 0 && (
            <p style={s({ color:"#aaa", textAlign:"center", padding:"32px" })}>No papers yet. Upload one!</p>
          )}
          {papers.map(p => (
            <div key={p.id} style={s({ border:"1px solid #eee", borderRadius:"10px",
              padding:"14px 16px", marginBottom:"8px", display:"flex",
              alignItems:"center", gap:"12px",
              opacity: p.isActive ? 1 : 0.5 })}>
              <div style={s({ flex:1 })}>
                <div style={s({ display:"flex", gap:"6px", marginBottom:"6px" })}>
                  <span style={s({ background: p.paperType==="PAPER_1" ? "#E6F1FB" : "#E1F5EE",
                    color: p.paperType==="PAPER_1" ? "#0C447C" : "#085041",
                    fontSize:"10px", fontWeight:"500", padding:"2px 8px", borderRadius:"999px" })}>
                    {p.paperType.replace("_"," ")}
                  </span>
                  <span style={s({ background:"#F1EFE8", color:"#444", fontSize:"10px",
                    fontWeight:"500", padding:"2px 8px", borderRadius:"999px" })}>{p.year}</span>
                  {!p.isActive && (
                    <span style={s({ background:"#FAEEDA", color:"#633806", fontSize:"10px",
                      fontWeight:"500", padding:"2px 8px", borderRadius:"999px" })}>Hidden</span>
                  )}
                </div>
                <div style={s({ fontWeight:"500", fontSize:"14px" })}>{p.subject}</div>
                <div style={s({ fontSize:"11px", color:"#888", marginTop:"2px" })}>
                  {p.totalQuestions} questions · {p.durationMinutes} min
                </div>
              </div>
              <button onClick={() => toggleVisibility(p)}
                style={s({ padding:"6px 12px", borderRadius:"6px", border:"1px solid #ddd",
                  background:"white", cursor:"pointer", fontSize:"12px" })}>
                {p.isActive ? "Hide" : "Show"}
              </button>
              <button onClick={() => handleDelete(p)}
                style={s({ padding:"6px 12px", borderRadius:"6px", border:"1px solid #fcc",
                  background:"#fff5f5", color:"#c00", cursor:"pointer", fontSize:"12px" })}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}