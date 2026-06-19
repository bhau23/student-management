# Tutrain — How the System Works (Plain-English Handoff)

*A non-technical overview of what Tutrain does, how the pieces fit together, and what runs on its own. Written for the director and for any developer joining the project. No code — see the appendix for the technical map.*

---

## What problem Tutrain solves

Tutrain runs online tutoring classes over Google Meet. After every class, Google automatically drops two things into a shared Google Drive: an **attendance sheet** (who joined and for how long) and the **class recording** (plus a transcript). It does this for every student, every subject, every day — but it labels everything only with a random meeting code like `hgy-eqfd-dhp`, with no student names attached.

That's a mess no human can keep up with. Tutrain turns that mess into a clean, organised system where every student's attendance, recordings, fees, marks, and meetings are tracked automatically, and where students, tutors, and management each get their own private view.

## The one idea everything rests on

Each student has a **permanent meeting code per subject** — the same code every day for, say, their Chemistry class, and a different one for Physics. That code is the only reliable way to know whose class an attendance sheet belongs to.

So the heart of Tutrain is a simple link that an admin sets up once per student-subject:

> meeting code `hgy-eqfd-dhp` → **this student**, **this subject**, **this tutor**

This link is called an **enrollment**. Everything — attendance, recordings, the tutor's pay — flows from it. If this link isn't set up, the system can't tell whose class it is (and it safely parks those classes in an "unmapped" list for an admin to sort out, rather than guessing).

## How class data gets in — the tireless assistant

Picture a school office with a filing cabinet and one assistant who never sleeps. Every 15 minutes, the assistant:

1. Checks the two Drive folders for new attendance sheets and recordings.
2. Reads each sheet — who attended, and for how many minutes.
3. Looks up the meeting code to find the matching enrollment, so it knows the student, subject, and tutor.
4. Files a tidy **attendance record** for that class — present or absent, minutes attended, and a link to the recording.
5. If a student attended less than 45 minutes, it doesn't guess — it raises a flag and asks an admin to decide present or absent.

This assistant handles the awkward real-world cases automatically: if a student dropped and rejoined (creating several files for one class), it adds the time together before deciding. If a recording shows up later than the attendance sheet, it links it when it arrives. And once a class is filed, it's never double-counted, even if the assistant re-checks.

## Who uses Tutrain, and what each person sees

Everyone logs in to the same place but sees a completely separate, private view based on who they are.

**Students (and parents share this login).** Their own schedule with one-click join links, their attendance summary, their class recordings and transcripts (which only they can open), their test marks and performance, their parent-teacher meeting notes, and their fee balance and payment history.

**Tutors.** Only the students they teach — never anyone else's. Their schedule and earnings, the classes they've taught, their students' recordings, and the ability to create tests, enter marks, and record parent-teacher meetings. They can add a teaching note to a class but cannot change attendance records — that stays with management.

**Admin (the operations handler).** Manages everything day to day: adding students, tutors, and subjects; setting up the all-important enrollments and meeting codes; deciding present/absent on flagged classes; recording fee payments; processing tutor payouts; running the lead pipeline. Admins see operational data but **not** the owner-level finances.

**Super Admin (the director / you).** Sees everything an admin sees, plus the full financial picture — revenue, outstanding fees, salary owed, profit — all in one command-centre screen, alongside attendance health, tutor workload, academic results, and a lead-conversion funnel. The finances are genuinely invisible to ordinary admins, not just hidden on screen.

## What the system does, area by area

**Attendance** is built automatically from the Drive sheets, with short classes flagged for a human decision.

**Recordings & transcripts** stream privately to the student or tutor who owns that class — the files stay locked in the company Drive and are served only to the right person.

**Fees.** Monthly fee records are generated per student; admins log payments (or import them from the payment vendor); balances and statuses update instantly. Every amount is handled to the exact paisa, and every change is recorded in a tamper-proof log.

