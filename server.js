const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

const MONGODB_URI = process.env.MONGODB_URI;
const DATA_FILE = path.join(__dirname, 'guests.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

let db = null;

async function getDb() {
  if (db) return db;
  if (!MONGODB_URI) return null;
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db('evodia_luncheon');
  return db;
}

function readGuestsFromFile() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch { return []; }
}

function writeGuestsToFile(guests) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(guests, null, 2));
}

async function readGuests() {
  const database = await getDb();
  if (database) {
    return await database.collection('guests').find().sort({ submittedAt: -1 }).toArray();
  }
  return readGuestsFromFile();
}

async function writeGuests(guests) {
  const database = await getDb();
  if (database) {
    await database.collection('guests').deleteMany({});
    if (guests.length > 0) {
      await database.collection('guests').insertMany(guests);
    }
    return;
  }
  writeGuestsToFile(guests);
}

app.post('/api/rsvp', async (req, res) => {
  const { name, drink } = req.body;
  if (!name || !drink) {
    return res.status(400).json({ error: 'Name and drink are required' });
  }
  try {
    const guest = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name,
      drink,
      submittedAt: new Date().toLocaleString()
    };
    const database = await getDb();
    if (database) {
      await database.collection('guests').insertOne(guest);
    } else {
      const guests = readGuestsFromFile();
      guests.push(guest);
      writeGuestsToFile(guests);
    }
    res.status(201).json(guest);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save RSVP' });
  }
});

app.get('/api/guests', async (_req, res) => {
  try {
    const guests = await readGuests();
    res.json(guests);
  } catch {
    res.json([]);
  }
});

app.delete('/api/guests/:id', async (req, res) => {
  try {
    const database = await getDb();
    if (database) {
      const result = await database.collection('guests').deleteOne({ id: req.params.id });
      if (result.deletedCount === 0) return res.status(404).json({ error: 'Guest not found' });
    } else {
      const guests = readGuestsFromFile();
      const idx = guests.findIndex(g => g.id === req.params.id);
      if (idx === -1) return res.status(404).json({ error: 'Guest not found' });
      guests.splice(idx, 1);
      writeGuestsToFile(guests);
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete guest' });
  }
});

app.get('/api/stats', async (_req, res) => {
  try {
    const guests = await readGuests();
    res.json({
      total: guests.length,
      alcoholic: guests.filter(g => g.drink === 'Alcoholic').length,
      nonAlcoholic: guests.filter(g => g.drink === 'Non-alcoholic').length
    });
  } catch {
    res.json({ total: 0, alcoholic: 0, nonAlcoholic: 0 });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`RSVP server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
