import 'dotenv/config';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

export interface PostgresStatus {
  isConfigured: boolean;
  isConnected: boolean;
  urlSource: 'env' | 'custom' | 'none';
  maskedUrl?: string;
  error?: string;
  lastSyncAt?: string;
  tableInitialized?: boolean;
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

  constructor() {
    this.detectAndInit();
  }

  private getEffectiveUrl(): { url: string | null; source: 'env' | 'custom' | 'none' } {
    // 1. Check custom saved url config if present
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

    // 2. Check standard environment variables used by Render and cloud providers
    const envUrl =
      process.env.DATABASE_URL ||
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
    // Some providers use postgres:// which is compatible, but postgresql:// is standard
    if (url.startsWith('postgres://')) {
      url = 'postgresql://' + url.substring('postgres://'.length);
    }
    return url;
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
    
    // Close existing pool if any
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
        // Render PostgreSQL requires SSL with self-signed certificate acceptance
        ssl: isLocal ? false : { rejectUnauthorized: false },
        connectionTimeoutMillis: 9000,
        idleTimeoutMillis: 30000,
        max: 5,
      });

      // Test connection
      const client = await this.pool.connect();
      try {
        const result = await client.query('SELECT NOW() as current_time, version()');
        console.log('✅ Render PostgreSQL Connected successfully:', result.rows[0]?.current_time);
        
        // Initialize schema tables if not exist
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

        this.tableInitialized = true;
        this.isConnected = true;
        this.currentUrl = normalized;
        this.lastError = null;
        return true;
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error('❌ Failed to connect to Render PostgreSQL:', err.message);
      this.isConnected = false;
      let msg = err.message || 'Connection failed';
      if (msg.includes('ENOTFOUND') && (normalized.includes('dpg-') && !normalized.includes('.render.com'))) {
        msg = 'Render Internal URL detected (@dpg-...). To connect outside Render or from this live preview, you MUST use Render\'s "External Database URL" (ends with .render.com).';
      } else if (msg.includes('password authentication failed')) {
        msg = 'Password authentication failed. Please copy the complete connection string from Render.';
      }
      this.lastError = msg;
      return false;
    }
  }

  public async saveCustomUrl(rawUrl: string): Promise<{ success: boolean; error?: string }> {
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      // Remove custom url
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

    // Persist custom URL config
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
        if (res.rows.length > 0 && res.rows[0].data) {
          this.lastSyncAt = res.rows[0].updated_at || new Date().toISOString();
          console.log(`📥 Loaded database state from Render PostgreSQL (updated: ${this.lastSyncAt})`);
          return res.rows[0].data;
        }
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error('Error loading data from Render PostgreSQL:', err.message);
      this.lastError = err.message;
    }
    return null;
  }

  public saveData(data: any): void {
    if (!this.isConnected || !this.pool) return;
    this.pendingDataToSave = data;

    // Debounce saves by 400ms to avoid overwhelming PostgreSQL on rapid updates
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }

    this.saveDebounceTimer = setTimeout(async () => {
      await this.flushSave();
    }, 400);
  }

  public async flushSave(explicitData?: any): Promise<boolean> {
    if (!this.isConnected || !this.pool) return false;
    const dataToSave = explicitData || this.pendingDataToSave;
    if (!dataToSave) return false;
    this.pendingDataToSave = null;

    try {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');

        // 1. Save master JSONB snapshot
        await client.query(
          `INSERT INTO college_cnd_data (id, data, updated_at)
           VALUES ('main_database', $1, NOW())
           ON CONFLICT (id)
           DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();`,
          [JSON.stringify(dataToSave)]
        );

        // 2. Mirror into relational tables for transparent querying
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

        await client.query('COMMIT');
        this.lastSyncAt = new Date().toISOString();
        this.lastError = null;
        console.log(`💾 Render PostgreSQL updated: master snapshot and relational tables persisted at ${this.lastSyncAt}`);
        return true;
      } catch (err: any) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error('Error saving data to Render PostgreSQL:', err.message);
      this.lastError = err.message;
      return false;
    }
  }

  public getStatus(): PostgresStatus {
    const { url, source } = this.getEffectiveUrl();
    return {
      isConfigured: Boolean(url),
      isConnected: this.isConnected,
      urlSource: source,
      maskedUrl: this.maskUrl(url || this.currentUrl),
      error: this.lastError || undefined,
      lastSyncAt: this.lastSyncAt || undefined,
      tableInitialized: this.tableInitialized,
    };
  }
}

export const postgresManager = new PostgresManager();
