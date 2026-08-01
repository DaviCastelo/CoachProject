import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';

/**
 * Gera o PDF do waiver assinado com trilha de auditoria (ESIGN/UETA).
 * Server-only (usa Buffer). O hash SHA-256 é do texto exato exibido/assinado.
 */
export type WaiverPdfInput = {
  title: string;
  body: string;
  signerName: string;
  signerEmail: string;
  relationship: string;
  documentHash: string;
  ip: string | null;
  signedAt: Date;
  signatureType: string;
  signatureDataUrl: string | null;
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 50;
const LINE = 14;

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Uint8Array.from(Buffer.from(base64, 'base64'));
}

export async function buildWaiverPdf(input: WaiverPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const ensure = (needed: number) => {
    if (y - needed < MARGIN) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  const wrap = (text: string, f: PDFFont, size: number): string[] => {
    const maxW = PAGE_W - 2 * MARGIN;
    const out: string[] = [];
    for (const rawLine of text.split('\n')) {
      const words = rawLine.split(/\s+/);
      let cur = '';
      for (const w of words) {
        const trial = cur ? `${cur} ${w}` : w;
        if (cur && f.widthOfTextAtSize(trial, size) > maxW) {
          out.push(cur);
          cur = w;
        } else {
          cur = trial;
        }
      }
      out.push(cur);
    }
    return out;
  };

  const write = (text: string, opts?: { size?: number; f?: PDFFont; gap?: number }) => {
    const size = opts?.size ?? 10;
    const f = opts?.f ?? font;
    for (const line of wrap(text, f, size)) {
      ensure(LINE);
      page.drawText(line, { x: MARGIN, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
      y -= LINE;
    }
    if (opts?.gap) y -= opts.gap;
  };

  write(input.title, { size: 16, f: bold, gap: 6 });
  write(input.body, { size: 10, gap: 12 });

  write('Signature', { size: 11, f: bold, gap: 2 });
  if (input.signatureType === 'drawn' && input.signatureDataUrl?.startsWith('data:image/png')) {
    try {
      const png = await pdf.embedPng(dataUrlToBytes(input.signatureDataUrl));
      const w = 200;
      const h = (png.height / png.width) * w;
      ensure(h + 6);
      page.drawImage(png, { x: MARGIN, y: y - h, width: w, height: h });
      y -= h + 8;
    } catch {
      write(`/s/ ${input.signerName}`, { size: 12, f: bold, gap: 4 });
    }
  } else {
    write(`/s/ ${input.signerName}`, { size: 12, f: bold, gap: 4 });
  }

  write('Audit trail (ESIGN/UETA)', { size: 11, f: bold, gap: 2 });
  write(`Signer: ${input.signerName} (${input.relationship})`, { size: 9 });
  write(`Email: ${input.signerEmail}`, { size: 9 });
  write(`Signed at: ${input.signedAt.toISOString()}`, { size: 9 });
  write(`IP address: ${input.ip ?? 'unknown'}`, { size: 9 });
  write(`Document SHA-256: ${input.documentHash}`, { size: 9 });

  return pdf.save();
}
