import React from 'react';
import { AlertTriangle, Trash2, X, RefreshCw } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  isDestructive = true,
  isLoading = false,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-xl max-w-md w-full border border-stone-200 shadow-2xl p-6 relative animate-in zoom-in-95 duration-150"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start space-x-3.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isDestructive ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
            }`}
          >
            {isDestructive ? <Trash2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div className="flex-1 pr-4">
            <h3 className="text-base font-bold text-stone-900 leading-snug">{title}</h3>
            <p className="mt-1.5 text-xs text-stone-600 leading-relaxed whitespace-pre-line">{message}</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end space-x-2 pt-4 border-t border-stone-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-3.5 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200/80 rounded-lg transition disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-xs font-bold text-white rounded-lg transition flex items-center space-x-1.5 shadow-xs ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:bg-rose-400'
                : 'bg-stone-900 hover:bg-stone-800 active:bg-stone-950 disabled:bg-stone-500'
            }`}
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>{confirmText}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
