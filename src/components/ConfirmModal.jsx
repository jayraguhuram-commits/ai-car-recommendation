import { useState } from 'react';
import './ConfirmModal.css';

let resolveCallback;

/**
 * Global confirm modal hook + component.
 * Usage:
 *   const confirm = useConfirm();
 *   const ok = await confirm({ title: '...', message: '...', danger: true });
 */
export function useConfirm() {
  return window.__showConfirmModal || (() => Promise.resolve(window.confirm('Are you sure?')));
}

export default function ConfirmModal() {
  const [state, setState] = useState({
    open: false,
    title: 'Are you sure?',
    message: '',
    danger: false,
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
  });

  // Attach to window so any component can call it
  if (typeof window !== 'undefined') {
    window.__showConfirmModal = ({ title, message, danger, confirmLabel, cancelLabel }) => {
      return new Promise((resolve) => {
        setState({
          open: true,
          title: title || 'Are you sure?',
          message: message || '',
          danger: danger !== false,
          confirmLabel: confirmLabel || 'Confirm',
          cancelLabel: cancelLabel || 'Cancel',
        });
        resolveCallback = resolve;
      });
    };
  }

  const handleConfirm = () => {
    setState((s) => ({ ...s, open: false }));
    resolveCallback && resolveCallback(true);
  };

  const handleCancel = () => {
    setState((s) => ({ ...s, open: false }));
    resolveCallback && resolveCallback(false);
  };

  if (!state.open) return null;

  return (
    <div className="confirm-overlay" onClick={handleCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-icon">{state.danger ? '⚠️' : '❓'}</div>
        <h3 className="confirm-title">{state.title}</h3>
        {state.message && <p className="confirm-message">{state.message}</p>}
        <div className="confirm-actions">
          <button className="btn-secondary" onClick={handleCancel}>
            {state.cancelLabel}
          </button>
          <button
            className={`btn-primary ${state.danger ? 'btn-danger' : ''}`}
            onClick={handleConfirm}
          >
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
