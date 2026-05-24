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
           c.name as created_by_name,
           o.name as operator_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    LEFT JOIN users c ON t.created_by = c.id
    LEFT JOIN operators o ON t.operator_id = o.id
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
           c.name as created_by_name,
           o.name as operator_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    LEFT JOIN users c ON t.created_by = c.id
    LEFT JOIN operators o ON t.operator_id = o.id
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
  const { title, description, location, fault_type, assigned_to, priority, operator_id } = req.body;
  if (!title) return res.status(400).json({ error: 'כותרת נדרשת' });

  const parsedAssigned = assigned_to !== undefined && assigned_to !== '' ? parseInt(assigned_to) : null;

  const result = db.prepare(`
    INSERT INTO tasks (title, description, location, fault_type, assigned_to, priority, operator_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title,
    description || null,
    location || null,
    fault_type || null,
    parsedAssigned,
    priority || 'medium',
    operator_id !== undefined && operator_id !== '' ? parseInt(operator_id) : null,
    req.user.id
  );

  const taskId = result.lastInsertRowid;

  // 1. Log task creation in history
  db.prepare(`
    INSERT INTO task_history (task_id, user_id, action, details)
    VALUES (?, ?, 'created', 'המשימה נוצרה על ידי מנהל')
  `).run(taskId, req.user.id);

  // 2. If assigned, log assignment in history and trigger a notification
  if (parsedAssigned) {
    const assignee = db.prepare('SELECT name FROM users WHERE id = ?').get(parsedAssigned);
    const assigneeName = assignee ? assignee.name : 'טכנאי';

    db.prepare(`
      INSERT INTO task_history (task_id, user_id, action, details)
      VALUES (?, ?, 'assigned', ?)
    `).run(taskId, req.user.id, `המשימה הוקצתה לטכנאי: ${assigneeName}`);

    db.prepare(`
      INSERT INTO notifications (user_id, title, message, type, related_id)
      VALUES (?, ?, ?, 'task_assigned', ?)
    `).run(parsedAssigned, 'משימה חדשה הוקצתה לך', `הוקצתה לך משימה חדשה: "${title}"`, taskId);
  }

  res.status(201).json({ id: taskId, message: 'המשימה נוצרה בהצלחה' });
});

// PUT /api/tasks/:id — admin or assigned technician (status only)
router.put('/:id', authMiddleware, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'משימה לא נמצאה' });

  if (req.user.role === 'technician') {
    // Technicians can only update status
    const { status } = req.body;
    if (task.assigned_to !== req.user.id) return res.status(403).json({ error: 'אין הרשאה' });
    
    if (status && status !== task.status) {
      db.prepare(`UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, req.params.id);

      // 1. Log in task history
      db.prepare(`
        INSERT INTO task_history (task_id, user_id, action, details)
        VALUES (?, ?, 'status_changed', ?)
      `).run(
        req.params.id, 
        req.user.id, 
        `סטטוס המשימה שונה ל: ${status === 'in_progress' ? 'בטיפול' : (status === 'completed' ? 'הושלמה' : (status === 'cancelled' ? 'בוטלה' : 'בהמתנה'))}`
      );

      // 2. Notify task creator and other admins
      const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
      admins.forEach(admin => {
        db.prepare(`
          INSERT INTO notifications (user_id, title, message, type, related_id)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          admin.id,
          status === 'in_progress' ? 'משימה החלה' : 'משימה הושלמה',
          `הטכנאי ${req.user.name} ${status === 'in_progress' ? 'החל לעבוד על' : 'סיים את'} המשימה: "${task.title}"`,
          status === 'in_progress' ? 'work_started' : 'work_completed',
          req.params.id
        );
      });
    }
    return res.json({ message: 'הסטטוס עודכן' });
  }

  // Admin can update everything
  const { title, description, location, fault_type, assigned_to, status, priority, operator_id } = req.body;
  
  const oldAssigned = task.assigned_to;
  const oldStatus = task.status;
  const newAssigned = assigned_to !== undefined && assigned_to !== '' ? parseInt(assigned_to) : null;
  const newStatus = status || task.status;

  db.prepare(`
    UPDATE tasks SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      location = COALESCE(?, location),
      fault_type = COALESCE(?, fault_type),
      assigned_to = COALESCE(?, assigned_to),
      status = COALESCE(?, status),
      priority = COALESCE(?, priority),
      operator_id = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title,
    description,
    location,
    fault_type,
    assigned_to,
    status,
    priority,
    operator_id !== undefined ? (operator_id !== '' ? parseInt(operator_id) : null) : task.operator_id,
    req.params.id
  );

  // If assignee changed, log in history and notify
  if (newAssigned !== oldAssigned) {
    if (newAssigned) {
      const assignee = db.prepare('SELECT name FROM users WHERE id = ?').get(newAssigned);
      const assigneeName = assignee ? assignee.name : 'טכנאי';
      db.prepare(`
        INSERT INTO task_history (task_id, user_id, action, details)
        VALUES (?, ?, 'assigned', ?)
      `).run(req.params.id, req.user.id, `המשימה הוקצתה מחדש לטכנאי: ${assigneeName}`);

      db.prepare(`
        INSERT INTO notifications (user_id, title, message, type, related_id)
        VALUES (?, ?, ?, 'task_assigned', ?)
      `).run(newAssigned, 'משימה חדשה הוקצתה לך', `הוקצתה לך משימה חדשה: "${title || task.title}"`, req.params.id);
    }
  }

  // If status changed by admin, log in history and notify assignee
  if (status && status !== oldStatus) {
    db.prepare(`
      INSERT INTO task_history (task_id, user_id, action, details)
      VALUES (?, ?, 'status_changed', ?)
    `).run(req.params.id, req.user.id, `סטטוס המשימה שונה על ידי מנהל ל: ${status}`);

    const currentAssigned = newAssigned || oldAssigned;
    if (currentAssigned) {
      db.prepare(`
        INSERT INTO notifications (user_id, title, message, type, related_id)
        VALUES (?, ?, ?, 'task_updated', ?)
      `).run(currentAssigned, 'סטטוס משימה עודכן', `סטטוס המשימה "${title || task.title}" עודכן על ידי מנהל ל: ${status}`, req.params.id);
    }
  } else if (title || description || location || fault_type || priority) {
    // Log edit in history
    db.prepare(`
      INSERT INTO task_history (task_id, user_id, action, details)
      VALUES (?, ?, 'edited', 'פרטי המשימה עודכנו על ידי מנהל')
    `).run(req.params.id, req.user.id);
  }

  res.json({ message: 'המשימה עודכנה בהצלחה' });
});

// DELETE /api/tasks/:id — admin only
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'משימה לא נמצאה' });

  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ message: 'המשימה נמחקה בהצלחה' });
});

// GET /api/tasks/:id/history — get task timeline history
router.get('/:id/history', authMiddleware, (req, res) => {
  try {
    const history = db.prepare(`
      SELECT th.*, u.name as user_name
      FROM task_history th
      JOIN users u ON th.user_id = u.id
      WHERE th.task_id = ?
      ORDER BY th.created_at ASC
    `).all(req.params.id);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בטעינת היסטוריית משימה' });
  }
});

module.exports = router;
