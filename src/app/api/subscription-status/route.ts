import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

type SubscriptionAction = "pause" | "cancel" | "reactivate";

type SubscriptionUpdatePayload = {
  action?: SubscriptionAction;
  userId?: string;
};

function invalidRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function normaliseAction(action: string | undefined): SubscriptionAction | null {
  if (!action) return null;
  if (action === "pause" || action === "cancel" || action === "reactivate") {
    return action;
  }
  return null;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export async function PATCH(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  let payload: SubscriptionUpdatePayload;

  try {
    payload = (await request.json()) as SubscriptionUpdatePayload;
  } catch {
    return invalidRequest("Invalid JSON payload provided");
  }

  const action = normaliseAction(payload.action);

  if (!action) {
    return invalidRequest("A valid action of pause, cancel, or reactivate is required");
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    console.error("[subscription-status] Unable to read session", sessionError);
    return NextResponse.json(
      { error: "We couldn’t verify your session. Please try signing in again." },
      { status: 401 }
    );
  }

  const currentUser = session?.user;

  if (!currentUser) {
    return NextResponse.json(
      { error: "You need to be signed in to manage your subscription." },
      { status: 401 }
    );
  }

  const targetUserId = payload.userId?.trim() || currentUser.id;
  let isAdmin = false;

  if (targetUserId !== currentUser.id) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (profileError) {
      console.error("[subscription-status] Failed to load acting user profile", profileError);
      return NextResponse.json(
        { error: "We couldn’t confirm your permissions to update this subscription." },
        { status: 403 }
      );
    }

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can modify other members’ subscriptions." },
        { status: 403 }
      );
    }

    isAdmin = true;
  }

  const month = currentMonth();

  const { data: existingStatus, error: fetchError } = await supabase
    .from("payments_manual")
    .select("paid, note, paused, paused_at, canceled, canceled_at")
    .eq("user_id", targetUserId)
    .eq("month", month)
    .maybeSingle();

  if (fetchError) {
    console.error("[subscription-status] Failed to load subscription row", fetchError);
    return NextResponse.json(
      { error: "We couldn’t find the current subscription record to update." },
      { status: 500 }
    );
  }

  const now = new Date().toISOString();

  let paused = existingStatus?.paused ?? false;
  let pausedAt = existingStatus?.paused_at ?? null;
  let canceled = existingStatus?.canceled ?? false;
  let canceledAt = existingStatus?.canceled_at ?? null;

  if (action === "pause") {
    paused = true;
    pausedAt = now;
    canceled = false;
    canceledAt = null;
  } else if (action === "cancel") {
    canceled = true;
    canceledAt = now;
    paused = false;
    pausedAt = null;
  } else if (action === "reactivate") {
    paused = false;
    pausedAt = null;
    canceled = false;
    canceledAt = null;
  }

  const upsertPayload = {
    user_id: targetUserId,
    month,
    paid: existingStatus?.paid ?? false,
    note: existingStatus?.note ?? (isAdmin ? "Updated by admin" : null),
    paused,
    paused_at: pausedAt,
    canceled,
    canceled_at: canceledAt,
  };

  const { data: updatedRow, error: upsertError } = await supabase
    .from("payments_manual")
    .upsert(upsertPayload, { onConflict: "user_id,month" })
    .select("user_id, month, paid, note, paused, paused_at, canceled, canceled_at")
    .single();

  if (upsertError) {
    console.error("[subscription-status] Failed to upsert subscription", upsertError);
    return NextResponse.json(
      { error: "We couldn’t update the subscription. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: updatedRow });
}