**Tutor salary** is calculated from the classes a tutor actually conducted — no manual tallying. Payouts are recorded and tracked.

**Tests & parent-teacher meetings.** Tutors set tests, enter marks, and write meeting summaries for their own students; students and management see the results and trends.

**Lead CRM.** Prospective students are tracked through a funnel from first enquiry to enrolment, and converting a lead creates the student record in one step.

**Reports.** Management can download CSV reports — attendance, fees, salaries, tests, leads — with finance reports restricted to the director.

**Automatic reminders.** The system emails reminders on its own: class reminders each morning, fee-due notices, parent-teacher meeting and test reminders, and confirmations when a payment or payout happens. It never sends the same reminder twice.

## How it's kept safe

- Each person can only ever see their own data; the rules are enforced by the database itself, not just the screens.
- Financial records can't be edited directly by anyone — every change goes through a controlled, logged process, so there's always an audit trail of who changed what.
- Only the director can create another director-level account or see company finances.
- Class recordings are private to the student/tutor in that class.

## What runs on its own vs. what needs a person

**Automatic:** pulling in attendance and recordings, flagging short classes, linking recordings, calculating who attended, sending reminders, keeping balances current.

**Needs a person (admin):** the initial setup of each student, subject, tutor, and their meeting codes; the final present/absent call on flagged classes; logging payments and payouts; managing leads. In short, people set things up and make judgement calls; the system does the repetitive tracking.

---

## Glossary

- **Meeting code** — the random Google Meet ID (e.g. `hgy-eqfd-dhp`); a student's is the same every day for a given subject.
- **Enrollment** — the link connecting a meeting code to a student, subject, and tutor. The backbone of the whole system.
- **Session** — one class on one day: its attendance, minutes, and recording.
- **Flagged / pending review** — a class where the student attended under 45 minutes, awaiting an admin's present/absent decision.
- **Unmapped** — an attendance sheet whose meeting code hasn't been set up yet; parked for an admin to resolve.
- **Billing month** — the month a fee or salary record belongs to (e.g. 2026-06).

---

## Appendix — technical map (for developers)

- **Frontend:** Next.js (App Router) on Vercel. Four route groups by role: admin, student, tutor (super-admin uses the admin area with extra finance access).
- **Backend:** Firebase — Firestore (database), Firebase Auth (logins; a user's role and linked record live in custom claims), Cloud Functions (the ingestion assistant, reminder cron jobs, and the recording stream).
- **Data ingestion:** a scheduled Cloud Function reads the two Drive folders via a service account, parses filenames and the attendance Google Sheets, and writes `class_sessions`. Identity comes from the `meetingCodeIndex` → `enrollments` lookup. Idempotent on `code+date`; unresolved codes go to `unmappedQueue` and are reconciled when an admin maps them.
- **Recordings:** a Range-aware Cloud Function streams Drive video to the owning user after verifying they own the session; transcripts are exported from Google Docs.
- **Finance:** all money writes go through guarded API routes (Admin SDK + audit log); clients cannot write `fees`/`payments`/`salaries`. Amounts are integer paise. Payments and reminders use deterministic-ID transactions for idempotency.
- **Security model:** Firestore rules scope every collection by role and ownership; finance and director functions check `super_admin`; the highest-privilege endpoints (set-claims, create-user) enforce a privilege ceiling.
- **Single sources of truth to preserve:** the attendance-% and test-% helpers (`academicHelpers`), the finance aggregation logic, and the notification adapter. Keep new features reading from these rather than recomputing, so the numbers never drift between screens.
- **Collections:** `students`, `tutors`, `subjects`, `enrollments`, `meetingCodeIndex`, `class_sessions`, `attendance_raw`, `fees`, `payments`, `salaries`, `tests`, `test_results`, `ptms`, `leads`, `notifications`, `audit_log`, and `_system` (ingestion state + unmapped queue).
