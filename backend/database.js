const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'technicians.db')
  : path.join(__dirname, 'technicians.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Create tables ──────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('technician', 'admin')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    fault_type TEXT,
    assigned_to INTEGER REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS equipment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    description TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS time_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER REFERENCES tasks(id),
    equipment_id INTEGER REFERENCES equipment(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    activity_type TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT,
    duration_minutes INTEGER,
    location TEXT,
    notes TEXT,
    is_manual INTEGER NOT NULL DEFAULT 0,
    edited_by INTEGER REFERENCES users(id),
    edit_reason TEXT,
    edited_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS corrections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    log_id INTEGER NOT NULL REFERENCES time_logs(id),
    requested_by INTEGER NOT NULL REFERENCES users(id),
    original_data TEXT NOT NULL,
    new_data TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ── Migrations ─────────────────────────────────────────────────────────────

// 1) Remove old CHECK constraint on activity_type (if present)
try {
  const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='time_logs'").get();
  if (tableInfo && tableInfo.sql.includes("CHECK(activity_type IN")) {
    db.exec(`
      ALTER TABLE time_logs RENAME TO time_logs_old;
      CREATE TABLE time_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER REFERENCES tasks(id),
        equipment_id INTEGER REFERENCES equipment(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        activity_type TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        duration_minutes INTEGER,
        location TEXT,
        notes TEXT,
        is_manual INTEGER NOT NULL DEFAULT 0,
        edited_by INTEGER REFERENCES users(id),
        edit_reason TEXT,
        edited_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO time_logs SELECT id, NULL, user_id, activity_type, start_time, end_time,
        duration_minutes, location, notes, is_manual, edited_by, edit_reason, edited_at, created_at
        FROM time_logs_old;
      DROP TABLE time_logs_old;
    `);
    console.log('✅ time_logs migrated — removed CHECK constraint');
  }
} catch (e) {}

// 2) Add equipment_id column if missing (for DBs created without it)
try {
  const cols = db.prepare("PRAGMA table_info(time_logs)").all().map((c) => c.name);
  if (!cols.includes('equipment_id')) {
    db.exec('ALTER TABLE time_logs ADD COLUMN equipment_id INTEGER REFERENCES equipment(id)');
    console.log('✅ time_logs migrated — added equipment_id column');
  }
} catch (e) {}

// ── Seed default users ─────────────────────────────────────────────────────
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
if (userCount.count === 0) {
  const adminPwd = bcrypt.hashSync('admin123', 10);
  const techPwd  = bcrypt.hashSync('tech123', 10);
  db.prepare('INSERT INTO users (name,username,password,role) VALUES (?,?,?,?)').run('מנהל ראשי','admin',adminPwd,'admin');
  db.prepare('INSERT INTO users (name,username,password,role) VALUES (?,?,?,?)').run('דוד לוי','david',techPwd,'technician');
  db.prepare('INSERT INTO users (name,username,password,role) VALUES (?,?,?,?)').run('יוסי כהן','yossi',techPwd,'technician');
  console.log('✅ Default users seeded');
}

// ── Seed sample equipment ──────────────────────────────────────────────────
const eqCount = db.prepare('SELECT COUNT(*) as count FROM equipment').get();
if (eqCount.count === 0) {
  const samples = [
    ['מזגן', 'מיזוג אוויר'],
    ['מחשב שולחני', 'מחשבים'],
    ['מחשב נייד', 'מחשבים'],
    ['מדפסת', 'ציוד משרדי'],
    ['שרת', 'תשתיות IT'],
    ['ראוטר / נתב', 'תשתיות IT'],
    ['מצלמת אבטחה', 'אבטחה'],
    ['מערכת כריזה', 'תקשורת'],
    ['UPS', 'חשמל'],
    ['מדחס', 'מכניקה'],
  ];
  const ins = db.prepare('INSERT INTO equipment (name,category) VALUES (?,?)');
  samples.forEach(([name, cat]) => ins.run(name, cat));
  console.log('✅ Sample equipment seeded');
}

module.exports = db;
