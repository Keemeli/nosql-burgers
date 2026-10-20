import { useEffect, useMemo, useState } from 'react';

const EMPTY_FORM = {
  name: '',
  description: '',
  ingredients: '',
  address: '',
  zip: '',
  website: '',
  visited: false,
};

// Turn the form into the JSON document that goes into the collection.
function toDocument(form) {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    ingredients: form.ingredients
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    visited: form.visited,
    location: {
      address: form.address.trim(),
      zip: form.zip === '' ? null : Number(form.zip),
      website: form.website.trim(),
    },
  };
}

// Documents come back with their document id in `_id`; never send it in a PUT body.
function toPayload(doc) {
  const { _id, ...rest } = doc;
  return rest;
}

export default function App() {
  const [burgers, setBurgers] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setStatus('loading');
      setError('');
      const res = await fetch('/burgers');
      if (!res.ok) throw new Error(`API responded ${res.status}`);
      setBurgers(await res.json());
      setStatus('ready');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addBurger(event) {
    event.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/burgers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(toDocument(form)),
      });
      if (!res.ok) throw new Error(`Could not save (${res.status})`);
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeBurger(id) {
    setBusy(true);
    try {
      const res = await fetch(`/burgers/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Could not delete (${res.status})`);
      setBurgers((current) => current.filter((doc) => doc._id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleVisited(doc) {
    setBusy(true);
    try {
      const updated = { ...toPayload(doc), visited: !doc.visited };
      const res = await fetch(`/burgers/${encodeURIComponent(doc._id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (!res.ok) throw new Error(`Could not update (${res.status})`);
      setBurgers((current) =>
        current.map((item) => (item._id === doc._id ? { ...item, visited: !item.visited } : item)),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return burgers;
    return burgers.filter((doc) => {
      const haystack = [doc.name, doc.description, ...(doc.ingredients || [])]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [burgers, query]);

  const visitedCount = burgers.filter((doc) => doc.visited).length;

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="kicker">Astra DB · Data API</p>
          <h1>Burger places worth the detour</h1>
          <p className="lede">
            Every entry is one JSON document in the <code>burger_info</code> collection — no
            schema, no migrations, nested objects and arrays included.
          </p>
        </div>
        <div className="stats">
          <span className="stat">
            <strong>{burgers.length}</strong> documents
          </span>
          <span className="stat">
            <strong>{visitedCount}</strong> visited
          </span>
          <span className={`badge ${status}`}>{status === 'error' ? 'API offline' : status}</span>
        </div>
      </header>

      <div className="toolbar">
        <input
          type="search"
          value={query}
          placeholder="Search name, description or ingredient…"
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="primary" onClick={() => setShowForm((open) => !open)}>
          {showForm ? 'Close' : 'Add a burger place'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {showForm && (
        <form className="card form" onSubmit={addBurger}>
          <label>
            Name
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Bob's Burgers"
            />
          </label>
          <label>
            Description
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Tasty burgers from a fictional TV restaurant"
            />
          </label>
          <label>
            Ingredients <span className="hint">comma separated</span>
            <input
              value={form.ingredients}
              onChange={(e) => setForm({ ...form, ingredients: e.target.value })}
              placeholder="beef patty, tomato, cheese"
            />
          </label>
          <div className="row">
            <label>
              Address
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="45 Lambda Drive"
              />
            </label>
            <label>
              ZIP
              <input
                value={form.zip}
                onChange={(e) => setForm({ ...form, zip: e.target.value })}
                placeholder="12345"
                inputMode="numeric"
              />
            </label>
          </div>
          <label>
            Website
            <input
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://www.bobsburgers.com"
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.visited}
              onChange={(e) => setForm({ ...form, visited: e.target.checked })}
            />
            I have eaten here
          </label>
          <div className="actions">
            <button className="primary" disabled={busy || !form.name.trim()}>
              {busy ? 'Saving…' : 'Save document'}
            </button>
          </div>
        </form>
      )}

      {status === 'loading' && <p className="muted">Loading documents…</p>}

      {status === 'ready' && visible.length === 0 && (
        <p className="muted">No documents match “{query}”.</p>
      )}

      <section className="grid">
        {visible.map((doc) => (
          <article className="card" key={doc._id}>
            <div className="card-head">
              <h2>{doc.name}</h2>
              <span className={`pill ${doc.visited ? 'yes' : 'no'}`}>
                {doc.visited ? 'visited' : 'to try'}
              </span>
            </div>

            {doc.description && <p className="description">{doc.description}</p>}

            {doc.ingredients?.length > 0 && (
              <ul className="tags">
                {doc.ingredients.map((ingredient, index) => (
                  <li key={`${doc._id}-${ingredient}-${index}`}>{ingredient}</li>
                ))}
              </ul>
            )}

            <dl className="meta">
              {doc.location?.address && (
                <>
                  <dt>Where</dt>
                  <dd>
                    {doc.location.address}
                    {doc.location.zip ? `, ${doc.location.zip}` : ''}
                  </dd>
                </>
              )}
              {doc.location?.website && (
                <>
                  <dt>Site</dt>
                  <dd>
                    <a href={doc.location.website} target="_blank" rel="noreferrer">
                      {doc.location.website.replace(/^https?:\/\//, '')}
                    </a>
                  </dd>
                </>
              )}
              <dt>Document</dt>
              <dd className="id">{doc._id}</dd>
            </dl>

            <div className="actions">
              <button onClick={() => toggleVisited(doc)} disabled={busy}>
                {doc.visited ? 'Mark unvisited' : 'Mark visited'}
              </button>
              <button className="danger" onClick={() => removeBurger(doc._id)} disabled={busy}>
                Delete
              </button>
            </div>
          </article>
        ))}
      </section>

      <footer className="footer">
        Project 1 — NoSQL course · Express reading the Astra Data API over HTTP
      </footer>
    </div>
  );
}
