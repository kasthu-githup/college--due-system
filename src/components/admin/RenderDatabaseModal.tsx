import React, { useState, useEffect } from 'react';
import { Database, CheckCircle2, AlertTriangle, RefreshCw, Server, ArrowRight, ShieldCheck, Copy, ExternalLink, X } from 'lucide-react';
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
  const maskedUrl = status?.postgres?.maskedUrl || '';

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
          text: 'Render PostgreSQL Database connected and verified successfully! Tables initialized and data synchronized.',
        });
        setCustomUrl('');
        fetchStatus();
      } else {
        setNotice({
          type: 'error',
          text: result.error || 'Failed to connect to Render PostgreSQL database. Please verify host and credentials.',
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
          text: 'Current data successfully synchronized to Render PostgreSQL!',
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
                Render Database Connection (PostgreSQL)
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Manage cloud PostgreSQL database persistence for Render deployment
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
                    {isConnected ? 'Render PostgreSQL Database Connected' : 'Running on Local Storage (Render DB Not Connected)'}
                  </h4>
                  <p className="text-xs mt-0.5 opacity-90">
                    {isConnected
                      ? 'All student clearances, records, and staff allocations are safely persisting in Render PostgreSQL.'
                      : 'Data is temporarily stored in local container cache. Connect your Render PostgreSQL database for permanent cloud storage.'}
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
                  <span className="text-emerald-700/80 font-medium">Source:</span>{' '}
                  <strong className="font-semibold text-emerald-900">
                    {status?.postgres?.urlSource === 'env' ? 'Render Environment (DATABASE_URL)' : 'Direct Configuration'}
                  </strong>
                </div>
                <div>
                  <span className="text-emerald-700/80 font-medium">SSL Security:</span>{' '}
                  <strong className="font-semibold text-emerald-900">Enabled (Self-Signed Render Cert)</strong>
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

          {/* Important guidance for Render URL types */}
          <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-950 text-xs space-y-1.5">
            <div className="font-bold flex items-center space-x-1.5 text-sky-900">
              <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" />
              <span>External URL vs Internal URL (Render Database)</span>
            </div>
            <p className="text-stone-700 leading-relaxed">
              Render Database பக்கத்தில் இரண்டு URL-கள் இருக்கும்:
            </p>
            <ul className="list-disc list-inside text-stone-600 space-y-1 pl-1">
              <li>
                <strong className="text-stone-900">External Database URL</strong> (முடிவு <code className="bg-sky-100/70 text-sky-900 px-1 py-0.5 rounded font-mono text-[10px]">.render.com</code>): இங்கிருந்து அல்லது Render-க்கு வெளியில் இருந்து இணைக்க இதை மட்டுமே பயன்படுத்த வேண்டும்!
              </li>
              <li>
                <strong className="text-stone-900">Internal Database URL</strong> (எ.கா. <code className="bg-stone-200 px-1 py-0.5 rounded font-mono text-[10px]">dpg-...:5432</code>): ஒரே Render Region-க்குள் உள்ள Render Web Service-க்கு மட்டுமே வேலை செய்யும்.
              </li>
            </ul>
          </div>

          {/* Setup Instructions for Render */}
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
            <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <Server className="w-3.5 h-3.5 text-stone-600" />
              <span>Render Dashboard-ல் எவ்வாறு அமைப்பது? (2 வழிகள்)</span>
            </h4>
            <div className="space-y-3 text-xs text-stone-600">
              <div>
                <p className="font-semibold text-stone-800">வழி 1: Render-ல் Deploy ஆன Web Service-க்கு (Production):</p>
                <ol className="list-decimal list-inside space-y-1 mt-1 pl-1 leading-relaxed">
                  <li>Render Dashboard &rarr; உங்கள் PostgreSQL &rarr; <strong>External Database URL</strong>-ஐ Copy செய்யவும்.</li>
                  <li>உங்கள் Render Web Service &rarr; <strong>Environment</strong> Tab &rarr; <strong>Add Environment Variable</strong>:</li>
                </ol>
                <div className="my-1.5 flex items-center space-x-2 bg-white px-2.5 py-1.5 rounded-lg border border-stone-200 font-mono text-[11px] text-stone-800">
                  <span className="font-bold text-indigo-600">DATABASE_URL</span>
                  <span className="text-stone-400">=</span>
                  <span className="text-stone-500 truncate">postgresql://user:password@...oregon-postgres.render.com/dbname</span>
                  <button
                    type="button"
                    onClick={handleCopyEnvKey}
                    className="ml-auto text-[10px] font-sans px-2 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded transition shrink-0"
                  >
                    {copied ? 'Copied Key!' : 'Copy Key'}
                  </button>
                </div>
              </div>

              <div>
                <p className="font-semibold text-stone-800">வழி 2: இந்த நேரடி Preview-விலும் உடனடியாக இணைக்க:</p>
                <p className="text-stone-600 mt-0.5">கீழே உள்ள Input Box-ல் உங்கள் <strong>External Database URL</strong>-ஐ Paste செய்து <strong>Connect Database</strong> கொடுக்கவும்.</p>
              </div>
            </div>
          </div>

          {/* Direct Connection Input */}
          <div>
            <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5">
              Or Connect Database Directly Right Now
            </h4>
            <p className="text-xs text-stone-500 mb-3">
              Paste your Render PostgreSQL connection string here to immediately test, verify, and synchronize:
            </p>
            <form onSubmit={handleConnect} className="space-y-3">
              <div>
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="postgresql://user:password@dpg-xxxx-a.oregon-postgres.render.com/dbname"
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
                    <span>{syncing ? 'Syncing...' : 'Sync Current Data to Database'}</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-stone-400">
                    Supports Render Internal & External URLs
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
