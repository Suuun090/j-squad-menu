// Order page logic

const orderState = {
  currentOrder: null,     // { id, order_number }
  personName: '',
  mySelections: new Set(), // menu_item_id values selected by this person
  allSelections: {},       // { menu_item_id: [person_name, ...] }
  allItems: [],
  activeTagFilter: null,
  subscription: null,
};

// Called by router when navigating to #order
async function initOrderPage() {
  if (orderState.allItems.length === 0) {
    try {
      orderState.allItems = await db.getMenuItems();
    } catch (e) {
      console.error('Failed to load menu items for order page:', e);
    }
  }
  showOrderLanding();
}

function showOrderLanding() {
  document.getElementById('orderLanding').style.display = 'block';
  document.getElementById('orderActive').style.display = 'none';
  document.getElementById('orderSummary').style.display = 'none';
  hideOrderBadge();
}

function hideOrderBadge() {
  const badge = document.getElementById('orderNumberBadge');
  if (badge) badge.style.display = 'none';
}

function showOrderBadge(number) {
  const badge = document.getElementById('orderNumberBadge');
  if (badge) {
    badge.textContent = number;
    badge.style.display = 'inline-block';
  }
}

function updateOrderNameCounter(input) {
  const remaining = 20 - input.value.length;
  document.getElementById('orderNameCounter').textContent = remaining;
}

async function createOrder() {
  const name = document.getElementById('orderPersonName').value.trim();
  if (!name) {
    showNotification('Please enter your name first.', 'error');
    return;
  }
  orderState.personName = name;

  const customName = document.getElementById('orderCustomName').value.trim();
  const orderNumber = customName
    ? customName.toUpperCase().replace(/\s+/g, '-').slice(0, 20)
    : 'JJ-' + Math.floor(1000 + Math.random() * 9000);

  try {
    const order = await db.createOrder(orderNumber);
    orderState.currentOrder = order;
    orderState.mySelections = new Set();
    orderState.allSelections = {};
    orderState.activeTagFilter = null;
    showActiveOrder();
    showNotification(`Order "${orderNumber}" created!`, 'success');
  } catch (e) {
    console.error('Error creating order:', e.message, e);
    const isDuplicate = e.message && e.message.includes('duplicate');
    showNotification(
      isDuplicate
        ? `An order named "${orderNumber}" already exists. Try a different name.`
        : `Failed to create order: ${e.message}`,
      'error'
    );
  }
}

async function joinOrder() {
  const name = document.getElementById('orderPersonName').value.trim();
  const code = document.getElementById('joinOrderInput').value.trim().toUpperCase();

  if (!name) {
    showNotification('Please enter your name first.', 'error');
    return;
  }
  if (!code) {
    showNotification('Please enter an order number.', 'error');
    return;
  }

  try {
    const order = await db.getOrderByNumber(code);
    if (!order) {
      showNotification('Order not found. Check the number and try again.', 'error');
      return;
    }
    orderState.currentOrder = order;
    orderState.personName = name;
    orderState.activeTagFilter = null;

    const selections = await db.getOrderSelections(order.id);
    orderState.allSelections = groupSelectionsByItem(selections);
    orderState.mySelections = new Set(
      selections
        .filter(s => s.person_name === name)
        .map(s => s.menu_item_id)
    );

    showActiveOrder();
    showNotification(`Joined order ${code}!`, 'success');
  } catch (e) {
    console.error('Error joining order:', e);
    showNotification('Failed to join order. Please try again.', 'error');
  }
}

function groupSelectionsByItem(selections) {
  const grouped = {};
  selections.forEach(s => {
    if (!grouped[s.menu_item_id]) grouped[s.menu_item_id] = [];
    if (!grouped[s.menu_item_id].includes(s.person_name)) {
      grouped[s.menu_item_id].push(s.person_name);
    }
  });
  return grouped;
}

