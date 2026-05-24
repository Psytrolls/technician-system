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

  // Ordinary admins can only create technicians
  if (req.user.username !== 'admin' && role === 'admin') {
    return res.status(403).json({ error: 'רק המנהל הראשי רשאי ליצור מנהלים חדשים' });
  }

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ error: 'שם המשתמש כבר קיим' });

  const hashed = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, ?)
  `).run(name, username, hashed, role);

  res.status(201).json({ id: result.lastInsertRowid, name, username, role });
});

// PUT /api/users/:id — admin only
router.put('/:id', authMiddleware, adminOnly, (req, res) => {
  const { name, role, active, password, secret_code } = req.body;
  const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!targetUser) return res.status(404).json({ error: 'משתמש לא נמצא' });

  // Ordinary admins can only edit technicians (role === 'technician')
  if (req.user.username !== 'admin' && targetUser.role === 'admin') {
    return res.status(403).json({ error: 'מנהל רגיל מורשה לערוך טכנאים בלבד' });
  }

  // Ordinary admins cannot promote users to admin
  if (req.user.username !== 'admin' && role && role !== 'technician') {
    return res.status(403).json({ error: 'רק המנהל הראשי רשאי להגדיר תפקיד מנהל' });
  }

  // If changing the password of the main admin ('admin') — require secret code
  if (targetUser.username === 'admin' && password) {
    if (!secret_code || String(secret_code).trim() !== ADMIN_SECRET_CODE) {
      return res.status(403).json({ error: 'נדרש קוד סודי לשינוי סיסמת המנהל הראשי' });
    }
  }

  const newName = name ?? targetUser.name;
  const newRole = role ?? targetUser.role;
  const newActive = active !== undefined ? (active ? 1 : 0) : targetUser.active;
  const newPassword = password ? bcrypt.hashSync(password, 10) : targetUser.password;

  db.prepare(`
    UPDATE users SET name = ?, role = ?, active = ?, password = ? WHERE id = ?
  `).run(newName, newRole, newActive, newPassword, req.params.id);

  res.json({ message: 'המשתמש עודכן בהצלחה' });
});

// DELETE /api/users/:id — admin only (hard delete, admin protected)
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!targetUser) return res.status(404).json({ error: 'משתמש לא נמצא' });

  // Cannot delete the main admin ('admin')
  if (targetUser.username === 'admin') {
    return res.status(400).json({ error: 'לא ניתן למחוק את המנהל הראשי (admin)' });
  }

  // Ordinary admins can only delete technicians (role === 'technician')
  if (req.user.username !== 'admin' && targetUser.role === 'admin') {
    return res.status(403).json({ error: 'מנהל רגיל יכול למחוק טכנאים בלבד' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: 'המשתמש נמחק בהצלחה' });
});

module.exports = router;
