# Task 2 report

## What I built

A community event hosting platform supporting the full Publish → RSVP → Ticket → Check-in lifecycle. Hosts register, create public events, and check in attendees at the door. Attendees browse events, RSVP, and receive a digital ticket with a unique code and QR. Hosts can also invite co-hosts and checkers via shareable links.

Live: https://gather-aichallenge-task2.lovable.app

## Tools used

- **Lovable** – primary build tool, React + Tailwind + Supabase stack out of the box
- **Supabase** – auth, Postgres database, automatic Row Level Security (provided by Lovable)
- **Claude (Opus 4.7)** – strategic partner for requirement triage, prompt drafting, debugging, and documentation
- **GitHub** – source code hosting; Lovable's built-in GitHub integration pushes code to a connected repo

I worked from a personal Lovable account on the free tier with monthly credits. No client data, no proprietary code, no Vention assets were used in the build.

## Approach

I wrote the master prompt with Claude before opening Lovable, which gave the first build a coherent data model and the full set of flows out of the gate. After that, I iterated on Lovable using short, targeted prompts – one bug or one feature at a time, testing on the live URL between each change. This worked far better than trying to one-shot a perfect spec.

The biggest strategic decision was starting a fresh project halfway through. The first attempt accumulated several state and routing bugs that became hard to untangle, so I scrapped it and rebuilt from a clean master prompt with all lessons learned baked in. The second build took less than half the time and ended up in a much better place.

## What worked

- The four core flows (Publish, RSVP, Ticket, Check-in) all work end to end.
- Invite link generation and redemption work correctly: a Checker invite produces a Checker member, a Host invite produces a Host.
- The check-in page has live counters (going, checked-in, waitlist), recent check-ins with timestamps, and an "Undo last" action.
- The host dashboard separates upcoming and past events cleanly.
- Auto-confirm on signup made testing painless.

## What didn't work

The "Invite members" modal has a cosmetic overflow bug. The active invite URL in the list spills past the modal's right edge instead of being truncated with an ellipsis. The bug is purely visual – the copy button works, the link is valid, and the role assignment flow operates correctly.

I attempted to fix it three times with progressively more specific prompts. Each time Lovable reported the fix as complete, but the necessary Tailwind classes were not applied. I prepared one final, very specific prompt with explicit class names but ran out of monthly Lovable credits before being able to send it. Credits reset on June 1, after the submission deadline.

## Notable decisions

- **Started fresh after first build went sideways.** Lost the first version's URL and test data, but gained a much cleaner codebase. Worth it.
- **Used Lovable's deploy rather than self-hosting.** The challenge org confirmed Lovable deploy was acceptable, and it saved several hours of separate deployment work.
- **Did not implement CSV export or advanced moderation features.** Triaged out as nice-to-have to keep the scope manageable within the free credit budget.
- **Documented the modal bug honestly rather than hiding it.** I'd rather a reviewer see an honest report than have them find an unflagged issue themselves.

## Lessons learned

The biggest lesson was about prompt iteration. With Lovable I came in assuming the first prompt should do most of the work, with a few small follow-ups. In practice, the opposite was true: the initial prompt establishes architecture, but real progress comes from short, surgical follow-ups, ideally one fix or one feature at a time, tested live between each.

The second lesson was about Lovable's failure mode. When Lovable says "fixed" and the bug is still there, it really means "I attempted a fix" – not "I verified it worked". Asking for the code diff at the end of the prompt is a useful counter, though it didn't save the modal in my case.

The third lesson was about resource management. The free tier of Lovable has a hard ceiling, and I underestimated how many credits debugging would consume relative to building. Next time I'd reserve at least a third of the monthly budget for the testing-and-fixing phase.
