//dashboard page

"use client";
import { useAuth } from "@/lib/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Dashboard() {
  const { user, loading, profile } = useAuth();
  const [paymentStatus, setPaymentStatus] = useState<any>(null);
  const [snacks, setSnacks] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      loadPaymentStatus();
      loadCurrentSnacks();
    }
  }, [user]);

  async function loadPaymentStatus() {
    const currentMonth = new Date().toISOString().slice(0, 7); // '2025-01'

    const { data } = await supabase
      .from("payments_manual")
      .select("*")
      .eq("user_id", user?.id)
      .eq("month", currentMonth)
      .single();

    setPaymentStatus(data);
  }

  async function loadCurrentSnacks() {
    const { data } = await supabase
      .from("snacks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    setSnacks(data || []);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Please sign in</h1>
          <a href="/join" className="text-orange-500 underline">
            Join Sandy's Snacks
          </a>
        </div>
      </div>
    );
  }

  const isPaid = paymentStatus?.paid || false;
  const currentMonth = new Date().toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl p-8 mb-8 shadow-sm">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {profile?.full_name}! 👋
          </h1>
          <p className="text-gray-600">Here's your snack subscription status</p>
        </div>

        {/* Subscription Status */}
        <div
          className={`bg-white rounded-2xl p-8 mb-8 shadow-sm border-l-4 ${
            isPaid ? "border-green-500" : "border-yellow-500"
          }`}
        >
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {currentMonth} Subscription
              </h2>
              <p className="text-gray-600 mt-2">
                {isPaid
                  ? "You're all set! Thanks for supporting Sandy's snack curation."
                  : "Ready to join this month's snack collection? Send your $5 donation!"}
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
                  Include "Sandy's Snacks - {profile?.full_name}" in the note
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Current Snacks */}
        <div className="bg-white rounded-2xl p-8 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            This Week's Snacks
          </h2>

          {snacks.length === 0 ? (
            <p className="text-gray-500">
              Sandy hasn't uploaded this week's snacks yet!
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {snacks.map((snack) => (
                <div
                  key={snack.id}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  {snack.photo_url && (
                    <img
                      src={snack.photo_url}
                      alt={snack.name}
                      className="w-full h-48 object-cover"
                    />
                  )}
                  <div className="p-4">
                    <h3 className="font-medium text-gray-900">{snack.name}</h3>
                    {snack.description && (
                      <p className="text-sm text-gray-600 mt-1">
                        {snack.description}
                      </p>
                    )}
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
