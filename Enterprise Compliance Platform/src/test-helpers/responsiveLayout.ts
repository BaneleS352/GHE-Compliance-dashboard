/** Install a predictable layout and ResizeObserver callback for jsdom tests. */
export function setupResponsiveLayout(width: number, height: number): void {
  class TestResizeObserver implements ResizeObserver {
    constructor(private readonly callback: ResizeObserverCallback) {}

    observe(target: Element): void {
      const rect = new DOMRectReadOnly(0, 0, width, height);
      const size: ResizeObserverSize = { inlineSize: width, blockSize: height };
      const entry: ResizeObserverEntry = {
        target,
        contentRect: rect,
        borderBoxSize: [size],
        contentBoxSize: [size],
        devicePixelContentBoxSize: [size],
      };
      this.callback([entry], this);
    }

    unobserve(): void {}
    disconnect(): void {}
  }

  globalThis.ResizeObserver = TestResizeObserver;
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, value: width });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, value: height });
}
