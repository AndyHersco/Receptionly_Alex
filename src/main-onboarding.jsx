import './styles/onboarding.css';
import { createRoot } from 'react-dom/client';
import { NavGuardProvider } from './nav-guard';
import { Onboarding } from './onboarding';

function goToApp() { window.location.href = 'index.html?welcome=1'; }
function exitOnboarding() { window.location.href = 'index.html'; }

createRoot(document.getElementById('root')).render(
  <NavGuardProvider>
    <Onboarding onComplete={goToApp} onExit={exitOnboarding} />
  </NavGuardProvider>
);
