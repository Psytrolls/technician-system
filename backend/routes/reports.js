const express = require('express');
const XLSX = require('xlsx');
const db = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/reports/summary — overall stats
router.get('/summary', authMiddleware, (req, res) => {
  const { date_from, date_to, user_id } = req.query;

  let userFilter = '';
  const params = [];

  if (req.user.role === 'technician') {
    userFilter = 'AND tl.user_id = ?';
    params.push(req.user.id);
  } else if (user_id) {
    userFilter = 'AND tl.user_id = ?';
    params.push(user_id);
  }

  const dateFilter = [];
  if (date_from) { dateFilter.push(`DATE(tl.start_time) >= '${date_from}'`); }
  if (date_to)   { dateFilter.push(`DATE(tl.start_time) <= '${date_to}'`); }
  const dateWhere = dateFilter.length ? 'AND ' + dateFilter.join(' AND ') : '';

  const totalHours = db.prepare(`
    SELECT ROUND(SUM(duration_minutes) / 60.0, 2) as total_hours,
           COUNT(*) as total_entries
    FROM time_logs tl
    WHERE end_time IS NOT NULL ${userFilter} ${dateWhere}
  `).get(...params);

  const byActivity = db.prepare(`
    SELECT activity_type,
           COUNT(*) as count,
           ROUND(SUM(duration_minutes) / 60.0, 2) as hours
    FROM time_logs tl
    WHERE end_time IS NOT NULL ${userFilter} ${dateWhere}
    GROUP BY activity_type
    ORDER BY hours DESC
  `).all(...params);

  const byTechnician = db.prepare(`
    SELECT u.name,
           u.id,
           COUNT(*) as entries,
           ROUND(SUM(tl.duration_minutes) / 60.0, 2) as total_hours,
           ROUND(AVG(tl.duration_minutes), 0) as avg_minutes
    FROM time_logs tl
    JOIN users u ON tl.user_id = u.id
    WHERE tl.end_time IS NOT NULL ${userFilter} ${dateWhere}
    GROUP BY u.id
    ORDER BY total_hours DESC
  `).all(...params);

  const byDay = db.prepare(`
    SELECT DATE(tl.start_time) as date,
           ROUND(SUM(tl.duration_minutes) / 60.0, 2) as hours,
           COUNT(*) as entries
    FROM time_logs tl
    WHERE tl.end_time IS NOT NULL ${userFilter} ${dateWhere}
    GROUP BY DATE(tl.start_time)
    ORDER BY date ASC
  `).all(...params);

  const taskStats = db.prepare(`
    SELECT COUNT(*) as total,
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
           SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
    FROM tasks
  `).get();

  res.json({
    totals: totalHours,
    by_activity: byActivity,
    by_technician: byTechnician,
    by_day: byDay,
    tasks: taskStats
  });
});

