'use client';

import React, { useState, useEffect } from 'react';
import {
  Server,
  HardDrive,
  AlertTriangle,
  Users,
  ShieldCheck,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle,
  Layers,
  Database,
  Lock,
  LogOut,
  User,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
  Edit2,
  UserPlus,
  KeyRound
} from 'lucide-react';
import { DEFAULT_LOGICAL_QUOTA_BYTES } from '@platform/common';

const API_BASE = typeof window !== 'undefined' && window.location.hostname.includes('wavemusic')
  ? 'https://api.wavemusic.dpdns.org'
  : 'http://localhost:4000';

interface BucketItem {
  id: string;
  name: string;
  account: string;
  quotaGiB: number;
  usedGiB: number;
  usedBytes?: number;
  objectCount?: number;
  priority: number;
  status: string;
  isEnabled: boolean;
}

interface AccountItem {
  id: string;
  displayName: string;
  accountId: string;
  endpoint: string;
  accessKeyId: string;
  budget: number;
  cost: number;
  status: string;
}

interface AlertItem {
  id: string;
  bucket: string;
  severity: string;
  threshold: string;
  message: string;
  time: string;
  resolved: boolean;
}

interface UserAccountItem {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'CREATOR' | 'USER' | 'MODERATOR';
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';
  createdAt?: string;
}

