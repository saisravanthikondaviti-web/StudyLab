"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";

type Attempt = {
  id: string;
  examId: string;
  studentId: string;
  score: number;
  status: string;
  submittedAt: any;
};

type Exam = {
  id: string;
  title: string;
  subjectId: string;
  duration: number;
};

type Question = {
  id: string;
  question: string;
  type: string;
  marks: number;
  order: number;
  options?: string[];
};

type Answer = {
  id: string;
  questionId: string;
  answer: string;
  marks: number;
  feedback?: string;
};

type Subject = {
  id: string;
  name: string;
};

export default function StudentResultDetailPage() {
  const router = useRouter();
  const params = useParams();

  const attemptId = params.attemptId as string;

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [subject, setSubject] = useState<Subject | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/");
        return;
      }

      try {
        // Verify student profile
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

        // Load attempt
        const attemptRef = doc(
          db,
          "attempts",
          attemptId
        );

        const attemptSnapshot = await getDoc(attemptRef);

        if (!attemptSnapshot.exists()) {
          setError("This result could not be found.");
          return;
        }

        const attemptData = attemptSnapshot.data();

        if (attemptData.studentId !== user.uid) {
          setError("You are not allowed to view this result.");
          return;
        }

        if (attemptData.status !== "submitted") {
          setError("This assessment has not been submitted yet.");
          return;
        }

        const loadedAttempt: Attempt = {
          id: attemptSnapshot.id,
          ...(attemptData as Omit<Attempt, "id">),
        };

        setAttempt(loadedAttempt);

        // Load exam
        const examSnapshot = await getDoc(
          doc(db, "exams", attemptData.examId)
        );

        if (!examSnapshot.exists()) {
          setError("The associated exam could not be found.");
          return;
        }

        const examData = examSnapshot.data();

        const loadedExam: Exam = {
          id: examSnapshot.id,
          ...(examData as Omit<Exam, "id">),
        };

        setExam(loadedExam);

        // Load subject
        if (examData.subjectId) {
          const subjectSnapshot = await getDoc(
            doc(db, "subjects", examData.subjectId)
          );

          if (subjectSnapshot.exists()) {
            setSubject({
              id: subjectSnapshot.id,
              ...(subjectSnapshot.data() as Omit<
                Subject,
                "id"
              >),
            });
          }
        }

        // Load questions
        const questionsQuery = query(
          collection(db, "questions"),
          where("examId", "==", attemptData.examId)
        );

        const questionsSnapshot =
          await getDocs(questionsQuery);

        const loadedQuestions: Question[] =
          questionsSnapshot.docs
            .map((questionDoc) => ({
              id: questionDoc.id,
              ...(questionDoc.data() as Omit<
                Question,
                "id"
              >),
            }))
            .sort((a, b) => a.order - b.order);

        setQuestions(loadedQuestions);

        // Load student's answers
        const answersQuery = query(
          collection(db, "answers"),
          where("attemptId", "==", attemptId),
          where("studentId", "==", user.uid)
        );

        const answersSnapshot =
          await getDocs(answersQuery);

        const loadedAnswers: Answer[] =
          answersSnapshot.docs.map((answerDoc) => ({
            id: answerDoc.id,
            ...(answerDoc.data() as Omit<Answer, "id">),
          }));

        setAnswers(loadedAnswers);
      } catch (error) {
        console.error("RESULT DETAIL ERROR:", error);

        setError(
          "Unable to load this result. Please refresh the page."
        );
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [attemptId, router]);

  const getAnswer = (questionId: string) => {
    return answers.find(
      (answer) => answer.questionId === questionId
    );
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) {
      return "Not available";
    }

    try {
      return timestamp
        .toDate()
        .toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
    } catch {
      return "Not available";
    }
  };

  const getQuestionType = (type: string) => {
    switch (type) {
      case "mcq":
        return "Multiple Choice";

      case "true_false":
        return "True / False";

      case "short_answer":
        return "Short Answer";

      case "descriptive":
        return "Descriptive Answer";

      case "coding":
        return "Coding";

      default:
        return "Question";
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-white px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm text-neutral-500">
            Loading result...
          </p>
        </div>
      </main>
    );
  }

  if (error || !attempt || !exam) {
    return (
      <main className="min-h-screen bg-white text-black">
        <header className="border-b border-black bg-black text-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
            <button
              onClick={() => router.push("/student")}
              className="flex items-center gap-3"
            >
              <div className="flex h-9 w-9 items-center justify-center bg-white text-black">
                <span className="font-serif text-lg font-bold">
                  S
                </span>
              </div>

              <div className="font-serif text-lg">
                StudyLab
              </div>
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
          <div className="border border-neutral-200 p-10 text-center">
            <p className="font-serif text-3xl">
              Result unavailable
            </p>

            <p className="mt-4 text-sm text-neutral-500">
              {error || "This result could not be loaded."}
            </p>

            <button
              onClick={() => router.push("/student/results")}
              className="mt-8 bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-800"
            >
              ← Back to Results
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black">
      {/* Header */}
      <header className="border-b border-black bg-black text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <button
            onClick={() => router.push("/student")}
            className="flex items-center gap-3"
          >
            <div className="flex h-9 w-9 items-center justify-center bg-white text-black">
              <span className="font-serif text-lg font-bold">
                S
              </span>
            </div>

            <div className="text-left">
              <div className="font-serif text-lg">
                StudyLab
              </div>

              <div className="text-[9px] uppercase tracking-[0.25em] text-neutral-400">
                Student Portal
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push("/student/results")}
            className="text-sm text-neutral-400 transition hover:text-white"
          >
            ← Results
          </button>
        </div>
      </header>

      {/* Main */}
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:py-16">
        {/* Back */}
        <button
          onClick={() => router.push("/student/results")}
          className="mb-10 text-sm text-neutral-500 transition hover:text-black"
        >
          ← Back to Results
        </button>

        {/* Exam heading */}
        <section className="border-b border-black pb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-400">
            {subject?.name || "Assessment"}
          </p>

          <h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">
            {exam.title}
          </h1>

          <p className="mt-4 text-sm text-neutral-500">
            Submitted {formatDate(attempt.submittedAt)}
          </p>
        </section>

        {/* Score */}
        <section className="grid border-b border-black sm:grid-cols-3">
          <div className="border-b border-neutral-200 px-5 py-7 sm:border-b-0 sm:border-r">
            <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">
              Score
            </p>

            <p className="mt-2 font-serif text-4xl">
              {attempt.score ?? 0}
            </p>
          </div>

          <div className="border-b border-neutral-200 px-5 py-7 sm:border-b-0 sm:border-r">
            <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">
              Questions
            </p>

            <p className="mt-2 font-serif text-4xl">
              {questions.length}
            </p>
          </div>

          <div className="px-5 py-7">
            <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">
              Status
            </p>

            <p className="mt-2 font-serif text-2xl">
              Completed
            </p>
          </div>
        </section>

        {/* Questions */}
        <section className="mt-12">
          <div className="mb-7">
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">
              Review
            </p>

            <h2 className="mt-2 font-serif text-3xl">
              Your Answers
            </h2>
          </div>

          <div className="space-y-6">
            {questions.map((question, index) => {
              const answer = getAnswer(question.id);

              return (
                <article
                  key={question.id}
                  className="border border-neutral-200 bg-white"
                >
                  {/* Question header */}
                  <div className="border-b border-neutral-200 px-5 py-5 sm:px-7">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex gap-4">
                        <span className="font-serif text-lg text-neutral-400">
                          {String(index + 1).padStart(2, "0")}
                        </span>

                        <div>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">
                            {getQuestionType(question.type)}
                          </p>

                          <h3 className="mt-2 text-base font-medium leading-7">
                            {question.question}
                          </h3>
                        </div>
                      </div>

                      <span className="whitespace-nowrap text-sm text-neutral-400">
                        {answer?.marks ?? 0} / {question.marks}
                      </span>
                    </div>
                  </div>

                  {/* Student answer */}
                  <div className="px-5 py-6 sm:px-7">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                      Your Answer
                    </p>

                    <div className="border-l-2 border-black pl-4">
                      <p className="whitespace-pre-wrap text-sm leading-7 text-neutral-700">
                        {answer?.answer || "No answer provided."}
                      </p>
                    </div>
                  </div>

                  {/* Feedback */}
                  {answer?.feedback && (
                    <div className="border-t border-neutral-200 bg-neutral-50 px-5 py-6 sm:px-7">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                        Teacher Feedback
                      </p>

                      <p className="whitespace-pre-wrap text-sm leading-7 text-neutral-700">
                        {answer.feedback}
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {/* Bottom navigation */}
        <div className="mt-12 flex flex-col gap-3 border-t border-black pt-8 sm:flex-row sm:justify-between">
          <button
            onClick={() => router.push("/student/results")}
            className="border border-black px-6 py-3 text-sm font-medium transition hover:bg-black hover:text-white"
          >
            ← Back to Results
          </button>

          <button
            onClick={() => router.push("/student")}
            className="bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-800"
          >
            Student Dashboard →
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-16 border-t border-black">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-7 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="font-serif text-black">
            StudyLab
          </p>

          <p>Learn. Practice. Improve.</p>
        </div>
      </footer>
    </main>
  );
}