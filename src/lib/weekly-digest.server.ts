const GMAIL_GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

interface DigestTask {
  title: string;
  type: string;
  deadline_date: string;
  est_hours: number | null;
  subject: string | null;
}

/** Monday 00:00 (UTC) of the week the given date falls in. */
export function weekStart(date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function esc(v: string) {
  return v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export function renderDigest(name: string, tasks: DigestTask[], start: string, end: string) {
  const rows = tasks
    .map(
      (t) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #eee">${esc(t.title)}</td>` +
        `<td style="padding:8px;border-bottom:1px solid #eee;text-transform:capitalize">${esc(t.type)}</td>` +
        `<td style="padding:8px;border-bottom:1px solid #eee">${esc(t.subject ?? "—")}</td>` +
        `<td style="padding:8px;border-bottom:1px solid #eee">${esc(t.deadline_date)}</td>` +
        `<td style="padding:8px;border-bottom:1px solid #eee">${t.est_hours ?? "—"}h</td></tr>`,
    )
    .join("");

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#111">
    <h2>Your week: ${esc(start)} → ${esc(end)}</h2>
    <p>Hi ${esc(name || "there")}, here is everything due and to submit this week.</p>
    ${
      tasks.length
        ? `<table style="border-collapse:collapse;width:100%;font-size:14px">
      <thead><tr><th align="left" style="padding:8px">Task</th><th align="left" style="padding:8px">Type</th><th align="left" style="padding:8px">Subject</th><th align="left" style="padding:8px">Due</th><th align="left" style="padding:8px">Est.</th></tr></thead>
      <tbody>${rows}</tbody></table>`
        : `<p>Nothing is due this week — a good time to get ahead.</p>`
    }
    <p style="font-size:12px;color:#666">Studypace · you can turn this email off in My profile.</p>
  </div>`;

  const text = tasks.length
    ? tasks.map((t) => `- ${t.title} (${t.type}) due ${t.deadline_date}`).join("\n")
    : "Nothing is due this week.";

  return { html, text };
}

function base64Url(bytes: Uint8Array) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeHeader(value: string) {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7F]*$/.test(value)
    ? value
    : `=?UTF-8?B?${base64Url(new TextEncoder().encode(value)).replace(/-/g, "+").replace(/_/g, "/")}?=`;
}

/** Build an RFC 2822 multipart/alternative message and base64url-encode it for the Gmail API. */
export function buildRawEmail(input: {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
}) {
  const boundary = `bnd_${Math.random().toString(36).slice(2)}`;
  const message = [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${encodeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    input.text,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "",
    input.html,
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");
  return base64Url(new TextEncoder().encode(message));
}

/** Sends through the connected Gmail account (Gmail API over HTTPS, ~500 sends/day). */
export async function sendDigestEmail(input: {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
}) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const gmailKey = process.env["GOOGLE_MAIL_API_KEY"];
  if (!lovableKey || !gmailKey) {
    return { sent: false, detail: "gmail_not_connected" };
  }

  const res = await fetch(`${GMAIL_GATEWAY}/users/me/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": gmailKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: buildRawEmail(input) }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Gmail send failed [${res.status}]: ${body}`);
    return { sent: false, detail: `${res.status}: ${body.slice(0, 300)}` };
  }
  return { sent: true, detail: null as string | null };
}
