const express = require('express');
const ExcelJS = require('exceljs');
const https = require('https');
const db = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Helper to fetch chart image buffer safely
function fetchImageBuffer(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        resolve(null);
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', () => {
      resolve(null);
    });
  });
}


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
           ROUND(AVG(tl.duration_minutes), 0) as avg_minutes,
           (
             SELECT COUNT(*)
             FROM tasks t
             WHERE t.assigned_to = u.id
               AND t.status = 'completed'
               ${date_from ? `AND DATE(t.updated_at) >= '${date_from}'` : ''}
               ${date_to ? `AND DATE(t.updated_at) <= '${date_to}'` : ''}
           ) as completed_tasks
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

  const byOperator = db.prepare(`
    SELECT o.name,
           o.id,
           COUNT(*) as entries,
           ROUND(SUM(tl.duration_minutes) / 60.0, 2) as total_hours
    FROM time_logs tl
    JOIN operators o ON tl.operator_id = o.id
    WHERE tl.end_time IS NOT NULL ${userFilter} ${dateWhere}
    GROUP BY o.id
    ORDER BY total_hours DESC
  `).all(...params);

  const completionsByDay = db.prepare(`
    SELECT DATE(updated_at) as date,
           COUNT(*) as count
    FROM tasks
    WHERE status = 'completed'
    GROUP BY DATE(updated_at)
    ORDER BY date ASC
  `).all();

  res.json({
    totals: totalHours,
    by_activity: byActivity,
    by_technician: byTechnician,
    by_day: byDay,
    by_operator: byOperator,
    completions_by_day: completionsByDay,
    tasks: taskStats
  });
});

