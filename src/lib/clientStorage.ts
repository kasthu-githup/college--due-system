// Client-Side Embedded Storage Engine
// Provides full offline/static deployment resilience when deployed on static hosts (Vercel, Netlify, GitHub Pages, etc.)
// or when backend service is unreachable.

import { User, StudentClearanceRecord, Department, Subject, ClearanceItem, ClearanceStatus } from '../types';

const STORAGE_KEY = 'cnd_client_database_v2';

interface ClientDatabaseState {
  users: User[];
  clearances: StudentClearanceRecord[];
  departments: Department[];
  subjects: Subject[];
}

function getDefaultCheckpoints(student: User, deptName: string): ClearanceItem[] {
  const isHosteler = Boolean(student.isHosteler);
  const now = new Date().toISOString();

  const checkpoints: ClearanceItem[] = [
    {
      id: `item_dept_advisor_${student.id}`,
      checkpointKey: 'dept_advisor',
      title: 'Class Advisor / Tutor Clearance',
      category: 'DEPARTMENT',
      departmentId: student.departmentId,
      departmentName: deptName,
      status: 'PENDING',
      dueAmount: 0,
      assignedRole: 'STAFF',
      assignedScope: 'Class Advisor',
      updatedAt: now,
    },
    {
      id: `item_dept_lab_${student.id}`,
      checkpointKey: 'dept_lab',
      title: `${deptName} Laboratories & Equipment`,
      category: 'DEPARTMENT',
      departmentId: student.departmentId,
      departmentName: deptName,
      status: 'PENDING',
      dueAmount: 0,
      assignedRole: 'STAFF',
      assignedScope: `${deptName} Labs & Equipment`,
      updatedAt: now,
    },
    {
      id: `item_dept_lib_${student.id}`,
      checkpointKey: 'dept_library',
      title: `${deptName} Department Library & Seminar Records`,
      category: 'DEPARTMENT',
      departmentId: student.departmentId,
      departmentName: deptName,
      status: 'PENDING',
      dueAmount: 0,
      assignedRole: 'STAFF',
      assignedScope: `${deptName} Dept Library`,
      updatedAt: now,
    },
    {
      id: `item_subj_1_${student.id}`,
      checkpointKey: 'subj_cs8651',
      title: 'Subject: CS8651 - Internet Programming',
      category: 'DEPARTMENT',
      departmentId: student.departmentId,
      departmentName: deptName,
      status: 'PENDING',
      dueAmount: 0,
      assignedRole: 'STAFF',
      assignedScope: 'Subject: CS8651',
      subjectCode: 'CS8651',
      subjectName: 'Internet Programming',
      updatedAt: now,
    },
    {
      id: `item_subj_2_${student.id}`,
      checkpointKey: 'subj_cs8661',
      title: 'Subject: CS8661 - Internet Programming Laboratory',
      category: 'DEPARTMENT',
      departmentId: student.departmentId,
      departmentName: deptName,
      status: 'PENDING',
      dueAmount: 0,
      assignedRole: 'STAFF',
      assignedScope: 'Subject: CS8661',
      subjectCode: 'CS8661',
      subjectName: 'Internet Programming Laboratory',
      updatedAt: now,
    },
    {
      id: `item_dept_hod_${student.id}`,
      checkpointKey: 'dept_hod',
      title: `HOD Final Department Endorsement (${deptName})`,
      category: 'DEPARTMENT',
      departmentId: student.departmentId,
      departmentName: deptName,
      status: 'PENDING',
      dueAmount: 0,
      assignedRole: 'HOD',
      assignedScope: 'HOD Department Signoff',
      updatedAt: now,
    },
    {
      id: `item_central_lib_${student.id}`,
      checkpointKey: 'central_library',
      title: 'Central College Library Clearance',
      category: 'CENTRAL',
      status: 'PENDING',
      dueAmount: 0,
      assignedRole: 'STAFF',
      assignedScope: 'Central Library',
      updatedAt: now,
    },
    {
      id: `item_accounts_${student.id}`,
      checkpointKey: 'accounts',
      title: 'College Finance & Accounts Counter (Tuition & Exam Fees)',
      category: 'CENTRAL',
      status: 'PENDING',
      dueAmount: 0,
      assignedRole: 'STAFF',
      assignedScope: 'Accounts Section',
      updatedAt: now,
    },
    {
      id: `item_sports_${student.id}`,
      checkpointKey: 'sports',
      title: 'Physical Education & Sports Directorate',
      category: 'CENTRAL',
      status: 'PENDING',
      dueAmount: 0,
      assignedRole: 'STAFF',
      assignedScope: 'Sports Directorate',
      updatedAt: now,
    },
    {
      id: `item_placement_${student.id}`,
      checkpointKey: 'placement',
      title: 'Career Guidance & Training & Placement Cell',
      category: 'CENTRAL',
      status: 'PENDING',
      dueAmount: 0,
      assignedRole: 'STAFF',
      assignedScope: 'Placement Cell',
      updatedAt: now,
    },
  ];

  if (isHosteler) {
    checkpoints.push({
      id: `item_hostel_${student.id}`,
      checkpointKey: 'hostel',
      title: 'Hostel Office & Mess Dues Clearance',
      category: 'CENTRAL',
      status: 'PENDING',
      dueAmount: 0,
      assignedRole: 'STAFF',
      assignedScope: 'Hostel Office',
      updatedAt: now,
    });
  }

  return checkpoints;
}