function showActiveOrder() {
  document.getElementById('orderLanding').style.display = 'none';
  document.getElementById('orderSummary').style.display = 'none';
  document.getElementById('orderActive').style.display = 'block';
  showOrderBadge(orderState.currentOrder.order_number);
  renderOrderTagFilter();
  renderOrderItems();
  subscribeToOrderChanges();
}

function renderOrderTagFilter() {
  const tags = new Set();
  orderState.allItems.forEach(item => (item.tags || []).forEach(t => tags.add(t)));

  const container = document.getElementById('orderTagFilter');
  const tagArr = [...tags].sort();

  if (tagArr.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = tagArr.map(tag => `
    <button class="order-tag-pill${orderState.activeTagFilter === tag ? ' active' : ''}"
      onclick="toggleOrderTagFilter('${escapeHtml(tag)}')">${escapeHtml(tag)}</button>
  `).join('');
}

function toggleOrderTagFilter(tag) {
  orderState.activeTagFilter = orderState.activeTagFilter === tag ? null : tag;
  renderOrderTagFilter();
  renderOrderItems();
}

function renderOrderItems() {
  const items = orderState.activeTagFilter
    ? orderState.allItems.filter(i => (i.tags || []).includes(orderState.activeTagFilter))
    : orderState.allItems;

  const container = document.getElementById('orderItemsList');

  if (items.length === 0) {
    container.innerHTML = '<p class="no-items">No items match this tag.</p>';
    return;
  }

  container.innerHTML = items.map(item => {
    const selected = orderState.mySelections.has(item.id);
    const others = (orderState.allSelections[item.id] || [])
      .filter(n => n !== orderState.personName);

    return `
      <div class="order-item${selected ? ' selected' : ''}" onclick="toggleOrderItem(${item.id})">
        <div class="order-circle${selected ? ' filled' : ''}"></div>
        <div class="order-item-info">
          <span class="order-item-name">${escapeHtml(item.name)}</span>
          ${others.length
            ? `<span class="order-item-others">${others.map(escapeHtml).join(', ')} also selected</span>`
            : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function toggleOrderItem(menuItemId) {
  const isSelected = orderState.mySelections.has(menuItemId);

  // Optimistic UI update
  if (isSelected) {
    orderState.mySelections.delete(menuItemId);
    if (orderState.allSelections[menuItemId]) {
      orderState.allSelections[menuItemId] = orderState.allSelections[menuItemId]
        .filter(n => n !== orderState.personName);
    }
  } else {
    orderState.mySelections.add(menuItemId);
    if (!orderState.allSelections[menuItemId]) orderState.allSelections[menuItemId] = [];
    if (!orderState.allSelections[menuItemId].includes(orderState.personName)) {
      orderState.allSelections[menuItemId].push(orderState.personName);
    }
  }
  renderOrderItems();

  try {
    if (isSelected) {
      await db.removeOrderSelection(orderState.currentOrder.id, menuItemId, orderState.personName);
    } else {
      await db.addOrderSelection(orderState.currentOrder.id, menuItemId, orderState.personName);
    }
  } catch (e) {
    console.error('Error toggling selection:', e);
    // Roll back optimistic update
    if (isSelected) {
      orderState.mySelections.add(menuItemId);
      if (!orderState.allSelections[menuItemId]) orderState.allSelections[menuItemId] = [];
      if (!orderState.allSelections[menuItemId].includes(orderState.personName)) {
        orderState.allSelections[menuItemId].push(orderState.personName);
      }
    } else {
      orderState.mySelections.delete(menuItemId);
      if (orderState.allSelections[menuItemId]) {
        orderState.allSelections[menuItemId] = orderState.allSelections[menuItemId]
          .filter(n => n !== orderState.personName);
      }
    }
    renderOrderItems();
    showNotification('Failed to update selection.', 'error');
  }
}

function subscribeToOrderChanges() {
  if (orderState.subscription) {
    orderState.subscription.unsubscribe();
  }

  orderState.subscription = db.subscribeToOrderSelections(
    orderState.currentOrder.id,
    async () => {
      const selections = await db.getOrderSelections(orderState.currentOrder.id);
      orderState.allSelections = groupSelectionsByItem(selections);
      orderState.mySelections = new Set(
        selections
          .filter(s => s.person_name === orderState.personName)
          .map(s => s.menu_item_id)
      );
      renderOrderItems();
    }
  );
}

function buildPersonItems() {
  const personItems = {};
  Object.entries(orderState.allSelections).forEach(([itemId, persons]) => {
    const item = orderState.allItems.find(i => i.id === parseInt(itemId));
    if (!item) return;
    persons.forEach(person => {
      if (!personItems[person]) personItems[person] = [];
      personItems[person].push(item.name);
    });
  });
  return personItems;
}

function buildOrderSummaryText() {
  const personItems = buildPersonItems();
  let text = `Order: ${orderState.currentOrder.order_number}\n\n`;
  if (Object.keys(personItems).length === 0) {
    text += 'No items selected.';
  } else {
    Object.entries(personItems).forEach(([person, items]) => {
      text += `${person}:\n`;
      items.forEach(n => (text += `  • ${n}\n`));
      text += '\n';
    });
  }
  return text.trim();
}

async function showOrderSummary() {
  document.getElementById('orderActive').style.display = 'none';
  document.getElementById('orderSummary').style.display = 'block';

  // Close the order in Supabase
  try {
    await db.closeOrder(orderState.currentOrder.id);
  } catch (e) {
    console.error('Failed to close order:', e);
  }

  const personItems = buildPersonItems();
  const hasSomething = Object.keys(personItems).length > 0;

  document.getElementById('orderSummaryContent').innerHTML = hasSomething
    ? Object.entries(personItems).map(([person, items]) => `
        <div class="summary-person">
          <h3>${escapeHtml(person)}</h3>
          <ul>${items.map(n => `<li>${escapeHtml(n)}</li>`).join('')}</ul>
        </div>
      `).join('')
    : '<p class="no-items">No items selected yet.</p>';
}

function generateOrderPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const W = 210;
  const margin = 16;
  const cW = W - margin * 2; // content width

  // Palette
  const blue    = [ 80, 170, 210];
  const blueLt  = [137, 207, 240];
  const bluePl  = [218, 240, 252];
  const dark    = [ 44,  44,  62];
  const muted   = [120, 120, 140];
  const white   = [255, 255, 255];
  const rowAlt  = [245, 251, 255];

  // ── HEADER ────────────────────────────────────────────────
  // Deep blue base
  doc.setFillColor(...blue);
  doc.rect(0, 0, W, 52, 'F');

  // Lighter blue bottom strip
  doc.setFillColor(...blueLt);
  doc.rect(0, 42, W, 10, 'F');

  // Decorative circles top-right
  doc.setFillColor(100, 190, 230);
  doc.circle(W + 2, -8, 38, 'F');
  doc.setFillColor(90, 180, 220);
  doc.circle(W - 8, 18, 20, 'F');

  // App title
  doc.setTextColor(...white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(23);
  doc.text('Double J Menu', margin, 21);

  // Tagline
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(210, 238, 255);
  doc.text('a product of love', margin, 29);

  // Order number
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...white);
  doc.text(`Order  ${orderState.currentOrder.order_number}`, margin, 46);

  // Date top-right
  const dateStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(200, 232, 255);
  doc.text(dateStr, W - margin, 46, { align: 'right' });

  // ── STATS BAR ─────────────────────────────────────────────
  doc.setFillColor(...bluePl);
  doc.rect(0, 52, W, 15, 'F');

  const personItems  = buildPersonItems();
  const peopleCount  = Object.keys(personItems).length;
  const totalItems   = Object.values(personItems).reduce((s, a) => s + a.length, 0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...muted);
  doc.text(
    `${peopleCount} ${peopleCount === 1 ? 'person' : 'people'}   ·   ${totalItems} ${totalItems === 1 ? 'item' : 'items'} total`,
    margin, 62
  );

  // ── PERSON SECTIONS ───────────────────────────────────────
  let y = 78;

  Object.entries(personItems).forEach(([person, items]) => {
    if (y > 245) { doc.addPage(); y = 20; }

    // Person header bar
    doc.setFillColor(...blueLt);
    doc.roundedRect(margin, y, cW, 10, 2.5, 2.5, 'F');

    // Avatar circle
    doc.setFillColor(...blue);
    doc.circle(margin + 6, y + 5, 3.8, 'F');
    doc.setTextColor(...white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(person.charAt(0).toUpperCase(), margin + 6, y + 6.1, { align: 'center' });

    // Person name
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...dark);
    doc.text(person, margin + 13, y + 6.8);

    // Item count badge (right)
    const badge = `${items.length} item${items.length !== 1 ? 's' : ''}`;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...blue);
    doc.text(badge, W - margin - 1, y + 6.8, { align: 'right' });

    y += 13;

    // Items
    items.forEach((name, i) => {
      if (y > 272) { doc.addPage(); y = 20; }

      // Alternating row background
      if (i % 2 === 0) {
        doc.setFillColor(...rowAlt);
        doc.rect(margin, y - 1.5, cW, 8.5, 'F');
      }

      // Bullet dot
      doc.setFillColor(...blueLt);
      doc.circle(margin + 3.5, y + 3, 1.4, 'F');

      // Item name
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(...dark);
      doc.text(name, margin + 9, y + 5);

      y += 9.5;
    });

    y += 7;
  });

  // ── FOOTER ────────────────────────────────────────────────
  const fY = Math.max(y + 4, 260);

  // Decorative rule
  doc.setDrawColor(...blueLt);
  doc.setLineWidth(0.5);
  doc.line(margin, fY, W - margin, fY);

  // Diamond accent on rule centre
  doc.setFillColor(...blueLt);
  const cx = W / 2;
  // Rotate a square 45° by drawing two triangles
  doc.triangle(cx, fY - 2.2, cx + 2.2, fY, cx, fY + 2.2, 'F');
  doc.triangle(cx, fY - 2.2, cx - 2.2, fY, cx, fY + 2.2, 'F');

  // Wish message
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(12);
  doc.setTextColor(...dark);
  doc.text('Wish you have a good time ~', cx, fY + 11, { align: 'center' });

  // Signature
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...muted);
  doc.text('— love from Juan & Jinjin', cx, fY + 19, { align: 'center' });

  // Three dot accents
  doc.setFillColor(...blueLt);
  [-20, 0, 20].forEach(offset => doc.circle(cx + offset, fY + 26, 1.3, 'F'));

  return doc.output('blob');
}

async function shareOrderSummary() {
  showNotification('Generating PDF…', 'info');

  let pdfBlob;
  try {
    pdfBlob = generateOrderPDF();
  } catch (e) {
    console.error('PDF generation failed:', e);
    showNotification('Could not generate PDF.', 'error');
    return;
  }

  const filename = `order-${orderState.currentOrder.order_number}.pdf`;
  const file = new File([pdfBlob], filename, { type: 'application/pdf' });

  // Try native share with file (works on iOS/Android)
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ title: `Order ${orderState.currentOrder.order_number}`, files: [file] });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
      // Fall through to download
    }
  }

  // Fallback: download the PDF
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function backToActiveOrder() {
  document.getElementById('orderSummary').style.display = 'none';
  document.getElementById('orderActive').style.display = 'block';
}

function leaveOrder() {
  if (orderState.subscription) {
    orderState.subscription.unsubscribe();
    orderState.subscription = null;
  }
  orderState.currentOrder = null;
  orderState.mySelections = new Set();
  orderState.allSelections = {};
  orderState.personName = '';
  orderState.activeTagFilter = null;
  hideOrderBadge();
  showOrderLanding();
}
