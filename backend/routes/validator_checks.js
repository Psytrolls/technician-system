const express = require('express');
const ExcelJS = require('exceljs');
const db = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/validator-checks/cards — get all cards (admins get all, techs get active only)
router.get('/cards', authMiddleware, (req, res) => {
  try {
    let query = 'SELECT * FROM rav_kav_cards';
    const params = [];
    if (req.user.role !== 'admin') {
      query += ' WHERE active = 1';
    }
    query += ' ORDER BY CAST(short_number AS INTEGER), short_number';
    const cards = db.prepare(query).all(...params);
    res.json(cards);
  } catch (err) {
    console.error('Failed to get cards:', err);
    res.status(500).json({ error: 'שגיאה בטעינת כרטיסים' });
  }
});

// POST /api/validator-checks/cards — admin only: create card
router.post('/cards', authMiddleware, adminOnly, (req, res) => {
  const { card_number, short_number } = req.body;

  if (!card_number || !short_number) {
    return res.status(400).json({ error: 'נא למלא את כל השדות' });
  }

  // Enforce 10-digit validation
  if (!/^\d{10}$/.test(card_number.trim())) {
    return res.status(400).json({ error: 'מספר כרטיס רב קו חייב להכיל בדיוק 10 ספרות' });
  }

  try {
    const result = db.prepare(
      'INSERT INTO rav_kav_cards (card_number, short_number, active) VALUES (?, ?, 1)'
    ).run(card_number.trim(), short_number.trim());

    res.status(201).json({ id: result.lastInsertRowid, message: 'הכרטיס נוסף בהצלחה' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'מספר כרטיס או מספר קצר כבר קיים במערכת' });
    }
    console.error('Failed to create card:', err);
    res.status(500).json({ error: 'שגיאה בהוספת הכרטיס' });
  }
});

// PUT /api/validator-checks/cards/:id — admin only: update card
router.put('/cards/:id', authMiddleware, adminOnly, (req, res) => {
  const { card_number, short_number, active } = req.body;

  if (!card_number || !short_number) {
    return res.status(400).json({ error: 'נא למלא את כל השדות' });
  }

  if (!/^\d{10}$/.test(card_number.trim())) {
    return res.status(400).json({ error: 'מספר כרטיס רב קו חייב להכיל בדיוק 10 ספרות' });
  }

  try {
    db.prepare(`
      UPDATE rav_kav_cards
      SET card_number = ?, short_number = ?, active = ?
      WHERE id = ?
    `).run(
      card_number.trim(),
      short_number.trim(),
      active ? 1 : 0,
      req.params.id
    );
    res.json({ message: 'הכרטיס עודכן בהצלחה' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'מספר כרטיס או מספר קצר כבר קיים במערכת' });
    }
    console.error('Failed to update card:', err);
    res.status(500).json({ error: 'שגיאה בעדכון הכרטיס' });
  }
});

// DELETE /api/validator-checks/cards/:id — admin only: delete card
router.delete('/cards/:id', authMiddleware, adminOnly, (req, res) => {
  try {
    // Check if card has associated checks
    const hasChecks = db.prepare('SELECT 1 FROM validator_checks WHERE card_id = ? LIMIT 1').get(req.params.id);
    if (hasChecks) {
      // Soft-delete: deactivate it instead
      db.prepare('UPDATE rav_kav_cards SET active = 0 WHERE id = ?').run(req.params.id);
      return res.json({ message: 'הכרטיס הועבר לארכיון מכיוון שיש לו בדיקות רשומות' });
    }

    db.prepare('DELETE FROM rav_kav_cards WHERE id = ?').run(req.params.id);
    res.json({ message: 'הכרטיס נמחק בהצלחה' });
  } catch (err) {
    console.error('Failed to delete card:', err);
    res.status(500).json({ error: 'שגיאה במחיקת הכרטיס' });
  }
});

// GET /api/validator-checks — list checks (admins get all, techs get their own only)
router.get('/', authMiddleware, (req, res) => {
  const { date_from, date_to, operator_id } = req.query;
  const params = [];
  const filters = [];

  if (req.user.role !== 'admin') {
    filters.push('vc.user_id = ?');
    params.push(req.user.id);
  }

  if (operator_id) {
    filters.push('vc.operator_id = ?');
    params.push(operator_id);
  }
  if (date_from) {
    filters.push('DATE(vc.created_at) >= ?');
    params.push(date_from);
  }
  if (date_to) {
    filters.push('DATE(vc.created_at) <= ?');
    params.push(date_to);
  }

  const whereClause = filters.length ? 'WHERE ' + filters.join(' AND ') : '';

  try {
    const checks = db.prepare(`
      SELECT vc.id,
             vc.bus_number,
             vc.validator_number,
             vc.created_at,
             o.name as operator_name,
             c.card_number as card_number,
             c.short_number as card_short_number,
             u.name as technician_name
      FROM validator_checks vc
      JOIN operators o ON vc.operator_id = o.id
      JOIN rav_kav_cards c ON vc.card_id = c.id
      JOIN users u ON vc.user_id = u.id
      ${whereClause}
      ORDER BY vc.created_at DESC
    `).all(...params);

    const formattedChecks = checks.map(c => ({
      ...c,
      created_at: c.created_at.includes('T') ? c.created_at : c.created_at.replace(' ', 'T') + 'Z'
    }));

    res.json(formattedChecks);
  } catch (err) {
    console.error('Failed to list checks:', err);
    res.status(500).json({ error: 'שגיאה בטעינת הבדיקות' });
  }
});

