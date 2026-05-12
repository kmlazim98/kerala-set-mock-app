// src/lib/dailyLearning.js
import {
  doc, getDoc, setDoc, updateDoc,
  collection, getDocs, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

const QUESTIONS_PER_SESSION = 20;
const MAX_SESSIONS_PER_DAY  = 5;
const CYCLE_DAYS            = 30;

export function todayString() {
  return new Date().toISOString().split("T")[0];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function fetchAllActiveQuestions() {
  const papersSnap = await getDocs(collection(db, "papers"));
  const activePapers = papersSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(p => p.isActive);

  const allQuestions = [];
  for (const paper of activePapers) {
    const qSnap = await getDocs(collection(db, "papers", paper.id, "questions"));
    qSnap.docs.forEach(d => {
      allQuestions.push({
        id: d.id, paperId: paper.id,
        paperTitle: paper.title, subject: paper.subject, year: paper.year,
        ...d.data(),
      });
    });
  }
  return allQuestions;
}

// ── Main entry point ──────────────────────────────────────────────────────────
export async function getDailySession(userId) {
  const ref   = doc(db, "dailyLearning", userId);
  const snap  = await getDoc(ref);
  const today = todayString();
  const allQs = await fetchAllActiveQuestions();

  if (allQs.length === 0) {
    return { error: "No questions available yet. Admin needs to upload papers." };
  }

  // ── Existing doc ────────────────────────────────────────────────────────────
  if (snap.exists()) {
    const data = snap.data();

    // Check 30-day cycle reset
    const cycleStart = data.cycleStartDate?.toDate?.() ?? new Date();
    const daysSince  = Math.floor((Date.now() - cycleStart.getTime()) / 86400000);
    if (daysSince >= CYCLE_DAYS) {
      return await startNewCycle(ref, userId, allQs, data.currentCycle ?? 1);
    }

    // Same day
    if (data.lastSeenDate === today) {
      const sessionsToday = data.sessionsToday ?? 1;
      const allDone       = sessionsToday >= MAX_SESSIONS_PER_DAY;

      const todayQs = await loadQuestionsById(data.todayQuestionIds ?? [], allQs);
      return {
        session:        data,
        todayQuestions: todayQs,
        totalAvailable: allQs.length,
        seenCount:      (data.seenQuestionIds ?? []).length,
        cycleDay:       daysSince + 1,
        cycleDays:      CYCLE_DAYS,
        sessionsToday,
        maxSessions:    MAX_SESSIONS_PER_DAY,
        allSessionsDone: allDone,
      };
    }

    // New day — reset daily sessions
    return await assignNewDay(ref, data, allQs, today, daysSince);
  }

  // ── First time ──────────────────────────────────────────────────────────────
  return await startNewCycle(ref, userId, allQs, 0);
}

// ── Start a new session (called when student clicks "Start next session") ─────
export async function startNextSession(userId) {
  const ref   = doc(db, "dailyLearning", userId);
  const snap  = await getDoc(ref);
  const today = todayString();
  const allQs = await fetchAllActiveQuestions();

  if (!snap.exists()) return { error: "Session not found." };

  const data          = snap.data();
  const sessionsToday = (data.sessionsToday ?? 1) + 1;

  if (sessionsToday > MAX_SESSIONS_PER_DAY) {
    return { error: "Max sessions for today reached." };
  }

  const seen   = data.seenQuestionIds ?? [];
  const allIds = allQs.map(q => q.id);
  let unseen   = allIds.filter(id => !seen.includes(id));

  if (unseen.length < QUESTIONS_PER_SESSION) {
    const extra = shuffle(seen).slice(0, QUESTIONS_PER_SESSION - unseen.length);
    unseen = [...unseen, ...extra];
  }

  const todayIds = shuffle(unseen).slice(0, QUESTIONS_PER_SESSION);
  const newSeen  = [...new Set([...seen, ...todayIds])];

  await updateDoc(ref, {
    todayQuestionIds: todayIds,
    todayCompleted:   false,
    sessionsToday,
    seenQuestionIds:  newSeen,
  });

  const todayQs = await loadQuestionsById(todayIds, allQs);
  return {
    session:        { ...data, sessionsToday, todayQuestionIds: todayIds },
    todayQuestions: todayQs,
    totalAvailable: allQs.length,
    seenCount:      newSeen.length,
    cycleDay:       data.cycleDay ?? 1,
    cycleDays:      CYCLE_DAYS,
    sessionsToday,
    maxSessions:    MAX_SESSIONS_PER_DAY,
    allSessionsDone: sessionsToday >= MAX_SESSIONS_PER_DAY,
  };
}

async function assignNewDay(ref, data, allQs, today, daysSince) {
  const seen   = data.seenQuestionIds ?? [];
  const allIds = allQs.map(q => q.id);
  let unseen   = allIds.filter(id => !seen.includes(id));

  if (unseen.length < QUESTIONS_PER_SESSION) {
    const extra = shuffle(seen).slice(0, QUESTIONS_PER_SESSION - unseen.length);
    unseen = [...unseen, ...extra];
  }

  const todayIds = shuffle(unseen).slice(0, QUESTIONS_PER_SESSION);

  await updateDoc(ref, {
    lastSeenDate:     today,
    todayQuestionIds: todayIds,
    todayCompleted:   false,
    sessionsToday:    1,                          // reset to 1 each new day
    seenQuestionIds:  [...new Set([...seen, ...todayIds])],
    streak:           (data.streak ?? 0) + 1,
  });

  const todayQs = await loadQuestionsById(todayIds, allQs);
  return {
    session:        { ...data, lastSeenDate: today, todayQuestionIds: todayIds, sessionsToday: 1 },
    todayQuestions: todayQs,
    totalAvailable: allQs.length,
    seenCount:      [...new Set([...(data.seenQuestionIds ?? []), ...todayIds])].length,
    cycleDay:       daysSince + 1,
    cycleDays:      CYCLE_DAYS,
    sessionsToday:  1,
    maxSessions:    MAX_SESSIONS_PER_DAY,
    allSessionsDone: false,
  };
}

async function startNewCycle(ref, userId, allQs, prevCycle) {
  const today   = todayString();
  const todayIds = shuffle(allQs.map(q => q.id)).slice(0, QUESTIONS_PER_SESSION);

  const newData = {
    userId, currentCycle: prevCycle + 1,
    cycleStartDate: serverTimestamp(),
    lastSeenDate:   today,
    todayQuestionIds: todayIds,
    todayCompleted:   false,
    sessionsToday:    1,
    seenQuestionIds:  todayIds,
    streak:           1,
    updatedAt:        serverTimestamp(),
  };

  await setDoc(ref, newData);
  const todayQs = await loadQuestionsById(todayIds, allQs);
  return {
    session:        newData,
    todayQuestions: todayQs,
    totalAvailable: allQs.length,
    seenCount:      todayIds.length,
    cycleDay:       1,
    cycleDays:      CYCLE_DAYS,
    sessionsToday:  1,
    maxSessions:    MAX_SESSIONS_PER_DAY,
    allSessionsDone: false,
  };
}

export async function markSessionComplete(userId) {
  await updateDoc(doc(db, "dailyLearning", userId), {
    todayCompleted: true,
  });
}

// kept for backward compat
export const markDayComplete = markSessionComplete;

function loadQuestionsById(ids, allQs) {
  const map = {};
  allQs.forEach(q => { map[q.id] = q; });
  return ids.map(id => map[id]).filter(Boolean);
}