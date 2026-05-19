import React, { useState, useEffect, useCallback, useRef, createContext, useContext, Component } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, Link } from 'react-router-dom';
import api from './services/api';
import {
  WorkflowTriggersPage,
  BottleneckHeatmapPage,
  AnomalyDetectionPage,
  WorkflowBuilderPage,
  ComplianceWatchdogPage,
  ProcessAnalyticsPage,
  NotificationsPage,
  AIStreamPage,
  WebhooksPage,
  AIToolboxPage,
  BacklogToolsPage,
} from './pages/NewFeaturesPages';
import CustomViewsPage from './pages/CustomViewsPage';

// ============================================
// TOAST NOTIFICATION SYSTEM
// ============================================
const ToastContext = createContext(null);

export const useToast = () => useContext(ToastContext);

const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <span className="toast-icon">
              {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : toast.type === 'warning' ? '⚠' : 'ℹ'}
            </span>
            <span className="toast-message">{toast.message}</span>
            <button className="toast-close" onClick={() => removeToast(toast.id)}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// ============================================
// CONFIRM DIALOG
// ============================================
const ConfirmDialog = ({ title, message, type = 'danger', onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel' }) => {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className={`confirm-icon confirm-icon-${type}`}>
          {type === 'danger' ? '⚠' : '?'}
        </div>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="confirm-actions">
          <button className="btn btn-secondary" onClick={onCancel}>{cancelText}</button>
          <button className={`btn ${type === 'danger' ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// ERROR BOUNDARY
// ============================================
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <h1>Something went wrong</h1>
            <p>An unexpected error occurred. Please try refreshing the page.</p>
            <button className="btn btn-primary" onClick={() => { this.setState({ hasError: false }); window.location.href = '/dashboard'; }}>
              Go to Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================
// LOADING SKELETON
// ============================================
const LoadingSkeleton = ({ rows = 5, cols = 4 }) => {
  return (
    <div className="data-section">
      <table className="data-table">
        <thead>
          <tr>
            {Array.from({ length: cols }, (_, i) => (
              <th key={i}><div className="skeleton skeleton-text" style={{ width: '60%' }}></div></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }, (_, c) => (
                <td key={c}><div className="skeleton skeleton-text" style={{ width: `${60 + Math.random() * 30}%` }}></div></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ============================================
// EMPTY STATE
// ============================================
const EmptyState = ({ title = 'No items found', message = 'Try adjusting your search or filters', onAction, actionLabel = 'Create New' }) => {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">📭</div>
      <h3>{title}</h3>
      <p>{message}</p>
      {onAction && (
        <button className="btn btn-primary" onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  );
};

// ============================================
// AUTH CONTEXT
// ============================================
const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', response.data.token);
    localStorage.setItem('user', JSON.stringify(response.data.user));
    setUser(response.data.user);
    return response.data;
  };

  const register = async (name, email, password) => {
    const response = await api.post('/auth/register', { name, email, password });
    localStorage.setItem('token', response.data.token);
    localStorage.setItem('user', JSON.stringify(response.data.user));
    setUser(response.data.user);
    return response.data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // ignore errors on logout
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  if (loading) {
    return <div className="loading"><div className="loading-spinner"></div></div>;
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// ============================================
// LOGIN PAGE (with Register + Password Reset)
// ============================================
const LoginPage = () => {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleAutoFill = () => {
    setEmail('admin@company.com');
    setPassword('admin123');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (name.length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }
    setLoading(true);
    try {
      await register(name, email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const response = await api.post('/auth/forgot-password', { email });
      setSuccess('If that email is registered, a reset token has been generated.');
      if (response.data.resetToken) {
        setResetToken(response.data.resetToken);
        setMode('reset');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error sending reset token');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token: resetToken, newPassword });
      setSuccess('Password reset successfully! You can now log in.');
      setTimeout(() => setMode('login'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>AI Business Automation</h1>
        <p>{mode === 'login' ? 'Sign in to manage your workflows' : mode === 'register' ? 'Create a new account' : mode === 'forgot' ? 'Reset your password' : 'Enter new password'}</p>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {mode === 'login' && (
          <>
            <button onClick={handleAutoFill} className="btn btn-autofill">
              Click to Auto-fill Demo Credentials
            </button>
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" required />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</button>
            </form>
            <div className="login-links">
              <button className="link-btn" onClick={() => { setMode('register'); setError(''); setSuccess(''); }}>Create an account</button>
              <button className="link-btn" onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }}>Forgot password?</button>
            </div>
          </>
        )}

        {mode === 'register' && (
          <>
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label>Full Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your full name" required />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" required />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" required />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating account...' : 'Create Account'}</button>
            </form>
            <div className="login-links">
              <button className="link-btn" onClick={() => { setMode('login'); setError(''); setSuccess(''); }}>Back to Sign In</button>
            </div>
          </>
        )}

        {mode === 'forgot' && (
          <>
            <form onSubmit={handleForgotPassword}>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your registered email" required />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Sending...' : 'Send Reset Token'}</button>
            </form>
            <div className="login-links">
              <button className="link-btn" onClick={() => { setMode('login'); setError(''); setSuccess(''); }}>Back to Sign In</button>
            </div>
          </>
        )}

        {mode === 'reset' && (
          <>
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label>Reset Token</label>
                <input type="text" value={resetToken} onChange={(e) => setResetToken(e.target.value)} placeholder="Enter reset token" required />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 6 characters" required />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Resetting...' : 'Reset Password'}</button>
            </form>
            <div className="login-links">
              <button className="link-btn" onClick={() => { setMode('login'); setError(''); setSuccess(''); }}>Back to Sign In</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ============================================
// SIDEBAR (with profile link + mobile toggle)
// ============================================
const Sidebar = ({ mobileOpen, onMobileClose }) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleNav = (path) => {
    navigate(path);
    if (onMobileClose) onMobileClose();
  };

  const menuItems = [
    { path: '/dashboard', icon: '📊', label: 'Dashboard' },
    { path: '/workflows', icon: '🔄', label: 'Workflows' },
    { path: '/documents', icon: '📄', label: 'Documents' },
    { path: '/approvals', icon: '✅', label: 'Approvals' },
    { path: '/tasks', icon: '⚡', label: 'Automation Tasks' },
    { path: '/emails', icon: '📧', label: 'Email Processing' },
    { path: '/invoices', icon: '💰', label: 'Invoices' },
    { path: '/contracts', icon: '📝', label: 'Contracts' },
    { path: '/tickets', icon: '🎫', label: 'Support Tickets' },
    { path: '/onboarding', icon: '👋', label: 'HR Onboarding' },
    { path: '/expenses', icon: '💳', label: 'Expenses' },
    { path: '/meetings', icon: '📅', label: 'Meetings' },
    { path: '/reports', icon: '📈', label: 'Reports' },
    { path: '/data-entry', icon: '📋', label: 'Data Entry' },
    { path: '/compliance', icon: '🛡️', label: 'Compliance' },
    { path: '/vendors', icon: '🏢', label: 'Vendors' },
    { path: '/process-mining', icon: '🔍', label: 'Process Miner' },
    { path: '/workflow-optimizer', icon: '⚙️', label: 'Workflow Optimizer' },
    { path: '/rpa-scripts', icon: '🤖', label: 'RPA Scripts' },
    { path: '/exception-handler', icon: '🚨', label: 'Exception Handler' },
    { path: '/roi-calculator', icon: '💹', label: 'ROI Calculator' },
    // ===== NEW (Audit-driven) =====
    { path: '/process-analytics', icon: '📊', label: 'Process Analytics' },
    { path: '/notifications', icon: '🔔', label: 'Notifications' },
    { path: '/ai-stream', icon: '🌊', label: 'AI Streaming' },
    { path: '/workflow-triggers', icon: '⏰', label: 'Workflow Triggers' },
    { path: '/bottleneck-heatmap', icon: '🔥', label: 'Bottleneck Heatmap' },
    { path: '/anomaly-detection', icon: '🚨', label: 'Anomaly Detection' },
    { path: '/workflow-builder', icon: '💬', label: 'NL Workflow Builder' },
    { path: '/compliance-watchdog', icon: '🛡️', label: 'Compliance Watchdog' },
    { path: '/webhooks', icon: '📡', label: 'Webhooks' },
    { path: '/ai-toolbox', icon: '🧠', label: 'AI Toolbox' },
    { path: '/backlog-tools', icon: '🧰', label: 'Backlog Tools' },
    { path: '/custom-views', icon: '🗂️', label: 'Automation Views' },
  ];

  return (
    <>
      {mobileOpen && <div className="sidebar-overlay" onClick={onMobileClose}></div>}
      <div className={`sidebar ${mobileOpen ? 'sidebar-mobile-open' : ''}`}>
        <div className="sidebar-logo">
          <h2>AI Automation</h2>
          <span>Business Platform</span>
        </div>
        <ul className="sidebar-nav">
          {menuItems.map((item) => (
            <li key={item.path}>
              <a onClick={() => handleNav(item.path)} style={{ cursor: 'pointer' }}>
                <span className="icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </a>
            </li>
          ))}
          <li className="sidebar-divider"></li>
          <li>
            <a onClick={() => handleNav('/profile')} style={{ cursor: 'pointer' }}>
              <span className="icon">👤</span>
              <span className="nav-label">Profile</span>
            </a>
          </li>
          <li>
            <a onClick={handleLogout} style={{ cursor: 'pointer' }}>
              <span className="icon">🚪</span>
              <span className="nav-label">Logout</span>
            </a>
          </li>
        </ul>
      </div>
    </>
  );
};

// ============================================
// LAYOUT WRAPPER (with hamburger menu)
// ============================================
const Layout = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="dashboard">
      <button className="hamburger-btn" onClick={() => setMobileOpen(true)}>☰</button>
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="main-content">
        {children}
      </div>
    </div>
  );
};

// ============================================
// PROFILE PAGE
// ============================================
const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const { addToast } = useToast();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.get('/auth/me');
        setProfileData(response.data);
        setName(response.data.name);
        setEmail(response.data.email);
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };
    fetchProfile();
  }, []);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (newPassword && newPassword !== confirmPassword) {
      addToast('Passwords do not match', 'error');
      return;
    }
    if (newPassword && newPassword.length < 6) {
      addToast('Password must be at least 6 characters', 'error');
      return;
    }
    setLoading(true);
    try {
      const payload = { name, email };
      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }
      const response = await api.put('/auth/profile', payload);
      updateUser({ ...user, name: response.data.name, email: response.data.email });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      addToast('Profile updated successfully', 'success');
    } catch (err) {
      addToast(err.response?.data?.error || 'Error updating profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="back-button" onClick={() => window.history.back()}>← Back</div>
      <div className="page-header">
        <h1>My Profile</h1>
      </div>
      <div className="detail-view">
        <div className="detail-content">
          <form onSubmit={handleUpdateProfile}>
            <div className="profile-section">
              <h3>Personal Information</h3>
              <div className="form-group">
                <label>Full Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Role</label>
                <input type="text" value={user?.role || ''} disabled />
              </div>
              {profileData && (
                <div className="form-group">
                  <label>Member Since</label>
                  <input type="text" value={new Date(profileData.created_at).toLocaleDateString()} disabled />
                </div>
              )}
            </div>
            <div className="profile-section">
              <h3>Change Password</h3>
              <div className="form-group">
                <label>Current Password</label>
                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Required to change password" />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 6 characters" />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat new password" />
              </div>
            </div>
            <div className="profile-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

// ============================================
// DASHBOARD
// ============================================
const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({});

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const endpoints = ['workflows', 'documents', 'approvals', 'tasks', 'emails',
          'invoices', 'contracts', 'tickets', 'onboarding', 'expenses', 'meetings',
          'reports', 'data-entry', 'compliance', 'vendors',
          'process-mining', 'workflow-optimizer', 'rpa-scripts', 'exception-handler', 'roi-calculator'];

        const results = await Promise.all(
          endpoints.map(ep => api.get(`/${ep}?limit=1`).catch(() => ({ data: { pagination: { total: 0 } } })))
        );

        const statsObj = {};
        endpoints.forEach((ep, i) => {
          const res = results[i].data;
          statsObj[ep] = res.pagination ? res.pagination.total : (Array.isArray(res) ? res.length : 0);
        });
        setStats(statsObj);
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };
    fetchStats();
  }, []);

  const features = [
    { key: 'workflows', path: '/workflows', icon: '🔄', color: '#3b82f6', title: 'Workflows', desc: 'Automate business processes' },
    { key: 'documents', path: '/documents', icon: '📄', color: '#10b981', title: 'Documents', desc: 'Smart document routing' },
    { key: 'approvals', path: '/approvals', icon: '✅', color: '#f59e0b', title: 'Approvals', desc: 'Manage approval chains' },
    { key: 'tasks', path: '/tasks', icon: '⚡', color: '#8b5cf6', title: 'Automation', desc: 'Scheduled task automation' },
    { key: 'emails', path: '/emails', icon: '📧', color: '#ec4899', title: 'Emails', desc: 'AI email processing' },
    { key: 'invoices', path: '/invoices', icon: '💰', color: '#14b8a6', title: 'Invoices', desc: 'Invoice management' },
    { key: 'contracts', path: '/contracts', icon: '📝', color: '#6366f1', title: 'Contracts', desc: 'Contract analysis' },
    { key: 'tickets', path: '/tickets', icon: '🎫', color: '#f43f5e', title: 'Tickets', desc: 'Support ticket handling' },
    { key: 'onboarding', path: '/onboarding', icon: '👋', color: '#22c55e', title: 'Onboarding', desc: 'HR onboarding flows' },
    { key: 'expenses', path: '/expenses', icon: '💳', color: '#eab308', title: 'Expenses', desc: 'Expense reporting' },
    { key: 'meetings', path: '/meetings', icon: '📅', color: '#0ea5e9', title: 'Meetings', desc: 'Meeting scheduler' },
    { key: 'reports', path: '/reports', icon: '📈', color: '#a855f7', title: 'Reports', desc: 'Report generation' },
    { key: 'data-entry', path: '/data-entry', icon: '📋', color: '#64748b', title: 'Data Entry', desc: 'Automated data extraction' },
    { key: 'compliance', path: '/compliance', icon: '🛡️', color: '#059669', title: 'Compliance', desc: 'Compliance monitoring' },
    { key: 'vendors', path: '/vendors', icon: '🏢', color: '#7c3aed', title: 'Vendors', desc: 'Vendor management' },
    { key: 'process-mining', path: '/process-mining', icon: '🔍', color: '#0891b2', title: 'Process Miner', desc: 'AI process discovery' },
    { key: 'workflow-optimizer', path: '/workflow-optimizer', icon: '⚙️', color: '#dc2626', title: 'Workflow Optimizer', desc: 'AI workflow optimization' },
    { key: 'rpa-scripts', path: '/rpa-scripts', icon: '🤖', color: '#4f46e5', title: 'RPA Scripts', desc: 'AI script generation' },
    { key: 'exception-handler', path: '/exception-handler', icon: '🚨', color: '#ea580c', title: 'Exception Handler', desc: 'AI exception resolution' },
    { key: 'roi-calculator', path: '/roi-calculator', icon: '💹', color: '#16a34a', title: 'ROI Calculator', desc: 'Automation ROI analysis' },
  ];

  return (
    <Layout>
      <div className="page-header">
        <h1>Welcome, {user?.name || 'User'}</h1>
        <div className="user-menu">
          <div className="user-avatar" onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }}>{user?.name?.charAt(0) || 'U'}</div>
        </div>
      </div>
      <div className="cards-grid">
        {features.map((feature) => (
          <div key={feature.key} className="feature-card" onClick={() => navigate(feature.path)}>
            <div className="icon" style={{ background: `${feature.color}20`, color: feature.color }}>{feature.icon}</div>
            <h3>{feature.title}</h3>
            <p>{feature.desc}</p>
            <div className="stats">
              <span className="stat"><strong>{stats[feature.key] || 0}</strong> items</span>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
};

// ============================================
// BULK UPDATE DIALOG
// ============================================
const BulkUpdateDialog = ({ count, formFields, onConfirm, onCancel }) => {
  const [status, setStatus] = useState('');

  // Find status options from formFields
  const statusField = formFields.find(f => f.key === 'status');
  const options = statusField?.options || statusOptions;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Update {count} item(s)</h3>
        <p>Select the new status for the selected items:</p>
        <div className="form-group" style={{ marginTop: '16px' }}>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Select status</option>
            {options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="confirm-actions">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={() => status && onConfirm(status)} disabled={!status}>Update</button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// LIST PAGE (fully refactored)
// ============================================
const ListPage = ({ title, endpoint, columns, icon, formFields }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState({ field: 'id', order: 'DESC' });
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);
  const navigate = useNavigate();
  const { addToast } = useToast();
  const searchTimer = useRef(null);

  // Debounce search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', pagination.page);
      params.set('limit', pagination.limit);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (sort.field) params.set('sort', sort.field);
      if (sort.order) params.set('order', sort.order);
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });

      const response = await api.get(`/${endpoint}?${params.toString()}`);
      const res = response.data;
      if (res.data && res.pagination) {
        setData(res.data);
        setPagination(prev => ({ ...prev, total: res.pagination.total, totalPages: res.pagination.totalPages }));
      } else {
        // Fallback for non-paginated response
        setData(Array.isArray(res) ? res : []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      addToast('Error fetching data', 'error');
    } finally {
      setLoading(false);
    }
  }, [endpoint, pagination.page, pagination.limit, debouncedSearch, sort, filters, addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset state when endpoint changes
  useEffect(() => {
    setSearch('');
    setDebouncedSearch('');
    setFilters({});
    setSort({ field: 'created_at', order: 'DESC' });
    setSelectedIds([]);
    setPagination({ page: 1, limit: 15, total: 0, totalPages: 0 });
  }, [endpoint]);

  const handleRowClick = (item) => {
    navigate(`/${endpoint}/${item.id}`);
  };

  const handleSort = (field) => {
    setSort(prev => ({
      field,
      order: prev.field === field && prev.order === 'ASC' ? 'DESC' : 'ASC'
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(data.map(item => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id, e) => {
    e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    try {
      await api.post(`/${endpoint}/bulk-delete`, { ids: selectedIds });
      addToast(`${selectedIds.length} item(s) deleted`, 'success');
      setSelectedIds([]);
      setShowBulkDelete(false);
      fetchData();
    } catch (error) {
      addToast('Error deleting items', 'error');
      setShowBulkDelete(false);
    }
  };

  const handleBulkUpdate = async (status) => {
    try {
      await api.post(`/${endpoint}/bulk-update`, { ids: selectedIds, updates: { status } });
      addToast(`${selectedIds.length} item(s) updated`, 'success');
      setSelectedIds([]);
      setShowBulkUpdate(false);
      fetchData();
    } catch (error) {
      addToast('Error updating items', 'error');
      setShowBulkUpdate(false);
    }
  };

  const handleExportCSV = () => {
    const token = localStorage.getItem('token');
    window.open(`http://localhost:5001/api/${endpoint}/export/csv?token=${token}`, '_blank');
    // Use fetch as fallback for auth
    api.get(`/${endpoint}/export/csv`, { responseType: 'blob' }).then(res => {
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${endpoint}_export.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      addToast('CSV exported successfully', 'success');
    }).catch(() => addToast('Error exporting CSV', 'error'));
  };

  const handleExportPDF = () => {
    api.get(`/${endpoint}/export/pdf`, { responseType: 'blob' }).then(res => {
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${endpoint}_export.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      addToast('PDF exported successfully', 'success');
    }).catch(() => addToast('Error exporting PDF', 'error'));
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Get filter options from formFields
  const getFilterableFields = () => {
    return formFields.filter(f => f.type === 'select' && f.options);
  };

  const getStatusClass = (status) => {
    if (!status) return '';
    return `status-${status.toLowerCase().replace(/ /g, '_')}`;
  };

  const formatValue = (value, column) => {
    if (value === null || value === undefined) return '-';
    if (column.key === 'status') return <span className={`status-badge ${getStatusClass(value)}`}>{value}</span>;
    if (column.key === 'priority' || column.key === 'severity' || column.key === 'complexity') {
      return <span className={`priority-${(value || '').toLowerCase()}`}>{value}</span>;
    }
    if (column.key === 'amount' || column.key === 'value' || column.key === 'contract_value' ||
        column.key === 'implementation_cost' || column.key === 'annual_savings') {
      return `$${parseFloat(value).toLocaleString()}`;
    }
    if (column.key.includes('date') && value) {
      return new Date(value).toLocaleDateString();
    }
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'string' && value.length > 60) return value.substring(0, 60) + '...';
    return value;
  };

  return (
    <Layout>
      <div className="back-button" onClick={() => navigate('/dashboard')}>← Back to Dashboard</div>
      <div className="page-header">
        <h1>{icon} {title}</h1>
        <div className="page-header-actions">
          <button className="btn btn-export" onClick={handleExportCSV} title="Export CSV">CSV</button>
          <button className="btn btn-export" onClick={handleExportPDF} title="Export PDF">PDF</button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Item</button>
        </div>
      </div>

      {/* Toolbar: Search + Filters */}
      <div className="list-toolbar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && <button className="search-clear" onClick={() => setSearch('')}>×</button>}
        </div>
        <div className="filter-group">
          {getFilterableFields().map(field => (
            <select
              key={field.key}
              value={filters[field.key] || ''}
              onChange={(e) => handleFilterChange(field.key, e.target.value)}
              className="filter-select"
            >
              <option value="">All {field.label}</option>
              {field.options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ))}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="bulk-actions-bar">
          <span>{selectedIds.length} item(s) selected</span>
          <div className="bulk-actions-buttons">
            <button className="btn btn-sm btn-primary" onClick={() => setShowBulkUpdate(true)}>Update Status</button>
            <button className="btn btn-sm btn-danger" onClick={() => setShowBulkDelete(true)}>Delete</button>
            <button className="btn btn-sm btn-secondary" onClick={() => setSelectedIds([])}>Clear</button>
          </div>
        </div>
      )}

      {/* Data Table */}
      {loading ? (
        <LoadingSkeleton rows={8} cols={columns.length + 1} />
      ) : data.length === 0 ? (
        <EmptyState
          title={debouncedSearch || Object.values(filters).some(v => v) ? 'No matching items' : `No ${title.toLowerCase()} yet`}
          message={debouncedSearch || Object.values(filters).some(v => v) ? 'Try adjusting your search or filters' : `Create your first ${title.toLowerCase().replace(/s$/, '')}`}
          onAction={() => setShowModal(true)}
          actionLabel="+ Create New"
        />
      ) : (
        <div className="data-section">
          <table className="data-table">
            <thead>
              <tr>
                <th className="checkbox-col">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === data.length && data.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                {columns.map((col) => (
                  <th key={col.key} onClick={() => handleSort(col.key)} className="sortable-th">
                    {col.label}
                    {sort.field === col.key && (
                      <span className="sort-indicator">{sort.order === 'ASC' ? ' ▲' : ' ▼'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.id} onClick={() => handleRowClick(item)} className={selectedIds.includes(item.id) ? 'row-selected' : ''}>
                  <td className="checkbox-col" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={(e) => handleSelectRow(item.id, e)}
                    />
                  </td>
                  {columns.map((col) => (
                    <td key={col.key}>{formatValue(item[col.key], col)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button
            className="btn btn-sm btn-secondary"
            disabled={pagination.page <= 1}
            onClick={() => setPagination(prev => ({ ...prev, page: 1 }))}
          >
            First
          </button>
          <button
            className="btn btn-sm btn-secondary"
            disabled={pagination.page <= 1}
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
          >
            Prev
          </button>
          <span className="pagination-info">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} items)
          </span>
          <button
            className="btn btn-sm btn-secondary"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
          >
            Next
          </button>
          <button
            className="btn btn-sm btn-secondary"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => setPagination(prev => ({ ...prev, page: pagination.totalPages }))}
          >
            Last
          </button>
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <FormModal
          title="New Item"
          endpoint={endpoint}
          formFields={formFields}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchData(); addToast('Item created successfully', 'success'); }}
          mode="create"
        />
      )}

      {showBulkDelete && (
        <ConfirmDialog
          title="Delete Selected Items"
          message={`Are you sure you want to delete ${selectedIds.length} item(s)? This action cannot be undone.`}
          type="danger"
          confirmText="Delete"
          onConfirm={handleBulkDelete}
          onCancel={() => setShowBulkDelete(false)}
        />
      )}

      {showBulkUpdate && (
        <BulkUpdateDialog
          count={selectedIds.length}
          formFields={formFields}
          onConfirm={handleBulkUpdate}
          onCancel={() => setShowBulkUpdate(false)}
        />
      )}
    </Layout>
  );
};

// ============================================
// FORM MODAL (with validation)
// ============================================
const FormModal = ({ title, endpoint, formFields, onClose, onSuccess, mode, initialData = {} }) => {
  const [formData, setFormData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (mode === 'edit' && initialData) {
      const processedData = { ...initialData };
      formFields.forEach(field => {
        if ((field.type === 'date' || field.type === 'datetime') && processedData[field.key]) {
          const date = new Date(processedData[field.key]);
          if (field.type === 'date') {
            processedData[field.key] = date.toISOString().split('T')[0];
          } else {
            processedData[field.key] = date.toISOString().slice(0, 16);
          }
        }
      });
      setFormData(processedData);
    }
  }, [mode, initialData, formFields]);

  const validate = () => {
    const errors = {};
    formFields.forEach(field => {
      const value = formData[field.key];
      if (field.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
        errors[field.key] = `${field.label} is required`;
      }
      if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        errors[field.key] = 'Invalid email format';
      }
      if (field.type === 'number' && value !== '' && value !== undefined) {
        const num = parseFloat(value);
        if (isNaN(num)) errors[field.key] = 'Must be a valid number';
        if (field.min !== undefined && num < field.min) errors[field.key] = `Minimum value is ${field.min}`;
        if (field.max !== undefined && num > field.max) errors[field.key] = `Maximum value is ${field.max}`;
      }
      if (field.type === 'text' && value && field.maxLength && value.length > field.maxLength) {
        errors[field.key] = `Maximum ${field.maxLength} characters`;
      }
    });
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setError('');
    try {
      if (mode === 'edit') {
        await api.put(`/${endpoint}/${initialData.id}`, formData);
      } else {
        await api.post(`/${endpoint}`, formData);
      }
      onSuccess();
    } catch (err) {
      console.error('Error saving item:', err);
      setError(err.response?.data?.error || 'Error saving item. Please fill all required fields.');
    } finally {
      setLoading(false);
    }
  };

  const renderField = (field) => {
    const value = formData[field.key] || '';
    const hasError = fieldErrors[field.key];

    const inputClass = hasError ? 'input-error' : '';

    switch (field.type) {
      case 'select':
        return (
          <>
            <select
              value={value}
              onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
              required={field.required}
              className={inputClass}
            >
              <option value="">Select {field.label}</option>
              {field.options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {hasError && <span className="field-error">{hasError}</span>}
          </>
        );
      case 'textarea':
        return (
          <>
            <textarea
              value={value}
              onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              required={field.required}
              rows={4}
              className={inputClass}
            />
            {hasError && <span className="field-error">{hasError}</span>}
          </>
        );
      case 'date':
        return (
          <>
            <input type="date" value={value} onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })} required={field.required} className={inputClass} />
            {hasError && <span className="field-error">{hasError}</span>}
          </>
        );
      case 'datetime':
        return (
          <>
            <input type="datetime-local" value={value} onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })} required={field.required} className={inputClass} />
            {hasError && <span className="field-error">{hasError}</span>}
          </>
        );
      case 'number':
        return (
          <>
            <input type="number" step="0.01" value={value} onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })} placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`} required={field.required} className={inputClass} />
            {hasError && <span className="field-error">{hasError}</span>}
          </>
        );
      case 'email':
        return (
          <>
            <input type="email" value={value} onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })} placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`} required={field.required} className={inputClass} />
            {hasError && <span className="field-error">{hasError}</span>}
          </>
        );
      default:
        return (
          <>
            <input type="text" value={value} onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })} placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`} required={field.required} className={inputClass} />
            {hasError && <span className="field-error">{hasError}</span>}
          </>
        );
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-message">{error}</div>}
            {formFields.map((field) => (
              <div className="form-group" key={field.key}>
                <label>{field.label} {field.required && <span style={{color: 'red'}}>*</span>}</label>
                {renderField(field)}
              </div>
            ))}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : (mode === 'edit' ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================
// AI ANALYSIS DISPLAY
// ============================================
const AIAnalysisDisplay = ({ content }) => {
  if (!content) return null;

  const renderContent = (text) => {
    const lines = text.split('\n');
    const elements = [];
    let currentList = [];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('## ')) {
        if (currentList.length > 0) {
          elements.push(<ul key={`list-${index}`} className="ai-list">{currentList.map((item, i) => <li key={i}>{item}</li>)}</ul>);
          currentList = [];
        }
        elements.push(<h3 key={index} className="ai-section-header">{trimmedLine.replace('## ', '')}</h3>);
      } else if (trimmedLine.startsWith('### ')) {
        if (currentList.length > 0) {
          elements.push(<ul key={`list-${index}`} className="ai-list">{currentList.map((item, i) => <li key={i}>{item}</li>)}</ul>);
          currentList = [];
        }
        elements.push(<h4 key={index} className="ai-subsection-header">{trimmedLine.replace('### ', '')}</h4>);
      } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
        currentList.push(trimmedLine.substring(2));
      } else if (/^\d+\.\s/.test(trimmedLine)) {
        currentList.push(trimmedLine.replace(/^\d+\.\s/, ''));
      } else if (trimmedLine.includes('**') && trimmedLine.includes(':')) {
        if (currentList.length > 0) {
          elements.push(<ul key={`list-${index}`} className="ai-list">{currentList.map((item, i) => <li key={i}>{item}</li>)}</ul>);
          currentList = [];
        }
        const parts = trimmedLine.split(':');
        const label = parts[0].replace(/\*\*/g, '');
        const value = parts.slice(1).join(':').replace(/\*\*/g, '');
        elements.push(<div key={index} className="ai-metric"><span className="ai-metric-label">{label}:</span><span className="ai-metric-value">{value}</span></div>);
      } else if (trimmedLine.startsWith('```')) {
        // skip
      } else if (trimmedLine.length > 0) {
        if (currentList.length > 0) {
          elements.push(<ul key={`list-${index}`} className="ai-list">{currentList.map((item, i) => <li key={i}>{item}</li>)}</ul>);
          currentList = [];
        }
        elements.push(<p key={index} className="ai-paragraph">{trimmedLine}</p>);
      }
    });

    if (currentList.length > 0) {
      elements.push(<ul key="list-final" className="ai-list">{currentList.map((item, i) => <li key={i}>{item}</li>)}</ul>);
    }
    return elements;
  };

  return (
    <div className="ai-analysis-display">
      <div className="ai-analysis-header">
        <div className="ai-badge"><span className="ai-icon">🤖</span><span>AI Analysis</span></div>
        <span className="ai-powered">Powered by Claude</span>
      </div>
      <div className="ai-analysis-content">{renderContent(content)}</div>
    </div>
  );
};

