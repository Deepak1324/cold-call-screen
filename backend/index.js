require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// All stages (the screen content comes from here)
app.get('/stages', async (req, res) => {
  const { data, error } = await supabase.from('stages').select('*').order('id');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Start a call
app.post('/calls', async (req, res) => {
  const { prospect_name, company } = req.body;
  const { data, error } = await supabase
    .from('calls')
    .insert({ prospect_name, company })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Save one stage result (one row per call and stage)
app.post('/calls/:id/stage', async (req, res) => {
  const { stage, what_happened, prospect_words } = req.body;
  const callId = req.params.id;

  const { error } = await supabase
    .from('stage_results')
    .upsert(
      { call_id: callId, stage, what_happened, prospect_words },
      { onConflict: 'call_id,stage' }
    );
  if (error) return res.status(500).json({ error: error.message });

  const { data: call } = await supabase
    .from('calls')
    .select('furthest_stage')
    .eq('id', callId)
    .single();

  const { data, error: err2 } = await supabase
    .from('calls')
    .update({
      current_stage: stage,
      furthest_stage: Math.max(call?.furthest_stage || 1, stage),
    })
    .eq('id', callId)
    .select()
    .single();
  if (err2) return res.status(500).json({ error: err2.message });
  res.json(data);
});

// Close a call with its outcome
app.post('/calls/:id/close', async (req, res) => {
  const { outcome } = req.body;
  const { data, error } = await supabase
    .from('calls')
    .update({ outcome, ended_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// List past calls
app.get('/calls', async (req, res) => {
  const { data, error } = await supabase
    .from('calls')
    .select('*')
    .order('started_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

const OUTCOME_VALUES = [
  'agreed_to_receive_report',
  'next_step_agreed',
  'interested',
  'follow_up',
  'call_again',
  'not_interested',
  'do_not_call',
  'wrong_person',
  'moved_company',
];

// Second opinion on the outcome, based on what the caller recorded
app.post('/suggest-outcome', async (req, res) => {
  try {
    const { recap, words } = req.body;
    if (!recap || Object.keys(recap).length === 0) {
      return res.status(400).json({ error: 'Nothing recorded yet' });
    }

    const prompt = `You help a cold caller log the right outcome after a call.
You get what the caller recorded at each stage. Pick the ONE outcome that best matches it.

Outcomes:
- agreed_to_receive_report: prospect agreed to receive a document on WhatsApp or email
- next_step_agreed: a meeting, a call at a set time, or a report plus follow-up call was agreed
- interested: prospect said they are interested, but nothing fixed
- follow_up: the caller is to call again, for example prospect asked to be called later
- call_again: call again because of language or a bad line
- not_interested: prospect declined
- do_not_call: prospect asked not to be called
- wrong_person: person reached is not the right person
- moved_company: person no longer works at the listed company

Rules: use only the recap below. Do not guess beyond it. A polite goodbye after a no is still a no.
If the prospect only asked to be called later, that is follow_up, not interested.

Recap by stage: ${JSON.stringify(recap)}
Prospect's words at stage 5: ${JSON.stringify(words || '')}

Answer ONLY as JSON: {"outcome": "<one outcome value>", "reason": "<one short sentence>"}`;

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
        }),
      }
    );
    if (!r.ok) return res.status(502).json({ error: `Gemini error ${r.status}` });

    const j = await r.json();
    const text = j.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

    if (!OUTCOME_VALUES.includes(parsed.outcome)) {
      return res.status(502).json({ error: 'Unexpected answer from the model' });
    }
    res.json({ outcome: parsed.outcome, reason: String(parsed.reason || '').slice(0, 200) });
  } catch (e) {
    console.log('suggest-outcome failed:', e.message);
    res.status(502).json({ error: 'AI suggestion failed' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));