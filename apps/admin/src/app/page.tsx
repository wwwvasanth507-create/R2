'use client';

import React, { useState } from 'react';
import {
  Server,
  HardDrive,
  AlertTriangle,
  DollarSign,
  Users,
  ShieldCheck,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Sliders,
  Layers,
  Database,
  Lock,
  ArrowUpRight
} from 'lucide-react';
import { DEFAULT_LOGICAL_QUOTA_BYTES } from '@platform/common';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'accounts' | 'buckets' | 'alerts' | 'users'>('overview');

  // Interactive accounts state
  const [accounts, setAccounts] = useState([
    {
      id: 'acc-cf-alpha',
      displayName: 'Cloudflare Account Alpha (US-West)',
      accountId: 'cf-alpha-9921',
      endpoint: 'https://cf-alpha-9921.r2.cloudflarestorage.com',
      accessKeyId: 'cf_key_alpha_prod',
      budget: 100,
      cost: 4.5,
      status: 'ACTIVE'
    },
    {
      id: 'acc-cf-beta',
      displayName: 'Cloudflare Account Beta (EU-Central)',
      accountId: 'cf-beta-4482',
      endpoint: 'https://cf-beta-4482.r2.cloudflarestorage.com',
      accessKeyId: 'cf_key_beta_prod',
      budget: 75,
      cost: 1.2,
      status: 'ACTIVE'
    }
  ]);

  // Interactive buckets state (8 GiB logical quota standard)
  const [buckets, setBuckets] = useState([
    {
      id: 'bkt-1',
      name: 'prod-media-alpha-1',
      account: 'Cloudflare Alpha',
      quotaGiB: 8,
      usedGiB: 5.8, // 72.5% -> WARNING_70
      priority: 1,
      status: 'WARNING_70',
      isEnabled: true
    },
    {
      id: 'bkt-2',
      name: 'prod-media-alpha-2',
      account: 'Cloudflare Alpha',
      quotaGiB: 8,
      usedGiB: 2.1, // 26% -> HEALTHY
      priority: 2,
      status: 'HEALTHY',
      isEnabled: true
    },
    {
      id: 'bkt-3',
      name: 'prod-media-beta-1',
      account: 'Cloudflare Beta',
      quotaGiB: 8,
      usedGiB: 0.0,
      priority: 3,
      status: 'HEALTHY',
      isEnabled: true
    }
  ]);

  // Alerts state
  const [alerts, setAlerts] = useState([
    {
      id: 'alt-1',
      bucket: 'prod-media-alpha-1',
      severity: 'WARNING_70',
      threshold: '70%',
      message: 'Notice: Bucket prod-media-alpha-1 has crossed 70% logical quota threshold (72.5% used).',
      time: '12 minutes ago',
      resolved: false,
      deduplicated: true
    }
  ]);

  // New bucket form state
  const [showAddBucketModal, setShowAddBucketModal] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const [newBucketQuota, setNewBucketQuota] = useState(8);
  const [newBucketPriority, setNewBucketPriority] = useState(4);

  // New account form state
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccId, setNewAccId] = useState('');
  const [newAccKey, setNewAccKey] = useState('');
  const [newAccSecret, setNewAccSecret] = useState('');

  const handleAddBucket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBucketName) return;

    setBuckets([
      ...buckets,
      {
        id: `bkt-${Date.now()}`,
        name: newBucketName,
        account: 'Cloudflare Alpha',
        quotaGiB: newBucketQuota,
        usedGiB: 0,
        priority: newBucketPriority,
        status: 'HEALTHY',
        isEnabled: true
      }
    ]);
    setNewBucketName('');
    setShowAddBucketModal(false);
  };

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName || !newAccId) return;

    setAccounts([
      ...accounts,
      {
        id: `acc-${Date.now()}`,
        displayName: newAccName,
        accountId: newAccId,
        endpoint: `https://${newAccId}.r2.cloudflarestorage.com`,
        accessKeyId: newAccKey || 'cf_key_demo',
        budget: 50,
        cost: 0,
        status: 'ACTIVE'
      }
    ]);
    setNewAccName('');
    setNewAccId('');
    setShowAddAccountModal(false);
  };

  const totalUsedGiB = buckets.reduce((acc, b) => acc + b.usedGiB, 0);
  const totalQuotaGiB = buckets.reduce((acc, b) => acc + b.quotaGiB, 0);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #f97316, #ef4444)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}
          >
            <Server size={20} />
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
          <div
            style={{
              padding: '6px 12px',
              background: '#1e293b',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#cbd5e1'
            }}
          >
            Role: Super Administrator
          </div>
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
            { id: 'accounts', label: 'Cloudflare Accounts', icon: Database },
            { id: 'buckets', label: 'R2 Buckets & 8 GB Quota', icon: HardDrive },
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
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isActive ? '#f97316' : 'transparent',
                  color: isActive ? '#fff' : '#94a3b8',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Content View */}
        <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
          {/* ================= OVERVIEW TAB ================= */}
          {activeTab === 'overview' && (
            <div>
              {/* Stat Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
                <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
                    <span>Total Storage Consumed</span>
                    <HardDrive size={18} color="#f97316" />
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#fff' }}>{totalUsedGiB.toFixed(1)} GiB</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    Of {totalQuotaGiB} GiB total logical quota
                  </div>
                </div>

                <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
                    <span>Active R2 Buckets</span>
                    <Server size={18} color="#3b82f6" />
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#fff' }}>{buckets.length} Buckets</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    Across {accounts.length} Cloudflare accounts
                  </div>
                </div>

                <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
                    <span>Estimated Monthly Cost</span>
                    <DollarSign size={18} color="#22c55e" />
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#22c55e' }}>$0.00 / mo</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    100% within Cloudflare Free Tier
                  </div>
                </div>

                <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
                    <span>Egress Fees Saved</span>
                    <ShieldCheck size={18} color="#a855f7" />
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#a855f7' }}>$184.20</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    Cloudflare R2 Free Egress policy
                  </div>
                </div>
              </div>

              {/* Bucket Allocation Status Cards */}
              <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '16px', padding: '24px', marginBottom: '32px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: '#fff' }}>
                  Dynamic Bucket Allocation & 8 GiB Quota Monitor
                </h3>
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
                            <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '8px' }}>({b.account})</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '13px', color: '#fff', fontWeight: 600 }}>
                              {b.usedGiB.toFixed(1)} / {b.quotaGiB} GiB ({pct}%)
                            </span>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: pct >= 85 ? 'rgba(239,68,68,0.2)' : pct >= 70 ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)',
                                color: barColor
                              }}
                            >
                              {b.status}
                            </span>
                          </div>
                        </div>
                        <div style={{ height: '6px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: barColor }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
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
                    Configure application-enforced 8 GB logical quotas and allocation priority.
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

              {/* Bucket Table */}
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
                    </tr>
                  </thead>
                  <tbody>
                    {buckets.map((b) => (
                      <tr key={b.id} style={{ borderBottom: '1px solid #1e293b', color: '#e2e8f0' }}>
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: '#f97316' }}>#{b.priority}</td>
                        <td style={{ padding: '14px 16px', fontWeight: 600 }}>{b.name}</td>
                        <td style={{ padding: '14px 16px', color: '#94a3b8' }}>{b.account}</td>
                        <td style={{ padding: '14px 16px' }}>{b.quotaGiB} GiB (Configurable)</td>
                        <td style={{ padding: '14px 16px' }}>{b.usedGiB.toFixed(1)} GiB</td>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                  Automated email dispatches with deduplication & alert suppression.
                </p>
              </div>

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
                          Bucket: {a.bucket} • Triggered: {a.time} • Deduplicated: Yes
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
                    Multi-account S3 credentials stored with AES-256-GCM encryption.
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <span style={{ fontWeight: 700, color: '#fff', fontSize: '15px' }}>{acc.displayName}</span>
                      <span style={{ color: '#22c55e', fontSize: '11px', fontWeight: 700 }}>● {acc.status}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.6 }}>
                      <div>Endpoint: {acc.endpoint}</div>
                      <div>Access Key: {acc.accessKeyId}</div>
                      <div>Monthly Budget: ${acc.budget}.00 USD</div>
                      <div>Current Cost: ${acc.cost}.00 USD</div>
                    </div>
                  </div>
                ))}
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
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}
        >
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '16px', padding: '28px', width: '420px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700, color: '#fff' }}>Register R2 Bucket</h3>
            <form onSubmit={handleAddBucket}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Bucket Name</label>
                <input
                  type="text"
                  value={newBucketName}
                  onChange={(e) => setNewBucketName(e.target.value)}
                  placeholder="e.g. prod-media-gamma-1"
                  required
                  style={{ width: '100%', padding: '10px', background: '#0d111a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
                  Logical Quota (GiB) - Defaults to 8 GiB
                </label>
                <input
                  type="number"
                  value={newBucketQuota}
                  onChange={(e) => setNewBucketQuota(parseInt(e.target.value, 10))}
                  style={{ width: '100%', padding: '10px', background: '#0d111a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
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
                  Add Bucket
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
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}
        >
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '16px', padding: '28px', width: '420px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700, color: '#fff' }}>Connect Cloudflare Account</h3>
            <form onSubmit={handleAddAccount}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Display Name</label>
                <input
                  type="text"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  placeholder="e.g. Cloudflare Account Charlie"
                  required
                  style={{ width: '100%', padding: '10px', background: '#0d111a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Cloudflare Account ID</label>
                <input
                  type="text"
                  value={newAccId}
                  onChange={(e) => setNewAccId(e.target.value)}
                  placeholder="32-hex character ID"
                  required
                  style={{ width: '100%', padding: '10px', background: '#0d111a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
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
                  Connect & Validate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
