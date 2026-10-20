# Cold call screen

A screen a caller keeps open beside a cold call. It shows which of the eight stages
the call is in, what that stage is for, what prospects tend to say at that point,
and lets the caller tap what happened. After the call it is saved, and a second screen
lists past calls with the stage each one reached.

## Live links

- Screen (Vercel): (https://cold-call-screen-kappa.vercel.app)
- Backend (Render): (https://cold-call-screen.onrender.com)
- Health endpoint: (https://cold-call-screen.onrender.com/health)

The Render free tier sleeps when idle, so the first request can take about a minute.

## How the three pieces fit

- **Supabase** holds the data: calls, one row per stage of a call, the stage content.
- **Render** runs the Express backend. It is the only thing that talks to Supabase and Gemini.
- **Vercel** serves the React screen, which only talks to the backend.

The Supabase secret key and the Gemini key live only in the backend environment.
The screen never sees them.

## The LLM use

**Model:** Gemini (free tier), called from the backend.
**What it does:** on the Close screen, the caller can press "Check outcome with AI".
The backend sends what the caller tapped at each stage, plus the prospect's words from
stage 5, and Gemini suggests one outcome with a one-line reason. The suggested button
is highlighted. The caller still picks the outcome.

**Why this use:** in the transcripts, the outcome the caller logged often does not match
what was said on the call. A second opinion at the moment of logging targets that.
It only runs on a button press (free-tier limits are small), and the screen works
the same if the AI is unavailable.

## What each stage shows

The eight stages follow the structure given with the task. For each stage the screen
shows its purpose, what prospects tend to say, and a few taps for what happened.
Only stage 5 has a text box, because that is the one stage where the caller writes
down the prospect's exact words. The Close screen recaps the taps and the stage 5 words
before the outcome is chosen.

The taps and the "what tends to happen" lists were shaped by reading the transcripts,
for example: many calls end at Opening (wrong person, person left the company), and
language or a bad line ends some calls (see T032, which is why Opening has a
"Language or line problem" tap).

## Schema

`schema.sql` holds the tables. `calls` is one row per call. `stage_results` has one row
per call and stage (unique on `call_id, stage`), so one call's stages are stored
without loss or duplicates. `stages` holds the content the screen shows.

## Run locally

Backend:

    cd backend
    npm install
    # create backend/.env with SUPABASE_URL, SUPABASE_KEY, GEMINI_API_KEY, GEMINI_MODEL, PORT
    npm start

Frontend:

    cd frontend
    npm install
    # create frontend/.env with VITE_API_URL=http://localhost:3000
    npm run dev

## What I left out, and why

- **Login and users:** this is a demo for one caller. The backend URL is public, so anyone who knows it can create calls.
- **Editing a call after it is closed:** the record is what the next call is built on, so it should not change.
- **More than one tap per stage:** a live caller needs one fast tap, not a form.
- **Going back to an earlier stage:** a call only moves forward.
- **AI that runs on every call:** the free tier is small, and the caller decides first.
- **Search and filters on past calls:** the live call screen came first in 48 hours.
- **Transcripts in the repo or the database:** they are for reading only and are not published.