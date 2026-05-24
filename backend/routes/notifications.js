const express = require('express');
const db = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications — Retrieve unread and recent notifications
router.get('/', authMiddleware, (req, res) => {
  try {
    // Get unread notifications
    const unread = db.prepare(`
      SELECT * FROM notifications 
      WHERE user_id = ? AND is_read = 0 
      ORDER BY created_at DESC
    `).all(req.user.id);

    // Get last 15 notifications overall to show in the dropdown history
    const allRecent = db.prepare(`
      SELECT * FROM notifications 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 15
    `).all(req.user.id);

    res.json({ unread, recent: allRecent });
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בטעינת התראות' });
  }
});

// POST /api/notifications/read-all — Mark all notifications as read
router.post('/read-all', authMiddleware, (req, res) => {
  try {
    db.prepare(`
      UPDATE notifications SET is_read = 1 WHERE user_id = ?
    `).run(req.user.id);
    res.json({ message: 'כל ההתראות סומנו כנקראו' });
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בעדכון ההתראות' });
  }
});

// POST /api/notifications/:id/read — Mark a specific notification as read
router.post('/:id/read', authMiddleware, (req, res) => {
  try {
    const result = db.prepare(`
      UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?
    `).run(req.params.id, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'התראה לא נמצאה' });
    }
    res.json({ message: 'ההתראה סומנה כנקראה' });
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בעדכון ההתראה' });
  }
});

module.exports = router;
