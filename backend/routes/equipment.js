const express = require('express');
const db = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/equipment — all users (technicians need this to pick equipment)
router.get('/', authMiddleware, (req, res) => {
  const { active, operator_id } = req.query;
  const conditions = [];
  const params = [];

  if (active !== 'all') {
    conditions.push('e.active = 1');
  }

  if (operator_id) {
    conditions.push(`(
      e.id IN (SELECT equipment_id FROM equipment_operators WHERE operator_id = ?)
      OR e.id NOT IN (SELECT equipment_id FROM equipment_operators)
    )`);
    params.push(parseInt(operator_id));
  }

  let query = `
    SELECT e.*, 
           (SELECT GROUP_CONCAT(o.name, ', ') 
            FROM equipment_operators eo 
            JOIN operators o ON eo.operator_id = o.id 
            WHERE eo.equipment_id = e.id) as operator_name,
           (SELECT GROUP_CONCAT(eo.operator_id, ',') 
            FROM equipment_operators eo 
            WHERE eo.equipment_id = e.id) as operator_ids
    FROM equipment e
  `;

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY e.category, e.name';

  res.json(db.prepare(query).all(...params));
});

// POST /api/equipment — admin only
router.post('/', authMiddleware, adminOnly, (req, res) => {
  const { name, category, description, operator_ids } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'שם נדרש' });
  const result = db.prepare(
    'INSERT INTO equipment (name, category, description) VALUES (?, ?, ?)'
  ).run(
    name.trim(),
    category?.trim() || null,
    description?.trim() || null
  );

  const eqId = result.lastInsertRowid;
  if (Array.isArray(operator_ids) && operator_ids.length > 0) {
    const stmt = db.prepare('INSERT INTO equipment_operators (equipment_id, operator_id) VALUES (?, ?)');
    for (const opId of operator_ids) {
      if (opId) stmt.run(eqId, parseInt(opId));
    }
  }

  res.status(201).json({ id: eqId, name, category });
});

// PUT /api/equipment/:id — admin only
router.put('/:id', authMiddleware, adminOnly, (req, res) => {
  const { name, category, description, active, operator_ids } = req.body;
  const eq = db.prepare('SELECT * FROM equipment WHERE id = ?').get(req.params.id);
  if (!eq) return res.status(404).json({ error: 'ציוד לא נמצא' });
  
  db.prepare(`
    UPDATE equipment SET
      name        = ?,
      category    = ?,
      description = ?,
      active      = ?
    WHERE id = ?
  `).run(
    name !== undefined ? name : eq.name,
    category !== undefined ? category : eq.category,
    description !== undefined ? description : eq.description,
    active !== undefined ? (active ? 1 : 0) : eq.active,
    req.params.id
  );

  if (Array.isArray(operator_ids)) {
    db.prepare('DELETE FROM equipment_operators WHERE equipment_id = ?').run(req.params.id);
    const stmt = db.prepare('INSERT INTO equipment_operators (equipment_id, operator_id) VALUES (?, ?)');
    for (const opId of operator_ids) {
      if (opId) stmt.run(req.params.id, parseInt(opId));
    }
  }

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
