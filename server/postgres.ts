import 'dotenv/config';
import { Pool, PoolClient } from 'pg';
import fs from 'fs';
import path from 'path';

export interface PostgresStatus {
  isConfigured: boolean;
  isConnected: boolean;
  provider: 'Neon PostgreSQL' | 'Render PostgreSQL' | 'PostgreSQL';
  urlSource: 'env' | 'custom' | 'none';
  maskedUrl?: string;
  error?: string;
  lastSyncAt?: string;
  tableInitialized?: boolean;
  neonCounts?: {
    users: number;
    students: number;
    departments: number;
    staff: number;
    noDueRequests: number;
  };
}

class PostgresManager {
  private pool: Pool | null = null;
  private currentUrl: string | null = null;
  private isConnected: boolean = false;
  private lastError: string | null = null;
  private lastSyncAt: string | null = null;
  private tableInitialized: boolean = false;
  private saveDebounceTimer: NodeJS.Timeout | null = null;
  private pendingDataToSave: any = null;
  private isFlushing: boolean = false;
  private queuedDataToSave: any = null;
  private cachedNeonCounts: { users: number; students: number; departments: number; staff: number; noDueRequests: number } = {
    users: 0,
    students: 0,
    departments: 0,
    staff: 0,
    noDueRequests: 0,
  };

  constructor() {
    this.detectAndInit();
  }

  private getEffectiveUrl(): { url: string | null; source: 'env' | 'custom' | 'none' } {
    const customConfigPath = path.join(process.cwd(), 'data', 'db_connection.json');
    try {
      if (fs.existsSync(customConfigPath)) {
        const raw = fs.readFileSync(customConfigPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed?.databaseUrl && typeof parsed.databaseUrl === 'string' && parsed.databaseUrl.trim().length > 0) {
          return { url: parsed.databaseUrl.trim(), source: 'custom' };
        }
      }
    } catch {
      // Ignore
    }

    const envUrl =
      process.env.DATABASE_URL ||
      process.env.NEON_DATABASE_URL ||
      process.env.INTERNAL_DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.RENDER_POSTGRES_URL;

    if (envUrl && envUrl.trim().length > 0) {
      return { url: envUrl.trim(), source: 'env' };
    }

    return { url: null, source: 'none' };
  }

