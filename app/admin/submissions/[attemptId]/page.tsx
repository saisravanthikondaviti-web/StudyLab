"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  updateDoc,
  orderBy,
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";

type Attempt = {
  id: string;
  examId: string;
  studentId: string;
  startedAt?: any;
  submittedAt?: any;
  status: string;
  score: number;
};

type Exam = {
  id: string;
  title: string;
  subjectId: string;
};

type Question = {
  id: string;
  examId: string;
  type: string;
  question: string;
  options?: string[];
  marks: number;
  order: number;
};

type Answer = {
  id: string;
  attemptId: string;
  questionId: string;
  studentId: string;
  answer: string;
  marks: number;
  feedback: string;
};

type Student = {
  name?: string;
  email?: string;
};

export default function EvaluateSubmissionPage() {
  const router = useRouter();
  const params = useParams();

  const attemptId = params.attemptId as string;

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});

  const [marks, setMarks] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/");
        return;
      }

      try {
        const userProfile = await getDoc(doc(db, "users", user.uid));

        if (!userProfile.exists() || userProfile.data().role !== "admin") {
          router.push("/");
          return;
        }

        await loadSubmission();
      } catch (error) {
        console.error("Evaluation load error:", error);
        alert("Unable to load submission.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [attemptId, router]);

  const loadSubmission = async () => {
    const attemptSnapshot = await getDoc(
      doc(db, "attempts", attemptId)
    );

    if (!attemptSnapshot.exists()) {
      alert("Submission not found.");
      router.push("/admin/submissions");
      return;
    }

    const attemptData = {
      id: attemptSnapshot.id,
      ...(attemptSnapshot.data() as Omit<Attempt, "id">),
    };

    setAttempt(attemptData);

    const [examSnapshot, studentSnapshot, questionSnapshot, answerSnapshot] =
      await Promise.all([
        getDoc(doc(db, "exams", attemptData.examId)),
        getDoc(doc(db, "users", attemptData.studentId)),
        getDocs(
          query(
            collection(db, "questions"),
            where("examId", "==", attemptData.examId),
            orderBy("order", "asc")
          )
        ),
        getDocs(
          query(
            collection(db, "answers"),
            where("attemptId", "==", attemptId)
          )
        ),
      ]);

    if (examSnapshot.exists()) {
      setExam({
        id: examSnapshot.id,
        ...(examSnapshot.data() as Omit<Exam, "id">),
      });
    }

    if (studentSnapshot.exists()) {
      setStudent(studentSnapshot.data() as Student);
    }

    const loadedQuestions: Question[] = questionSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Question, "id">),
    }));

    setQuestions(loadedQuestions);

    const answerMap: Record<string, Answer> = {};
    const initialMarks: Record<string, string> = {};
    const initialFeedback: Record<string, string> = {};

    answerSnapshot.docs.forEach((answerDoc) => {
      const data = answerDoc.data();

      const answer: Answer = {
        id: answerDoc.id,
        attemptId: data.attemptId,
        questionId: data.questionId,
        studentId: data.studentId,
        answer: data.answer || "",
        marks: Number(data.marks || 0),
        feedback: data.feedback || "",
      };

      answerMap[answer.questionId] = answer;
      initialMarks[answer.questionId] = String(answer.marks);
      initialFeedback[answer.questionId] = answer.feedback;
    });

    setAnswers(answerMap);
    setMarks(initialMarks);
    setFeedback(initialFeedback);
  };

  const updateMarks = (questionId: string, value: string) => {
    setMarks((previous) => ({
      ...previous,
      [questionId]: value,
    }));
  };

  const updateFeedback = (questionId: string, value: string) => {
    setFeedback((previous) => ({
      ...previous,
      [questionId]: value,
    }));
  };

  const saveEvaluation = async () => {
    if (!attempt) return;

    try {
      setSaving(true);

      let totalScore = 0;

      for (const question of questions) {
        const answer = answers[question.id];

        if (!answer) {
          continue;
        }

        let awardedMarks = Number(marks[question.id] || 0);

        if (awardedMarks < 0) {
          awardedMarks = 0;
        }

        if (awardedMarks > question.marks) {
          awardedMarks = question.marks;
        }

        totalScore += awardedMarks;

        await updateDoc(doc(db, "answers", answer.id), {
          marks: awardedMarks,
          feedback: feedback[question.id] || "",
        });
      }

      await updateDoc(doc(db, "attempts", attempt.id), {
        score: totalScore,
      });

      setAttempt((previous) =>
        previous
          ? {
              ...previous,
              score: totalScore,
            }
          : previous
      );

      alert("Evaluation saved successfully.");
    } catch (error) {
      console.error("Save evaluation error:", error);
      alert(
        "Unable to save evaluation. Check your Firestore rules and try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "—";

    try {
      const date = timestamp.toDate
        ? timestamp.toDate()
        : new Date(timestamp);

      return date.toLocaleString();
    } catch {
      return "—";
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-white text-black flex items-center justify-center">
        <p className="text-sm text-neutral-500">
          Loading submission...
        </p>
      </main>
    );
  }

  if (!attempt) {
    return null;
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <header className="border-b border-black">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <button
            onClick={() => router.push("/admin")}
            className="font-serif text-2xl font-semibold"
          >
            StudyLab
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/admin/submissions")}
              className="hidden text-sm text-neutral-500 transition hover:text-black sm:block"
            >
              Submissions
            </button>

            <button
              onClick={handleLogout}
              className="border border-black px-4 py-2 text-xs font-medium uppercase tracking-[0.15em] transition hover:bg-black hover:text-white"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-12 md:py-16">
        <button
          onClick={() => router.push("/admin/submissions")}
          className="mb-8 text-sm text-neutral-500 hover:text-black"
        >
          ← Back to Submissions
        </button>

        <div className="border-y border-black py-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">
            Evaluation
          </p>

          <h1 className="font-serif text-4xl font-semibold tracking-tight md:text-5xl">
            {exam?.title || "Exam Submission"}
          </h1>

          <div className="mt-6 grid gap-5 text-sm md:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-neutral-400">
                Student
              </p>
              <p className="mt-1 font-medium">
                {student?.name || "Unknown Student"}
              </p>
              <p className="text-xs text-neutral-500">
                {student?.email || ""}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-neutral-400">
                Submitted
              </p>
              <p className="mt-1">
                {formatDate(attempt.submittedAt)}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-neutral-400">
                Current Score
              </p>
              <p className="mt-1 font-serif text-2xl">
                {attempt.score || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 space-y-6">
          {questions.map((question, index) => {
            const answer = answers[question.id];
            const isObjective =
              question.type === "mcq" ||
              question.type === "true_false";

            return (
              <article
                key={question.id}
                className="border border-neutral-300"
              >
                <div className="border-b border-neutral-200 px-5 py-5 md:px-7">
                  <div className="flex items-start justify-between gap-5">
                    <div>
                      <p className="text-xs uppercase tracking-[0.15em] text-neutral-400">
                        Question {index + 1}
                      </p>

                      <h2 className="mt-2 text-lg font-medium leading-7">
                        {question.question}
                      </h2>
                    </div>

                    <span className="shrink-0 border border-black px-3 py-1 text-xs">
                      {question.marks} marks
                    </span>
                  </div>
                </div>

                <div className="px-5 py-6 md:px-7">
                  <div className="mb-6">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-neutral-400">
                      Student Answer
                    </p>

                    <div className="whitespace-pre-wrap border-l-2 border-black bg-neutral-50 px-4 py-4 text-sm leading-7">
                      {answer?.answer || "No answer submitted."}
                    </div>
                  </div>

                  {isObjective && (
                    <p className="mb-6 text-xs text-neutral-500">
                      Objective question. The selected answer can be reviewed
                      here before assigning the final mark.
                    </p>
                  )}

                  <div className="grid gap-6 md:grid-cols-[180px_1fr]">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em]">
                        Marks
                      </label>

                      <input
                        type="number"
                        min="0"
                        max={question.marks}
                        step="0.5"
                        value={marks[question.id] ?? "0"}
                        onChange={(e) =>
                          updateMarks(question.id, e.target.value)
                        }
                        className="w-full border border-neutral-300 px-4 py-3 outline-none focus:border-black"
                      />

                      <p className="mt-2 text-xs text-neutral-400">
                        Maximum: {question.marks}
                      </p>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em]">
                        Feedback
                      </label>

                      <textarea
                        rows={4}
                        value={feedback[question.id] ?? ""}
                        onChange={(e) =>
                          updateFeedback(question.id, e.target.value)
                        }
                        placeholder="Write feedback for the student..."
                        className="w-full resize-none border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-black"
                      />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="sticky bottom-0 mt-10 border-t border-black bg-white py-5">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-neutral-400">
                Final Score
              </p>

              <p className="font-serif text-3xl">
                {Object.values(marks).reduce(
                  (sum, value) => sum + Number(value || 0),
                  0
                )}
              </p>
            </div>

            <button
              onClick={saveEvaluation}
              disabled={saving}
              className="w-full bg-black px-7 py-4 text-sm font-medium uppercase tracking-[0.12em] text-white transition hover:bg-neutral-800 disabled:opacity-50 sm:w-auto"
            >
              {saving ? "Saving..." : "Save Evaluation"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}