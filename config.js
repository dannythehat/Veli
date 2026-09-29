// Browser settings for the VELI site.
// The public site address (SITE_URL) is set once in .github/workflows/deploy-cloudflare.yml.
window.VELI_CONFIG = {
  // Cloudflare dashboard > Analytics & Logs > Web Analytics > your site > token. Empty turns analytics off.
  cfAnalyticsToken: ''
};

// Cloudflare Web Analytics has no custom events, so each event is recorded as a virtual page view
// such as /check/quiz_start or /check/email_signup. Look under Paths in the analytics dashboard.
// The quiz always calls this so the browser back button works; the address only changes when analytics is on.
window.veliTrack = (eventName, state = window.history.state) => {
  if (!window.history?.pushState) return;
  const path = window.VELI_CONFIG.cfAnalyticsToken ? `/check/${eventName}` : window.location.pathname;
  window.history.pushState(state, '', path);
};

if (window.VELI_CONFIG.cfAnalyticsToken) {
  const beacon = document.createElement('script');
  beacon.defer = true;
  beacon.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  beacon.dataset.cfBeacon = JSON.stringify({ token: window.VELI_CONFIG.cfAnalyticsToken, spa: true });
  document.head.appendChild(beacon);
}
