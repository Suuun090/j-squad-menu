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

async function generateOrderPDF() {
  const personItems = buildPersonItems();
  const peopleCount = Object.keys(personItems).length;
  const totalItems  = Object.values(personItems).reduce((s, a) => s + a.length, 0);
  const dateStr     = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  // ── Build the off-screen HTML element ──────────────────────
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:absolute;top:-9999px;left:0;width:794px;';

  const personSections = Object.entries(personItems).map(([person, items]) => `
    <div style="margin-bottom:32px;">
      <div style="display:flex;align-items:center;padding-bottom:10px;border-bottom:1.5px solid #e8d8c0;margin-bottom:4px;">
        <div style="width:32px;height:32px;border-radius:50%;background:#c4a882;
                    display:flex;align-items:center;justify-content:center;
                    color:#fffef9;font-size:14px;font-weight:700;
                    flex-shrink:0;margin-right:12px;font-family:'Noto Serif SC',serif;">
          ${escapeHtml(person.charAt(0).toUpperCase())}
        </div>
        <div style="font-size:17px;font-weight:700;color:#4a3220;letter-spacing:0.01em;
                    font-family:'Noto Serif SC',serif;">
          ${escapeHtml(person)}
        </div>
        <div style="margin-left:auto;font-size:11px;color:#a0826d;letter-spacing:0.06em;
                    font-family:'Noto Serif SC',serif;">
          ${items.length} ${items.length === 1 ? 'ITEM' : 'ITEMS'}
        </div>
      </div>
      ${items.map((name, i) => `
        <div style="display:flex;align-items:center;padding:10px 0 10px 44px;
                    ${i < items.length - 1 ? 'border-bottom:1px solid #f0e4d0;' : ''}">
          <span style="color:#c4a882;margin-right:12px;font-size:16px;">—</span>
          <span style="font-size:15px;color:#3d2b1a;font-family:'Noto Serif SC',serif;">
            ${escapeHtml(name)}
          </span>
        </div>
      `).join('')}
    </div>
  `).join('');

  wrap.innerHTML = `
    <div style="width:794px;background:#fffef9;font-family:'Noto Serif SC',Georgia,serif;
                color:#3d2b1a;box-sizing:border-box;">

      <!-- Top accent bar -->
      <div style="height:5px;background:linear-gradient(90deg,#d4b896,#c4a882,#a0826d,#c4a882,#d4b896);"></div>

      <!-- Header -->
      <div style="padding:48px 60px 36px;display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-size:32px;font-weight:700;color:#4a3220;letter-spacing:0.02em;line-height:1.15;">
            Double J Menu
          </div>
          <div style="font-size:12px;color:#a0826d;font-style:italic;margin-top:6px;letter-spacing:0.06em;">
            a product of love
          </div>
        </div>
        <div style="text-align:right;padding-top:4px;">
          <div style="font-size:18px;font-weight:600;color:#4a3220;letter-spacing:0.04em;">
            ${escapeHtml(orderState.currentOrder.order_number)}
          </div>
          <div style="font-size:11px;color:#8b6f56;margin-top:5px;letter-spacing:0.02em;">
            ${escapeHtml(dateStr)}
          </div>
        </div>
      </div>

      <!-- Ornamental divider -->
      <div style="display:flex;align-items:center;padding:0 60px;margin-bottom:0;">
        <div style="flex:1;height:1px;background:#e8d8c0;"></div>
        <div style="margin:0 14px;color:#c4a882;font-size:16px;line-height:1;">✦</div>
        <div style="flex:1;height:1px;background:#e8d8c0;"></div>
      </div>

      <!-- Stats bar -->
      <div style="background:#f5ede0;margin:24px 60px 0;border-radius:6px;padding:11px 20px;
                  display:flex;gap:20px;align-items:center;">
        <span style="font-size:11px;color:#a0826d;letter-spacing:0.06em;font-weight:600;">
          ${peopleCount} ${peopleCount === 1 ? 'PERSON' : 'PEOPLE'}
        </span>
        <span style="color:#d4b896;font-size:14px;">·</span>
        <span style="font-size:11px;color:#a0826d;letter-spacing:0.06em;font-weight:600;">
          ${totalItems} ${totalItems === 1 ? 'ITEM' : 'ITEMS'} TOTAL
        </span>
      </div>

      <!-- Person sections -->
      <div style="padding:36px 60px 24px;">
        ${personSections.length
          ? personSections
          : '<p style="color:#a0826d;font-style:italic;text-align:center;padding:24px 0;">No items selected.</p>'
        }
      </div>

      <!-- Footer ornament -->
      <div style="display:flex;align-items:center;padding:0 60px;margin-bottom:28px;">
        <div style="flex:1;height:1px;background:#e8d8c0;"></div>
        <div style="margin:0 14px;color:#c4a882;font-size:16px;line-height:1;">✦</div>
        <div style="flex:1;height:1px;background:#e8d8c0;"></div>
      </div>

      <!-- Footer message -->
      <div style="padding:0 60px 52px;text-align:center;">
        <div style="font-size:15px;font-style:italic;color:#4a3220;letter-spacing:0.02em;margin-bottom:10px;">
          Wish you have a good time ~
        </div>
        <div style="font-size:12px;color:#a0826d;letter-spacing:0.04em;">
          — love from Juan &amp; Jinjin
        </div>
        <div style="display:flex;justify-content:center;gap:18px;margin-top:20px;">
          <div style="width:5px;height:5px;border-radius:50%;background:#d4b896;"></div>
          <div style="width:5px;height:5px;border-radius:50%;background:#c4a882;"></div>
          <div style="width:5px;height:5px;border-radius:50%;background:#d4b896;"></div>
        </div>
      </div>

      <!-- Bottom accent bar -->
      <div style="height:5px;background:linear-gradient(90deg,#d4b896,#c4a882,#a0826d,#c4a882,#d4b896);"></div>
    </div>
  `;

  document.body.appendChild(wrap);

  try {
    await document.fonts.ready;

    const canvas = await html2canvas(wrap.firstElementChild, {
      scale: 2,
      backgroundColor: '#fffef9',
      logging: false,
      useCORS: true,
    });

    const { jsPDF } = window.jspdf;
    const pdf     = new jsPDF({ unit: 'mm', format: 'a4' });
    const pdfW    = pdf.internal.pageSize.getWidth();
    const pdfH    = pdf.internal.pageSize.getHeight();
    const imgData = canvas.toDataURL('image/jpeg', 0.93);
    const imgH    = (canvas.height / canvas.width) * pdfW;

    pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, imgH);
    let rendered = pdfH;
    while (rendered < imgH) {
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, -rendered, pdfW, imgH);
      rendered += pdfH;
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(wrap);
  }
}


async function previewOrderPDF() {
  showNotification('Generating preview…', 'info');
  let pdfBlob;
  try {
    pdfBlob = await generateOrderPDF();
  } catch (e) {
    console.error('PDF preview failed:', e);
    showNotification('Could not generate preview.', 'error');
    return;
  }
  const url = URL.createObjectURL(pdfBlob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function shareOrderSummary() {
  showNotification('Generating PDF…', 'info');

  let pdfBlob;
  try {
    pdfBlob = await generateOrderPDF();
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
