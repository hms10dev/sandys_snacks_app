"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import LoadingState from "@/components/LoadingState";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  SNACK_REQUEST_STATUS_BADGE_CLASSES,
  SNACK_REQUEST_STATUS_LABELS,
  type SnackRequestWithProfile,
} from "@/lib/snackRequests";

type SnackRequestResponse = {
  data: SnackRequestWithProfile[];
};

type SnackRequestPostResponse = {
  data: SnackRequestWithProfile;
};

export default function SnackRequestsPage() {
  const { user, loading: authLoading, error: authError, profile } = useAuth();
  const [requests, setRequests] = useState<SnackRequestWithProfile[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!user) {
      setRequests([]);
      return;
    }

    setDataLoading(true);
    setDataError(null);

    try {
      const response = await fetch("/api/snack-requests");

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error || "We couldn’t load your snack ideas.");
      }

      const body = (await response.json()) as SnackRequestResponse;
      setRequests(body.data ?? []);
    } catch (err) {
      console.error("[requests] Failed to fetch", err);
      setDataError(
        err instanceof Error
          ? err.message
          : "We couldn’t load your snack ideas. Please try again."
      );
    } finally {
      setDataLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchRequests().catch((err) => {
        console.error("[requests] initial load failed", err);
      });
    }
  }, [user, fetchRequests]);

  const pendingCount = useMemo(
    () => requests.filter((request) => request.status === "pending").length,
    [requests]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user || submitting) return;

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      snackName: (formData.get("snackName") as string | null) ?? "",
      details: (formData.get("details") as string | null) ?? "",
      source: (formData.get("source") as string | null) ?? "",
    };

    try {
      const response = await fetch("/api/snack-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error || "We couldn’t save that idea. Try again.");
      }

      const body = (await response.json()) as SnackRequestPostResponse;

      setRequests((prev) => [body.data, ...prev]);
      setSubmitSuccess("Thanks! Your idea is now in Sandy’s queue.");
      event.currentTarget.reset();
    } catch (err) {
      console.error("[requests] submit failed", err);
      setSubmitError(
        err instanceof Error
          ? err.message
          : "We couldn’t save that idea. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return (
      <LoadingState
        title="Loading the request counter"
        message="Collecting your snack suggestions."
      />
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-lg text-center">
          <div className="text-4xl mb-4">😵‍💫</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">We hit a snack snag</h1>
          <p className="text-gray-600 mb-6">{authError}</p>
          <a
            href="/join"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 transition"
          >
            Head back to sign in
          </a>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-lg text-center">
          <div className="text-4xl mb-4">🔐</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Sign in required</h1>
          <p className="text-gray-600 mb-6">
            Sign in to pitch your next snack idea to Sandy’s crew.
          </p>
          <a
            href="/join"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 transition"
          >
            Go to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-white rounded-2xl p-8 shadow-sm">
          <p className="text-sm uppercase tracking-wide text-gray-500">Snack wishlist</p>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">
            Share a snack idea, {profile?.full_name || "snack fan"}!
          </h1>
          <p className="text-gray-600 mt-2">
            Tell Sandy what treats the office should try next. We’ll keep you posted as your idea moves through the queue.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Submit a new request</h2>
          <p className="text-sm text-gray-500 mb-6">
            Give us the details so we can track it down.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="snackName">
                Snack name
              </label>
              <input
                id="snackName"
                name="snackName"
                type="text"
                required
                placeholder="e.g. Chili Lime Plantain Chips"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                disabled={submitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="details">
                What makes it special?
              </label>
              <textarea
                id="details"
                name="details"
                rows={4}
                placeholder="Share the flavor notes, why it’s a hit, or who would love it."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                disabled={submitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="source">
                Where can we find it? (optional)
              </label>
              <input
                id="source"
                name="source"
                type="text"
                placeholder="Drop a store, site, or link."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                disabled={submitting}
              />
            </div>

            {submitError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {submitError}
              </div>
            )}

            {submitSuccess && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                {submitSuccess}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2 font-medium text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Sending idea...
                </>
              ) : (
                <>Submit request</>
              )}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Your requests</h2>
              <p className="text-sm text-gray-500">
                {pendingCount > 0
                  ? `${pendingCount} waiting for Sandy’s review.`
                  : "No pending requests right now."}
              </p>
            </div>
            <button
              onClick={() => fetchRequests()}
              className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm font-medium text-orange-600 transition hover:border-orange-300 hover:text-orange-700"
              disabled={dataLoading}
            >
              {dataLoading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-orange-200 border-t-orange-500" />
                  Refreshing
                </>
              ) : (
                <>
                  <span aria-hidden>⟳</span>
                  Refresh list
                </>
              )}
            </button>
          </div>

          {dataError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-4">
              {dataError}
            </div>
          )}

          {dataLoading && requests.length === 0 ? (
            <div className="text-sm text-gray-500">Loading your snack ideas...</div>
          ) : requests.length === 0 ? (
            <p className="text-sm text-gray-500">
              You haven’t sent Sandy any snack ideas yet. Submit one above to get started!
            </p>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-xl border border-gray-200 p-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {request.snack_name}
                      </h3>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${SNACK_REQUEST_STATUS_BADGE_CLASSES[request.status]}`}
                      >
                        {SNACK_REQUEST_STATUS_LABELS[request.status]}
                      </span>
                    </div>
                    {request.details && (
                      <p className="text-sm text-gray-600 mt-2 whitespace-pre-line">
                        {request.details}
                      </p>
                    )}
                    {request.source && (
                      <p className="text-xs text-gray-500 mt-2">
                        <span className="font-medium text-gray-700">Where to find it:</span> {request.source}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-3">
                      Submitted {new Date(request.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
