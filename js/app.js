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
});

// Load menu items (placeholder function)
function loadMenuItems() {
  const menuContainer = document.getElementById('menuItems');
  
  // Sample menu data
  const menuItems = [
    { id: 1, name: 'Sample Item 1', description: 'Description for item 1', price: '$10.99' },
    { id: 2, name: 'Sample Item 2', description: 'Description for item 2', price: '$12.99' },
    { id: 3, name: 'Sample Item 3', description: 'Description for item 3', price: '$8.99' }
  ];
  
  // Render menu items
  menuItems.forEach(item => {
    const itemElement = createMenuItem(item);
    menuContainer.appendChild(itemElement);
  });
}

// Create menu item element
function createMenuItem(item) {
  const div = document.createElement('div');
  div.className = 'menu-item';
  div.innerHTML = `
    <h3>${item.name}</h3>
    <p>${item.description}</p>
    <p class="price"><strong>${item.price}</strong></p>
  `;
  return div;
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
