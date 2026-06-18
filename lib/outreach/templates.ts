// templates.ts — Standard-bucket email templates, one per angle.
// These are constant strings with merge fields in {braces}.
// Merged at runtime via plain string interpolation (no LLM for Standard guests).
// Available merge fields: {first_name}, {visits}, {years_since_first}

import type { Angle } from "./pick-angle";
import type { GuestFactSet } from "./extract-facts";

interface Template {
  subject: string;
  body: string;
}

// Templates are intentionally plain. The tone note from pick-angle is the
// stylistic guide; we keep the text restrained and human-sounding.
const TEMPLATES: Record<Angle, Template> = {
  birthday: {
    subject: "Happy Birthday from The Pelican Club",
    body: `Hi {first_name},

Wishing you a wonderful birthday from all of us at The Pelican Club.

If you'd like to celebrate with us, we'd love to have you in. The French Quarter has a way of making birthdays feel a little more special.

Come see us soon.

Warmly,
The Pelican Club
1000 Iberville St · New Orleans, LA · OpenTable reservations at the link in bio`,
  },

  anniversary: {
    subject: "Happy Anniversary — Celebrate with Us",
    body: `Hi {first_name},

Happy Anniversary from The Pelican Club.

There's no better city to celebrate love than New Orleans, and no better spot than a quiet corner of our dining room. We'd be honored to be part of your evening.

Warmly,
The Pelican Club
1000 Iberville St · New Orleans, LA · Reservations at the link in bio`,
  },

  visit_anniversary: {
    subject: "A year (or more) since your last visit",
    body: `Hi {first_name},

We realized it's been a while since we had the pleasure of seeing you here at The Pelican Club, and we thought we'd reach out.

A lot has stayed the same — the kitchen, the room, the French Quarter outside the door — but we've also been quietly refining things. We'd love to show you.

Stop by whenever you're ready. Reservations at the link in bio.

Warmly,
The Pelican Club`,
  },

  service_recovery: {
    subject: "We'd love the chance to make it right",
    body: `Hi {first_name},

Thank you for giving The Pelican Club a visit. We understand your experience wasn't what it should have been, and we take that seriously.

We'd welcome the opportunity to have you back and do better. Please reach out directly — we'll make it right.

Warmly,
The Pelican Club`,
  },

  win_back: {
    subject: "It's been a while — we'd love to see you",
    body: `Hi {first_name},

It's been a little while since you've been in, and we wanted to reach out.

The Pelican Club is still here in the French Quarter — same address, same commitment to the table. We'd love to have you back.

Reservations at the link in bio whenever the timing is right.

Warmly,
The Pelican Club`,
  },

  thank_you: {
    subject: "Thank you for visiting The Pelican Club",
    body: `Hi {first_name},

Thank you for joining us recently. It was genuinely good to have you in.

We hope to see you again before long — whether that's for a quick dinner before the show or a longer evening with the full menu.

Reservations at the link in bio.

Warmly,
The Pelican Club`,
  },

  re_engage: {
    subject: "Come back to the French Quarter",
    body: `Hi {first_name},

We've been thinking about our regulars and wanted to say hello.

The Pelican Club has been a part of the French Quarter since 1990, and that longevity isn't something we take lightly. We'd love to have you back at the table.

Reservations at the link in bio.

Warmly,
The Pelican Club`,
  },
};

// ── Merge helpers ─────────────────────────────────────────────────────────────

function mergeField(template: string, field: string, value: string): string {
  return template.replaceAll(`{${field}}`, value);
}

function merge(template: string, facts: GuestFactSet): string {
  let t = template;
  t = mergeField(t, "first_name", facts.first_name ?? "there");
  t = mergeField(t, "visits", String(facts.visit_count ?? ""));
  t = mergeField(
    t,
    "years_since_first",
    facts.years_since_first !== null ? String(Math.floor(facts.years_since_first)) : ""
  );
  return t;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface MergedTemplate {
  subject: string;
  body: string;
}

export function mergeTemplate(angle: Angle, facts: GuestFactSet): MergedTemplate {
  const tpl = TEMPLATES[angle];
  return {
    subject: merge(tpl.subject, facts),
    body:    merge(tpl.body,    facts),
  };
}
