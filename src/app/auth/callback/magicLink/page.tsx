"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Processing...");

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      // Check if this is a password reset
      const type = searchParams.get("type");

      if (type === "recovery") {
        setStatus(
          "Password reset confirmed! You can now sign in with your new password."
        );
        setTimeout(() => router.push("/join"), 2000);
        return;
      }

      // Handle regular auth callback
      const { error } = await supabase.auth.getSession();

      if (error) {
        setStatus(`Error: ${error.message}`);
        setTimeout(() => router.push("/join"), 3000);
        return;
      }

      setStatus("Success! Redirecting...");
      setTimeout(() => router.push("/dashboard"), 1000);
    } catch (err: any) {
      console.error("Callback error:", err);
      setStatus("Something went wrong. Redirecting to login...");
      setTimeout(() => router.push("/join"), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl p-8 text-center shadow-lg">
        <div className="text-4xl mb-4">🍪</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Almost there...
        </h1>
        <p className="text-gray-600 mb-6">{status}</p>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
        </div>
      </div>
    </div>
  );
}