// GET /api/reports/export — export gorgeous styled .xlsx with embedded visual charts
router.get('/export', authMiddleware, adminOnly, async (req, res) => {
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
      o.name                                                        as operator_name,
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
    LEFT JOIN operators o ON tl.operator_id = o.id
    WHERE ${where}
    ORDER BY tl.start_time DESC
  `).all(...params);

  // Common borders
  const cellBorder = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
  };

  const workbook = new ExcelJS.Workbook();

  // ==========================================
  // SHEET 1: דוח פעילויות (Activity Report)
  // ==========================================
  const ws = workbook.addWorksheet('דוח פעילויות', {
    views: [{ rightToLeft: true }]
  });

  ws.columns = [
    { key: 'technician_name', width: 18 },
    { key: 'task_title', width: 22 },
    { key: 'operator_name', width: 20 },
    { key: 'activity_type', width: 16 },
    { key: 'date', width: 12 },
    { key: 'start_time', width: 12 },
    { key: 'end_time', width: 12 },
    { key: 'duration_minutes', width: 14 },
    { key: 'duration_hours', width: 14 },
    { key: 'visual_graph', width: 16 },
    { key: 'location', width: 20 },
    { key: 'notes', width: 28 },
    { key: 'is_manual', width: 12 },
    { key: 'edit_reason', width: 28 },
  ];

  // Title Block
  ws.mergeCells('A1:N1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'דוח פעילויות טכנאים מפורט';
  titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 40;

  ws.mergeCells('A2:N2');
  const subtitleCell = ws.getCell('A2');
  subtitleCell.value = `טווח תאריכים: ${date_from || 'הכל'} עד ${date_to || 'הכל'}  |  תאריך הפקה: ${new Date().toLocaleDateString('he-IL')}`;
  subtitleCell.font = { name: 'Segoe UI', size: 11, italic: true, color: { argb: 'FF475569' } };
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 25;

  ws.addRow([]); // Blank row

  // Table Headers
  const hebrewHeaders = [
    'שם טכנאי', 'משימה', 'לקוח / מפעיל', 'סוג פעילות', 'תאריך', 'שעת התחלה', 'שעת סיום',
    'משך (דקות)', 'משך (שעות)', 'גרף ויזואלי', 'מיקום', 'הערות', 'תיקון ידני', 'סיבת תיקון'
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
  logs.forEach((log, index) => {
    const rowNum = index + 5;
    const rowData = [
      log.technician_name ?? '',
      log.task_title ?? '',
      log.operator_name ?? '',
      log.activity_type ?? '',
      log.date ?? '',
      log.start_time ?? '',
      log.end_time ?? '',
      log.duration_minutes ?? 0,
      log.duration_hours ?? 0,
      { formula: `IF(I${rowNum}>0, REPT("█", MIN(50, ROUND(I${rowNum}*4, 0))), "")` },
      log.location ?? '',
      log.notes ?? '',
      log.is_manual ?? '',
      log.edit_reason ?? '',
    ];

    const row = ws.addRow(rowData);
    row.height = 22;

    const isEven = index % 2 === 0;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: 'Segoe UI', size: 10 };
      cell.border = cellBorder;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' }
      };

      if (colNumber === 8 || colNumber === 9) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colNumber === 10) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        cell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF3B82F6' } }; // Beautiful primary blue blocks!
      } else {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });
  });

  ws.autoFilter = `A4:N${logs.length + 4}`;

  // ==========================================
  // SHEET 2: סיכום לפי פעילות (Summary by Activity)
  // ==========================================
  const summaryData = db.prepare(`
    SELECT activity_type as 'סוג פעילות',
           COUNT(*) as 'מספר רשומות',
           ROUND(SUM(duration_minutes)/60.0, 2) as 'סה"כ שעות'
    FROM time_logs tl
    WHERE ${where}
    GROUP BY activity_type ORDER BY 3 DESC
  `).all(...params);

  const totalActivityHours = summaryData.reduce((sum, r) => sum + (r['סה"כ שעות'] || 0), 0);

  let pieChartBuffer = null;
  if (summaryData.length > 0) {
    const chartLabels = summaryData.map(r => {
      const hours = r['סה"כ שעות'] || 0;
      const pct = totalActivityHours > 0 ? Math.round((hours / totalActivityHours) * 100) : 0;
      return `${r['סוג פעילות']} (${pct}%)`;
    });

    const pieChartConfig = {
      type: 'pie',
      data: {
        labels: chartLabels,
        datasets: [{
          data: summaryData.map(r => r['סה"כ שעות']),
          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
        }]
      },
      options: {
        title: {
          display: true,
          text: 'חלוקת שעות לפי סוג פעילות',
          fontSize: 16,
          fontColor: '#1e293b',
          fontStyle: 'bold'
        },
        legend: {
          position: 'right',
          labels: {
            fontSize: 12,
            fontColor: '#334155'
          }
        },
        plugins: {
          // Hide dynamic text labels/numbers inside chart slices for absolute visual cleanliness
          datalabels: {
            display: false
          }
        }
      }
    };
    const pieUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(pieChartConfig))}&w=450&h=300`;
    pieChartBuffer = await fetchImageBuffer(pieUrl);
  }

  const ws2 = workbook.addWorksheet('סיכום לפי פעילות', {
    views: [{ rightToLeft: true }]
  });

  ws2.columns = [
    { key: 'activity', width: 20 },
    { key: 'entries', width: 16 },
    { key: 'hours', width: 16 },
    { key: 'graph', width: 18 },
  ];

  ws2.mergeCells('A1:D1');
  const t2Cell = ws2.getCell('A1');
  t2Cell.value = 'סיכום שעות לפי פעילות';
  t2Cell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  t2Cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  t2Cell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws2.getRow(1).height = 35;

  ws2.addRow([]); // Blank row

  const sHeaders = ['סוג פעילות', 'מספר רשומות', 'סה"כ שעות', 'גרף ויזואלי'];
  const sHeaderRow = ws2.addRow(sHeaders);
  sHeaderRow.height = 25;
  sHeaderRow.eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = cellBorder;
  });

  summaryData.forEach((r, i) => {
    const rowNum = i + 4;
    const row = ws2.addRow([
      r['סוג פעילות'] ?? '',
      r['מספר רשומות'] ?? 0,
      r['סה"כ שעות'] ?? 0,
      { formula: `IF(C${rowNum}>0, REPT("█", MIN(50, ROUND(C${rowNum}*2, 0))), "")` }
    ]);
    row.height = 22;
    const isEven = i % 2 === 0;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: 'Segoe UI', size: 10 };
      cell.border = cellBorder;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' }
      };

      if (colNumber === 2 || colNumber === 3) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colNumber === 4) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        cell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF10B981' } }; // Vibrant emerald green blocks!
      } else {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });
  });

  ws2.autoFilter = `A3:D${summaryData.length + 3}`;

  if (pieChartBuffer) {
    const pieImgId = workbook.addImage({
      buffer: pieChartBuffer,
      extension: 'png'
    });
    ws2.addImage(pieImgId, {
      tl: { col: 5, row: 2 }, // Column F, Row 3
      ext: { width: 450, height: 300 }
    });
  }

  // ==========================================
  // SHEET 3: סיכום לפי טכנאים (Summary by Technicians)
  // ==========================================
  const techData = db.prepare(`
    SELECT u.name as 'שם טכנאי',
           COUNT(*) as 'מספר רשומות',
           ROUND(SUM(tl.duration_minutes)/60.0, 2) as 'סה"כ שעות',
           (
             SELECT COUNT(*)
             FROM tasks t
             WHERE t.assigned_to = u.id
               AND t.status = 'completed'
               ${date_from ? `AND DATE(t.updated_at) >= '${date_from}'` : ''}
               ${date_to ? `AND DATE(t.updated_at) <= '${date_to}'` : ''}
           ) as 'משימות שהושלמו'
    FROM time_logs tl
    JOIN users u ON tl.user_id = u.id
    WHERE ${where}
    GROUP BY u.id, u.name ORDER BY 3 DESC
  `).all(...params);

  let barChartBuffer = null;
  if (techData.length > 0) {
    const techChartConfig = {
      type: 'bar',
      data: {
        labels: techData.map(r => r['שם טכנאי']),
        datasets: [
          {
            label: 'סה"כ שעות עבודה',
            data: techData.map(r => r['סה"כ שעות']),
            backgroundColor: '#3b82f6',
            borderRadius: 4
          },
          {
            label: 'משימות שהושלמו',
            data: techData.map(r => r['משימות שהושלמו']),
            backgroundColor: '#10b981',
            borderRadius: 4
          }
        ]
      },
      options: {
        title: {
          display: true,
          text: 'השוואת שעות עבודה ומשימות שהושלמו בין טכנאים',
          fontSize: 16,
          fontColor: '#1e293b',
          fontStyle: 'bold'
        },
        legend: {
          display: true,
          position: 'top',
          labels: {
            fontColor: '#334155',
            fontSize: 12
          }
        },
        scales: {
          yAxes: [{
            ticks: {
              beginAtZero: true
            }
          }]
        },
        plugins: {
          datalabels: {
            display: false
          }
        }
      }
    };
    const barUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(techChartConfig))}&w=450&h=300`;
    barChartBuffer = await fetchImageBuffer(barUrl);
  }

  const ws3 = workbook.addWorksheet('סיכום לפי טכנאים', {
    views: [{ rightToLeft: true }]
  });

  ws3.columns = [
    { key: 'technician', width: 20 },
    { key: 'entries', width: 16 },
    { key: 'hours', width: 16 },
    { key: 'completed_tasks', width: 18 },
    { key: 'graph', width: 18 },
  ];

  ws3.mergeCells('A1:E1');
  const t3Cell = ws3.getCell('A1');
  t3Cell.value = 'סיכום שעות לפי טכנאים';
  t3Cell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  t3Cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  t3Cell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws3.getRow(1).height = 35;

  ws3.addRow([]); // Blank row

  const tHeaders = ['שם טכנאי', 'מספר רשומות', 'סה"כ שעות', 'משימות שהושלמו', 'גרף ויזואלי'];
  const tHeaderRow = ws3.addRow(tHeaders);
  tHeaderRow.height = 25;
  tHeaderRow.eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = cellBorder;
  });

  techData.forEach((r, i) => {
    const rowNum = i + 4;
    const row = ws3.addRow([
      r['שם טכנאי'] ?? '',
      r['מספר רשומות'] ?? 0,
      r['סה"כ שעות'] ?? 0,
      r['משימות שהושלמו'] ?? 0,
      { formula: `IF(C${rowNum}>0, REPT("█", MIN(50, ROUND(C${rowNum}*2, 0))), "")` }
    ]);
    row.height = 22;
    const isEven = i % 2 === 0;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: 'Segoe UI', size: 10 };
      cell.border = cellBorder;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' }
      };

      if (colNumber === 2 || colNumber === 3 || colNumber === 4) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colNumber === 5) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        cell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF8B5CF6' } }; // Beautiful purple blocks!
      } else {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });
  });

  ws3.autoFilter = `A3:E${techData.length + 3}`;

  if (barChartBuffer) {
    const barImgId = workbook.addImage({
      buffer: barChartBuffer,
      extension: 'png'
    });
    ws3.addImage(barImgId, {
      tl: { col: 5, row: 2 }, // Column F, Row 3
      ext: { width: 450, height: 300 }
    });
  }

  const buf = await workbook.xlsx.writeBuffer();

  const filename = `דוח_טכנאים_${date_from || 'all'}_${date_to || 'all'}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.send(buf);
});

module.exports = router;
// Render webhook trigger to force auto-deploy of the reversed Hebrew bar chart fixes
