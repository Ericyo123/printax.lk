export async function generateQuotationPDF(quotation: any, settings?: any) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF()

  // Logo helper
  const getBase64 = (url: string) => {
    return new Promise<{ url: string; width: number; height: number } | null>((resolve) => {
      const img = new Image()
      img.crossOrigin = 'Anonymous'
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext('2d')
          if (!ctx) return resolve(null)
          ctx.drawImage(img, 0, 0)
          resolve({ url: canvas.toDataURL('image/png'), width: img.width, height: img.height })
        } catch {
          resolve(null)
        }
      }
      img.onerror = () => resolve(null)
      img.src = url
    })
  }

  const [logoData, appSettings] = await Promise.all([
    getBase64('/logo.png'),
    settings ? Promise.resolve(settings) : fetch('/api/settings').then(r => r.json()).catch(() => ({}))
  ])

  const primaryColor = [21, 94, 150]
  const darkText = [30, 30, 30]
  const greyText = [100, 100, 100]

  // Header: Document Title
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.setFontSize(26)
  doc.setFont('helvetica', 'bold')
  doc.text('QUOTATION', 14, 25)

  // Logo on Top Right
  if (logoData) {
    const aspect = logoData.width / logoData.height
    let logoHeight = 22
    let logoWidth = logoHeight * aspect
    if (logoWidth > 55) logoWidth = 55
    doc.addImage(logoData.url, 'PNG', 196 - logoWidth, 12, logoWidth, logoHeight)
  }

  // Metadata Block
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(darkText[0], darkText[1], darkText[2])
  doc.text(`Quotation No: ${quotation.quotationNumber}`, 14, 34)
  doc.text(`Date: ${new Date(quotation.date).toLocaleDateString('en-GB')}`, 14, 40)
  if (quotation.validUntil) {
    doc.text(`Valid Until: ${new Date(quotation.validUntil).toLocaleDateString('en-GB')}`, 14, 46)
  }

  // Business Info Right
  doc.setFontSize(9)
  doc.setTextColor(greyText[0], greyText[1], greyText[2])
  let rightY = 38
  if (appSettings.businessName) { doc.text(appSettings.businessName, 196, rightY, { align: 'right' }); rightY += 5 }
  if (appSettings.phone) { doc.text(`Phone: ${appSettings.phone}`, 196, rightY, { align: 'right' }); rightY += 5 }
  if (appSettings.email) { doc.text(`Email: ${appSettings.email}`, 196, rightY, { align: 'right' }); rightY += 5 }
  if (appSettings.address) { doc.text(appSettings.address, 196, rightY, { align: 'right' }); rightY += 5 }

  // Customer Info Box: Client Name & Phone Number
  const customerName = quotation.customer?.name || quotation.customerName || 'Valued Client'
  const customerPhone = quotation.customer?.phone || quotation.customerPhone

  const startY = Math.max(rightY + 4, 52)
  doc.setDrawColor(220, 225, 230)
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(14, startY, 182, 22, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.text('QUOTATION FOR:', 18, startY + 7)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(darkText[0], darkText[1], darkText[2])
  doc.text(customerName, 18, startY + 14)

  if (customerPhone) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(greyText[0], greyText[1], greyText[2])
    doc.text(`Phone: ${customerPhone}`, 120, startY + 14)
  }

  // Items Table: Description, Qty, Unit Rate, Total
  const tableHead = [['#', 'Item Description', 'Qty', 'Unit Rate (Rs.)', 'Total (Rs.)']]
  const tableRows = (quotation.items || []).map((it: any, index: number) => [
    index + 1,
    it.description,
    it.copies || 1,
    it.unitPrice > 0 ? it.unitPrice.toLocaleString('en-LK', { minimumFractionDigits: 2 }) : '-',
    it.totalAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })
  ])

  autoTable(doc, {
    startY: startY + 28,
    head: tableHead,
    body: tableRows,
    theme: 'striped',
    headStyles: { fillColor: [21, 94, 150], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9.5, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 32, halign: 'right' },
      4: { cellWidth: 36, halign: 'right' }
    }
  })

  const finalY = (doc as any).lastAutoTable.finalY + 8

  // Totals Box
  const subtotal = (quotation.items || []).reduce((s: number, i: any) => s + i.totalAmount, 0)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(darkText[0], darkText[1], darkText[2])
  doc.text('Subtotal:', 136, finalY)
  doc.text(`Rs. ${subtotal.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`, 196, finalY, { align: 'right' })

  let runningY = finalY
  if (quotation.discount > 0) {
    runningY += 6
    doc.setTextColor(220, 38, 38)
    doc.text('Discount:', 136, runningY)
    doc.text(`- Rs. ${quotation.discount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`, 196, runningY, { align: 'right' })
  }

  runningY += 7
  doc.setDrawColor(21, 94, 150)
  doc.setLineWidth(0.5)
  doc.line(136, runningY - 2, 196, runningY - 2)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.text('Total Estimate:', 136, runningY + 4)
  doc.text(`Rs. ${quotation.totalAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`, 196, runningY + 4, { align: 'right' })

  // Terms and Bank Details Bottom
  let notesY = runningY + 16
  if (quotation.notes) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(darkText[0], darkText[1], darkText[2])
    doc.text('Terms & Conditions:', 14, notesY)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(greyText[0], greyText[1], greyText[2])
    doc.text(doc.splitTextToSize(quotation.notes, 125), 14, notesY + 5)
    notesY += 16
  }

  if (appSettings.bankName && appSettings.accountNumber) {
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
    doc.text('Banking Details for Payment:', 14, notesY)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(greyText[0], greyText[1], greyText[2])
    doc.text(`Bank: ${appSettings.bankName} | Branch: ${appSettings.branch || 'Main'} | Account Name: ${appSettings.accountName || ''} | Account No: ${appSettings.accountNumber}`, 14, notesY + 4.5)
  }

  doc.save(`${quotation.quotationNumber}.pdf`)
}
