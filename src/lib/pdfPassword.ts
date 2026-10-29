// Abre PDFs protegidos por senha. A senha só é usada no navegador e nunca é salva.
type Requester = (opts: { fileLabel?: string; wrong: boolean }) => Promise<string | null>;

let lastPassword: string | undefined;
let requester: Requester | null = null;
export const setPdfPasswordRequester = (r: Requester | null) => { requester = r; };

export class PdfPasswordCancelled extends Error {
  constructor() { super('Importação cancelada: o PDF tem senha e ela não foi informada.'); }
}

/** Abre o documento; se pedir senha, pergunta ao usuário até acertar ou cancelar. */
export async function openPdfDocument(pdfjsLib: any, data: ArrayBuffer, fileLabel?: string): Promise<any> {
  // Tenta antes a última senha aceita (o mesmo arquivo pode ser aberto duas vezes na leitura).
  let password: string | undefined;
  let triedLast = false;
  let wrong = false;
  for (;;) {
    try {
      const doc = await pdfjsLib.getDocument({ data: data.slice(0), ...(password !== undefined ? { password } : {}) }).promise;
      if (password !== undefined) lastPassword = password;
      return doc;
    } catch (e: any) {
      if (e?.name !== 'PasswordException') throw e;
      if (!triedLast && lastPassword) { triedLast = true; password = lastPassword; continue; }
      wrong = e.code === 2 && password !== undefined && password !== lastPassword;
      if (!requester) throw new Error('Este PDF tem senha. Abra-o, salve uma cópia sem senha e envie de novo.');
      const p = await requester({ fileLabel, wrong });
      if (p === null) throw new PdfPasswordCancelled();
      password = p;
    }
  }
}
