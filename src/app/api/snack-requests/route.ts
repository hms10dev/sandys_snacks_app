import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import {
  type SnackRequestStatus,
  toSnackRequest,
  type SnackRequestRow,
  isValidSnackRequestStatus,
} from "@/lib/snackRequests";

type RequestPayload = {
  snackName?: unknown;
  details?: unknown;
  source?: unknown;
};

type ProfileRole = {
  role: string | null;
};

type ProfileRecord = ProfileRole & {
  full_name?: string | null;
  email?: string | null;
};

const MAX_SNACK_NAME_LENGTH = 120;
const MAX_TEXT_FIELD_LENGTH = 500;

function sanitiseText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

async function getProfileRole(supabase: ReturnType<typeof createRouteHandlerClient>) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, role: null, error } as const;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", user.id)
    .maybeSingle<ProfileRecord>();

  if (profileError) {
    return { user, role: null, error: profileError } as const;
  }

  return { user, role: profile?.role ?? null, profile } as const;
}

function ensureValidStatuses(value: string | null): SnackRequestStatus[] {
  if (!value) return [];

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is SnackRequestStatus => isValidSnackRequestStatus(item));
}

export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = request.nextUrl;

  const { user, role, profile, error } = await getProfileRole(supabase);

  if (error) {
    console.error("[snack-requests][GET] Failed to resolve profile", error);
    return NextResponse.json(
      { error: "We couldn’t verify your account. Please sign in again." },
      { status: 401 }
    );
  }

  if (!user) {
    return NextResponse.json(
      { error: "You must be signed in to view snack requests." },
      { status: 401 }
    );
  }

  const statusFilters = ensureValidStatuses(searchParams.get("status"));

  let query = supabase
    .from("snack_requests")
    .select(
      "id, user_id, snack_name, details, source, status, created_at, updated_at, profiles(full_name, email)"
    )
    .order("created_at", { ascending: false });

  if (statusFilters.length > 0) {
    query = query.in("status", statusFilters);
  }

  if (role === "admin") {
    // Admins can view all requests, optionally filtered by status
  } else {
    query = query.eq("user_id", user.id);
  }

  const { data, error: selectError } = await query;

  if (selectError) {
    console.error("[snack-requests][GET] Failed to fetch requests", selectError);
    return NextResponse.json(
      { error: "We couldn’t load snack requests right now. Please try again." },
      { status: 500 }
    );
  }

  const requests = (data ?? []).map((row) =>
    toSnackRequest(row as SnackRequestRow)
  );

  return NextResponse.json({
    data: requests,
    viewer: {
      id: user.id,
      role: role ?? null,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
    },
  });
}

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      { error: "You must be signed in to submit a snack request." },
      { status: 401 }
    );
  }

  let payload: RequestPayload;
  try {
    payload = (await request.json()) as RequestPayload;
  } catch (err) {
    console.error("[snack-requests][POST] Invalid JSON payload", err);
    return NextResponse.json(
      { error: "We couldn’t read your request. Please try again." },
      { status: 400 }
    );
  }

  const snackName = sanitiseText(payload.snackName, MAX_SNACK_NAME_LENGTH);
  const details = sanitiseText(payload.details, MAX_TEXT_FIELD_LENGTH);
  const source = sanitiseText(payload.source, MAX_TEXT_FIELD_LENGTH);

  if (!snackName) {
    return NextResponse.json(
      { error: "Please share the snack name before submitting." },
      { status: 400 }
    );
  }

  const insertPayload = {
    user_id: user.id,
    snack_name: snackName,
    details: details || null,
    source: source || null,
  };

  const { data, error: insertError } = await supabase
    .from("snack_requests")
    .insert(insertPayload)
    .select(
      "id, user_id, snack_name, details, source, status, created_at, updated_at, profiles(full_name, email)"
    )
    .single();

  if (insertError || !data) {
    console.error("[snack-requests][POST] Failed to insert request", insertError);
    return NextResponse.json(
      { error: "We couldn’t save your snack request. Please try again." },
      { status: 500 }
    );
  }

  const requestRecord = toSnackRequest(data as SnackRequestRow);

  return NextResponse.json({ data: requestRecord }, { status: 201 });
}

export const dynamic = "force-dynamic";
