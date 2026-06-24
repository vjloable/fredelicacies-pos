-- ============================================================================
-- 0003: Shift cash management
-- Adds: shifts, safe_drops, write_offs tables + refund columns on orders
-- ============================================================================

-- ── orders: refund tracking ──────────────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS refunded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS refund_reason TEXT;

-- ── shifts ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shifts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  cashier_id      UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at       TIMESTAMPTZ,
  beginning_cash  NUMERIC(12,2) NOT NULL DEFAULT 0,
  actual_cash     NUMERIC(12,2),
  expected_cash   NUMERIC(12,2),
  over_short      NUMERIC(12,2),
  remarks         TEXT,
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'closed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shifts_branch_status ON public.shifts(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_shifts_cashier       ON public.shifts(cashier_id);
CREATE INDEX IF NOT EXISTS idx_shifts_opened_at     ON public.shifts(opened_at DESC);

-- updated_at trigger
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_updated_at') THEN
    CREATE TRIGGER set_shifts_updated_at
      BEFORE UPDATE ON public.shifts
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

-- ── safe_drops ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.safe_drops (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id    UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  branch_id   UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  cashier_id  UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  receiver_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_safe_drops_shift  ON public.safe_drops(shift_id);
CREATE INDEX IF NOT EXISTS idx_safe_drops_branch ON public.safe_drops(branch_id);

-- ── write_offs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.write_offs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id    UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  branch_id   UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('free', 'near_expiry')),
  item_id     UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  item_name   TEXT NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  reason      TEXT,
  created_by  UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_write_offs_shift  ON public.write_offs(shift_id);
CREATE INDEX IF NOT EXISTS idx_write_offs_branch ON public.write_offs(branch_id);
CREATE INDEX IF NOT EXISTS idx_write_offs_type   ON public.write_offs(type);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safe_drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.write_offs ENABLE ROW LEVEL SECURITY;

-- shifts
CREATE POLICY shifts_select ON public.shifts FOR SELECT USING (
  branch_id IN (SELECT branch_id FROM public.workers WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_owner = TRUE)
);
CREATE POLICY shifts_insert ON public.shifts FOR INSERT WITH CHECK (
  cashier_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_owner = TRUE)
);
CREATE POLICY shifts_update ON public.shifts FOR UPDATE USING (
  cashier_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_owner = TRUE)
);

-- safe_drops
CREATE POLICY safe_drops_select ON public.safe_drops FOR SELECT USING (
  branch_id IN (SELECT branch_id FROM public.workers WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_owner = TRUE)
);
CREATE POLICY safe_drops_insert ON public.safe_drops FOR INSERT WITH CHECK (
  cashier_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_owner = TRUE)
);

-- write_offs
CREATE POLICY write_offs_select ON public.write_offs FOR SELECT USING (
  branch_id IN (SELECT branch_id FROM public.workers WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_owner = TRUE)
);
CREATE POLICY write_offs_insert ON public.write_offs FOR INSERT WITH CHECK (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_owner = TRUE)
);