// GET /api/reports/export — export real .xlsx with Hebrew headers
router.get('/export', authMiddleware, adminOnly, (req, res) => {
  const { date_from, date_to, user_id } = req.query;
  const params = [];
  const filters = ['tl.end_time IS NOT NULL'];

  if (user_id) { filters.push('tl.user_id = ?'); params.push(user_id); }
  if (date_from) { filters.push(`DATE(tl.start_time) >= '${date_from}'`); }
  if (date_to)   { filters.push(`DATE(tl.start_time) <= '${date_to}'`); }

  const where = filters.join(' AND ');

  const logs = db.prepare(`
    SELECT
      u.name                                                        as technician_name,
      t.title                                                       as task_title,
      tl.activity_type,
      DATE(tl.start_time)                                          as date,
      TIME(tl.start_time)                                          as start_time,
      TIME(tl.end_time)                                            as end_time,
      tl.duration_minutes,
      ROUND(tl.duration_minutes / 60.0, 2)                        as duration_hours,
      tl.location,
      tl.notes,
      CASE WHEN tl.is_manual = 1 THEN 'כן' ELSE 'לא' END          as is_manual,
      tl.edit_reason
    FROM time_logs tl
    JOIN users u ON tl.user_id = u.id
    LEFT JOIN tasks t ON tl.task_id = t.id
    WHERE ${where}
    ORDER BY tl.start_time DESC
  `).all(...params);

  // Hebrew column headers
  const hebrewHeaders = [
    'שם טכנאי',
    'משימה',
    'סוג פעילות',
    'תאריך',
    'שעת התחלה',
    'שעת סיום',
    'משך (דקות)',
    'משך (שעות)',
    'גרף ויזואלי',
    'מיקום',
    'הערות',
    'תיקון ידני',
    'סיבת תיקון',
  ];

  // Build rows: header row + data rows with dynamic visual graph formulas
  const rows = [
    hebrewHeaders,
    ...logs.map((row, i) => {
      const rowNum = i + 2; // Excel rows are 1-indexed, headers are row 1
      return [
        row.technician_name ?? '',
        row.task_title ?? '',
        row.activity_type ?? '',
        row.date ?? '',
        row.start_time ?? '',
        row.end_time ?? '',
        row.duration_minutes ?? 0,
        row.duration_hours ?? 0,
        // Column I: Visual Graph formula based on hours
        { t: 's', f: `IF(H${rowNum}>0, REPT("█", MIN(50, ROUND(H${rowNum}*4, 0))), "")` },
        row.location ?? '',
        row.notes ?? '',
        row.is_manual ?? '',
        row.edit_reason ?? '',
      ];
    })
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  ws['!cols'] = [
    { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 12 },
    { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
    { wch: 16 }, // 'גרף ויזואלי'
    { wch: 20 }, { wch: 25 }, { wch: 12 }, { wch: 25 },
  ];

  // Auto-filtering by any column
  ws['!autofilter'] = { ref: `A1:M${logs.length + 1}` };

  // RTL sheet direction
  if (!ws['!sheetView']) ws['!sheetView'] = [{}];
  ws['!sheetView'][0].rightToLeft = true;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'דוח פעילויות');

  // Sheet 2: Summary by activity
  const summaryData = db.prepare(`
    SELECT activity_type as 'סוג פעילות',
           COUNT(*) as 'מספר רשומות',
           ROUND(SUM(duration_minutes)/60.0, 2) as 'סה"כ שעות'
    FROM time_logs tl
    WHERE ${where}
    GROUP BY activity_type ORDER BY 3 DESC
  `).all(...params);

  if (summaryData.length > 0) {
    const summaryHeaders = ['סוג פעילות', 'מספר רשומות', 'סה"כ שעות', 'גרף ויזואלי'];
    const summaryRows = [
      summaryHeaders,
      ...summaryData.map((r, i) => {
        const rowNum = i + 2;
        return [
          r['סוג פעילות'] ?? '',
          r['מספר רשומות'] ?? 0,
          r['סה"כ שעות'] ?? 0,
          // Column D: Visual Graph formula based on total hours
          { t: 's', f: `IF(C${rowNum}>0, REPT("█", MIN(50, ROUND(C${rowNum}*2, 0))), "")` }
        ];
      })
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(summaryRows);
    ws2['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 16 }];
    if (!ws2['!sheetView']) ws2['!sheetView'] = [{}];
    ws2['!sheetView'][0].rightToLeft = true;
    ws2['!autofilter'] = { ref: `A1:D${summaryData.length + 1}` };
    XLSX.utils.book_append_sheet(wb, ws2, 'סיכום לפי פעילות');
  }

  // Sheet 3: Summary by technicians
  const techData = db.prepare(`
    SELECT u.name as 'שם טכנאי',
           COUNT(*) as 'מספר רשומות',
           ROUND(SUM(tl.duration_minutes)/60.0, 2) as 'סה"כ שעות'
    FROM time_logs tl
    JOIN users u ON tl.user_id = u.id
    WHERE ${where}
    GROUP BY u.id, u.name ORDER BY 3 DESC
  `).all(...params);

  if (techData.length > 0) {
    const techHeaders = ['שם טכנאי', 'מספר רשומות', 'סה"כ שעות', 'גרף ויזואלי'];
    const techRows = [
      techHeaders,
      ...techData.map((r, i) => {
        const rowNum = i + 2;
        return [
          r['שם טכנאי'] ?? '',
          r['מספר רשומות'] ?? 0,
          r['סה"כ שעות'] ?? 0,
          // Column D: Visual Graph formula based on technician hours
          { t: 's', f: `IF(C${rowNum}>0, REPT("█", MIN(50, ROUND(C${rowNum}*2, 0))), "")` }
        ];
      })
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(techRows);
    ws3['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 16 }];
    if (!ws3['!sheetView']) ws3['!sheetView'] = [{}];
    ws3['!sheetView'][0].rightToLeft = true;
    ws3['!autofilter'] = { ref: `A1:D${techData.length + 1}` };
    XLSX.utils.book_append_sheet(wb, ws3, 'סיכום לפי טכנאים');
  }

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const filename = `דוח_טכנאים_${date_from || 'all'}_${date_to || 'all'}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.send(buf);
});

module.exports = router;
