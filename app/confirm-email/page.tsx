"use client";

import { useState, useEffect, Suspense } from "react";
import LogoVerticalIcon from "@/components/icons/LogoVerticalIcon";
import Link from "next/link";
import VersionDisplay from "@/components/VersionDisplay";
import { useSearchParams } from "next/navigation";

function ConfirmEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleResendEmail = async () => {
    if (!email || countdown > 0) return;

    setResendStatus("sending");

    try {
      const response = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setResendStatus("sent");
        setCountdown(60); // 60 second cooldown
      } else {
        setResendStatus("error");
      }
    } catch (error) {
      console.error("Error resending email:", error);
      setResendStatus("error");
    }

    // Reset status after 3 seconds (except countdown)
    setTimeout(() => {
      if (countdown === 0) setResendStatus("idle");
    }, 3000);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8"
      style={{
        backgroundImage: "url('/cover.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="max-w-md w-full space-y-8 bg-white/95 backdrop-blur-sm p-8 rounded-lg shadow-xl">
        <div>
          <div className="flex justify-center mb-6">
            <LogoVerticalIcon className="h-20 w-auto" />
          </div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            Check Your Email
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            We&apos;ve sent you a confirmation email
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <div className="rounded-md bg-blue-50 p-4 border border-blue-200">
            <div className="flex">
              <div className="shrink-0">
                <svg
                  className="h-5 w-5 text-blue-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-blue-800">
                  Confirmation email sent
                </h3>
                {email && (
                  <p className="mt-2 text-sm text-blue-700">
                    We sent a confirmation link to <strong>{email}</strong>
                  </p>
                )}
                <div className="mt-4 text-sm text-blue-700">
                  <p className="font-medium mb-2">Next steps:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Check your email inbox</li>
                    <li>Click the confirmation link in the email</li>
                    <li>You&apos;ll be redirected back to login</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-md bg-yellow-50 p-4 border border-yellow-200">
            <div className="flex">
              <div className="shrink-0">
                <svg
                  className="h-5 w-5 text-yellow-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Didn&apos;t receive the email?
                </h3>
                <div className="mt-2 text-sm text-yellow-700 space-y-1">
                  <p>• Check your spam or junk folder</p>
                  <p>• Make sure you entered the correct email</p>
                  <p>• Wait a few minutes for the email to arrive</p>
                </div>
              </div>
            </div>
          </div>

          {email && (
            <div className="text-center">
              <button
                type="button"
                onClick={handleResendEmail}
                disabled={resendStatus === "sending" || countdown > 0}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md
                  ${
                    countdown > 0 || resendStatus === "sending"
                      ? "text-gray-400 bg-gray-100 cursor-not-allowed"
                      : "text-blue-700 bg-blue-100 hover:bg-blue-200"
                  }
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors`}
              >
                {resendStatus === "sending" && "Sending..."}
                {resendStatus === "sent" && "Email sent!"}
                {resendStatus === "error" && "Failed to send"}
                {resendStatus === "idle" &&
                  (countdown > 0
                    ? `Resend in ${countdown}s`
                    : "Resend confirmation email")}
              </button>
            </div>
          )}

          <div className="flex items-center justify-center space-x-4 pt-4">
            <Link
              href="/login"
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              Back to login
            </Link>
            <span className="text-gray-300">|</span>
            <Link
              href="/signup"
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              Sign up with different email
            </Link>
          </div>
        </div>

        <VersionDisplay />
      </div>
    </div>
  );
}

export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <ConfirmEmailContent />
    </Suspense>
  );
}
