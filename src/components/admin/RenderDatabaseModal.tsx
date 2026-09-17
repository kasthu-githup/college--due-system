import React, { useState, useEffect } from 'react';
import { Database, CheckCircle2, AlertTriangle, RefreshCw, Server, ArrowRight, ShieldCheck, Copy, ExternalLink, X, Table, Users, GraduationCap, Building2, UserCheck, FileCheck } from 'lucide-react';
import { api } from '../../lib/api';

interface RenderDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RenderDatabaseModal: React.FC<RenderDatabaseModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [customUrl, setCustomUrl] = useState('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await api.getDbStatus();
      setStatus(res);
    } catch {
      // Handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setNotice(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isConnected = Boolean(status?.postgres?.isConnected);
  const provider = status?.postgres?.provider || 'Neon PostgreSQL';
  const maskedUrl = status?.postgres?.maskedUrl || '';
  const neonCounts = status?.postgres?.neonCounts;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim()) return;

    try {
      setSaving(true);
      setNotice(null);
      const result = await api.configureDb(customUrl.trim());
      if (result.success) {
        setNotice({
          type: 'success',
          text: `${provider} database connected and verified successfully! All tables initialized and synchronized.`,
        });
        setCustomUrl('');
        fetchStatus();
      } else {
        setNotice({
          type: 'error',
          text: result.error || 'Failed to connect to database. Please verify host, database name, and credentials.',
        });
      }
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err.message || 'Error configuring database',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSyncNow = async () => {
    try {
      setSyncing(true);
      setNotice(null);
      const res = await api.syncDb();
      if (res.success) {
        setNotice({
          type: 'success',
          text: `Current data successfully synchronized to ${provider}! Relational tables updated.`,
        });
        fetchStatus();
      } else {
        setNotice({
          type: 'error',
          text: res.error || 'Sync failed',
        });
      }
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err.message || 'Error triggering sync',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleCopyEnvKey = () => {
    navigator.clipboard.writeText('DATABASE_URL');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving && !syncing) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-2xl max-w-xl w-full border border-stone-200 shadow-2xl overflow-hidden relative"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 leading-tight">
                {isConnected ? `${provider} Connection` : 'Neon & PostgreSQL Database Connection'}
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Real-time synchronization with NeonDB and PostgreSQL relational tables
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Status Box */}
          <div className={`p-4 rounded-xl border ${
            isConnected
              ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-900'
              : 'bg-amber-50/70 border-amber-200/80 text-amber-900'
          }`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                {isConnected ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    {isConnected ? `${provider} Connected & Active` : 'Running on Local Storage (Cloud DB Not Connected)'}
                  </h4>
                  <p className="text-xs mt-0.5 opacity-90">
                    {isConnected
                      ? `All student profiles, clearances, departments, and staff are actively synchronized with ${provider}.`
                      : 'Data is temporarily stored in local container storage. Connect your NeonDB or PostgreSQL database for permanent cloud persistence.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={fetchStatus}
                disabled={loading}
                className="p-1.5 rounded text-stone-600 hover:bg-black/5 transition"
                title="Refresh database status"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {isConnected && (
              <div className="mt-3 pt-3 border-t border-emerald-200/60 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-emerald-700/80 font-medium">Provider:</span>{' '}
                  <strong className="font-semibold text-emerald-900">{provider}</strong>
                </div>
                <div>
                  <span className="text-emerald-700/80 font-medium">Source:</span>{' '}
                  <strong className="font-semibold text-emerald-900">
                    {status?.postgres?.urlSource === 'env' ? 'Environment Variable (DATABASE_URL)' : 'Direct Configuration'}
                  </strong>
                </div>
                {maskedUrl && (
                  <div className="col-span-2 truncate font-mono text-[10px] text-emerald-800 bg-emerald-100/60 px-2 py-1 rounded">
                    {maskedUrl}
                  </div>
                )}
              </div>
            )}

            {!isConnected && status?.postgres?.error && (
              <div className="mt-3 pt-3 border-t border-amber-200/60 text-xs">
                <span className="font-bold text-amber-900">Last Error:</span>
                <p className="mt-1 font-mono text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded p-2 break-all">
                  {status.postgres.error}
                </p>
              </div>
            )}
          </div>

          {/* Relational Table Sync Counters */}
          {isConnected && neonCounts && (
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center space-x-1.5">
                  <Table className="w-3.5 h-3.5 text-stone-600" />
                  <span>NeonDB Synchronized Relational Tables</span>
                </span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Live in Neon
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-stone-200 flex items-center space-x-2">
                  <Users className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <span className="text-[10px] text-stone-500 block">users table</span>
                    <span className="font-bold text-stone-900 font-mono">{neonCounts.users} rows</span>
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-stone-200 flex items-center space-x-2">
                  <GraduationCap className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-[10px] text-stone-500 block">students table</span>
                    <span className="font-bold text-stone-900 font-mono">{neonCounts.students} rows</span>
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-stone-200 flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-sky-600 shrink-0" />
                  <div>
                    <span className="text-[10px] text-stone-500 block">departments</span>
                    <span className="font-bold text-stone-900 font-mono">{neonCounts.departments} rows</span>
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-stone-200 flex items-center space-x-2">
                  <UserCheck className="w-4 h-4 text-purple-600 shrink-0" />
                  <div>
                    <span className="text-[10px] text-stone-500 block">staff table</span>
                    <span className="font-bold text-stone-900 font-mono">{neonCounts.staff} rows</span>
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-stone-200 flex items-center space-x-2">
                  <FileCheck className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <span className="text-[10px] text-stone-500 block">no_due_requests</span>
                    <span className="font-bold text-stone-900 font-mono">{neonCounts.noDueRequests} rows</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Feedback notice */}
          {notice && (
            <div className={`p-3 rounded-lg text-xs font-medium ${
              notice.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {notice.text}
            </div>
          )}

          {/* Setup Guidance */}
          <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-950 text-xs space-y-1.5">
            <div className="font-bold flex items-center space-x-1.5 text-sky-900">
              <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" />
              <span>NeonDB & PostgreSQL Setup</span>
            </div>
            <p className="text-stone-700 leading-relaxed">
              NeonDB (<code className="bg-sky-100/70 text-sky-900 px-1 py-0.5 rounded font-mono text-[10px]">ep-....neon.tech</code>) அல்லது Render External URL இணைக்கப்பட்டால்:
            </p>
            <ul className="list-disc list-inside text-stone-600 space-y-1 pl-1">
              <li>
                நீங்கள் புதிதாக சேர்க்கும் மாணவர்கள், staff, மற்றும் clearance விபரங்கள் உடனடியாக <strong>NeonDB</strong>-ல் சேமிக்கப்படும்.
              </li>
              <li>
                இரண்டு விதமான சேமிப்பும் நிகழ்கிறது: (1) Master Snapshot (<code className="font-mono text-[10px]">college_cnd_data</code>) மற்றும் (2) Relational அட்டவணைகள் (<code className="font-mono text-[10px]">users, students, departments, staff, no_due_requests</code>).
              </li>
            </ul>
          </div>

          {/* Direct Connection Input */}
          <div>
            <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5">
              Connect or Change Database Connection String
            </h4>
            <p className="text-xs text-stone-500 mb-3">
              Paste your NeonDB or PostgreSQL connection URL here to immediately test, verify, and synchronize:
            </p>
            <form onSubmit={handleConnect} className="space-y-3">
              <div>
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="postgresql://neondb_owner:npg_xxxx@ep-xxxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
                  className="w-full px-3.5 py-2.5 text-xs font-mono border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                {isConnected ? (
                  <button
                    type="button"
                    onClick={handleSyncNow}
                    disabled={syncing}
                    className="px-3.5 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition flex items-center space-x-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    <span>{syncing ? 'Syncing...' : 'Sync Current Data to NeonDB'}</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-stone-400">
                    Supports NeonDB, Render, Supabase & AWS RDS
                  </span>
                )}

                <button
                  type="submit"
                  disabled={saving || !customUrl.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Connecting & Testing...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Test & Connect Database</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-100 bg-stone-50/50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-stone-700 hover:text-stone-900 bg-stone-200/80 hover:bg-stone-300/80 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
