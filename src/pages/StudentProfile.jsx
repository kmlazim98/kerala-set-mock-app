import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  doc, getDoc, updateDoc, collection,
  addDoc, serverTimestamp, query, where, getDocs,
} from "firebase/firestore";
import { db } from "../firebase";

// ── Palette (mirrors AdminHome) ───────────────────────────────────────────────
const TEAL  = { bg: "#E1F5EE", border: "#9FE1CB", text: "#085041", mid: "#1D9E75" };
const AMBER = { bg: "#FAEEDA", border: "#FAC775", text: "#633806", mid: "#EF9F27" };
const RED   = { bg: "#FCEBEB", border: "#F7C1C1", text: "#A32D2D", mid: "#E24B4A" };
const BLUE  = { bg: "#E6F1FB", border: "#B5D4F4", text: "#0C447C", mid: "#378ADD" };

const STATUS = {
  pending:   { ...AMBER, label: "Pending"   },
  active:    { ...TEAL,  label: "Active"    },
  suspended: { ...RED,   label: "Suspended" },
};

// ── Reference data ────────────────────────────────────────────────────────────
const KERALA_DISTRICTS = [
  "Thiruvananthapuram", "Kollam", "Pathanamthitta", "Alappuzha",
  "Kottayam", "Idukki", "Ernakulam", "Thrissur", "Palakkad",
  "Malappuram", "Kozhikode", "Wayanad", "Kannur", "Kasaragod",
];

const QUALIFICATIONS = [
  "Bachelor's Degree", "Master's Degree", "M.Phil", "PhD",
  "NET Qualified", "JRF Qualified", "Other",
];

const PAPER_PREFS = [
  { value: "PAPER_1", label: "Paper 1 — General" },
  { value: "PAPER_2", label: "Paper 2 — Subject Specific" },
  { value: "BOTH",    label: "Both Papers" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = ts =>
  ts?.seconds
    ? new Date(ts.seconds * 1000).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
      })
    : "—";

