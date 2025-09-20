"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import LoadingState from "@/components/LoadingState";
import { useAuth } from "@/lib/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import {
  SNACK_REQUEST_STATUS_BADGE_CLASSES,
  SNACK_REQUEST_STATUS_LABELS,
  SNACK_REQUEST_STATUSES,
  SNACK_REQUEST_STATUS_SHORT_LABELS,
  type SnackRequestStatus,
  type SnackRequestWithProfile,
} from "@/lib/snackRequests";

type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  dietary_preferences: string | null;
  role: string | null;
  created_at?: string;
  paymentStatus?: {
    user_id: string;
    month: string;
    paid: boolean;
    note?: string | null;
  } | null;
};

type Snack = {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  created_at: string;
};

type SnackRequestResponse = {
  data: SnackRequestWithProfile[];
};

type SnackRequestUpdateResponse = {
  data: SnackRequestWithProfile;
};

const REQUEST_FILTER_OPTIONS: (SnackRequestStatus | "all")[] = [
  "all",
  ...SNACK_REQUEST_STATUSES,
];

const REQUEST_FILTER_LABELS: Record<SnackRequestStatus | "all", string> = {
  all: "All",
  pending: SNACK_REQUEST_STATUS_SHORT_LABELS.pending,
  accepted: SNACK_REQUEST_STATUS_SHORT_LABELS.accepted,
  fulfilled: SNACK_REQUEST_STATUS_SHORT_LABELS.fulfilled,
  declined: SNACK_REQUEST_STATUS_SHORT_LABELS.declined,
};

type RequestAction = {
  label: string;
  status: SnackRequestStatus;
  style: string;
};

const REQUEST_ACTIONS: Record<SnackRequestStatus, RequestAction[]> = {
  pending: [
    {
      label: "Mark accepted",
      status: "accepted",
      style: "bg-green-100 text-green-700 hover:bg-green-200",
    },
    {
      label: "Mark fulfilled",
      status: "fulfilled",
      style: "bg-blue-100 text-blue-700 hover:bg-blue-200",
    },
    {
      label: "Decline",
      status: "declined",
      style: "bg-red-100 text-red-600 hover:bg-red-200",
    },
  ],
  accepted: [
    {
      label: "Mark fulfilled",
      status: "fulfilled",
      style: "bg-blue-100 text-blue-700 hover:bg-blue-200",
    },
    {
      label: "Move to pending",
      status: "pending",
      style: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200",
    },
    {
      label: "Decline",
      status: "declined",
      style: "bg-red-100 text-red-600 hover:bg-red-200",
    },
  ],
  fulfilled: [
    {
      label: "Reopen request",
      status: "pending",
      style: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    },
  ],
  declined: [
    {
      label: "Reopen request",
      status: "pending",
      style: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    },
  ],
};

