export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export async function downloadStatementPDF(stmt: any) {
  try {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF()

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
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const data = imageData.data
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i], g = data[i + 1], b = data[i + 2]
              if (r > 240 && g > 240 && b > 240) data[i + 3] = 0
            }
            ctx.putImageData(imageData, 0, 0)
            resolve({ url: canvas.toDataURL('image/png'), width: img.width, height: img.height })
          } catch {
            resolve(null)
          }
        }
        img.onerror = () => resolve(null)
        img.src = url
      })
    }

    const logoData = await getBase64('/logo.png')
    const settings = await fetch('/api/settings').then(res => res.json()).catch(() => ({}))

    const primaryColor = [21, 94, 160]
    const lightBlue = [240, 247, 255]
    const greyColor = [100, 100, 100]
    const darkText = [30, 30, 30]

    // Header
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
    doc.setFontSize(28)
    doc.setFont('helvetica', 'bold')
    doc.text('Statement', 14, 25)

    // Logo on Top Right
    if (logoData) {
      const aspect = logoData.width / logoData.height
      let logoHeight = 25
      let logoWidth = logoHeight * aspect

      if (logoWidth > 55) {
        logoWidth = 55
        logoHeight = logoWidth / aspect
      }

      doc.addImage(logoData.url, 'PNG', 196 - logoWidth, 10, logoWidth, logoHeight)
    }

    // Statement Details
    doc.setTextColor(darkText[0], darkText[1], darkText[2])
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')

    let infoY = 40
    doc.text('Statement No #', 14, infoY)
    doc.setFont('helvetica', 'bold')
    doc.text(stmt.statementNo || '', 45, infoY)
    infoY += 6
    doc.setFont('helvetica', 'normal')
    doc.text('Period', 14, infoY)
    doc.setFont('helvetica', 'bold')
    doc.text(`${MONTH_NAMES[stmt.month - 1]} ${stmt.year}`, 45, infoY)

    // Address Boxes
    let boxY = 65
    // Billed By
    doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2])
    doc.roundedRect(14, boxY, 90, 45, 3, 3, 'F')
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Billed By', 18, boxY + 8)
    doc.setTextColor(darkText[0], darkText[1], darkText[2])
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(settings.businessName || 'Printax Solutions', 18, boxY + 15)
    doc.setFont('helvetica', 'normal')
    doc.text(settings.address || '132, Kolonnawa Road,\nDemetagoda,\nSri Lanka', 18, boxY + 22)

    // Billed To
    doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2])
    doc.roundedRect(106, boxY, 90, 45, 3, 3, 'F')
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Statement For', 110, boxY + 8)
    doc.setTextColor(darkText[0], darkText[1], darkText[2])
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(stmt.customer?.name || 'Customer', 110, boxY + 15)
    doc.setFont('helvetica', 'normal')
    if (stmt.customer?.address) doc.text(stmt.customer.address, 110, boxY + 22)
    doc.text('Sri Lanka', 110, boxY + (stmt.customer?.address ? 32 : 22))

    const rows = (stmt.invoices || []).map((inv: any, index: number) => [
      index + 1,
      inv.invoiceNumber || '',
      inv.date ? new Date(inv.date).toLocaleDateString() : '',
      inv.paymentStatus || '',
      `Rs. ${(inv.totalAmount || 0).toLocaleString()}`,
    ])

    const tableStartY = boxY + 55
    const headerHeight = 10
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2])
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
    doc.roundedRect(14, tableStartY, 182, headerHeight, 4, 4, 'F')
    doc.rect(14, tableStartY + headerHeight / 2, 182, headerHeight / 2, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')

    doc.text('#', 20, tableStartY + 7, { align: 'center' })
    doc.text('Invoice #', 28, tableStartY + 7)
    doc.text('Date', 91, tableStartY + 7, { align: 'center' })
    doc.text('Status', 113, tableStartY + 7)
    doc.text('Amount', 191, tableStartY + 7, { align: 'right' })

    autoTable(doc, {
      startY: tableStartY + headerHeight,
      showHead: 'never',
      body: rows,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 6, textColor: [30, 30, 30] },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 45 },
        2: { cellWidth: 40, halign: 'center' },
        3: { cellWidth: 35 },
        4: { cellWidth: 50, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
      willDrawCell: (data: any) => {
        if (data.section === 'body') {
          const isLastRow = data.row.index === data.table.body.length - 1
          const isFirstCol = data.column.index === 0
          const isLastCol = data.column.index === data.table.columns.length - 1
          const isEven = data.row.index % 2 === 0

          if (isEven) {
            doc.setFillColor(244, 244, 245)
          } else {
            doc.setFillColor(255, 255, 255)
          }

          const x = data.cell.x
          const y = data.cell.y
          const w = data.cell.width
          const h = data.cell.height
          const r = 4

          if (isLastRow) {
            doc.roundedRect(x, y, w, h, r, r, 'F')
            doc.rect(x, y, w, h / 2, 'F')
            if (!isFirstCol) doc.rect(x, y + h / 2, w / 2, h / 2, 'F')
            if (!isLastCol) doc.rect(x + w / 2, y + h / 2, w / 2, h / 2, 'F')
          } else {
            doc.rect(x, y, w, h, 'F')
          }
        }
      }
    })

    const finalY = ((doc as any).lastAutoTable?.finalY || 180) + 15

    // Summary
    doc.setTextColor(darkText[0], darkText[1], darkText[2])
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Total Due (LKR)', 130, finalY + 10)
    doc.setFontSize(18)
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
    doc.text(`Rs. ${(stmt.totalAmount || 0).toLocaleString()}.00`, 196, finalY + 10, { align: 'right' })

    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2])
    doc.setLineWidth(0.5)
    doc.line(130, finalY + 2, 196, finalY + 2)
    doc.line(130, finalY + 15, 196, finalY + 15)

    // Footer
    doc.setFontSize(9)
    doc.setTextColor(greyColor[0], greyColor[1], greyColor[2])
    doc.setFont('helvetica', 'normal')
    doc.text(`132, Kolonnawa Road Demetagoda  |  Phone: ${settings.phone || ''}  |  Email: ${settings.email || ''}`, 105, 285, { align: 'center' })

    doc.save(`${stmt.statementNo || 'statement'}.pdf`)
  } catch (err) {
    console.error('Statement PDF error:', err)
    alert('Failed to generate statement PDF. Please try again.')
  }
}