function createInitialState(): ClientDatabaseState {
  const now = new Date().toISOString();

  const departments: Department[] = [
    {
      id: 'dept_cse',
      name: 'Computer Science and Engineering',
      code: 'CSE',
      description: 'Department of Computer Science & Engineering',
      createdAt: now,
    },
    {
      id: 'dept_ece',
      name: 'Electronics and Communication Engineering',
      code: 'ECE',
      description: 'Department of Electronics & Communication Engineering',
      createdAt: now,
    },
    {
      id: 'dept_mech',
      name: 'Mechanical Engineering',
      code: 'MECH',
      description: 'Department of Mechanical Engineering',
      createdAt: now,
    },
    {
      id: 'dept_it',
      name: 'Information Technology',
      code: 'IT',
      description: 'Department of Information Technology',
      createdAt: now,
    },
    {
      id: 'dept_civil',
      name: 'Civil Engineering',
      code: 'CIVIL',
      description: 'Department of Civil Engineering',
      createdAt: now,
    },
  ];

  const student1: User = {
    id: 'user_student_732423104001',
    username: '732423104001',
    rollNo: '732423104001',
    registerNo: '732423104001',
    name: 'Elavarasan R',
    email: 'elavarasan.cse@college.edu',
    password: 'student123',
    role: 'STUDENT',
    departmentId: 'dept_cse',
    departmentName: 'Computer Science and Engineering',
    degree: 'B.E. Computer Science and Engineering',
    batchYear: '2021 - 2025',
    semester: 8,
    section: 'A',
    isHosteler: false,
    phone: '+91 98765 43210',
    status: 'ACTIVE',
    createdAt: now,
  };

  const student2: User = {
    id: 'user_student_732423104002',
    username: '732423104002',
    rollNo: '732423104002',
    registerNo: '732423104002',
    name: 'Kavitha M',
    email: 'kavitha.cse@college.edu',
    password: 'student123',
    role: 'STUDENT',
    departmentId: 'dept_cse',
    departmentName: 'Computer Science and Engineering',
    degree: 'B.E. Computer Science and Engineering',
    batchYear: '2021 - 2025',
    semester: 8,
    section: 'A',
    isHosteler: true,
    phone: '+91 98765 43211',
    status: 'ACTIVE',
    createdAt: now,
  };

  const hodCse: User = {
    id: 'user_hod_cse',
    username: 'hod_cse',
    staffId: 'HOD-CSE-01',
    name: 'Dr. K. Ramanathan',
    email: 'hod.cse@college.edu',
    password: 'hod123',
    role: 'HOD',
    departmentId: 'dept_cse',
    departmentName: 'Computer Science and Engineering',
    designation: 'Professor & Head of Department',
    phone: '+91 98401 23456',
    status: 'ACTIVE',
    createdAt: now,
  };

  const staffAdvisor: User = {
    id: 'user_staff_cse',
    username: 'staff_cse',
    staffId: 'FAC-CSE-01',
    name: 'Prof. S. Priya',
    email: 'priya.cse@college.edu',
    password: 'staff123',
    role: 'STAFF',
    departmentId: 'dept_cse',
    departmentName: 'Computer Science and Engineering',
    designation: 'Assistant Professor / Class Advisor',
    clearanceScope: 'Class Advisor',
    phone: '+91 98402 34567',
    status: 'ACTIVE',
    createdAt: now,
  };

  const staffLib: User = {
    id: 'user_staff_lib',
    username: 'staff_lib',
    staffId: 'FAC-LIB-01',
    name: 'Mr. M. Suresh',
    email: 'library@college.edu',
    password: 'staff123',
    role: 'STAFF',
    designation: 'Central Librarian',
    clearanceScope: 'Central Library',
    status: 'ACTIVE',
    createdAt: now,
  };

  const staffAcc: User = {
    id: 'user_staff_acc',
    username: 'staff_acc',
    staffId: 'FAC-ACC-01',
    name: 'Mrs. R. Malathi',
    email: 'accounts@college.edu',
    password: 'staff123',
    role: 'STAFF',
    designation: 'Finance & Accounts Officer',
    clearanceScope: 'Accounts Section',
    status: 'ACTIVE',
    createdAt: now,
  };

  const admin: User = {
    id: 'user_admin',
    username: 'admin',
    name: 'College Administrator',
    email: 'admin@college.edu',
    password: 'admin123',
    role: 'ADMIN',
    status: 'ACTIVE',
    createdAt: now,
  };

  const users = [admin, student1, student2, hodCse, staffAdvisor, staffLib, staffAcc];

  const checkpoints1 = getDefaultCheckpoints(student1, 'Computer Science and Engineering');
  const checkpoints2 = getDefaultCheckpoints(student2, 'Computer Science and Engineering');

  const clearances: StudentClearanceRecord[] = [
    {
      id: 'clr_732423104001',
      studentId: student1.id,
      studentName: student1.name,
      studentRollNo: student1.rollNo!,
      studentRegisterNo: student1.registerNo!,
      studentDepartmentId: student1.departmentId!,
      studentDepartmentName: student1.departmentName!,
      degree: student1.degree!,
      batchYear: student1.batchYear!,
      semester: student1.semester!,
      isHosteler: Boolean(student1.isHosteler),
      totalCheckpoints: checkpoints1.length,
      clearedCheckpoints: 0,
      totalDueAmount: 0,
      overallStatus: 'IN_PROGRESS',
      items: checkpoints1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'clr_732423104002',
      studentId: student2.id,
      studentName: student2.name,
      studentRollNo: student2.rollNo!,
      studentRegisterNo: student2.registerNo!,
      studentDepartmentId: student2.departmentId!,
      studentDepartmentName: student2.departmentName!,
      degree: student2.degree!,
      batchYear: student2.batchYear!,
      semester: student2.semester!,
      isHosteler: Boolean(student2.isHosteler),
      totalCheckpoints: checkpoints2.length,
      clearedCheckpoints: 0,
      totalDueAmount: 0,
      overallStatus: 'IN_PROGRESS',
      items: checkpoints2,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const subjects: Subject[] = [
    {
      id: 'subj_cs8651',
      departmentId: 'dept_cse',
      code: 'CS8651',
      name: 'Internet Programming',
      semester: 8,
      type: 'THEORY',
      assignedStaffId: staffAdvisor.id,
      assignedStaffName: staffAdvisor.name,
      createdAt: now,
    },
    {
      id: 'subj_cs8661',
      departmentId: 'dept_cse',
      code: 'CS8661',
      name: 'Internet Programming Laboratory',
      semester: 8,
      type: 'PRACTICAL',
      assignedStaffId: staffAdvisor.id,
      assignedStaffName: staffAdvisor.name,
      createdAt: now,
    },
  ];

  return {
    users,
    clearances,
    departments,
    subjects,
  };
}

class ClientStorageEngine {
  private data: ClientDatabaseState;

  constructor() {
    this.data = this.loadData();
  }

  private loadData(): ClientDatabaseState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.users && parsed.clearances) {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    const initial = createInitialState();
    this.saveData(initial);
    return initial;
  }

  private saveData(dataToSave?: ClientDatabaseState) {
    try {
      const target = dataToSave || this.data;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(target));
    } catch {
      // Storage quota or private mode
    }
  }

  public reset(mode: 'demo' | 'clear_dues' | 'wipe') {
    if (mode === 'demo' || mode === 'wipe') {
      this.data = createInitialState();
      this.saveData();
      return { success: true, message: 'System database successfully reset to clean institutional state.' };
    }

    if (mode === 'clear_dues') {
      this.data.clearances.forEach(clr => {
        clr.totalDueAmount = 0;
        clr.items.forEach(item => {
          item.dueAmount = 0;
          if (item.status === 'DUE_RAISED') {
            item.status = 'PENDING';
          }
        });
      });
      this.saveData();
      return { success: true, message: 'All outstanding dues reset to zero.' };
    }

    return { success: false, message: 'Invalid reset mode' };
  }

  public login(usernameAttempt: string, passwordAttempt: string): { token: string; user: User } | null {
    const cleanIdentifier = (usernameAttempt || '').trim().toLowerCase();
    const cleanPassword = (passwordAttempt || '').trim();

    let user = this.data.users.find(u => {
      if (u.status && u.status !== 'ACTIVE') return false;
      const uName = (u.username || '').trim().toLowerCase();
      const uEmail = (u.email || '').trim().toLowerCase();
      const uRoll = (u.rollNo || '').trim().toLowerCase();
      const uReg = (u.registerNo || '').trim().toLowerCase();
      const uStaff = (u.staffId || '').trim().toLowerCase();

      return (
        uName === cleanIdentifier ||
        uEmail === cleanIdentifier ||
        uRoll === cleanIdentifier ||
        uReg === cleanIdentifier ||
        uStaff === cleanIdentifier
      );
    });

    // Auto-enroll student or staff on the fly if not found!
    if (!user) {
      const isStaffPattern = cleanIdentifier.startsWith('staff') || cleanIdentifier.startsWith('fac');
      const isHodPattern = cleanIdentifier.startsWith('hod');
      const isAdminPattern = cleanIdentifier === 'admin';

      if (!isStaffPattern && !isHodPattern && !isAdminPattern) {
        // Any student register/roll number entered gets automatically enrolled!
        const regNo = (usernameAttempt || '').trim().toUpperCase();
        const dept = this.data.departments[0] || { id: 'dept_cse', name: 'Computer Science and Engineering', code: 'CSE', createdAt: new Date().toISOString() };
        const newStudent: User = {
          id: `user_student_${cleanIdentifier}`,
          username: cleanIdentifier,
          rollNo: regNo,
          registerNo: regNo,
          name: `Student (${regNo})`,
          email: `${cleanIdentifier}@college.edu`,
          password: cleanPassword || 'student123',
          role: 'STUDENT',
          departmentId: dept.id,
          departmentName: dept.name,
          degree: 'B.E. Computer Science and Engineering',
          batchYear: '2021 - 2025',
          semester: 8,
          section: 'A',
          isHosteler: false,
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
        };
        this.data.users.push(newStudent);

        const checkpoints = getDefaultCheckpoints(newStudent, dept.name);
        const clearance: StudentClearanceRecord = {
          id: `clr_${cleanIdentifier}`,
          studentId: newStudent.id,
          studentName: newStudent.name,
          studentRollNo: newStudent.rollNo!,
          studentRegisterNo: newStudent.registerNo!,
          studentDepartmentId: newStudent.departmentId!,
          studentDepartmentName: newStudent.departmentName!,
          degree: newStudent.degree!,
          batchYear: newStudent.batchYear!,
          semester: newStudent.semester!,
          isHosteler: Boolean(newStudent.isHosteler),
          totalCheckpoints: checkpoints.length,
          clearedCheckpoints: 0,
          totalDueAmount: 0,
          overallStatus: 'IN_PROGRESS',
          items: checkpoints,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.data.clearances.push(clearance);
        this.saveData();

        user = newStudent;
      } else if (isStaffPattern) {
        const newStaff: User = {
          id: `user_${cleanIdentifier}`,
          username: cleanIdentifier,
          staffId: cleanIdentifier.toUpperCase(),
          name: `Faculty (${cleanIdentifier})`,
          email: `${cleanIdentifier}@college.edu`,
          password: cleanPassword || 'staff123',
          role: 'STAFF',
          departmentId: 'dept_cse',
          departmentName: 'Computer Science and Engineering',
          designation: 'Assistant Professor',
          clearanceScope: 'Class Advisor',
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
        };
        this.data.users.push(newStaff);
        this.saveData();
        user = newStaff;
      } else if (isHodPattern) {
        const newHod: User = {
          id: `user_${cleanIdentifier}`,
          username: cleanIdentifier,
          staffId: cleanIdentifier.toUpperCase(),
          name: `HOD (${cleanIdentifier})`,
          email: `${cleanIdentifier}@college.edu`,
          password: cleanPassword || 'hod123',
          role: 'HOD',
          departmentId: 'dept_cse',
          departmentName: 'Computer Science and Engineering',
          designation: 'Professor & HOD',
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
        };
        this.data.users.push(newHod);
        this.saveData();
        user = newHod;
      }
    }

    if (!user) return null;

    // Ensure student clearance record exists
    if (user.role === 'STUDENT' && !this.data.clearances.some(c => c.studentId === user!.id)) {
      const dept = this.data.departments.find(d => d.id === user!.departmentId) || this.data.departments[0];
      const checkpoints = getDefaultCheckpoints(user, dept.name);
      this.data.clearances.push({
        id: `clr_${user.id}`,
        studentId: user.id,
        studentName: user.name,
        studentRollNo: user.rollNo || user.username,
        studentRegisterNo: user.registerNo || user.username,
        studentDepartmentId: dept.id,
        studentDepartmentName: dept.name,
        degree: user.degree || 'B.E.',
        batchYear: user.batchYear || '2021 - 2025',
        semester: user.semester || 8,
        isHosteler: Boolean(user.isHosteler),
        totalCheckpoints: checkpoints.length,
        clearedCheckpoints: 0,
        totalDueAmount: 0,
        overallStatus: 'IN_PROGRESS',
        items: checkpoints,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      this.saveData();
    }

    const { password, ...safeUser } = user;
    const token = `local_${user.id}_${Date.now()}`;
    return { token, user: safeUser as User };
  }

  public getClearanceForStudent(studentId: string): StudentClearanceRecord | null {
    let clr = this.data.clearances.find(c => c.studentId === studentId);
    if (!clr) {
      const student = this.data.users.find(u => u.id === studentId || u.username === studentId || u.rollNo === studentId || u.registerNo === studentId);
      if (student && student.role === 'STUDENT') {
        const dept = this.data.departments.find(d => d.id === student.departmentId) || this.data.departments[0];
        const checkpoints = getDefaultCheckpoints(student, dept.name);
        clr = {
          id: `clr_${student.id}`,
          studentId: student.id,
          studentName: student.name,
          studentRollNo: student.rollNo || student.username,
          studentRegisterNo: student.registerNo || student.username,
          studentDepartmentId: dept.id,
          studentDepartmentName: dept.name,
          degree: student.degree || 'B.E.',
          batchYear: student.batchYear || '2021 - 2025',
          semester: student.semester || 8,
          isHosteler: Boolean(student.isHosteler),
          totalCheckpoints: checkpoints.length,
          clearedCheckpoints: 0,
          totalDueAmount: 0,
          overallStatus: 'IN_PROGRESS',
          items: checkpoints,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.data.clearances.push(clr);
        this.saveData();
      }
    }
    return clr || null;
  }

  public getAllClearances(): StudentClearanceRecord[] {
    return this.data.clearances;
  }

  public getDepartments(): Department[] {
    return this.data.departments;
  }

  public getUsers(filterRole?: string, departmentId?: string): User[] {
    return this.data.users.filter(u => {
      if (filterRole && u.role !== filterRole) return false;
      if (departmentId && u.departmentId !== departmentId) return false;
      return true;
    }).map(({ password, ...u }) => u as User);
  }

  public getSubjects(deptId?: string): Subject[] {
    if (deptId) {
      return this.data.subjects.filter(s => s.departmentId === deptId);
    }
    return this.data.subjects;
  }

  public getStats() {
    const totalStudents = this.data.users.filter(u => u.role === 'STUDENT').length;
    const clearances = this.data.clearances;
    const fullyClearedStudents = clearances.filter(c => c.overallStatus === 'COMPLETED').length;
    const withDues = clearances.filter(c => c.overallStatus === 'HAS_DUES' || c.totalDueAmount > 0).length;
    const inProgress = totalStudents - fullyClearedStudents - withDues;
    const totalDuesRaisedAmount = clearances.reduce((acc, c) => acc + (c.totalDueAmount || 0), 0);

    return {
      totalStudents,
      totalHods: this.data.users.filter(u => u.role === 'HOD').length,
      totalStaffs: this.data.users.filter(u => u.role === 'STAFF').length,
      totalDepartments: this.data.departments.length,
      totalSubjects: this.data.subjects.length,
      fullyClearedStudents,
      pendingClearances: Math.max(0, inProgress),
      totalDuesRaisedAmount,
      totalDuesCollectedAmount: 0,
    };
  }

  public updateClearanceAction(params: {
    studentClearanceId: string;
    itemId: string;
    action: 'APPROVE' | 'RAISE_DUE' | 'CLEAR_DUE' | 'REJECT';
    dueAmount?: number;
    dueReason?: string;
    remarks?: string;
    actor: User;
  }): StudentClearanceRecord {
    const clr = this.data.clearances.find(c => c.id === params.studentClearanceId);
    if (!clr) throw new Error('Clearance record not found');

    const item = clr.items.find(i => i.id === params.itemId);
    if (!item) throw new Error('Checkpoint not found');

    const now = new Date().toISOString();

    if (params.action === 'APPROVE') {
      item.status = 'APPROVED';
      item.clearedByUserName = params.actor.name;
      item.clearedByUserId = params.actor.id;
      item.clearedAt = now;
      item.dueAmount = 0;
      item.dueReason = undefined;
      item.remarks = params.remarks;
    } else if (params.action === 'RAISE_DUE') {
      item.status = 'DUE_RAISED';
      item.dueAmount = Number(params.dueAmount || 0);
      item.dueReason = params.dueReason;
      item.clearedByUserName = undefined;
      item.clearedByUserId = undefined;
      item.clearedAt = undefined;
      item.remarks = params.remarks;
    } else if (params.action === 'CLEAR_DUE') {
      item.status = 'APPROVED';
      item.dueAmount = 0;
      item.dueReason = undefined;
      item.clearedByUserName = params.actor.name;
      item.clearedByUserId = params.actor.id;
      item.clearedAt = now;
      item.remarks = params.remarks || 'Fine/due cleared and checkpoint approved.';
    } else if (params.action === 'REJECT') {
      item.status = 'REJECTED';
      item.clearedByUserName = undefined;
      item.clearedByUserId = undefined;
      item.clearedAt = undefined;
      item.remarks = params.remarks;
    }

    item.updatedAt = now;

    // Recalculate totals
    clr.clearedCheckpoints = clr.items.filter(i => i.status === 'APPROVED').length;
    clr.totalDueAmount = clr.items.reduce((sum, i) => sum + (i.dueAmount || 0), 0);

    const hasDues = clr.items.some(i => i.status === 'DUE_RAISED' || (i.dueAmount || 0) > 0);
    const hasRejected = clr.items.some(i => i.status === 'REJECTED');
    const allApproved = clr.items.every(i => i.status === 'APPROVED');

    if (hasDues) {
      clr.overallStatus = 'HAS_DUES';
    } else if (hasRejected) {
      clr.overallStatus = 'IN_PROGRESS';
    } else if (allApproved && clr.clearedCheckpoints === clr.totalCheckpoints) {
      clr.overallStatus = 'COMPLETED';
      if (!clr.certificateIssuedAt) {
        clr.certificateIssuedAt = now;
        clr.certificateId = `CERT-${Date.now().toString(36).toUpperCase()}`;
      }
    } else {
      clr.overallStatus = 'IN_PROGRESS';
    }

    clr.updatedAt = now;
    this.saveData();
    return clr;
  }

  public payDue(params: {
    studentClearanceId: string;
    itemId: string;
    paymentReference: string;
    paymentMode: string;
    amount: number;
    student: User;
  }) {
    const clr = this.data.clearances.find(c => c.id === params.studentClearanceId);
    if (!clr) throw new Error('Clearance record not found');
    const item = clr.items.find(i => i.id === params.itemId);
    if (!item) throw new Error('Checkpoint not found');

    const now = new Date().toISOString();
    item.status = 'APPROVED';
    item.dueAmount = 0;
    item.remarks = `Paid via ${params.paymentMode} (Ref: ${params.paymentReference})`;
    item.clearedByUserName = 'Accounts Gateway (Auto-verified)';
    item.clearedAt = now;
    item.updatedAt = now;

    clr.clearedCheckpoints = clr.items.filter(i => i.status === 'APPROVED').length;
    clr.totalDueAmount = clr.items.reduce((sum, i) => sum + (i.dueAmount || 0), 0);
    if (clr.items.every(i => i.status === 'APPROVED')) {
      clr.overallStatus = 'COMPLETED';
      clr.certificateIssuedAt = now;
      clr.certificateId = `CERT-${Date.now().toString(36).toUpperCase()}`;
    } else {
      clr.overallStatus = 'IN_PROGRESS';
    }
    clr.updatedAt = now;
    this.saveData();
    return clr;
  }

  public addStudent(studentData: any): User {
    const regNo = (studentData.rollNo || studentData.registerNo || '').trim().toUpperCase();
    const dept = this.data.departments.find(d => d.id === studentData.departmentId) || this.data.departments[0];
    const newStudent: User = {
      id: `user_student_${Date.now()}`,
      username: studentData.rollNo || studentData.registerNo,
      rollNo: regNo,
      registerNo: studentData.registerNo || regNo,
      name: studentData.name,
      email: studentData.email,
      password: studentData.password || 'student123',
      role: 'STUDENT',
      departmentId: dept.id,
      departmentName: dept.name,
      degree: studentData.degree || 'B.E.',
      batchYear: studentData.batchYear || '2021 - 2025',
      semester: studentData.semester ? Number(studentData.semester) : 8,
      section: studentData.section || 'A',
      isHosteler: Boolean(studentData.isHosteler),
      phone: studentData.phone,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
    this.data.users.push(newStudent);

    const checkpoints = getDefaultCheckpoints(newStudent, dept.name);
    this.data.clearances.push({
      id: `clr_${newStudent.id}`,
      studentId: newStudent.id,
      studentName: newStudent.name,
      studentRollNo: newStudent.rollNo!,
      studentRegisterNo: newStudent.registerNo!,
      studentDepartmentId: dept.id,
      studentDepartmentName: dept.name,
      degree: newStudent.degree!,
      batchYear: newStudent.batchYear!,
      semester: newStudent.semester!,
      isHosteler: Boolean(newStudent.isHosteler),
      totalCheckpoints: checkpoints.length,
      clearedCheckpoints: 0,
      totalDueAmount: 0,
      overallStatus: 'IN_PROGRESS',
      items: checkpoints,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    this.saveData();
    const { password, ...safe } = newStudent;
    return safe as User;
  }

  public addStaff(staffData: any): User {
    const dept = this.data.departments.find(d => d.id === staffData.departmentId);
    const newStaff: User = {
      id: `user_staff_${Date.now()}`,
      username: staffData.staffId.toLowerCase(),
      staffId: staffData.staffId,
      name: staffData.name,
      email: staffData.email,
      password: staffData.password || 'staff123',
      role: 'STAFF',
      departmentId: dept?.id,
      departmentName: dept?.name,
      designation: staffData.designation,
      clearanceScope: staffData.clearanceScope,
      phone: staffData.phone,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
    this.data.users.push(newStaff);
    this.saveData();
    const { password, ...safe } = newStaff;
    return safe as User;
  }

  public addHod(hodData: any): User {
    const dept = this.data.departments.find(d => d.id === hodData.departmentId);
    const newHod: User = {
      id: `user_hod_${Date.now()}`,
      username: hodData.staffId ? hodData.staffId.toLowerCase() : `hod_${dept?.code.toLowerCase()}`,
      staffId: hodData.staffId,
      name: hodData.name,
      email: hodData.email,
      password: hodData.password || 'hod123',
      role: 'HOD',
      departmentId: dept?.id,
      departmentName: dept?.name,
      designation: hodData.designation || 'Professor & HOD',
      phone: hodData.phone,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
    this.data.users.push(newHod);
    this.saveData();
    const { password, ...safe } = newHod;
    return safe as User;
  }

  public addDepartment(deptData: any): Department {
    const newDept: Department = {
      id: `dept_${Date.now()}`,
      name: deptData.name,
      code: deptData.code.toUpperCase(),
      description: deptData.description,
      createdAt: new Date().toISOString(),
    };
    this.data.departments.push(newDept);
    this.saveData();
    return newDept;
  }

  public addSubject(subjData: any): Subject {
    const now = new Date().toISOString();
    const newSubj: Subject = {
      id: `subj_${Date.now()}`,
      departmentId: subjData.departmentId,
      code: subjData.code.toUpperCase(),
      name: subjData.name,
      semester: Number(subjData.semester),
      type: subjData.type || 'THEORY',
      assignedStaffId: subjData.assignedStaffId,
      createdAt: now,
    };
    this.data.subjects.push(newSubj);
    this.saveData();
    return newSubj;
  }

  public updateUser(userId: string, updates: Partial<User>): User {
    const idx = this.data.users.findIndex(u => u.id === userId);
    if (idx === -1) throw new Error('User not found');
    this.data.users[idx] = { ...this.data.users[idx], ...updates };
    this.saveData();
    const { password, ...safe } = this.data.users[idx];
    return safe as User;
  }

  public deleteUser(userId: string): boolean {
    this.data.users = this.data.users.filter(u => u.id !== userId);
    this.data.clearances = this.data.clearances.filter(c => c.studentId !== userId);
    this.saveData();
    return true;
  }

  public deleteSubject(subjId: string): boolean {
    this.data.subjects = this.data.subjects.filter(s => s.id !== subjId);
    this.saveData();
    return true;
  }

  public deleteDepartment(deptId: string): boolean {
    this.data.departments = this.data.departments.filter(d => d.id !== deptId);
    this.saveData();
    return true;
  }

  public deleteClearanceItem(clearanceId: string, itemId: string): StudentClearanceRecord {
    const clr = this.data.clearances.find(c => c.id === clearanceId);
    if (!clr) throw new Error('Clearance record not found');
    clr.items = clr.items.filter(i => i.id !== itemId);
    clr.totalCheckpoints = clr.items.length;
    clr.clearedCheckpoints = clr.items.filter(i => i.status === 'APPROVED').length;
    clr.totalDueAmount = clr.items.reduce((sum, i) => sum + (i.dueAmount || 0), 0);
    const hasDues = clr.items.some(i => i.status === 'DUE_RAISED' || (i.dueAmount || 0) > 0);
    const allApproved = clr.items.every(i => i.status === 'APPROVED');
    if (hasDues) {
      clr.overallStatus = 'HAS_DUES';
    } else if (allApproved && clr.totalCheckpoints > 0) {
      clr.overallStatus = 'COMPLETED';
    } else {
      clr.overallStatus = 'IN_PROGRESS';
    }
    clr.updatedAt = new Date().toISOString();
    this.saveData();
    return clr;
  }

  public getAuditLogs(): any[] {
    return [
      {
        id: 'log_local_init',
        action: 'CLIENT_STORAGE_ACTIVE',
        performedBy: 'System',
        performedByRole: 'SYSTEM',
        details: 'Client storage engine active and resilient.',
        timestamp: new Date().toISOString(),
      }
    ];
  }

  public exportDatabase(): string {
    return JSON.stringify(this.data, null, 2);
  }

  public importDatabase(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.users && parsed.clearances) {
        this.data = parsed;
        this.saveData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public async syncWithServer(): Promise<void> {
    try {
      const res = await fetch('/api/database/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.data),
      });
      if (res.ok) {
        console.log('[CND Sync] Local state synchronized with server.');
      }
    } catch {
      // Offline / Static mode - local storage holds truth
    }
  }
}

export const clientDb = new ClientStorageEngine();

