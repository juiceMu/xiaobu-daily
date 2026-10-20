type ModalityTarget = Pick<
  EventTarget,
  'addEventListener' | 'removeEventListener'
>;

export function createKeyboardModality(getTarget: () => ModalityTarget | null) {
  let keyboard = true;
  let target: ModalityTarget | null = null;
  const listeners = new Set<() => void>();
  const capture = { capture: true };
  function update(next: boolean) {
    if (keyboard === next) return;
    keyboard = next;
    for (const listener of listeners) listener();
  }
  const onKeyboard = (event: Event) => {
    const key = event as KeyboardEvent;
    if (!key.altKey && !key.ctrlKey && !key.metaKey) update(true);
  };
  const onPointer = () => update(false);
  const handlers = [
    ['keydown', onKeyboard],
    ['pointerdown', onPointer],
    ['mousedown', onPointer],
    ['touchstart', onPointer],
  ] as const;
  return {
    getSnapshot: () => keyboard,
    getServerSnapshot: () => false,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) {
        target = getTarget();
        for (const [name, handler] of handlers)
          target?.addEventListener(name, handler, capture);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          for (const [name, handler] of handlers)
            target?.removeEventListener(name, handler, capture);
          target = null;
        }
      };
    },
  };
}
