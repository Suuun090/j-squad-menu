// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
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
  subscribeToRealtimeUpdates();
});

// Initialize form handlers
function initializeForm() {
  const toggleFormBtn = document.getElementById('toggleFormBtn');
  const addItemForm = document.getElementById('addItemForm');
  const cancelBtn = document.getElementById('cancelBtn');
  
  toggleFormBtn.addEventListener('click', () => {
    addItemForm.style.display = addItemForm.style.display === 'none' ? 'block' : 'none';
    toggleFormBtn.textContent = addItemForm.style.display === 'none' ? '+ Add New Item' : '− Close Form';
  });
  
  cancelBtn.addEventListener('click', () => {
    addItemForm.style.display = 'none';
    toggleFormBtn.textContent = '+ Add New Item';
    addItemForm.reset();
  });
  
  addItemForm.addEventListener('submit', (e) => {
    e.preventDefault();
    addMenuItem();
  });
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

// Add new menu item
async function addMenuItem() {
  const name = document.getElementById('itemName').value.trim();
  const description = document.getElementById('itemDescription').value.trim();
  const price = document.getElementById('itemPrice').value.trim();
  
  if (!name || !price) {
    alert('Please fill in all required fields');
    return;
  }
  
  const newItem = {
    name: name,
    description: description,
    price: price
  };
  
  try {
    // Add to Supabase
    await db.addMenuItem(newItem);
    
    // Reset form
    document.getElementById('addItemForm').reset();
    document.getElementById('addItemForm').style.display = 'none';
    document.getElementById('toggleFormBtn').textContent = '+ Add New Item';
    
    // Reload items
    await loadMenuItems();
    
    // Show success message
    showNotification('Item added successfully!', 'success');
  } catch (error) {
    console.error('Error adding item:', error);
    showNotification('Failed to add item. Please try again.', 'error');
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
  div.innerHTML = `
    <div class="menu-item-content">
      <h3>${escapeHtml(item.name)}</h3>
      <p>${escapeHtml(item.description)}</p>
      <p class="price"><strong>${escapeHtml(item.price)}</strong></p>
    </div>
    <button class="delete-btn" onclick="deleteMenuItem(${item.id})" title="Delete item">×</button>
  `;
  return div;
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
