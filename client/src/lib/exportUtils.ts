import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Export an array of objects to CSV and trigger download
 */
export function exportToCsv(
  filename: string,
  data: Record<string, unknown>[],
  columns?: { key: string; label: string }[]
) {
  if (data.length === 0) return;

  const keys = columns ? columns.map((c) => c.key) : Object.keys(data[0]);
  const headers = columns ? columns.map((c) => c.label) : keys;

  const csvRows = [
    headers.join(','),
    ...data.map((row) =>
      keys
        .map((key) => {
          const val = row[key];
          const str = val === null || val === undefined ? '' : String(val);
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(',')
    ),
  ];

  const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

/**
 * Export a DOM element as a PDF report
 */
export async function exportToPdf(elementId: string, filename: string, title?: string) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: getComputedStyle(document.documentElement)
      .getPropertyValue('--background')
      .trim()
      ? '#ffffff'
      : '#ffffff',
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const usableWidth = pageWidth - 2 * margin;

  // Add title
  if (title) {
    pdf.setFontSize(16);
    pdf.text(title, margin, margin + 5);
    pdf.setFontSize(10);
    pdf.text(new Date().toLocaleDateString(), margin, margin + 12);
  }

  const titleOffset = title ? 18 : 0;
  const usableHeight = pageHeight - 2 * margin - titleOffset;

  const imgWidth = usableWidth;
  const imgHeight = (canvas.height * usableWidth) / canvas.width;

  if (imgHeight <= usableHeight) {
    pdf.addImage(imgData, 'PNG', margin, margin + titleOffset, imgWidth, imgHeight);
  } else {
    // Multi-page: slice the canvas
    const pageCanvasHeight = (usableHeight / imgWidth) * canvas.width;
    let yOffset = 0;
    let isFirstPage = true;

    while (yOffset < canvas.height) {
      if (!isFirstPage) {
        pdf.addPage();
      }

      const sliceHeight = Math.min(pageCanvasHeight, canvas.height - yOffset);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceHeight;
      const ctx = sliceCanvas.getContext('2d')!;
      ctx.drawImage(canvas, 0, yOffset, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

      const sliceData = sliceCanvas.toDataURL('image/png');
      const sliceImgHeight = (sliceHeight * imgWidth) / canvas.width;

      pdf.addImage(
        sliceData,
        'PNG',
        margin,
        margin + (isFirstPage ? titleOffset : 0),
        imgWidth,
        sliceImgHeight
      );

      yOffset += sliceHeight;
      isFirstPage = false;
    }
  }

  pdf.save(filename);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
