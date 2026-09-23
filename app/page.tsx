
"use client";

import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";

export default function HomePage() {
  const router = useRouter();

  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCheckingAuth(false);
        return;
      }

      try {
        const userSnapshot = await getDoc(
          doc(db, "users", user.uid)
        );

        if (!userSnapshot.exists()) {
          setCheckingAuth(false);
          return;
        }

        const role = userSnapshot.data().role;

        if (role === "admin") {
          router.push("/admin");
        } else if (role === "student") {
          router.push("/student");
        } else {
          setCheckingAuth(false);
        }
      } catch (err) {
        console.error(err);
        setCheckingAuth(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      if (isRegistering) {
        if (!name.trim()) {
          throw new Error("Please enter your name.");
        }

        const userCredential =
          await createUserWithEmailAndPassword(
            auth,
            email,
            password
          );

        await setDoc(doc(db, "users", userCredential.user.uid), {
          name: name.trim(),
          email: userCredential.user.email,
          role: "student",
        });

        router.push("/student");
      } else {
        const userCredential =
          await signInWithEmailAndPassword(
            auth,
            email,
            password
          );

        const userSnapshot = await getDoc(
          doc(db, "users", userCredential.user.uid)
        );

        if (!userSnapshot.exists()) {
          throw new Error(
            "Your account profile was not found. Please contact the administrator."
          );
        }

        const role = userSnapshot.data().role;

        if (role === "admin") {
          router.push("/admin");
        } else if (role === "student") {
          router.push("/student");
        } else {
          throw new Error("Invalid account role.");
        }
      }
    } catch (err: any) {
      console.error(err);

      let message = "Something went wrong. Please try again.";

      if (err?.code === "auth/invalid-credential") {
        message = "Incorrect email or password.";
      } else if (err?.code === "auth/email-already-in-use") {
        message = "An account with this email already exists.";
      } else if (err?.code === "auth/weak-password") {
        message = "Password should be at least 6 characters.";
      } else if (err?.code === "auth/invalid-email") {
        message = "Please enter a valid email address.";
      } else if (err?.message) {
        message = err.message;
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white">
            <span className="font-serif text-xl font-bold">
              S
            </span>
          </div>

          <p className="mt-4 text-sm text-neutral-500">
            Loading StudyLab...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-black">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Left Brand Section */}
        <section className="relative hidden overflow-hidden bg-black text-white lg:flex lg:min-h-screen lg:flex-col lg:justify-between">
          {/* Decorative elements */}
          <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full border border-neutral-800" />
          <div className="absolute -bottom-40 -left-32 h-96 w-96 rounded-full border border-neutral-800" />

          <div className="relative z-10 p-10 xl:p-14">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-black">
                <span className="font-serif text-xl font-bold">
                  S
                </span>
              </div>

              <div>
                <div className="font-serif text-xl font-semibold">
                  StudyLab
                </div>

                <div className="text-[9px] uppercase tracking-[0.25em] text-neutral-500">
                  Learn. Practice. Improve.
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 px-10 pb-16 xl:px-14 xl:pb-20">
            <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-500">
              Your learning space
            </p>

            <h1 className="max-w-xl font-serif text-5xl font-semibold leading-[1.05] tracking-tight xl:text-6xl">
              Learn with purpose.
              <br />
              Improve with practice.
            </h1>

            <p className="mt-7 max-w-lg text-sm leading-7 text-neutral-400">
              StudyLab brings learning, practice, assessment and
              feedback together in one simple academic workspace.
            </p>

            <div className="mt-10 flex items-center gap-3">
              <div className="h-px w-12 bg-neutral-700" />
              <span className="text-[10px] uppercase tracking-[0.25em] text-neutral-500">
                Learn · Practice · Improve
              </span>
            </div>
          </div>

          <div className="relative z-10 px-10 pb-8 xl:px-14">
            <p className="text-xs text-neutral-600">
              © 2026 StudyLab · Created by @SSK
            </p>
          </div>
        </section>

        {/* Right Login Section */}
        <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="mb-12 lg:hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-black text-white">
                  <span className="font-serif text-xl font-bold">
                    S
                  </span>
                </div>

                <div>
                  <div className="font-serif text-xl font-semibold">
                    StudyLab
                  </div>

                  <div className="text-[9px] uppercase tracking-[0.25em] text-neutral-400">
                    Learn. Practice. Improve.
                  </div>
                </div>
              </div>
            </div>

            {/* Heading */}
            <div className="mb-8">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                {isRegistering ? "Create Account" : "Welcome Back"}
              </p>

              <h2 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
                {isRegistering ? "Join StudyLab." : "Welcome to StudyLab."}
              </h2>

              <p className="mt-4 max-w-sm text-sm leading-6 text-neutral-500">
                {isRegistering
                  ? "Create your student account and start your learning journey."
                  : "Sign in to continue your learning journey."}
              </p>
            </div>

            {/* Form Card */}
            <div className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
              <form
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                {isRegistering && (
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                      Full Name
                    </label>

                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full rounded-xl border border-neutral-200 bg-[#f7f7f5] px-4 py-3.5 text-sm outline-none transition placeholder:text-neutral-400 focus:border-black focus:bg-white"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                    Email Address
                  </label>

                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-neutral-200 bg-[#f7f7f5] px-4 py-3.5 text-sm outline-none transition placeholder:text-neutral-400 focus:border-black focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                    Password
                  </label>

                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-xl border border-neutral-200 bg-[#f7f7f5] px-4 py-3.5 text-sm outline-none transition placeholder:text-neutral-400 focus:border-black focus:bg-white"
                    required
                  />
                </div>

                {error && (
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-5 text-neutral-600">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-between rounded-xl bg-black px-5 py-3.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span>
                    {loading
                      ? "Please wait..."
                      : isRegistering
                        ? "Create Account"
                        : "Sign In"}
                  </span>

                  {!loading && (
                    <span className="text-neutral-400">
                      →
                    </span>
                  )}
                </button>
              </form>

              {/* Switch Mode */}
              <div className="mt-7 border-t border-neutral-100 pt-6 text-center">
                <p className="text-sm text-neutral-500">
                  {isRegistering
                    ? "Already have an account?"
                    : "Don't have a student account?"}
                </p>

                <button
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setError("");
                  }}
                  className="mt-2 text-sm font-semibold text-black underline decoration-neutral-300 underline-offset-4 transition hover:decoration-black"
                >
                  {isRegistering
                    ? "Sign in instead"
                    : "Create a student account"}
                </button>
              </div>
            </div>

            {/* Small Trust Note */}
            <div className="mt-6 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.14em] text-neutral-400">
              <span className="h-1.5 w-1.5 rounded-full bg-black" />
              Secure academic workspace
            </div>

            {/* Mobile Footer */}
            <p className="mt-10 text-center text-xs text-neutral-400 lg:hidden">
              © 2026 StudyLab · Created by @SSK
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

