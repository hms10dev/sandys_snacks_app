import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

function redirectWithError(origin: string, message: string) {
  const query = new URLSearchParams({
    error: message,
  });

  return NextResponse.redirect(`${origin}/join?${query.toString()}`);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const type = requestUrl.searchParams.get("type");

  if (error) {
    const message = errorDescription || error || "We couldn’t finish signing you in.";
    return redirectWithError(requestUrl.origin, message);
  }

  if (!code) {
    return redirectWithError(
      requestUrl.origin,
      "We couldn’t find a valid sign-in code. Please try again."
    );
  }

  const supabase = createRouteHandlerClient({ cookies });

  try {
    const {
      data: { session },
      error: exchangeError,
    } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError || !session?.user) {
      const message =
        exchangeError?.message || "We hit a snag finishing your sign-in. Please try again.";
      return redirectWithError(requestUrl.origin, message);
    }

    const user = session.user;

    const {
      data: existingProfile,
      error: selectError,
    } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (selectError) {
      console.error("[auth/callback] Failed to load profile", selectError);
      return redirectWithError(
        requestUrl.origin,
        "We couldn’t load your profile information. Please try again."
      );
    }

    let profileRole = existingProfile?.role ?? null;

    if (!existingProfile) {
      const fallbackName =
        (user.user_metadata as Record<string, unknown> | null)?.full_name?.toString() ||
        user.email?.split("@")[0] ||
        "Snack Lover";

      const profilePayload = {
        id: user.id,
        email: user.email ?? "",
        full_name: fallbackName,
        dietary_preferences:
          (user.user_metadata as Record<string, unknown> | null)?.dietary_preferences?.toString() ??
          null,
      };

      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert(profilePayload, { onConflict: "id" });

      if (upsertError) {
        console.error("[auth/callback] Failed to create profile", upsertError);
        return redirectWithError(
          requestUrl.origin,
          "Your profile could not be created. Please try signing in again."
        );
      }
        const {
        data: createdProfile,
        error: fetchError,
      } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .maybeSingle();

      if (fetchError) {
        console.error("[auth/callback] Failed to load profile after creation", fetchError);
        return redirectWithError(
          requestUrl.origin,
          "We couldn’t load your profile information. Please try again."
        );
      }

      profileRole = createdProfile?.role ?? null;
    }

    const isRecovery = type === "recovery";
    const redirectPath = isRecovery
      ? "/auth/callback/magicLink?type=recovery"
        : profileRole === "admin"
        ? "/admin"
        : "/dashboard";


    return NextResponse.redirect(`${requestUrl.origin}${redirectPath}`);
  } catch (err) {
    console.error("[auth/callback] Unexpected error", err);
    return redirectWithError(
      requestUrl.origin,
      "Something unexpected happened. Please try signing in again."
    );
  }
}
