const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.VERCEL
  ? path.join('/tmp', 'guests.json')
  : path.join(__dirname, 'guests.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

function readGuests() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      if (process.env.VERCEL) {
        const source = path.join(__dirname, 'guests.json');
        if (fs.existsSync(source)) {
          fs.copyFileSync(source, DATA_FILE);
        }
      }
      return [];
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch { return []; }
}

function writeGuests(guests) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(guests, null, 2));
}

app.post('/api/rsvp', (req, res) => {
  const { name, drink } = req.body;
  if (!name || !drink) {
    return res.status(400).json({ error: 'Name and drink are required' });
  }
  const guests = readGuests();
  const guest = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    drink,
    submittedAt: new Date().toLocaleString()
  };
  guests.push(guest);
  writeGuests(guests);
  res.status(201).json(guest);
});

app.get('/api/guests', (_req, res) => {
  res.json(readGuests());
});

app.delete('/api/guests/:id', (req, res) => {
  const guests = readGuests();
  const idx = guests.findIndex(g => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Guest not found' });
  guests.splice(idx, 1);
  writeGuests(guests);
  res.json({ success: true });
});

app.get('/api/stats', (_req, res) => {
  const guests = readGuests();
  res.json({
    total: guests.length,
    alcoholic: guests.filter(g => g.drink === 'Alcoholic').length,
    nonAlcoholic: guests.filter(g => g.drink === 'Non-alcoholic').length
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`RSVP server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
