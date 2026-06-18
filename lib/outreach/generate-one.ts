import "server-only";
// generate-one.ts — orchestrator for generating a single guest's draft email.
// Mirrors process-photo.ts: one unit of work, called once per API request.
//
// Pipeline:
//   1. Load guest
//   2. Guard: already has a ready draft → skip (idempotent)
//   3. Guard: email_verify_status must be 'valid' (verify step gates generation)
//   4. Extract facts
//   5. Pick angle
//   6a. Personalized: write-email (LLM) + guard-facts fallback
//   6b. Standard: template merge (zero LLM calls)
//   7. Store outreach_drafts row

import { createAdminClient } from "@/lib/supabase/admin";
import type { GuestRecord, OccasionType } from "./types";
import { extractFacts }  from "./extract-facts";
import { pickAngle }     from "./pick-angle";
import { writeEmail }    from "./write-email";
import { guardFacts }    from "./guard-facts";
import { mergeTemplate } from "./templates";
import { stripDashes } from "./sanitize";
import { createDraft, hasReadyDraft } from "@/lib/db/outreach-drafts";

export interface GenerateResult {
  guest_id: string;
  status: "generated" | "skipped" | "invalid_email";
  draft_id?: string;
  reason?: string;
}

export async function generateOne(
  guestId: string,
  occasionType: OccasionType | null = null,
  skipVerify = false
): Promise<GenerateResult> {
  const sb = createAdminClient();

  // 1. Load guest
  const { data: guest, error: guestErr } = await sb
    .from("guests")
    .select("*")
    .eq("id", guestId)
    .maybeSingle();

  if (guestErr) throw new Error(guestErr.message);
  if (!guest) throw new Error(`Guest not found: ${guestId}`);

  const g = guest as GuestRecord;

  // 2. Skip if already has a ready draft (idempotency).
  const alreadyDone = await hasReadyDraft(guestId);
  if (alreadyDone) {
    return { guest_id: guestId, status: "skipped", reason: "already_has_draft" };
  }

  // 3. Email must be verified valid — skip anything else (invalid, unknown, catchall).
  // Note: 'not_configured' means the verifier key is absent; we allow generation
  // to proceed anyway so the feature works without verification configured.
  // skipVerify=true bypasses this gate entirely (testing mode — no credits burned).
  if (!skipVerify) {
    const verifyStatus = g.email_verify_status;
    if (
      verifyStatus !== null &&
      verifyStatus !== "valid" &&
      verifyStatus !== "not_configured"
    ) {
      return {
        guest_id: guestId,
        status:   "invalid_email",
        reason:   `email_verify_status=${verifyStatus}`,
      };
    }
  }

  // 4 + 5. Extract facts and pick angle.
  const facts  = extractFacts(g, occasionType);
  const { angle, tone_note } = pickAngle(facts);

  let subject: string;
  let body:    string;

  if (g.bucket === "personalized") {
    // 6a. LLM call (one Haiku call — no separate edit pass).
    const written = await writeEmail(facts, { angle, tone_note });

    // Guard against hallucinated specifics; fall back to template on violation.
    const guard = guardFacts(written, facts);
    if (!guard.passed) {
      console.warn(`[generate-one] guard-facts fallback for guest ${guestId}: ${guard.reason}`);
      const tpl = mergeTemplate(angle, facts);
      subject = tpl.subject;
      body    = tpl.body;
    } else {
      subject = written.subject;
      body    = written.body;
    }
  } else {
    // 6b. Standard: zero LLM calls.
    const tpl = mergeTemplate(angle, facts);
    subject = tpl.subject;
    body    = tpl.body;
  }

  // 7. Sanitize (guaranteed no em/en dashes ship, whatever the model produced),
  //    then store. personalized_from captures what facts drove the angle.
  subject = stripDashes(subject);
  body    = stripDashes(body);

  const draft = await createDraft({
    guest_id:       guestId,
    occasion_type:  occasionType,
    angle,
    subject,
    body,
    personalized_from: g.bucket === "personalized"
      ? {
          recency:         facts.recency,
          visit_count_tier: facts.visit_count_tier,
          tenure:          facts.tenure,
          spend_tier:      facts.spend_tier,
          has_notes:       !!facts.notes,
          occasion:        occasionType,
        }
      : null,
  });

  return { guest_id: guestId, status: "generated", draft_id: draft.id };
}
