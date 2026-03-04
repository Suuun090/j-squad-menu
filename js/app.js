// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('service-worker.js')
      .then((registration) => {
        console.log('Service Worker registered successfully:', registration.scope);
      })
      .catch((error) => {
        console.log('Service Worker registration failed:', error);
      });
  });
}

// Application initialization
document.addEventListener('DOMContentLoaded', () => {
  console.log('Double J Menu app loaded');
  loadMenuItems();
  initializeForm();
  initialiseTabs();
  subscribeToRealtimeUpdates();
});

// Initialize form handlers
function initializeForm() {
  const toggleFormBtn = document.getElementById('toggleFormBtn');
  const addItemForm = document.getElementById('addItemForm');
  const cancelBtn = document.getElementById('cancelBtn');
  const addTagBtn = document.getElementById('addTagBtn');
  const itemTagInput = document.getElementById('itemTag');
  
  // Store selected tags
  window.selectedTags = [];
  
  toggleFormBtn.addEventListener('click', async () => {
    const isHidden = addItemForm.style.display === 'none';
    addItemForm.style.display = isHidden ? 'block' : 'none';
    toggleFormBtn.textContent = isHidden ? '− Close Form' : '+ Add New Item';
    
    // Load existing tags when form is opened
    if (isHidden) {
      await loadExistingTags();
    }
  });
  
  cancelBtn.addEventListener('click', () => {
    addItemForm.style.display = 'none';
    toggleFormBtn.textContent = '+ Add New Item';
    addItemForm.reset();
    window.selectedTags = [];
    updateSelectedTagsDisplay();
    document.getElementById('editingItemId').value = '';
    document.getElementById('formTitle').textContent = 'Add Menu Item';
    document.getElementById('submitBtn').textContent = 'Add Item';
  });
  
  addTagBtn.addEventListener('click', () => {
    addTag();
  });
  
  itemTagInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  });
  
  addItemForm.addEventListener('submit', (e) => {
    console.log('Form submit event triggered!');
    e.preventDefault();
    console.log('Default prevented, calling addMenuItem()');
    addMenuItem();
  });
}

// Add a tag to the selected tags
function addTag() {
  const tagInput = document.getElementById('itemTag');
  const tag = tagInput.value.trim();
  
  if (tag && !window.selectedTags.includes(tag)) {
    window.selectedTags.push(tag);
    updateSelectedTagsDisplay();
    tagInput.value = '';
  }
}

// Initialise tab navigation
function initialiseTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;

      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(`tab-${target}`).classList.add('active');

      if (target === 'tags') {
        loadTagsPanel();
      }
    });
  });
}

// Load and render the tags panel
async function loadTagsPanel() {
  const panel = document.getElementById('tagsPanel');
  panel.innerHTML = '<p class="tags-panel-empty">Loading...</p>';

  try {
    window.allMenuItems = await db.getMenuItems();
    renderTagsPanel(window.allMenuItems);
  } catch (error) {
    console.error('Error loading tags panel:', error);
    panel.innerHTML = '<p class="tags-panel-empty">Failed to load tags.</p>';
  }
}

function renderTagsPanel(items, selectedTag = null) {
  const panel = document.getElementById('tagsPanel');
  const tally = {};
  items.forEach(item => {
    (item.tags || []).forEach(tag => {
      tally[tag] = (tally[tag] || 0) + 1;
    });
  });

  const tags = Object.keys(tally).sort();
  if (tags.length === 0) {
    panel.innerHTML = '<p class="tags-panel-empty">No tags added yet.</p>';
    return;
  }

  const tagBar = tags.map(tag => `
    <button class="tag-card ${tag === selectedTag ? 'active' : ''}" onclick="selectTagFilter('${escapeHtml(tag)}')">
      ${escapeHtml(tag)}
      <span class="tag-card-count">${tally[tag]}</span>
    </button>`).join('');

  let itemsHtml = '';
  if (selectedTag) {
    const filtered = items.filter(item => (item.tags || []).includes(selectedTag));
    itemsHtml = `
      <div class="tag-items-list">
        ${filtered.map(item => `
          <div class="tag-item-row">
            <strong>${escapeHtml(item.name)}</strong>
            ${item.description ? `<span class="tag-item-desc">${escapeHtml(item.description)}</span>` : ''}
          </div>`).join('')}
      </div>`;
  }

  panel.innerHTML = `<div class="tag-bar">${tagBar}</div>${itemsHtml}`;
}

