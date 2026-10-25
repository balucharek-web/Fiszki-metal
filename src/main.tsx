import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Błąd renderowania w aplikacji:', error, errorInfo);
  }

  handleReset = () => {
    localStorage.removeItem('standers_labels_multi_v1');
    localStorage.removeItem('standers_sheet_settings_v3');
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'system-ui, sans-serif',
          background: '#f8fafc',
          color: '#1e293b'
        }}>
          <div style={{
            maxWidth: '500px',
            background: '#ffffff',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
            border: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px', color: '#b91c1c' }}>
              Wystąpił problem z wczytaniem podglądu
            </h2>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>
              Zapisany stan danych mógł zawierać nieobsługiwany format. Kliknij poniższy przycisk, aby zresetować pamięć podręczną i przywrócić aplikację:
            </p>
            <div style={{
              background: '#f1f5f9',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#334155',
              fontFamily: 'monospace',
              textAlign: 'left',
              marginBottom: '20px',
              overflowX: 'auto'
            }}>
              {this.state.error?.message || 'Nieznany błąd'}
            </div>
            <button
              onClick={this.handleReset}
              style={{
                background: '#059669',
                color: '#ffffff',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '10px',
                fontWeight: 'bold',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Przywróć domyślny stan i odśwież
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
