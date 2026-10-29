// Abre PDFs protegidos por senha. A senha só é usada no navegador e nunca é salva.
type Requester = (opts: { fileLabel?: string; wrong: boolean }) => Promise<string | null>;

let requester: Requester | null = null;
export const setPdfPasswordRequester = (r: Requester | null) => { requester = r; };

export class PdfPasswordCancelled extends Error {
  constructor() { super('Importação cancelada: o PDF tem senha e ela não foi informada.'); }
}

/** Abre o documento; se pedir senha, pergunta ao usuário até acertar ou cancelar. */
export async function openPdfDocument(pdfjsLib: any, data: ArrayBuffer, fileLabel?: string): Promise<any> {
  let password: string | undefined;
  let wrong = false;
  for (;;) {
    try {
      return await pdfjsLib.getDocument({ data: data.slice(0), ...(password !== undefined ? { password } : {}) }).promise;
    } catch (e: any) {
      if (e?.name !== 'PasswordException') throw e;
      wrong = e.code === 2 || password !== undefined;
      if (!requester) throw new Error('Este PDF tem senha. Abra-o, salve uma cópia sem senha e envie de novo.');
      const p = await requester({ fileLabel, wrong });
      if (p === null) throw new PdfPasswordCancelled();
      password = p;
    }
  }
}
