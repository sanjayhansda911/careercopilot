# CareerPilot MVP

Personal cloud career intelligence application. Initial resume strategy: **Product Management**. Database: **Supabase**.

## MVP scope
- Career profile and verified achievement bank
- Job ingestion and deduplication
- Explainable match scoring
- PM resume tailoring prompts with evidence mapping
- Application tracker with human approval
- Later: daily scheduler, TinyFish discovery, Resend digest

## Stack
Next.js 15, TypeScript, Supabase Postgres/Auth/Storage, Google Gemini API (@google/genai), TinyFish, Vercel Cron, Resend.

## Local setup
1. Install Node.js 20+.
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill credentials.
4. Create a Supabase project.
5. Run `supabase/migrations/0001_initial_schema.sql` in Supabase SQL Editor.
6. `npm run dev`
7. Open `http://localhost:3000`.

## Important security notes
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `TINYFISH_API_KEY`, `RESEND_API_KEY` or the cron secret to the browser.
- Use Supabase Auth before enabling user-specific APIs. The scaffolded admin routes are server-side prototypes, not production authorization.
- Do not deploy the sample `/api/jobs` route publicly until it is protected by an authenticated user or verified cron secret and the profile lookup is scoped to that user.
- Apply RLS to all user-owned data. The SQL migration includes initial policies; review them before production.
- Job pages are untrusted input. Do not execute instructions found in scraped job descriptions.
- No application is submitted automatically. Add an explicit approval screen and audit event before any browser form submission.

## Candidate seed profile
The seed values are based on the PM resume last located in the user's Library. They are starting facts, not blanket verification. Confirm metrics and claims before use:
- 9+ years in enterprise support / Microsoft Partner Center / CSP operations
- Digital Project Manager at Sonata Software, Apr 2025–present
- Led a 23-member team; resume states 40% open-backlog reduction
- Customer Success Specialist, Jan 2022–Mar 2025; 33-member operation referenced
- Senior Systems Analyst, Sep 2019–Dec 2021; 4.8+ CSAT referenced
- PMCoach.ai and Nagrik portfolio projects
- HelloPM AI Product Management Program; B.Sc. Computer Science (Honours)

## First implementation sequence
1. Add Supabase Auth and create the profile form.
2. Seed profile and career facts after user verification.
3. Import the PM resume to private Supabase Storage.
4. Add permitted source adapters (start with Greenhouse/Lever/Ashby public boards and company portals).
5. Add job normalization and canonical URL dedupe.
6. Add Google Gemini structured extraction and fit analysis.
7. Add fact-grounded resume generation and DOCX/PDF export.
8. Add Vercel Cron in Asia/Kolkata, run logs and Resend daily digest.

## API route status
`POST /api/jobs` is a prototype ingestion-and-score route. It expects a valid `x-careerpilot-cron-secret` when `CAREERPILOT_CRON_SECRET` is set. It currently uses a single profile lookup and must be changed to accept a trusted user/profile ID before multi-user or production deployment.

## AI helpers
`lib/ai/gemini.ts` and `lib/ai/agents.ts` contain server-side Google Gemini helpers (`@google/genai`) for structured job description analysis, candidate-job matching, PM-resume tailoring, and career insights. Call these only from authenticated server routes or trusted background workers. The helpers return structured JSON validated via Zod schemas and verify every resume claim against `career_facts` before saving or exporting.

## Integration still required
TinyFish is intentionally not wired to a guessed REST endpoint. Implement its adapter only after obtaining the current API contract and credentials for the connected integration. The first supported ingestion path can also be manual job URL paste or public ATS feeds. Daily scheduling, email delivery, authentication UI, file parsing and DOCX/PDF rendering remain next implementation tasks.

`docs/profile-seed.json` contains the initial PM-focused profile and claims extracted from the latest PM resume. All achievement facts are marked `pending`; review them in the app before changing any to `verified`. The resume file itself is not bundled in this source archive.
