import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import {
  isValidSnackRequestStatus,
  toSnackRequest,
  type SnackRequestRow,
} from "@/lib/snackRequests";

type UpdatePayload = {
  status?: unknown;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      { error: "You must be signed in to update a snack request." },
      { status: 401 }
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null }>();

  if (profileError) {
    console.error("[snack-requests][PATCH] Failed to fetch admin role", profileError);
    return NextResponse.json(
      { error: "We couldn’t verify your access to update snack requests." },
      { status: 500 }
    );
  }

  if (profile?.role !== "admin") {
    return NextResponse.json(
      { error: "Only admins can update snack request statuses." },
      { status: 403 }
    );
  }

  let payload: UpdatePayload;
  try {
    payload = (await request.json()) as UpdatePayload;
  } catch (err) {
    console.error("[snack-requests][PATCH] Invalid JSON payload", err);
    return NextResponse.json(
      { error: "We couldn’t read your update. Please try again." },
      { status: 400 }
    );
  }

  const status = typeof payload.status === "string" ? payload.status.trim() : "";

  if (!isValidSnackRequestStatus(status)) {
    return NextResponse.json(
      {
        error: `Status must be one of: pending, accepted, fulfilled, or declined.`,
      },
      { status: 400 }
    );
  }

  const { data, error: updateError } = await supabase
    .from("snack_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .select(
      "id, user_id, snack_name, details, source, status, created_at, updated_at, profiles(full_name, email)"
    )
    .maybeSingle();

  if (updateError) {
    console.error("[snack-requests][PATCH] Failed to update status", updateError);
    return NextResponse.json(
      { error: "We couldn’t update that request. Please try again." },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "That snack request could not be found." },
      { status: 404 }
    );
  }

  const requestRecord = toSnackRequest(data as SnackRequestRow);

  return NextResponse.json({ data: requestRecord });
}

export const dynamic = "force-dynamic";
