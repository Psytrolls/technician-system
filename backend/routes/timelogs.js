const express = require('express');
const db = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/timelogs
router.get('/', authMiddleware, (req, res) => {
  const { user_id, task_id, date_from, date_to } = req.query;

  let query = `
    SELECT tl.*,
           u.name as user_name,
           t.title as task_title
    FROM time_logs tl
    LEFT JOIN users u ON tl.user_id = u.id
    LEFT JOIN tasks t ON tl.task_id = t.id
    WHERE 1=1
  `;
  const params = [];

  if (req.user.role === 'technician') {
    query += ' AND tl.user_id = ?';
    params.push(req.user.id);
  } else if (user_id) {
    query += ' AND tl.user_id = ?';
    params.push(user_id);
  }

  if (task_id) {
    query += ' AND tl.task_id = ?';
    params.push(task_id);
  }
  if (date_from) {
    query += ' AND DATE(tl.start_time) >= ?';
    params.push(date_from);
  }
  if (date_to) {
    query += ' AND DATE(tl.start_time) <= ?';
    params.push(date_to);
  }

  query += ' ORDER BY tl.start_time DESC';
  const logs = db.prepare(query).all(...params);
  res.json(logs);
});

// GET /api/timelogs/active — get active (running) timer for current user
router.get('/active', authMiddleware, (req, res) => {
  const active = db.prepare(`
    SELECT tl.*, t.title as task_title
    FROM time_logs tl
    LEFT JOIN tasks t ON tl.task_id = t.id
    WHERE tl.user_id = ? AND tl.end_time IS NULL
    ORDER BY tl.start_time DESC LIMIT 1
  `).get(req.user.id);
  res.json(active || null);
});

// POST /api/timelogs — start a new time log
router.post('/', authMiddleware, (req, res) => {
  const { task_id, equipment_id, activity_type, start_time, location, notes, is_manual, end_time } = req.body;

  if (!activity_type) return res.status(400).json({ error: 'סוג פעילות נדרש' });

  // Check if there's already an active timer for this user
  const activeLog = db.prepare(`
    SELECT id FROM time_logs WHERE user_id = ? AND end_time IS NULL
  `).get(req.user.id);

  if (activeLog && !is_manual) {
    return res.status(400).json({ error: 'יש טיימר פעיל כבר. סיים אותו קודם.' });
  }

  const startT = start_time || new Date().toISOString();
  let duration = null;
  let endT = end_time || null;

  if (is_manual && end_time) {
    const diff = (new Date(end_time) - new Date(startT)) / 60000;
    duration = Math.round(diff);
  }

  const result = db.prepare(`
    INSERT INTO time_logs (task_id, equipment_id, user_id, activity_type, start_time, end_time, duration_minutes, location, notes, is_manual)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    task_id || null,
    equipment_id || null,
    req.user.id,
    activity_type,
    startT,
    endT,
    duration,
    location || null,
    notes || null,
    is_manual ? 1 : 0
  );

  res.status(201).json({ id: result.lastInsertRowid, message: 'הטיימר הופעל' });
});

// PUT /api/timelogs/:id/stop — stop active timer
router.put('/:id/stop', authMiddleware, (req, res) => {
  const log = db.prepare('SELECT * FROM time_logs WHERE id = ?').get(req.params.id);
  if (!log) return res.status(404).json({ error: 'לוג לא נמצא' });
  if (log.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'אין הרשאה' });
  }
  if (log.end_time) return res.status(400).json({ error: 'הטיימר כבר הופסק' });

  const { notes, location } = req.body;
  const endTime = new Date().toISOString();
  const duration = Math.round((new Date(endTime) - new Date(log.start_time)) / 60000);

  db.prepare(`
    UPDATE time_logs SET end_time = ?, duration_minutes = ?, notes = COALESCE(?, notes), location = COALESCE(?, location)
    WHERE id = ?
  `).run(endTime, duration, notes || null, location || null, req.params.id);

  res.json({ message: 'הטיימר הופסק', duration_minutes: duration });
});

// PUT /api/timelogs/:id — update/correct a log (admin or original user)
router.put('/:id', authMiddleware, (req, res) => {
  const log = db.prepare('SELECT * FROM time_logs WHERE id = ?').get(req.params.id);
  if (!log) return res.status(404).json({ error: 'לוג לא נמצא' });

  const isOwner = log.user_id === req.user.id;
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin) return res.status(403).json({ error: 'אין הרשאה' });

  const { activity_type, start_time, end_time, location, notes, edit_reason } = req.body;

  let duration = log.duration_minutes;
  const newStart = start_time || log.start_time;
  const newEnd = end_time || log.end_time;
  if (newStart && newEnd) {
    duration = Math.round((new Date(newEnd) - new Date(newStart)) / 60000);
  }

  db.prepare(`
    UPDATE time_logs SET
      activity_type = COALESCE(?, activity_type),
      start_time = COALESCE(?, start_time),
      end_time = COALESCE(?, end_time),
      duration_minutes = ?,
      location = COALESCE(?, location),
      notes = COALESCE(?, notes),
      is_manual = 1,
      edited_by = ?,
      edit_reason = ?,
      edited_at = datetime('now')
    WHERE id = ?
  `).run(
    activity_type || null,
    start_time || null,
    end_time || null,
    duration,
    location || null,
    notes || null,
    req.user.id,
    edit_reason || 'תיקון ידני',
    req.params.id
  );

  res.json({ message: 'הלוג עודכן בהצלחה' });
});

// DELETE /api/timelogs/:id — admin only
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  db.prepare('DELETE FROM time_logs WHERE id = ?').run(req.params.id);
  res.json({ message: 'הלוג נמחק' });
});

module.exports = router;
