import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle, Info } from 'lucide-react';

export function ConfirmDialog({
  isOpen,
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'danger', // 'danger' | 'warning' | 'primary'
  onConfirm,
  onCancel,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} maxWidth="max-w-md">
      <div className="flex items-start gap-4">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            confirmVariant === 'danger'
              ? 'bg-rose-100 text-rose-600'
              : confirmVariant === 'warning'
              ? 'bg-amber-100 text-amber-600'
              : 'bg-brand-100 text-brand-600'
          }`}
        >
          {confirmVariant === 'danger' || confirmVariant === 'warning' ? (
            <AlertTriangle className="w-5 h-5" />
          ) : (
            <Info className="w-5 h-5" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
        <Button variant="secondary" size="md" onClick={onCancel}>
          {cancelText}
        </Button>
        <Button variant={confirmVariant} size="md" onClick={onConfirm}>
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}
