import { jsPDF } from 'jspdf'

function safeFilename(value: string) {
  return value.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'interview-report'
}

/** Render a report panel to a downloadable, paginated PDF without invoking the browser print UI. */
export async function downloadPdf(root: HTMLElement, title: string) {
  const excluded = Array.from(root.querySelectorAll<HTMLElement>('[data-pdf-exclude]'))
  const previousDisplays = excluded.map((element) => element.style.display)
  const documentTitles = Array.from(root.querySelectorAll<HTMLElement>('.print-document-title'))
  const previousTitleDisplays = documentTitles.map((element) => element.style.display)
  excluded.forEach((element) => { element.style.display = 'none' })
  documentTitles.forEach((element) => { element.style.display = 'block' })

  try {
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true })
    await pdf.html(root, {
      autoPaging: 'text',
      margin: [12, 12, 12, 12],
      width: 186,
      windowWidth: Math.max(root.scrollWidth, 1024),
      html2canvas: { backgroundColor: '#ffffff', scale: 0.85, useCORS: true, logging: false },
    })
    pdf.save(`${safeFilename(title)}.pdf`)
  } finally {
    excluded.forEach((element, index) => { element.style.display = previousDisplays[index] })
    documentTitles.forEach((element, index) => { element.style.display = previousTitleDisplays[index] })
  }
}
