"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";

type Subject = {
  id: string;
  name: string;
};

export default function CreateExamPage() {
  const router = useRouter();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [duration, setDuration] = useState("30");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/");
        return;
      }

      try {
        const userDoc = await getDocs(collection(db, "users"));
        const profile = userDoc.docs.find((doc) => doc.id === user.uid);

        if (!profile || profile.data().role !== "admin") {
          router.push("/");
          return;
        }

        const subjectSnapshot = await getDocs(collection(db, "subjects"));

        const loadedSubjects: Subject[] = subjectSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || "Untitled Subject",
        }));

        setSubjects(loadedSubjects);

        if (loadedSubjects.length > 0) {
          setSubjectId(loadedSubjects[0].id);
        }
      } catch (error) {
        console.error("Load error:", error);
        alert("Unable to load subjects.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!title.trim()) {
      alert("Please enter an exam title.");
      return;
    }

    if (!subjectId) {
      alert("Please select a subject.");
      return;
    }

    const durationNumber = Number(duration);

    if (!durationNumber || durationNumber <= 0) {
      alert("Please enter a valid duration.");
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      alert("Please log in again.");
      router.push("/");
      return;
    }

    try {
      setSaving(true);

      const examRef = await addDoc(collection(db, "exams"), {
        title: title.trim(),
        description: description.trim(),
        subjectId,
        duration: durationNumber,
        published: false,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      router.push(`/admin/exams/${examRef.id}`);
    } catch (error) {
      console.error("Create exam error:", error);
      alert("Unable to create exam. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-white text-black flex items-center justify-center">
        <p className="text-sm tracking-wide text-neutral-500">
          Loading...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black">
      {/* Header */}
      <header className="border-b border-black">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <button
            onClick={() => router.push("/admin/exams")}
            className="font-serif text-2xl font-semibold tracking-tight"
          >
            StudyLab
          </button>

          <button
            onClick={handleLogout}
            className="border border-black px-4 py-2 text-xs font-medium uppercase tracking-[0.15em] transition hover:bg-black hover:text-white"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main */}
      <section className="mx-auto max-w-4xl px-6 py-12 md:py-16">
        <button
          onClick={() => router.push("/admin/exams")}
          className="mb-8 text-sm text-neutral-500 transition hover:text-black"
        >
          ← Back to Exams
        </button>

        <div className="mb-10">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">
            Admin / Exams
          </p>

          <h1 className="font-serif text-4xl font-semibold tracking-tight md:text-5xl">
            Create New Exam
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-neutral-500">
            Create the basic exam details first. You can add questions,
            configure marks, and publish the paper on the next screen.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="border-y border-black">
            {/* Title */}
            <div className="border-b border-neutral-200 py-7">
              <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.18em]">
                Exam Title
              </label>

              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Example: Mathematics — Unit Test 1"
                className="w-full border border-neutral-300 bg-white px-4 py-4 text-base outline-none transition focus:border-black"
              />
            </div>

            {/* Description */}
            <div className="border-b border-neutral-200 py-7">
              <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.18em]">
                Description
              </label>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe this assessment..."
                rows={5}
                className="w-full resize-none border border-neutral-300 bg-white px-4 py-4 text-base outline-none transition focus:border-black"
              />
            </div>

            {/* Subject + Duration */}
            <div className="grid gap-7 py-7 md:grid-cols-2">
              <div>
                <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.18em]">
                  Subject
                </label>

                {subjects.length === 0 ? (
                  <div className="border border-neutral-300 px-4 py-4 text-sm text-neutral-500">
                    No subjects found. Create a subject first.
                  </div>
                ) : (
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full border border-neutral-300 bg-white px-4 py-4 text-base outline-none transition focus:border-black"
                  >
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.18em]">
                  Duration
                </label>

                <div className="flex">
                  <input
                    type="number"
                    min="1"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full border border-neutral-300 bg-white px-4 py-4 text-base outline-none transition focus:border-black"
                  />

                  <div className="flex items-center border-y border-r border-neutral-300 px-4 text-sm text-neutral-500">
                    min
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => router.push("/admin/exams")}
              className="border border-black px-6 py-3 text-sm font-medium transition hover:bg-black hover:text-white"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving || subjects.length === 0}
              className="bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Exam →"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}