// ============================================
// DETAIL PAGE (with ConfirmDialog + Toast)
// ============================================
const DetailPage = ({ title, endpoint, fields, formFields, aiAction, aiLabel }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchItem = async () => {
    try {
      const response = await api.get(`/${endpoint}/${id}`);
      setItem(response.data);
      const aiFields = ['ai_analysis', 'ai_suggestions', 'ai_evaluation', 'ai_recommendations', 'ai_resolution', 'generated_script', 'agenda'];
      for (const field of aiFields) {
        if (response.data[field]) {
          setAiResult(response.data[field]);
          break;
        }
      }
    } catch (error) {
      console.error('Error fetching item:', error);
      addToast('Error loading item', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItem();
  }, [endpoint, id]);

  const handleAiAction = async () => {
    setAiLoading(true);
    try {
      const response = await api.post(`/${endpoint}/${id}/${aiAction}`);
      const result = response.data.analysis || response.data.suggestion || response.data.evaluation ||
                     response.data.agenda || response.data.extracted || response.data.content ||
                     response.data.recommendations || response.data.resolution || response.data.script;
      setAiResult(result);
      fetchItem();
      addToast('AI analysis complete', 'success');
    } catch (error) {
      console.error('AI action error:', error);
      setAiResult('AI analysis unavailable. Please check your OpenRouter API key.');
      addToast('AI analysis failed', 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/${endpoint}/${id}`);
      addToast('Item deleted successfully', 'success');
      navigate(`/${endpoint}`);
    } catch (error) {
      addToast('Error deleting item', 'error');
    }
    setShowDeleteConfirm(false);
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    fetchItem();
    addToast('Item updated successfully', 'success');
  };

  const formatValue = (value, field) => {
    if (value === null || value === undefined) return '-';
    if (field.key.includes('date') && value) return new Date(value).toLocaleDateString();
    if (field.key === 'amount' || field.key === 'value' || field.key === 'contract_value' ||
        field.key === 'implementation_cost' || field.key === 'annual_savings' || field.key === 'current_fte_cost') {
      return `$${parseFloat(value).toLocaleString()}`;
    }
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return value;
  };

  if (loading) {
    return <Layout><div className="loading"><div className="loading-spinner"></div></div></Layout>;
  }

  if (!item) {
    return <Layout><EmptyState title="Item not found" message="The requested item could not be found" onAction={() => navigate(`/${endpoint}`)} actionLabel="Back to list" /></Layout>;
  }

  return (
    <Layout>
      <div className="back-button" onClick={() => navigate(`/${endpoint}`)}>← Back to {title}</div>
      <div className="detail-view">
        <div className="detail-header">
          <div className="detail-title">
            <h2>{item.title || item.name || item.employee_name || item.invoice_number || item.subject || `${title} #${item.id}`}</h2>
            <div className="detail-meta">
              <span>ID: {item.id}</span>
              {item.status && <span className={`status-badge status-${item.status.toLowerCase().replace(/ /g, '_')}`}>{item.status}</span>}
              {item.priority && <span className={`priority-${item.priority.toLowerCase()}`}>Priority: {item.priority}</span>}
              {item.severity && <span className={`priority-${item.severity.toLowerCase()}`}>Severity: {item.severity}</span>}
              {item.complexity && <span className={`priority-${item.complexity.toLowerCase()}`}>Complexity: {item.complexity}</span>}
            </div>
          </div>
          <div className="detail-actions">
            {aiAction && (
              <button className="btn btn-ai" onClick={handleAiAction} disabled={aiLoading}>
                {aiLoading ? 'Analyzing...' : `🤖 ${aiLabel}`}
              </button>
            )}
            <button className="btn btn-success" onClick={() => setShowEditModal(true)}>Edit</button>
            <button className="btn btn-danger" onClick={() => setShowDeleteConfirm(true)}>Delete</button>
          </div>
        </div>
        <div className="detail-content">
          <div className="detail-grid">
            {fields.map((field) => (
              <div className="detail-item" key={field.key}>
                <label>{field.label}</label>
                <div className="value">{formatValue(item[field.key], field)}</div>
              </div>
            ))}
          </div>
          {aiResult && <AIAnalysisDisplay content={aiResult} />}
        </div>
      </div>

      {showEditModal && (
        <FormModal
          title="Edit Item"
          endpoint={endpoint}
          formFields={formFields}
          onClose={() => setShowEditModal(false)}
          onSuccess={handleEditSuccess}
          mode="edit"
          initialData={item}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Item"
          message="Are you sure you want to delete this item? This action cannot be undone."
          type="danger"
          confirmText="Delete"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </Layout>
  );
};

// ============================================
// PROTECTED ROUTE
// ============================================
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  return children;
};

// ============================================
// PAGE CONFIGURATIONS
// ============================================
const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'approved', label: 'Approved' },
  { value: 'draft', label: 'Draft' },
  { value: 'completed', label: 'Completed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'paid', label: 'Paid' },
];

const priorityOptions = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const complexityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const severityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const pageConfigs = {
  workflows: {
    title: 'Workflows',
    icon: '🔄',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'description', label: 'Description' },
      { key: 'trigger_type', label: 'Trigger' },
      { key: 'status', label: 'Status' },
    ],
    formFields: [
      { key: 'name', label: 'Workflow Name', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea', required: false },
      { key: 'trigger_type', label: 'Trigger Type', type: 'select', required: true, options: [
        { value: 'manual', label: 'Manual' },
        { value: 'scheduled', label: 'Scheduled' },
        { value: 'email', label: 'Email' },
        { value: 'document_upload', label: 'Document Upload' },
        { value: 'form_submission', label: 'Form Submission' },
        { value: 'condition', label: 'Condition Based' },
      ]},
      { key: 'status', label: 'Status', type: 'select', required: false, options: statusOptions },
    ],
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'description', label: 'Description' },
      { key: 'trigger_type', label: 'Trigger Type' },
      { key: 'steps', label: 'Steps' },
      { key: 'status', label: 'Status' },
      { key: 'created_at', label: 'Created' },
    ],
    aiAction: null, aiLabel: null,
  },
  documents: {
    title: 'Documents', icon: '📄',
    columns: [
      { key: 'title', label: 'Title' }, { key: 'document_type', label: 'Type' },
      { key: 'department', label: 'Department' }, { key: 'status', label: 'Status' },
    ],
    formFields: [
      { key: 'title', label: 'Document Title', type: 'text', required: true },
      { key: 'content', label: 'Content', type: 'textarea', required: false },
      { key: 'document_type', label: 'Document Type', type: 'select', required: true, options: [
        { value: 'report', label: 'Report' }, { value: 'policy', label: 'Policy' }, { value: 'contract', label: 'Contract' },
        { value: 'plan', label: 'Plan' }, { value: 'certificate', label: 'Certificate' }, { value: 'minutes', label: 'Minutes' },
        { value: 'training', label: 'Training' }, { value: 'technical', label: 'Technical' }, { value: 'marketing', label: 'Marketing' },
      ]},
      { key: 'department', label: 'Department', type: 'select', required: true, options: [
        { value: 'Finance', label: 'Finance' }, { value: 'HR', label: 'HR' }, { value: 'Legal', label: 'Legal' },
        { value: 'Marketing', label: 'Marketing' }, { value: 'IT', label: 'IT' }, { value: 'Sales', label: 'Sales' },
        { value: 'Operations', label: 'Operations' }, { value: 'Product', label: 'Product' }, { value: 'Engineering', label: 'Engineering' },
        { value: 'Executive', label: 'Executive' },
      ]},
      { key: 'status', label: 'Status', type: 'select', required: false, options: statusOptions },
    ],
    fields: [
      { key: 'title', label: 'Title' }, { key: 'content', label: 'Content' }, { key: 'document_type', label: 'Document Type' },
      { key: 'department', label: 'Department' }, { key: 'status', label: 'Status' }, { key: 'created_at', label: 'Created' },
    ],
    aiAction: 'analyze', aiLabel: 'Analyze Document',
  },
  approvals: {
    title: 'Approvals', icon: '✅',
    columns: [
      { key: 'title', label: 'Title' }, { key: 'request_type', label: 'Type' },
      { key: 'amount', label: 'Amount' }, { key: 'priority', label: 'Priority' }, { key: 'status', label: 'Status' },
    ],
    formFields: [
      { key: 'title', label: 'Request Title', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea', required: false },
      { key: 'request_type', label: 'Request Type', type: 'select', required: true, options: [
        { value: 'purchase', label: 'Purchase' }, { value: 'budget', label: 'Budget' }, { value: 'travel', label: 'Travel' },
        { value: 'hiring', label: 'Hiring' }, { value: 'contract', label: 'Contract' }, { value: 'facilities', label: 'Facilities' },
        { value: 'training', label: 'Training' }, { value: 'payment', label: 'Payment' }, { value: 'service', label: 'Service' },
        { value: 'event', label: 'Event' },
      ]},
      { key: 'amount', label: 'Amount ($)', type: 'number', required: true },
      { key: 'priority', label: 'Priority', type: 'select', required: false, options: priorityOptions },
      { key: 'status', label: 'Status', type: 'select', required: false, options: statusOptions },
    ],
    fields: [
      { key: 'title', label: 'Title' }, { key: 'description', label: 'Description' }, { key: 'request_type', label: 'Request Type' },
      { key: 'amount', label: 'Amount' }, { key: 'priority', label: 'Priority' }, { key: 'status', label: 'Status' }, { key: 'created_at', label: 'Created' },
    ],
    aiAction: null, aiLabel: null,
  },
  tasks: {
    title: 'Automation Tasks', icon: '⚡',
    columns: [
      { key: 'title', label: 'Title' }, { key: 'task_type', label: 'Type' },
      { key: 'schedule', label: 'Schedule' }, { key: 'status', label: 'Status' },
    ],
    formFields: [
      { key: 'title', label: 'Task Title', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea', required: false },
      { key: 'task_type', label: 'Task Type', type: 'select', required: true, options: [
        { value: 'scheduled', label: 'Scheduled' }, { value: 'trigger', label: 'Trigger Based' },
      ]},
      { key: 'schedule', label: 'Schedule (cron)', type: 'text', required: false, placeholder: '0 9 * * *' },
      { key: 'trigger_condition', label: 'Trigger Condition', type: 'text', required: false },
      { key: 'status', label: 'Status', type: 'select', required: false, options: [
        { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'paused', label: 'Paused' },
      ]},
    ],
    fields: [
      { key: 'title', label: 'Title' }, { key: 'description', label: 'Description' }, { key: 'task_type', label: 'Task Type' },
      { key: 'schedule', label: 'Schedule' }, { key: 'trigger_condition', label: 'Trigger Condition' },
      { key: 'status', label: 'Status' }, { key: 'last_run', label: 'Last Run' }, { key: 'run_count', label: 'Run Count' },
    ],
    aiAction: null, aiLabel: null,
  },
  emails: {
    title: 'Emails', icon: '📧',
    columns: [
      { key: 'subject', label: 'Subject' }, { key: 'from_address', label: 'From' },
      { key: 'category', label: 'Category' }, { key: 'priority', label: 'Priority' }, { key: 'status', label: 'Status' },
    ],
    formFields: [
      { key: 'from_address', label: 'From Email', type: 'email', required: true },
      { key: 'to_address', label: 'To Email', type: 'email', required: true },
      { key: 'subject', label: 'Subject', type: 'text', required: true },
      { key: 'body', label: 'Body', type: 'textarea', required: false },
      { key: 'category', label: 'Category', type: 'select', required: false, options: [
        { value: 'general', label: 'General' }, { value: 'support', label: 'Support' },
        { value: 'sales', label: 'Sales' }, { value: 'billing', label: 'Billing' },
      ]},
      { key: 'priority', label: 'Priority', type: 'select', required: false, options: priorityOptions },
      { key: 'status', label: 'Status', type: 'select', required: false, options: [
        { value: 'unread', label: 'Unread' }, { value: 'read', label: 'Read' },
        { value: 'replied', label: 'Replied' }, { value: 'archived', label: 'Archived' },
      ]},
    ],
    fields: [
      { key: 'subject', label: 'Subject' }, { key: 'from_address', label: 'From' }, { key: 'to_address', label: 'To' },
      { key: 'body', label: 'Body' }, { key: 'category', label: 'Category' }, { key: 'priority', label: 'Priority' },
      { key: 'status', label: 'Status' }, { key: 'received_at', label: 'Received' },
    ],
    aiAction: 'categorize', aiLabel: 'AI Categorize',
  },
  invoices: {
    title: 'Invoices', icon: '💰',
    columns: [
      { key: 'invoice_number', label: 'Invoice #' }, { key: 'vendor_name', label: 'Vendor' },
      { key: 'amount', label: 'Amount' }, { key: 'due_date', label: 'Due Date' }, { key: 'status', label: 'Status' },
    ],
    formFields: [
      { key: 'invoice_number', label: 'Invoice Number', type: 'text', required: true },
      { key: 'vendor_name', label: 'Vendor Name', type: 'text', required: true },
      { key: 'amount', label: 'Amount ($)', type: 'number', required: true },
      { key: 'due_date', label: 'Due Date', type: 'date', required: true },
      { key: 'description', label: 'Description', type: 'textarea', required: false },
      { key: 'category', label: 'Category', type: 'select', required: false, options: [
        { value: 'IT Equipment', label: 'IT Equipment' }, { value: 'Services', label: 'Services' },
        { value: 'Supplies', label: 'Supplies' }, { value: 'Marketing', label: 'Marketing' },
        { value: 'Software', label: 'Software' }, { value: 'Consulting', label: 'Consulting' },
        { value: 'Utilities', label: 'Utilities' }, { value: 'Travel', label: 'Travel' },
      ]},
      { key: 'status', label: 'Status', type: 'select', required: false, options: statusOptions },
    ],
    fields: [
      { key: 'invoice_number', label: 'Invoice Number' }, { key: 'vendor_name', label: 'Vendor' },
      { key: 'amount', label: 'Amount' }, { key: 'due_date', label: 'Due Date' },
      { key: 'description', label: 'Description' }, { key: 'category', label: 'Category' }, { key: 'status', label: 'Status' },
    ],
    aiAction: 'analyze', aiLabel: 'AI Analyze',
  },
  contracts: {
    title: 'Contracts', icon: '📝',
    columns: [
      { key: 'title', label: 'Title' }, { key: 'party_name', label: 'Party' },
      { key: 'value', label: 'Value' }, { key: 'end_date', label: 'End Date' }, { key: 'status', label: 'Status' },
    ],
    formFields: [
      { key: 'title', label: 'Contract Title', type: 'text', required: true },
      { key: 'party_name', label: 'Party Name', type: 'text', required: true },
      { key: 'contract_type', label: 'Contract Type', type: 'select', required: true, options: [
        { value: 'Service', label: 'Service' }, { value: 'Development', label: 'Development' }, { value: 'Lease', label: 'Lease' },
        { value: 'Retainer', label: 'Retainer' }, { value: 'Consulting', label: 'Consulting' }, { value: 'NDA', label: 'NDA' },
        { value: 'Partnership', label: 'Partnership' }, { value: 'Supply', label: 'Supply' }, { value: 'Insurance', label: 'Insurance' },
      ]},
      { key: 'value', label: 'Contract Value ($)', type: 'number', required: false },
      { key: 'start_date', label: 'Start Date', type: 'date', required: true },
      { key: 'end_date', label: 'End Date', type: 'date', required: true },
      { key: 'terms', label: 'Terms & Conditions', type: 'textarea', required: false },
      { key: 'status', label: 'Status', type: 'select', required: false, options: statusOptions },
    ],
    fields: [
      { key: 'title', label: 'Title' }, { key: 'party_name', label: 'Party Name' }, { key: 'contract_type', label: 'Contract Type' },
      { key: 'value', label: 'Value' }, { key: 'start_date', label: 'Start Date' }, { key: 'end_date', label: 'End Date' },
      { key: 'terms', label: 'Terms' }, { key: 'status', label: 'Status' },
    ],
    aiAction: 'analyze', aiLabel: 'AI Analyze Contract',
  },
  tickets: {
    title: 'Support Tickets', icon: '🎫',
    columns: [
      { key: 'title', label: 'Title' }, { key: 'category', label: 'Category' },
      { key: 'customer_name', label: 'Customer' }, { key: 'priority', label: 'Priority' }, { key: 'status', label: 'Status' },
    ],
    formFields: [
      { key: 'title', label: 'Ticket Title', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea', required: true },
      { key: 'category', label: 'Category', type: 'select', required: true, options: [
        { value: 'Technical', label: 'Technical' }, { value: 'Billing', label: 'Billing' },
        { value: 'Feature', label: 'Feature Request' }, { value: 'Support', label: 'General Support' },
        { value: 'Security', label: 'Security' }, { value: 'Sales', label: 'Sales' },
      ]},
      { key: 'customer_name', label: 'Customer Name', type: 'text', required: true },
      { key: 'customer_email', label: 'Customer Email', type: 'email', required: true },
      { key: 'priority', label: 'Priority', type: 'select', required: false, options: priorityOptions },
      { key: 'status', label: 'Status', type: 'select', required: false, options: [
        { value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In Progress' },
        { value: 'resolved', label: 'Resolved' }, { value: 'closed', label: 'Closed' },
      ]},
    ],
    fields: [
      { key: 'title', label: 'Title' }, { key: 'description', label: 'Description' }, { key: 'category', label: 'Category' },
      { key: 'priority', label: 'Priority' }, { key: 'customer_name', label: 'Customer Name' },
      { key: 'customer_email', label: 'Customer Email' }, { key: 'status', label: 'Status' }, { key: 'resolution', label: 'Resolution' },
    ],
    aiAction: 'prioritize', aiLabel: 'AI Prioritize',
  },
  onboarding: {
    title: 'HR Onboarding', icon: '👋',
    columns: [
      { key: 'employee_name', label: 'Employee' }, { key: 'role', label: 'Role' },
      { key: 'department', label: 'Department' }, { key: 'start_date', label: 'Start Date' }, { key: 'status', label: 'Status' },
    ],
    formFields: [
      { key: 'employee_name', label: 'Employee Name', type: 'text', required: true },
      { key: 'email', label: 'Employee Email', type: 'email', required: true },
      { key: 'role', label: 'Role/Position', type: 'text', required: true },
      { key: 'department', label: 'Department', type: 'select', required: true, options: [
        { value: 'Engineering', label: 'Engineering' }, { value: 'Marketing', label: 'Marketing' },
        { value: 'Sales', label: 'Sales' }, { value: 'HR', label: 'HR' }, { value: 'Finance', label: 'Finance' },
        { value: 'Product', label: 'Product' }, { value: 'Customer Success', label: 'Customer Success' },
        { value: 'IT', label: 'IT' }, { value: 'Legal', label: 'Legal' }, { value: 'Data', label: 'Data' },
      ]},
      { key: 'start_date', label: 'Start Date', type: 'date', required: true },
      { key: 'manager', label: 'Manager Name', type: 'text', required: false },
      { key: 'status', label: 'Status', type: 'select', required: false, options: [
        { value: 'pending', label: 'Pending' }, { value: 'in_progress', label: 'In Progress' }, { value: 'completed', label: 'Completed' },
      ]},
    ],
    fields: [
      { key: 'employee_name', label: 'Employee Name' }, { key: 'email', label: 'Email' }, { key: 'role', label: 'Role' },
      { key: 'department', label: 'Department' }, { key: 'start_date', label: 'Start Date' }, { key: 'manager', label: 'Manager' },
      { key: 'progress', label: 'Progress' }, { key: 'status', label: 'Status' },
    ],
    aiAction: 'suggest-tasks', aiLabel: 'AI Suggest Tasks',
  },
  expenses: {
    title: 'Expenses', icon: '💳',
    columns: [
      { key: 'title', label: 'Title' }, { key: 'amount', label: 'Amount' },
      { key: 'category', label: 'Category' }, { key: 'expense_date', label: 'Date' }, { key: 'status', label: 'Status' },
    ],
    formFields: [
      { key: 'title', label: 'Expense Title', type: 'text', required: true },
      { key: 'amount', label: 'Amount ($)', type: 'number', required: true },
      { key: 'category', label: 'Category', type: 'select', required: true, options: [
        { value: 'Meals', label: 'Meals' }, { value: 'Travel', label: 'Travel' }, { value: 'Training', label: 'Training' },
        { value: 'Supplies', label: 'Supplies' }, { value: 'Software', label: 'Software' }, { value: 'Equipment', label: 'Equipment' },
        { value: 'Telecom', label: 'Telecom' }, { value: 'Entertainment', label: 'Entertainment' }, { value: 'Facilities', label: 'Facilities' },
      ]},
      { key: 'description', label: 'Description', type: 'textarea', required: false },
      { key: 'expense_date', label: 'Expense Date', type: 'date', required: true },
      { key: 'status', label: 'Status', type: 'select', required: false, options: statusOptions },
    ],
    fields: [
      { key: 'title', label: 'Title' }, { key: 'amount', label: 'Amount' }, { key: 'category', label: 'Category' },
      { key: 'description', label: 'Description' }, { key: 'expense_date', label: 'Expense Date' }, { key: 'status', label: 'Status' },
    ],
    aiAction: 'analyze', aiLabel: 'AI Analyze',
  },
  meetings: {
    title: 'Meetings', icon: '📅',
    columns: [
      { key: 'title', label: 'Title' }, { key: 'meeting_date', label: 'Date' },
      { key: 'duration', label: 'Duration (min)' }, { key: 'meeting_type', label: 'Type' }, { key: 'status', label: 'Status' },
    ],
    formFields: [
      { key: 'title', label: 'Meeting Title', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea', required: false },
      { key: 'meeting_date', label: 'Meeting Date & Time', type: 'datetime', required: true },
      { key: 'duration', label: 'Duration (minutes)', type: 'number', required: true },
      { key: 'location', label: 'Location', type: 'text', required: false },
      { key: 'meeting_type', label: 'Meeting Type', type: 'select', required: true, options: [
        { value: 'standup', label: 'Standup' }, { value: 'planning', label: 'Planning' }, { value: 'review', label: 'Review' },
        { value: 'demo', label: 'Demo' }, { value: 'training', label: 'Training' }, { value: 'interview', label: 'Interview' },
        { value: '1on1', label: 'One-on-One' }, { value: 'all-hands', label: 'All Hands' },
        { value: 'external', label: 'External' }, { value: 'board', label: 'Board Meeting' },
      ]},
      { key: 'status', label: 'Status', type: 'select', required: false, options: [
        { value: 'scheduled', label: 'Scheduled' }, { value: 'in_progress', label: 'In Progress' },
        { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' },
      ]},
    ],
    fields: [
      { key: 'title', label: 'Title' }, { key: 'description', label: 'Description' }, { key: 'meeting_date', label: 'Meeting Date' },
      { key: 'duration', label: 'Duration (minutes)' }, { key: 'location', label: 'Location' },
      { key: 'meeting_type', label: 'Meeting Type' }, { key: 'status', label: 'Status' }, { key: 'agenda', label: 'Agenda' },
    ],
    aiAction: 'generate-agenda', aiLabel: 'AI Generate Agenda',
  },
  reports: {
    title: 'Reports', icon: '📈',
    columns: [
      { key: 'title', label: 'Title' }, { key: 'report_type', label: 'Type' },
      { key: 'schedule', label: 'Schedule' }, { key: 'status', label: 'Status' },
    ],
    formFields: [
      { key: 'title', label: 'Report Title', type: 'text', required: true },
      { key: 'report_type', label: 'Report Type', type: 'select', required: true, options: [
        { value: 'sales', label: 'Sales' }, { value: 'financial', label: 'Financial' }, { value: 'performance', label: 'Performance' },
        { value: 'analytics', label: 'Analytics' }, { value: 'hr', label: 'HR' }, { value: 'operations', label: 'Operations' },
        { value: 'marketing', label: 'Marketing' }, { value: 'technical', label: 'Technical' },
        { value: 'compliance', label: 'Compliance' }, { value: 'customer', label: 'Customer' },
      ]},
      { key: 'description', label: 'Description', type: 'textarea', required: false },
      { key: 'data_source', label: 'Data Source', type: 'text', required: false },
      { key: 'schedule', label: 'Schedule', type: 'select', required: false, options: [
        { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' },
      ]},
      { key: 'status', label: 'Status', type: 'select', required: false, options: statusOptions },
    ],
    fields: [
      { key: 'title', label: 'Title' }, { key: 'report_type', label: 'Report Type' }, { key: 'description', label: 'Description' },
      { key: 'data_source', label: 'Data Source' }, { key: 'schedule', label: 'Schedule' },
      { key: 'status', label: 'Status' }, { key: 'last_generated', label: 'Last Generated' }, { key: 'content', label: 'Content' },
    ],
    aiAction: 'generate', aiLabel: 'AI Generate Report',
  },
  'data-entry': {
    title: 'Data Entry', icon: '📋',
    columns: [
      { key: 'title', label: 'Title' }, { key: 'source_type', label: 'Source' }, { key: 'status', label: 'Status' },
    ],
    formFields: [
      { key: 'title', label: 'Entry Title', type: 'text', required: true },
      { key: 'source_type', label: 'Source Type', type: 'select', required: true, options: [
        { value: 'invoice', label: 'Invoice' }, { value: 'email', label: 'Email' }, { value: 'image', label: 'Image/Scan' },
        { value: 'document', label: 'Document' }, { value: 'form', label: 'Form' }, { value: 'receipt', label: 'Receipt' },
        { value: 'contract', label: 'Contract' }, { value: 'notes', label: 'Notes' },
      ]},
      { key: 'raw_data', label: 'Raw Data/Text', type: 'textarea', required: true },
      { key: 'status', label: 'Status', type: 'select', required: false, options: [
        { value: 'pending', label: 'Pending' }, { value: 'extracted', label: 'Extracted' }, { value: 'verified', label: 'Verified' },
      ]},
    ],
    fields: [
      { key: 'title', label: 'Title' }, { key: 'source_type', label: 'Source Type' }, { key: 'raw_data', label: 'Raw Data' },
      { key: 'extracted_data', label: 'Extracted Data' }, { key: 'status', label: 'Status' },
    ],
    aiAction: 'extract', aiLabel: 'AI Extract Data',
  },
  compliance: {
    title: 'Compliance', icon: '🛡️',
    columns: [
      { key: 'title', label: 'Title' }, { key: 'regulation_type', label: 'Regulation' },
      { key: 'due_date', label: 'Due Date' }, { key: 'status', label: 'Status' },
    ],
    formFields: [
      { key: 'title', label: 'Compliance Item Title', type: 'text', required: true },
      { key: 'regulation_type', label: 'Regulation Type', type: 'select', required: true, options: [
        { value: 'GDPR', label: 'GDPR' }, { value: 'SOC 2', label: 'SOC 2' }, { value: 'PCI DSS', label: 'PCI DSS' },
        { value: 'HIPAA', label: 'HIPAA' }, { value: 'ISO 27001', label: 'ISO 27001' }, { value: 'ADA', label: 'ADA' },
        { value: 'CCPA', label: 'CCPA' }, { value: 'SOX', label: 'SOX' }, { value: 'OSHA', label: 'OSHA' },
        { value: 'Internal', label: 'Internal Policy' },
      ]},
      { key: 'requirement', label: 'Requirement', type: 'textarea', required: true },
      { key: 'current_status', label: 'Current Status', type: 'textarea', required: false },
      { key: 'due_date', label: 'Due Date', type: 'date', required: true },
      { key: 'responsible_party', label: 'Responsible Party', type: 'text', required: false },
      { key: 'status', label: 'Status', type: 'select', required: false, options: [
        { value: 'pending', label: 'Pending' }, { value: 'in_progress', label: 'In Progress' },
        { value: 'compliant', label: 'Compliant' }, { value: 'non_compliant', label: 'Non-Compliant' },
      ]},
    ],
    fields: [
      { key: 'title', label: 'Title' }, { key: 'regulation_type', label: 'Regulation Type' },
      { key: 'requirement', label: 'Requirement' }, { key: 'current_status', label: 'Current Status' },
      { key: 'due_date', label: 'Due Date' }, { key: 'responsible_party', label: 'Responsible Party' }, { key: 'status', label: 'Status' },
    ],
    aiAction: 'analyze', aiLabel: 'AI Analyze Compliance',
  },
  vendors: {
    title: 'Vendors', icon: '🏢',
    columns: [
      { key: 'name', label: 'Name' }, { key: 'category', label: 'Category' },
      { key: 'contract_value', label: 'Contract Value' }, { key: 'rating', label: 'Rating' }, { key: 'status', label: 'Status' },
    ],
    formFields: [
      { key: 'name', label: 'Vendor Name', type: 'text', required: true },
      { key: 'category', label: 'Category', type: 'select', required: true, options: [
        { value: 'IT Equipment', label: 'IT Equipment' }, { value: 'Cloud Hosting', label: 'Cloud Hosting' },
        { value: 'Office Supplies', label: 'Office Supplies' }, { value: 'Marketing Services', label: 'Marketing Services' },
        { value: 'Legal Services', label: 'Legal Services' }, { value: 'Training Services', label: 'Training Services' },
        { value: 'Security', label: 'Security' }, { value: 'Consulting', label: 'Consulting' },
        { value: 'Software', label: 'Software' }, { value: 'Facilities', label: 'Facilities' },
      ]},
      { key: 'contact_name', label: 'Contact Name', type: 'text', required: true },
      { key: 'contact_email', label: 'Contact Email', type: 'email', required: true },
      { key: 'contact_phone', label: 'Contact Phone', type: 'text', required: false },
      { key: 'contract_value', label: 'Contract Value ($)', type: 'number', required: false },
      { key: 'contract_start', label: 'Contract Start', type: 'date', required: false },
      { key: 'contract_end', label: 'Contract End', type: 'date', required: false },
      { key: 'rating', label: 'Rating (1-5)', type: 'number', required: false },
      { key: 'status', label: 'Status', type: 'select', required: false, options: [
        { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'pending', label: 'Pending' },
      ]},
    ],
    fields: [
      { key: 'name', label: 'Name' }, { key: 'category', label: 'Category' }, { key: 'contact_name', label: 'Contact Name' },
      { key: 'contact_email', label: 'Contact Email' }, { key: 'contact_phone', label: 'Contact Phone' },
      { key: 'contract_value', label: 'Contract Value' }, { key: 'contract_start', label: 'Contract Start' },
      { key: 'contract_end', label: 'Contract End' }, { key: 'rating', label: 'Rating' }, { key: 'status', label: 'Status' },
    ],
    aiAction: 'evaluate', aiLabel: 'AI Evaluate Vendor',
  },
  'process-mining': {
    title: 'Process Mining', icon: '🔍',
    columns: [
      { key: 'name', label: 'Process Name' }, { key: 'process_type', label: 'Type' },
      { key: 'department', label: 'Department' }, { key: 'complexity', label: 'Complexity' }, { key: 'status', label: 'Status' },
    ],
    formFields: [
      { key: 'name', label: 'Process Name', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea', required: true },
      { key: 'process_type', label: 'Process Type', type: 'select', required: true, options: [
        { value: 'Financial', label: 'Financial' }, { value: 'Customer Service', label: 'Customer Service' },
        { value: 'Operations', label: 'Operations' }, { value: 'HR', label: 'HR' }, { value: 'Support', label: 'Support' },
        { value: 'Procurement', label: 'Procurement' }, { value: 'Legal', label: 'Legal' },
        { value: 'Marketing', label: 'Marketing' }, { value: 'IT', label: 'IT' },
      ]},
      { key: 'event_log', label: 'Event Log / Process Steps', type: 'textarea', required: false, placeholder: 'Enter process steps separated by ->' },
      { key: 'department', label: 'Department', type: 'select', required: true, options: [
        { value: 'Finance', label: 'Finance' }, { value: 'Sales', label: 'Sales' }, { value: 'Operations', label: 'Operations' },
        { value: 'HR', label: 'HR' }, { value: 'IT', label: 'IT' }, { value: 'Procurement', label: 'Procurement' },
        { value: 'Legal', label: 'Legal' }, { value: 'Marketing', label: 'Marketing' },
      ]},
      { key: 'complexity', label: 'Complexity', type: 'select', required: false, options: complexityOptions },
      { key: 'status', label: 'Status', type: 'select', required: false, options: [
        { value: 'pending', label: 'Pending' }, { value: 'analyzed', label: 'Analyzed' }, { value: 'optimizing', label: 'Optimizing' },
      ]},
    ],
    fields: [
      { key: 'name', label: 'Process Name' }, { key: 'description', label: 'Description' },
      { key: 'process_type', label: 'Process Type' }, { key: 'event_log', label: 'Event Log' },
      { key: 'department', label: 'Department' }, { key: 'complexity', label: 'Complexity' },
      { key: 'status', label: 'Status' }, { key: 'created_at', label: 'Created' },
    ],
    aiAction: 'analyze', aiLabel: 'AI Analyze Process',
  },
  'workflow-optimizer': {
    title: 'Workflow Optimizer', icon: '⚙️',
    columns: [
      { key: 'name', label: 'Workflow Name' }, { key: 'bottlenecks', label: 'Bottlenecks' },
      { key: 'priority', label: 'Priority' }, { key: 'status', label: 'Status' },
    ],
    formFields: [
      { key: 'name', label: 'Workflow Name', type: 'text', required: true },
      { key: 'workflow_description', label: 'Workflow Description', type: 'textarea', required: true },
      { key: 'current_steps', label: 'Current Steps', type: 'textarea', required: false, placeholder: 'Describe current workflow steps' },
      { key: 'bottlenecks', label: 'Known Bottlenecks', type: 'textarea', required: false, placeholder: 'Describe known issues or delays' },
      { key: 'goals', label: 'Optimization Goals', type: 'textarea', required: false, placeholder: 'What do you want to achieve?' },
      { key: 'priority', label: 'Priority', type: 'select', required: false, options: priorityOptions },
      { key: 'status', label: 'Status', type: 'select', required: false, options: [
        { value: 'pending', label: 'Pending' }, { value: 'optimized', label: 'Optimized' }, { value: 'implementing', label: 'Implementing' },
      ]},
    ],
    fields: [
      { key: 'name', label: 'Workflow Name' }, { key: 'workflow_description', label: 'Description' },
      { key: 'current_steps', label: 'Current Steps' }, { key: 'bottlenecks', label: 'Bottlenecks' },
      { key: 'goals', label: 'Goals' }, { key: 'priority', label: 'Priority' },
      { key: 'status', label: 'Status' }, { key: 'created_at', label: 'Created' },
    ],
    aiAction: 'optimize', aiLabel: 'AI Optimize Workflow',
  },
  'rpa-scripts': {
    title: 'RPA Scripts', icon: '🤖',
    columns: [
      { key: 'name', label: 'Script Name' }, { key: 'platform', label: 'Platform' },
      { key: 'complexity', label: 'Complexity' }, { key: 'status', label: 'Status' },
    ],
    formFields: [
      { key: 'name', label: 'Script Name', type: 'text', required: true },
      { key: 'task_description', label: 'Task Description', type: 'textarea', required: true, placeholder: 'Describe the task to automate' },
      { key: 'platform', label: 'RPA Platform', type: 'select', required: true, options: [
        { value: 'UiPath', label: 'UiPath' }, { value: 'Blue Prism', label: 'Blue Prism' },
        { value: 'Automation Anywhere', label: 'Automation Anywhere' }, { value: 'Power Automate', label: 'Power Automate' },
        { value: 'Python', label: 'Python' },
      ]},
      { key: 'input_data', label: 'Input Data Description', type: 'textarea', required: false },
      { key: 'output_format', label: 'Output Format', type: 'textarea', required: false },
      { key: 'complexity', label: 'Complexity', type: 'select', required: false, options: complexityOptions },
      { key: 'status', label: 'Status', type: 'select', required: false, options: [
        { value: 'pending', label: 'Pending' }, { value: 'generated', label: 'Generated' },
        { value: 'testing', label: 'Testing' }, { value: 'deployed', label: 'Deployed' },
      ]},
    ],
    fields: [
      { key: 'name', label: 'Script Name' }, { key: 'task_description', label: 'Task Description' },
      { key: 'platform', label: 'Platform' }, { key: 'input_data', label: 'Input Data' },
      { key: 'output_format', label: 'Output Format' }, { key: 'complexity', label: 'Complexity' },
      { key: 'status', label: 'Status' }, { key: 'created_at', label: 'Created' },
    ],
    aiAction: 'generate', aiLabel: 'AI Generate Script',
  },
  'exception-handler': {
    title: 'Exception Handler', icon: '🚨',
    columns: [
      { key: 'name', label: 'Exception Name' }, { key: 'exception_type', label: 'Type' },
      { key: 'source_system', label: 'Source' }, { key: 'severity', label: 'Severity' }, { key: 'status', label: 'Status' },
    ],
    formFields: [
      { key: 'name', label: 'Exception Name', type: 'text', required: true },
      { key: 'exception_type', label: 'Exception Type', type: 'select', required: true, options: [
        { value: 'Data Extraction', label: 'Data Extraction' }, { value: 'System Connectivity', label: 'System Connectivity' },
        { value: 'Business Rule', label: 'Business Rule' }, { value: 'Data Quality', label: 'Data Quality' },
        { value: 'Security', label: 'Security' }, { value: 'System Constraint', label: 'System Constraint' },
        { value: 'System Availability', label: 'System Availability' }, { value: 'Business Logic', label: 'Business Logic' },
        { value: 'Resource Contention', label: 'Resource Contention' }, { value: 'System Error', label: 'System Error' },
        { value: 'System Resource', label: 'System Resource' },
      ]},
      { key: 'error_message', label: 'Error Message', type: 'textarea', required: true },
      { key: 'source_system', label: 'Source System', type: 'text', required: false },
      { key: 'stack_trace', label: 'Stack Trace', type: 'textarea', required: false },
      { key: 'severity', label: 'Severity', type: 'select', required: true, options: severityOptions },
      { key: 'impact', label: 'Business Impact', type: 'textarea', required: false },
      { key: 'status', label: 'Status', type: 'select', required: false, options: [
        { value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In Progress' }, { value: 'resolved', label: 'Resolved' },
      ]},
    ],
    fields: [
      { key: 'name', label: 'Exception Name' }, { key: 'exception_type', label: 'Exception Type' },
      { key: 'error_message', label: 'Error Message' }, { key: 'source_system', label: 'Source System' },
      { key: 'stack_trace', label: 'Stack Trace' }, { key: 'severity', label: 'Severity' },
      { key: 'impact', label: 'Impact' }, { key: 'status', label: 'Status' },
      { key: 'resolved_at', label: 'Resolved At' }, { key: 'created_at', label: 'Created' },
    ],
    aiAction: 'resolve', aiLabel: 'AI Resolve Exception',
  },
  'roi-calculator': {
    title: 'ROI Calculator', icon: '💹',
    columns: [
      { key: 'name', label: 'Project Name' }, { key: 'implementation_cost', label: 'Investment' },
      { key: 'annual_savings', label: 'Annual Savings' }, { key: 'automation_type', label: 'Type' }, { key: 'status', label: 'Status' },
    ],
    formFields: [
      { key: 'name', label: 'Project Name', type: 'text', required: true },
      { key: 'project_description', label: 'Project Description', type: 'textarea', required: true },
      { key: 'implementation_cost', label: 'Implementation Cost ($)', type: 'number', required: true },
      { key: 'annual_savings', label: 'Expected Annual Savings ($)', type: 'number', required: true },
      { key: 'time_savings_hours', label: 'Time Savings (hours/year)', type: 'number', required: false },
      { key: 'current_fte_cost', label: 'Current FTE Cost ($)', type: 'number', required: false },
      { key: 'automation_type', label: 'Automation Type', type: 'select', required: true, options: [
        { value: 'RPA', label: 'RPA' }, { value: 'RPA + AI', label: 'RPA + AI' }, { value: 'AI/ML', label: 'AI/ML' },
        { value: 'Integration', label: 'Integration' }, { value: 'Process Automation', label: 'Process Automation' },
      ]},
      { key: 'payback_period', label: 'Expected Payback Period', type: 'text', required: false, placeholder: 'e.g., 6 months' },
      { key: 'status', label: 'Status', type: 'select', required: false, options: [
        { value: 'draft', label: 'Draft' }, { value: 'calculated', label: 'Calculated' },
        { value: 'approved', label: 'Approved' }, { value: 'implementing', label: 'Implementing' },
      ]},
    ],
    fields: [
      { key: 'name', label: 'Project Name' }, { key: 'project_description', label: 'Description' },
      { key: 'implementation_cost', label: 'Implementation Cost' }, { key: 'annual_savings', label: 'Annual Savings' },
      { key: 'time_savings_hours', label: 'Time Savings (hours/year)' }, { key: 'current_fte_cost', label: 'Current FTE Cost' },
      { key: 'automation_type', label: 'Automation Type' }, { key: 'payback_period', label: 'Payback Period' },
      { key: 'status', label: 'Status' }, { key: 'created_at', label: 'Created' },
    ],
    aiAction: 'calculate', aiLabel: 'AI Calculate ROI',
  },
};

// ============================================
// APP COMPONENT
// ============================================
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ErrorBoundary>
            <div className="app">
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

                {Object.entries(pageConfigs).map(([key, config]) => (
                  <React.Fragment key={key}>
                    <Route
                      path={`/${key}`}
                      element={
                        <ProtectedRoute>
                          <ListPage
                            title={config.title}
                            endpoint={key}
                            columns={config.columns}
                            icon={config.icon}
                            formFields={config.formFields}
                          />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path={`/${key}/:id`}
                      element={
                        <ProtectedRoute>
                          <DetailPage
                            title={config.title}
                            endpoint={key}
                            fields={config.fields}
                            formFields={config.formFields}
                            aiAction={config.aiAction}
                            aiLabel={config.aiLabel}
                          />
                        </ProtectedRoute>
                      }
                    />
                  </React.Fragment>
                ))}

                {/* ===== Proposed NEW features (audit-driven) ===== */}
                <Route path="/process-analytics" element={<ProtectedRoute><Layout><ProcessAnalyticsPage /></Layout></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute><Layout><NotificationsPage /></Layout></ProtectedRoute>} />
                <Route path="/ai-stream" element={<ProtectedRoute><Layout><AIStreamPage /></Layout></ProtectedRoute>} />
                <Route path="/workflow-triggers" element={<ProtectedRoute><Layout><WorkflowTriggersPage /></Layout></ProtectedRoute>} />
                <Route path="/bottleneck-heatmap" element={<ProtectedRoute><Layout><BottleneckHeatmapPage /></Layout></ProtectedRoute>} />
                <Route path="/anomaly-detection" element={<ProtectedRoute><Layout><AnomalyDetectionPage /></Layout></ProtectedRoute>} />
                <Route path="/workflow-builder" element={<ProtectedRoute><Layout><WorkflowBuilderPage /></Layout></ProtectedRoute>} />
                <Route path="/compliance-watchdog" element={<ProtectedRoute><Layout><ComplianceWatchdogPage /></Layout></ProtectedRoute>} />
                <Route path="/webhooks" element={<ProtectedRoute><Layout><WebhooksPage /></Layout></ProtectedRoute>} />
                <Route path="/ai-toolbox" element={<ProtectedRoute><Layout><AIToolboxPage /></Layout></ProtectedRoute>} />
                <Route path="/backlog-tools" element={<ProtectedRoute><Layout><BacklogToolsPage /></Layout></ProtectedRoute>} />
                <Route path="/custom-views" element={<ProtectedRoute><Layout><CustomViewsPage /></Layout></ProtectedRoute>} />

                <Route path="/" element={<Navigate to="/dashboard" />} />
              </Routes>
            </div>
          </ErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
