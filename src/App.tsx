import { useState, useCallback, useEffect, Component, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import QRConnect from './components/QRConnect';
import Dashboard from './components/Dashboard';
import { SettingsProvider } from './contexts/SettingsContext';

type Page = 'login' | 'register' | 'qrcode' | 'dashboard';

/* Error Boundary */
class ErrorBoundary extends Component<{children: ReactNode}, {error: string|null}> {
  state = { error: null as string|null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{padding:40,textAlign:'center',fontFamily:'Inter,system-ui,sans-serif'}}>
          <h2 style={{color:'#ef4444'}}>出错了</h2>
          <p style={{color:'#666',margin:'12px 0'}}>{this.state.error}</p>
          <button onClick={()=>{localStorage.clear();location.reload()}}
            style={{padding:'10px 24px',borderRadius:12,border:'none',background:'#C89F7E',color:'white',cursor:'pointer',fontSize:14}}>
            清除缓存并刷新
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [page, setPage] = useState<Page>('login');
  const [initialized, setInitialized] = useState(false);

  /* Check saved session on mount */
  useEffect(() => {
    try {
      const saved = localStorage.getItem('aperture_session');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.loggedIn) {
          setPage('qrcode');
        }
      }
    } catch {}
    setInitialized(true);
  }, []);

  const goRegister = useCallback(() => setPage('register'), []);
  const goLogin = useCallback(() => setPage('login'), []);
  const goQr = useCallback(() => setPage('qrcode'), []);
  const goDashboard = useCallback(() => setPage('dashboard'), []);

  /* Logout — clear saved session */
  const handleLogout = useCallback(() => {
    try { localStorage.removeItem('aperture_session') } catch {}
    setPage('login');
  }, []);

  if (!initialized) return null;

  return (
    <ErrorBoundary>
    <AnimatePresence mode="wait">
      {page === 'login' && (
        <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <LoginPage onRegister={goRegister} onLoginSuccess={goQr} />
        </motion.div>
      )}
      {page === 'register' && (
        <motion.div key="register" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <RegisterPage onLogin={goLogin} />
        </motion.div>
      )}
      {page === 'qrcode' && (
        <motion.div key="qrcode" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <QRConnect onConnected={goDashboard} onLogout={handleLogout} />
        </motion.div>
      )}
      {page === 'dashboard' && (
        <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <SettingsProvider>
            <Dashboard onLogout={handleLogout} />
          </SettingsProvider>
        </motion.div>
      )}
    </AnimatePresence>
    </ErrorBoundary>
  );
}
