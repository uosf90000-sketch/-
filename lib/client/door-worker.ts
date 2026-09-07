import { detectDoorsFromAlignedRaster } from "./detect-doors";
self.onmessage = (event: MessageEvent) => {
  try { self.postMessage({ doors: detectDoorsFromAlignedRaster(event.data) }); }
  catch { self.postMessage({ error: "تعذر استكمال اقتراح الأبواب. يمكنك إضافتها على المخطط." }); }
};
