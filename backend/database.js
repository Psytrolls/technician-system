const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const DB_PATH = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'technicians.db')
  : path.join(__dirname, 'technicians.db');

let activeDb = null;
let pgPool = null;
let backupTimeout = null;

// Debounced background backup function to upload SQLite file to PostgreSQL
function triggerBackup() {
  if (!process.env.DATABASE_URL) return;

  if (backupTimeout) clearTimeout(backupTimeout);

  backupTimeout = setTimeout(async () => {
    try {
      if (!pgPool) {
        pgPool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false }
        });
      }

      // Force SQLite to checkpoint (flush any pending WAL logs to main file)
      if (activeDb) {
        try {
          activeDb.pragma('wal_checkpoint(TRUNCATE)');
        } catch (e) {
          console.error('⚠️ Failed to run SQLite WAL checkpoint:', e);
        }
      }

      // Read current SQLite DB file and save to pg
      const fileData = fs.readFileSync(DB_PATH);
      await pgPool.query(`
        INSERT INTO sqlite_backup (id, data, updated_at)
        VALUES (1, $1, NOW())
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
      `, [fileData]);
      console.log('💾 SQLite database backed up to PostgreSQL successfully.');
    } catch (err) {
      console.error('❌ Failed to backup SQLite database to PostgreSQL:', err);
    }
  }, 1500); // 1.5s debounce to group multiple consecutive writes
}

// Intercept methods to trigger auto-backup on any write/modification
const dbWrapper = {
  prepare(sql, ...args) {
    if (!activeDb) throw new Error('Database not initialized. Call initDatabase() first.');
    const stmt = activeDb.prepare(sql, ...args);
    
    // Wrap statement run to detect writes
    const originalRun = stmt.run.bind(stmt);
    stmt.run = function(...runArgs) {
      const result = originalRun(...runArgs);
      triggerBackup();
      return result;
    };
    return stmt;
  },

  exec(sql) {
    if (!activeDb) throw new Error('Database not initialized. Call initDatabase() first.');
    const result = activeDb.exec(sql);
    triggerBackup();
    return result;
  },

  pragma(sql, ...args) {
    if (!activeDb) throw new Error('Database not initialized. Call initDatabase() first.');
    return activeDb.pragma(sql, ...args);
  },

  transaction(fn) {
    if (!activeDb) throw new Error('Database not initialized. Call initDatabase() first.');
    const originalTx = activeDb.transaction(fn);
    return function(...args) {
      const result = originalTx(...args);
      triggerBackup();
      return result;
    };
  },

  close() {
    if (activeDb) {
      activeDb.close();
      activeDb = null;
    }
  },

  // Expose initialization method
  async initDatabase() {
    if (process.env.DATABASE_URL) {
      console.log('🔄 DATABASE_URL found. Initializing PostgreSQL sync...');
      try {
        pgPool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false }
        });

        // Ensure sqlite_backup table exists
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS sqlite_backup (
            id INT PRIMARY KEY,
            data BYTEA,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Download SQLite file if exists
        const res = await pgPool.query('SELECT data FROM sqlite_backup WHERE id = 1');
        if (res.rows.length > 0 && res.rows[0].data) {
          console.log('📥 SQLite backup found in PostgreSQL. Restoring locally...');
          
          // Ensure directory exists
          const dir = path.dirname(DB_PATH);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          
          fs.writeFileSync(DB_PATH, res.rows[0].data);
          console.log('✅ SQLite file restored successfully.');
        } else {
          console.log('ℹ️ No SQLite backup found in PostgreSQL. Running fresh seed...');
        }
      } catch (err) {
        console.error('❌ Failed to restore database from PostgreSQL:', err);
        console.log('⚠️ Falling back to local/fresh SQLite database.');
      }
    } else {
      console.log('ℹ️ No DATABASE_URL found. Operating in local SQLite-only mode.');
    }

    // Initialize/open the local SQLite database
    activeDb = new Database(DB_PATH);
    // Use DELETE instead of WAL to write changes synchronously to the main file,
    // ensuring the file on disk always contains 100% of latest database changes.
    activeDb.pragma('journal_mode = DELETE');
    activeDb.pragma('foreign_keys = ON');

    // Run existing schema setup, migrations, and seeding
    runMigrationsAndSeeding();

    // If fresh seed was created and we have DATABASE_URL, upload it right away!
    if (process.env.DATABASE_URL) {
      try {
        const res = await pgPool.query('SELECT 1 FROM sqlite_backup WHERE id = 1');
        if (res.rows.length === 0) {
          console.log('💾 Saving freshly seeded SQLite database to PostgreSQL...');
          const fileData = fs.readFileSync(DB_PATH);
          await pgPool.query(`
            INSERT INTO sqlite_backup (id, data, updated_at)
            VALUES (1, $1, NOW())
            ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
          `, [fileData]);
          console.log('✅ Initial seed backup completed.');
        }
      } catch (err) {
        console.error('❌ Failed to save initial seed backup to PostgreSQL:', err);
      }
    }
  }
};

