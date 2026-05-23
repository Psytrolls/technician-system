const express = require('express');
const db = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/operators — all users (technicians need this to pick operator)
router.get('/', authMiddleware, (req, res) => {
  const { active } = req.query;
  let query = 'SELECT * FROM operators';
  if (active !== 'all') query += ' WHERE active = 1';
  query += ' ORDER BY name';
  res.json(db.prepare(query).all());
});

// POST /api/operators — admin only
router.post('/', authMiddleware, adminOnly, (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'שם מפעיל נדרש' });
  const result = db.prepare(
    'INSERT INTO operators (name) VALUES (?)'
  ).run(name.trim());
  res.status(201).json({ id: result.lastInsertRowid, name });
});

// PUT /api/operators/:id — admin only
router.put('/:id', authMiddleware, adminOnly, (req, res) => {
  const { name, active } = req.body;
  const op = db.prepare('SELECT * FROM operators WHERE id = ?').get(req.params.id);
  if (!op) return res.status(404).json({ error: 'מפעיל לא נמצא' });
  db.prepare(`
    UPDATE operators SET
      name   = COALESCE(?, name),
      active = COALESCE(?, active)
    WHERE id = ?
  `).run(
    name ?? null,
    active !== undefined ? (active ? 1 : 0) : null,
    req.params.id
  );
  res.json({ message: 'עודכן בהצלחה' });
});

// DELETE /api/operators/:id — admin only (soft)
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  db.prepare('UPDATE operators SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'הוסר מהרשימה' });
});

module.exports = router;