  private normalizePostgresUrl(rawUrl: string): string {
    let url = rawUrl.trim().replace(/^['"]|['"]$/g, '');
    if (url.startsWith('psql ')) {
      url = url.replace(/^psql\s+/, '').trim();
    }
    if (url.startsWith('postgres://')) {
      url = 'postgresql://' + url.substring('postgres://'.length);
    }
    return url;
  }

  public getProvider(url?: string | null): 'Neon PostgreSQL' | 'Render PostgreSQL' | 'PostgreSQL' {
    const target = (url || this.currentUrl || '').toLowerCase();
    if (target.includes('neon.tech')) return 'Neon PostgreSQL';
    if (target.includes('render.com') || target.includes('dpg-')) return 'Render PostgreSQL';
    return 'PostgreSQL';
  }

  public maskUrl(url?: string | null): string {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      const user = parsed.username || 'user';
      const host = parsed.host || 'host';
      const pathname = parsed.pathname || '';
      return `${parsed.protocol}//${user}:****@${host}${pathname}`;
    } catch {
      return url.length > 15 ? url.substring(0, 12) + '****' : '****';
    }
  }

  public async detectAndInit(): Promise<boolean> {
    const { url, source } = this.getEffectiveUrl();
    if (!url) {
      this.isConnected = false;
      this.pool = null;
      this.currentUrl = null;
      return false;
    }

    return this.connectWithUrl(url, source);
  }

  public async connectWithUrl(rawUrl: string, source: 'env' | 'custom' | 'none' = 'custom'): Promise<boolean> {
    const normalized = this.normalizePostgresUrl(rawUrl);

    if (this.pool) {
      try {
        await this.pool.end();
      } catch {
        // Ignore close error
      }
      this.pool = null;
    }

    try {
      const isLocal = normalized.includes('localhost') || normalized.includes('127.0.0.1');

      this.pool = new Pool({
        connectionString: normalized,
        ssl: isLocal ? false : { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        max: 8,
      });

      const client = await this.pool.connect();
      try {
        const result = await client.query('SELECT NOW() as current_time, version()');
        console.log(`✅ [${this.getProvider(normalized)}] Connected successfully:`, result.rows[0]?.current_time);

        // 1. Initialize institutional CND tables
        await client.query(`
          CREATE TABLE IF NOT EXISTS college_cnd_data (
            id VARCHAR(64) PRIMARY KEY,
            data JSONB NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS cnd_departments (
            id VARCHAR(64) PRIMARY KEY,
            code VARCHAR(32) NOT NULL,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS cnd_users (
            id VARCHAR(64) PRIMARY KEY,
            username VARCHAR(128) NOT NULL,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            role VARCHAR(32) NOT NULL,
            roll_no VARCHAR(64),
            register_no VARCHAR(64),
            department_id VARCHAR(64),
            department_name VARCHAR(255),
            designation VARCHAR(128),
            phone VARCHAR(64),
            status VARCHAR(32) DEFAULT 'ACTIVE',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS cnd_clearances (
            id VARCHAR(64) PRIMARY KEY,
            student_id VARCHAR(64) NOT NULL,
            student_roll_no VARCHAR(64),
            student_name VARCHAR(255) NOT NULL,
            department_name VARCHAR(255),
            overall_status VARCHAR(32) NOT NULL,
            total_due_amount NUMERIC(10,2) DEFAULT 0,
            cleared_checkpoints INTEGER DEFAULT 0,
            total_checkpoints INTEGER DEFAULT 0,
            certificate_id VARCHAR(128),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS cnd_subjects (
            id VARCHAR(64) PRIMARY KEY,
            code VARCHAR(64) NOT NULL,
            name VARCHAR(255) NOT NULL,
            department_name VARCHAR(255),
            semester INTEGER,
            assigned_staff_name VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // 2. Initialize standard relational tables if they do not already exist
        await client.query(`
          CREATE TABLE IF NOT EXISTS departments (
            id SERIAL PRIMARY KEY,
            code VARCHAR(50) UNIQUE NOT NULL,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL,
            phone VARCHAR(50),
            avatar_url TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS students (
            id SERIAL PRIMARY KEY,
            user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            register_number VARCHAR(100) UNIQUE NOT NULL,
            department_id INTEGER REFERENCES departments(id) ON DELETE RESTRICT,
            degree_program VARCHAR(150) NOT NULL,
            batch_year VARCHAR(50) NOT NULL,
            current_semester INTEGER NOT NULL,
            section VARCHAR(20) DEFAULT 'A',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS staff (
            id SERIAL PRIMARY KEY,
            user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            department_id INTEGER REFERENCES departments(id) ON DELETE RESTRICT,
            designation VARCHAR(150) NOT NULL,
            staff_code VARCHAR(100) UNIQUE NOT NULL,
            clearance_category VARCHAR(150),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS no_due_requests (
            id SERIAL PRIMARY KEY,
            student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
            academic_year VARCHAR(50) NOT NULL,
            reason VARCHAR(255) NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            overall_remarks TEXT,
            submitted_at TIMESTAMP,
            completed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);

        this.tableInitialized = true;
        this.isConnected = true;
        this.currentUrl = normalized;
        this.lastError = null;

        await this.refreshCounts(client);
        return true;
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error(`❌ Failed to connect to ${this.getProvider(normalized)}:`, err.message);
      this.isConnected = false;
      let msg = err.message || 'Connection failed';
      if (msg.includes('ENOTFOUND') && normalized.includes('dpg-') && !normalized.includes('.render.com')) {
        msg = 'Render Internal URL detected (@dpg-...). To connect from outside Render, please use the External Database URL.';
      } else if (msg.includes('password authentication failed')) {
        msg = 'Password authentication failed. Please verify your connection string credentials.';
      }
      this.lastError = msg;
      return false;
    }
  }

  public async refreshCounts(clientInstance?: PoolClient): Promise<void> {
    if (!this.isConnected || !this.pool) return;
    const runner = async (c: PoolClient) => {
      try {
        const u = await c.query('SELECT count(*)::int as cnt FROM users');
        const s = await c.query('SELECT count(*)::int as cnt FROM students');
        const d = await c.query('SELECT count(*)::int as cnt FROM departments');
        const st = await c.query('SELECT count(*)::int as cnt FROM staff');
        const r = await c.query('SELECT count(*)::int as cnt FROM no_due_requests');

        this.cachedNeonCounts = {
          users: u.rows[0]?.cnt || 0,
          students: s.rows[0]?.cnt || 0,
          departments: d.rows[0]?.cnt || 0,
          staff: st.rows[0]?.cnt || 0,
          noDueRequests: r.rows[0]?.cnt || 0,
        };
      } catch (e) {
        // Table count query skipped if partial schema
      }
    };

    if (clientInstance) {
      await runner(clientInstance);
    } else {
      const client = await this.pool.connect();
      try {
        await runner(client);
      } finally {
        client.release();
      }
    }
  }

  public async saveCustomUrl(rawUrl: string): Promise<{ success: boolean; error?: string }> {
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      const customConfigPath = path.join(process.cwd(), 'data', 'db_connection.json');
      if (fs.existsSync(customConfigPath)) {
        fs.unlinkSync(customConfigPath);
      }
      this.pool = null;
      this.isConnected = false;
      this.currentUrl = null;
      return { success: true };
    }

    const connected = await this.connectWithUrl(trimmed, 'custom');
    if (!connected) {
      return { success: false, error: this.lastError || 'Could not connect to PostgreSQL database with provided URL' };
    }

    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(dataDir, 'db_connection.json'),
      JSON.stringify({ databaseUrl: trimmed, updatedAt: new Date().toISOString() }, null, 2),
      'utf-8'
    );

    return { success: true };
  }

  public async loadData(): Promise<any | null> {
    if (!this.isConnected || !this.pool) return null;
    try {
      const client = await this.pool.connect();
      try {
        const res = await client.query(`SELECT data, updated_at FROM college_cnd_data WHERE id = 'main_database' LIMIT 1`);
        let data = res.rows.length > 0 && res.rows[0].data ? res.rows[0].data : null;
        if (res.rows.length > 0) {
          this.lastSyncAt = res.rows[0].updated_at || new Date().toISOString();
        }

        // Check if there are any students directly in Neon's relational tables not yet in JSON
        if (data && Array.isArray(data.users)) {
          try {
            const extraStudents = await client.query(`
              SELECT s.id, s.register_number, u.full_name, u.email, u.phone, d.code as dept_code, d.name as dept_name, s.department_id, s.degree_program, s.batch_year, s.current_semester
              FROM students s
              JOIN users u ON s.user_id = u.id
              LEFT JOIN departments d ON s.department_id = d.id
            `);

            for (const row of extraStudents.rows) {
              const reg = (row.register_number || '').trim();
              const mail = (row.email || '').trim().toLowerCase();
              const exists = data.users.some((u: any) => 
                (u.rollNo && u.rollNo.toUpperCase() === reg.toUpperCase()) ||
                (u.registerNo && u.registerNo.toUpperCase() === reg.toUpperCase()) ||
                (u.email && u.email.toLowerCase() === mail)
              );

              if (!exists && reg) {
                let matchedDept = data.departments.find((d: any) => d.code.toUpperCase() === (row.dept_code || '').toUpperCase());
                const deptId = matchedDept ? matchedDept.id : (data.departments[0]?.id || 'dept_cse');
                const newUserId = 'user_' + reg.toLowerCase().replace(/[^a-z0-9]/g, '_');

                const newStudentUser = {
                  id: newUserId,
                  username: reg,
                  name: row.full_name,
                  email: row.email,
                  role: 'STUDENT',
                  rollNo: reg,
                  registerNo: reg,
                  departmentId: deptId,
                  departmentName: matchedDept ? matchedDept.name : 'Engineering',
                  degree: row.degree_program || 'B.E.',
                  batchYear: row.batch_year || '2021 - 2025',
                  semester: row.current_semester || 8,
                  isHosteler: false,
                  phone: row.phone || '',
                  status: 'ACTIVE',
                  createdAt: new Date().toISOString(),
                };
                data.users.push(newStudentUser);

                const hasClr = (data.clearances || []).some((c: any) => c.studentRollNo === reg || c.studentId === newUserId);
                if (!hasClr) {
                  data.clearances = data.clearances || [];
                  data.clearances.push({
                    id: 'clr_' + newUserId,
                    studentId: newUserId,
                    studentName: row.full_name,
                    studentRollNo: reg,
                    studentDepartmentName: matchedDept ? matchedDept.name : 'Engineering',
                    batchYear: row.batch_year || '2021 - 2025',
                    overallStatus: 'IN_PROGRESS',
                    totalDueAmount: 0,
                    clearedCheckpoints: 0,
                    totalCheckpoints: 8,
                    checkpoints: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  });
                }
              }
            }
          } catch (e: any) {
            // Relational student merge fallback
          }
        }

        console.log(`📥 Loaded database state from ${this.getProvider()} (updated: ${this.lastSyncAt})`);
        await this.refreshCounts(client);
        return data;
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error(`Error loading data from ${this.getProvider()}:`, err.message);
      this.lastError = err.message;
    }
    return null;
  }

  public saveData(data: any): void {
    if (!this.isConnected || !this.pool) return;
    this.pendingDataToSave = data;

    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }

    this.saveDebounceTimer = setTimeout(async () => {
      await this.flushSave();
    }, 150);
  }

  public async flushSave(explicitData?: any): Promise<boolean> {
    if (!this.isConnected || !this.pool) return false;
    const dataToSave = explicitData || this.pendingDataToSave;
    if (!dataToSave) return false;

    // Mutex serialization to prevent concurrent database lock collisions
    if (this.isFlushing) {
      this.queuedDataToSave = dataToSave;
      return true;
    }

    this.isFlushing = true;
    this.pendingDataToSave = null;

    try {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');

        // 1. Master JSONB snapshot
        await client.query(
          `INSERT INTO college_cnd_data (id, data, updated_at)
           VALUES ('main_database', $1, NOW())
           ON CONFLICT (id)
           DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();`,
          [JSON.stringify(dataToSave)]
        );

        // 2. High-speed CND queryable tables
        if (Array.isArray(dataToSave.departments)) {
          for (const dept of dataToSave.departments) {
            await client.query(
              `INSERT INTO cnd_departments (id, code, name, description, created_at)
               VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW()))
               ON CONFLICT (id) DO UPDATE
               SET code = EXCLUDED.code, name = EXCLUDED.name, description = EXCLUDED.description;`,
              [dept.id, dept.code, dept.name, dept.description || '', dept.createdAt || null]
            );
          }
        }

        if (Array.isArray(dataToSave.users)) {
          for (const u of dataToSave.users) {
            await client.query(
              `INSERT INTO cnd_users (id, username, name, email, role, roll_no, register_no, department_id, department_name, designation, phone, status, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, COALESCE($13::timestamptz, NOW()))
               ON CONFLICT (id) DO UPDATE
               SET username = EXCLUDED.username, name = EXCLUDED.name, email = EXCLUDED.email, role = EXCLUDED.role,
                   roll_no = EXCLUDED.roll_no, register_no = EXCLUDED.register_no, department_id = EXCLUDED.department_id,
                   department_name = EXCLUDED.department_name, designation = EXCLUDED.designation, phone = EXCLUDED.phone,
                   status = EXCLUDED.status;`,
              [
                u.id,
                u.username,
                u.name,
                u.email,
                u.role,
                u.rollNo || null,
                u.registerNo || null,
                u.departmentId || null,
                u.departmentName || null,
                u.designation || null,
                u.phone || null,
                u.status || 'ACTIVE',
                u.createdAt || null,
              ]
            );
          }
        }

        if (Array.isArray(dataToSave.clearances)) {
          for (const clr of dataToSave.clearances) {
            await client.query(
              `INSERT INTO cnd_clearances (id, student_id, student_roll_no, student_name, department_name, overall_status, total_due_amount, cleared_checkpoints, total_checkpoints, certificate_id, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11::timestamptz, NOW()))
               ON CONFLICT (id) DO UPDATE
               SET overall_status = EXCLUDED.overall_status, total_due_amount = EXCLUDED.total_due_amount,
                   cleared_checkpoints = EXCLUDED.cleared_checkpoints, total_checkpoints = EXCLUDED.total_checkpoints,
                   certificate_id = EXCLUDED.certificate_id, updated_at = EXCLUDED.updated_at;`,
              [
                clr.id,
                clr.studentId,
                clr.studentRollNo || null,
                clr.studentName,
                clr.studentDepartmentName || null,
                clr.overallStatus,
                clr.totalDueAmount || 0,
                clr.clearedCheckpoints || 0,
                clr.totalCheckpoints || 0,
                clr.certificateId || null,
                clr.updatedAt || null,
              ]
            );
          }
        }

        if (Array.isArray(dataToSave.subjects)) {
          for (const s of dataToSave.subjects) {
            await client.query(
              `INSERT INTO cnd_subjects (id, code, name, department_name, semester, assigned_staff_name, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, NOW()))
               ON CONFLICT (id) DO UPDATE
               SET code = EXCLUDED.code, name = EXCLUDED.name, department_name = EXCLUDED.department_name,
                   semester = EXCLUDED.semester, assigned_staff_name = EXCLUDED.assigned_staff_name;`,
              [s.id, s.code, s.name, s.departmentName || null, s.semester || null, s.assignedStaffName || null, s.createdAt || null]
            );
          }
        }

        // 3. PERSIST DIRECTLY INTO NEON RELATIONAL TABLES (departments, users, students, staff, no_due_requests)
        await this.syncRelationalNeonTables(client, dataToSave);

        await client.query('COMMIT');
        this.lastSyncAt = new Date().toISOString();
        this.lastError = null;
        await this.refreshCounts(client);
        console.log(`💾 ${this.getProvider()} updated: master snapshot and all relational tables persisted at ${this.lastSyncAt}`);
        return true;
      } catch (err: any) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error(`Error saving data to ${this.getProvider()}:`, err.message);
      this.lastError = err.message;
      return false;
    } finally {
      this.isFlushing = false;
      if (this.queuedDataToSave) {
        const next = this.queuedDataToSave;
        this.queuedDataToSave = null;
        setTimeout(() => this.flushSave(next), 50);
      }
    }
  }

  private async syncRelationalNeonTables(client: PoolClient, dataToSave: any): Promise<void> {
    try {
      // 1. Sync departments table
      const deptIdMap = new Map<string, number>();
      if (Array.isArray(dataToSave.departments)) {
        for (const d of dataToSave.departments) {
          const code = (d.code || 'GEN').toUpperCase().trim();
          const res = await client.query(
            `INSERT INTO departments (code, name, description, created_at)
             VALUES ($1, $2, $3, COALESCE($4::timestamp, NOW()))
             ON CONFLICT (code) DO UPDATE
             SET name = EXCLUDED.name, description = EXCLUDED.description
             RETURNING id, code;`,
            [code, d.name, d.description || d.name, d.createdAt || null]
          );
          if (res.rows[0]) {
            deptIdMap.set(d.id, res.rows[0].id);
            deptIdMap.set(code, res.rows[0].id);
          }
        }
      }

      let defaultDeptId = deptIdMap.get('CSE') || 1;
      if (!defaultDeptId && deptIdMap.size > 0) {
        defaultDeptId = deptIdMap.values().next().value || 1;
      }

      // 2. Sync users table
      const userIdMap = new Map<string, number>();
      if (Array.isArray(dataToSave.users)) {
        for (const u of dataToSave.users) {
          const role = (u.role || 'student').toLowerCase();
          const validRole = ['admin', 'hod', 'staff', 'student'].includes(role) ? role : 'student';
          const email = (u.email || `${u.username}@college.edu`).toLowerCase().trim();

          const res = await client.query(
            `INSERT INTO users (email, password_hash, full_name, role, phone, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, true, COALESCE($6::timestamp, NOW()), NOW())
             ON CONFLICT (email) DO UPDATE
             SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, phone = EXCLUDED.phone, is_active = true, updated_at = NOW()
             RETURNING id, email;`,
            [email, u.password || 'student123', u.name, validRole, u.phone || null, u.createdAt || null]
          );
          if (res.rows[0]) {
            userIdMap.set(u.id, res.rows[0].id);
            userIdMap.set(email, res.rows[0].id);
            if (u.username) userIdMap.set(u.username.toLowerCase(), res.rows[0].id);
          }
        }
      }

      // 3. Sync students table
      const studentTableIdMap = new Map<string, number>();
      if (Array.isArray(dataToSave.users)) {
        const studentUsers = dataToSave.users.filter((x: any) => x.role === 'STUDENT');
        for (const u of studentUsers) {
          const neonUserId = userIdMap.get(u.id) || userIdMap.get((u.email || '').toLowerCase()) || (u.username ? userIdMap.get(u.username.toLowerCase()) : null);
          if (!neonUserId) continue;

          let deptId = deptIdMap.get(u.departmentId) || deptIdMap.get('CSE') || defaultDeptId;
          const regNo = (u.registerNo || u.rollNo || `REG-${u.username}`).trim();

          const checkRes = await client.query(
            'SELECT id FROM students WHERE user_id = $1 OR register_number = $2 LIMIT 1',
            [neonUserId, regNo]
          );

          let sid: number;
          if (checkRes.rows.length > 0) {
            sid = checkRes.rows[0].id;
            await client.query(
              `UPDATE students
               SET user_id = $1, register_number = $2, department_id = $3, degree_program = $4, batch_year = $5, current_semester = $6
               WHERE id = $7`,
              [neonUserId, regNo, deptId, u.degree || 'B.E.', u.batchYear || '2021-2025', u.semester || 8, sid]
            );
          } else {
            const ins = await client.query(
              `INSERT INTO students (user_id, register_number, department_id, degree_program, batch_year, current_semester, section, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, 'A', COALESCE($7::timestamp, NOW()))
               RETURNING id`,
              [neonUserId, regNo, deptId, u.degree || 'B.E.', u.batchYear || '2021-2025', u.semester || 8, u.createdAt || null]
            );
            sid = ins.rows[0].id;
          }
          studentTableIdMap.set(u.id, sid);
        }
      }

      // 4. Sync staff table
      if (Array.isArray(dataToSave.users)) {
        const staffUsers = dataToSave.users.filter((x: any) => x.role === 'STAFF');
        for (const u of staffUsers) {
          const neonUserId = userIdMap.get(u.id) || userIdMap.get((u.email || '').toLowerCase()) || (u.username ? userIdMap.get(u.username.toLowerCase()) : null);
          if (!neonUserId) continue;

          let deptId = deptIdMap.get(u.departmentId) || deptIdMap.get('CSE') || defaultDeptId;
          const staffCode = (u.username || `STF-${u.id}`).trim();

          const check = await client.query(
            'SELECT id FROM staff WHERE user_id = $1 OR staff_code = $2 LIMIT 1',
            [neonUserId, staffCode]
          );
          if (check.rows.length > 0) {
            await client.query(
              `UPDATE staff
               SET user_id = $1, department_id = $2, designation = $3, staff_code = $4, clearance_category = $5
               WHERE id = $6`,
              [neonUserId, deptId, u.designation || 'Faculty Member', staffCode, u.clearanceScope || 'General Clearance', check.rows[0].id]
            );
          } else {
            await client.query(
              `INSERT INTO staff (user_id, department_id, designation, staff_code, clearance_category, created_at)
               VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamp, NOW()))`,
              [neonUserId, deptId, u.designation || 'Faculty Member', staffCode, u.clearanceScope || 'General Clearance', u.createdAt || null]
            );
          }
        }
      }

      // 5. Sync no_due_requests table
      if (Array.isArray(dataToSave.clearances)) {
        for (const clr of dataToSave.clearances) {
          const neonStudentId = studentTableIdMap.get(clr.studentId);
          if (!neonStudentId) continue;

          let status = 'pending';
          if (clr.overallStatus === 'COMPLETED') status = 'approved';
          else if (clr.overallStatus === 'REJECTED') status = 'rejected';
          else if (clr.overallStatus === 'ACTION_REQUIRED') status = 'under_review';
          else if (clr.clearedCheckpoints > 0) status = 'partially_approved';

          const remarks = `Cleared: ${clr.clearedCheckpoints || 0}/${clr.totalCheckpoints || 0}. Total Due: ₹${clr.totalDueAmount || 0}`;

          const check = await client.query(
            'SELECT id FROM no_due_requests WHERE student_id = $1 LIMIT 1',
            [neonStudentId]
          );
          if (check.rows.length > 0) {
            await client.query(
              `UPDATE no_due_requests
               SET academic_year = $1, status = $2, overall_remarks = $3, updated_at = NOW()
               WHERE id = $4`,
              [clr.batchYear || '2024-2025', status, remarks, check.rows[0].id]
            );
          } else {
            await client.query(
              `INSERT INTO no_due_requests (student_id, academic_year, reason, status, overall_remarks, submitted_at, created_at, updated_at)
               VALUES ($1, $2, 'Course Completion & Institutional Clearance', $3, $4, NOW(), NOW(), NOW())`,
              [neonStudentId, clr.batchYear || '2024-2025', status, remarks]
            );
          }
        }
      }
    } catch (err: any) {
      console.warn('⚠️ Warning syncing into standard Neon relational tables:', err.message);
    }
  }

  public getStatus(): PostgresStatus {
    const { url, source } = this.getEffectiveUrl();
    const effectiveUrl = url || this.currentUrl;
    return {
      isConfigured: Boolean(effectiveUrl),
      isConnected: this.isConnected,
      provider: this.getProvider(effectiveUrl),
      urlSource: source,
      maskedUrl: this.maskUrl(effectiveUrl),
      error: this.lastError || undefined,
      lastSyncAt: this.lastSyncAt || undefined,
      tableInitialized: this.tableInitialized,
      neonCounts: this.cachedNeonCounts,
    };
  }
}

export const postgresManager = new PostgresManager();
