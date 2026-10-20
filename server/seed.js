/**
 * Writes the starter burger documents into the collection.
 *
 *   npm run seed
 *
 * Safe to run twice: documents whose `name` already exists are skipped.
 */
require('dotenv').config();

const burgers = require('./astra');

(async () => {
  if (burgers.isMock()) {
    console.log('No ASTRA_API_ENDPOINT configured — the mock store is already seeded, nothing to do.');
    return;
  }

  console.log(`Endpoint: ${burgers.collectionUrl()}`);

  // Create the collection on the first run; afterwards the Data API reports that
  // it already exists, which is fine.
  try {
    await burgers.ensureCollection();
    console.log('collection created');
  } catch (err) {
    console.log(`collection: ${err.message}`);
  }

  const existing = await burgers.list();
  const names = new Set(existing.map((doc) => doc.name));

  let added = 0;
  for (const doc of burgers.seedDocs) {
    if (names.has(doc.name)) {
      console.log(`skip   ${doc.name} (already in collection)`);
      continue;
    }
    const { documentId } = await burgers.create(doc);
    added += 1;
    console.log(`create ${doc.name} -> ${documentId}`);
  }

  console.log(`\n${added} document(s) added, ${existing.length} already present.`);
})().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