export function openStatementWhatsApp(stmt: any, customerPhone?: string | null, customerName?: string | null) {
  const name = customerName || stmt.customer?.name || 'Valued Customer'
  const phone = (customerPhone || stmt.customer?.phone || '').replace(/[^0-9+]/g, '')
  const period = `${MONTH_NAMES[(stmt.month || 1) - 1]} ${stmt.year}`
  const total = `Rs. ${(stmt.totalAmount || 0).toLocaleString()}`
  const count = stmt.invoices?.length || 0

  let message = `Hello *${name}*,\n\nHere is your monthly statement from *Printax Solutions*:\n\n`
  message += `📄 *Statement No:* ${stmt.statementNo}\n`
  message += `📅 *Period:* ${period}\n`
  message += `🧾 *Invoices Included:* ${count}\n`
  message += `💰 *Total Due:* *${total}*\n`
  if (stmt.dueDate) {
    message += `⏳ *Due Date:* ${new Date(stmt.dueDate).toLocaleDateString()}\n`
  }
  message += `\nPlease find your detailed statement breakdown. For any inquiries or payment verification, feel free to reply to this message.\n\nThank you for choosing *Printax Solutions*!`

  const encoded = encodeURIComponent(message)
  const url = phone ? `https://wa.me/${phone.startsWith('+') ? phone.slice(1) : phone.startsWith('0') ? '94' + phone.slice(1) : phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`
  window.open(url, '_blank')
}
