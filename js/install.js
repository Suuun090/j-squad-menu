// PWA Install functionality
let deferredPrompt;
const installBtn = document.getElementById('installBtn');

// Listen for beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing
  e.preventDefault();
  // Save the event for later use
  deferredPrompt = e;
  // Show the install button
  installBtn.style.display = 'block';
  
  console.log('Install prompt available');
});

// Handle install button click
installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) {
    return;
  }
  
  // Show the install prompt
  deferredPrompt.prompt();
  
  // Wait for the user's response
  const { outcome } = await deferredPrompt.userChoice;
  console.log(`User response to install prompt: ${outcome}`);
  
  // Clear the deferred prompt
  deferredPrompt = null;
  
  // Hide the install button
  installBtn.style.display = 'none';
});

// Listen for app installed event
window.addEventListener('appinstalled', () => {
  console.log('PWA installed successfully');
  deferredPrompt = null;
  installBtn.style.display = 'none';
});

// Check if app is already installed
if (window.matchMedia('(display-mode: standalone)').matches) {
  console.log('App is running in standalone mode');
  installBtn.style.display = 'none';
}
