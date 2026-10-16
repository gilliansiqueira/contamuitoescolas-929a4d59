import { slimXlsxChunks } from './slimXlsx';

// Lê o modelo fora da tela principal: a aba não congela e o arquivo é lido aos poucos.
self.onmessage = async (e: MessageEvent<File>) => {
  try {
    const reader = e.data.stream().getReader();
    const out = await slimXlsxChunks((async function* () {
      while (true) { const { done, value } = await reader.read(); if (done) return; yield value; }
    })());
    (self as any).postMessage({ ok: true, buf: out }, [out]);
  } catch (err: any) {
    (self as any).postMessage({ ok: false, error: err?.message ?? String(err) });
  }
};
