export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = {}) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", ...opts,
  });
}

export function isPast(iso: string) {
  return new Date(iso).getTime() < Date.now();
}

export function randomToken(len = 32) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

export function downloadICS(opts: {
  title: string; description?: string; location?: string;
  start: string; end: string;
}) {
  const dt = (s: string) => new Date(s).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Gather//EN", "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}@gather`,
    `DTSTAMP:${dt(new Date().toISOString())}`,
    `DTSTART:${dt(opts.start)}`,
    `DTEND:${dt(opts.end)}`,
    `SUMMARY:${(opts.title || "").replace(/\n/g, " ")}`,
    opts.description ? `DESCRIPTION:${opts.description.replace(/\n/g, "\\n")}` : "",
    opts.location ? `LOCATION:${opts.location.replace(/\n/g, " ")}` : "",
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${slugify(opts.title)}.ics`;
  a.click(); URL.revokeObjectURL(url);
}

export function downloadCSV(filename: string, rows: Record<string, any>[]) {
  if (rows.length === 0) {
    const blob = new Blob(["\uFEFFno data"], { type: "text/csv" });
    triggerDownload(blob, filename); return;
  }
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = v instanceof Date ? v.toISOString() : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = "\uFEFF" + [headers.join(","), ...rows.map(r => headers.map(h => escape(r[h])).join(","))].join("\n");
  triggerDownload(new Blob([csv], { type: "text/csv" }), filename);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
