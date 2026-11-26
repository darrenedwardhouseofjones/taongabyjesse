import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { CertificateRecord, SiteSettings } from '../types';

function toPdfSafeText(input: string): string {
  return input
    .replace(/[āĀ]/g, (m) => (m === 'Ā' ? 'A' : 'a'))
    .replace(/[ēĒ]/g, (m) => (m === 'Ē' ? 'E' : 'e'))
    .replace(/[īĪ]/g, (m) => (m === 'Ī' ? 'I' : 'i'))
    .replace(/[ōŌ]/g, (m) => (m === 'Ō' ? 'O' : 'o'))
    .replace(/[ūŪ]/g, (m) => (m === 'Ū' ? 'U' : 'u'))
    .replace(/[–—]/g, '-')
    .replace(/[×]/g, 'x')
    .replace(/·/g, '|')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

function drawCropMarks(doc: jsPDF, x: number, y: number, w: number, h: number) {
  const offset = 2.5;
  const len = 4;
  doc.setDrawColor(165, 165, 165);
  doc.setLineWidth(0.2);

  // Top-left
  doc.line(x - offset - len, y, x - offset, y);
  doc.line(x, y - offset - len, x, y - offset);
  // Top-right
  doc.line(x + w + offset, y, x + w + offset + len, y);
  doc.line(x + w, y - offset - len, x + w, y - offset);
  // Bottom-left
  doc.line(x - offset - len, y + h, x - offset, y + h);
  doc.line(x, y + h + offset, x, y + h + offset + len);
  // Bottom-right
  doc.line(x + w + offset, y + h, x + w + offset + len, y + h);
  doc.line(x + w, y + h + offset, x + w, y + h + offset + len);
}

function resolveVerifyOrigin(settings: SiteSettings): string {
  if (settings.canonicalUrl && /^https?:\/\//i.test(settings.canonicalUrl.trim())) {
    return settings.canonicalUrl.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }
  return 'https://taongabyjesse.co.nz';
}

/**
 * Generates a print-ready double-sided 90mm x 55mm business-card PDF
 * (Front + matching Back centered on A4 for cardstock duplex printing & trimming).
 */
export async function generateCertificatePdf(
  certificates: CertificateRecord[],
  settings: SiteSettings,
  orderNumber?: string
): Promise<void> {
  if (!certificates || certificates.length === 0) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const cardW = 90;
  const cardH = 55;
  const cardX = (pageWidth - cardW) / 2; // 60mm centered
  const cardY = 32; // Identical X/Y on front and back pages for duplex flip alignment
  const verifyOrigin = resolveVerifyOrigin(settings);

  for (let idx = 0; idx < certificates.length; idx++) {
    const cert = certificates[idx];
    if (idx > 0) {
      doc.addPage();
    }

    const issuedStr = new Date(cert.issuedAt).toLocaleDateString('en-NZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    const verifyUrl = `${verifyOrigin}/?tab=provenance&cert=${encodeURIComponent(
      cert.certificateNumber
    )}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 240,
      color: {
        dark: '#1B382B',
        light: '#FAF9F6',
      },
    });

    // =====================
    // FRONT OF CARD (Page 1, 3, ...)
    // =====================
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(110, 120, 114);
    doc.text(
      toPdfSafeText(
        `TAONGA BY JESSE | CERTIFICATE ${idx + 1} OF ${certificates.length} - FRONT (90 x 55 mm)`
      ),
      pageWidth / 2,
      18,
      { align: 'center' }
    );

    drawCropMarks(doc, cardX, cardY, cardW, cardH);

    // Card Background (Deep Pounamu Green)
    doc.setFillColor(27, 56, 43);
    doc.rect(cardX, cardY, cardW, cardH, 'F');

    // Inner Gold Border
    doc.setDrawColor(194, 155, 56);
    doc.setLineWidth(0.35);
    doc.rect(cardX + 2.2, cardY + 2.2, cardW - 4.4, cardH - 4.4, 'S');

    // Brand Title
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('TAONGA BY JESSE', cardX + cardW / 2, cardY + 8.5, { align: 'center' });

    doc.setTextColor(194, 155, 56);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.text('CERTIFICATE OF AUTHENTICITY & PROVENANCE', cardX + cardW / 2, cardY + 12.2, {
      align: 'center',
    });

    doc.setDrawColor(194, 155, 56);
    doc.setLineWidth(0.2);
    doc.line(cardX + 12, cardY + 14.2, cardX + cardW - 12, cardY + 14.2);

    // Piece Details
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    const titleLines = doc.splitTextToSize(toPdfSafeText(cert.title), cardW - 12) as string[];
    doc.text(titleLines.slice(0, 2), cardX + cardW / 2, cardY + 19.5, { align: 'center' });

    const afterTitleY = titleLines.length > 1 ? cardY + 27 : cardY + 24.5;
    doc.setTextColor(218, 232, 224);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    const materialLine = [
      `${cert.material} Pounamu`,
      cert.designType ? cert.designType : '',
      cert.dimensions ? cert.dimensions : '',
    ]
      .filter(Boolean)
      .join(' | ');
    doc.text(toPdfSafeText(materialLine), cardX + cardW / 2, afterTitleY, { align: 'center' });

    doc.text(
      toPdfSafeText(`Origin: ${cert.originRiver} | Carver: ${cert.carverName} (Napier, NZ)`),
      cardX + cardW / 2,
      afterTitleY + 4.2,
      { align: 'center' }
    );

    if (cert.permitRef) {
      doc.setTextColor(194, 155, 56);
      doc.setFontSize(6);
      doc.text(toPdfSafeText(`DOC Permit: ${cert.permitRef}`), cardX + cardW / 2, afterTitleY + 8.2, {
        align: 'center',
      });
    }

    // Bottom Strip on Front
    doc.setFillColor(18, 36, 27);
    doc.rect(cardX + 2.4, cardY + cardH - 11.5, cardW - 4.8, 9.1, 'F');

    doc.setFont('courier', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(240, 212, 134);
    doc.text(toPdfSafeText(`CERT #: ${cert.certificateNumber}`), cardX + 5, cardY + cardH - 6.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(200, 220, 210);
    doc.text(
      toPdfSafeText(`Ngai Tahu Ref: ${cert.authenticityCode}`),
      cardX + cardW - 5,
      cardY + cardH - 6.8,
      { align: 'right' }
    );
    doc.text(
      toPdfSafeText(`Order ${cert.orderNumber} | Issued ${issuedStr}`),
      cardX + cardW / 2,
      cardY + cardH - 3.6,
      { align: 'center' }
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 130, 124);
    doc.text(
      'Print double-sided on cardstock (Flip on Long Edge) and trim along the corner crop marks.',
      pageWidth / 2,
      cardY + cardH + 14,
      { align: 'center' }
    );

    // =====================
    // BACK OF CARD (Page 2, 4, ...)
    // =====================
    doc.addPage();

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(110, 120, 114);
    doc.text(
      toPdfSafeText(
        `TAONGA BY JESSE | CERTIFICATE ${idx + 1} OF ${certificates.length} - BACK (90 x 55 mm)`
      ),
      pageWidth / 2,
      18,
      { align: 'center' }
    );

    drawCropMarks(doc, cardX, cardY, cardW, cardH);

    // Warm Parchment Background
    doc.setFillColor(250, 249, 246);
    doc.rect(cardX, cardY, cardW, cardH, 'F');

    // Outer & Inner Borders
    doc.setDrawColor(27, 56, 43);
    doc.setLineWidth(0.45);
    doc.rect(cardX + 2.2, cardY + 2.2, cardW - 4.4, cardH - 4.4, 'S');
    doc.setDrawColor(194, 155, 56);
    doc.setLineWidth(0.2);
    doc.rect(cardX + 3.1, cardY + 3.1, cardW - 6.2, cardH - 6.2, 'S');

    // QR Code on Left
    const qrSize = 27;
    const qrX = cardX + 5.5;
    const qrY = cardY + 10.5;
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(27, 56, 43);
    doc.text('SCAN TO VERIFY', qrX + qrSize / 2, qrY + qrSize + 3.5, { align: 'center' });

    // Verification Instructions on Right
    const rightX = cardX + 36;
    const rightW = cardW - 41;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(27, 56, 43);
    doc.text('TAONGA BY JESSE', rightX, cardY + 9.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.7);
    doc.setTextColor(140, 109, 31);
    doc.text('AUTHENTICITY & PHOTO REGISTRY', rightX, cardY + 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(65, 78, 70);
    const steps = doc.splitTextToSize(
      '1. Scan QR code or visit our Provenance page and search your Certificate #.\n' +
        '2. Compare your carving with the original studio photograph on file.\n' +
        '3. Enter the original buyer name or email to confirm collector ownership.',
      rightW
    ) as string[];
    doc.text(steps, rightX, cardY + 17.5);

    // Reference Box on Bottom-Right
    doc.setFillColor(240, 244, 241);
    doc.setDrawColor(210, 220, 214);
    doc.setLineWidth(0.2);
    doc.rect(rightX, cardY + 34.5, rightW, 11.5, 'FD');

    doc.setFont('courier', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(27, 56, 43);
    doc.text(toPdfSafeText(`Cert #: ${cert.certificateNumber}`), rightX + 2, cardY + 39);
    doc.setFont('courier', 'normal');
    doc.setFontSize(5.8);
    doc.text(toPdfSafeText(`Serial: ${cert.authenticityCode}`), rightX + 2, cardY + 43.2);

    // Bottom Domain Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.1);
    doc.setTextColor(95, 108, 100);
    doc.text(
      toPdfSafeText(`${verifyOrigin.replace(/^https?:\/\//, '')} | Hand-Carved in Napier, NZ`),
      cardX + cardW / 2,
      cardY + cardH - 4.6,
      { align: 'center' }
    );
  }

  const fileSuffix = orderNumber || certificates[0].orderNumber || certificates[0].certificateNumber;
  doc.save(`Certificates-${fileSuffix}.pdf`);
}
