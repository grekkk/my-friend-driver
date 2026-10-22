import { useCallback, useEffect, useRef, useState } from "react";
import { STORAGE_KEY, type AppData } from "./model";
import { loadData, persistData, type LoadedData } from "./storage";

function initial(): LoadedData {
  try {
    return loadData(window.localStorage);
  } catch {
    return loadData({
      getItem() {
        throw new Error();
      },
      setItem() {
        throw new Error();
      },
    });
  }
}
export function useStore() {
  const [state, setState] = useState(initial);
  const current = useRef(state);
  const replace = useCallback((next: LoadedData) => {
    current.current = next;
    setState(next);
  }, []);
  useEffect(() => {
    const listener = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) replace(initial());
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, [replace]);
  const commit = useCallback(
    (update: (data: AppData) => AppData, recovery = false) => {
      if (current.current.error && !recovery)
        throw new Error(
          "Najpierw odzyskaj zapisane dane lub potwierdź ich usunięcie w Ustawieniach.",
        );
      const next = update(current.current.data);
      const raw = persistData(window.localStorage, next, current.current.raw);
      replace({ data: next, raw, error: null });
    },
    [replace],
  );
  return { ...state, commit };
}
