import { useState, useCallback, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';

export function useApiRequest(options = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(options.initialData ?? null);
  const { error: notifyError } = useNotification();

  const execute = useCallback(
    async (apiFn, ...args) => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiFn(...args);
        setData(result);
        if (options.onSuccess) {
          options.onSuccess(result);
        }
        return result;
      } catch (err) {
        const errMsg = err.message || 'An error occurred';
        setError(errMsg);
        if (options.showErrorNotification !== false) {
          notifyError(errMsg);
        }
        if (options.onError) {
          options.onError(err);
        }
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [notifyError, options]
  );

  return { loading, error, data, setData, execute };
}

export function useApiData(apiFn, args = [], options = {}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(options.initialData ?? null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFn(...args);
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [apiFn, JSON.stringify(args)]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { loading, error, data, setData, refetch: fetchData };
}
