import React, { createContext, useContext, useState, useCallback } from 'react';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotification = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    const newNotification = { id, message, type, duration };

    setNotifications((prev) => [...prev.slice(-4), newNotification]); // Keep max 5

    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }
    return id;
  }, [removeNotification]);

  const success = useCallback((msg, duration) => addNotification(msg, 'success', duration), [addNotification]);
  const error = useCallback((msg, duration) => addNotification(msg, 'error', duration || 5000), [addNotification]);
  const warning = useCallback((msg, duration) => addNotification(msg, 'warning', duration), [addNotification]);
  const info = useCallback((msg, duration) => addNotification(msg, 'info', duration), [addNotification]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        success,
        error,
        warning,
        info,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    // Fallback stub if context not mounted
    return {
      success: (msg) => console.log('[Success]', msg),
      error: (msg) => console.error('[Error]', msg),
      warning: (msg) => console.warn('[Warning]', msg),
      info: (msg) => console.log('[Info]', msg),
      removeNotification: () => {},
    };
  }
  return context;
}
