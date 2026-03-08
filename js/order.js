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

async function shareOrderSummary() {
  const text = buildOrderSummaryText();
  const title = `Order ${orderState.currentOrder.order_number}`;

  if (navigator.share) {
    try {
      await navigator.share({ title, text });
    } catch (e) {
      if (e.name !== 'AbortError') showNotification('Could not share.', 'error');
    }
  } else {
    try {
      await navigator.clipboard.writeText(text);
      showNotification('Order copied to clipboard!', 'success');
    } catch (e) {
      showNotification('Could not copy to clipboard.', 'error');
    }
  }
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
