"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useParams, useRouter } from "next/navigation";
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
  order: number;
};

type Exam = {
  title: string;
  description?: string;
  subjectId: string;
  duration: number;
  published: boolean;
};

type AnswerKey = {
  questionId: string;
  examId: string;
  correctAnswer: string;
};

const questionTypeLabels: Record<QuestionType, string> = {
  mcq: "Multiple Choice",
  true_false: "True / False",
  short_answer: "Short Answer",
  descriptive: "Descriptive Answer",
  coding: "Coding Question",
};

export default function QuestionPaperBuilder() {
  const params = useParams();
  const router = useRouter();

  const examId = params.examId as string;

  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [type, setType] = useState<QuestionType>("mcq");
  const [questionText, setQuestionText] = useState("");

  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");

  const [correctAnswer, setCorrectAnswer] = useState("");
  const [marks, setMarks] = useState("1");

  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!examId) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/");
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));

        if (!userDoc.exists() || userDoc.data().role !== "admin") {
          router.push("/");
          return;
        }

        await loadExam();
        await loadQuestions();
      } catch (error) {
        console.error("Load exam error:", error);
        alert("Unable to load exam.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [examId, router]);

  const loadExam = async () => {
    const examRef = doc(db, "exams", examId);
    const examSnap = await getDoc(examRef);

    if (!examSnap.exists()) {
      alert("Exam not found.");
      router.push("/admin/exams");
      return;
    }

    setExam(examSnap.data() as Exam);
  };

  const loadQuestions = async () => {
    const questionsQuery = query(
      collection(db, "questions"),
      where("examId", "==", examId),
      orderBy("order", "asc")
    );

    const questionsSnapshot = await getDocs(questionsQuery);

    /*
     * Load answer keys separately.
     *
     * Answer keys are stored in:
     * answerKeys/{questionId}
     *
     * Students will not have permission to read this collection.
     */
    const answerKeysQuery = query(
      collection(db, "answerKeys"),
      where("examId", "==", examId)
    );

    const answerKeysSnapshot = await getDocs(answerKeysQuery);

    const answerKeyMap: Record<string, AnswerKey> = {};

    answerKeysSnapshot.docs.forEach((answerKeyDoc) => {
      const data = answerKeyDoc.data();

      answerKeyMap[answerKeyDoc.id] = {
        questionId: data.questionId || answerKeyDoc.id,
        examId: data.examId || examId,
        correctAnswer: data.correctAnswer || "",
      };
    });

    const loadedQuestions: Question[] = [];

    /*
     * Migration support:
     *
     * Older questions may still have correctAnswer stored directly
     * inside the question document.
     *
     * If an old question is found:
     * 1. Create its answerKeys document.
     * 2. Remove correctAnswer from the question document.
     *
     * This allows your existing question papers to continue working.
     */
    for (const questionDoc of questionsSnapshot.docs) {
      const data = questionDoc.data();

      let key = answerKeyMap[questionDoc.id];

      const oldCorrectAnswer =
        typeof data.correctAnswer === "string"
          ? data.correctAnswer
          : "";

      if (!key && oldCorrectAnswer) {
        await setDoc(doc(db, "answerKeys", questionDoc.id), {
          questionId: questionDoc.id,
          examId,
          correctAnswer: oldCorrectAnswer,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        });

        await updateDoc(doc(db, "questions", questionDoc.id), {
          correctAnswer: deleteField(),
        });

        key = {
          questionId: questionDoc.id,
          examId,
          correctAnswer: oldCorrectAnswer,
        };
      }

      loadedQuestions.push({
        id: questionDoc.id,
        examId: data.examId,
        type: data.type,
        question: data.question || "",
        options: Array.isArray(data.options) ? data.options : [],
        correctAnswer: key?.correctAnswer || "",
        marks: Number(data.marks || 1),
        order: Number(data.order || 0),
      });
    }

    setQuestions(loadedQuestions);
  };

  const resetForm = () => {
    setType("mcq");
    setQuestionText("");

    setOptionA("");
    setOptionB("");
    setOptionC("");
    setOptionD("");

    setCorrectAnswer("");
    setMarks("1");

    setEditingId(null);
  };

  const handleTypeChange = (newType: QuestionType) => {
    setType(newType);

    setCorrectAnswer("");

    if (newType !== "mcq") {
      setOptionA("");
      setOptionB("");
      setOptionC("");
      setOptionD("");
    }
  };

  const validateForm = () => {
    if (!questionText.trim()) {
      alert("Please enter the question.");
      return false;
    }

    const numericMarks = Number(marks);

    if (!numericMarks || numericMarks <= 0) {
      alert("Marks must be greater than 0.");
      return false;
    }

    if (type === "mcq") {
      if (
        !optionA.trim() ||
        !optionB.trim() ||
        !optionC.trim() ||
        !optionD.trim()
      ) {
        alert("Please enter all four options.");
        return false;
      }

      if (!correctAnswer) {
        alert("Please select the correct answer.");
        return false;
      }
    }

    if (type === "true_false" && !correctAnswer) {
      alert("Please select the correct answer.");
      return false;
    }

    return true;
  };

  const handleSaveQuestion = async () => {
    if (!validateForm()) return;

    setSaving(true);

    try {
      const numericMarks = Number(marks);

      const options =
        type === "mcq"
          ? [
              optionA.trim(),
              optionB.trim(),
              optionC.trim(),
              optionD.trim(),
            ]
          : [];

      const questionOrder = editingId
        ? questions.find((q) => q.id === editingId)?.order ?? 1
        : questions.length + 1;

      /*
       * IMPORTANT:
       *
       * correctAnswer is intentionally NOT stored in questions.
       */
      const questionData = {
        examId,
        type,
        question: questionText.trim(),
        options,
        marks: numericMarks,
        order: questionOrder,
        updatedAt: serverTimestamp(),
      };

      let questionId = editingId;

      if (editingId) {
        /*
         * Update the question itself.
         */
        await updateDoc(
          doc(db, "questions", editingId),
          {
            ...questionData,

            /*
             * Remove the old answer if this was one of the old
             * questions that stored correctAnswer directly.
             */
            correctAnswer: deleteField(),
          }
        );

        /*
         * Update/create the separate answer key.
         */
        await setDoc(
          doc(db, "answerKeys", editingId),
          {
            questionId: editingId,
            examId,
            correctAnswer:
              type === "mcq" || type === "true_false"
                ? correctAnswer
                : "",
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        alert("Question updated successfully.");
      } else {
        /*
         * Create the question without correctAnswer.
         */
        const questionRef = await addDoc(collection(db, "questions"), {
          ...questionData,
          createdAt: serverTimestamp(),
        });

        questionId = questionRef.id;

        /*
         * Create a separate answer key.
         */
        await setDoc(doc(db, "answerKeys", questionRef.id), {
          questionId: questionRef.id,
          examId,
          correctAnswer:
            type === "mcq" || type === "true_false"
              ? correctAnswer
              : "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        alert("Question added successfully.");
      }

      console.log("Saved question:", questionId);

      await loadQuestions();
      resetForm();
    } catch (error) {
      console.error("Save question error:", error);
      alert("Unable to save question.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (question: Question) => {
    setEditingId(question.id);

    setType(question.type);
    setQuestionText(question.question);

    setOptionA(question.options?.[0] || "");
    setOptionB(question.options?.[1] || "");
    setOptionC(question.options?.[2] || "");
    setOptionD(question.options?.[3] || "");

    setCorrectAnswer(question.correctAnswer || "");
    setMarks(String(question.marks));

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleDelete = async (questionId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this question?"
    );

    if (!confirmed) return;

    try {
      /*
       * Delete the question.
       */
      await deleteDoc(doc(db, "questions", questionId));

      /*
       * Delete its answer key too.
       */
      await deleteDoc(doc(db, "answerKeys", questionId));

      await loadQuestions();

      alert("Question deleted.");
    } catch (error) {
      console.error("Delete question error:", error);
      alert("Unable to delete question.");
    }
  };

  const handlePublish = async () => {
    if (questions.length === 0) {
      alert("Add at least one question before publishing.");
      return;
    }

    const confirmed = window.confirm(
      "Publish this exam? Students will be able to see it after publishing."
    );

    if (!confirmed) return;

    try {
      await updateDoc(doc(db, "exams", examId), {
        published: true,
        updatedAt: serverTimestamp(),
      });

      setExam((previous) =>
        previous
          ? {
              ...previous,
              published: true,
            }
          : previous
      );

      alert("Exam published successfully.");
    } catch (error) {
      console.error("Publish exam error:", error);
      alert("Unable to publish exam.");
    }
  };

  const totalMarks = questions.reduce(
    (total, question) => total + Number(question.marks || 0),
    0
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm text-gray-500">Loading exam...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 text-black">
      {/* Header */}
      <header className="border-b border-black bg-black text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <button
            onClick={() => router.push("/admin")}
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center bg-white text-black">
              <span className="font-serif text-xl font-bold">S</span>
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
            onClick={() => router.push("/admin")}
            className="border border-gray-700 px-4 py-2 text-sm transition hover:bg-white hover:text-black"
          >
            Back to Dashboard
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-10">
        {/* Exam Header */}
        <section className="mb-8 border-b border-gray-200 pb-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                Question Paper Builder
              </p>

              <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
                {exam?.title}
              </h1>

              {exam?.description && (
                <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
                  {exam.description}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="border border-gray-200 bg-white px-5 py-3">
                <p className="text-xs uppercase tracking-wider text-gray-400">
                  Questions
                </p>

                <p className="mt-1 text-xl font-semibold">
                  {questions.length}
                </p>
              </div>

              <div className="border border-gray-200 bg-white px-5 py-3">
                <p className="text-xs uppercase tracking-wider text-gray-400">
                  Total Marks
                </p>

                <p className="mt-1 text-xl font-semibold">
                  {totalMarks}
                </p>
              </div>

              <div className="border border-gray-200 bg-white px-5 py-3">
                <p className="text-xs uppercase tracking-wider text-gray-400">
                  Duration
                </p>

                <p className="mt-1 text-xl font-semibold">
                  {exam?.duration} min
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {exam?.published ? (
                <span className="inline-flex border border-black bg-black px-3 py-1 text-xs font-medium uppercase tracking-wider text-white">
                  Published
                </span>
              ) : (
                <span className="inline-flex border border-gray-300 bg-white px-3 py-1 text-xs font-medium uppercase tracking-wider text-gray-600">
                  Draft
                </span>
              )}
            </div>

            {!exam?.published && (
              <button
                onClick={handlePublish}
                className="bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
              >
                Publish Exam
              </button>
            )}
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
          {/* Question Form */}
          <section className="h-fit border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-5 py-5 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                {editingId ? "Edit Question" : "Add Question"}
              </p>

              <h2 className="mt-1 font-serif text-2xl font-semibold">
                Question Details
              </h2>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              {/* Type */}
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Question Type
                </label>

                <select
                  value={type}
                  onChange={(event) =>
                    handleTypeChange(
                      event.target.value as QuestionType
                    )
                  }
                  className="w-full border border-gray-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-black"
                >
                  <option value="mcq">Multiple Choice</option>
                  <option value="true_false">True / False</option>
                  <option value="short_answer">
                    Short Answer
                  </option>
                  <option value="descriptive">
                    Descriptive Answer
                  </option>
                  <option value="coding">
                    Coding Question
                  </option>
                </select>
              </div>

              {/* Question */}
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Question
                </label>

                <textarea
                  value={questionText}
                  onChange={(event) =>
                    setQuestionText(event.target.value)
                  }
                  placeholder="Enter the question..."
                  rows={5}
                  className="w-full resize-none border border-gray-300 px-3 py-3 text-sm outline-none transition focus:border-black"
                />
              </div>

              {/* MCQ Options */}
              {type === "mcq" && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Option A
                    </label>

                    <input
                      value={optionA}
                      onChange={(event) =>
                        setOptionA(event.target.value)
                      }
                      placeholder="Enter option A"
                      className="w-full border border-gray-300 px-3 py-3 text-sm outline-none focus:border-black"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Option B
                    </label>

                    <input
                      value={optionB}
                      onChange={(event) =>
                        setOptionB(event.target.value)
                      }
                      placeholder="Enter option B"
                      className="w-full border border-gray-300 px-3 py-3 text-sm outline-none focus:border-black"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Option C
                    </label>

                    <input
                      value={optionC}
                      onChange={(event) =>
                        setOptionC(event.target.value)
                      }
                      placeholder="Enter option C"
                      className="w-full border border-gray-300 px-3 py-3 text-sm outline-none focus:border-black"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Option D
                    </label>

                    <input
                      value={optionD}
                      onChange={(event) =>
                        setOptionD(event.target.value)
                      }
                      placeholder="Enter option D"
                      className="w-full border border-gray-300 px-3 py-3 text-sm outline-none focus:border-black"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Correct Answer
                    </label>

                    <select
                      value={correctAnswer}
                      onChange={(event) =>
                        setCorrectAnswer(event.target.value)
                      }
                      className="w-full border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-black"
                    >
                      <option value="">
                        Select correct option
                      </option>
                      <option value="A">Option A</option>
                      <option value="B">Option B</option>
                      <option value="C">Option C</option>
                      <option value="D">Option D</option>
                    </select>
                  </div>
                </div>
              )}

              {/* True / False */}
              {type === "true_false" && (
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Correct Answer
                  </label>

                  <select
                    value={correctAnswer}
                    onChange={(event) =>
                      setCorrectAnswer(event.target.value)
                    }
                    className="w-full border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-black"
                  >
                    <option value="">Select answer</option>
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </select>
                </div>
              )}

              {/* Manual Evaluation Notice */}
              {(type === "short_answer" ||
                type === "descriptive" ||
                type === "coding") && (
                <div className="border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Manual Evaluation
                  </p>

                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    Students will submit their answer and the
                    teacher will manually review and assign marks.
                  </p>
                </div>
              )}

              {/* Marks */}
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Marks
                </label>

                <input
                  type="number"
                  min="1"
                  value={marks}
                  onChange={(event) =>
                    setMarks(event.target.value)
                  }
                  className="w-full border border-gray-300 px-3 py-3 text-sm outline-none focus:border-black"
                />
              </div>

              {/* Buttons */}
              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <button
                  onClick={handleSaveQuestion}
                  disabled={saving}
                  className="flex-1 bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingId
                    ? "Update Question"
                    : "Add Question"}
                </button>

                {editingId && (
                  <button
                    onClick={resetForm}
                    className="border border-gray-300 bg-white px-5 py-3 text-sm font-medium transition hover:border-black"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Question List */}
          <section>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                  Question Paper
                </p>

                <h2 className="mt-1 font-serif text-2xl font-semibold">
                  {questions.length === 0
                    ? "No questions yet"
                    : `${questions.length} ${
                        questions.length === 1
                          ? "Question"
                          : "Questions"
                      }`}
                </h2>
              </div>
            </div>

            {questions.length === 0 ? (
              <div className="border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center border border-gray-200 font-serif text-xl">
                  ?
                </div>

                <h3 className="mt-5 font-serif text-xl font-semibold">
                  Your question paper is empty
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
                  Add your first question using the form. You can
                  mix objective and manually evaluated questions.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((question, index) => (
                  <article
                    key={question.id}
                    className="border border-gray-200 bg-white"
                  >
                    <div className="flex flex-col gap-4 p-5 sm:p-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex gap-4">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-black text-sm font-semibold text-white">
                            {index + 1}
                          </div>

                          <div>
                            <span className="inline-block border border-gray-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                              {questionTypeLabels[question.type]}
                            </span>

                            <h3 className="mt-3 text-base font-medium leading-7">
                              {question.question}
                            </h3>
                          </div>
                        </div>

                        <div className="shrink-0 text-left sm:text-right">
                          <p className="text-xs uppercase tracking-wider text-gray-400">
                            Marks
                          </p>

                          <p className="mt-1 text-lg font-semibold">
                            {question.marks}
                          </p>
                        </div>
                      </div>

                      {/* MCQ Preview */}
                      {question.type === "mcq" &&
                        question.options &&
                        question.options.length > 0 && (
                          <div className="ml-0 grid gap-2 sm:ml-13 sm:grid-cols-2">
                            {question.options.map(
                              (option, optionIndex) => {
                                const letter =
                                  String.fromCharCode(
                                    65 + optionIndex
                                  );

                                const isCorrect =
                                  question.correctAnswer ===
                                  letter;

                                return (
                                  <div
                                    key={letter}
                                    className={`border px-3 py-2 text-sm ${
                                      isCorrect
                                        ? "border-black bg-gray-100 font-medium"
                                        : "border-gray-200"
                                    }`}
                                  >
                                    <span className="mr-2 font-semibold">
                                      {letter}.
                                    </span>

                                    {option}

                                    {isCorrect && (
                                      <span className="ml-2 text-xs uppercase tracking-wider text-gray-500">
                                        Correct
                                      </span>
                                    )}
                                  </div>
                                );
                              }
                            )}
                          </div>
                        )}

                      {/* True False Preview */}
                      {question.type === "true_false" && (
                        <div className="text-sm text-gray-600">
                          Correct answer:{" "}
                          <span className="font-semibold text-black">
                            {question.correctAnswer === "true"
                              ? "True"
                              : "False"}
                          </span>
                        </div>
                      )}

                      {/* Manual Review */}
                      {(question.type === "short_answer" ||
                        question.type === "descriptive" ||
                        question.type === "coding") && (
                        <div className="border-t border-gray-100 pt-4 text-xs text-gray-500">
                          Teacher evaluation required
                        </div>
                      )}

                      <div className="flex flex-col gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
                        <button
                          onClick={() => handleEdit(question)}
                          className="border border-gray-300 px-4 py-2 text-sm transition hover:border-black"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => handleDelete(question.id)}
                          className="border border-gray-300 px-4 py-2 text-sm text-gray-600 transition hover:border-black hover:text-black"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="font-serif text-base text-black">
            StudyLab
          </p>

          <p>Learn. Practice. Improve.</p>
        </div>
      </footer>
    </main>
  );
}