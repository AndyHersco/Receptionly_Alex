import './styles/onboarding.css';
import { createRoot } from 'react-dom/client';
import { NavGuardProvider } from './nav-guard';
import { Onboarding } from './onboarding';

function goToApp() {
  // Reload the workspace with a flag so the app shows a confirmation banner.
  const params = new URLSearchParams();
  params.set('newLocation', (window.__newLocationName || 'New location'));
  window.location.href = 'index.html?' + params.toString();
}
function exitOnboarding() { window.location.href = 'index.html'; }

createRoot(document.getElementById('root')).render(
  <NavGuardProvider>
    <Onboarding mode="new-location" onComplete={goToApp} onExit={exitOnboarding} />
  </NavGuardProvider>
);
