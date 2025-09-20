"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // For email confirmations, just redirect to dashboard
    // The useAuth hook will handle the session
    router.push("/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-2xl mb-4">🍪</div>
        <p>Confirming your account...</p>
      </div>
    </div>
  );
}
