const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'technician-system-secret-key-2024';

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'לא מורשה - חסר טוקן' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'טוקן לא תקין או פג תוקף' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'גישה מותרת למנהלים בלבד' });
  }
  next();
}

module.exports = { authMiddleware, adminOnly, JWT_SECRET };
