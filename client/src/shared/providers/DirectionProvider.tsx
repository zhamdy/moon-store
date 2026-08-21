import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';

export type Direction = 'ltr' | 'rtl';

export interface DirectionContextValue {
  direction: Direction;
  isRtl: boolean;
  setDirection: (direction: Direction) => void;
  toggleDirection: () => void;
}

const DirectionContext = createContext<DirectionContextValue | null>(null);

export interface DirectionProviderProps {
  children: ReactNode;
  defaultDirection?: Direction;
  storageKey?: string;
}

export function DirectionProvider({
  children,
  defaultDirection = 'ltr',
  storageKey = 'moon-store-direction',
}: DirectionProviderProps): React.JSX.Element {
  const [direction, setDirectionState] = useState<Direction>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey) as Direction | null;
      if (stored === 'ltr' || stored === 'rtl') {
        return stored;
      }
      const htmlDir = document.documentElement.getAttribute('dir') as Direction | null;
      if (htmlDir === 'ltr' || htmlDir === 'rtl') {
        return htmlDir;
      }
    }
    return defaultDirection;
  });

  const setDirection = useCallback(
    (newDir: Direction) => {
      setDirectionState(newDir);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(storageKey, newDir);
        } catch {
          // Ignore localStorage errors
        }
        document.documentElement.setAttribute('dir', newDir);
      }
    },
    [storageKey]
  );

  const toggleDirection = useCallback(() => {
    setDirectionState((prev) => {
      const next = prev === 'rtl' ? 'ltr' : 'rtl';
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(storageKey, next);
        } catch {
          // Ignore localStorage errors
        }
        document.documentElement.setAttribute('dir', next);
      }
      return next;
    });
  }, [storageKey]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.setAttribute('dir', direction);
    }
  }, [direction]);

  const value = useMemo<DirectionContextValue>(
    () => ({
      direction,
      isRtl: direction === 'rtl',
      setDirection,
      toggleDirection,
    }),
    [direction, setDirection, toggleDirection]
  );

  return <DirectionContext.Provider value={value}>{children}</DirectionContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDirection(): DirectionContextValue {
  const context = useContext(DirectionContext);
  if (!context) {
    return {
      direction: 'ltr',
      isRtl: false,
      setDirection: () => {},
      toggleDirection: () => {},
    };
  }
  return context;
}
