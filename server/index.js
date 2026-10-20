// Load the repo-root .env regardless of the working directory the server is
// started from (`npm --prefix server ...` runs with cwd = server/).
require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });

const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const burgers = require('./astra');

const app = express();
const PORT = Number(process.env.PORT) || 8000;

app.use(morgan('tiny'));
app.use(cors());
app.use(express.json());

/* -------------------------------------------------------------------- routes */

app.get('/health', (req, res) => {
  res.json({ ok: true, mode: burgers.isMock() ? 'mock' : 'astra' });
});

// All burger documents in the collection
app.get('/burgers', async (req, res, next) => {
  try {
    const documents = await burgers.list();
    res.json(documents);
  } catch (err) {
    next(err);
  }
});

// A single document by its document id
app.get('/burgers/:id', async (req, res, next) => {
  try {
    const document = await burgers.get(req.params.id);
    if (!document) return res.status(404).json({ error: 'not found' });
    res.json(document);
  } catch (err) {
    next(err);
  }
});

// Add a document — no schema, the JSON body is the document
app.post('/burgers', async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!body.name || typeof body.name !== 'string') {
      return res.status(400).json({ error: '`name` is required' });
    }
    const created = await burgers.create(normalise(body));
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

app.put('/burgers/:id', async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!body.name || typeof body.name !== 'string') {
      return res.status(400).json({ error: '`name` is required' });
    }
    const updated = await burgers.update(req.params.id, normalise(body));
    if (!updated) return res.status(404).json({ error: 'not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

app.delete('/burgers/:id', async (req, res, next) => {
  try {
    const deleted = await burgers.remove(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ helpers */

// Keep the document shape predictable for the UI without imposing a schema on
// the collection: anything extra the client sends is stored as-is.
function normalise(body) {
  return {
    ...body,
    name: body.name.trim(),
    description: body.description || '',
    ingredients: Array.isArray(body.ingredients)
      ? body.ingredients.map((item) => String(item).trim()).filter(Boolean)
      : [],
    visited: Boolean(body.visited),
    location: {
      address: body.location?.address || '',
      zip: body.location?.zip ?? null,
      website: body.location?.website || '',
    },
  };
}

/* ----------------------------------------------------------------- handlers */

// Single-port mode: after `npm run build`, the Express server also serves the
// built React app, so the whole project runs from http://localhost:8000.
const clientDist = path.join(__dirname, '..', 'client', 'dist');
const clientIndex = path.join(clientDist, 'index.html');
const hasClient = fs.existsSync(clientIndex);
if (hasClient) {
  app.use(express.static(clientDist));
}

app.use((req, res) => {
  // Let the React app handle its own routes on a plain browser GET.
  const isApi = req.path.startsWith('/burgers') || req.path.startsWith('/health');
  if (hasClient && req.method === 'GET' && !isApi) {
    return res.sendFile(clientIndex);
  }
  res.status(404).json({ error: `not found: ${req.method} ${req.originalUrl}` });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  console.error(err.message);
  res.status(status).json({ error: err.message });
});

app.listen(PORT, () => {
  const mode = burgers.isMock() ? 'in-memory mock' : 'Astra DB Document API';
  console.log(`Server is running on port ${PORT} (${mode})`);
});
