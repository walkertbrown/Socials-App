// Scheduling is done in the venue's local time (Central). These convert between a
// datetime-local input (read as Central) and the UTC we store.

export function centralToUtcIso(local: string): string {
  const withSeconds = local.length === 16 ? `${local}:00` : local;
  const naive = new Date(`${withSeconds}Z`); // first read the wall-clock as if UTC
  const offsetName = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    timeZoneName: "shortOffset",
  })
    .formatToParts(naive)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = offsetName?.match(/GMT([+-]\d{1,2})/);
  const offsetHours = m ? parseInt(m[1], 10) : -6;
  return new Date(naive.getTime() - offsetHours * 3600000).toISOString();
}

export function utcToCentral(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
