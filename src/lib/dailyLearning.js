import {
  doc, getDoc, setDoc, updateDoc,
  collection, getDocs, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

export const MAX_SESSIONS_PER_DAY = 5;
export const QUESTIONS_PER_SESSION = 20;
export const CYCLE_DAYS = 30;

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

// Build 5 session slot objects, each assigned 20 unique question IDs
function buildDaySessions(allQs, alreadySeen) {
  const allIds = allQs.map(q => q.id);
  let pool = shuffle(allIds.filter(id => !alreadySeen.includes(id)));
  const needed = MAX_SESSIONS_PER_DAY * QUESTIONS_PER_SESSION;

  if (pool.length < needed) {
    const extra = shuffle([...alreadySeen]).slice(0, needed - pool.length);
    pool = [...pool, ...extra];
  }

  return Array.from({ length: MAX_SESSIONS_PER_DAY }, (_, i) => ({
    questionIds: pool.slice(i * QUESTIONS_PER_SESSION, (i + 1) * QUESTIONS_PER_SESSION),
    answers:     {},
    completed:   false,
    score:       null,
  }));
}

export async function getTodaySessions(userId) {
  try {
    const ref   = doc(db, "dailyLearning", userId);
    const snap  = await getDoc(ref);
    const today = todayString();
    const allQs = await fetchAllActiveQuestions();

    if (allQs.length === 0) {
      return { error: "No questions available yet. Admin needs to upload papers." };
    }

    if (snap.exists()) {
      const data = snap.data();
      const cycleStart = data.cycleStartDate?.toDate?.() ?? new Date();
      const daysSince  = Math.floor((Date.now() - cycleStart.getTime()) / 86400000);

      if (daysSince >= CYCLE_DAYS) {
        return await startNewCycle(ref, userId, allQs, data.currentCycle ?? 1);
      }

      if (data.lastSeenDate === today) {
        let sessions = data.sessions ?? [];

        // Build sessions if missing or incomplete (handles old data migration)
        if (sessions.length < MAX_SESSIONS_PER_DAY) {
          sessions = buildDaySessions(allQs, data.seenQuestionIds ?? []);
          const newSeen = [...new Set([
            ...(data.seenQuestionIds ?? []),
            ...sessions.flatMap(s => s.questionIds),
          ])];
          await updateDoc(ref, { sessions, seenQuestionIds: newSeen });
        }

        return {
          sessions,
          progress:  data,
          totalQs:   allQs.length,
          cycleDay:  daysSince + 1,
          cycleDays: CYCLE_DAYS,
        };
      }

      return await assignNewDay(ref, data, allQs, today, daysSince);
    }

    return await startNewCycle(ref, userId, allQs, 0);

  } catch (err) {
    console.error("Error in getTodaySessions:", err);
    return { error: "Failed to load learning data." };
  }
}

async function startNewCycle(ref, userId, allQs, prevCycle) {
  const today    = todayString();
  const sessions = buildDaySessions(allQs, []);
  const seenIds  = sessions.flatMap(s => s.questionIds);

  const newData = {
    userId,
    currentCycle:    prevCycle + 1,
    cycleStartDate:  serverTimestamp(),
    lastSeenDate:    today,
    seenQuestionIds: seenIds,
    streak:          1,
    sessions,
    updatedAt:       serverTimestamp(),
  };

  await setDoc(ref, newData);
  return {
    sessions,
    progress:  newData,
    totalQs:   allQs.length,
    cycleDay:  1,
    cycleDays: CYCLE_DAYS,
  };
}

async function assignNewDay(ref, data, allQs, today, daysSince) {
  const sessions = buildDaySessions(allQs, data.seenQuestionIds ?? []);
  const newSeen  = [...new Set([
    ...(data.seenQuestionIds ?? []),
    ...sessions.flatMap(s => s.questionIds),
  ])];

  const update = {
    lastSeenDate:    today,
    seenQuestionIds: newSeen,
    streak:          (data.streak ?? 0) + 1,
    sessions,
  };

  await updateDoc(ref, update);
  return {
    sessions,
    progress:  { ...data, ...update },
    totalQs:   allQs.length,
    cycleDay:  daysSince + 1,
    cycleDays: CYCLE_DAYS,
  };
}

// Save answers mid-session (called on each answer)
export async function saveSessionAnswers(userId, sessionIndex, answers) {
  const ref  = doc(db, "dailyLearning", userId);
  const snap = await getDoc(ref);
  const sessions = [...(snap.data().sessions ?? [])];
  sessions[sessionIndex] = { ...sessions[sessionIndex], answers };
  await updateDoc(ref, { sessions });
}

// Mark session complete with final score
export async function completeSession(userId, sessionIndex, answers, score) {
  const ref  = doc(db, "dailyLearning", userId);
  const snap = await getDoc(ref);
  const sessions = [...(snap.data().sessions ?? [])];
  sessions[sessionIndex] = { ...sessions[sessionIndex], answers, completed: true, score };
  await updateDoc(ref, { sessions });
}
