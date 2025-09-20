"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import LoadingState from "@/components/LoadingState";
import { useAuth } from "@/lib/hooks/useAuth";
import { supabase } from "@/lib/supabase";

type PaymentStatus = {
  user_id: string;
  month: string;
  paid: boolean;
  note?: string | null;
};

type Snack = {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  created_at: string;
};

export default function Dashboard() {
  const { user, loading, profile, error: authError } = useAuth();
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [snacks, setSnacks] = useState<Snack[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setPaymentStatus(null);
      setSnacks([]);
      return;
    }

    let isActive = true;

    const fetchDashboardData = async () => {
      setDataLoading(true);
      setDataError(null);

      const currentMonth = new Date().toISOString().slice(0, 7);

      try {
        const [paymentResult, snacksResult] = await Promise.all([
          supabase
            .from("payments_manual")
            .select("user_id, month, paid, note")
            .eq("user_id", user.id)
            .eq("month", currentMonth)
            .maybeSingle(),
          supabase
            .from("snacks")
            .select("id, name, description, photo_url, created_at")
            .order("created_at", { ascending: false })
            .limit(10),
        ]);

        if (!isActive) return;

        const { data: paymentData, error: paymentError } = paymentResult;
        const { data: snacksData, error: snacksError } = snacksResult;

        if (paymentError || snacksError) {
          throw paymentError || snacksError;
        }

        setPaymentStatus(paymentData ?? null);
        setSnacks(snacksData ?? []);
      } catch (err) {
        if (!isActive) return;
        console.error("[dashboard] Failed to load data", err);
        setDataError("We couldn’t load your latest snack info. Please refresh the page.");
      } finally {
        if (!isActive) return;
        setDataLoading(false);
      }
    };

    fetchDashboardData();

    return () => {
      isActive = false;
    };
  }, [user]);

  if (loading) {
    return (
      <LoadingState
        title="Loading your snack hub"
        message="Brewing up your dashboard with the latest treats."
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
            Create an account or sign in to check out this week’s snack lineup.
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

  if (dataLoading && snacks.length === 0 && !paymentStatus) {
    return (
      <LoadingState
        title="Gathering your snack updates"
        message="Bringing in your payment status and the latest goodies."
      />
    );
  }

  const isPaid = paymentStatus?.paid || false;
  const currentMonthLabel = new Date().toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl p-8 mb-8 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Welcome back, {profile?.full_name}! 👋
              </h1>
              <p className="text-gray-600">
                Here’s your snack subscription status
              </p>
            </div>
            <Link
              href="/profile"
              className="inline-flex items-center justify-center self-start rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-600 transition hover:border-orange-300 hover:text-orange-700"
            >
              Manage your profile
            </Link>
          </div>
        </div>

        {dataError && (
          <div className="mb-8 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {dataError}
          </div>
        )}

        <div
          className={`bg-white rounded-2xl p-8 mb-8 shadow-sm border-l-4 ${
            isPaid ? "border-green-500" : "border-yellow-500"
          }`}
        >
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {currentMonthLabel} Subscription
              </h2>
              <p className="text-gray-600 mt-2">
                {isPaid
                  ? "You’re all set! Thanks for supporting Sandy’s snack curation."
                  : "Ready to join this month’s snack collection? Send your $5 donation!"}
              </p>
            </div>
            <span
              className={`px-4 py-2 rounded-full text-sm font-medium ${
                isPaid
                  ? "bg-green-100 text-green-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {isPaid ? "PAID" : "PENDING"}
            </span>
          </div>

          {!isPaid && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
              <h3 className="font-medium text-orange-900 mb-2">How to pay:</h3>
              <div className="space-y-2 text-sm text-orange-800">
                <p>
                  <strong>Venmo:</strong> Send $5 to @sand-baskar
                </p>
                <p>
                  <strong>Zelle:</strong> Send $5 to sandy@email.com
                </p>
                <p className="text-xs">
                  Include “Sandy’s Snacks – {profile?.full_name}” in the note
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            This Week’s Snacks
          </h2>

          {dataLoading && snacks.length > 0 ? (
            <p className="text-sm text-gray-500 mb-4">Refreshing snacks...</p>
          ) : null}

          {snacks.length === 0 ? (
            <p className="text-gray-500">
              Sandy hasn’t uploaded this week’s snacks yet!
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {snacks.map((snack) => (
                <div
                  key={snack.id}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  {snack.photo_url && (
                    <Image
                      src={snack.photo_url}
                      alt={snack.name}
                      width={400}
                      height={192}
                      className="w-full h-48 object-cover"
                      unoptimized
                    />
                  )}
                  <div className="p-4">
                    <h3 className="font-medium text-gray-900">{snack.name}</h3>
                    {snack.description && (
                      <p className="text-sm text-gray-600 mt-1">
                        {snack.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-3">
                      Added {new Date(snack.created_at).toLocaleDateString()}
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
