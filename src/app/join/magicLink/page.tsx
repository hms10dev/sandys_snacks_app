//Join Page

"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function JoinPage() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    dietaryPreferences: "",
  });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCount, setResendCount] = useState(0);

  // Check for URL error params on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlError = urlParams.get("error");

    if (urlError) {
      switch (urlError) {
        case "auth_failed":
          setError("Authentication failed. Please try signing in again.");
          break;
        case "no_session":
          setError("Session expired. Please request a new magic link.");
          break;
        case "callback_failed":
          setError("Something went wrong during sign-in. Please try again.");
          break;
        default:
          setError("Something went wrong. Please try again.");
      }

      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Trim and validate form data
      const trimmedData = {
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        dietaryPreferences: formData.dietaryPreferences.trim(),
      };

      // Enhanced validation
      if (!trimmedData.fullName) {
        throw new Error("Please enter your full name");
      }
      if (trimmedData.fullName.length < 2) {
        throw new Error("Please enter a valid full name");
      }
      if (!trimmedData.email) {
        throw new Error("Please enter your email address");
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedData.email)) {
        throw new Error("Please enter a valid email address");
      }

      console.log("Attempting to send magic link to:", trimmedData.email);

      // Send magic link
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: trimmedData.email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: trimmedData.fullName,
            dietary_preferences: trimmedData.dietaryPreferences || null,
          },
        },
      });

      if (authError) {
        console.error("Auth error:", authError);

        // Handle specific Supabase auth errors
        if (
          authError.message.includes("rate limit") ||
          authError.message.includes("too many")
        ) {
          throw new Error(
            "Whoa there! Too many requests. Please wait a few minutes before trying again."
          );
        } else if (
          authError.message.includes("invalid email") ||
          authError.message.includes("valid email")
        ) {
          throw new Error(
            "That doesn’t look like a valid email address. Mind double-checking?"
          );
        } else if (
          authError.message.includes("network") ||
          authError.message.includes("connection")
        ) {
          throw new Error(
            "Network hiccup! Check your connection and try again."
          );
        } else {
          throw new Error(`Oops! ${authError.message}`);
        }
      }

      // Store profile data as backup (in case user metadata doesn’t work)
      try {
        localStorage.setItem(
          "pendingProfile",
          JSON.stringify({
            full_name: trimmedData.fullName,
            email: trimmedData.email,
            dietary_preferences: trimmedData.dietaryPreferences || null,
          })
        );
      } catch (storageError) {
        console.warn(
          "Could not store profile data in localStorage:",
          storageError
        );
        // Not critical, continue anyway
      }

      console.log("Magic link sent successfully");
      setSent(true);
    } catch (error) {
      console.error("Join form error:", error);
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleRetry() {
    setError(null);
    setSent(false);
    setLoading(false);
  }

  async function handleResendEmail() {
    if (resendCount >= 3) {
      setError(
        "You’ve reached the resend limit. Please wait 10 minutes before trying again."
      );
      return;
    }

    setError(null);
    setResendCount((prev) => prev + 1);

    // Re-trigger the form submission
    const fakeEvent = {
      preventDefault: () => {},
    } as React.FormEvent;

    await handleSubmit(fakeEvent);
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 text-center shadow-lg">
          <div className="text-4xl mb-4">✨</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Magic link sent!
          </h1>
          <p className="text-gray-600 mb-6">
            Check your email at <strong>{formData.email}</strong> for your magic
            link to Sandy’s Snacks!
          </p>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-orange-800">
              <strong>Pro tip:</strong> Check your spam folder if you don’t see
              it in a few minutes.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-gray-500">Still nothing?</p>
            {resendCount < 3 ? (
              <button
                onClick={handleResendEmail}
                disabled={loading}
                className="text-orange-600 hover:text-orange-700 font-medium text-sm underline disabled:opacity-50"
              >
                {loading
                  ? "Sending..."
                  : `Resend magic link ${
                      resendCount > 0 ? `(${resendCount}/3)` : ""
                    }`}
              </button>
            ) : (
              <p className="text-sm text-red-600">
                Too many attempts. Please wait 10 minutes before trying again.
              </p>
            )}

            <div className="pt-2">
              <button
                onClick={() => {
                  setSent(false);
                  setResendCount(0);
                  setError(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-sm underline"
              >
                ← Back to form
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-lg">
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">🍪</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Join Sandy’s Snacks
          </h1>
          <p className="text-gray-600">
            Ready for expertly curated office treats?
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start">
              <div className="text-red-400 mr-3 mt-0.5">⚠️</div>
              <div className="flex-1">
                <p className="text-red-800 text-sm font-medium mb-2">
                  Oops! Something went wrong
                </p>
                <p className="text-red-700 text-sm mb-3">{error}</p>
                <button
                  onClick={handleRetry}
                  className="text-red-600 hover:text-red-700 text-sm font-medium underline"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name *
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) =>
                setFormData({ ...formData, fullName: e.target.value })
              }
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
              required
              disabled={loading}
              placeholder="Enter your full name"
              minLength={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Work Email *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
              required
              disabled={loading}
              placeholder="your.email@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dietary Preferences (Optional)
            </label>
            <textarea
              value={formData.dietaryPreferences}
              onChange={(e) =>
                setFormData({ ...formData, dietaryPreferences: e.target.value })
              }
              placeholder="Any allergies or preferences Sandy should know about?"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors resize-none"
              rows={3}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={
              loading || !formData.fullName.trim() || !formData.email.trim()
            }
            className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 text-white py-3 px-6 rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Sending Magic Link...
              </span>
            ) : (
              "Join the Squad"
            )}
          </button>
        </form>

        <div className="mt-6">
          <p className="text-xs text-gray-500 text-center">
            $5/month • Expert curation by Sandy • Cancel anytime
          </p>
          <p className="text-xs text-gray-400 text-center mt-2">
            * Required fields
          </p>
        </div>
      </div>
    </div>
  );
}
