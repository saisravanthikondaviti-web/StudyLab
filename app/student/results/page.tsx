"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  getDoc,
  doc,
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
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
  description?: string;
  subjectId: string;
  duration: number;
  published: boolean;
};

type Subject = {
  id: string;
  name: string;
};

export default function StudentResultsPage() {
  const router = useRouter();

  const [studentName, setStudentName] = useState("Student");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/");
        return;
      }

      try {
        const userSnapshot = await getDoc(
          doc(db, "users", user.uid)
        );

        if (
          !userSnapshot.exists() ||
          userSnapshot.data().role !== "student"
        ) {
          router.push("/");
          return;
        }

        const userData = userSnapshot.data();

        if (userData.name) {
          setStudentName(userData.name);
        }

        await Promise.all([
          loadAttempts(user.uid),
          loadExams(),
          loadSubjects(),
        ]);
      } catch (error) {
        console.error(error);
        alert("Unable to load your results.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const loadAttempts = async (studentId: string) => {
    const attemptsQuery = query(
      collection(db, "attempts"),
      where("studentId", "==", studentId)
    );

    const snapshot = await getDocs(attemptsQuery);

    const loadedAttempts: Attempt[] = snapshot.docs
      .map((attemptDoc) => ({
        id: attemptDoc.id,
        ...(attemptDoc.data() as Omit<Attempt, "id">),
      }))
      .filter((attempt) => attempt.status === "submitted")
      .sort((a, b) => {
        const aTime = a.submittedAt?.toMillis?.() || 0;
        const bTime = b.submittedAt?.toMillis?.() || 0;

        return bTime - aTime;
      });

    setAttempts(loadedAttempts);
  };

  const loadExams = async () => {
    const examsQuery = query(
      collection(db, "exams"),
      where("published", "==", true)
    );

    const snapshot = await getDocs(examsQuery);

    const loadedExams: Exam[] = snapshot.docs.map((examDoc) => ({
      id: examDoc.id,
      ...(examDoc.data() as Omit<Exam, "id">),
    }));

    setExams(loadedExams);
  };

  const loadSubjects = async () => {
    const snapshot = await getDocs(collection(db, "subjects"));

    const loadedSubjects: Subject[] = snapshot.docs.map(
      (subjectDoc) => ({
        id: subjectDoc.id,
        ...(subjectDoc.data() as Omit<Subject, "id">),
      })
    );

    setSubjects(loadedSubjects);
  };

  const getExam = (examId: string) => {
    return exams.find((exam) => exam.id === examId);
  };

  const getSubjectName = (subjectId?: string) => {
    if (!subjectId) {
      return "General";
    }

    const subject = subjects.find(
      (item) => item.id === subjectId
    );

    return subject?.name || "General";
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) {
      return "Date unavailable";
    }

    try {
      const date = timestamp.toDate
        ? timestamp.toDate()
        : new Date(timestamp);

      return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "Date unavailable";
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
        <p className="text-sm text-neutral-500">
          Loading your results...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-black">
      {/* Header */}
      <header className="bg-black text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <button
            onClick={() => router.push("/student")}
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black">
              <span className="font-serif text-xl font-bold">
                S
              </span>
            </div>

            <div className="text-left">
              <div className="font-serif text-xl font-semibold">
                StudyLab
              </div>

              <div className="text-[10px] uppercase tracking-[0.25em] text-neutral-400">
                Learn. Practice. Improve.
              </div>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/student")}
              className="rounded-full border border-neutral-700 px-4 py-2 text-xs font-medium transition hover:bg-white hover:text-black"
            >
              Dashboard
            </button>

            <button
              onClick={handleLogout}
              className="rounded-full border border-neutral-700 px-4 py-2 text-xs font-medium transition hover:bg-white hover:text-black"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
        {/* Page Heading */}
        <section className="mb-10">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
            Performance
          </p>

          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
                Your Results
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-500">
                Review your completed assessments, scores, and
                teacher feedback.
              </p>
            </div>

            <div className="rounded-full bg-white px-4 py-2 text-xs text-neutral-500 shadow-sm">
              {attempts.length} completed
            </div>
          </div>
        </section>

        {/* Summary */}
        {attempts.length > 0 && (
          <section className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
                Completed
              </p>

              <p className="mt-2 font-serif text-2xl font-semibold">
                {attempts.length}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
                Latest Score
              </p>

              <p className="mt-2 font-serif text-2xl font-semibold">
                {attempts[0]?.score ?? 0}
              </p>
            </div>

            <div className="col-span-2 rounded-2xl bg-black p-4 text-white shadow-sm sm:col-span-1 sm:p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                Progress
              </p>

              <p className="mt-2 font-serif text-2xl font-semibold">
                Keep Going
              </p>
            </div>
          </section>
        )}

        {/* Results */}
        <section>
          <div className="mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
              Completed Assessments
            </p>

            <h2 className="mt-1 font-serif text-2xl font-semibold">
              Assessment History
            </h2>
          </div>

          {attempts.length === 0 ? (
            <div className="rounded-2xl bg-white px-6 py-16 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 font-serif text-xl">
                —
              </div>

              <h3 className="mt-5 font-serif text-xl font-semibold">
                No results yet
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-500">
                Complete an assessment and your result will appear
                here.
              </p>

              <button
                onClick={() => router.push("/student")}
                className="mt-6 rounded-xl bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800"
              >
                Browse Exams
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {attempts.map((attempt) => {
                const exam = getExam(attempt.examId);

                return (
                  <article
                    key={attempt.id}
                    className="group rounded-2xl bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md sm:p-6"
                  >
                    <div className="flex h-full flex-col">
                      {/* Top */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <span className="inline-flex rounded-full bg-neutral-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                            {getSubjectName(exam?.subjectId)}
                          </span>

                          <h3 className="mt-4 font-serif text-xl font-semibold leading-tight">
                            {exam?.title || "Assessment"}
                          </h3>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-400">
                            Score
                          </p>

                          <p className="mt-1 font-serif text-2xl font-semibold">
                            {attempt.score}
                          </p>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="mt-6 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-[#f7f7f5] p-3">
                          <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">
                            Submitted
                          </p>

                          <p className="mt-1 text-sm font-medium text-neutral-700">
                            {formatDate(attempt.submittedAt)}
                          </p>
                        </div>

                        <div className="rounded-xl bg-[#f7f7f5] p-3">
                          <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">
                            Status
                          </p>

                          <p className="mt-1 text-sm font-medium text-neutral-700">
                            Completed
                          </p>
                        </div>
                      </div>

                      {/* Button */}
                      <div className="mt-5">
                        <button
                          onClick={() =>
                            router.push(
                              `/student/results/${attempt.id}`
                            )
                          }
                          className="flex w-full items-center justify-between rounded-xl bg-black px-4 py-3 text-sm font-medium text-white transition hover:bg-neutral-800"
                        >
                          <span>View Result</span>

                          <span className="text-neutral-400 transition group-hover:translate-x-1">
                            →
                          </span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <footer className="mt-10 bg-black text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <p className="font-serif text-base">
              StudyLab
            </p>

            <p className="mt-1 text-xs text-neutral-500">
              Learn. Practice. Improve.
            </p>
          </div>

          <p className="text-xs text-neutral-500">
            © 2026 StudyLab · Created by @SSK
          </p>
        </div>
      </footer>
    </main>
  );
}