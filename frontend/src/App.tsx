import AppContent from './AppContent';
import { StatusBarProvider } from './hooks/useStatus';
import WailsActivityBridge from './hooks/WailsActivityBridge';

function App() {
  return (
    <StatusBarProvider>
      <WailsActivityBridge />
      <AppContent />
    </StatusBarProvider>
  );
}

export default App;
