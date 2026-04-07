'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import api from '@/utils/api';
import { 
  Plus, Search, Trash2, Edit3, Play, 
  CheckCircle, AlertCircle, Clock, Loader2, LogOut,
  Globe, Mail, LayoutDashboard, Activity, Zap,
  FileText, ExternalLink, X, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Dashboard() {
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [currentDomain, setCurrentDomain] = useState(null);
  const [url, setUrl] = useState('');
  const [primaryEmail, setPrimaryEmail] = useState('');
  const [secondaryEmails, setSecondaryEmails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState(null);
  
  // Report State
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSearch, setReportSearch] = useState('');
  const [cronTime, setCronTime] = useState('00:00');
  const [isUpdatingCron, setIsUpdatingCron] = useState(false);
  
  // Progress State
  const [activeScan, setActiveScan] = useState(null);
  const socketRef = useRef(null);

  const router = useRouter();

  const fetchSettings = useCallback(async () => {
    try {
      const { data } = await api.get('/settings');
      const cronSetting = data.find(s => s.key === 'cronTime');
      if (cronSetting) setCronTime(cronSetting.value);
    } catch (err) {
      console.error('Failed to fetch settings');
    }
  }, []);

  const fetchDomains = useCallback(async () => {
    try {
      const { data } = await api.get('/domains');
      setDomains(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch domains');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const userInfo = localStorage.getItem('userInfo');
    if (!userInfo) {
      router.push('/login');
      return;
    }
    
    const currentUser = JSON.parse(userInfo);
    setUser(currentUser);

    // Initialize Socket.io
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    socketRef.current = io(backendUrl.replace(/\/api$/, ''), {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socketRef.current.on('connect', () => {
      console.log('Connected to socket engine');
      // Fetch initial data
      fetchSettings();
      fetchDomains().then(data => {
        const scanningDomain = data.find(d => d.status === 'scanning');
        if (scanningDomain) {
          socketRef.current.emit('join-scan', scanningDomain._id);
          setActiveScan({
            domainId: scanningDomain._id,
            url: scanningDomain.url,
            progress: 0,
            pagesScanned: 0,
            brokenCount: 0
          });
        }
      });
    });

    socketRef.current.on('scan:progress', (data) => {
      setActiveScan(prev => ({ ...prev, ...data }));
    });

    socketRef.current.on('scan:complete', () => {
      setActiveScan(null);
      fetchDomains();
    });

    socketRef.current.on('scan:failed', (data) => {
      alert(`Scan failed: ${data.error}`);
      setActiveScan(null);
      fetchDomains();
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [router, fetchDomains]);

  const handleLogout = () => {
    localStorage.removeItem('userInfo');
    router.push('/login');
  };

  const openModal = (domain = null) => {
    if (domain) {
      setCurrentDomain(domain);
      setUrl(domain.url);
      setPrimaryEmail(domain.primaryEmail);
      setSecondaryEmails(domain.secondaryEmails.join(', '));
    } else {
      setCurrentDomain(null);
      setUrl('');
      setPrimaryEmail('');
      setSecondaryEmails('');
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const emails = secondaryEmails.split(',').map(e => e.trim()).filter(e => e !== '');
    
    try {
      if (currentDomain) {
        await api.put(`/domains/${currentDomain._id}`, { url, primaryEmail, secondaryEmails: emails });
      } else {
        await api.post('/domains', { url, primaryEmail, secondaryEmails: emails });
      }
      setShowModal(false);
      fetchDomains();
    } catch (err) {
      alert(err.response?.data?.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteDomain = async (id) => {
    if (confirm('Are you sure you want to delete this domain and all its reports?')) {
      try {
        await api.delete(`/domains/${id}`);
        fetchDomains();
      } catch (err) {
        alert('Failed to delete');
      }
    }
  };

  const handleUpdateCron = async () => {
    setIsUpdatingCron(true);
    try {
      await api.post('/settings', { key: 'cronTime', value: cronTime });
      alert('Daily scan schedule updated successfully!');
    } catch (err) {
      alert('Failed to update schedule');
    } finally {
      setIsUpdatingCron(false);
    }
  };

  const triggerScan = async (id) => {
    try {
      await api.post(`/domains/${id}/scan`);
      if (socketRef.current) {
        socketRef.current.emit('join-scan', id);
        const domainObj = domains.find(d => d._id === id);
        setActiveScan({
          domainId: id,
          url: domainObj?.url || 'Scanning...',
          progress: 0,
          pagesScanned: 0,
          brokenCount: 0
        });
      }
      fetchDomains();
    } catch (err) {
      alert('Failed to trigger scan');
    }
  };
  
  const viewReport = async (domainId) => {
    setReportLoading(true);
    setShowReportModal(true);
    try {
      const { data } = await api.get(`/reports/domain/${domainId}/latest`);
      setSelectedReport(data);
    } catch (err) {
      alert('No scan reports found yet for this domain.');
      setShowReportModal(false);
    } finally {
      setReportLoading(false);
    }
  };

  const filteredDomains = domains.filter(d => 
    d.url.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: domains.length,
    broken: domains.reduce((acc, d) => acc + (d.totalBrokenLinks || 0), 0),
    scanning: domains.filter(d => d.status === 'scanning').length,
  };

  if (loading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        <p className="text-zinc-500 font-medium">Initializing Engine...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 selection:bg-blue-500/30">
      {/* Navbar */}
      <nav className="glass border-b border-white/5 sticky top-0 z-40 px-6 py-4 flex items-center justify-between backdrop-blur-xl">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-600/20">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight hidden sm:inline-block">Link<span className="text-blue-500">Scanner</span> <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded ml-1 uppercase">Pro</span></span>
        </div>

        <div className="flex items-center space-x-6">
          <div className="hidden md:block text-right">
            <p className="text-sm font-semibold">{user?.email}</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Administrator</p>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-white/5 rounded-full transition-colors text-zinc-400 hover:text-white border border-transparent hover:border-white/10"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 md:p-10 space-y-10">
        {/* Progress Overlay */}
        <AnimatePresence>
          {activeScan && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-6 mb-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4">
                  <Activity className="w-5 h-5 text-blue-500 animate-pulse" />
                </div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                       Active Audit in Progress
                    </h3>
                    <p className="text-sm text-zinc-400 truncate max-w-md font-mono">
                      {activeScan.currentUrl}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-8">
                    <div className="text-center">
                      <p className="text-[10px] text-zinc-500 uppercase">Pages</p>
                      <p className="text-xl font-bold">{activeScan.pagesScanned}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-zinc-500 uppercase">Broken</p>
                      <p className="text-xl font-bold text-red-500">{activeScan.brokenCount}</p>
                    </div>
                    <div className="w-32 bg-zinc-900 h-2 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${activeScan.progress}%` }}
                        className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                      />
                    </div>
                    <p className="text-sm font-bold w-10">{activeScan.progress}%</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: 'Domains Monitored', value: stats.total, icon: Globe, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { label: 'Broken Resources', value: stats.broken, icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
            { label: 'Engines Active', value: stats.scanning, icon: Activity, color: 'text-green-500', bg: 'bg-green-500/10' },
          ].map((stat, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="card-gradient p-6 rounded-2xl border border-white/5 flex items-center justify-between group hover:border-white/10 transition-colors"
            >
              <div>
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">{stat.label}</p>
                <p className="text-4xl font-black mt-2 tracking-tighter">{stat.value}</p>
              </div>
              <div className={`${stat.bg} p-4 rounded-2xl group-hover:scale-110 transition-transform duration-300`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </motion.div>
          ))}
        </section>

        {/* Search & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Search domains by name or URL..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all placeholder:text-zinc-600"
            />
          </div>
          <button 
            onClick={() => openModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-8 py-3.5 rounded-2xl transition-all flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/20 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span>Audit Domain</span>
          </button>
        </div>

        {/* Global Settings */}
        <motion.section 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-zinc-800 rounded-2xl">
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h4 className="font-bold text-sm">Automated Daily Surveillance</h4>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">Global audit schedule for all domains</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-black/40 p-2 rounded-2xl border border-white/5">
            <input 
              type="time" 
              value={cronTime}
              onChange={(e) => setCronTime(e.target.value)}
              className="bg-transparent border-none text-white font-mono font-bold text-lg focus:ring-0 px-4"
            />
            <button 
              onClick={handleUpdateCron}
              disabled={isUpdatingCron}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-all active:scale-95 flex items-center gap-2"
            >
              {isUpdatingCron ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
              Update
            </button>
          </div>
        </motion.section>

        {/* Table */}
        <section className="bg-[#0a0a0a] rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Target Domain</th>
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Health Status</th>
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest hidden md:table-cell">Last Audit</th>
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Issues Found</th>
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Commands</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {filteredDomains.map((domain, i) => (
                  <motion.tr 
                    key={domain._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="hover:bg-white/[0.01] group transition-colors"
                  >
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="font-bold text-white group-hover:text-blue-400 transition-colors">{domain.url}</span>
                        <span className="text-[10px] text-zinc-500 font-mono mt-1 opacity-70">{domain.primaryEmail}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <StatusBadge status={domain.status} />
                    </td>
                    <td className="px-8 py-6 text-xs text-zinc-500 hidden md:table-cell font-mono">
                      {domain.lastScanDate ? new Date(domain.lastScanDate).toLocaleDateString() : 'Pending'}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center space-x-2">
                        <div className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono ${domain.totalBrokenLinks > 0 ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                          {domain.totalBrokenLinks || 0}
                        </div>
                        {domain.totalBrokenLinks > 0 && <AlertCircle className="w-3.5 h-3.5 text-red-500/40" />}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end space-x-3">
                        <ActionButton 
                          onClick={() => viewReport(domain._id)} 
                          icon={FileText} 
                          color="text-blue-400" 
                          tooltip="View Report"
                          disabled={domain.status === 'scanning' || !domain.lastScanDate}
                        />
                        <ActionButton 
                          onClick={() => triggerScan(domain._id)} 
                          icon={Play} 
                          color="text-green-500" 
                          tooltip="Run Audit"
                          disabled={domain.status === 'scanning'}
                        />
                        <ActionButton 
                          onClick={() => openModal(domain)} 
                          icon={Edit3} 
                          color="text-zinc-400" 
                          tooltip="Settings" 
                        />
                        <ActionButton 
                          onClick={() => deleteDomain(domain._id)} 
                          icon={Trash2} 
                          color="text-red-500" 
                          tooltip="Remove" 
                        />
                      </div>
                    </td>
                  </motion.tr>
                ))}
                {filteredDomains.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-8 py-20 text-center text-zinc-500 italic opacity-40">
                      No domains currently under surveillance.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Audit Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-[#0a0a0a] rounded-[2rem] shadow-2xl p-8 border border-white/10"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-black tracking-tight">
                  {currentDomain ? 'Audit Config' : 'New Domain'}
                </h2>
                <div className="bg-blue-600/20 p-2 rounded-xl">
                  <Globe className="w-5 h-5 text-blue-500" />
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Target URL</label>
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input 
                      type="url" 
                      required 
                      placeholder="https://yourwebsite.com"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Reporting Endpoint (Primary)</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input 
                      type="email" 
                      required 
                      placeholder="admin@startup.com"
                      value={primaryEmail}
                      onChange={(e) => setPrimaryEmail(e.target.value)}
                      className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Internal Stakeholders (Comma separated)</label>
                  <textarea 
                    rows="2"
                    placeholder="dev@team.com, marketing@team.com"
                    value={secondaryEmails}
                    onChange={(e) => setSecondaryEmails(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none transition-all font-mono"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-4 bg-zinc-900 hover:bg-zinc-800 rounded-2xl transition-all font-bold text-zinc-400 border border-white/5"
                  >
                    Discard
                  </button>
                  <button 
                    type="submit" 
                    disabled={submitting}
                    className="flex-[2] px-4 py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl transition-all font-black flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/20 text-white"
                  >
                    {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <span>{currentDomain ? 'Update Settings' : 'Initialize Monitor'}</span>}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReportModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-5xl max-h-[90vh] bg-[#0a0a0a] rounded-[2.5rem] shadow-2xl flex flex-col border border-white/10 overflow-hidden"
            >
              {/* Report Header */}
              <div className="p-8 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
                    <FileText className="text-blue-500" />
                    Detailed Audit Report
                  </h2>
                  <p className="text-xs text-zinc-500 mt-1 uppercase tracking-widest font-mono">
                    {selectedReport?.domain?.url || 'Fetching data...'}
                  </p>
                </div>
                <button 
                  onClick={() => setShowReportModal(false)}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-zinc-400 transition-all active:scale-90"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Report Content */}
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {reportLoading ? (
                  <div className="h-64 flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                    <p className="text-zinc-500 animate-pulse uppercase tracking-widest text-[10px] font-black">Decrypting Evidence...</p>
                  </div>
                ) : selectedReport ? (
                  <div className="space-y-8">
                    {/* Report Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <p className="text-[10px] text-zinc-500 uppercase font-black">Total Broken</p>
                        <p className="text-2xl font-black text-red-500">{selectedReport.totalBrokenLinks}</p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <p className="text-[10px] text-zinc-500 uppercase font-black">Pages Scanned</p>
                        <p className="text-2xl font-black">{selectedReport.totalLinksFound}</p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <p className="text-[10px] text-zinc-500 uppercase font-black">Scan Time</p>
                        <p className="text-2xl font-black">{(selectedReport.scanDuration / 1000).toFixed(1)}s</p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <p className="text-[10px] text-zinc-500 uppercase font-black">Completion</p>
                        <p className="text-2xl font-black text-green-500">100%</p>
                      </div>
                    </div>

                    {/* Filters & Search */}
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                      <input 
                        type="text" 
                        placeholder="Filter findings by URL or error type..."
                        value={reportSearch}
                        onChange={(e) => setReportSearch(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                      />
                    </div>

                    {/* Detailed Table */}
                    <div className="bg-[#0f0f0f] rounded-2xl border border-white/5 overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-white/[0.03] border-b border-white/5">
                            <th className="px-6 py-4 text-[10px] uppercase font-black text-zinc-500">Resource URL</th>
                            <th className="px-6 py-4 text-[10px] uppercase font-black text-zinc-500">Type</th>
                            <th className="px-6 py-4 text-[10px] uppercase font-black text-zinc-500">Status</th>
                            <th className="px-6 py-4 text-[10px] uppercase font-black text-zinc-500">Discovery Page</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.05]">
                          {selectedReport.brokenLinks
                            .filter(l => 
                              l.brokenUrl.toLowerCase().includes(reportSearch.toLowerCase()) || 
                              l.errorType?.toLowerCase().includes(reportSearch.toLowerCase())
                            )
                            .map((link, i) => (
                            <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex flex-col max-w-sm">
                                  <a 
                                    href={link.brokenUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-xs font-bold text-red-500 hover:underline truncate flex items-center gap-1.5"
                                  >
                                    {link.brokenUrl}
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                  <span className="text-[10px] text-zinc-600 mt-1 font-mono uppercase">{link.errorType || 'Broken'}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-[9px] font-black uppercase rounded-md border border-white/5">
                                  {link.type}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-zinc-300">{link.statusCode || '???'}</span>
                                  {link.statusCode === 404 && <span className="text-[10px] text-red-500/60 uppercase font-black">Dead</span>}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <a 
                                  href={link.pageUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-[10px] text-zinc-500 hover:text-blue-400 transition-colors truncate max-w-[150px] block"
                                >
                                  {link.pageUrl}
                                </a>
                              </td>
                            </tr>
                          ))}
                          {selectedReport.brokenLinks.length === 0 && (
                            <tr>
                              <td colSpan="4" className="px-6 py-12 text-center text-zinc-500 italic">No broken links found in this scan.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-zinc-500">No report data available.</div>
                )}
              </div>
              
              {/* Footer */}
              <div className="p-6 border-t border-white/5 bg-white/[0.01] flex justify-end">
                 <button 
                  onClick={() => setShowReportModal(false)}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-600/20 transition-all"
                >
                  OK, Noted
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper Components
function StatusBadge({ status }) {
  const configs = {
    pending: { color: 'text-zinc-500', bg: 'bg-zinc-500/5', icon: Clock, text: 'Idling' },
    scanning: { color: 'text-blue-400', bg: 'bg-blue-500/10', icon: Activity, text: 'Scanning' },
    completed: { color: 'text-green-500', bg: 'bg-green-500/10', icon: CheckCircle, text: 'Monitored' },
    failed: { color: 'text-red-500', bg: 'bg-red-500/10', icon: AlertCircle, text: 'Error' },
  };

  const config = configs[status] || configs.pending;
  return (
    <div className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-full ${config.bg} ${config.color} border border-white/5`}>
      <config.icon className={`w-3 h-3 ${status === 'scanning' ? 'animate-pulse' : ''}`} />
      <span className="text-[10px] font-black uppercase tracking-widest">{config.text}</span>
    </div>
  );
}

function ActionButton({ onClick, icon: Icon, color, tooltip, disabled }) {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] transition-all ${color} disabled:opacity-20 disabled:pointer-events-none group relative border border-white/5`}
    >
      <Icon className="w-4 h-4" />
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-2 py-1.5 bg-zinc-900 border border-white/10 text-[9px] font-black text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 whitespace-nowrap pointer-events-none z-50 uppercase tracking-widest shadow-2xl">
        {tooltip}
      </span>
    </button>
  );
}
