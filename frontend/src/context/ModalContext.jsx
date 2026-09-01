import React, { createContext, useState, useCallback } from 'react';
import { RestaurantDetailsModal } from '../components/restaurants/RestaurantDetailsModal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

export const ModalContext = createContext(null);

export function ModalProvider({ children }) {
  const [detailsPlaceId, setDetailsPlaceId] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  const openDetailsModal = useCallback((placeId) => {
    setDetailsPlaceId(placeId);
  }, []);

  const closeDetailsModal = useCallback(() => {
    setDetailsPlaceId(null);
  }, []);

  const confirmModal = useCallback(({
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmVariant = 'danger',
  }) => {
    return new Promise((resolve) => {
      setConfirmState({
        title,
        message,
        confirmText,
        cancelText,
        confirmVariant,
        onConfirm: () => {
          setConfirmState(null);
          resolve(true);
        },
        onCancel: () => {
          setConfirmState(null);
          resolve(false);
        },
      });
    });
  }, []);

  return (
    <ModalContext.Provider
      value={{
        openDetailsModal,
        closeDetailsModal,
        confirmModal,
      }}
    >
      {children}
      {detailsPlaceId && (
        <RestaurantDetailsModal
          placeId={detailsPlaceId}
          onClose={closeDetailsModal}
        />
      )}
      {confirmState && (
        <ConfirmDialog
          isOpen={true}
          title={confirmState.title}
          message={confirmState.message}
          confirmText={confirmState.confirmText}
          cancelText={confirmState.cancelText}
          confirmVariant={confirmState.confirmVariant}
          onConfirm={confirmState.onConfirm}
          onCancel={confirmState.onCancel}
        />
      )}
    </ModalContext.Provider>
  );
}
