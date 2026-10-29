function money(amount, currency) {
  const formattedAmount = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount / 100);
  return `${currency} ${formattedAmount}`;
}

function addWrappedText(document, value, x, y, width, lineHeight = 5) {
  const lines = document.splitTextToSize(String(value || ''), width);
  document.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function drawTableHeader(document, y, pageWidth, margin, columns) {
  const right = pageWidth - margin;
  document.setFillColor(35, 75, 59);
  document.roundedRect(margin, y - 5, pageWidth - margin * 2, 10, 2, 2, 'F');
  document.setTextColor(255, 255, 255);
  document.setFont('helvetica', 'bold');
  document.setFontSize(9);
  document.text('ITEM', columns.product + 3, y + 1);
  document.text('QTY', columns.quantity, y + 1, { align: 'right' });
  document.text('UNIT PRICE', columns.unit, y + 1, { align: 'right' });
  document.text('AMOUNT', right - 3, y + 1, { align: 'right' });
  document.setTextColor(0, 0, 0);
  return y + 12;
}

export async function downloadInvoice(order) {
  if (!order || order.paymentStatus !== 'paid' || order.payment?.status !== 'captured') {
    throw new Error('An invoice is available only for a successfully paid order.');
  }

  const { jsPDF } = await import('jspdf');
  const document = new jsPDF();
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const margin = 16;
  const right = pageWidth - margin;
  const contentWidth = pageWidth - margin * 2;
  const currency = order.currency || 'INR';
  const customer = order.customer || {};
  const paymentDate = order.payment.paymentDate
    ? new Date(order.payment.paymentDate).toLocaleString('en-IN')
    : 'Unavailable';
  let y = 61;

  document.setFillColor(35, 75, 59);
  document.rect(0, 0, pageWidth, 47, 'F');
  document.setTextColor(255, 255, 255);
  document.setFont('helvetica', 'bold');
  document.setFontSize(22);
  document.text('ShopFusion', margin, 21);
  document.setFont('helvetica', 'normal');
  document.setFontSize(9);
  document.text('YOUR EVERYDAY SHOPPING, SIMPLIFIED', margin, 29);
  document.setFont('helvetica', 'bold');
  document.setFontSize(17);
  document.text('PAYMENT RECEIPT', right, 21, { align: 'right' });
  document.setFontSize(8);
  document.text('PAID', right, 31, { align: 'right' });

  document.setTextColor(35, 75, 59);
  document.setFont('helvetica', 'bold');
  document.setFontSize(10);
  document.text('INVOICE NUMBER', margin, y);
  document.text('ORDER DATE', right, y, { align: 'right' });
  y += 7;
  document.setTextColor(29, 39, 34);
  document.setFontSize(9);
  y = addWrappedText(document, order.invoiceNumber || 'Unavailable', margin, y, contentWidth * 0.62);
  document.text(
    order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN') : 'Unavailable',
    right,
    y - 5,
    { align: 'right' }
  );
  y += 8;

  const panelY = y;
  const panelGap = 8;
  const panelWidth = (contentWidth - panelGap) / 2;
  document.setFillColor(246, 248, 246);
  document.roundedRect(margin, panelY, panelWidth, 43, 3, 3, 'F');
  document.roundedRect(margin + panelWidth + panelGap, panelY, panelWidth, 43, 3, 3, 'F');

  document.setTextColor(104, 116, 109);
  document.setFont('helvetica', 'bold');
  document.setFontSize(8);
  document.text('BILLED TO', margin + 6, panelY + 9);
  document.text('DELIVER TO', margin + panelWidth + panelGap + 6, panelY + 9);
  document.setTextColor(29, 39, 34);
  document.setFont('helvetica', 'bold');
  document.setFontSize(9);
  document.text(customer.name || 'Customer', margin + 6, panelY + 17);
  document.setFont('helvetica', 'normal');
  document.setFontSize(8);
  addWrappedText(document, customer.email || '', margin + 6, panelY + 23, panelWidth - 12, 4);
  addWrappedText(document, customer.phone ? `Mobile: ${customer.phone}` : '', margin + 6, panelY + 34, panelWidth - 12, 4);

  const deliveryX = margin + panelWidth + panelGap + 6;
  const deliveryWidth = panelWidth - 12;
  let deliveryY = panelY + 17;
  deliveryY = addWrappedText(document, customer.address || '', deliveryX, deliveryY, deliveryWidth, 4);
  deliveryY = addWrappedText(
    document,
    [customer.city, customer.state, customer.postalCode].filter(Boolean).join(', '),
    deliveryX,
    deliveryY,
    deliveryWidth,
    4
  );
  addWrappedText(document, customer.country || '', deliveryX, deliveryY, deliveryWidth, 4);

  y = panelY + 55;
  document.setTextColor(29, 39, 34);
  document.setFont('helvetica', 'bold');
  document.setFontSize(11);
  document.text('Order summary', margin, y);
  y += 9;

  const columns = {
    product: margin,
    quantity: right - 78,
    unit: right - 43
  };
  y = drawTableHeader(document, y, pageWidth, margin, columns);

  for (const item of order.items || []) {
    const productWidth = columns.quantity - columns.product - 12;
    const productLines = document.splitTextToSize(item.title || 'Item', productWidth);
    const rowHeight = Math.max(10, productLines.length * 4.5 + 5);
    if (y + rowHeight > pageHeight - 22) {
      document.addPage();
      y = 22;
      y = drawTableHeader(document, y, pageWidth, margin, columns);
    }

    document.setTextColor(29, 39, 34);
    document.setFont('helvetica', 'normal');
    document.setFontSize(8);
    document.text(productLines, columns.product + 3, y);
    document.text(String(item.quantity), columns.quantity, y, { align: 'right' });
    document.text(money(item.unitAmount, currency), columns.unit, y, { align: 'right' });
    document.text(
      money(item.unitAmount * item.quantity, currency),
      right - 3,
      y,
      { align: 'right' }
    );
    y += rowHeight;
    document.setDrawColor(229, 233, 228);
    document.line(margin, y - 2, right, y - 2);
  }

  if (y + 61 > pageHeight - 18) {
    document.addPage();
    y = 22;
  } else {
    y += 5;
  }

  const summaryX = right - 79;
  document.setTextColor(104, 116, 109);
  document.setFont('helvetica', 'normal');
  document.setFontSize(9);
  document.text('Subtotal', summaryX, y);
  document.text(money(order.subtotal ?? order.amount, currency), right, y, { align: 'right' });
  y += 8;
  document.text('Shipping', summaryX, y);
  document.text('Not included', right, y, { align: 'right' });
  y += 5;
  document.setDrawColor(35, 75, 59);
  document.line(summaryX, y, right, y);
  y += 9;
  document.setTextColor(35, 75, 59);
  document.setFont('helvetica', 'bold');
  document.setFontSize(12);
  document.text('TOTAL PAID', summaryX, y);
  document.text(money(order.amount, currency), right, y, { align: 'right' });
  y += 16;

  document.setFillColor(246, 248, 246);
  document.roundedRect(margin, y - 5, contentWidth, 32, 3, 3, 'F');
  document.setTextColor(35, 75, 59);
  document.setFont('helvetica', 'bold');
  document.setFontSize(8);
  document.text('PAYMENT DETAILS', margin + 6, y + 3);
  document.setTextColor(29, 39, 34);
  document.setFont('helvetica', 'normal');
  document.setFontSize(8);
  document.text(`Payment ID: ${order.payment.paymentId || 'Unavailable'}`, margin + 6, y + 12);
  document.text(`Method: ${order.payment.method || 'Not provided'}`, margin + 6, y + 20);
  document.text(`Paid: ${paymentDate}`, right - 6, y + 12, { align: 'right' });
  document.text('Status: Captured', right - 6, y + 20, { align: 'right' });

  const pageCount = document.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    document.setPage(page);
    document.setDrawColor(229, 233, 228);
    document.line(margin, pageHeight - 13, right, pageHeight - 13);
    document.setTextColor(104, 116, 109);
    document.setFont('helvetica', 'normal');
    document.setFontSize(8);
    document.text('Thank you for shopping with ShopFusion.', margin, pageHeight - 7);
    document.text(`Page ${page} of ${pageCount}`, right, pageHeight - 7, { align: 'right' });
  }

  document.save(`${order.invoiceNumber || order.orderId}-invoice.pdf`);
}