export default function AdminPanel() {
  const {
    user,
    loading: authLoading,
    profile,
    isAdmin,
    error: authError,
  } = useAuth();
  const [isClient, setIsClient] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [snacks, setSnacks] = useState<Snack[]>([]);
  const [snackRequests, setSnackRequests] = useState<SnackRequestWithProfile[]>([]);
  const [requestFilter, setRequestFilter] = useState<SnackRequestStatus | "all">("pending");
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const currentMonthDate = useMemo(
    () => new Date(`${currentMonth}-01`),
    [currentMonth]
  );

  useEffect(() => {
    setIsClient(true);
  }, []);

  const refreshAdminData = useCallback(
    async (showFullScreen = false) => {
      if (showFullScreen) {
        setDataLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setDataError(null);

      try {
        const requestsPromise = fetch(
          "/api/snack-requests?status=pending,accepted,fulfilled,declined",
          {
            cache: "no-store",
          }
        );

        const [profilesResult, paymentsResult, snacksResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, email, full_name, dietary_preferences, role, created_at")
            .order("created_at", { ascending: false }),
          supabase
            .from("payments_manual")
            .select("user_id, month, paid, note")
            .eq("month", currentMonth),
          supabase
            .from("snacks")
            .select("id, name, description, photo_url, created_at")
            .order("created_at", { ascending: false }),
        ]);

        const requestsResponse = await requestsPromise;
        const requestsBody = (await requestsResponse.json().catch(() => null)) as
          | (SnackRequestResponse & { error?: string })
          | { error?: string }
          | null;

        const { data: profiles, error: profilesError } = profilesResult;
        const { data: payments, error: paymentsError } = paymentsResult;
        const { data: snacksData, error: snacksError } = snacksResult;

        if (profilesError || paymentsError || snacksError) {
          throw profilesError || paymentsError || snacksError;
        }

        if (!requestsResponse.ok) {
          throw new Error(
            requestsBody?.error || "We couldn’t load the latest snack requests."
          );
        }

        const usersWithPayments =
          profiles?.map((person) => ({
            ...person,
            paymentStatus: payments?.find((p) => p.user_id === person.id) ?? null,
          })) ?? [];

        setUsers(usersWithPayments);
        setSnacks(snacksData ?? []);
        setSnackRequests((requestsBody?.data ?? []) as SnackRequestWithProfile[]);
      } catch (err) {
        console.error("[admin] Failed to refresh data", err);
        setDataError("We couldn’t load the latest admin data. Please try refreshing.");
      } finally {
        setDataLoading(false);
        setIsRefreshing(false);
      }
    },
    [currentMonth]
  );

  useEffect(() => {
    if (isClient && isAdmin) {
      refreshAdminData(true).catch((err) => {
        console.error("[admin] Initial data load failed", err);
      });
    }
  }, [isClient, isAdmin, refreshAdminData]);

  const totalMembers = users.length;
  const paidMembers = users.filter((person) => person.paymentStatus?.paid).length;
  const pendingMembers = Math.max(totalMembers - paidMembers, 0);
  const paymentRate = totalMembers ? Math.round((paidMembers / totalMembers) * 100) : 0;
  const totalRequests = snackRequests.length;
  const pendingRequestsCount = useMemo(
    () => snackRequests.filter((request) => request.status === "pending").length,
    [snackRequests]
  );
  const filteredRequests = useMemo(() => {
    if (requestFilter === "all") {
      return snackRequests;
    }
    return snackRequests.filter((request) => request.status === requestFilter);
  }, [snackRequests, requestFilter]);

  if (!isClient || authLoading) {
    return (
      <LoadingState
        title="Checking your snack credentials"
        message="Making sure you have the right sprinkles to access the admin kitchen."
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
            You’ll need to sign in before you can manage Sandy’s snack squad.
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

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-lg text-center">
          <div className="text-4xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access denied</h1>
          <p className="text-gray-600 mb-6">
            This page is for Sandy’s snack captains only. If this is unexpected,
            reach out to Sandy so we can get you the right apron.
          </p>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-800 transition"
          >
            Back to dashboard
          </a>
        </div>
      </div>
    );
  }

  if (dataLoading) {
    return (
      <LoadingState
        title="Stocking the snack shelves"
        message="Grabbing member info, payments, and the latest treats."
      />
    );
  }

  async function updateRequestStatus(
    requestId: string,
    nextStatus: SnackRequestStatus
  ) {
    setDataError(null);
    setUpdatingRequestId(requestId);

    try {
      const response = await fetch(`/api/snack-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const body = (await response.json().catch(() => null)) as
        | (SnackRequestUpdateResponse & { error?: string })
        | { error?: string }
        | null;

      if (!response.ok || !body || !("data" in body)) {
        throw new Error(
          (body as { error?: string } | null)?.error ||
            "We couldn’t update that request. Please try again."
        );
      }

      const updatedRequest = (body as SnackRequestUpdateResponse).data;

      setSnackRequests((previous) =>
        previous.map((request) =>
          request.id === requestId ? updatedRequest : request
        )
      );
    } catch (err) {
      console.error("[admin] Failed to update snack request", err);
      setDataError(
        err instanceof Error
          ? err.message
          : "We couldn’t update that request. Please try again."
      );
    } finally {
      setUpdatingRequestId(null);
    }
  }

  async function togglePayment(userId: string, currentPaid: boolean) {
    setDataError(null);

    try {
      if (currentPaid) {
        const { error } = await supabase
          .from("payments_manual")
          .delete()
          .eq("user_id", userId)
          .eq("month", currentMonth);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("payments_manual").upsert({
          user_id: userId,
          month: currentMonth,
          paid: true,
          note: "Marked by admin",
        });

        if (error) throw error;
      }

      await refreshAdminData();
    } catch (err) {
      console.error("[admin] Failed to toggle payment", err);
      setDataError("We couldn’t update that payment. Please try again.");
    }
  }

  async function uploadSnack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploading(true);
    setDataError(null);

    const formData = new FormData(event.currentTarget);
    const name = (formData.get("name") as string)?.trim();
    const description = (formData.get("description") as string)?.trim() || null;
    const file = formData.get("photo") as File | null;

    if (!name) {
      setDataError("Please add a name for the snack before uploading.");
      setUploading(false);
      return;
    }

    try {
      let photoUrl = "";

      if (file && file.size > 0) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("snacks")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("snacks").getPublicUrl(fileName);
        photoUrl = data.publicUrl;
      }

      const { error: insertError } = await supabase.from("snacks").insert({
        name,
        description,
        photo_url: photoUrl || null,
      });

      if (insertError) throw insertError;

      event.currentTarget.reset();
      await refreshAdminData();
    } catch (err) {
      console.error("[admin] Snack upload failed", err);
      setDataError("We couldn’t upload that snack. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-gray-500">Admin control center</p>
            <h1 className="text-3xl font-bold text-gray-900 mt-2">
              Welcome back, {profile?.full_name || "Snack Captain"}
            </h1>
            <p className="text-gray-600 mt-1">
              Manage members, keep payments in sync, and spotlight the newest treats.
            </p>
          </div>
          <button
            onClick={() => refreshAdminData()}
            className="inline-flex items-center gap-2 self-start rounded-lg border border-orange-200 bg-white px-4 py-2 text-sm font-medium text-orange-600 transition hover:border-orange-300 hover:text-orange-700"
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-orange-200 border-t-orange-500" />
                Refreshing
              </>
            ) : (
              <>
                <span aria-hidden>⟳</span>
                Refresh data
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Active members</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{totalMembers}</p>
            <p className="text-sm text-gray-500 mt-1">{paidMembers} paid • {pendingMembers} pending</p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Payment completion</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{paymentRate}%</p>
            <p className="text-sm text-gray-500 mt-1">
              for {currentMonthDate.toLocaleString("default", { month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Snacks featured</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{snacks.length}</p>
            <p className="text-sm text-gray-500 mt-1">Uploaded treats available to members</p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Pending snack ideas</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{pendingRequestsCount}</p>
            <p className="text-sm text-gray-500 mt-1">{totalRequests} total submissions</p>
          </div>
        </div>

        {dataError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {dataError}
          </div>
        )}

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Snack requests</h2>
              <p className="text-sm text-gray-500">
                Review member submissions and keep everyone updated on their status.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {REQUEST_FILTER_OPTIONS.map((option) => {
                const isActive = requestFilter === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setRequestFilter(option)}
                    className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                      isActive
                        ? "bg-orange-500 text-white shadow"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {REQUEST_FILTER_LABELS[option]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {filteredRequests.length === 0 ? (
              <p className="text-sm text-gray-500">
                {snackRequests.length === 0
                  ? "No snack requests submitted yet."
                  : "No snack requests match this filter."}
              </p>
            ) : (
              filteredRequests.map((request) => {
                const isUpdating = updatingRequestId === request.id;
                const actions = REQUEST_ACTIONS[request.status];

                return (
                  <div
                    key={request.id}
                    className="rounded-xl border border-gray-200 p-4 space-y-3"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <p className="text-lg font-semibold text-gray-900">
                            {request.snack_name}
                          </p>
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${SNACK_REQUEST_STATUS_BADGE_CLASSES[request.status]}`}
                          >
                            {SNACK_REQUEST_STATUS_LABELS[request.status]}
                          </span>
                        </div>
                        {request.requester && (
                          <p className="text-sm text-gray-500 mt-2">
                            Submitted by {request.requester.full_name || "Unknown member"}
                            {request.requester.email
                              ? ` • ${request.requester.email}`
                              : ""}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-2">
                          Created {new Date(request.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {request.details && (
                      <p className="text-sm text-gray-600 whitespace-pre-line">
                        {request.details}
                      </p>
                    )}
                    {request.source && (
                      <p className="text-xs text-gray-500">
                        <span className="font-medium text-gray-700">Where to find it:</span> {" "}
                        {request.source}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {actions.map((action) => (
                        <button
                          key={`${request.id}-${action.status}`}
                          type="button"
                          onClick={() => updateRequestStatus(request.id, action.status)}
                          disabled={isUpdating}
                          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${
                            action.style
                          } ${
                            isUpdating
                              ? "cursor-not-allowed opacity-60"
                              : "hover:shadow-sm"
                          }`}
                        >
                          {isUpdating ? (
                            <>
                              <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                              Updating...
                            </>
                          ) : (
                            action.label
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[2fr,3fr]">
          <div className="space-y-8">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Add a new snack</h2>
              <p className="text-sm text-gray-500 mb-6">
                Spotlight the latest treat your crew should know about.
              </p>
              <form onSubmit={uploadSnack} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Snack name
                  </label>
                  <input
                    name="name"
                    type="text"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                    placeholder="e.g. Chili Lime Plantain Chips"
                    disabled={uploading}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    name="description"
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                    placeholder="What makes this snack special?"
                    disabled={uploading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Photo (optional)
                  </label>
                  <input
                    name="photo"
                    type="file"
                    accept="image/*"
                    className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-orange-100 file:px-4 file:py-2 file:text-orange-700 hover:file:bg-orange-200"
                    disabled={uploading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={uploading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2 font-medium text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {uploading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Uploading snack...
                    </>
                  ) : (
                    <>Add snack</>
                  )}
                </button>
              </form>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Current snacks</h2>
              {snacks.length === 0 ? (
                <p className="text-sm text-gray-500">No snacks uploaded yet. Share the latest discovery!</p>
              ) : (
                <div className="space-y-4">
                  {snacks.map((snack) => (
                    <div
                      key={snack.id}
                      className="flex gap-4 rounded-xl border border-gray-200 p-4"
                    >
                      {snack.photo_url ? (
                        <Image
                          src={snack.photo_url}
                          alt={snack.name}
                          width={80}
                          height={80}
                          className="h-20 w-20 rounded-lg object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-orange-100 text-2xl">
                          🍿
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{snack.name}</p>
                        {snack.description && (
                          <p className="text-sm text-gray-600 mt-1">{snack.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-2">
                          Added {new Date(snack.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {currentMonthDate.toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}{" "}
                  subscriptions
                </h2>
                <p className="text-sm text-gray-500">
                  Track who’s in for this month’s snack drop.
                </p>
              </div>
              <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700">
                {paidMembers} paid / {totalMembers} members
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 text-sm text-gray-500">
                    <th className="py-3 pr-4 font-medium">Member</th>
                    <th className="py-3 pr-4 font-medium">Email</th>
                    <th className="py-3 pr-4 font-medium">Status</th>
                    <th className="py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((person) => (
                    <tr key={person.id} className="border-b border-gray-100 text-sm">
                      <td className="py-4 pr-4 align-top">
                        <div className="font-medium text-gray-900">
                          {person.full_name || "No name on file"}
                        </div>
                        {person.dietary_preferences && (
                          <div className="text-xs text-gray-500 mt-1">
                            {person.dietary_preferences}
                          </div>
                        )}
                      </td>
                      <td className="py-4 pr-4 align-top text-gray-600">{person.email}</td>
                      <td className="py-4 pr-4 align-top">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            person.paymentStatus?.paid
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {person.paymentStatus?.paid ? "Paid" : "Pending"}
                        </span>
                      </td>
                      <td className="py-4 text-right align-top">
                        <button
                          onClick={() =>
                            togglePayment(person.id, person.paymentStatus?.paid ?? false)
                          }
                          className={`inline-flex items-center rounded-lg px-3 py-2 text-xs font-medium transition ${
                            person.paymentStatus?.paid
                              ? "bg-red-100 text-red-600 hover:bg-red-200"
                              : "bg-green-100 text-green-600 hover:bg-green-200"
                          }`}
                        >
                          Mark {person.paymentStatus?.paid ? "unpaid" : "paid"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
