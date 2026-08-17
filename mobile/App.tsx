import './global.css';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import App from './src/App';

export default function RootApp() {
  return (
    <SafeAreaProvider>
      <App />
    </SafeAreaProvider>
  );
}
