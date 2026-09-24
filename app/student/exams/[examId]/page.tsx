
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  setDoc,
  where,
  orderBy,
  Timestamp,
  limit,
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";

import { auth, db } from "@/lib/firebase";

type QuestionType =
  | "mcq"
  | "true_false"
  | "short_answer"
  | "descriptive"
  | "coding";

type Question = {
  id: string;
  examId: string;
  type: QuestionType;
  question: string;
  options?: string[];
  correctAnswer?: string;
  marks: number;
  order?: number;
};

type Exam = {
  id: string;
  title: string;
  description?: string;
  subjectId?: string;
  duration: number;
  published: boolean;
};

type Attempt = {
  id: string;
  examId: string;
  studentId: string;
  status: "in_progress" | "submitted";
  startedAt?: Timestamp | null;
  submittedAt?: Timestamp | null;
  score?: number;
};

export default function StudentExamPage() {
  const params = useParams();
  const router = useRouter();

  const examId = params.examId as string;

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [studentId, setStudentId] = useState("");

  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempt, setAttempt] = useState<Attempt | null>(null);

  const [answers, setAnswers] = useState<Record<string, string>>({});

  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const [error, setError] = useState("");

  // ---------------------------------------------------------
  // AUTH + LOAD EXAM
  // ---------------------------------------------------------

  useEffect(() => {
    if (!examId) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/");
        return;
      }

      try {
        setStudentId(user.uid);

        // ---------------------------------------------------
        // CHECK STUDENT PROFILE
        // ---------------------------------------------------

        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          throw new Error("Student profile not found.");
        }

        const userData = userSnap.data();

        if (userData.role !== "student") {
          throw new Error("Only students can access examinations.");
        }

        // ---------------------------------------------------
        // LOAD EXAM
        // ---------------------------------------------------

        const examRef = doc(db, "exams", examId);
        const examSnap = await getDoc(examRef);

        if (!examSnap.exists()) {
          throw new Error("Exam not found.");
        }

        const examData = examSnap.data();

        if (examData.published !== true) {
          throw new Error("This examination is not currently available.");
        }

        const loadedExam: Exam = {
          id: examSnap.id,
          title: examData.title || "Untitled Examination",
          description: examData.description || "",
          subjectId: examData.subjectId || "",
          duration: Number(examData.duration || 30),
          published: Boolean(examData.published),
        };

        setExam(loadedExam);

        // ---------------------------------------------------
        // LOAD QUESTIONS
        // ---------------------------------------------------

        const questionsQuery = query(
          collection(db, "questions"),
          where("examId", "==", examId),
          orderBy("order", "asc")
        );

        const questionsSnap = await getDocs(questionsQuery);

        const loadedQuestions: Question[] = questionsSnap.docs.map(
          (questionDoc) => {
            const data = questionDoc.data();

            return {
              id: questionDoc.id,
              examId: data.examId,
              type: data.type,
              question: data.question || "",
              options: Array.isArray(data.options) ? data.options : [],
              correctAnswer: data.correctAnswer || "",
              marks: Number(data.marks || 1),
              order: Number(data.order || 0),
            };
          }
        );

        setQuestions(loadedQuestions);

        // ---------------------------------------------------
        // CHECK EXISTING ATTEMPT
        // ---------------------------------------------------

        /*
         * IMPORTANT:
         *
         * Do not use getDoc() on the deterministic attempt ID
         * here because a new student does not have an attempts
         * document yet.
         *
         * Instead, query only this student's attempt for this
         * exam. This query is compatible with the Firestore
         * security rule:
         *
         * studentId == request.auth.uid
         */

        const attemptsQuery = query(
          collection(db, "attempts"),
          where("studentId", "==", user.uid),
          where("examId", "==", examId),
          limit(1)
        );

        const attemptsSnap = await getDocs(attemptsQuery);

        if (!attemptsSnap.empty) {
          const attemptDoc = attemptsSnap.docs[0];
          const attemptData = attemptDoc.data();

          const existingAttempt: Attempt = {
            id: attemptDoc.id,
            examId: attemptData.examId,
            studentId: attemptData.studentId,
            status: attemptData.status,
            startedAt: attemptData.startedAt || null,
            submittedAt: attemptData.submittedAt || null,
            score: Number(attemptData.score || 0),
          };

          setAttempt(existingAttempt);

          // -------------------------------------------------
          // LOAD EXISTING ANSWERS
          // -------------------------------------------------

          const answersQuery = query(
            collection(db, "answers"),
            where("attemptId", "==", attemptDoc.id),
            where("studentId", "==", user.uid)
          );

          const answersSnap = await getDocs(answersQuery);

          const existingAnswers: Record<string, string> = {};

          answersSnap.docs.forEach((answerDoc) => {
            const answerData = answerDoc.data();

            if (answerData.questionId) {
              existingAnswers[answerData.questionId] =
                answerData.answer || "";
            }
          });

          setAnswers(existingAnswers);

          // -------------------------------------------------
          // START TIMER IF STILL IN PROGRESS
          // -------------------------------------------------

          if (
            attemptData.status === "in_progress" &&
            attemptData.startedAt
          ) {
            const startedAt = attemptData.startedAt as Timestamp;

            const startMilliseconds = startedAt.toMillis();

            const durationMilliseconds =
              loadedExam.duration * 60 * 1000;

            const endMilliseconds =
              startMilliseconds + durationMilliseconds;

            const remainingSeconds = Math.max(
              0,
              Math.floor(
                (endMilliseconds - Date.now()) / 1000
              )
            );

            setTimeLeft(remainingSeconds);
          }
        }
      } catch (err) {
        console.error("Load exam error:", err);

        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Unable to load this examination.");
        }
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [examId, router]);

  // ---------------------------------------------------------
  // TIMER
  // ---------------------------------------------------------

  useEffect(() => {
    if (!attempt) return;

    if (attempt.status !== "in_progress") return;

    if (timeLeft === null) return;

    if (timeLeft <= 0) {
      handleSubmit(true);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((current) => {
        if (current === null) return null;

        if (current <= 1) {
          clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [attempt?.status, timeLeft]);

  // ---------------------------------------------------------
  // TOTAL MARKS
  // ---------------------------------------------------------

  const totalMarks = useMemo(() => {
    return questions.reduce((total, question) => {
      return total + Number(question.marks || 0);
    }, 0);
  }, [questions]);

  // ---------------------------------------------------------
  // FORMAT TIME
  // ---------------------------------------------------------

  const formattedTime = useMemo(() => {
    if (timeLeft === null) return "--:--";

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
      seconds
    ).padStart(2, "0")}`;
  }, [timeLeft]);

  // ---------------------------------------------------------
  // START EXAM
  // ---------------------------------------------------------

  const startExam = async () => {
    if (!studentId || !exam) return;

    setStarting(true);
    setError("");

    try {
      const attemptId = `${examId}_${studentId}`;

      /*
       * Check for an existing attempt using a query instead
       * of getDoc() on a potentially nonexistent document.
       */

      const existingAttemptsQuery = query(
        collection(db, "attempts"),
        where("studentId", "==", studentId),
        where("examId", "==", examId),
        limit(1)
      );

      const existingAttemptsSnap = await getDocs(
        existingAttemptsQuery
      );

      if (!existingAttemptsSnap.empty) {
        const existingAttemptDoc =
          existingAttemptsSnap.docs[0];

        const data = existingAttemptDoc.data();

        setAttempt({
          id: existingAttemptDoc.id,
          examId: data.examId,
          studentId: data.studentId,
          status: data.status,
          startedAt: data.startedAt || null,
          submittedAt: data.submittedAt || null,
          score: Number(data.score || 0),
        });

        return;
      }

      // -----------------------------------------------------
      // CREATE NEW ATTEMPT
      // -----------------------------------------------------

      const attemptRef = doc(db, "attempts", attemptId);

      const now = Timestamp.now();

      await setDoc(attemptRef, {
        examId,
        studentId,
        status: "in_progress",
        startedAt: now,
        submittedAt: null,
        score: 0,
      });

      const newAttempt: Attempt = {
        id: attemptId,
        examId,
        studentId,
        status: "in_progress",
        startedAt: now,
        submittedAt: null,
        score: 0,
      };

      setAttempt(newAttempt);

      setTimeLeft(exam.duration * 60);
    } catch (err) {
      console.error("Start exam error:", err);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Unable to start the examination.");
      }
    } finally {
      setStarting(false);
    }
  };

  // ---------------------------------------------------------
  // CHANGE ANSWER
  // ---------------------------------------------------------

  const handleAnswerChange = (
    questionId: string,
    answer: string
  ) => {
    if (attempt?.status !== "in_progress") return;

    setAnswers((current) => ({
      ...current,
      [questionId]: answer,
    }));
  };

  // ---------------------------------------------------------
  // CALCULATE OBJECTIVE SCORE
  // ---------------------------------------------------------

  const calculateObjectiveScore = () => {
    let score = 0;

    questions.forEach((question) => {
      if (
        question.type === "mcq" ||
        question.type === "true_false"
      ) {
        const studentAnswer = answers[question.id] || "";
        const correctAnswer = question.correctAnswer || "";

        if (
          studentAnswer.trim().toLowerCase() ===
          correctAnswer.trim().toLowerCase()
        ) {
          score += Number(question.marks || 0);
        }
      }
    });

    return score;
  };

  // ---------------------------------------------------------
  // SUBMIT EXAM
  // ---------------------------------------------------------

  const handleSubmit = async (automatic = false) => {
    if (!attempt) return;

    if (attempt.status !== "in_progress") return;

    if (submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const objectiveScore = calculateObjectiveScore();

      // -----------------------------------------------------
      // SAVE ANSWERS
      // -----------------------------------------------------

      for (const question of questions) {
        const answerId = `${attempt.id}_${question.id}`;

        const answerRef = doc(db, "answers", answerId);

        await setDoc(answerRef, {
          attemptId: attempt.id,
          questionId: question.id,
          studentId,
          answer: answers[question.id] || "",
          marks:
            question.type === "mcq" ||
            question.type === "true_false"
              ? (
                  (answers[question.id] || "")
                    .trim()
                    .toLowerCase() ===
                  (question.correctAnswer || "")
                    .trim()
                    .toLowerCase()
                )
                ? question.marks
                : 0
              : 0,
          feedback: "",
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }

      // -----------------------------------------------------
      // UPDATE ATTEMPT
      // -----------------------------------------------------

      const attemptRef = doc(db, "attempts", attempt.id);

      await updateDoc(attemptRef, {
        status: "submitted",
        submittedAt: Timestamp.now(),
        score: objectiveScore,
      });

      setAttempt((current) => {
        if (!current) return current;

        return {
          ...current,
          status: "submitted",
          submittedAt: Timestamp.now(),
          score: objectiveScore,
        };
      });

      setTimeLeft(0);

      if (automatic) {
        alert(
          "Time is up. Your examination has been submitted automatically."
        );
      }
    } catch (err) {
      console.error("Submit exam error:", err);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Unable to submit the examination.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------
  // LOADING
  // ---------------------------------------------------------

  if (loading) {
    return (
      <main className="min-h-screen bg-white text-black">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="text-center">
            <div className="mx-auto mb-5 h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" />

            <p className="text-sm tracking-wide text-neutral-500">
              Loading examination...
            </p>
          </div>
        </div>
      </main>
    );
  }

  // ---------------------------------------------------------
  // ERROR
  // ---------------------------------------------------------

  if (error && !exam) {
    return (
      <main className="min-h-screen bg-white text-black">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="w-full max-w-lg border border-neutral-200 p-8 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
              StudyLab
            </p>

            <h1 className="font-serif text-3xl">
              Unable to load examination
            </h1>

            <p className="mt-4 text-sm leading-6 text-neutral-600">
              {error}
            </p>

            <button
              onClick={() => router.push("/student")}
              className="mt-7 bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-800"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ---------------------------------------------------------
  // NO EXAM
  // ---------------------------------------------------------

  if (!exam) {
    return null;
  }

  // ---------------------------------------------------------
  // SUBMITTED SCREEN
  // ---------------------------------------------------------

  if (attempt?.status === "submitted") {
    return (
      <main className="min-h-screen bg-white text-black">
        <header className="border-b border-neutral-200 bg-black text-white">
          <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5 sm:px-8">
            <div>
              <p className="font-serif text-2xl">StudyLab</p>

              <p className="mt-0.5 text-[10px] uppercase tracking-[0.25em] text-neutral-400">
                Learn. Practice. Improve.
              </p>
            </div>

            <button
              onClick={() => router.push("/student")}
              className="border border-white/30 px-4 py-2 text-xs font-medium transition hover:bg-white hover:text-black"
            >
              Dashboard
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
          <div className="border border-neutral-200 p-8 text-center sm:p-14">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-black text-2xl text-white">
              ✓
            </div>

            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
              Examination Submitted
            </p>

            <h1 className="mt-3 font-serif text-4xl sm:text-5xl">
              {exam.title}
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-neutral-600">
              Your examination has been submitted successfully. You cannot
              reopen or retake this examination.
            </p>

            <div className="mx-auto mt-10 grid max-w-md grid-cols-2 border border-neutral-200">
              <div className="border-r border-neutral-200 p-5">
                <p className="text-xs uppercase tracking-widest text-neutral-500">
                  Objective Score
                </p>

                <p className="mt-2 font-serif text-3xl">
                  {attempt.score || 0}
                </p>
              </div>

              <div className="p-5">
                <p className="text-xs uppercase tracking-widest text-neutral-500">
                  Total Marks
                </p>

                <p className="mt-2 font-serif text-3xl">
                  {totalMarks}
                </p>
              </div>
            </div>

            <p className="mt-8 text-xs leading-5 text-neutral-500">
              Short answers, descriptive answers, and coding questions
              require teacher evaluation where applicable.
            </p>

            <button
              onClick={() => router.push("/student")}
              className="mt-8 bg-black px-7 py-3 text-sm font-medium text-white transition hover:bg-neutral-800"
            >
              Return to Dashboard
            </button>
          </div>
        </main>
      </main>
    );
  }

  // ---------------------------------------------------------
  // START SCREEN
  // ---------------------------------------------------------

  if (!attempt) {
    return (
      <main className="min-h-screen bg-white text-black">
        <header className="border-b border-neutral-200 bg-black text-white">
          <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5 sm:px-8">
            <div>
              <p className="font-serif text-2xl">StudyLab</p>

              <p className="mt-0.5 text-[10px] uppercase tracking-[0.25em] text-neutral-400">
                Learn. Practice. Improve.
              </p>
            </div>

            <button
              onClick={() => router.push("/student")}
              className="border border-white/30 px-4 py-2 text-xs font-medium transition hover:bg-white hover:text-black"
            >
              Exit
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-20">
          <div className="border border-neutral-200">
            <div className="border-b border-neutral-200 p-7 sm:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                Examination
              </p>

              <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">
                {exam.title}
              </h1>

              {exam.description && (
                <p className="mt-5 max-w-2xl text-sm leading-7 text-neutral-600">
                  {exam.description}
                </p>
              )}
            </div>

            <div className="grid border-b border-neutral-200 sm:grid-cols-3">
              <div className="border-b border-neutral-200 p-6 sm:border-b-0 sm:border-r">
                <p className="text-xs uppercase tracking-widest text-neutral-500">
                  Duration
                </p>

                <p className="mt-2 font-serif text-2xl">
                  {exam.duration} min
                </p>
              </div>

              <div className="border-b border-neutral-200 p-6 sm:border-b-0 sm:border-r">
                <p className="text-xs uppercase tracking-widest text-neutral-500">
                  Questions
                </p>

                <p className="mt-2 font-serif text-2xl">
                  {questions.length}
                </p>
              </div>

              <div className="p-6">
                <p className="text-xs uppercase tracking-widest text-neutral-500">
                  Total Marks
                </p>

                <p className="mt-2 font-serif text-2xl">
                  {totalMarks}
                </p>
              </div>
            </div>

            <div className="p-7 sm:p-10">
              <h2 className="font-serif text-2xl">
                Before you begin
              </h2>

              <ul className="mt-5 space-y-3 text-sm leading-6 text-neutral-600">
                <li>• You have one attempt for this examination.</li>
                <li>• The timer starts when you begin.</li>
                <li>• Your examination will submit automatically when time expires.</li>
                <li>• You cannot reopen a submitted examination.</li>
                <li>• Short, descriptive, and coding answers may require teacher evaluation.</li>
              </ul>

              {error && (
                <div className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                onClick={startExam}
                disabled={starting}
                className="mt-8 w-full bg-black px-6 py-4 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {starting ? "Starting..." : "Start Examination"}
              </button>
            </div>
          </div>
        </main>
      </main>
    );
  }

  // ---------------------------------------------------------
  // ACTIVE EXAM
  // ---------------------------------------------------------

  return (
    <main className="min-h-screen bg-white text-black">
      {/* HEADER */}

      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="flex min-h-20 items-center justify-between gap-5">
            <div className="min-w-0">
              <p className="font-serif text-xl sm:text-2xl">
                StudyLab
              </p>

              <p className="mt-1 truncate text-xs text-neutral-500">
                {exam.title}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
                Time Remaining
              </p>

              <p
                className={`mt-1 font-mono text-xl font-semibold sm:text-2xl ${
                  timeLeft !== null && timeLeft <= 60
                    ? "text-red-600"
                    : "text-black"
                }`}
              >
                {formattedTime}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN */}

      <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
        {error && (
          <div className="mb-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Answer all questions
          </p>

          <h1 className="mt-2 font-serif text-3xl sm:text-4xl">
            {exam.title}
          </h1>

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-neutral-500">
            <span>{questions.length} Questions</span>
            <span>{totalMarks} Total Marks</span>
            <span>{exam.duration} Minutes</span>
          </div>
        </div>

        <div className="space-y-6">
          {questions.map((question, index) => {
            const selectedAnswer = answers[question.id] || "";

            return (
              <section
                key={question.id}
                className="border border-neutral-200"
              >
                <div className="border-b border-neutral-200 p-6 sm:p-8">
                  <div className="flex items-start justify-between gap-5">
                    <div className="flex min-w-0 gap-4">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-black text-xs font-semibold text-white">
                        {index + 1}
                      </span>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
                          {question.type.replace("_", " ")}
                        </p>

                        <h2 className="mt-2 text-base font-medium leading-7 sm:text-lg">
                          {question.question}
                        </h2>
                      </div>
                    </div>

                    <span className="shrink-0 text-xs font-semibold text-neutral-500">
                      {question.marks}{" "}
                      {question.marks === 1 ? "mark" : "marks"}
                    </span>
                  </div>
                </div>

                <div className="p-6 sm:p-8">
                  {/* MCQ */}

                  {question.type === "mcq" && (
                    <div className="space-y-3">
                      {(question.options || []).map(
                        (option, optionIndex) => {
                          const optionLetter = String.fromCharCode(
                            65 + optionIndex
                          );

                          const selected =
                            selectedAnswer === option;

                          return (
                            <button
                              key={optionIndex}
                              type="button"
                              onClick={() =>
                                handleAnswerChange(
                                  question.id,
                                  option
                                )
                              }
                              className={`flex w-full items-center gap-4 border p-4 text-left transition ${
                                selected
                                  ? "border-black bg-black text-white"
                                  : "border-neutral-200 hover:border-black"
                              }`}
                            >
                              <span
                                className={`flex h-8 w-8 shrink-0 items-center justify-center border text-xs font-semibold ${
                                  selected
                                    ? "border-white text-white"
                                    : "border-neutral-300 text-neutral-600"
                                }`}
                              >
                                {optionLetter}
                              </span>

                              <span className="text-sm leading-6">
                                {option}
                              </span>
                            </button>
                          );
                        }
                      )}
                    </div>
                  )}

                  {/* TRUE / FALSE */}

                  {question.type === "true_false" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {["True", "False"].map((option) => {
                        const selected =
                          selectedAnswer.toLowerCase() ===
                          option.toLowerCase();

                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() =>
                              handleAnswerChange(
                                question.id,
                                option
                              )
                            }
                            className={`border px-5 py-4 text-sm font-medium transition ${
                              selected
                                ? "border-black bg-black text-white"
                                : "border-neutral-200 hover:border-black"
                            }`}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* SHORT ANSWER */}

                  {question.type === "short_answer" && (
                    <input
                      type="text"
                      value={selectedAnswer}
                      onChange={(e) =>
                        handleAnswerChange(
                          question.id,
                          e.target.value
                        )
                      }
                      placeholder="Type your answer..."
                      className="w-full border border-neutral-300 px-4 py-3 text-sm outline-none transition focus:border-black"
                    />
                  )}

                  {/* DESCRIPTIVE */}

                  {question.type === "descriptive" && (
                    <textarea
                      value={selectedAnswer}
                      onChange={(e) =>
                        handleAnswerChange(
                          question.id,
                          e.target.value
                        )
                      }
                      rows={7}
                      placeholder="Write your answer..."
                      className="w-full resize-y border border-neutral-300 px-4 py-3 text-sm leading-6 outline-none transition focus:border-black"
                    />
                  )}

                  {/* CODING */}

                  {question.type === "coding" && (
                    <div>
                      <p className="mb-3 text-xs leading-5 text-neutral-500">
                        Write your solution below. This coding question
                        is manually evaluated by your teacher.
                      </p>

                      <textarea
                        value={selectedAnswer}
                        onChange={(e) =>
                          handleAnswerChange(
                            question.id,
                            e.target.value
                          )
                        }
                        rows={12}
                        spellCheck={false}
                        placeholder="// Write your solution here..."
                        className="w-full resize-y border border-neutral-300 bg-neutral-50 px-4 py-4 font-mono text-sm leading-6 outline-none transition focus:border-black"
                      />
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        {/* SUBMIT */}

        <div className="mt-10 border-t border-neutral-200 pt-8">
          <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-medium">
                Ready to submit?
              </p>

              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Once submitted, you cannot reopen or retake this
                examination.
              </p>
            </div>

            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="w-full bg-black px-7 py-4 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {submitting
                ? "Submitting..."
                : "Submit Examination"}
            </button>
          </div>
        </div>
      </main>
    </main>
  );
}