function selectTagFilter(tag) {
  const selectedTag = tag;
  renderTagsPanel(window.allMenuItems, selectedTag);
}

// Remove a tag from selected tags
function removeTag(tag) {
  window.selectedTags = window.selectedTags.filter(t => t !== tag);
  updateSelectedTagsDisplay();
}

// Update the display of selected tags
function updateSelectedTagsDisplay() {
  const container = document.getElementById('selectedTags');
  if (window.selectedTags.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = window.selectedTags
    .map(tag => `<span class="selected-tag">${escapeHtml(tag)} <button type="button" onclick="removeTag('${escapeHtml(tag)}')">×</button></span>`)
    .join('');
}

// Load existing tags from database
async function loadExistingTags() {
  try {
    const menuItems = await db.getMenuItems();
    // Get all unique tags from all items
    const allTags = menuItems.flatMap(item => item.tags || []);
    const tags = [...new Set(allTags)].filter(tag => tag);
    
    // Update datalist
    const datalist = document.getElementById('tagSuggestions');
    datalist.innerHTML = tags.map(tag => `<option value="${escapeHtml(tag)}">`).join('');
    
    // Display tags as clickable buttons
    const existingTagsDiv = document.getElementById('existingTags');
    if (tags.length > 0) {
      existingTagsDiv.innerHTML = '<small>Quick select:</small> ' + 
        tags.map(tag => `<button type="button" class="tag-button" onclick="quickAddTag('${escapeHtml(tag)}')">${escapeHtml(tag)}</button>`).join('');
    } else {
      existingTagsDiv.innerHTML = '<small>No tags yet. Create your first one!</small>';
    }
  } catch (error) {
    console.error('Error loading tags:', error);
  }
}

// Quick add a tag from suggestions
function quickAddTag(tag) {
  if (!window.selectedTags.includes(tag)) {
    window.selectedTags.push(tag);
    updateSelectedTagsDisplay();
  }
}

// Load menu items from Supabase
async function loadMenuItems() {
  const menuContainer = document.getElementById('menuItems');
  menuContainer.innerHTML = '<p class="loading">Loading menu items...</p>';
  
  try {
    console.log('Starting to load menu items...');
    
    // Check if Supabase is loaded
    if (typeof supabase === 'undefined') {
      throw new Error('Supabase client not loaded');
    }
    
    // Get items from Supabase
    const menuItems = await db.getMenuItems();
    
    console.log('Menu items loaded:', menuItems);
    
    // Clear loading message
    menuContainer.innerHTML = '';
    
    // Render menu items
    if (menuItems.length === 0) {
      menuContainer.innerHTML = '<p class="no-items">No menu items yet. Add your first item!</p>';
    } else {
      menuItems.forEach(item => {
        const itemElement = createMenuItem(item);
        menuContainer.appendChild(itemElement);
      });
    }
  } catch (error) {
    console.error('Error loading menu items:', error);
    console.error('Error details:', error.message, error.stack);
    menuContainer.innerHTML = `<p class="error">Failed to load menu items: ${error.message}<br>Check console for details.</p>`;
  }
}

// Subscribe to real-time updates
function subscribeToRealtimeUpdates() {
  db.subscribeToChanges((payload) => {
    console.log('Real-time update:', payload);
    // Reload items when changes occur
    loadMenuItems();
  });
}

// Add or update menu item
async function addMenuItem() {
  const name = document.getElementById('itemName').value.trim();
  const description = document.getElementById('itemDescription').value.trim();
  const editingItemId = document.getElementById('editingItemId').value;
  
  console.log('Form submitted:', { name, description, tags: window.selectedTags, editingItemId });
  
  if (!name || window.selectedTags.length === 0) {
    alert('Please fill in all required fields and add at least one tag');
    return;
  }
  
  const itemData = {
    name: name,
    description: description,
    tags: window.selectedTags
  };
  
  console.log('Item data:', itemData);
  
  try {
    if (editingItemId) {
      // Update existing item
      console.log('Updating item ID:', editingItemId);
      await db.updateMenuItem(parseInt(editingItemId), itemData);
      showNotification('Item updated successfully!', 'success');
    } else {
      // Add new item
      console.log('Adding new item');
      await db.addMenuItem(itemData);
      showNotification('Item added successfully!', 'success');
    }
    
    // Reset form
    document.getElementById('addItemForm').reset();
    document.getElementById('addItemForm').style.display = 'none';
    document.getElementById('toggleFormBtn').textContent = '+ Add New Item';
    document.getElementById('editingItemId').value = '';
    document.getElementById('formTitle').textContent = 'Add Menu Item';
    document.getElementById('submitBtn').textContent = 'Add Item';
    window.selectedTags = [];
    updateSelectedTagsDisplay();
    
    // Reload items
    console.log('Reloading menu items...');
    await loadMenuItems();
  } catch (error) {
    console.error('Error saving item:', error);
    showNotification('Failed to save item. Please try again.', 'error');
  }
}

// Edit menu item
async function editMenuItem(id) {
  try {
    console.log('Editing item with ID:', id);
    const items = await db.getMenuItems();
    const item = items.find(i => i.id === id);
    
    console.log('Found item:', item);
    
    if (!item) {
      showNotification('Item not found', 'error');
      return;
    }
    
    // Populate form with item data
    document.getElementById('itemName').value = item.name;
    document.getElementById('itemDescription').value = item.description || '';
    document.getElementById('editingItemId').value = id;
    
    // Populate tags
    window.selectedTags = item.tags || [];
    updateSelectedTagsDisplay();
    
    console.log('Form populated with tags:', item.tags);
    
    // Update form UI
    document.getElementById('formTitle').textContent = 'Edit Menu Item';
    document.getElementById('submitBtn').textContent = 'Update Item';
    document.getElementById('addItemForm').style.display = 'block';
    document.getElementById('toggleFormBtn').textContent = '− Close Form';
    
    // Load existing tags
    await loadExistingTags();
    
    // Scroll to form
    document.getElementById('addItemForm').scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    console.error('Error loading item for edit:', error);
    showNotification('Failed to load item. Please try again.', 'error');
  }
}

// Delete menu item
async function deleteMenuItem(id) {
  if (!confirm('Are you sure you want to delete this item?')) {
    return;
  }
  
  try {
    await db.deleteMenuItem(id);
    await loadMenuItems();
    showNotification('Item deleted successfully!', 'success');
  } catch (error) {
    console.error('Error deleting item:', error);
    showNotification('Failed to delete item. Please try again.', 'error');
  }
}

// Create menu item element
function createMenuItem(item) {
  const div = document.createElement('div');
  div.className = 'menu-item';
  const tags = item.tags && item.tags.length > 0
    ? item.tags.map(tag => `<span class="item-tag">${escapeHtml(tag)}</span>`).join('')
    : '';
  const hasDescription = item.description && item.description.trim();

  div.innerHTML = `
    <div class="menu-item-content">
      ${tags}
      <div class="item-name-row">
        <h3>${escapeHtml(item.name)}</h3>
        ${hasDescription ? `<button class="expand-btn" onclick="toggleDescription(this)" title="Show description">▸</button>` : ''}
      </div>
      ${hasDescription ? `<p class="item-description collapsed">${escapeHtml(item.description)}</p>` : ''}
    </div>
    <div class="item-actions">
      <button class="edit-btn" onclick="editMenuItem(${item.id})" title="Edit item">✎</button>
      <button class="delete-btn" onclick="deleteMenuItem(${item.id})" title="Delete item">×</button>
    </div>
  `;
  return div;
}

// Toggle description visibility
function toggleDescription(btn) {
  const desc = btn.closest('.menu-item-content').querySelector('.item-description');
  const isCollapsed = desc.classList.toggle('collapsed');
  btn.textContent = isCollapsed ? '▸' : '▾';
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Show notification
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('show');
  }, 100);
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Handle online/offline status
window.addEventListener('online', () => {
  console.log('App is online');
  updateOnlineStatus(true);
});

window.addEventListener('offline', () => {
  console.log('App is offline');
  updateOnlineStatus(false);
});

function updateOnlineStatus(isOnline) {
  // Update UI to reflect online/offline status
  const statusIndicator = document.createElement('div');
  statusIndicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    padding: 8px 12px;
    border-radius: 4px;
    background-color: ${isOnline ? '#4CAF50' : '#FF5722'};
    color: white;
    font-size: 0.9rem;
    z-index: 1000;
  `;
  statusIndicator.textContent = isOnline ? 'Online' : 'Offline';
  
  document.body.appendChild(statusIndicator);
  
  setTimeout(() => {
    statusIndicator.remove();
  }, 3000);
}