function runMigrationsAndSeeding() {
  // ── Create tables ──────────────────────────────────────────────────────────
  activeDb.exec(`
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

    CREATE TABLE IF NOT EXISTS operators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      related_id INTEGER,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      action TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── Migrations ─────────────────────────────────────────────────────────────

  // 1) Remove old CHECK constraint on activity_type (if present)
  try {
    const tableInfo = activeDb.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='time_logs'").get();
    if (tableInfo && tableInfo.sql.includes("CHECK(activity_type IN")) {
      activeDb.exec(`
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
    const cols = activeDb.prepare("PRAGMA table_info(time_logs)").all().map((c) => c.name);
    if (!cols.includes('equipment_id')) {
      activeDb.exec('ALTER TABLE time_logs ADD COLUMN equipment_id INTEGER REFERENCES equipment(id)');
      console.log('✅ time_logs migrated — added equipment_id column');
    }
  } catch (e) {}

  // 3) Add operator_id column to time_logs if missing
  try {
    const cols = activeDb.prepare("PRAGMA table_info(time_logs)").all().map((c) => c.name);
    if (!cols.includes('operator_id')) {
      activeDb.exec('ALTER TABLE time_logs ADD COLUMN operator_id INTEGER REFERENCES operators(id)');
      console.log('✅ time_logs migrated — added operator_id column');
    }
  } catch (e) {}

  // 4) Add operator_id column to tasks if missing
  try {
    const cols = activeDb.prepare("PRAGMA table_info(tasks)").all().map((c) => c.name);
    if (!cols.includes('operator_id')) {
      activeDb.exec('ALTER TABLE tasks ADD COLUMN operator_id INTEGER REFERENCES operators(id)');
      console.log('✅ tasks migrated — added operator_id column');
    }
  } catch (e) {}

  // 5) Add operator_id column to equipment if missing
  try {
    const cols = activeDb.prepare("PRAGMA table_info(equipment)").all().map((c) => c.name);
    if (!cols.includes('operator_id')) {
      activeDb.exec('ALTER TABLE equipment ADD COLUMN operator_id INTEGER REFERENCES operators(id)');
      console.log('✅ equipment migrated — added operator_id column');
    }
  } catch (e) {}

  // 6) Create equipment_operators join table and migrate existing data
  try {
    activeDb.exec(`
      CREATE TABLE IF NOT EXISTS equipment_operators (
        equipment_id INTEGER NOT NULL REFERENCES equipment(id),
        operator_id INTEGER NOT NULL REFERENCES operators(id),
        PRIMARY KEY (equipment_id, operator_id)
      );
    `);
    
    // Copy existing data into join table
    activeDb.exec(`
      INSERT OR IGNORE INTO equipment_operators (equipment_id, operator_id)
      SELECT id, operator_id FROM equipment WHERE operator_id IS NOT NULL;
    `);
    console.log('✅ equipment_operators join table created and seeded from equipment table');
  } catch (e) {}

  // 5) Seed default operators if missing
  try {
    const opCount = activeDb.prepare('SELECT COUNT(*) as count FROM operators').get();
    if (opCount.count === 0) {
      const ins = activeDb.prepare('INSERT INTO operators (name) VALUES (?)');
      ['חברת אלפא', 'חברת בטא', 'תעשיות גמא'].forEach(name => ins.run(name));
      console.log('✅ Default operators seeded');
    }
  } catch (e) {}

  // ── Seed default users ─────────────────────────────────────────────────────
  const userCount = activeDb.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    const adminPwd = bcrypt.hashSync('admin123', 10);
    const techPwd  = bcrypt.hashSync('tech123', 10);
    activeDb.prepare('INSERT INTO users (name,username,password,role) VALUES (?,?,?,?)').run('מנהל ראשי','admin',adminPwd,'admin');
    activeDb.prepare('INSERT INTO users (name,username,password,role) VALUES (?,?,?,?)').run('דוד לוי','david',techPwd,'technician');
    activeDb.prepare('INSERT INTO users (name,username,password,role) VALUES (?,?,?,?)').run('יוסי כהן','yossi',techPwd,'technician');
    console.log('✅ Default users seeded');
  }

  // ── Seed sample equipment ──────────────────────────────────────────────────
  const eqCount = activeDb.prepare('SELECT COUNT(*) as count FROM equipment').get();
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
    const ins = activeDb.prepare('INSERT INTO equipment (name,category) VALUES (?,?)');
    samples.forEach(([name, cat]) => ins.run(name, cat));
    console.log('✅ Sample equipment seeded');
  }
}

module.exports = dbWrapper;
