-- Cold call screen: database schema (Supabase / Postgres)

-- One row per call
create table if not exists calls (
  id uuid primary key default gen_random_uuid(),
  prospect_name text,
  company text,
  outcome text,
  current_stage int default 1,
  furthest_stage int default 1,
  started_at timestamptz default now(),
  ended_at timestamptz
);

-- One row per call and stage, so a call's stages are stored without loss or duplicates
create table if not exists stage_results (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references calls(id) on delete cascade,
  stage int not null,
  what_happened text,
  prospect_words text,
  created_at timestamptz default now(),
  unique (call_id, stage)
);

-- The content the screen shows for each stage
create table if not exists stages (
  id int primary key,
  name text not null,
  purpose text not null,
  typical_responses text[] not null default '{}',
  taps text[] not null default '{}'
);

-- The backend uses the secret key, which bypasses RLS.
alter table calls enable row level security;
alter table stage_results enable row level security;
alter table stages enable row level security;

-- Stage content (seed data)
insert into stages (id, name, purpose, typical_responses, taps) values
(1, 'Opening',
 'Reach the right person and say who you are. The prospect decides in the first ten seconds whether this call is worth a minute.',
 array['A switchboard or an assistant answers and asks what it is about',
       'The person answers but is somewhere else: driving, in a meeting, at lunch',
       'The number belongs to somebody who left the company a year ago',
       'They ask "from where?" two or three times because the company name was not caught',
       'Bad line or language mismatch: they ask for Hindi or another language'],
 array['Reached the right person','Reception or assistant answered','Busy or somewhere else','Wrong person or old number','Left the company','Language or line problem']),

(2, 'Purpose',
 'Say in one or two sentences why you called, in words the prospect can repeat to a colleague. A purpose they cannot repeat is a purpose they did not hear.',
 array['They ask what the company does, often twice, because the first answer was a label',
       'They ask where you got their number',
       'They ask what the report is, whether it is free, and where it will be published',
       'They guess it is a sales call and say so'],
 array['Purpose understood','Asked what we do','Asked what the report is','Asked if free or where published','Asked where we got the number','Called it a sales call']),

(3, 'Permission',
 'Find out whether they are willing to talk now. A clear yes, a clear no, or a time to call back are all good outcomes. Talking on without one is not.',
 array['Call me after two, call me tomorrow, call me in an hour',
       'Send it on WhatsApp or email first',
       'A short yes, and then they go quiet and wait',
       'They keep talking without answering, which is not a yes'],
 array['Clear yes','Clear no','Gave a callback time','Asked for WhatsApp or email first','No clear answer']),

(4, 'Their business',
 'Ask about their company and their work before saying anything about yours. People talk about what they do; they rarely listen to what you do.',
 array['They answer in one line and wait for the pitch',
       'They correct you: they do not make that, they are not that size, that is a different division',
       'They say this office or person does not handle that area',
       'They ask you to tell them about yourself first'],
 array['Talked about their work','Answered in one line','Corrected us','Not their area','Asked us to go first','Skipped this stage']),

(5, 'Their need, in their words',
 'Hear what they are trying to do or struggling with, in their own words. This is the one stage where the caller writes down exactly what was said.',
 array['They name a goal: a new market, a new product line, a plant running below capacity',
       'They say everything is fine and there is nothing they need',
       'They say they are too small or too early for this right now',
       'They turn it around and ask what you can do for a company like theirs'],
 array['Named a goal','Described a struggle','Said everything is fine','Asked what we can do for them','Nothing captured']),

(6, 'Objection',
 'Hear the reason for a no and understand it. A reason you understand can be answered on this call or the next; a reason you talked over cannot.',
 array['We already have an agency, a consultant, an in-house team',
       'Not the right person; speak to marketing, speak to the owner',
       'Send something in writing and we will see',
       'You are an outside party, so I cannot share anything'],
 array['Already has agency or in-house team','Not the right person','Asked for something in writing','Cannot share with outsiders','No reason given','Reason understood']),

(7, 'Next step',
 'Agree one concrete thing: a document on WhatsApp or email, a call at a named time, a meeting. One thing, named, with a time or a channel.',
 array['A yes to receiving a document, which may be politeness rather than interest',
       'A time named by them, which is worth more than a time proposed by you',
       'A referral to a colleague, with or without a number'],
 array['Report on WhatsApp','Report on email','They named a time','We proposed a time','Referred to a colleague','Nothing agreed']),

(8, 'Close',
 'End the call clearly and record what happened: the outcome, the next step, and the prospect''s words from stage 5. The record is what the next call is built on.',
 array['The call ends mid-sentence, because the line dropped or they hung up',
       'A warm goodbye after a no, which is still a no',
       'The caller logs an outcome that does not match what was said on the call'],
 array['Confirmed next step','Warm goodbye after a no','Line dropped or hung up']);