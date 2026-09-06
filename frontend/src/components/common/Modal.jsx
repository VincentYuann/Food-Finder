import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-xl',
  showCloseButton = true,
  headerless = false,
  ariaLabel,
}) {
  const modalRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement;

    // Prevent background scrolling while modal is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableSelectors =
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
        const focusables = Array.from(modalRef.current.querySelectorAll(focusableSelectors));
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Initial focus on first interactive element
    if (modalRef.current) {
      const firstInteractive = modalRef.current.querySelector('button, [href], input');
      if (firstInteractive) firstInteractive.focus();
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      if (previouslyFocusedRef.current?.focus) {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const ariaAttributes = title
    ? { 'aria-labelledby': 'modal-title' }
    : { 'aria-label': ariaLabel || 'Dialog' };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/60 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      {...ariaAttributes}
    >
      <div
        ref={modalRef}
        className={`relative w-full ${maxWidth} bg-white rounded-3xl shadow-modal border border-slate-200/80 overflow-hidden transform transition-all duration-200 my-auto`}
      >
        {/* Floating Close Button for Headerless / Hero Modals */}
        {headerless && showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full flex items-center justify-center bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 shadow-md active:scale-95"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Standard Header */}
        {!headerless && (title || showCloseButton) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            {title ? (
              <h3 id="modal-title" className="text-lg font-heading font-bold text-slate-900 tracking-tight">
                {title}
              </h3>
            ) : <div />}
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-tomato"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className={headerless ? 'p-0' : 'p-6'}>{children}</div>
      </div>
    </div>,
    document.body
  );
}
