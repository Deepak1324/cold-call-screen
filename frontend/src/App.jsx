import { useEffect, useState } from 'react';
import './App.css';

const API = import.meta.env.VITE_API_URL;

const OUTCOMES = [
  { value: 'agreed_to_receive_report', label: 'Agreed to receive report' },
  { value: 'next_step_agreed', label: 'Next step agreed' },
  { value: 'interested', label: 'Interested, no fixed step' },
  { value: 'follow_up', label: 'Follow up (we call again)' },
  { value: 'call_again', label: 'Call again (language or line)' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'do_not_call', label: 'Do not call' },
  { value: 'wrong_person', label: 'Wrong person' },
  { value: 'moved_company', label: 'Moved company' },
];
const labelOf = (v) => OUTCOMES.find((o) => o.value === v)?.label || v;

const NEED_STAGE = 5; // the one stage where we write the prospect's exact words

export default function App() {
  const [page, setPage] = useState('call');
  const [stages, setStages] = useState([]);
  const [call, setCall] = useState(null);
  const [currentStage, setCurrentStage] = useState(1);
  const [selectedTap, setSelectedTap] = useState('');
  const [prospectWords, setProspectWords] = useState('');
  const [needWords, setNeedWords] = useState('');
  const [log, setLog] = useState({}); // stage id -> tap chosen
  const [closing, setClosing] = useState(false);
  const [calls, setCalls] = useState([]);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [error, setError] = useState('');
  const [suggestion, setSuggestion] = useState(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    fetch(`${API}/stages`)
      .then((r) => r.json())
      .then(setStages)
      .catch(() => setError('Could not connect to the backend'));
  }, []);

  const lastStage = stages.length;
  const atClose = closing || (lastStage > 0 && currentStage === lastStage);
  const atLast = currentStage === lastStage;
  const stage = stages.find((s) => s.id === currentStage);
  const closeStage = stages.find((s) => s.id === lastStage);

  async function post(path, body) {
    return fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async function startCall() {
    const res = await post('/calls', { prospect_name: name, company });
    setCall(await res.json());
    setCurrentStage(1);
    setSelectedTap('');
    setProspectWords('');
    setNeedWords('');
    setLog({});
    setSuggestion(null);
    setClosing(false);
  }

  async function saveStage() {
    await post(`/calls/${call.id}/stage`, {
      stage: currentStage,
      what_happened: selectedTap,
      prospect_words: currentStage === NEED_STAGE ? prospectWords : null,
    });
    if (selectedTap) setLog((l) => ({ ...l, [currentStage]: selectedTap }));
    if (currentStage === NEED_STAGE) setNeedWords(prospectWords);
    setSelectedTap('');
    setProspectWords('');
  }

  async function nextStage() {
    await saveStage();
    setCurrentStage(currentStage + 1);
  }

  async function endEarly() {
    await saveStage();
    setClosing(true);
  }

  async function endCall(outcome) {
    if (atLast) await saveStage(); // saves the stage 8 tap and marks stage 8 as reached
    await post(`/calls/${call.id}/close`, { outcome });
    setCall(null);
    setName('');
    setCompany('');
    setClosing(false);
    setSuggestion(null);
  }

  async function askAI() {
    setAsking(true);
    setSuggestion(null);
    try {
      const all = { ...log, ...(atLast && selectedTap ? { [lastStage]: selectedTap } : {}) };
      const recap = Object.fromEntries(
        Object.entries(all).map(([id, tap]) => [stages.find((s) => s.id === Number(id))?.name, tap])
      );
      const res = await post('/suggest-outcome', { recap, words: needWords });
      const data = await res.json();
      setSuggestion(res.ok ? data : { error: true });
    } catch {
      setSuggestion({ error: true });
    }
    setAsking(false);
  }

  async function openHistory() {
    const res = await fetch(`${API}/calls`);
    setCalls(await res.json());
    setPage('history');
  }

  function Taps() {
    return (
      <>
        <p className="label">What happened here? (tap one)</p>
        <div className="taps">
          {stage.taps.map((t) => (
            <button
              key={t}
              className={selectedTap === t ? 'tap selected' : 'tap'}
              onClick={() => setSelectedTap(selectedTap === t ? '' : t)}
            >
              {t}
            </button>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="app">
      <nav>
        <button onClick={() => setPage('call')} className={page === 'call' ? 'active' : ''}>
          Live call
        </button>
        <button onClick={openHistory} className={page === 'history' ? 'active' : ''}>
          Past calls
        </button>
      </nav>

      {error && <p className="error">{error}</p>}

      {page === 'call' && !call && (
        <div className="card">
          <h2>Start a new call</h2>
          <input placeholder="Prospect name" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
          <button className="primary" onClick={startCall}>Start call</button>
        </div>
      )}

      {page === 'call' && call && stage && (
        <div className="card">
          <div className="progress">
            {stages.map((s) => (
              <span
                key={s.id}
                className={s.id === currentStage ? 'dot on' : s.id < currentStage ? 'dot done' : 'dot'}
              />
            ))}
          </div>

          {!atClose ? (
            <>
              <p className="label">Stage {stage.id} of {stages.length}</p>
              <h2>{stage.name}</h2>
              <p>{stage.purpose}</p>

              <p className="label">What tends to happen here</p>
              <ul>
                {stage.typical_responses.map((t) => <li key={t}>{t}</li>)}
              </ul>

              <Taps />

              {currentStage === NEED_STAGE && (
                <>
                  <p className="label">Prospect's exact words</p>
                  <textarea
                    placeholder="Write down exactly what they said"
                    value={prospectWords}
                    onChange={(e) => setProspectWords(e.target.value)}
                  />
                </>
              )}

              <button className="primary" onClick={nextStage}>Next stage</button>
              <button className="ghost" onClick={endEarly}>End call here</button>
            </>
          ) : (
            <>
              <p className="label">Stage {lastStage} of {lastStage}</p>
              <h2>{closeStage?.name}</h2>
              <p>{closeStage?.purpose}</p>

              <p className="label">What tends to happen here</p>
              <ul>
                {closeStage?.typical_responses.map((t) => <li key={t}>{t}</li>)}
              </ul>

              {atLast && <Taps />}

              <p className="label">What you recorded on this call</p>
              <div className="recap">
                {Object.keys(log).length === 0 && <p>Nothing tapped yet.</p>}
                {Object.keys(log).map((id) => (
                  <p key={id}>
                    <strong>{stages.find((s) => s.id === Number(id))?.name}:</strong> {log[id]}
                  </p>
                ))}
                <p><strong>Prospect's words (stage 5):</strong> {needWords || 'Not captured'}</p>
              </div>

              <button className="ghost" onClick={askAI} disabled={asking}>
                {asking ? 'Checking...' : 'Check outcome with AI'}
              </button>
              {suggestion && !suggestion.error && (
                <p className="ai">
                  <strong>AI suggests: {labelOf(suggestion.outcome)}.</strong> {suggestion.reason}
                </p>
              )}
              {suggestion?.error && (
                <p className="ai">AI is not available right now. Pick the outcome yourself.</p>
              )}

              <p className="label">Outcome: pick the one that matches the recap</p>
              {OUTCOMES.map((o) => (
                <button
                  key={o.value}
                  className={suggestion?.outcome === o.value ? 'outcome suggested' : 'outcome'}
                  onClick={() => endCall(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {page === 'history' && (
        <div className="card">
          <h2>Past calls</h2>
          {calls.length === 0 && <p>No calls yet.</p>}
          {calls.map((c) => {
            const reached = stages.find((s) => s.id === c.furthest_stage);
            return (
              <div key={c.id} className="row">
                <strong>{c.prospect_name || 'Unknown'}</strong> {c.company && `(${c.company})`}
                <div>
                  Reached: Stage {c.furthest_stage} of {stages.length || 8}
                  {reached ? ` (${reached.name})` : ''}
                </div>
                <div>Outcome: {c.outcome ? labelOf(c.outcome) : 'In progress'}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}