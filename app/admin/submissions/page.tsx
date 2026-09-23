"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
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
  subjectId: string;
};

type UserProfile = {
  id: string;
  name?: string;
  email?: string;
  role?: string;
};

export default function AdminSubmissionsPage() {
  const router = useRouter();

  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/");
        return;
      }

      try {
        const userSnapshot = await getDocs(collection(db, "users"));
        const currentUser = userSnapshot.docs.find(
          (doc) => doc.id === user.uid
        );

        if (!currentUser || currentUser.data().role !== "admin") {
          router.push("/");
          return;
        }

        const [attemptSnapshot, examSnapshot] = await Promise.all([
          getDocs(
            query(
              collection(db, "attempts"),
              orderBy("submittedAt", "desc")
            )
          ),
          getDocs(collection(db, "exams")),
        ]);

        const loadedAttempts: Attempt[] = attemptSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Attempt, "id">),
        }));

        const loadedExams: Exam[] = examSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Exam, "id">),
        }));

        const loadedStudents: UserProfile[] = userSnapshot.docs
          .filter((doc) => doc.data().role === "student")
          .map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<UserProfile, "id">),
          }));

        setAttempts(loadedAttempts);
        setExams(loadedExams);
        setStudents(loadedStudents);
      } catch (error) {
        console.error("Submissions load error:", error);
        alert("Unable to load submissions.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const getExam = (examId: string) => {
    return exams.find((exam) => exam.id === examId);
  };

  const getStudent = (studentId: string) => {
    return students.find((student) => student.id === studentId);
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
        <p className="text-sm text-neutral-500">Loading submissions...</p>
      </main>
    );
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
              onClick={() => router.push("/admin")}
              className="hidden text-sm text-neutral-500 transition hover:text-black sm:block"
            >
              Dashboard
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

      <section className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="mb-10">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">
            Admin / Assessment
          </p>

          <h1 className="font-serif text-4xl font-semibold tracking-tight md:text-5xl">
            Student Submissions
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-neutral-500">
            Review submitted assessments, inspect student answers, and provide
            marks and feedback.
          </p>
        </div>

        {attempts.length === 0 ? (
          <div className="border-y border-black py-20 text-center">
            <p className="font-serif text-2xl">No submissions yet.</p>
            <p className="mt-3 text-sm text-neutral-500">
              Submitted student assessments will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden border border-black">
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-black bg-black text-left text-xs uppercase tracking-[0.15em] text-white">
                    <th className="px-5 py-4">Student</th>
                    <th className="px-5 py-4">Exam</th>
                    <th className="px-5 py-4">Submitted</th>
                    <th className="px-5 py-4">Score</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {attempts.map((attempt) => {
                    const exam = getExam(attempt.examId);
                    const student = getStudent(attempt.studentId);

                    return (
                      <tr
                        key={attempt.id}
                        className="border-b border-neutral-200 last:border-0"
                      >
                        <td className="px-5 py-5">
                          <div className="font-medium">
                            {student?.name || "Unknown Student"}
                          </div>
                          <div className="mt-1 text-xs text-neutral-500">
                            {student?.email || attempt.studentId}
                          </div>
                        </td>

                        <td className="px-5 py-5">
                          <div className="font-medium">
                            {exam?.title || "Unknown Exam"}
                          </div>
                        </td>

                        <td className="px-5 py-5 text-sm text-neutral-500">
                          {formatDate(attempt.submittedAt)}
                        </td>

                        <td className="px-5 py-5">
                          <span className="font-serif text-xl">
                            {attempt.score || 0}
                          </span>
                        </td>

                        <td className="px-5 py-5">
                          <span className="inline-block border border-black px-3 py-1 text-xs uppercase tracking-wider">
                            {attempt.status}
                          </span>
                        </td>

                        <td className="px-5 py-5 text-right">
                          <button
                            onClick={() =>
                              router.push(
                                `/admin/submissions/${attempt.id}`
                              )
                            }
                            className="bg-black px-4 py-2 text-xs font-medium uppercase tracking-wider text-white transition hover:bg-neutral-800"
                          >
                            Evaluate
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="divide-y divide-neutral-200 md:hidden">
              {attempts.map((attempt) => {
                const exam = getExam(attempt.examId);
                const student = getStudent(attempt.studentId);

                return (
                  <div key={attempt.id} className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="font-serif text-xl">
                          {student?.name || "Unknown Student"}
                        </h2>

                        <p className="mt-1 text-xs text-neutral-500">
                          {student?.email || attempt.studentId}
                        </p>
                      </div>

                      <span className="border border-black px-2 py-1 text-[10px] uppercase tracking-wider">
                        {attempt.status}
                      </span>
                    </div>

                    <div className="mt-5 space-y-3 border-t border-neutral-200 pt-4 text-sm">
                      <div className="flex justify-between gap-4">
                        <span className="text-neutral-500">Exam</span>
                        <span className="text-right font-medium">
                          {exam?.title || "Unknown Exam"}
                        </span>
                      </div>

                      <div className="flex justify-between gap-4">
                        <span className="text-neutral-500">Submitted</span>
                        <span className="text-right">
                          {formatDate(attempt.submittedAt)}
                        </span>
                      </div>

                      <div className="flex justify-between gap-4">
                        <span className="text-neutral-500">Score</span>
                        <span className="font-serif text-xl">
                          {attempt.score || 0}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        router.push(`/admin/submissions/${attempt.id}`)
                      }
                      className="mt-5 w-full bg-black px-4 py-3 text-xs font-medium uppercase tracking-wider text-white"
                    >
                      Evaluate Submission →
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}