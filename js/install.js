// PWA Install functionality
let deferredPrompt;
const installBtn = document.getElementById('installBtn');

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone === true;

// On iOS the beforeinstallprompt event never fires — show the button manually
if (isIOS && !isStandalone) {
  installBtn.style.display = 'flex';
}

// On Android / desktop Chrome — show when the browser signals it's installable
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  window._installPromptAvailable = true;
  installBtn.style.display = 'flex';
});

installBtn.addEventListener('click', async () => {
  if (isIOS) {
    showIOSInstallTip();
    return;
  }
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  console.log(`Install prompt outcome: ${outcome}`);
  deferredPrompt = null;
  installBtn.style.display = 'none';
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  installBtn.style.display = 'none';
});

if (isStandalone) {
  installBtn.style.display = 'none';
}

function showIOSInstallTip() {
  // Remove any existing tip
  const existing = document.getElementById('iosTip');
  if (existing) { existing.remove(); return; }

  const tip = document.createElement('div');
  tip.id = 'iosTip';
  tip.className = 'ios-install-tip';
  tip.innerHTML = `
    <strong>Add to Home Screen</strong>
    <p>Tap the <strong>Share</strong> button
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
        <polyline points="16 6 12 2 8 6"/>
        <line x1="12" y1="2" x2="12" y2="15"/>
      </svg>
      then <strong>"Add to Home Screen"</strong></p>
    <button class="ios-tip-close" onclick="document.getElementById('iosTip').remove()">✕</button>
  `;
  document.body.appendChild(tip);

  // Auto-dismiss after 6 seconds
  setTimeout(() => tip.remove(), 6000);
}
