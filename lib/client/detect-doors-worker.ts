import type { detectDoorsFromAlignedRaster, DetectedDoor } from "./detect-doors";
export function detectDoorsInWorker(args: Parameters<typeof detectDoorsFromAlignedRaster>[0], signal: AbortSignal): Promise<DetectedDoor[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./door-worker.ts", import.meta.url));
    const cleanup = () => { worker.terminate(); clearTimeout(timer); signal.removeEventListener("abort", abort); };
    const abort = () => { cleanup(); reject(new Error("cancelled")); };
    const timer = setTimeout(() => { cleanup(); reject(new Error("استغرق اقتراح الأبواب وقتًا طويلًا. يمكنك إضافتها على المخطط.")); }, 60000);
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = event => { cleanup(); event.data.error ? reject(new Error(event.data.error)) : resolve(event.data.doors); };
    worker.onerror = () => { cleanup(); reject(new Error("تعذر استكمال اقتراح الأبواب. يمكنك إضافتها على المخطط.")); };
    if (signal.aborted) return abort();
    worker.postMessage(args);
  });
}
