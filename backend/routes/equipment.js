const express = require('express');
const db = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/equipment — all users (technicians need this to pick equipment)
router.get('/', authMiddleware, (req, res) => {
  const { active } = req.query;
  let query = 'SELECT * FROM equipment';
  if (active !== 'all') query += ' WHERE active = 1';
  query += ' ORDER BY category, name';
  res.json(db.prepare(query).all());
});

// POST /api/equipment — admin only
router.post('/', authMiddleware, adminOnly, (req, res) => {
  const { name, category, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'שם נדרש' });
  const result = db.prepare(
    'INSERT INTO equipment (name, category, description) VALUES (?, ?, ?)'
  ).run(name.trim(), category?.trim() || null, description?.trim() || null);
  res.status(201).json({ id: result.lastInsertRowid, name, category });
});

// PUT /api/equipment/:id — admin only
router.put('/:id', authMiddleware, adminOnly, (req, res) => {
  const { name, category, description, active } = req.body;
  const eq = db.prepare('SELECT * FROM equipment WHERE id = ?').get(req.params.id);
  if (!eq) return res.status(404).json({ error: 'ציוד לא נמצא' });
  db.prepare(`
    UPDATE equipment SET
      name        = COALESCE(?, name),
      category    = COALESCE(?, category),
      description = COALESCE(?, description),
      active      = COALESCE(?, active)
    WHERE id = ?
  `).run(
    name ?? null,
    category ?? null,
    description ?? null,
    active !== undefined ? (active ? 1 : 0) : null,
    req.params.id
  );
  res.json({ message: 'עודכן בהצלחה' });
});

// DELETE /api/equipment/:id — admin only (soft)
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  db.prepare('UPDATE equipment SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'הוסר מהרשימה' });
});

// GET /api/equipment/stats — admin: usage statistics per equipment
router.get('/stats', authMiddleware, adminOnly, (req, res) => {
  const { date_from, date_to } = req.query;
  const filters = ['tl.end_time IS NOT NULL', 'tl.equipment_id IS NOT NULL'];
  if (date_from) filters.push(`DATE(tl.start_time) >= '${date_from}'`);
  if (date_to)   filters.push(`DATE(tl.start_time) <= '${date_to}'`);

  const stats = db.prepare(`
    SELECT e.name,
           e.category,
           COUNT(*)                              AS service_count,
           ROUND(SUM(tl.duration_minutes)/60.0,1) AS total_hours,
           ROUND(AVG(tl.duration_minutes),0)    AS avg_minutes
    FROM time_logs tl
    JOIN equipment e ON tl.equipment_id = e.id
    WHERE ${filters.join(' AND ')}
    GROUP BY e.id
    ORDER BY service_count DESC
  `).all();
  res.json(stats);
});

module.exports = router;
