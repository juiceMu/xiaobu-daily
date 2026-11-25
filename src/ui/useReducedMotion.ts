import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
      const update = () => setReduced(preference.matches);
      update();
      preference.addEventListener('change', update);
      return () => preference.removeEventListener('change', update);
    }
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (enabled) => {
        if (active) setReduced(enabled);
      },
      () => undefined,
    );
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduced,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
