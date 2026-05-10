// src/lib/uploadPaper.js
import {
  collection, addDoc, writeBatch,
  doc, serverTimestamp, getDocs, query, where
} from "firebase/firestore";
import { db } from "../firebase";

// Validates the uploaded JSON matches our schema
export function validatePaperJSON(data) {
  const errors = [];
  if (!data.meta)                          errors.push("Missing 'meta' object");
  if (!data.meta?.title)                   errors.push("meta.title is required");
  if (!data.meta?.year)                    errors.push("meta.year is required");
  if (!["PAPER_1","PAPER_2"].includes(data.meta?.paperType))
                                           errors.push("meta.paperType must be PAPER_1 or PAPER_2");
  if (!data.meta?.subject)                 errors.push("meta.subject is required");
  if (!Array.isArray(data.questions))      errors.push("'questions' must be an array");
  if (data.questions?.length === 0)        errors.push("questions array is empty");

  data.questions?.forEach((q, i) => {
    if (!q.text)                           errors.push(`Q${i+1}: missing text`);
    if (!q.options?.A || !q.options?.B ||
        !q.options?.C || !q.options?.D)    errors.push(`Q${i+1}: missing options`);
    if (!["A","B","C","D"].includes(q.correctAnswer))
                                           errors.push(`Q${i+1}: invalid correctAnswer`);
  });

  return errors;
}

// Uploads the paper metadata + all questions to Firestore
// Uses batched writes (max 500 per batch)
export async function uploadPaperToFirestore(data, adminUid) {
  // 1. Create the paper document
  const paperRef = await addDoc(collection(db, "papers"), {
    title:           data.meta.title,
    year:            data.meta.year,
    paperType:       data.meta.paperType,
    subject:         data.meta.subject,
    durationMinutes: data.meta.durationMinutes ?? 120,
    totalQuestions:  data.questions.length,
    uploadedBy:      adminUid,
    uploadedAt:      serverTimestamp(),
    isActive:        true,
  });

  // 2. Upload questions in batches of 400
  const BATCH_SIZE = 400;
  for (let i = 0; i < data.questions.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = data.questions.slice(i, i + BATCH_SIZE);
    chunk.forEach((q) => {
      const qRef = doc(collection(db, "papers", paperRef.id, "questions"));
      batch.set(qRef, {
        number:        q.number ?? (i + 1),
        text:          q.text,
        options:       q.options,
        correctAnswer: q.correctAnswer,
      });
    });
    await batch.commit();
  }

  return paperRef.id;
}

// Fetch all active papers for the student home
export async function fetchActivePapers() {
  const snap = await getDocs(
    query(collection(db, "papers"), where("isActive", "==", true))
  );
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => b.year - a.year);  // newest first
}

// Fetch questions for a specific paper
export async function fetchPaperQuestions(paperId) {
  const snap = await getDocs(
    collection(db, "papers", paperId, "questions")
  );
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.number - b.number);  // original order
}