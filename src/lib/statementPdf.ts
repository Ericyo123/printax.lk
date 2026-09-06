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

export type WhatsAppTarget = 'standard' | 'business' | 'web' | 'chooser'

export function normalizePhoneNumber(rawPhone?: string | null): string {
  const digits = (rawPhone || '').replace(/[^0-9]/g, '')
  if (!digits) return ''
  // Normalize Sri Lankan phone numbers: 077... -> 9477..., 77... -> 9477...
  if (digits.startsWith('0')) {
    return '94' + digits.slice(1)
  }
  if (digits.length === 9 && (digits.startsWith('7') || digits.startsWith('1'))) {
    return '94' + digits
  }
  return digits
}

export function buildStatementWhatsAppDetails(
  stmt: any,
  customerPhone?: string | null,
  customerName?: string | null,
  settings?: any
) {
  const name = customerName || stmt.customer?.name || 'Valued Customer'
  const phone = normalizePhoneNumber(customerPhone || stmt.customer?.phone)
  const period = `${MONTH_NAMES[(stmt.month || 1) - 1]} ${stmt.year}`
  const total = `Rs. ${(stmt.totalAmount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`

  const businessName = settings?.businessName || 'Printax Solutions'
  const invoices = Array.isArray(stmt.invoices) ? stmt.invoices : []
  const count = invoices.length
  const divider = '--------------------------------------------------'

  let message = `*MONTHLY STATEMENT OF ACCOUNT*\n`
  message += `*${businessName}*\n`
  message += `${divider}\n`
  message += `Client: *${name}*\n`
  message += `Statement No: *${stmt.statementNo}*\n`
  message += `Period: *${period}*\n`
  if (stmt.dueDate) {
    message += `Due Date: *${new Date(stmt.dueDate).toLocaleDateString('en-GB')}*\n`
  }
  message += `Invoices Count: *${count}*\n`
  message += `Total Balance Due: *${total}*\n`
  message += `${divider}\n\n`

  if (invoices.length > 0) {
    message += `*INVOICE BREAKDOWN:*\n\n`
    invoices.forEach((inv: any, idx: number) => {
      const invDate = inv.date ? new Date(inv.date).toLocaleDateString('en-GB') : ''
      const invTotal = `Rs. ${(inv.totalAmount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`
      const isPaid = inv.paymentStatus === 'PAID'
      const statusText = isPaid ? '[PAID]' : '[DUE]'

      message += `${idx + 1}. *${inv.invoiceNumber}* (${invDate})\n`
      if (inv.jobs && Array.isArray(inv.jobs) && inv.jobs.length > 0) {
        inv.jobs.forEach((j: any) => {
          const jobDesc = j.description || (j.paperSize ? `${j.paperSize.name} Print` : 'Print Job')
          const copies = j.copies > 1 ? ` (${j.copies} copies)` : ''
          message += `   - ${jobDesc}${copies}\n`
        })
      }
      message += `   Amount: *${invTotal}* ${statusText}\n\n`
    })
    message += `${divider}\n\n`
  }

  message += `*SUMMARY:*\n`
  message += `- Total Invoices: ${count}\n`
  message += `- Total Balance Due: *${total}*\n\n`

  if (settings?.bankName && settings?.accountNumber) {
    message += `*BANK PAYMENT DETAILS:*\n`
    message += `- Bank: *${settings.bankName}*\n`
    if (settings.accountName) message += `- Account Name: *${settings.accountName}*\n`
    message += `- Account Number: *${settings.accountNumber}*\n`
    if (settings.branch) message += `- Branch: *${settings.branch}*\n`
    if (settings.swiftCode) message += `- SWIFT/BIC: ${settings.swiftCode}\n`
    message += `\n`
  }

  message += `Please send the payment receipt/confirmation to this number once settled.\n\n`
  message += `Thank you for your business!\n`
  message += `*${businessName}*`

  return { name, phone, message }
}

export function sendWhatsAppMessage({
  phone,
  message,
  target = 'standard'
}: {
  phone?: string | null
  message: string
  target: WhatsAppTarget
}) {
  const cleanPhone = normalizePhoneNumber(phone)
  const encoded = encodeURIComponent(message)
  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
  const fallbackUrl = encodeURIComponent(
    cleanPhone ? `https://wa.me/${cleanPhone}?text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`
  )

  if (target === 'web') {
    const url = cleanPhone
      ? `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
      : `https://web.whatsapp.com/send?text=${encoded}`
    window.open(url, '_blank')
    return
  }

  if (target === 'standard') {
    if (isAndroid) {
      // Explicitly target standard WhatsApp Messenger package (com.whatsapp)
      const intentUrl = cleanPhone
        ? `intent://send?phone=${cleanPhone}&text=${encoded}#Intent;package=com.whatsapp;scheme=whatsapp;S.browser_fallback_url=${fallbackUrl};end`
        : `intent://send?text=${encoded}#Intent;package=com.whatsapp;scheme=whatsapp;S.browser_fallback_url=${fallbackUrl};end`
      window.location.href = intentUrl
      return
    }
    // For iOS / Desktop
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`
    window.open(url, '_blank')
    return
  }

  if (target === 'business') {
    if (isAndroid) {
      // Explicitly target WhatsApp Business package (com.whatsapp.w4b)
      const intentUrl = cleanPhone
        ? `intent://send?phone=${cleanPhone}&text=${encoded}#Intent;package=com.whatsapp.w4b;scheme=whatsapp;S.browser_fallback_url=${fallbackUrl};end`
        : `intent://send?text=${encoded}#Intent;package=com.whatsapp.w4b;scheme=whatsapp;S.browser_fallback_url=${fallbackUrl};end`
      window.location.href = intentUrl
      return
    }
    // For iOS / Desktop
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`
    window.open(url, '_blank')
    return
  }

  // target === 'chooser'
  if (isAndroid || isIOS) {
    const schemeUrl = cleanPhone
      ? `whatsapp://send?phone=${cleanPhone}&text=${encoded}`
      : `whatsapp://send?text=${encoded}`
    window.location.href = schemeUrl
  } else {
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`
    window.open(url, '_blank')
  }
}

export async function openStatementWhatsApp(
  stmt: any,
  customerPhone?: string | null,
  customerName?: string | null,
  target: WhatsAppTarget = 'standard'
) {
  // Fetch settings for business name and bank details
  let settings: any = {}
  try {
    const sRes = await fetch('/api/settings')
    if (sRes.ok) settings = await sRes.json()
  } catch {}

  const details = buildStatementWhatsAppDetails(stmt, customerPhone, customerName, settings)
  sendWhatsAppMessage({
    phone: details.phone,
    message: details.message,
    target
  })
}
