import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, type LayoutChangeEvent } from 'react-native';

/** Avoid rebuilding gestures and hero geometry at every keyboard resize frame. */
export function useSettledHeight(initial: number) {
  const [height, setHeight] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const measure = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    if (next <= 0) return;
    if (timer.current) clearTimeout(timer.current);
    const apply = () => setHeight(previous => Math.abs(previous - next) > 1 ? next : previous);
    if (Platform.OS === 'web') apply();
    else timer.current = setTimeout(apply, 90);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return [height, measure] as const;
}
