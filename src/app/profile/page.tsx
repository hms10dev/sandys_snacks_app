"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import LoadingState from "@/components/LoadingState";
import { useAuth, type Profile as AuthProfile } from "@/lib/hooks/useAuth";
import { supabase } from "@/lib/supabase";

function formatRoleLabel(role: string | null): string {
  if (!role) return "Member";
  return role
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function ProfilePage() {
  const {
    user,
    loading,
    profile,
    error: authError,
    isAdmin,
    setProfileData,
  } = useAuth();
  const [fullName, setFullName] = useState("");
  const [dietaryPreferences, setDietaryPreferences] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setDietaryPreferences(profile.dietary_preferences ?? "");
    }
  }, [profile]);

  const handleFullNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFullName(event.target.value);
    if (formError) setFormError(null);
    if (successMessage) setSuccessMessage(null);
  };

  const handleDietaryChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setDietaryPreferences(event.target.value);
    if (formError) setFormError(null);
    if (successMessage) setSuccessMessage(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      setFormError("You need to be signed in to update your profile.");
      return;
    }

    const trimmedFullName = fullName.trim();
    const trimmedDietary = dietaryPreferences.trim();

    if (!trimmedFullName) {
      setFormError("Please add your name before saving.");
      return;
    }

    setSaving(true);
    setFormError(null);
    setSuccessMessage(null);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({
          full_name: trimmedFullName,
          dietary_preferences: trimmedDietary ? trimmedDietary : null,
        })
        .eq("id", user.id)
        .select("id, email, full_name, dietary_preferences, role")
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setProfileData(data as AuthProfile);
        setFullName(data.full_name ?? "");
        setDietaryPreferences(data.dietary_preferences ?? "");
      }

      setSuccessMessage("Your profile was updated successfully!");
    } catch (err) {
      console.error("[profile] Failed to update profile", err);
      setFormError("We couldn’t save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <LoadingState
        title="Loading your profile"
        message="Fetching your snack identity and preferences."
      />
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-lg text-center">
          <div className="text-4xl mb-4">😵‍💫</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            We hit a snack snag
          </h1>
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
            Create an account or sign in to manage your snack profile.
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

  if (!profile) {
    return (
      <LoadingState
        title="Preparing your profile"
        message="Hang tight while we fetch your latest snack preferences."
      />
    );
  }

  const trimmedFullName = fullName.trim();
  const trimmedDietary = dietaryPreferences.trim();
  const originalFullName = profile.full_name?.trim() ?? "";
  const originalDietary = profile.dietary_preferences?.trim() ?? "";
  const hasChanges =
    trimmedFullName !== originalFullName ||
    trimmedDietary !== originalDietary;

  const emailOnFile = profile.email || user.email || "No email on file";
  const roleLabel = formatRoleLabel(profile.role);
  const roleBadgeClass =
    profile.role === "admin"
      ? "bg-orange-100 text-orange-700"
      : "bg-gray-200 text-gray-700";

  return (
    <div className="min-h-screen bg-orange-50 p-4">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-gray-500">
              Your snack identity
            </p>
            <h1 className="text-3xl font-bold text-gray-900 mt-2">
              Profile & preferences
            </h1>
            <p className="text-gray-600 mt-1">
              Keep your details current so we can personalize snack drops and
              avoid allergens.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:text-gray-900"
            >
              Back to dashboard
            </Link>
            {isAdmin ? (
              <Link
                href="/admin"
                className="inline-flex items-center justify-center rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-600 transition hover:border-orange-300 hover:text-orange-700"
              >
                Admin view
              </Link>
            ) : null}
          </div>
        </div>

        <div className="space-y-6 rounded-2xl bg-white p-6 shadow-sm">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Email
                </dt>
                <dd className="mt-1 text-sm text-gray-900">{emailOnFile}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Role
                </dt>
                <dd className="mt-1 flex items-center gap-2 text-sm text-gray-900">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${roleBadgeClass}`}
                  >
                    {roleLabel}
                  </span>
                  {profile.role === "admin"
                    ? "Full access to snack HQ"
                    : "Member access"}
                </dd>
              </div>
            </dl>
          </div>

          {formError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {formError}
            </div>
          ) : null}

          {successMessage ? (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {successMessage}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-medium text-gray-700"
              >
                Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                value={fullName}
                onChange={handleFullNameChange}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                placeholder="Your name"
                maxLength={120}
                disabled={saving}
                required
              />
            </div>

            <div>
              <label
                htmlFor="dietaryPreferences"
                className="block text-sm font-medium text-gray-700"
              >
                Dietary preferences or allergies
              </label>
              <textarea
                id="dietaryPreferences"
                name="dietaryPreferences"
                value={dietaryPreferences}
                onChange={handleDietaryChange}
                rows={4}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                placeholder="Tell us about allergies, favorite flavors, or snacks you'd love more of."
                maxLength={500}
                disabled={saving}
              />
              <p className="mt-2 text-xs text-gray-500">
                We use this to shape snack drops and avoid allergens for the
                whole crew.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-gray-500">
                {hasChanges
                  ? "You have unsaved changes."
                  : "Everything looks up to date!"}
              </p>
              <button
                type="submit"
                disabled={saving || !hasChanges}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2 font-medium text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Saving...
                  </>
                ) : (
                  "Save changes"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
