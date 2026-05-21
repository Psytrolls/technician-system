const express = require('express');
const db = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/tasks
router.get('/', authMiddleware, (req, res) => {
  const { status, assigned_to, priority } = req.query;
  let query = `
    SELECT t.*,
           u.name as assigned_name,
           c.name as created_by_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    LEFT JOIN users c ON t.created_by = c.id
    WHERE 1=1
  `;
  const params = [];

  // Technicians see their own tasks + tasks assigned to everyone (assigned_to = 0)
  if (req.user.role === 'technician') {
    query += ' AND (t.assigned_to = ? OR t.assigned_to = 0)';
    params.push(req.user.id);
  } else if (assigned_to) {
    query += ' AND t.assigned_to = ?';
    params.push(assigned_to);
  }

  if (status) {
    query += ' AND t.status = ?';
    params.push(status);
  }
  if (priority) {
    query += ' AND t.priority = ?';
    params.push(priority);
  }

  query += ' ORDER BY t.created_at DESC';
  const tasks = db.prepare(query).all(...params);
  res.json(tasks);
});

// GET /api/tasks/:id
router.get('/:id', authMiddleware, (req, res) => {
  const task = db.prepare(`
    SELECT t.*,
           u.name as assigned_name,
           c.name as created_by_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    LEFT JOIN users c ON t.created_by = c.id
    WHERE t.id = ?
  `).get(req.params.id);

  if (!task) return res.status(404).json({ error: 'משימה לא נמצאה' });

  if (req.user.role === 'technician' && task.assigned_to !== req.user.id && task.assigned_to !== 0) {
    return res.status(403).json({ error: 'אין הרשאה' });
  }
  res.json(task);
});

// POST /api/tasks — admin only
router.post('/', authMiddleware, adminOnly, (req, res) => {
  const { title, description, location, fault_type, assigned_to, priority } = req.body;
  if (!title) return res.status(400).json({ error: 'כותרת נדרשת' });

  const result = db.prepare(`
    INSERT INTO tasks (title, description, location, fault_type, assigned_to, priority, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    title,
    description || null,
    location || null,
    fault_type || null,
    assigned_to !== undefined && assigned_to !== '' ? parseInt(assigned_to) : null,
    priority || 'medium',
    req.user.id
  );

  res.status(201).json({ id: result.lastInsertRowid, message: 'המשימה נוצרה בהצלחה' });
});

// PUT /api/tasks/:id — admin or assigned technician (status only)
router.put('/:id', authMiddleware, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'משימה לא נמצאה' });

  if (req.user.role === 'technician') {
    // Technicians can only update status
    const { status } = req.body;
    if (task.assigned_to !== req.user.id) return res.status(403).json({ error: 'אין הרשאה' });
    if (status) {
      db.prepare(`UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, req.params.id);
    }
    return res.json({ message: 'הסטטוס עודכן' });
  }

  // Admin can update everything
  const { title, description, location, fault_type, assigned_to, status, priority } = req.body;
  db.prepare(`
    UPDATE tasks SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      location = COALESCE(?, location),
      fault_type = COALESCE(?, fault_type),
      assigned_to = COALESCE(?, assigned_to),
      status = COALESCE(?, status),
      priority = COALESCE(?, priority),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(title, description, location, fault_type, assigned_to, status, priority, req.params.id);

  res.json({ message: 'המשימה עודכנה בהצלחה' });
});

// DELETE /api/tasks/:id — admin only
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'משימה לא נמצאה' });

  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ message: 'המשימה נמחקה בהצלחה' });
});

module.exports = router;
