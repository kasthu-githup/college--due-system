// Unified High-Resilience API Client for Institutional No-Due Portal
// Guarantees dual-layer persistence (Server Node/Express db.json + Browser localStorage clientDb)
// Seamlessly operates across Render Web Services, Docker containers, and static hosts (Vercel/Netlify/GitHub Pages).

import { clientDb } from './clientStorage';
import { User, Department, Subject, StudentClearanceRecord, SystemStats } from '../types';

function getAuthHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const activeToken = token || localStorage.getItem('cnd_token');
  if (activeToken) {
    headers['Authorization'] = `Bearer ${activeToken}`;
  }
  return headers;
}

export const api = {
  // --- STATS ---
  async getStats(token?: string | null): Promise<SystemStats> {
    try {
      const res = await fetch('/api/stats', { headers: getAuthHeaders(token) });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch {
      // Backend offline or error
    }
    return clientDb.getStats() as SystemStats;
  },

  // --- DEPARTMENTS ---
  async getDepartments(): Promise<Department[]> {
    try {
      const res = await fetch('/api/departments');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      }
    } catch {
      // Backend offline
    }
    return clientDb.getDepartments();
  },

  async addDepartment(data: { code: string; name: string; description?: string }, token?: string | null): Promise<Department> {
    const localResult = clientDb.addDepartment(data);
    try {
      const res = await fetch('/api/departments', {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const serverDept = await res.json();
        return serverDept;
      }
    } catch {
      // Offline fallback
    }
    return localResult;
  },

  async updateDepartment(deptId: string, data: Partial<Department>, token?: string | null): Promise<Department> {
    try {
      const res = await fetch(`/api/departments/${deptId}`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify(data),
      });
      if (res.ok) return await res.json();
    } catch {
      // Local fallback
    }
    const depts = clientDb.getDepartments();
    const found = depts.find(d => d.id === deptId);
    if (found) {
      Object.assign(found, data);
      return found;
    }
    throw new Error('Department not found');
  },

  async deleteDepartment(deptId: string, token?: string | null): Promise<boolean> {
    clientDb.deleteDepartment(deptId);
    try {
      await fetch(`/api/departments/${deptId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
      });
    } catch {
      // Handled locally
    }
    return true;
  },

  // --- USERS ---
  async getUsers(token?: string | null, role?: string, deptId?: string): Promise<User[]> {
    try {
      const query = new URLSearchParams();
      if (role) query.set('role', role);
      if (deptId) query.set('departmentId', deptId);
      const url = `/api/users${query.toString() ? `?${query.toString()}` : ''}`;

      const res = await fetch(url, { headers: getAuthHeaders(token) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      }
    } catch {
      // Local fallback
    }
    return clientDb.getUsers(role, deptId);
  },

  async addStudent(studentData: any, token?: string | null): Promise<User> {
    try {
      const res = await fetch('/api/admin/student', {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(studentData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to register student (${res.status})`);
      }
      const serverStudent = await res.json();
      clientDb.addStudent(serverStudent);
      return serverStudent;
    } catch (err: any) {
      if (err.message && !err.message.includes('fetch') && !err.message.includes('Failed to fetch')) {
        throw err;
      }
      console.warn('[CND API] Backend student registration call offline. Preserved in local storage.');
      return clientDb.addStudent(studentData);
    }
  },

  async addStaff(staffData: any, token?: string | null): Promise<User> {
    try {
      const res = await fetch('/api/hod/staff', {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(staffData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to create staff (${res.status})`);
      }
      const serverStaff = await res.json();
      clientDb.addStaff(serverStaff);
      return serverStaff;
    } catch (err: any) {
      if (err.message && !err.message.includes('fetch') && !err.message.includes('Failed to fetch')) {
        throw err;
      }
      console.warn('[CND API] Backend staff creation call offline. Preserved in local storage.');
      return clientDb.addStaff(staffData);
    }
  },

  async addHod(hodData: any, token?: string | null): Promise<User> {
    try {
      const res = await fetch('/api/admin/hod', {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(hodData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to create HOD (${res.status})`);
      }
      const serverHod = await res.json();
      clientDb.addHod(serverHod);
      return serverHod;
    } catch (err: any) {
      if (err.message && !err.message.includes('fetch') && !err.message.includes('Failed to fetch')) {
        throw err;
      }
      console.warn('[CND API] Backend HOD creation call offline. Preserved in local storage.');
      return clientDb.addHod(hodData);
    }
  },

  async updateUser(userId: string, data: Partial<User>, token?: string | null): Promise<User> {
    const localUpdated = clientDb.updateUser(userId, data);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify(data),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Local holds truth
    }
    return localUpdated;
  },

  async deleteUser(userId: string, token?: string | null): Promise<boolean> {
    clientDb.deleteUser(userId);
    try {
      await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
      });
    } catch {
      // Local holds truth
    }
    return true;
  },

  // --- CLEARANCES ---
  async getClearances(token?: string | null): Promise<StudentClearanceRecord[]> {
    try {
      const res = await fetch('/api/clearances', { headers: getAuthHeaders(token) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      }
    } catch {
      // Local fallback
    }
    return clientDb.getAllClearances();
  },

  async getMyClearance(token?: string | null, studentId?: string): Promise<StudentClearanceRecord | null> {
    try {
      const res = await fetch('/api/clearances/my', { headers: getAuthHeaders(token) });
      if (res.ok) {
        const data = await res.json();
        if (data && data.id) return data;
      }
    } catch {
      // Fallback
    }
    if (studentId) {
      return clientDb.getClearanceForStudent(studentId);
    }
    const all = clientDb.getAllClearances();
    return all[0] || null;
  },

  async updateClearanceAction(params: {
    studentClearanceId: string;
    itemId: string;
    action: 'APPROVE' | 'RAISE_DUE' | 'CLEAR_DUE' | 'REJECT';
    dueAmount?: number;
    dueReason?: string;
    remarks?: string;
    actor: User;
  }, token?: string | null): Promise<StudentClearanceRecord> {
    const localClr = clientDb.updateClearanceAction(params);
    try {
      const res = await fetch('/api/clearances/action', {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          studentClearanceId: params.studentClearanceId,
          itemId: params.itemId,
          action: params.action,
          dueAmount: params.dueAmount,
          dueReason: params.dueReason,
          remarks: params.remarks,
        }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      console.warn('[CND API] Backend clearance action offline. Preserved in local storage.');
    }
    return localClr;
  },

  async clearanceAction(params: {
    studentClearanceId: string;
    itemId: string;
    action: 'APPROVE' | 'RAISE_DUE' | 'CLEAR_DUE' | 'REJECT';
    dueAmount?: number;
    dueReason?: string;
    remarks?: string;
  }, token?: string | null): Promise<StudentClearanceRecord> {
    try {
      const res = await fetch('/api/clearances/action', {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(params),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      console.warn('[CND API] Clearance action fallback to local storage.');
    }
    const all = clientDb.getAllClearances();
    const clr = all.find(c => c.id === params.studentClearanceId);
    if (clr) {
      const itm = clr.items.find(i => i.id === params.itemId);
      if (itm) {
        if (params.action === 'APPROVE' || params.action === 'CLEAR_DUE') {
          itm.status = 'APPROVED';
          itm.dueAmount = 0;
          itm.remarks = params.remarks || 'Approved';
        } else if (params.action === 'RAISE_DUE') {
          itm.status = 'DUE_RAISED';
          itm.dueAmount = params.dueAmount || 0;
          itm.dueReason = params.dueReason;
          itm.remarks = params.remarks;
        }
      }
      return clr;
    }
    throw new Error('Clearance record not found');
  },

  async payDue(
    studentClearanceIdOrParams: string | {
      studentClearanceId: string;
      itemId: string;
      paymentReference?: string;
      paymentMode?: string;
      amount?: number;
      student?: User;
    },
    itemId?: string,
    transactionNote?: string,
    token?: string | null
  ): Promise<StudentClearanceRecord> {
    let payload: any;
    if (typeof studentClearanceIdOrParams === 'object') {
      payload = studentClearanceIdOrParams;
    } else {
      payload = {
        studentClearanceId: studentClearanceIdOrParams,
        itemId,
        transactionNote: transactionNote || 'Online Payment',
      };
    }

    try {
      const res = await fetch('/api/clearances/pay-due', {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    const all = clientDb.getAllClearances();
    const clr = all.find(c => c.id === payload.studentClearanceId);
    if (clr) {
      const itm = clr.items.find(i => i.id === payload.itemId);
      if (itm) {
        itm.status = 'APPROVED';
        itm.dueAmount = 0;
        itm.remarks = 'Settled & Paid: ' + (payload.transactionNote || payload.paymentReference || 'Online');
      }
      return clr;
    }
    throw new Error('Clearance record not found');
  },

  async deleteClearanceItem(clearanceId: string, itemId: string, token?: string | null): Promise<StudentClearanceRecord> {
    const localUpdated = clientDb.deleteClearanceItem(clearanceId, itemId);
    try {
      const res = await fetch(`/api/clearances/${clearanceId}/items/${itemId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Local holds truth
    }
    return localUpdated;
  },

  // --- SUBJECTS ---
  async getSubjects(token?: string | null, staffId?: string): Promise<Subject[]> {
    try {
      const url = staffId ? `/api/subjects?staffId=${staffId}` : '/api/subjects';
      const res = await fetch(url, { headers: getAuthHeaders(token) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch {
      // Local fallback
    }
    return clientDb.getSubjects();
  },

  async addSubject(data: any, token?: string | null): Promise<Subject> {
    const localSubj = clientDb.addSubject(data);
    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(data),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Local holds truth
    }
    return localSubj;
  },

  async updateSubject(subjId: string, data: any, token?: string | null): Promise<Subject> {
    try {
      const res = await fetch(`/api/subjects/${subjId}`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify(data),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback to local
    }
    const subjects = clientDb.getSubjects();
    const found = subjects.find(s => s.id === subjId);
    if (found) {
      Object.assign(found, data);
      return found;
    }
    throw new Error('Subject not found');
  },


  async deleteSubject(subjId: string, token?: string | null): Promise<boolean> {
    clientDb.deleteSubject(subjId);
    try {
      await fetch(`/api/subjects/${subjId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
      });
    } catch {
      // Handled
    }
    return true;
  },

  async allocateStaffToSubject(subjectId: string, staffId: string, token?: string | null): Promise<Subject> {
    try {
      const res = await fetch(`/api/subjects/${subjectId}/allocate`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ staffId }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Local fallback
    }
    const subjects = clientDb.getSubjects();
    const subj = subjects.find(s => s.id === subjectId);
    if (subj) {
      subj.assignedStaffId = staffId;
      return subj;
    }
    throw new Error('Subject not found');
  },

  // --- AUDIT LOGS ---
  async getAuditLogs(token?: string | null): Promise<any[]> {
    try {
      const res = await fetch('/api/audit-logs', { headers: getAuthHeaders(token) });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Local fallback
    }
    return clientDb.getAuditLogs();
  },

  // --- BACKUP & RESTORE ---
  exportDatabase(): void {
    const jsonStr = clientDb.exportDatabase();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `college_cnd_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  importDatabase(jsonString: string): boolean {
    const success = clientDb.importDatabase(jsonString);
    if (success) {
      clientDb.syncWithServer();
    }
    return success;
  },

  // --- RENDER / POSTGRESQL DATABASE ---
  async getDbStatus(): Promise<{
    postgres: {
      isConfigured: boolean;
      isConnected: boolean;
      urlSource: 'env' | 'custom' | 'none';
      maskedUrl?: string;
      error?: string;
      lastSyncAt?: string;
      tableInitialized?: boolean;
    };
    stats: {
      users: number;
      clearances: number;
      departments: number;
      subjects: number;
    };
  }> {
    try {
      const res = await fetch('/api/system/db-status');
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Local fallback
    }
    return {
      postgres: {
        isConfigured: false,
        isConnected: false,
        urlSource: 'none',
      },
      stats: {
        users: clientDb.getUsers().length,
        clearances: clientDb.getAllClearances().length,
        departments: clientDb.getDepartments().length,
        subjects: clientDb.getSubjects().length,
      },
    };
  },

  async configureDb(databaseUrl: string): Promise<{ success: boolean; error?: string; status?: any }> {
    try {
      const res = await fetch('/api/system/db-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ databaseUrl }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error configuring database' };
    }
  },

  async syncDb(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch('/api/system/db-sync', {
        method: 'POST',
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error syncing database' };
    }
  },
};
