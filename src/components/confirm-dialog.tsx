'use client';

import { AlertTriangle, X } from 'lucide-react';

type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isDangerous = false,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const handleConfirmClick = async () => {
    try {
      await onConfirm();
    } catch (error) {
      console.error('Confirm action failed:', error);
    }
  };

  return (
    <div className="z-50 fixed inset-0 flex justify-center items-center bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-950 shadow-2xl mx-4 border border-slate-700 rounded-lg w-full max-w-sm">
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-slate-800 border-b">
          <div className="flex items-center gap-3">
            {isDangerous && <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />}
            <h2 className="font-semibold text-white text-lg">{title}</h2>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {description && (
          <div className="px-6 py-4">
            <p className="text-slate-300 text-sm">{description}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-slate-800 border-t">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="hover:bg-slate-900 disabled:opacity-50 px-4 py-2 border border-slate-700 rounded-lg font-medium text-slate-200 text-sm transition-colors disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirmClick}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isDangerous
                ? 'bg-orange-600 hover:bg-orange-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block border-2 border-white border-t-transparent rounded-full w-4 h-4 animate-spin" />
                {confirmText}
              </span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
