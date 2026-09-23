"use client";

import { useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
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
  createdBy: string;
};

type Subject = {
  id: string;
  name: string;
};

type Question = {
  id: string;
  examId: string;
  marks: number;
};

export default function AdminExamsPage() {
  const router = useRouter();

  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [questionCounts, setQuestionCounts] = useState<
    Record<string, { count: number; marks: number }>
  >({});

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/");
        return;
      }

      try {
        const userSnapshot = await getDocs(
          query(
            collection(db, "users"),
            where("__name__", "==", user.uid)
          )
        );

        if (
          userSnapshot.empty ||
          userSnapshot.docs[0].data().role !== "admin"
        ) {
          router.push("/");
          return;
        }

        await loadData();
      } catch (error) {
        console.error(error);
        alert("Unable to load exams.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const loadData = async () => {
    const [examSnapshot, subjectSnapshot, questionSnapshot] =
      await Promise.all([
        getDocs(collection(db, "exams")),
        getDocs(collection(db, "subjects")),
        getDocs(collection(db, "questions")),
      ]);

    const loadedExams: Exam[] = examSnapshot.docs.map((examDoc) => ({
      id: examDoc.id,
      ...(examDoc.data() as Omit<Exam, "id">),
    }));

    const loadedSubjects: Subject[] = subjectSnapshot.docs.map(
      (subjectDoc) => ({
        id: subjectDoc.id,
        ...(subjectDoc.data() as Omit<Subject, "id">),
      })
    );

    const counts: Record<
      string,
      { count: number; marks: number }
    > = {};

    questionSnapshot.docs.forEach((questionDoc) => {
      const question = questionDoc.data() as Question;

      if (!counts[question.examId]) {
        counts[question.examId] = {
          count: 0,
          marks: 0,
        };
      }

      counts[question.examId].count += 1;
      counts[question.examId].marks += Number(question.marks || 0);
    });

    setExams(loadedExams);
    setSubjects(loadedSubjects);
    setQuestionCounts(counts);
  };

  const getSubjectName = (subjectId: string) => {
    const subject = subjects.find(
      (item) => item.id === subjectId
    );

    return subject?.name || "General";
  };

  const handleDelete = async (exam: Exam) => {
    const confirmed = window.confirm(
      `Delete "${exam.title}"?\n\nThis will delete the exam record. Questions associated with it should also be removed separately.`
    );

    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "exams", exam.id));
      await loadData();
    } catch (error) {
      console.error(error);
      alert("Unable to delete exam.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm text-gray-500">
          Loading exams...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-black">
      {/* Header */}
      <header className="border-b border-black bg-black text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <button
            onClick={() => router.push("/admin")}
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center bg-white text-black">
              <span className="font-serif text-xl font-bold">
                S
              </span>
            </div>

            <div className="text-left">
              <div className="font-serif text-xl font-semibold">
                StudyLab
              </div>

              <div className="text-[10px] uppercase tracking-[0.25em] text-gray-400">
                Learn. Practice. Improve.
              </div>
            </div>
          </button>

          <button
            onClick={handleLogout}
            className="border border-gray-700 px-4 py-2 text-sm transition hover:bg-white hover:text-black"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">

{/* Back to Dashboard */}
<div className="mb-8">
  <button
    onClick={() => router.push("/admin")}
    className="text-sm text-gray-500 transition hover:text-black"
  >
    ← Back to Dashboard
  </button>
</div>

        {/* Page heading */}
        <section className="mb-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-gray-500">
                Teacher Workspace
              </p>

              <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
                Exams
              </h1>

              <p className="mt-4 max-w-xl text-sm leading-7 text-gray-600">
                Create assessments, build question papers, publish
                exams, and manage your students&apos; learning
                activities.
              </p>
            </div>

            <button
              onClick={() => router.push("/admin/exams/create")}
              className="group flex items-center justify-center gap-3 bg-black px-6 py-3.5 text-sm font-medium text-white transition hover:bg-gray-800"
            >
              <span className="text-lg leading-none">+</span>
              Create Exam
              <span className="transition-transform group-hover:translate-x-1">
                →
              </span>
            </button>
          </div>
        </section>

        {/* Summary */}
        <section className="mb-10 grid gap-px overflow-hidden border border-gray-200 bg-gray-200 sm:grid-cols-3">
          <div className="bg-white px-6 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">
              Total Exams
            </p>

            <p className="mt-2 font-serif text-3xl font-semibold">
              {exams.length}
            </p>
          </div>

          <div className="bg-white px-6 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">
              Published
            </p>

            <p className="mt-2 font-serif text-3xl font-semibold">
              {exams.filter((exam) => exam.published).length}
            </p>
          </div>

          <div className="bg-white px-6 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">
              Drafts
            </p>

            <p className="mt-2 font-serif text-3xl font-semibold">
              {exams.filter((exam) => !exam.published).length}
            </p>
          </div>
        </section>

        {/* Exam list */}
        <section>
          {exams.length === 0 ? (
            <div className="border border-dashed border-gray-300 bg-white px-6 py-20 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center border border-gray-200 font-serif text-2xl">
                +
              </div>

              <h2 className="mt-6 font-serif text-2xl font-semibold">
                No exams yet
              </h2>

              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-gray-500">
                Create your first assessment and start building
                your question paper.
              </p>

              <button
                onClick={() => router.push("/admin/exams/create")}
                className="mt-6 bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
              >
                Create Your First Exam
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {exams.map((exam, index) => {
                const stats = questionCounts[exam.id] || {
                  count: 0,
                  marks: 0,
                };

                return (
                  <article
                    key={exam.id}
                    className="group border border-gray-200 bg-white transition hover:border-black"
                  >
                    <div className="p-5 sm:p-6 lg:p-7">
                      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        {/* Main */}
                        <div className="flex min-w-0 gap-4 sm:gap-5">
                          <div className="hidden h-10 w-10 shrink-0 items-center justify-center border border-gray-200 text-xs font-semibold sm:flex">
                            {String(index + 1).padStart(2, "0")}
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="border border-gray-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                                {getSubjectName(exam.subjectId)}
                              </span>

                              <span
                                className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                                  exam.published
                                    ? "bg-black text-white"
                                    : "bg-gray-100 text-gray-500"
                                }`}
                              >
                                {exam.published
                                  ? "Published"
                                  : "Draft"}
                              </span>
                            </div>

                            <h2 className="mt-3 truncate font-serif text-2xl font-semibold sm:text-3xl">
                              {exam.title}
                            </h2>

                            {exam.description && (
                              <p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-6 text-gray-500">
                                {exam.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-4 border-y border-gray-100 py-4 lg:min-w-[330px] lg:border-y-0 lg:border-l lg:pl-7 lg:py-0">
                          <div>
                            <p className="text-[9px] uppercase tracking-wider text-gray-400">
                              Questions
                            </p>

                            <p className="mt-1 text-lg font-semibold">
                              {stats.count}
                            </p>
                          </div>

                          <div>
                            <p className="text-[9px] uppercase tracking-wider text-gray-400">
                              Marks
                            </p>

                            <p className="mt-1 text-lg font-semibold">
                              {stats.marks}
                            </p>
                          </div>

                          <div>
                            <p className="text-[9px] uppercase tracking-wider text-gray-400">
                              Time
                            </p>

                            <p className="mt-1 text-lg font-semibold">
                              {exam.duration}
                              <span className="ml-1 text-xs font-normal text-gray-400">
                                min
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="mt-6 flex flex-col gap-2 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
                        <button
                          onClick={() =>
                            router.push(
                              `/admin/exams/${exam.id}`
                            )
                          }
                          className="border border-gray-300 px-5 py-2.5 text-sm font-medium transition hover:border-black"
                        >
                          Questions
                        </button>

                        <button
                          onClick={() =>
                            router.push(
                              `/admin/exams/${exam.id}`
                            )
                          }
                          className="bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
                        >
                          Manage Exam →
                        </button>

                        <button
                          onClick={() => handleDelete(exam)}
                          className="border border-gray-300 px-5 py-2.5 text-sm text-gray-500 transition hover:border-black hover:text-black"
                        >
                          Delete
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

      <footer className="mt-12 border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-7 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="font-serif text-base text-black">
            StudyLab
          </p>

          <p>Learn. Practice. Improve.</p>
        </div>
      </footer>
    </main>
  );
}