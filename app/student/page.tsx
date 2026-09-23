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

export default function StudentDashboard() {
  const router = useRouter();

  const [studentName, setStudentName] = useState("Student");
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

        await loadExams();
        await loadSubjects();
      } catch (error) {
        console.error(error);
        alert("Unable to load your dashboard.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

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

  const getSubjectName = (subjectId: string) => {
    const subject = subjects.find(
      (item) => item.id === subjectId
    );

    return subject?.name || "General";
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
        <p className="text-sm text-neutral-500">
          Loading your dashboard...
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

          {/* Student Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/student/results")}
              className="rounded-full border border-neutral-700 px-4 py-2 text-xs font-medium transition hover:bg-white hover:text-black"
            >
              Results
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

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
        {/* Welcome */}
        <section className="mb-10">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
            Student Dashboard
          </p>

          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
                Welcome, {studentName}
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-500">
                Continue your learning journey with your available
                assessments.
              </p>
            </div>

            <div className="text-sm text-neutral-400">
              {exams.length} assessment
              {exams.length === 1 ? "" : "s"} available
            </div>
          </div>
        </section>

        {/* Compact Stats */}
        <section className="mb-12 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
              Available
            </p>

            <p className="mt-2 font-serif text-2xl font-semibold">
              {exams.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
              Learning
            </p>

            <p className="mt-2 font-serif text-2xl font-semibold">
              Practice
            </p>
          </div>

          <div className="col-span-2 rounded-2xl bg-black p-4 text-white shadow-sm sm:col-span-1 sm:p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
              Goal
            </p>

            <p className="mt-2 font-serif text-2xl font-semibold">
              Improve
            </p>
          </div>
        </section>

        {/* Exams */}
        <section>
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                Assessments
              </p>

              <h2 className="mt-1 font-serif text-2xl font-semibold">
                Available Exams
              </h2>
            </div>

            {/* Results shortcut */}
            <button
              onClick={() => router.push("/student/results")}
              className="text-xs font-medium text-neutral-500 transition hover:text-black"
            >
              View Results →
            </button>
          </div>

          {exams.length === 0 ? (
            <div className="rounded-2xl bg-white px-6 py-16 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 font-serif text-xl">
                —
              </div>

              <h3 className="mt-5 font-serif text-xl font-semibold">
                No exams available
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-500">
                Your teacher has not published any exams yet.
                Check back later.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {exams.map((exam) => (
                <article
                  key={exam.id}
                  className="group rounded-2xl bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md sm:p-6"
                >
                  <div className="flex h-full flex-col">
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-full bg-neutral-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                          {getSubjectName(exam.subjectId)}
                        </span>

                        <span className="text-xs text-neutral-400">
                          {exam.duration} min
                        </span>
                      </div>

                      <h3 className="mt-5 font-serif text-xl font-semibold leading-tight">
                        {exam.title}
                      </h3>

                      {exam.description && (
                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-neutral-500">
                          {exam.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-6">
                      <button
                        onClick={() =>
                          router.push(`/student/exams/${exam.id}`)
                        }
                        className="flex w-full items-center justify-between rounded-xl bg-black px-4 py-3 text-sm font-medium text-white transition hover:bg-neutral-800"
                      >
                        <span>Start Assessment</span>

                        <span className="text-neutral-400 transition group-hover:translate-x-1">
                          →
                        </span>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Results Card */}
        <section className="mt-10">
          <button
            onClick={() => router.push("/student/results")}
            className="group w-full rounded-2xl bg-white p-5 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md sm:p-6"
          >
            <div className="flex items-center justify-between gap-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
                  Performance
                </p>

                <h3 className="mt-2 font-serif text-xl font-semibold">
                  View Your Results
                </h3>

                <p className="mt-1 text-sm text-neutral-500">
                  Review your scores, answers and teacher feedback.
                </p>
              </div>

              <span className="text-lg text-neutral-400 transition group-hover:translate-x-1">
                →
              </span>
            </div>
          </button>
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