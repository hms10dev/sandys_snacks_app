-- Create table to capture member-submitted snack requests
CREATE TABLE IF NOT EXISTS public.snack_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  snack_name TEXT NOT NULL,
  details TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'fulfilled', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS snack_requests_user_id_idx ON public.snack_requests (user_id);
CREATE INDEX IF NOT EXISTS snack_requests_status_idx ON public.snack_requests (status);
