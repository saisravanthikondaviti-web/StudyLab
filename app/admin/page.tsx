"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";

type Exam = {
  id: string;
  title: string;
  subjectId: string;
  published: boolean;
  createdAt?: any;
};

type Subject = {
  id: string;
  name: string;
};

type Student = {
  id: string;
  name?: string;
  email?: string;
  role?: string;
};

type Attempt = {
  id: string;
  examId: string;
  studentId: string;
  status: string;
  score: number;
  submittedAt?: any;
};

export default function AdminDashboard() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);

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

        const [
          examSnapshot,
          subjectSnapshot,
          attemptSnapshot,
        ] = await Promise.all([
          getDocs(collection(db, "exams")),
          getDocs(collection(db, "subjects")),
          getDocs(collection(db, "attempts")),
        ]);

        const loadedExams: Exam[] = examSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Exam, "id">),
        }));

        const loadedSubjects: Subject[] = subjectSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Subject, "id">),
        }));

        const loadedStudents: Student[] = userSnapshot.docs
          .filter((doc) => doc.data().role === "student")
          .map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<Student, "id">),
          }));

        const loadedAttempts: Attempt[] = attemptSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Attempt, "id">),
        }));

        setExams(loadedExams);
        setSubjects(loadedSubjects);
        setStudents(loadedStudents);
        setAttempts(loadedAttempts);
      } catch (error) {
        console.error("Dashboard load error:", error);
        alert("Unable to load dashboard data.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const getSubjectName = (subjectId: string) => {
    return (
      subjects.find((subject) => subject.id === subjectId)?.name ||
      "Unknown Subject"
    );
  };

  const getExamTitle = (examId: string) => {
    return (
      exams.find((exam) => exam.id === examId)?.title ||
      "Unknown Exam"
    );
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "—";

    try {
      const date = timestamp.toDate
        ? timestamp.toDate()
        : new Date(timestamp);

      return date.toLocaleDateString();
    } catch {
      return "—";
    }
  };

  const publishedExams = exams.filter(
    (exam) => exam.published === true
  );

  const submittedAttempts = attempts.filter(
    (attempt) => attempt.status === "submitted"
  );

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-black">
        <p className="text-sm text-neutral-500">
          Loading StudyLab...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black">

      {/* HEADER */}
      <header className="border-b border-black">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <button
            onClick={() => router.push("/admin")}
            className="font-serif text-2xl font-semibold tracking-tight"
          >
            StudyLab
          </button>

          <div className="flex items-center gap-4">
            <span className="hidden text-xs uppercase tracking-[0.18em] text-neutral-400 sm:block">
              Admin
            </span>

            <button
              onClick={handleLogout}
              className="border border-black px-4 py-2 text-xs font-medium uppercase tracking-[0.15em] transition hover:bg-black hover:text-white"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <section className="mx-auto max-w-7xl px-6 py-12 md:py-16">

        {/* PAGE INTRO */}
        <div className="flex flex-col justify-between gap-8 border-b border-black pb-10 md:flex-row md:items-end">

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">
              Admin Dashboard
            </p>

            <h1 className="font-serif text-4xl font-semibold tracking-tight md:text-6xl">
              Welcome to StudyLab.
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-7 text-neutral-500">
              Create assessments, manage question papers, review student
              submissions, and track learning progress.
            </p>
          </div>

          <button
            onClick={() => router.push("/admin/exams/create")}
            className="w-full bg-black px-6 py-4 text-sm font-medium uppercase tracking-[0.12em] text-white transition hover:bg-neutral-800 md:w-auto"
          >
            + Create Exam
          </button>
        </div>

        {/* STATS */}
        <div className="grid border-b border-black md:grid-cols-4">

          <div className="border-b border-neutral-200 px-0 py-7 md:border-b-0 md:border-r md:px-6">
            <p className="text-xs uppercase tracking-[0.18em] text-neutral-400">
              Total Exams
            </p>

            <p className="mt-3 font-serif text-4xl">
              {exams.length}
            </p>
          </div>

          <div className="border-b border-neutral-200 px-0 py-7 md:border-b-0 md:border-r md:px-6">
            <p className="text-xs uppercase tracking-[0.18em] text-neutral-400">
              Published
            </p>

            <p className="mt-3 font-serif text-4xl">
              {publishedExams.length}
            </p>
          </div>

          <div className="border-b border-neutral-200 px-0 py-7 md:border-b-0 md:border-r md:px-6">
            <p className="text-xs uppercase tracking-[0.18em] text-neutral-400">
              Students
            </p>

            <p className="mt-3 font-serif text-4xl">
              {students.length}
            </p>
          </div>

          <div className="px-0 py-7 md:px-6">
            <p className="text-xs uppercase tracking-[0.18em] text-neutral-400">
              Submissions
            </p>

            <p className="mt-3 font-serif text-4xl">
              {submittedAttempts.length}
            </p>
          </div>

        </div>

        {/* QUICK ACTIONS */}
        <div className="py-12">
          <p className="mb-6 text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">
            Quick Actions
          </p>

          <div className="grid gap-4 md:grid-cols-3">

            <button
              onClick={() => router.push("/admin/exams")}
              className="group border border-black p-6 text-left transition hover:bg-black hover:text-white"
            >
              <p className="font-serif text-2xl">
                Exams
              </p>

              <p className="mt-2 text-sm text-neutral-500 group-hover:text-neutral-300">
                Create, edit, publish, and manage question papers.
              </p>

              <p className="mt-8 text-xs uppercase tracking-[0.18em]">
                Manage Exams →
              </p>
            </button>

            <button
              onClick={() => router.push("/admin/submissions")}
              className="group border border-black p-6 text-left transition hover:bg-black hover:text-white"
            >
              <p className="font-serif text-2xl">
                Submissions
              </p>

              <p className="mt-2 text-sm text-neutral-500 group-hover:text-neutral-300">
                Review student attempts and evaluate answers.
              </p>

              <p className="mt-8 text-xs uppercase tracking-[0.18em]">
                Review Submissions →
              </p>
            </button>

            <button
              onClick={() => router.push("/admin/exams/create")}
              className="group border border-black p-6 text-left transition hover:bg-black hover:text-white"
            >
              <p className="font-serif text-2xl">
                New Assessment
              </p>

              <p className="mt-2 text-sm text-neutral-500 group-hover:text-neutral-300">
                Start a new assessment and build its question paper.
              </p>

              <p className="mt-8 text-xs uppercase tracking-[0.18em]">
                Create Assessment →
              </p>
            </button>

          </div>
        </div>

        {/* RECENT EXAMS */}
        <div className="border-t border-black pt-10">

          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">
                Assessments
              </p>

              <h2 className="mt-2 font-serif text-3xl">
                Recent Exams
              </h2>
            </div>

            <button
              onClick={() => router.push("/admin/exams")}
              className="text-xs uppercase tracking-[0.15em] underline underline-offset-4"
            >
              View All
            </button>
          </div>

          {exams.length === 0 ? (
            <div className="border-y border-neutral-200 py-12 text-center">
              <p className="font-serif text-xl">
                No exams created yet.
              </p>

              <button
                onClick={() => router.push("/admin/exams/create")}
                className="mt-5 bg-black px-5 py-3 text-xs uppercase tracking-[0.15em] text-white"
              >
                Create First Exam
              </button>
            </div>
          ) : (
            <div className="border-y border-neutral-200">
              {exams.slice(0, 5).map((exam) => (
                <button
                  key={exam.id}
                  onClick={() =>
                    router.push(`/admin/exams/${exam.id}`)
                  }
                  className="flex w-full flex-col gap-4 border-b border-neutral-200 px-2 py-6 text-left transition last:border-0 hover:px-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-serif text-xl">
                      {exam.title}
                    </p>

                    <p className="mt-1 text-sm text-neutral-500">
                      {getSubjectName(exam.subjectId)}
                    </p>
                  </div>

                  <div className="flex items-center gap-5">
                    <span className="text-xs text-neutral-400">
                      {formatDate(exam.createdAt)}
                    </span>

                    <span className="border border-black px-3 py-1 text-[10px] uppercase tracking-wider">
                      {exam.published ? "Published" : "Draft"}
                    </span>

                    <span className="text-sm">
                      →
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* RECENT SUBMISSIONS */}
        <div className="mt-14 border-t border-black pt-10">

          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">
                Student Activity
              </p>

              <h2 className="mt-2 font-serif text-3xl">
                Recent Submissions
              </h2>
            </div>

            <button
              onClick={() => router.push("/admin/submissions")}
              className="text-xs uppercase tracking-[0.15em] underline underline-offset-4"
            >
              View All
            </button>
          </div>

          {submittedAttempts.length === 0 ? (
            <div className="border-y border-neutral-200 py-12 text-center">
              <p className="font-serif text-xl">
                No submissions yet.
              </p>

              <p className="mt-2 text-sm text-neutral-500">
                Student submissions will appear here.
              </p>
            </div>
          ) : (
            <div className="border-y border-neutral-200">
              {submittedAttempts.slice(0, 5).map((attempt) => (
                <button
                  key={attempt.id}
                  onClick={() =>
                    router.push(
                      `/admin/submissions/${attempt.id}`
                    )
                  }
                  className="flex w-full flex-col gap-3 border-b border-neutral-200 px-2 py-6 text-left transition last:border-0 hover:px-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {getExamTitle(attempt.examId)}
                    </p>

                    <p className="mt-1 text-sm text-neutral-500">
                      Submitted assessment
                    </p>
                  </div>

                  <div className="flex items-center gap-5">
                    <span className="font-serif text-xl">
                      {attempt.score || 0}
                    </span>

                    <span className="border border-black px-3 py-1 text-[10px] uppercase tracking-wider">
                      Submitted
                    </span>

                    <span>
                      →
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <footer className="mt-20 border-t border-black py-8 text-center">
          <p className="font-serif text-lg">
            StudyLab
          </p>

          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-neutral-400">
            Learn. Practice. Improve.
          </p>
        </footer>

      </section>
    </main>
  );
}