// ── Tiny atoms ────────────────────────────────────────────────────────────────
function Badge({ scheme, children }) {
  return (
    <span style={{
      fontSize: "10px", fontWeight: "700", padding: "2px 9px",
      borderRadius: "999px", background: scheme.bg,
      color: scheme.text, border: `1px solid ${scheme.border}`,
      letterSpacing: "0.03em", whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

function Btn({ color, onClick, disabled, children, style = {} }) {
  const variants = {
    primary: { background: TEAL.mid,  color: "#fff",      border: "none" },
    danger:  { background: RED.bg,    color: RED.text,    border: `1px solid ${RED.border}` },
    ghost:   { background: "#f5f5f5", color: "#555",      border: "1px solid #e8e8e8" },
    navy:    { background: "#1a237e", color: "#fff",      border: "none" },
  };
  const v = variants[color ?? "ghost"];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...v, padding: "8px 16px", borderRadius: "9px",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: "13px", fontWeight: "600",
        opacity: disabled ? 0.55 : 1,
        lineHeight: "1.4", whiteSpace: "nowrap",
        transition: "opacity .15s",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  const isErr = toast.type === "error";
  return (
    <div style={{
      position: "fixed", bottom: "28px", left: "50%",
      transform: "translateX(-50%)",
      background: isErr ? RED.mid : TEAL.mid,
      color: "#fff", padding: "12px 24px",
      borderRadius: "12px", fontSize: "14px", fontWeight: "600",
      boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
      zIndex: 9999, pointerEvents: "none",
      animation: "slideUp .25s ease",
    }}>
      {isErr ? "✗ " : "✓ "}{toast.msg}
      <style>{`@keyframes slideUp { from { opacity:0; transform:translateX(-50%) translateY(12px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }`}</style>
    </div>
  );
}

// ── Attempt row ───────────────────────────────────────────────────────────────
function AttemptRow({ attempt }) {
  const pct    = attempt.score?.percentage ?? 0;
  const passed = pct >= 55;
  const sc     = passed ? TEAL : RED;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "12px",
      padding: "10px 14px", background: "#fff",
      borderRadius: "10px", border: "1px solid #eef2ee",
    }}>
      <div style={{
        width: "40px", height: "40px", borderRadius: "50%",
        background: sc.bg, border: `1.5px solid ${sc.border}`,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <span style={{ fontSize: "11px", fontWeight: "800", color: sc.text }}>{pct}%</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "12px", fontWeight: "600", color: "#333" }}>
          {attempt.paperTitle ?? "Mock test"}
          {attempt.partNumber && (
            <span style={{ marginLeft: "6px", fontSize: "10px", background: TEAL.bg, color: TEAL.text, border: `1px solid ${TEAL.border}`, borderRadius: "999px", padding: "1px 7px", fontWeight: "700" }}>
              Part {attempt.partNumber}
            </span>
          )}
        </div>
        <div style={{ fontSize: "11px", color: "#bbb", marginTop: "2px" }}>
          {attempt.score?.correct ?? 0} correct · {attempt.score?.incorrect ?? 0} wrong · {attempt.score?.skipped ?? 0} skipped · {fmtDate(attempt.submittedAt)}
        </div>
      </div>
      <Badge scheme={sc}>{passed ? "Passed" : "Failed"}</Badge>
    </div>
  );
}

// ── Field display / input ─────────────────────────────────────────────────────
function Field({ label, value, editing, children }) {
  return (
    <div>
      <div style={{ fontSize: "11px", fontWeight: "700", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "5px" }}>
        {label}
      </div>
      {editing ? children : (
        <div style={{ fontSize: "14px", color: value ? "#111" : "#ccc", fontWeight: value ? "500" : "400" }}>
          {value || "Not set"}
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "9px 12px", borderRadius: "9px",
  border: "1.5px solid #e8eee8", fontSize: "13px",
  fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  background: "#fff",
};

const selectStyle = { ...inputStyle, cursor: "pointer", background: "#fff" };

// ── Main page ─────────────────────────────────────────────────────────────────
export default function StudentProfile() {
  const { id }             = useParams();
  const { user: adminUser, isAdmin } = useAuth();
  const navigate           = useNavigate();

  const [student,  setStudent]  = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState(null);
  const [form,     setForm]     = useState({});

  useEffect(() => { load(); }, [id]);

  // Guard: non-admin users get sent home
  useEffect(() => {
    if (adminUser && !isAdmin) navigate("/");
  }, [adminUser]);

  async function load() {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "users", id));
      if (!snap.exists()) { navigate("/"); return; }
      const data = { id: snap.id, ...snap.data() };
      setStudent(data);
      setForm(toForm(data));

      const attSnap = await getDocs(
        query(collection(db, "attemptedQuizzes"), where("userId", "==", id), where("status", "==", "SUBMITTED"))
      );
      setAttempts(
        attSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.submittedAt?.seconds ?? 0) - (a.submittedAt?.seconds ?? 0))
      );
    } catch (err) {
      console.error("StudentProfile load error:", err);
    }
    setLoading(false);
  }

  function toForm(data) {
    return {
      displayName:     data.displayName     ?? "",
      phoneNumber:     data.phoneNumber     ?? "",
      qualification:   data.qualification   ?? "",
      institution:     data.institution     ?? "",
      district:        data.district        ?? "",
      paperPreference: data.paperPreference ?? "",
    };
  }

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  async function handleSave() {
    setSaving(true);
    try {
      const changes = Object.keys(form)
        .filter(k => (form[k] ?? "") !== (student[k] ?? ""))
        .map(k => ({ field: k, from: student[k] ?? "", to: form[k] }));

      await updateDoc(doc(db, "users", id), { ...form, updatedAt: serverTimestamp() });

      await addDoc(collection(db, "adminLogs"), {
        adminId:      adminUser.uid,
        targetUserId: id,
        action:       "EDIT_PROFILE",
        timestamp:    serverTimestamp(),
        changes,
      });

      setStudent(prev => ({ ...prev, ...form }));
      setEditing(false);
      showToast("Information saved");
    } catch (err) {
      showToast("Save failed: " + err.message, "error");
    }
    setSaving(false);
  }

  function handleCancel() { setForm(toForm(student)); setEditing(false); }

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const sc        = STATUS[student?.status] ?? STATUS.pending;
  const initials  = student?.displayName?.[0]?.toUpperCase() ?? "?";
  const scores    = attempts.map(a => a.score?.percentage ?? 0);
  const best      = scores.length ? Math.max(...scores) : null;
  const avg       = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const passed    = attempts.filter(a => (a.score?.percentage ?? 0) >= 55).length;

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontFamily: "system-ui,sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid #E1F5EE", borderTop: `3px solid ${TEAL.mid}`, borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto 12px" }}/>
        <p style={{ color: "#bbb", fontSize: "13px" }}>Loading profile…</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );

  if (!student) return null;

  return (
    <div style={{ fontFamily: "system-ui,-apple-system,sans-serif", color: "#111", minHeight: "100vh", background: "#f4f7f4" }}>

      {/* ── Top bar ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #eef2ee", padding: "0 28px", height: "54px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => navigate("/")}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "#999", padding: "4px", lineHeight: 1 }}
          >
            ←
          </button>
          <span style={{ fontSize: "14px", fontWeight: "700", color: "#111" }}>Student Profile</span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {!editing ? (
            <Btn color="navy" onClick={() => setEditing(true)}>✎ Edit profile</Btn>
          ) : (
            <>
              <Btn color="ghost"   onClick={handleCancel}            disabled={saving}>Cancel</Btn>
              <Btn color="primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Btn>
            </>
          )}
        </div>
      </div>

      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "28px 20px" }}>

        {/* ── Profile hero card ── */}
        <div style={{ background: "#fff", border: "1px solid #eef2ee", borderRadius: "16px", padding: "28px", marginBottom: "20px", display: "flex", gap: "20px", alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Avatar */}
          <div style={{
            width: "72px", height: "72px", borderRadius: "50%",
            background: sc.bg, border: `2px solid ${sc.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "28px", fontWeight: "800", color: sc.text, flexShrink: 0,
          }}>
            {initials}
          </div>

          {/* Identity */}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "20px", fontWeight: "800", color: "#111" }}>
                {student.displayName ?? "Unknown"}
              </span>
              <Badge scheme={sc}>{sc.label}</Badge>
            </div>
            <div style={{ fontSize: "13px", color: "#aaa", marginBottom: "16px" }}>
              {student.email} · Joined {fmtDate(student.createdAt)}
              {student.updatedAt && <span> · Last updated {fmtDate(student.updatedAt)}</span>}
            </div>

            {/* Quick stats */}
            <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
              {[
                { val: attempts.length, label: "Attempts" },
                { val: passed,          label: "Passed",  color: TEAL.text },
                { val: best != null ? `${best}%` : "—",   label: "Best",    color: best != null ? (best >= 55 ? TEAL.text : RED.text) : "#aaa" },
                { val: avg  != null ? `${avg}%`  : "—",   label: "Average" },
              ].map(({ val, label, color }) => (
                <div key={label}>
                  <div style={{ fontSize: "20px", fontWeight: "800", color: color ?? "#555" }}>{val}</div>
                  <div style={{ fontSize: "11px", color: "#bbb", fontWeight: "500" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Profile fields ── */}
        <div style={{ background: "#fff", border: "1px solid #eef2ee", borderRadius: "16px", marginBottom: "20px", overflow: "hidden" }}>
          {/* Section header */}
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #f0f5f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "13px", fontWeight: "700", color: "#333", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Profile details
            </span>
            {editing && (
              <span style={{ fontSize: "11px", color: TEAL.mid, fontWeight: "600" }}>Editing — fill in any field and click Save</span>
            )}
          </div>

          <div style={{ padding: "24px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "24px" }}>

            {/* Full Name */}
            <Field label="Full Name" value={student.displayName} editing={editing}>
              <input
                style={inputStyle}
                value={form.displayName}
                onChange={e => set("displayName", e.target.value)}
                placeholder="Full name"
              />
            </Field>

            {/* Email — always read-only */}
            <Field label="Email" value={student.email} editing={false} />

            {/* Phone */}
            <Field label="Phone Number" value={student.phoneNumber} editing={editing}>
              <input
                style={inputStyle}
                type="tel"
                value={form.phoneNumber}
                onChange={e => set("phoneNumber", e.target.value)}
                placeholder="+91 98765 43210"
              />
            </Field>

            {/* Qualification */}
            <Field label="Educational Qualification" value={student.qualification} editing={editing}>
              <select style={selectStyle} value={form.qualification} onChange={e => set("qualification", e.target.value)}>
                <option value="">Select qualification</option>
                {QUALIFICATIONS.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </Field>

            {/* Institution */}
            <Field label="Institution" value={student.institution} editing={editing}>
              <input
                style={inputStyle}
                value={form.institution}
                onChange={e => set("institution", e.target.value)}
                placeholder="College / University name"
              />
            </Field>

            {/* District */}
            <Field label="District" value={student.district} editing={editing}>
              <select style={selectStyle} value={form.district} onChange={e => set("district", e.target.value)}>
                <option value="">Select district</option>
                {KERALA_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>

            {/* Paper Preference */}
            <Field
              label="Kerala SET Paper Preference"
              value={PAPER_PREFS.find(p => p.value === student.paperPreference)?.label}
              editing={editing}
            >
              <select style={selectStyle} value={form.paperPreference} onChange={e => set("paperPreference", e.target.value)}>
                <option value="">Select preference</option>
                {PAPER_PREFS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Field>

            {/* UID — always read-only */}
            <Field label="User ID" value={student.id} editing={false}>
              <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#888", wordBreak: "break-all" }}>{student.id}</span>
            </Field>

          </div>

          {/* Save / Cancel bar inside card (visible in edit mode) */}
          {editing && (
            <div style={{ padding: "16px 24px", borderTop: "1px solid #f0f5f0", background: "#fafcfa", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <Btn color="ghost"   onClick={handleCancel} disabled={saving}>Cancel</Btn>
              <Btn color="primary" onClick={handleSave}   disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Btn>
            </div>
          )}
        </div>

        {/* ── Attempt history ── */}
        <div style={{ background: "#fff", border: "1px solid #eef2ee", borderRadius: "16px", overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #f0f5f0" }}>
            <span style={{ fontSize: "13px", fontWeight: "700", color: "#333", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Attempt history ({attempts.length})
            </span>
          </div>
          <div style={{ padding: "16px 20px" }}>
            {attempts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "#ccc" }}>
                <div style={{ fontSize: "28px", marginBottom: "8px" }}>📝</div>
                <p style={{ fontSize: "13px" }}>No attempts yet</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {attempts.slice(0, 15).map(a => <AttemptRow key={a.id} attempt={a} />)}
                {attempts.length > 15 && (
                  <p style={{ fontSize: "12px", color: "#bbb", textAlign: "center", margin: "4px 0 0" }}>
                    +{attempts.length - 15} more attempts
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      <Toast toast={toast} />
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );
}
