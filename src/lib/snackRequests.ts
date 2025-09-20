export const SNACK_REQUEST_STATUSES = [
  "pending",
  "accepted",
  "fulfilled",
  "declined",
] as const;

export type SnackRequestStatus = (typeof SNACK_REQUEST_STATUSES)[number];

export function isValidSnackRequestStatus(value: unknown): value is SnackRequestStatus {
  return typeof value === "string" && (SNACK_REQUEST_STATUSES as readonly string[]).includes(value);
}

export const SNACK_REQUEST_STATUS_LABELS: Record<SnackRequestStatus, string> = {
  pending: "Pending review",
  accepted: "Accepted",
  fulfilled: "Fulfilled",
  declined: "Declined",
};

export const SNACK_REQUEST_STATUS_SHORT_LABELS: Record<SnackRequestStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  fulfilled: "Fulfilled",
  declined: "Declined",
};

export const SNACK_REQUEST_STATUS_BADGE_CLASSES: Record<SnackRequestStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 border border-yellow-200",
  accepted: "bg-green-100 text-green-800 border border-green-200",
  fulfilled: "bg-blue-100 text-blue-800 border border-blue-200",
  declined: "bg-red-100 text-red-800 border border-red-200",
};

export type SnackRequest = {
  id: string;
  user_id: string;
  snack_name: string;
  details: string | null;
  source: string | null;
  status: SnackRequestStatus;
  created_at: string;
  updated_at: string;
};

export type SnackRequestWithProfile = SnackRequest & {
  requester: {
    full_name: string | null;
    email: string | null;
  } | null;
};

export type SnackRequestRow = Omit<SnackRequestWithProfile, "status" | "requester"> & {
  status: string;
  profiles?: {
    full_name: string | null;
    email: string | null;
  } | null;
};

export function toSnackRequest(row: SnackRequestRow): SnackRequestWithProfile {
  const status = isValidSnackRequestStatus(row.status) ? row.status : "pending";

  return {
    id: row.id,
    user_id: row.user_id,
    snack_name: row.snack_name,
    details: row.details ?? null,
    source: row.source ?? null,
    status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    requester: row.profiles
      ? {
          full_name: row.profiles.full_name ?? null,
          email: row.profiles.email ?? null,
        }
      : null,
  };
}
