import "server-only";
// outreach-drafts.ts — create, read, and update outreach_drafts rows.
// Uses the service-role admin client. Degrades gracefully if migration 0016
// has not been applied (returns empty arrays, no throws on 42P01).

import { createAdminClient } from "@/lib/supabase/admin";
import type { OutreachDraft } from "@/lib/outreach/types";

// ── Create ────────────────────────────────────────────────────────────────────

export interface CreateDraftInput {
  guest_id: string;
  occasion_type: string | null;
  angle: string | null;
  subject: string;
  body: string;
  personalized_from: Record<string, unknown> | null;
}

// Inserts a new draft. Throws on DB error (caller handles).
export async function createDraft(input: CreateDraftInput): Promise<OutreachDraft> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("outreach_drafts")
    .insert({
      guest_id:         input.guest_id,
      occasion_type:    input.occasion_type,
      angle:            input.angle,
      subject:          input.subject,
      body:             input.body,
      status:           "draft",
      personalized_from: input.personalized_from,
      updated_at:       new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    if (error.code === "42P01") {
      throw new Error("Outreach tables not created yet — apply migration 0016_outreach.sql.");
    }
    throw new Error(error.message);
  }

  return data as OutreachDraft;
}

// ── Read ──────────────────────────────────────────────────────────────────────

// Returns all drafts with status 'draft' or 'approved', joined to guest name
// and email. Used by the Send-off gallery.
// Degrades to empty array if table is absent.
export interface DraftWithGuest extends OutreachDraft {
  guest_name: string | null;
  guest_email: string;
  recent_visit_date: string | null;
  first_visit_date: string | null;
  completed_visits: number | null;
}

export async function listSendoffDrafts(): Promise<DraftWithGuest[]> {
  const sb = createAdminClient();
  try {
    const { data, error } = await sb
      .from("outreach_drafts")
      .select(`
        *,
        guests!inner ( guest_name, email, recent_visit_date, first_visit_date, completed_visits )
      `)
      .in("status", ["draft", "approved"])
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "42P01") return [];
      throw new Error(error.message);
    }

    return ((data ?? []) as Record<string, unknown>[]).map((row) => {
      const guest = row.guests as {
        guest_name: string | null; email: string;
        recent_visit_date: string | null; first_visit_date: string | null;
        completed_visits: number | null;
      };
      return {
        ...(row as unknown as OutreachDraft),
        guest_name:        guest.guest_name,
        guest_email:       guest.email,
        recent_visit_date: guest.recent_visit_date,
        first_visit_date:  guest.first_visit_date,
        completed_visits:  guest.completed_visits,
      };
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message?.includes("42P01")) return [];
    throw err;
  }
}

// Check if a guest already has a ready/approved draft (skip-if-generated guard).
export async function hasReadyDraft(guestId: string): Promise<boolean> {
  const sb = createAdminClient();
  try {
    const { data, error } = await sb
      .from("outreach_drafts")
      .select("id")
      .eq("guest_id", guestId)
      .in("status", ["draft", "approved"])
      .limit(1);

    if (error) {
      if (error.code === "42P01") return false;
      throw new Error(error.message);
    }
    return (data ?? []).length > 0;
  } catch (err: unknown) {
    if (err instanceof Error && err.message?.includes("42P01")) return false;
    throw err;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────

export interface UpdateDraftInput {
  id: string;
  subject?: string;
  body?: string;
  approved?: boolean;
}

// Updates subject, body, and/or approval status on a draft.
// Setting approved=true advances status to 'approved'; approved=false resets
// to 'draft'. No send is triggered — approval is a local state only.
export async function updateDraft(input: UpdateDraftInput): Promise<OutreachDraft> {
  const sb = createAdminClient();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.subject !== undefined) patch.subject = input.subject;
  if (input.body    !== undefined) patch.body    = input.body;
  if (input.approved !== undefined) {
    patch.status = input.approved ? "approved" : "draft";
  }

  const { data, error } = await sb
    .from("outreach_drafts")
    .update(patch)
    .eq("id", input.id)
    .select()
    .single();

  if (error) {
    if (error.code === "42P01") {
      throw new Error("Outreach tables not created yet — apply migration 0016_outreach.sql.");
    }
    throw new Error(error.message);
  }

  return data as OutreachDraft;
}