// POST /api/validator-checks — technician: log a check
router.post('/', authMiddleware, (req, res) => {
  const { operator_id, bus_number, validator_number, card_id } = req.body;

  if (!operator_id || !bus_number || !validator_number || !card_id) {
    return res.status(400).json({ error: 'נא למלא את כל השדות הנדרשים' });
  }

  const valNum = parseInt(validator_number);
  if (isNaN(valNum) || valNum < 1 || valNum > 9999) {
    return res.status(400).json({ error: 'מספר וולידטור חייב להיות מספר בין 1 ל-9999' });
  }

  try {
    // Verify operator exists
    const operator = db.prepare('SELECT 1 FROM operators WHERE id = ?').get(operator_id);
    if (!operator) {
      return res.status(400).json({ error: 'מפעיל לא נמצא במערכת' });
    }

    // Verify card exists
    const card = db.prepare('SELECT 1 FROM rav_kav_cards WHERE id = ?').get(card_id);
    if (!card) {
      return res.status(400).json({ error: 'כרטיס לא נמצא במערכת' });
    }

    const result = db.prepare(`
      INSERT INTO validator_checks (operator_id, bus_number, validator_number, card_id, user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(operator_id, bus_number.trim(), valNum, card_id, req.user.id, new Date().toISOString());

    res.status(201).json({ id: result.lastInsertRowid, message: 'הבדיקה נרשמה בהצלחה' });
  } catch (err) {
    console.error('Failed to save check:', err);
    res.status(500).json({ error: 'שגיאה ברישום הבדיקה' });
  }
});

// GET /api/validator-checks/export — admin only: export styled Excel file
router.get('/export', authMiddleware, adminOnly, async (req, res) => {
  const { date_from, date_to, operator_id } = req.query;
  const params = [];
  const filters = [];

  if (operator_id) {
    filters.push('vc.operator_id = ?');
    params.push(operator_id);
  }
  if (date_from) {
    filters.push('DATE(vc.created_at) >= ?');
    params.push(date_from);
  }
  if (date_to) {
    filters.push('DATE(vc.created_at) <= ?');
    params.push(date_to);
  }

  const whereClause = filters.length ? 'WHERE ' + filters.join(' AND ') : '';

  try {
    const checks = db.prepare(`
      SELECT vc.id,
             vc.bus_number,
             vc.validator_number,
             vc.created_at,
             o.name as operator_name,
             c.card_number as card_number,
             c.short_number as card_short_number,
             u.name as technician_name
      FROM validator_checks vc
      JOIN operators o ON vc.operator_id = o.id
      JOIN rav_kav_cards c ON vc.card_id = c.id
      JOIN users u ON vc.user_id = u.id
      ${whereClause}
      ORDER BY vc.created_at DESC
    `).all(...params);

    const cellBorder = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('בדיקות וולידטורים', {
      views: [{ rightToLeft: true }]
    });

    ws.columns = [
      { key: 'technician_name', width: 20 },
      { key: 'operator_name', width: 22 },
      { key: 'bus_number', width: 16 },
      { key: 'validator_number', width: 18 },
      { key: 'card_number', width: 22 },
      { key: 'created_at', width: 24 }
    ];

    // Title Block
    ws.mergeCells('A1:F1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'דוח בדיקות וולידטורים מפורט';
    titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 40;

    ws.mergeCells('A2:F2');
    const subtitleCell = ws.getCell('A2');
    subtitleCell.value = `טווח תאריכים: ${date_from || 'הכל'} עד ${date_to || 'הכל'}  |  תאריך הפקה: ${new Date().toLocaleDateString('he-IL')}`;
    subtitleCell.font = { name: 'Segoe UI', size: 11, italic: true, color: { argb: 'FF475569' } };
    subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 25;

    ws.addRow([]); // Blank row

    // Table Headers
    const hebrewHeaders = [
      'שם טכנאי', 'מפעיל / חברה', 'מספר אוטובוס', 'מספר וולידטור', 'מספר רב קו מלא', 'תאריך ושעת בדיקה'
    ];

    const headerRow = ws.addRow(hebrewHeaders);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF475569' } },
        bottom: { style: 'thin', color: { argb: 'FF475569' } },
        left: { style: 'thin', color: { argb: 'FF475569' } },
        right: { style: 'thin', color: { argb: 'FF475569' } }
      };
    });

    // Table Data
    checks.forEach((c, index) => {
      const dateStr = c.created_at.includes('T') ? c.created_at : c.created_at.replace(' ', 'T') + 'Z';
      const formattedDate = new Date(dateStr).toLocaleString('he-IL', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });

      const rowData = [
        c.technician_name || '',
        c.operator_name || '',
        c.bus_number || '',
        c.validator_number || '',
        c.card_number || '',
        formattedDate
      ];

      const row = ws.addRow(rowData);
      row.height = 22;

      const isEven = index % 2 === 0;
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { name: 'Segoe UI', size: 10 };
        cell.border = cellBorder;
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' }
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
    });

    ws.autoFilter = `A4:F${checks.length + 4}`;

    const buf = await workbook.xlsx.writeBuffer();
    const filename = `דוח_בדיקות_וולידטורים_${date_from || 'all'}_${date_to || 'all'}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(buf);

  } catch (err) {
    console.error('Failed to export checks:', err);
    res.status(500).json({ error: 'שגיאה בייצוא הדוח' });
  }
});

module.exports = router;
