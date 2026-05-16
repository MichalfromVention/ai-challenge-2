# Task 2 – Event hosting platform

A community event hosting platform built with Lovable for the AI Challenge 2 (May 2026).

**Live demo:** https://gather-aichallenge-task2.lovable.app

The app supports the full event lifecycle: hosts publish events, attendees RSVP and get digital tickets with QR codes, and checkers verify attendance at the door.

---

## Quick start

To try the app yourself, open the live demo and follow the four flows below. You'll need two browser windows or sessions (one for the host, one for the attendee).

You can sign up with any test email. No email confirmation is required (auto-confirm is enabled).

---

## Flow 1: Publish an event (as host)

1. Sign up or sign in.
2. Open the user menu (top right) and click "Become a host" if you're not one yet. Fill in a host name. Bio and contact email are optional.
3. On the host dashboard, click "Create event".
4. Fill in the event title, date, and capacity. Publish.
5. The event now appears in the public Explore page.

## Flow 2: RSVP and get a ticket (as attendee)

1. Open the live demo in a separate browser window (incognito works well).
2. Sign up as a new user with a different test email.
3. Browse the Explore page and pick an event.
4. Click "RSVP". You'll see a confirmation toast and a digital ticket appears below the event with a QR code and a unique ticket code.
5. The ticket also lives in your "My tickets" tab.

## Flow 3: Check-in attendees (as host)

1. Switch back to the host account.
2. On the host dashboard, find the event and click "Open check-in".
3. Type or paste the attendee's ticket code into the input field and click "Check in".
4. The counter on the page updates live: going, checked-in, waitlist. The attendee appears in "Recent check-ins" with a timestamp.
5. If you make a mistake, click "Undo last" to roll back the most recent check-in.

## Flow 4: Invite a co-host or checker

1. On the host dashboard, click "Invite members".
2. Choose "Invite as Host" or "Invite as Checker". A unique invite link is generated and copied to your clipboard.
3. Open the invite link in a separate browser session.
4. Sign up as a new user. The role is assigned automatically based on the link.
5. The new member appears in the "Current members" list with the correct role badge.

---

## Tech stack

- React + TanStack Router (frontend)
- Tailwind CSS + shadcn/ui (styling)
- Supabase (auth, Postgres, storage)
- Bun (package manager and runtime)
- Built and deployed via Lovable

---

## Known issues

See `report.md` for the full development report, including the one known issue with the "Invite members" modal layout.