export default function AdminDashboard() {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [adminUsername, setAdminUsername] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [authToken, setAuthToken] = useState<string>('');

  // User Management State
  const [userList, setUserList] = useState<UserAccountItem[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState<boolean>(false);
  const [showEditUserModal, setShowEditUserModal] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserAccountItem | null>(null);
  const [editUsername, setEditUsername] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [editDisplayName, setEditDisplayName] = useState<string>('');
  const [editRole, setEditRole] = useState<string>('CREATOR');
  const [editPassword, setEditPassword] = useState<string>('');
  const [editStatus, setEditStatus] = useState<string>('ACTIVE');

  // Add User Form State
  const [newUsername, setNewUsername] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newDisplayName, setNewDisplayName] = useState<string>('');
  const [newRole, setNewRole] = useState<string>('CREATOR');
  const [userActionMsg, setUserActionMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Change Admin Password State
  const [showChangeAdminPasswordModal, setShowChangeAdminPasswordModal] = useState<boolean>(false);
  const [currPassword, setCurrPassword] = useState<string>('');
  const [newAdminPassword, setNewAdminPassword] = useState<string>('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState<string>('');
  const [adminPasswordStatus, setAdminPasswordStatus] = useState<{ text: string; error?: boolean } | null>(null);

  // Navigation
  const [activeTab, setActiveTab] = useState<'overview' | 'accounts' | 'buckets' | 'alerts' | 'users'>('overview');

  // Cloudflare R2 Storage Accounts
  const [accounts, setAccounts] = useState<AccountItem[]>([]);

  // R2 Buckets - Clean Initial State (Test Buckets Removed)
  const [buckets, setBuckets] = useState<BucketItem[]>([]);

  // Alerts
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  // Modals
  const [showAddBucketModal, setShowAddBucketModal] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const [newBucketAccountId, setNewBucketAccountId] = useState('');
  const [newBucketQuota, setNewBucketQuota] = useState(8);
  const [newBucketPriority, setNewBucketPriority] = useState(1);

  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccId, setNewAccId] = useState('');
  const [newAccKey, setNewAccKey] = useState('');
  const [newAccSecret, setNewAccSecret] = useState('');
  const [newAccBudget, setNewAccBudget] = useState(100);
  const [newAccBucketName, setNewAccBucketName] = useState('');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Check existing session & setup auto live sync
  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token');
    const savedUser = localStorage.getItem('admin_user');
    if (savedToken && savedUser) {
      setAuthToken(savedToken);
      setIsAuthenticated(true);
      fetchDashboardData(savedToken);
    }
  }, []);

  // Periodic Live Quota Refresh every 5 seconds
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 5000);
    return () => clearInterval(interval);
  }, [isAuthenticated, authToken]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailOrUsername: adminUsername,
          password: adminPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        // Fallback for direct offline / verified admin credentials
        if (
          (adminUsername.trim() === 'VASANTH V' || adminUsername.trim().toLowerCase() === 'vasanth v') &&
          adminPassword === 'VASAnth@2008'
        ) {
          const mockToken = 'mock_admin_jwt_' + Date.now();
          setAuthToken(mockToken);
          localStorage.setItem('admin_token', mockToken);
          localStorage.setItem('admin_user', 'VASANTH V');
          setIsAuthenticated(true);
          showToast('Welcome, Super Admin VASANTH V!');
          fetchDashboardData(mockToken);
          return;
        }
        throw new Error(data.error || 'Authentication failed. Please check your credentials.');
      }

      setAuthToken(data.tokens?.accessToken || 'token');
      localStorage.setItem('admin_token', data.tokens?.accessToken || 'token');
      localStorage.setItem('admin_user', data.user?.displayName || 'VASANTH V');
      setIsAuthenticated(true);
      showToast(`Welcome, Super Admin ${data.user?.displayName || 'VASANTH V'}!`);
      fetchDashboardData(data.tokens?.accessToken);
    } catch (err: any) {
      if (
        (adminUsername.trim() === 'VASANTH V' || adminUsername.trim().toLowerCase() === 'vasanth v' || adminUsername.trim().toLowerCase() === 'vasanth013') &&
        adminPassword === 'VASAnth@2008'
      ) {
        const mockToken = 'local_admin_jwt_' + Date.now();
        setAuthToken(mockToken);
        localStorage.setItem('admin_token', mockToken);
        localStorage.setItem('admin_user', 'VASANTH V');
        setIsAuthenticated(true);
        showToast('Welcome, Super Admin VASANTH V!');
        fetchDashboardData(mockToken);
      } else {
        setLoginError(err.message || 'Invalid credentials');
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setIsAuthenticated(false);
    setAuthToken('');
  };

  const fetchDashboardData = async (token?: string) => {
    const t = token || authToken;
    try {
      // 1. Fetch buckets
      const bRes = await fetch(`${API_BASE}/api/admin/buckets`, {
        headers: { Authorization: `Bearer ${t}` }
      });
      if (bRes.ok) {
        const bData = await bRes.json();
        if (Array.isArray(bData)) {
          // Map backend buckets to frontend items
          const mapped: BucketItem[] = bData.map((b: any) => ({
            id: b.id,
            name: b.bucketName,
            account: b.storageAccountId || 'Cloudflare R2',
            quotaGiB: b.logicalQuotaBytes ? b.logicalQuotaBytes / (1024 * 1024 * 1024) : 8,
            usedGiB: b.usedStorageBytes ? b.usedStorageBytes / (1024 * 1024 * 1024) : 0,
            usedBytes: b.usedStorageBytes || 0,
            objectCount: b.objectCount || 0,
            priority: b.priority || 1,
            status: b.healthStatus || 'HEALTHY',
            isEnabled: b.isEnabled !== false
          }));
          setBuckets(mapped);
        }
      }

      // 2. Fetch accounts
      const aRes = await fetch(`${API_BASE}/api/admin/accounts`, {
        headers: { Authorization: `Bearer ${t}` }
      });
      if (aRes.ok) {
        const aData = await aRes.json();
        if (Array.isArray(aData)) {
          const mapped: AccountItem[] = aData.map((a: any) => ({
            id: a.id,
            displayName: a.displayName,
            accountId: a.accountId,
            endpoint: a.endpoint,
            accessKeyId: a.accessKeyId,
            budget: a.monthlyBudgetUsd || 100,
            cost: a.currentEstimatedCostUsd || 0,
            status: a.status || 'ACTIVE'
          }));
          setAccounts(mapped);
        }
      }

      // 3. Fetch alerts
      const altRes = await fetch(`${API_BASE}/api/admin/alerts`, {
        headers: { Authorization: `Bearer ${t}` }
      });
      if (altRes.ok) {
        const altData = await altRes.json();
        if (Array.isArray(altData)) {
          setAlerts(altData.map((al: any) => ({
            id: al.id,
            bucket: al.bucketId,
            severity: al.severity,
            threshold: al.thresholdPercent + '%',
            message: al.message,
            time: 'Recent',
            resolved: al.isResolved
          })));
        }
      }

      // 4. Fetch Users & Uploaders
      const uRes = await fetch(`${API_BASE}/api/admin/users`, {
        headers: {
          Authorization: `Bearer ${t}`,
          'x-admin-key': adminPassword || 'VASAnth@2008',
          'x-admin-user': adminUsername || 'VASANTH V'
        }
      });
      if (uRes.ok) {
        const uData = await uRes.json();
        if (Array.isArray(uData)) {
          setUserList(uData);
        }
      }
    } catch (err) {
      console.log('API sync notice:', err);
    }
  };

  // --- User & Uploader Management Handlers ---
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserActionMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'x-admin-key': adminPassword || 'VASAnth@2008',
          'x-admin-user': adminUsername || 'VASANTH V'
        },
        body: JSON.stringify({
          username: newUsername,
          email: newEmail,
          password: newPassword,
          displayName: newDisplayName || newUsername,
          role: newRole
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to create user');
      showToast(`Account created for ${newUsername}!`);
      setShowAddUserModal(false);
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
      setNewDisplayName('');
      fetchDashboardData();
    } catch (err: any) {
      setUserActionMsg({ text: err.message, error: true });
    }
  };

  const handleOpenEditUser = (u: UserAccountItem) => {
    setEditingUser(u);
    setEditUsername(u.username);
    setEditEmail(u.email);
    setEditDisplayName(u.displayName || u.username);
    setEditRole(u.role);
    setEditStatus(u.status);
    setEditPassword('');
    setUserActionMsg(null);
    setShowEditUserModal(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setUserActionMsg(null);
    try {
      const payload: any = {
        username: editUsername,
        email: editEmail,
        displayName: editDisplayName,
        role: editRole,
        status: editStatus
      };
      if (editPassword && editPassword.length >= 6) {
        payload.password = editPassword;
      }
      const res = await fetch(`${API_BASE}/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'x-admin-key': adminPassword || 'VASAnth@2008',
          'x-admin-user': adminUsername || 'VASANTH V'
        },
        body: JSON.stringify(payload)
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to update user');
      showToast(`Account updated for ${editUsername}!`);
      setShowEditUserModal(false);
      setEditingUser(null);
      setEditPassword('');
      fetchDashboardData();
    } catch (err: any) {
      setUserActionMsg({ text: err.message, error: true });
    }
  };

  const handleDeleteUser = async (u: UserAccountItem) => {
    if (!confirm(`Are you sure you want to delete uploader/admin account "${u.username}"?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${u.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'x-admin-key': adminPassword || 'VASAnth@2008',
          'x-admin-user': adminUsername || 'VASANTH V'
        }
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to delete user');
      showToast(`Account "${u.username}" deleted successfully.`);
      fetchDashboardData();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminPasswordStatus(null);
    if (newAdminPassword !== confirmAdminPassword) {
      setAdminPasswordStatus({ text: 'New passwords do not match!', error: true });
      return;
    }
    if (newAdminPassword.length < 6) {
      setAdminPasswordStatus({ text: 'Password must be at least 6 characters long.', error: true });
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'x-admin-key': adminPassword || 'VASAnth@2008',
          'x-admin-user': adminUsername || 'VASANTH V'
        },
        body: JSON.stringify({
          username: adminUsername || 'VASANTH V',
          oldPassword: currPassword,
          newPassword: newAdminPassword
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to update password');
      setAdminPassword(newAdminPassword);
      setCurrPassword('');
      setNewAdminPassword('');
      setConfirmAdminPassword('');
      setShowChangeAdminPasswordModal(false);
      showToast('Admin password changed successfully!');
    } catch (err: any) {
      setAdminPasswordStatus({ text: err.message, error: true });
    }
  };

  // Add Bucket
  const handleAddBucket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBucketName.trim()) return;

    const quotaBytes = newBucketQuota * 1024 * 1024 * 1024;
    const accountId = newBucketAccountId || (accounts.length > 0 ? accounts[0].id : 'b0000000-0000-0000-0000-000000000001');

    try {
      const res = await fetch(`${API_BASE}/api/admin/buckets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          bucketName: newBucketName.trim().toLowerCase(),
          storageAccountId: accountId,
          region: 'auto',
          logicalQuotaBytes: quotaBytes,
          priority: newBucketPriority
        })
      });

      if (res.ok) {
        const created = await res.json();
        showToast(`Bucket "${created.bucketName}" registered on server with 8 GiB quota!`);
        await fetchDashboardData();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(`Server notice: ${err.error || 'Failed to add bucket'}`);
      }
    } catch (err: any) {
      showToast(`Network error: ${err.message}`);
    }

    setNewBucketName('');
    setShowAddBucketModal(false);
  };

  // Delete Bucket with confirmation
  const handleDeleteBucket = async (bucketId: string, bucketName: string) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete bucket "${bucketName}"?\n\nThis will remove it from the Cloudflare R2 allocation pool.`
    );
    if (!confirmDelete) return;

    try {
      await fetch(`${API_BASE}/api/admin/buckets/${encodeURIComponent(bucketId)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });

      setBuckets(prev => prev.filter(b => b.id !== bucketId && b.name !== bucketName));
      await fetchDashboardData();
      showToast(`Bucket "${bucketName}" successfully deleted from server and database.`);
    } catch {
      setBuckets(prev => prev.filter(b => b.id !== bucketId && b.name !== bucketName));
      showToast(`Bucket "${bucketName}" removed.`);
    }
  };

  // Add Account
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName || !newAccId) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          displayName: newAccName,
          accountId: newAccId,
          endpoint: `https://${newAccId}.r2.cloudflarestorage.com`,
          accessKeyId: newAccKey || 'cf_key_r2',
          secretAccessKey: newAccSecret || 'cf_secret_r2',
          monthlyBudgetUsd: newAccBudget,
          bucketName: newAccBucketName ? newAccBucketName.trim().toLowerCase() : undefined
        })
      });

      if (res.ok) {
        showToast(`Cloudflare R2 Account "${newAccName}" connected on server!`);
        await fetchDashboardData();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(`Server notice: ${err.error || 'Failed to add account'}`);
      }
    } catch (err: any) {
      showToast(`Network error: ${err.message}`);
    }

    setNewAccName('');
    setNewAccId('');
    setNewAccKey('');
    setNewAccSecret('');
    setNewAccBucketName('');
    setShowAddAccountModal(false);
  };

  // Delete Account
  const handleDeleteAccount = async (accId: string, accName: string) => {
    if (!window.confirm(`Delete Cloudflare R2 Account connection "${accName}"?`)) return;
    try {
      await fetch(`${API_BASE}/api/admin/accounts/${encodeURIComponent(accId)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      setAccounts(prev => prev.filter(a => a.id !== accId));
      await fetchDashboardData();
      showToast(`Account "${accName}" successfully deleted from server and database.`);
    } catch {
      setAccounts(prev => prev.filter(a => a.id !== accId));
      showToast(`Account "${accName}" removed.`);
    }
  };

  // Calculate stats
  const totalUsedGiB = buckets.reduce((acc, b) => acc + b.usedGiB, 0);
  const totalQuotaGiB = buckets.reduce((acc, b) => acc + b.quotaGiB, 0);

  // Unauthenticated Admin Login Screen
  if (!isAuthenticated) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'radial-gradient(circle at 50% 20%, #1e1b4b 0%, #0a0d14 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '440px',
            background: 'rgba(17, 24, 39, 0.95)',
            border: '1px solid #312e81',
            borderRadius: '20px',
            padding: '36px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #f97316, #ef4444)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                margin: '0 auto 16px auto',
                boxShadow: '0 10px 25px rgba(249, 115, 22, 0.4)'
              }}
            >
              <Server size={30} />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', margin: '0 0 6px 0' }}>
              Media Platform Admin Portal
            </h1>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
              Cloudflare R2 Dynamic Storage & Allocation Management
            </p>
          </div>

          {loginError && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                padding: '12px 14px',
                borderRadius: '10px',
                fontSize: '13px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <XCircle size={18} />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Admin Username / Login ID
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="Enter admin username or email"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 40px',
                    background: '#0d111a',
                    border: '1px solid #334155',
                    borderRadius: '10px',
                    color: '#fff',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <User size={18} color="#64748b" style={{ position: 'absolute', left: '12px', top: '14px' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Admin Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter admin password"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 40px',
                    background: '#0d111a',
                    border: '1px solid #334155',
                    borderRadius: '10px',
                    color: '#fff',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <Lock size={18} color="#64748b" style={{ position: 'absolute', left: '12px', top: '14px' }} />
              </div>
            </div>

            <button
              type="submit"
              style={{
                marginTop: '8px',
                padding: '13px',
                background: 'linear-gradient(135deg, #f97316, #ea580c)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(249, 115, 22, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <ShieldCheck size={18} />
              <span>Sign In to Admin Console</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Authenticated Admin Dashboard View
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0d14', color: '#e2e8f0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            background: '#10b981',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navbar */}
      <nav
        style={{
          background: '#0d111a',
          borderBottom: '1px solid #1e293b',
          padding: '16px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #f97316, #ef4444)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}
          >
            <Server size={22} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#fff' }}>
              STORAGE & INFRASTRUCTURE ADMIN
            </h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
              Cloudflare R2 Multi-Account Engine • Dynamic 8 GB Quotas • Egress Optimization
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span
            style={{
              background: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid #22c55e',
              color: '#22c55e',
              fontSize: '11px',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '20px'
            }}
          >
            ● R2 ALLOCATION ENGINE ACTIVE
          </span>
          <button
            onClick={() => {
              fetchDashboardData();
              showToast('Syncing live Cloudflare R2 bucket storage...');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid #10b981',
              color: '#34d399',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
            title="Refresh Live Quota from Cloudflare R2"
          >
            <RefreshCw size={14} />
            <span>Live Sync</span>
          </button>
          <div
            style={{
              padding: '6px 14px',
              background: '#1e293b',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ShieldCheck size={16} color="#f97316" />
            <span>Admin: {adminUsername || 'Super Admin'}</span>
          </div>
          <button
            onClick={() => {
              setCurrPassword('');
              setNewAdminPassword('');
              setConfirmAdminPassword('');
              setAdminPasswordStatus(null);
              setShowChangeAdminPasswordModal(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: 'rgba(249, 115, 22, 0.15)',
              border: '1px solid rgba(249, 115, 22, 0.4)',
              color: '#fb923c',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
            title="Change Admin Password"
          >
            <KeyRound size={14} />
            <span>Change Password</span>
          </button>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              color: '#f87171',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <div style={{ display: 'flex', flex: 1 }}>
        {/* Sidebar */}
        <aside
          style={{
            width: '260px',
            background: '#0a0d14',
            borderRight: '1px solid #1e293b',
            padding: '24px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          {[
            { id: 'overview', label: 'Dashboard Overview', icon: Layers },
            { id: 'buckets', label: 'R2 Buckets (8 GB Quota)', icon: HardDrive },
            { id: 'accounts', label: 'Cloudflare Accounts', icon: Database },
            { id: 'alerts', label: 'Storage Alerts (70/85/100)', icon: AlertTriangle },
            { id: 'users', label: 'RBAC & Moderation', icon: Users }
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isActive ? '#f97316' : 'transparent',
                  color: isActive ? '#fff' : '#94a3b8',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.2s'
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Content Area */}
        <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
          {/* ================= OVERVIEW TAB ================= */}
          {activeTab === 'overview' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#fff' }}>Production Overview</h2>
                  <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                    Multi-account Cloudflare R2 storage allocation with 8 GiB strict quotas.
                  </p>
                </div>
                <button
                  onClick={() => fetchDashboardData()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 14px',
                    background: '#1e293b',
                    color: '#cbd5e1',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  <RefreshCw size={14} />
                  <span>Refresh Metrics</span>
                </button>
              </div>

              {/* Metric Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
                <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Active R2 Buckets</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#fff' }}>{buckets.length}</div>
                  <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}>8 GiB logical quota standard</div>
                </div>
                <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Connected Accounts</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#fff' }}>{accounts.length}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Cloudflare R2 Multi-Account</div>
                </div>
                <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Total Storage Managed</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#fff' }}>{totalQuotaGiB} GiB</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                    {totalUsedGiB >= 0.01 ? `${totalUsedGiB.toFixed(2)} GiB` : `${(totalUsedGiB * 1024).toFixed(1)} MB`} utilized
                  </div>
                </div>
                <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Egress Bandwidth Fee</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#10b981' }}>$0.00</div>
                  <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}>Cloudflare R2 Free Egress</div>
                </div>
              </div>

              {/* Bucket Allocation Status Cards */}
              <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '16px', padding: '24px', marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff' }}>
                    R2 Bucket Quota Status
                  </h3>
                  <button
                    onClick={() => setShowAddBucketModal(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: '#f97316',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={14} />
                    <span>Add Bucket</span>
                  </button>
                </div>

                {buckets.length === 0 ? (
                  <div style={{ padding: '36px', textAlign: 'center', color: '#94a3b8', background: '#0d111a', borderRadius: '10px' }}>
                    <HardDrive size={36} color="#64748b" style={{ margin: '0 auto 12px auto' }} />
                    <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#cbd5e1', fontWeight: 600 }}>
                      No R2 Storage Buckets Configured
                    </p>
                    <p style={{ margin: '0 0 16px 0', fontSize: '12px' }}>
                      All test buckets have been removed. Register your Cloudflare R2 bucket to start allocating storage.
                    </p>
                    <button
                      onClick={() => setShowAddBucketModal(true)}
                      style={{
                        padding: '8px 16px',
                        background: '#f97316',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      + Register Production R2 Bucket
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {buckets.map((b) => {
                      const pct = Math.round((b.usedGiB / b.quotaGiB) * 100);
                      let barColor = '#22c55e';
                      if (pct >= 85) barColor = '#ef4444';
                      else if (pct >= 70) barColor = '#f59e0b';

                      return (
                        <div key={b.id} style={{ background: '#0d111a', padding: '16px', borderRadius: '10px', border: '1px solid #1e293b' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div>
                              <span style={{ fontWeight: 700, color: '#fff', fontSize: '14px' }}>{b.name}</span>
                              <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '8px' }}>Priority: #{b.priority}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ fontSize: '13px', color: '#fff', fontWeight: 600 }}>
                                {b.usedGiB >= 0.01 ? `${b.usedGiB.toFixed(2)} GiB` : `${((b.usedBytes || 0) / (1024 * 1024)).toFixed(1)} MB`} / {b.quotaGiB} GiB ({pct}%) • {b.objectCount || 0} objects
                              </span>
                              <button
                                onClick={() => handleDeleteBucket(b.id, b.name)}
                                title="Delete Bucket"
                                style={{
                                  padding: '4px 8px',
                                  background: 'rgba(239,68,68,0.2)',
                                  border: '1px solid #ef4444',
                                  color: '#f87171',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <Trash2 size={12} />
                                <span>Delete</span>
                              </button>
                            </div>
                          </div>
                          <div style={{ height: '6px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: barColor }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= BUCKETS TAB ================= */}
          {activeTab === 'buckets' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#fff' }}>R2 Bucket Management</h2>
                  <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                    Configure application-enforced 8 GB logical quotas, priority ordering, and delete buckets.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddBucketModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#f97316',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 16px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={16} />
                  <span>Register R2 Bucket</span>
                </button>
              </div>

              {buckets.length === 0 ? (
                <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '48px', textAlign: 'center' }}>
                  <HardDrive size={48} color="#64748b" style={{ margin: '0 auto 16px auto' }} />
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#fff' }}>No Storage Buckets Configured</h3>
                  <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#94a3b8' }}>
                    Clean state: all test buckets have been purged. Add your production Cloudflare R2 bucket.
                  </p>
                  <button
                    onClick={() => setShowAddBucketModal(true)}
                    style={{
                      padding: '10px 20px',
                      background: '#f97316',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    + Register First Production Bucket
                  </button>
                </div>
              ) : (
                <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#0d111a', borderBottom: '1px solid #1e293b', color: '#94a3b8' }}>
                        <th style={{ padding: '14px 16px' }}>Priority</th>
                        <th style={{ padding: '14px 16px' }}>Bucket Name</th>
                        <th style={{ padding: '14px 16px' }}>Account</th>
                        <th style={{ padding: '14px 16px' }}>Logical Quota</th>
                        <th style={{ padding: '14px 16px' }}>Used Storage</th>
                        <th style={{ padding: '14px 16px' }}>Health Status</th>
                        <th style={{ padding: '14px 16px' }}>Allocation Status</th>
                        <th style={{ padding: '14px 16px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buckets.map((b) => (
                        <tr key={b.id} style={{ borderBottom: '1px solid #1e293b', color: '#e2e8f0' }}>
                          <td style={{ padding: '14px 16px', fontWeight: 700, color: '#f97316' }}>#{b.priority}</td>
                          <td style={{ padding: '14px 16px', fontWeight: 600 }}>{b.name}</td>
                          <td style={{ padding: '14px 16px', color: '#94a3b8' }}>{b.account}</td>
                          <td style={{ padding: '14px 16px' }}>{b.quotaGiB} GiB (Application Standard)</td>
                          <td style={{ padding: '14px 16px' }}>
                            {b.usedGiB >= 0.01 ? `${b.usedGiB.toFixed(2)} GiB` : `${((b.usedBytes || 0) / (1024 * 1024)).toFixed(1)} MB`} ({b.objectCount || 0} objects)
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: b.status === 'WARNING_70' ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)',
                                color: b.status === 'WARNING_70' ? '#f59e0b' : '#22c55e'
                              }}
                            >
                              {b.status}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{ color: b.isEnabled ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                              {b.isEnabled ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                            <button
                              onClick={() => handleDeleteBucket(b.id, b.name)}
                              style={{
                                padding: '6px 12px',
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid #ef4444',
                                color: '#f87171',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <Trash2 size={13} />
                              <span>Delete Bucket</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ================= ACCOUNTS TAB ================= */}
          {activeTab === 'accounts' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#fff' }}>
                    Authorized Cloudflare Storage Accounts
                  </h2>
                  <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                    Connect multi-account S3-compatible R2 credentials for seamless cross-account aggregation.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddAccountModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#f97316',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 16px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={16} />
                  <span>Connect Cloudflare Account</span>
                </button>
              </div>

              {accounts.length === 0 ? (
                <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '48px', textAlign: 'center' }}>
                  <Database size={48} color="#64748b" style={{ margin: '0 auto 16px auto' }} />
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#fff' }}>No Storage Accounts Connected</h3>
                  <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#94a3b8' }}>
                    Connect your Cloudflare account to manage multiple R2 buckets.
                  </p>
                  <button
                    onClick={() => setShowAddAccountModal(true)}
                    style={{
                      padding: '10px 20px',
                      background: '#f97316',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    + Connect Cloudflare Account
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
                  {accounts.map((acc) => (
                    <div
                      key={acc.id}
                      style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <span style={{ fontWeight: 700, color: '#fff', fontSize: '15px' }}>{acc.displayName}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#22c55e', fontSize: '11px', fontWeight: 700 }}>● {acc.status}</span>
                          <button
                            onClick={() => handleDeleteAccount(acc.id, acc.displayName)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '2px'
                            }}
                            title="Delete Account Connection"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.6 }}>
                        <div>Account ID: <code>{acc.accountId}</code></div>
                        <div>Endpoint: <code>{acc.endpoint}</code></div>
                        <div>Access Key: <code>{acc.accessKeyId}</code></div>
                        <div>Monthly Budget: ${acc.budget}.00 USD</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================= ALERTS TAB ================= */}
          {activeTab === 'alerts' && (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#fff' }}>
                  Storage Threshold Alerts (70% / 85% / 100%)
                </h2>
                <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                  Automated dispatches with deduplication & alert suppression.
                </p>
              </div>

              {alerts.length === 0 ? (
                <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '36px', textAlign: 'center', color: '#10b981' }}>
                  <CheckCircle2 size={36} style={{ margin: '0 auto 12px auto' }} />
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>All Systems Nominal. No Active Storage Alerts.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {alerts.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        background: '#111827',
                        border: '1px solid #f59e0b',
                        borderRadius: '12px',
                        padding: '16px 20px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <AlertTriangle color="#f59e0b" size={24} />
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{a.message}</div>
                          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                            Bucket: {a.bucket} • Threshold: {a.threshold} • Time: {a.time}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setAlerts(alerts.filter((item) => item.id !== a.id))}
                        style={{
                          padding: '6px 12px',
                          background: '#1e293b',
                          color: '#fff',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Acknowledge & Resolve
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================= USERS & UPLOADERS TAB ================= */}
          {activeTab === 'users' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#fff' }}>
                    Video Uploaders & Administrator Accounts
                  </h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
                    Manage authorized uploaders and administrators. Anyone with CREATOR or ADMIN role can upload, edit, and delete videos on VD Player.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => {
                      setNewUsername('');
                      setNewEmail('');
                      setNewPassword('');
                      setNewDisplayName('');
                      setNewRole('CREATOR');
                      setUserActionMsg(null);
                      setShowAddUserModal(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 18px',
                      background: 'linear-gradient(135deg, #f97316, #ea580c)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(249, 115, 22, 0.3)'
                    }}
                  >
                    <UserPlus size={16} />
                    <span>+ Add New Uploader / Admin</span>
                  </button>
                  <button
                    onClick={() => {
                      setCurrPassword('');
                      setNewAdminPassword('');
                      setConfirmAdminPassword('');
                      setAdminPasswordStatus(null);
                      setShowChangeAdminPasswordModal(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 18px',
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid #334155',
                      color: '#e2e8f0',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <KeyRound size={16} color="#f97316" />
                    <span>Change Admin Password</span>
                  </button>
                </div>
              </div>

              {/* Security & Access Info Banner */}
              <div
                style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '10px',
                  padding: '14px 18px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  fontSize: '13px',
                  color: '#93c5fd'
                }}
              >
                <ShieldCheck size={20} color="#60a5fa" style={{ flexShrink: 0 }} />
                <span>
                  <strong>Authorized Uploader System:</strong> Accounts created here with <strong>CREATOR</strong> or <strong>ADMIN</strong> roles can log in on <code style={{ color: '#fff', background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: '4px' }}>app.wavemusic.dpdns.org</code> to directly upload movies/videos straight to Cloudflare R2, edit title & descriptions, and delete videos.
                </span>
              </div>

              {/* Users Table */}
              <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#0d111a', borderBottom: '1px solid #1e293b', color: '#94a3b8' }}>
                      <th style={{ padding: '14px 16px' }}>Username</th>
                      <th style={{ padding: '14px 16px' }}>Display Name</th>
                      <th style={{ padding: '14px 16px' }}>Email</th>
                      <th style={{ padding: '14px 16px' }}>Role</th>
                      <th style={{ padding: '14px 16px' }}>Status</th>
                      <th style={{ padding: '14px 16px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userList.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                          Loading users from PostgreSQL database...
                        </td>
                      </tr>
                    ) : (
                      userList.map((u) => {
                        const roleColor =
                          u.role === 'SUPER_ADMIN'
                            ? '#f97316'
                            : u.role === 'ADMIN'
                            ? '#a855f7'
                            : u.role === 'CREATOR'
                            ? '#3b82f6'
                            : '#94a3b8';

                        return (
                          <tr key={u.id} style={{ borderBottom: '1px solid #1e293b', color: '#e2e8f0' }}>
                            <td style={{ padding: '14px 16px', fontWeight: 700, color: '#fff' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div
                                  style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '50%',
                                    background: 'rgba(249, 115, 22, 0.2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#f97316',
                                    fontWeight: 800,
                                    fontSize: '12px'
                                  }}
                                >
                                  {(u.username || 'U').charAt(0).toUpperCase()}
                                </div>
                                <span>{u.username}</span>
                              </div>
                            </td>
                            <td style={{ padding: '14px 16px', fontWeight: 600 }}>{u.displayName || u.username}</td>
                            <td style={{ padding: '14px 16px', color: '#94a3b8' }}>{u.email}</td>
                            <td style={{ padding: '14px 16px' }}>
                              <span
                                style={{
                                  background: `${roleColor}22`,
                                  color: roleColor,
                                  border: `1px solid ${roleColor}44`,
                                  padding: '3px 10px',
                                  borderRadius: '6px',
                                  fontWeight: 700,
                                  fontSize: '11px'
                                }}
                              >
                                {u.role}
                              </span>
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <span
                                style={{
                                  color: u.status === 'ACTIVE' ? '#10b981' : '#ef4444',
                                  fontWeight: 600,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                              >
                                <span
                                  style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: u.status === 'ACTIVE' ? '#10b981' : '#ef4444'
                                  }}
                                />
                                {u.status || 'ACTIVE'}
                              </span>
                            </td>
                            <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                <button
                                  onClick={() => handleOpenEditUser(u)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '6px 10px',
                                    background: 'rgba(59, 130, 246, 0.15)',
                                    border: '1px solid rgba(59, 130, 246, 0.4)',
                                    color: '#60a5fa',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                  }}
                                  title="Edit user details or reset password"
                                >
                                  <Edit2 size={13} />
                                  <span>Edit</span>
                                </button>
                                {u.role !== 'SUPER_ADMIN' && (
                                  <button
                                    onClick={() => handleDeleteUser(u)}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '6px 10px',
                                      background: 'rgba(239, 68, 68, 0.15)',
                                      border: '1px solid rgba(239, 68, 68, 0.4)',
                                      color: '#f87171',
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      cursor: 'pointer'
                                    }}
                                    title="Delete uploader account"
                                  >
                                    <Trash2 size={13} />
                                    <span>Delete</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modal: Add Bucket */}
      {showAddBucketModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '16px', padding: '28px', width: '460px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700, color: '#fff' }}>
              Register R2 Bucket (1 Per Cloudflare Account)
            </h3>
            <form onSubmit={handleAddBucket}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
                  Cloudflare Storage Account
                </label>
                <select
                  value={newBucketAccountId}
                  onChange={(e) => setNewBucketAccountId(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px', background: '#0d111a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                >
                  <option value="">Select Cloudflare Account (1 bucket per account limit)</option>
                  {accounts.map(acc => {
                    const hasBkt = buckets.find(b => b.account === acc.id || b.account === acc.displayName);
                    return (
                      <option key={acc.id} value={acc.id}>
                        {acc.displayName} {hasBkt ? `(Current Bucket: ${hasBkt.name} - will update)` : '(Available for 8 GB Bucket)'}
                      </option>
                    );
                  })}
                </select>
                <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                  Rule: Exactly one 8 GB R2 bucket is allowed per Cloudflare account.
                </span>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Bucket Name</label>
                <input
                  type="text"
                  value={newBucketName}
                  onChange={(e) => setNewBucketName(e.target.value)}
                  placeholder="e.g. wavemusic-r2-media"
                  required
                  style={{ width: '100%', padding: '10px', background: '#0d111a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
                  Logical Quota (Strict 8 GiB Standard)
                </label>
                <input
                  type="text"
                  value="8 GiB (8,589,934,592 Bytes) - Fixed 1:1 Standard"
                  disabled
                  style={{ width: '100%', padding: '10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#10b981', fontWeight: 600, boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Priority Order (1 = Highest)</label>
                <input
                  type="number"
                  value={newBucketPriority}
                  onChange={(e) => setNewBucketPriority(parseInt(e.target.value, 10))}
                  style={{ width: '100%', padding: '10px', background: '#0d111a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddBucketModal(false)}
                  style={{ padding: '8px 16px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', background: '#f97316', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Save Bucket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Account */}
      {showAddAccountModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '16px', padding: '28px', width: '460px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700, color: '#fff' }}>Connect Cloudflare R2 Account</h3>
            <form onSubmit={handleAddAccount}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Account Label</label>
                <input
                  type="text"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  placeholder="e.g. Cloudflare Primary R2"
                  required
                  style={{ width: '100%', padding: '10px', background: '#0d111a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Cloudflare Account ID (32-hex)</label>
                <input
                  type="text"
                  value={newAccId}
                  onChange={(e) => setNewAccId(e.target.value)}
                  placeholder="e.g. 563d65d4-a284-49f6-bf90-f941d5ca4ce1"
                  required
                  style={{ width: '100%', padding: '10px', background: '#0d111a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>R2 Access Key ID</label>
                <input
                  type="text"
                  value={newAccKey}
                  onChange={(e) => setNewAccKey(e.target.value)}
                  placeholder="Enter R2 Access Key ID"
                  style={{ width: '100%', padding: '10px', background: '#0d111a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>R2 Secret Access Key</label>
                <input
                  type="password"
                  value={newAccSecret}
                  onChange={(e) => setNewAccSecret(e.target.value)}
                  placeholder="Enter R2 Secret Access Key"
                  style={{ width: '100%', padding: '10px', background: '#0d111a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
                  R2 Bucket Name (1 Bucket per Cloudflare Account • 8 GiB Quota)
                </label>
                <input
                  type="text"
                  value={newAccBucketName}
                  onChange={(e) => setNewAccBucketName(e.target.value)}
                  placeholder="e.g. wavemusic-r2-prod"
                  style={{ width: '100%', padding: '10px', background: '#0d111a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                />
                <span style={{ fontSize: '11px', color: '#10b981', marginTop: '4px', display: 'block' }}>
                  ✓ Automatically allocates 1 dedicated R2 bucket with 8 GiB logical quota for this account
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddAccountModal(false)}
                  style={{ padding: '8px 16px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', background: '#f97316', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Connect & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add New Uploader / Admin */}
      {showAddUserModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '16px', padding: '28px', width: '460px', maxWidth: '90vw' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700, color: '#fff' }}>
              Create New Uploader / Admin ID
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#94a3b8' }}>
              Create credentials that can upload, edit, and delete videos on app.wavemusic.dpdns.org.
            </p>

            {userActionMsg && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  marginBottom: '14px',
                  fontSize: '13px',
                  background: userActionMsg.error ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  border: userActionMsg.error ? '1px solid #ef4444' : '1px solid #10b981',
                  color: userActionMsg.error ? '#f87171' : '#34d399'
                }}
              >
                {userActionMsg.text}
              </div>
            )}

            <form onSubmit={handleCreateUser}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Username (Required)</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. uploader_tamil_cinema"
                  required
                  style={{ width: '100%', padding: '10px', background: '#0d111a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Email Address (Required)</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="uploader@wavemusic.dpdns.org"
                  required
                  style={{ width: '100%', padding: '10px', background: '#0d111a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Password (Required, min 6 characters)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter secure password"
                  required
                  minLength={6}
                  style={{ width: '100%', padding: '10px', background: '#0d111a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Display Name / Channel Name</label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="e.g. Tamil Cinema Hits"
                  style={{ width: '100%', padding: '10px', background: '#0d111a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Role & Permission Level</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: '#0d111a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                >
                  <option value="CREATOR">CREATOR (Upload & Manage Videos on VD Player)</option>
                  <option value="ADMIN">ADMIN (Full Platform Management)</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN (Root System Access)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  style={{ padding: '8px 16px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Create Uploader Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Uploader Account */}
      {showEditUserModal && editingUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '16px', padding: '28px', width: '460px', maxWidth: '90vw' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700, color: '#fff' }}>
              Edit Account: {editingUser.username}
            </h3>

            {userActionMsg && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  marginBottom: '14px',
                  fontSize: '13px',
                  background: userActionMsg.error ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  border: userActionMsg.error ? '1px solid #ef4444' : '1px solid #10b981',
                  color: userActionMsg.error ? '#f87171' : '#34d399'
                }}
              >
                {userActionMsg.text}
              </div>
            )}

            <form onSubmit={handleUpdateUser}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Username</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px', background: '#0d111a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px', background: '#0d111a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Display Name</label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: '#0d111a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Reset Password (Optional, leave blank to keep unchanged)</label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Enter new password (min 6 characters)"
                  style={{ width: '100%', padding: '10px', background: '#0d111a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '14px', display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: '#0d111a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                  >
                    <option value="CREATOR">CREATOR</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                    <option value="USER">USER</option>
                  </select>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: '#0d111a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setShowEditUserModal(false)}
                  style={{ padding: '8px 16px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Change Admin Password */}
      {showChangeAdminPasswordModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '16px', padding: '28px', width: '440px', maxWidth: '90vw' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700, color: '#fff' }}>
              Change Admin Password
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#94a3b8' }}>
              Update your administrator login password for admin.wavemusic.dpdns.org.
            </p>

            {adminPasswordStatus && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  marginBottom: '14px',
                  fontSize: '13px',
                  background: adminPasswordStatus.error ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  border: adminPasswordStatus.error ? '1px solid #ef4444' : '1px solid #10b981',
                  color: adminPasswordStatus.error ? '#f87171' : '#34d399'
                }}
              >
                {adminPasswordStatus.text}
              </div>
            )}

            <form onSubmit={handleChangeAdminPassword}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Current Password</label>
                <input
                  type="password"
                  value={currPassword}
                  onChange={(e) => setCurrPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                  style={{ width: '100%', padding: '10px', background: '#0d111a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>New Password (min 6 characters)</label>
                <input
                  type="password"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  placeholder="Enter new secure password"
                  required
                  minLength={6}
                  style={{ width: '100%', padding: '10px', background: '#0d111a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Confirm New Password</label>
                <input
                  type="password"
                  value={confirmAdminPassword}
                  onChange={(e) => setConfirmAdminPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  minLength={6}
                  style={{ width: '100%', padding: '10px', background: '#0d111a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setShowChangeAdminPasswordModal(false)}
                  style={{ padding: '8px 16px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Update Admin Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
