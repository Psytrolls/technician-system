const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

const ADMIN_SECRET_CODE = '321094914';

// GET /api/users — admin only
router.get('/', authMiddleware, adminOnly, (req, res) => {
  const users = db.prepare(`
    SELECT id, name, username, role, active, created_at FROM users ORDER BY name
  `).all();
  res.json(users);
});

// GET /api/users/:id
router.get('/:id', authMiddleware, (req, res) => {
  // Technicians can only view their own profile
  if (req.user.role !== 'admin' && req.user.id !== parseInt(req.params.id)) {
    return res.status(403).json({ error: 'אין הרשאה' });
  }
  const user = db.prepare('SELECT id, name, username, role, active, created_at FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'משתמש לא נמצא' });
  res.json(user);
});

// POST /api/users — admin only
router.post('/', authMiddleware, adminOnly, (req, res) => {
  const { name, username, password, role } = req.body;
  if (!name || !username || !password || !role) {
    return res.status(400).json({ error: 'כל השדות נדרשים' });
  }
  if (!['technician', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'תפקיד לא תקין' });
  }

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ error: 'שם המשתמש כבר קיים' });

  const hashed = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, ?)
  `).run(name, username, hashed, role);

  res.status(201).json({ id: result.lastInsertRowid, name, username, role });
});

// PUT /api/users/:id — admin only
router.put('/:id', authMiddleware, adminOnly, (req, res) => {
  const { name, role, active, password, secret_code } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'משתמש לא נמצא' });

  // If trying to change password of an admin user — require secret code
  if (user.role === 'admin' && password) {
    if (!secret_code || String(secret_code).trim() !== ADMIN_SECRET_CODE) {
      return res.status(403).json({ error: 'נדרש קוד סודי לשינוי סיסמת מנהל' });
    }
  }

  const newName = name ?? user.name;
  const newRole = role ?? user.role;
  const newActive = active !== undefined ? (active ? 1 : 0) : user.active;
  const newPassword = password ? bcrypt.hashSync(password, 10) : user.password;

  db.prepare(`
    UPDATE users SET name = ?, role = ?, active = ?, password = ? WHERE id = ?
  `).run(newName, newRole, newActive, newPassword, req.params.id);

  res.json({ message: 'המשתמש עודכן בהצלחה' });
});

// DELETE /api/users/:id — admin only (hard delete, admin protected)
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'משתמש לא נמצא' });

  // Cannot delete any admin user
  if (user.role === 'admin') {
    return res.status(400).json({ error: 'לא ניתן למחוק משתמש מנהל' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: 'המשתמש נמחק בהצלחה' });
});

module.exports = router;
