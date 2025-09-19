"use client";
import { useAuth } from "@/lib/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminPanel() {
  const [mounted, setMounted] = useState(false);
  const { user, loading, profile, isAdmin } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [snacks, setSnacks] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  const currentMonth = new Date().toISOString().slice(0, 7); // '2025-01'

  // ALL useEffect hooks must be at the top level, before any returns
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && isAdmin) {
      loadUsers();
      loadSnacks();
    }
  }, [mounted, isAdmin]);

  // Add this debug effect
  useEffect(() => {
    if (mounted) {
      console.log("=== ADMIN DEBUG ===");
      console.log("user:", user);
      console.log("loading:", loading);
      console.log("profile:", profile);
      console.log("profile.role:", profile?.role);
      console.log("isAdmin:", isAdmin);
      console.log("==================");
    }
  }, [mounted, user, loading, profile, isAdmin]);

  // Now we can have early returns
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  async function loadUsers() {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: payments } = await supabase
      .from("payments_manual")
      .select("*")
      .eq("month", currentMonth);

    const usersWithPayments =
      profiles?.map((profile) => ({
        ...profile,
        paymentStatus: payments?.find((p) => p.user_id === profile.id),
      })) || [];

    setUsers(usersWithPayments);
  }

  async function loadSnacks() {
    const { data } = await supabase
      .from("snacks")
      .select("*")
      .order("created_at", { ascending: false });

    setSnacks(data || []);
  }

  async function togglePayment(userId: string, currentPaid: boolean) {
    if (currentPaid) {
      await supabase
        .from("payments_manual")
        .delete()
        .eq("user_id", userId)
        .eq("month", currentMonth);
    } else {
      await supabase.from("payments_manual").upsert({
        user_id: userId,
        month: currentMonth,
        paid: true,
        note: "Marked by admin",
      });
    }

    loadUsers();
  }

  async function uploadSnack(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploading(true);

    const formData = new FormData(event.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const file = formData.get("photo") as File;

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

      await supabase.from("snacks").insert({
        name,
        description,
        photo_url: photoUrl,
        week_start: new Date().toISOString().split("T")[0],
        created_by: user?.id,
      });

      (event.target as HTMLFormElement).reset();
      loadSnacks();
    } catch (error) {
      alert("Error uploading snack: " + (error as Error).message);
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading your account...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">
            You need admin access to view this page.
          </p>
          <p className="text-sm text-gray-500">
            Current role: {profile?.role || "none"} | User ID: {user?.id}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl p-8 mb-8 shadow-sm">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Hey Sandy! 👋
          </h1>
          <p className="text-gray-600">Here's your snack empire dashboard</p>
        </div>

        {/* Upload Snacks */}
        <div className="bg-white rounded-2xl p-8 mb-8 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            Upload This Week's Snacks
          </h2>

          <form onSubmit={uploadSnack} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Snack Name
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  placeholder="Dark Chocolate Sea Salt Cookies"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Photo
                </label>
                <input
                  name="photo"
                  type="file"
                  accept="image/*"
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                name="description"
                rows={3}
                className="w-full p-3 border border-gray-300 rounded-lg"
                placeholder="Rich dark chocolate cookies with a hint of sea salt..."
              />
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="bg-orange-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Add Snack"}
            </button>
          </form>
        </div>

        {/* User Management */}
        <div className="bg-white rounded-2xl p-8 mb-8 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            {new Date().toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}{" "}
            Subscriptions
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">
                    Name
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">
                    Email
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-4 px-4">
                      <div className="font-medium text-gray-900">
                        {user.full_name}
                      </div>
                      {user.dietary_preferences && (
                        <div className="text-sm text-gray-500">
                          {user.dietary_preferences}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4 text-gray-600">{user.email}</td>
                    <td className="py-4 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          user.paymentStatus?.paid
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {user.paymentStatus?.paid ? "PAID" : "PENDING"}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <button
                        onClick={() =>
                          togglePayment(
                            user.id,
                            user.paymentStatus?.paid || false
                          )
                        }
                        className={`px-4 py-2 rounded-lg text-sm font-medium ${
                          user.paymentStatus?.paid
                            ? "bg-red-100 text-red-700 hover:bg-red-200"
                            : "bg-green-100 text-green-700 hover:bg-green-200"
                        }`}
                      >
                        Mark {user.paymentStatus?.paid ? "Unpaid" : "Paid"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Current Snacks */}
        <div className="bg-white rounded-2xl p-8 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            Current Snacks
          </h2>

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
                  <p className="text-xs text-gray-500 mt-2">
                    Added {new Date(snack.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
