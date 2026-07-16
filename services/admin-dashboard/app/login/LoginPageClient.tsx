"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";

type LoginPageClientProps = {
  redirectMessage: string | null;
};

export default function LoginPageClient({ redirectMessage }: LoginPageClientProps) {
  const router = useRouter();
  const { adminProfile, isLoading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && adminProfile) {
      router.replace("/");
    }
  }, [adminProfile, isLoading, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    try {
      await login(email, password);
      router.replace("/");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to sign in.");
    }
  };
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900">
      {/* Background section Heronya */}
      <div className="relative flex-1 bg-linear-gradient-to-b from-blue-700 to-blue-600">
        <Image
          src="/img/bg3striplurus.webp"
          alt="YBB background"
          fill
          priority
          className="pointer-events-none select-none object-cover opacity-70"
        />

        <div className="relative z-10 flex h-full flex-col">
          {/* Space atas */}
          <div className="flex-1" />

          {/* Logo dan Titlenya */}
          <div className="flex flex-col items-center pb-10 text-center text-white">
            <div className="mb-4 flex h-16 w-16 items-center justify-center overflow-hidden">
              <Image
                src="/img/logosYBB.webp"
                alt="YBB Platform logo"
                width={64}
                height={64}
                className="object-contain drop-shadow-sm"
              />
            </div>
            <div className="text-sm font-medium uppercase tracking-[0.18em] text-blue-100">
              Youth Break the Boundaries
            </div>
            <div className="mt-2 text-lg font-semibold">
              Admin &amp; Program Management System
            </div>
          </div>

          {/* Panel putih sama cardnya */}
          <div className="relative mt-auto bg-zinc-50 pb-12 pt-8">
            <div className="pointer-events-none absolute -top-8 left-0 right-0 h-10 bg-zinc-50" />

            <div className="relative z-10 mx-auto flex max-w-3xl justify-center px-4 sm:px-6">
              <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white/95 px-6 py-6 shadow-lg backdrop-blur">
                <div className="mb-5 text-center">
                  <h1 className="text-lg font-semibold text-zinc-900">Welcome Back!</h1>
                  <p className="mt-1 text-xs text-zinc-500">
                    Sign in with your admin credentials to continue.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 text-sm">
                  {redirectMessage ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      {redirectMessage}
                    </div>
                  ) : null}

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-zinc-700">Email</label>
                    <input
                      type="email"
                      placeholder="Enter email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                      className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-zinc-700">Password</label>
                    <input
                      type="password"
                      placeholder="Enter password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {errorMessage ? (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {errorMessage}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={isLoading || !email.trim() || !password.trim()}
                    className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  >
                    {isLoading ? "Signing In..." : "Sign In"}
                  </button>
                </form>

                <p className="mt-4 text-center text-[11px] text-zinc-400">
                  © 2025 Youth Break the Boundaries - Hilmi Farrel Firjatullah.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

