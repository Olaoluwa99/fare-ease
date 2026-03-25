/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  ShieldCheck, 
  ShieldAlert, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  LayoutDashboard, 
  History, 
  UserCheck,
  Smartphone,
  Copy,
  ExternalLink,
  Menu,
  X,
  TrendingUp,
  CreditCard,
  LogOut,
  LogIn,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { supabase } from './supabase';
import { User } from '@supabase/supabase-js';

// --- Error Boundary ---

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  public state: { hasError: boolean, error: any };
  public props: { children: React.ReactNode };

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.props = props;
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FF3131] text-white flex flex-col items-center justify-center p-8 text-center">
          <AlertTriangle size={64} className="mb-6" />
          <h1 className="text-4xl font-black uppercase mb-4 tracking-tighter">System Failure</h1>
          <p className="font-bold mb-8 max-w-md">
            An unexpected error occurred. Our engineers have been notified.
          </p>
          <BrutalistCard className="bg-white text-black text-left max-w-2xl overflow-auto max-h-64">
            <pre className="text-xs font-mono whitespace-pre-wrap">
              {this.state.error?.message || "Unknown Error"}
            </pre>
          </BrutalistCard>
          <BrutalistButton 
            variant="secondary" 
            className="mt-8"
            onClick={() => window.location.reload()}
          >
            Reboot System
          </BrutalistButton>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Types ---

type Screen = 'dashboard' | 'create' | 'trust' | 'history' | 'onboarding' | 'share' | 'profile';

interface Waybill {
  id: string;
  customerName: string;
  itemValue: number;
  riderFee: number;
  riderName: string;
  riderAccount: string;
  status: 'PENDING' | 'FUNDED' | 'SETTLED';
  timestamp: string;
  virtualAccount: string;
  bankName: string;
}

interface RiderReputation {
  account: string;
  name: string;
  drops: number;
  vendors: number;
  trustScore: 'high' | 'low' | 'none';
}

// --- Mock Data ---

const MOCK_WAYBILLS: Waybill[] = [
  {
    id: "WB-9021",
    customerName: "Adebayo T.",
    itemValue: 25000,
    riderFee: 2500,
    riderName: "Musa Delivery",
    riderAccount: "0123456789",
    status: 'SETTLED',
    timestamp: "2026-03-24T14:30:00Z",
    virtualAccount: "9928374651",
    bankName: "Wema Bank / FareEase"
  },
  {
    id: "WB-9022",
    customerName: "Chioma O.",
    itemValue: 12000,
    riderFee: 1500,
    riderName: "Swift Rider",
    riderAccount: "9876543210",
    status: 'FUNDED',
    timestamp: "2026-03-24T16:15:00Z",
    virtualAccount: "1122334455",
    bankName: "Wema Bank / FareEase"
  },
  {
    id: "WB-9023",
    customerName: "Ibrahim K.",
    itemValue: 45000,
    riderFee: 3500,
    riderName: "Express Biker",
    riderAccount: "5544332211",
    status: 'PENDING',
    timestamp: "2026-03-25T08:00:00Z",
    virtualAccount: "6677889900",
    bankName: "Wema Bank / FareEase"
  }
];

const MOCK_RIDERS: RiderReputation[] = [
  { account: "0123456789", name: "Musa Delivery", drops: 142, vendors: 12, trustScore: 'high' },
  { account: "9876543210", name: "Swift Rider", drops: 68, vendors: 5, trustScore: 'high' },
  { account: "5544332211", name: "Express Biker", drops: 0, vendors: 0, trustScore: 'none' },
  { account: "1112223334", name: "Unknown Rider", drops: 2, vendors: 1, trustScore: 'low' },
];

const CHART_DATA = [
  { day: 'Mon', volume: 120000 },
  { day: 'Tue', volume: 180000 },
  { day: 'Wed', volume: 150000 },
  { day: 'Thu', volume: 220000 },
  { day: 'Fri', volume: 310000 },
  { day: 'Sat', volume: 280000 },
  { day: 'Sun', volume: 140000 },
];

// --- Components ---

const BrutalistButton = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = "" 
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  className?: string;
}) => {
  const variants = {
    primary: "bg-[#00FF00] text-black border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
    secondary: "bg-white text-black border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
    danger: "bg-[#FF3131] text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
    outline: "bg-transparent text-black border-2 border-black hover:bg-black hover:text-white"
  };

  return (
    <button 
      onClick={onClick}
      className={`px-6 py-3 font-bold uppercase tracking-wider transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

const BrutalistCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 ${className}`}>
    {children}
  </div>
);

const StatusBadge = ({ status }: { status: string }) => {
  const configs: Record<string, { label: string, color: string }> = {
    PENDING: { label: 'Pending', color: 'bg-yellow-300' },
    FUNDED: { label: 'Funded', color: 'bg-blue-400 text-white' },
    SETTLED: { label: 'Settled', color: 'bg-[#00FF00]' },
    VERIFIED: { label: 'Verified', color: 'bg-[#00FF00]' },
    REJECTED: { label: 'Rejected', color: 'bg-[#FF3131] text-white' }
  };

  const normalizedStatus = status.toUpperCase();
  const config = configs[normalizedStatus] || { label: status, color: 'bg-gray-200' };

  return (
    <span className={`px-3 py-1 border-2 border-black font-bold text-xs uppercase ${config.color}`}>
      {config.label}
    </span>
  );
};

// --- Main App ---

function FareEaseApp() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [onboardingData, setOnboardingData] = useState({
    businessName: '',
    identityType: 'BVN',
    identityNumber: '',
    bankName: '',
    accountNumber: ''
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [trustResult, setTrustResult] = useState<RiderReputation | null>(null);
  const [activeWaybill, setActiveWaybill] = useState<Waybill | null>(null);

  // Create Waybill Form State
  const [createForm, setCreateForm] = useState({
    itemValue: '',
    riderFee: '',
    customerName: '',
    riderBankCode: '',
    riderAccountNumber: '',
  });
  const [nameEnquiryResult, setNameEnquiryResult] = useState<{ accountName: string; reputation: any } | null>(null);
  const [isNameLoading, setIsNameLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Real Data State
  const [waybills, setWaybills] = useState<Waybill[]>([]);
  const [vendorProfile, setVendorProfile] = useState<any>(null);

  const stats = {
    totalVolume: waybills.reduce((acc, curr) => acc + curr.itemValue, 0),
    activeWaybills: waybills.filter(w => w.status === 'PENDING').length,
    securityScore: 98,
    growth: 12.5
  };

  // Auth Listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user || null;
      setUser(u);
      setIsAuthReady(true);
      
      if (u) {
        // Fetch or create vendor profile
        supabase
          .from('vendors')
          .select('*')
          .eq('id', u.id)
          .single()
          .then(({ data, error }) => {
            if (data) {
              setVendorProfile(data);
            } else if (error && error.code === 'PGRST116') {
              // Not found
              setCurrentScreen('onboarding');
            }
          });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Supabase Realtime Listeners
  useEffect(() => {
    if (!user) return;

    // Initial Fetch
    const fetchWaybills = async () => {
      const { data, error } = await supabase
        .from('waybills')
        .select('*')
        .eq('vendor_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) {
        setWaybills(data.map(wb => ({
          ...wb,
          id: wb.id,
          timestamp: wb.created_at,
          virtualAccount: wb.virtual_account_number
        })));
      }
    };

    fetchWaybills();

    // Subscribe to changes
    const channel = supabase
      .channel('waybills_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'waybills',
          filter: `vendor_id=eq.${user.id}`
        },
        () => {
          fetchWaybills();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleLogin = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = () => supabase.auth.signOut();

  const handleTrustSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    
    try {
      const { data, error } = await supabase
        .from('rider_reputation')
        .select('*')
        .eq('rider_account', searchQuery)
        .single();
      
      if (data) {
        setTrustResult({
          account: searchQuery,
          name: data.rider_name,
          drops: data.successful_drops,
          vendors: data.unique_vendors_served,
          trustScore: data.successful_drops > 50 ? 'high' : data.successful_drops > 5 ? 'low' : 'none'
        });
      } else {
        setTrustResult({ account: searchQuery, name: "Unknown", drops: 0, vendors: 0, trustScore: 'none' });
      }
    } catch (error) {
      console.error("Trust search failed:", error);
    }
  };

  // Name Enquiry — called when rider account number reaches 10 digits
  const handleNameEnquiry = async (accountId: string, bankCode: string) => {
    if (accountId.length !== 10 || !bankCode) return;
    setIsNameLoading(true);
    setNameEnquiryResult(null);
    try {
      const res = await fetch('/api/interswitch/name-enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, bankCode }),
      });
      if (!res.ok) throw new Error('Name enquiry failed');
      const data = await res.json();
      setNameEnquiryResult(data);
    } catch (err) {
      console.error('Name enquiry failed:', err);
      setNameEnquiryResult(null);
    } finally {
      setIsNameLoading(false);
    }
  };

  const handleCreateWaybill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsCreating(true);

    try {
      const itemValue = Number(createForm.itemValue);
      const riderFee = Number(createForm.riderFee);

      if (!itemValue || !riderFee) {
        alert('Please enter item value and rider fee');
        setIsCreating(false);
        return;
      }

      // Call backend — it creates waybill + generates VA
      const vaResponse = await fetch('/api/waybills/generate-va', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: user.id,
          itemValue,
          riderFee,
          appFee: 100,
          customerName: createForm.customerName || 'Customer',
          riderName: nameEnquiryResult?.accountName || 'Rider',
          riderAccount: createForm.riderAccountNumber,
          riderBankCode: createForm.riderBankCode,
        }),
      });

      if (!vaResponse.ok) {
        const err = await vaResponse.json();
        throw new Error(err.detail || 'Failed to generate virtual account');
      }

      const result = await vaResponse.json();

      const newWb = {
        id: result.waybillId,
        customerName: createForm.customerName || 'Customer',
        itemValue,
        riderFee,
        riderName: nameEnquiryResult?.accountName || 'Rider',
        riderAccount: createForm.riderAccountNumber,
        status: 'PENDING' as const,
        timestamp: new Date().toISOString(),
        virtualAccount: result.virtualAccount,
        bankName: result.bankName,
      };

      setActiveWaybill(newWb);
      setCurrentScreen('share');

      // Reset form
      setCreateForm({ itemValue: '', riderFee: '', customerName: '', riderBankCode: '', riderAccountNumber: '' });
      setNameEnquiryResult(null);
    } catch (error: any) {
      console.error('Create waybill failed:', error);
      alert(error.message || 'Failed to create waybill');
    } finally {
      setIsCreating(false);
    }
  };

  const handleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const profileData = {
        id: user.id,
        business_name: onboardingData.businessName || user.user_metadata?.full_name || 'New Vendor',
        kyc_status: "PENDING",
        identity_type: onboardingData.identityType,
        identity_number: onboardingData.identityNumber,
        settlement_bank_code: onboardingData.bankName,
        settlement_account_number: onboardingData.accountNumber,
        total_routed_volume: 0,
        verification_date: null
      };

      const { error } = await supabase
        .from('vendors')
        .upsert(profileData);

      if (error) throw error;
      
      setVendorProfile(profileData);
      setCurrentScreen('dashboard');
    } catch (error) {
      console.error("Onboarding failed:", error);
    }
  };

  const handleShareWhatsApp = () => {
    if (!activeWaybill) return;
    const total = activeWaybill.itemValue + activeWaybill.riderFee + 100;
    const message = `*FareEase Vault Account Ready*%0A%0AHello! Please pay for your order using the details below:%0A%0A🏦 *Bank:* ${activeWaybill.bankName}%0A🔢 *Account:* ${activeWaybill.virtualAccount}%0A💰 *Amount:* ₦${total.toLocaleString()}%0A%0A_This is a single-use vault account. Your payment will be confirmed instantly._`;
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const handleCopyAccount = () => {
    if (!activeWaybill) return;
    navigator.clipboard.writeText(activeWaybill.virtualAccount);
    // In a real app, show a toast here
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-4 border-[#00FF00] border-t-transparent"
        />
        <p className="mt-8 text-[#00FF00] font-black uppercase tracking-widest animate-pulse">Initializing Vault...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F0F0F0] flex flex-col items-center justify-center p-8">
        <div className="max-w-md w-full text-center space-y-8">
          <div className="w-24 h-24 bg-black flex items-center justify-center mx-auto rotate-12 shadow-[8px_8px_0px_0px_rgba(0,255,0,1)]">
            <Smartphone className="text-[#00FF00] w-12 h-12" />
          </div>
          <div>
            <h1 className="text-6xl font-black uppercase tracking-tighter italic">FareEase</h1>
            <p className="font-bold text-gray-500 uppercase tracking-widest mt-2">The Social Commerce Trust Layer</p>
          </div>
          <BrutalistCard className="space-y-6">
            <p className="font-bold uppercase text-sm leading-relaxed">
              Secure your capital. Route rider payments instantly. Eliminate COD embezzlement.
            </p>
            <BrutalistButton className="w-full flex items-center justify-center gap-3 py-4" onClick={handleLogin}>
              <LogIn size={24} />
              Vendor Login
            </BrutalistButton>
          </BrutalistCard>
          <p className="text-[10px] font-bold uppercase text-gray-400">
            Securely powered by Interswitch & Google Cloud
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F0F0] font-sans text-black selection:bg-[#00FF00]">
      {/* Mobile Header */}
      <header className="lg:hidden bg-white border-b-4 border-black p-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black flex items-center justify-center">
            <Smartphone className="text-[#00FF00] w-5 h-5" />
          </div>
          <span className="font-black text-xl tracking-tighter uppercase italic">FareEase</span>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          {isSidebarOpen ? <X size={32} /> : <Menu size={32} />}
        </button>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`
          fixed inset-0 z-40 lg:relative lg:z-auto
          w-full lg:w-72 bg-white border-r-4 border-black min-h-screen
          transition-transform duration-300 lg:translate-x-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="p-8 flex flex-col h-full">
            <div className="hidden lg:flex items-center gap-3 mb-12">
              <div className="w-10 h-10 bg-black flex items-center justify-center rotate-3">
                <Smartphone className="text-[#00FF00] w-6 h-6" />
              </div>
              <span className="font-black text-3xl tracking-tighter uppercase italic">FareEase</span>
            </div>

            <nav className="space-y-4 flex-1">
              {[
                { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
                { id: 'create', icon: Plus, label: 'New Waybill' },
                { id: 'trust', icon: ShieldCheck, label: 'Trust Lookup' },
                { id: 'history', icon: History, label: 'History' },
                { id: 'profile', icon: UserCheck, label: 'Business Profile' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentScreen(item.id as Screen);
                    setIsSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-4 p-4 font-bold uppercase tracking-wider border-2 border-black transition-all
                    ${currentScreen === item.id 
                      ? 'bg-[#00FF00] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-[-2px] translate-y-[-2px]' 
                      : 'bg-white hover:bg-gray-100'}
                  `}
                >
                  <item.icon size={24} />
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="mt-auto pt-8 border-t-2 border-black">
              <div 
                className="flex items-center gap-3 mb-4 cursor-pointer hover:bg-gray-50 p-2 border-2 border-transparent hover:border-black transition-all"
                onClick={() => setCurrentScreen('profile')}
              >
                <div className="w-10 h-10 bg-gray-200 border-2 border-black rounded-full overflow-hidden">
                  <img src={user.user_metadata?.avatar_url || "https://picsum.photos/seed/vendor/100/100"} alt="Vendor" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <p className="font-black text-sm uppercase truncate max-w-[120px]">{vendorProfile?.business_name || user.user_metadata?.full_name || 'New Vendor'}</p>
                  <div className="flex items-center gap-1">
                    <p className={`text-[10px] font-black uppercase ${vendorProfile?.kyc_status === 'VERIFIED' ? 'text-[#00FF00]' : 'text-yellow-500'}`}>
                      {vendorProfile?.kyc_status || 'Unverified'}
                    </p>
                    {vendorProfile?.kyc_status === 'VERIFIED' && <ShieldCheck size={10} className="text-[#00FF00]" />}
                  </div>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-2 p-2 text-xs font-black uppercase text-[#FF3131] hover:bg-red-50 transition-colors"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-12 max-w-6xl mx-auto w-full">
          <AnimatePresence mode="wait">
            {currentScreen === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <h1 className="text-5xl lg:text-7xl font-black uppercase tracking-tighter leading-none mb-2">
                      Control <br /> <span className="text-[#00FF00] stroke-black stroke-2">Center</span>
                    </h1>
                    <p className="font-bold text-gray-500 uppercase tracking-widest">Securing your capital in real-time</p>
                  </div>
                  <BrutalistButton onClick={() => setCurrentScreen('create')}>
                    <div className="flex items-center gap-2">
                      <Plus size={20} />
                      Generate Waybill
                    </div>
                  </BrutalistButton>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <BrutalistCard className="bg-black text-white">
                    <p className="uppercase font-bold text-xs text-[#00FF00] mb-2 tracking-widest">Total Routed</p>
                    <h2 className="text-4xl font-black">₦{stats.totalVolume.toLocaleString()}</h2>
                    <div className="mt-4 flex items-center gap-2 text-[#00FF00]">
                      <TrendingUp size={16} />
                      <span className="text-xs font-bold">+{stats.growth}% this week</span>
                    </div>
                  </BrutalistCard>
                  <BrutalistCard>
                    <p className="uppercase font-bold text-xs text-gray-500 mb-2 tracking-widest">Active Waybills</p>
                    <h2 className="text-4xl font-black">{stats.activeWaybills}</h2>
                    <p className="mt-4 text-xs font-bold uppercase">{waybills.filter(w => w.status === 'PENDING').length} Pending Settlement</p>
                  </BrutalistCard>
                  <BrutalistCard className="bg-[#00FF00]">
                    <p className="uppercase font-bold text-xs text-black/60 mb-2 tracking-widest">Security Score</p>
                    <h2 className="text-4xl font-black">{stats.securityScore}%</h2>
                    <p className="mt-4 text-xs font-bold uppercase">Zero Embezzlement Detected</p>
                  </BrutalistCard>
                </div>

                {/* Chart & Recent Activity */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                  <BrutalistCard className="h-[400px] flex flex-col">
                    <h3 className="font-black uppercase mb-6 flex items-center gap-2">
                      <TrendingUp size={20} />
                      Disbursement Volume
                    </h3>
                    <div className="flex-1 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={CHART_DATA}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ddd" />
                          <XAxis 
                            dataKey="day" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontWeight: 'bold', fontSize: 12 }} 
                          />
                          <YAxis hide />
                          <Tooltip 
                            cursor={{ fill: '#f0f0f0' }}
                            contentStyle={{ border: '2px solid black', borderRadius: '0', fontWeight: 'bold' }}
                          />
                          <Bar dataKey="volume" radius={[4, 4, 0, 0]}>
                            {CHART_DATA.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index === 4 ? '#00FF00' : '#000'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </BrutalistCard>

                  <BrutalistCard className="flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="font-black uppercase flex items-center gap-2">
                        <Clock size={20} />
                        Live Feed
                      </h3>
                      <button className="text-xs font-bold uppercase underline">View All</button>
                    </div>
                    <div className="space-y-4 flex-1">
                      {waybills.length > 0 ? waybills.slice(0, 5).map((wb) => (
                        <div key={wb.id} className="group flex items-center justify-between p-4 border-2 border-black hover:bg-gray-50 transition-colors cursor-pointer">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 border-2 border-black flex items-center justify-center ${wb.status === 'SETTLED' ? 'bg-[#00FF00]' : 'bg-white'}`}>
                              {wb.status === 'SETTLED' ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                            </div>
                            <div>
                              <p className="font-black text-sm uppercase">{wb.customer_name}</p>
                              <p className="text-xs font-bold text-gray-500 uppercase">{wb.id} • {wb.rider_name}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-sm">₦{wb.item_value.toLocaleString()}</p>
                            <StatusBadge status={wb.status} />
                          </div>
                        </div>
                      )) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 uppercase italic font-bold">
                          No recent activity
                        </div>
                      )}
                    </div>
                  </BrutalistCard>
                </div>
              </motion.div>
            )}

            {currentScreen === 'create' && (
              <motion.div
                key="create"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-2xl mx-auto space-y-8"
              >
                <div className="text-center">
                  <h1 className="text-5xl font-black uppercase tracking-tighter mb-4">New Waybill</h1>
                  <p className="font-bold text-gray-500 uppercase tracking-widest">Generate a single-use virtual account</p>
                </div>

                <BrutalistCard>
                  <form className="space-y-6" onSubmit={handleCreateWaybill}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest">Item Value (₦)</label>
                        <input 
                          type="number" 
                          placeholder="25,000"
                          value={createForm.itemValue}
                          onChange={(e) => setCreateForm({ ...createForm, itemValue: e.target.value })}
                          className="w-full p-4 border-2 border-black font-bold focus:bg-[#00FF00] focus:outline-none transition-colors"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest">Rider Fee (₦)</label>
                        <input 
                          type="number" 
                          placeholder="2,500"
                          value={createForm.riderFee}
                          onChange={(e) => setCreateForm({ ...createForm, riderFee: e.target.value })}
                          className="w-full p-4 border-2 border-black font-bold focus:bg-[#00FF00] focus:outline-none transition-colors"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest">Customer Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Adebayo T."
                        value={createForm.customerName}
                        onChange={(e) => setCreateForm({ ...createForm, customerName: e.target.value })}
                        className="w-full p-4 border-2 border-black font-bold focus:bg-[#00FF00] focus:outline-none transition-colors"
                      />
                    </div>

                    <div className="p-4 bg-gray-100 border-2 border-black border-dashed">
                      <h4 className="text-xs font-black uppercase mb-4 flex items-center gap-2">
                        <Smartphone size={16} />
                        Rider Payout Details
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-gray-500">Bank Name</label>
                          <select 
                            className="w-full p-2 border-2 border-black font-bold text-sm bg-white"
                            value={createForm.riderBankCode}
                            onChange={(e) => {
                              const bankCode = e.target.value;
                              setCreateForm({ ...createForm, riderBankCode: bankCode });
                              if (createForm.riderAccountNumber.length === 10 && bankCode) {
                                handleNameEnquiry(createForm.riderAccountNumber, bankCode);
                              }
                            }}
                            required
                          >
                            <option value="">Select Bank</option>
                            <option value="999992">OPay</option>
                            <option value="999991">PalmPay</option>
                            <option value="50515">Moniepoint</option>
                            <option value="50211">Kuda Bank</option>
                            <option value="044">Access Bank</option>
                            <option value="058">GTBank</option>
                            <option value="057">Zenith Bank</option>
                            <option value="011">First Bank</option>
                            <option value="033">UBA</option>
                            <option value="035">Wema Bank</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-gray-500">Account Number</label>
                          <input 
                            type="text" 
                            placeholder="0123456789"
                            maxLength={10}
                            value={createForm.riderAccountNumber}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              setCreateForm({ ...createForm, riderAccountNumber: val });
                              if (val.length === 10 && createForm.riderBankCode) {
                                handleNameEnquiry(val, createForm.riderBankCode);
                              }
                            }}
                            className="w-full p-2 border-2 border-black font-bold text-sm"
                            required
                          />
                        </div>
                      </div>

                      {/* Name Enquiry Result */}
                      {isNameLoading && (
                        <div className="mt-3 p-3 border-2 border-black bg-yellow-100 animate-pulse">
                          <p className="text-xs font-black uppercase">Verifying account...</p>
                        </div>
                      )}
                      {nameEnquiryResult && !isNameLoading && (
                        <div className={`mt-3 p-3 border-2 border-black ${
                          nameEnquiryResult.reputation?.trustLevel === 'high' ? 'bg-[#00FF00]' :
                          nameEnquiryResult.reputation?.trustLevel === 'low' ? 'bg-yellow-200' : 'bg-red-100'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-black uppercase text-sm">{nameEnquiryResult.accountName}</p>
                              <p className="text-[10px] font-bold uppercase text-black/60">
                                {nameEnquiryResult.reputation?.successfulDrops || 0} Drops • {nameEnquiryResult.reputation?.uniqueVendors || 0} Vendors
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              {nameEnquiryResult.reputation?.trustLevel === 'high' ? (
                                <><ShieldCheck size={16} /><span className="text-[10px] font-black uppercase">Trusted</span></>
                              ) : nameEnquiryResult.reputation?.trustLevel === 'none' ? (
                                <><ShieldAlert size={16} /><span className="text-[10px] font-black uppercase">No History</span></>
                              ) : (
                                <><Clock size={16} /><span className="text-[10px] font-black uppercase">Low History</span></>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-black text-white p-6 border-2 border-black">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold uppercase text-gray-400">Total Customer Pay</span>
                        <span className="text-2xl font-black">
                          ₦{((Number(createForm.itemValue) || 0) + (Number(createForm.riderFee) || 0) + 100).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-bold uppercase text-[#00FF00]">
                        <span>FareEase Fee</span>
                        <span>₦100</span>
                      </div>
                    </div>

                    <BrutalistButton className="w-full py-4 text-xl">
                      {isCreating ? 'Generating...' : 'Generate Vault Account'}
                    </BrutalistButton>
                  </form>
                </BrutalistCard>

                <div className="flex items-center gap-4 p-4 bg-yellow-100 border-2 border-black">
                  <ShieldAlert className="text-black shrink-0" />
                  <p className="text-xs font-bold uppercase leading-tight">
                    Rider KYC is not required. Funds will be auto-split the millisecond the customer pays.
                  </p>
                </div>
              </motion.div>
            )}

            {currentScreen === 'share' && activeWaybill && (
              <motion.div
                key="share"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="max-w-xl mx-auto space-y-8"
              >
                <div className="text-center">
                  <div className="w-20 h-20 bg-[#00FF00] border-4 border-black mx-auto flex items-center justify-center mb-6 rotate-6">
                    <CheckCircle2 size={48} />
                  </div>
                  <h1 className="text-5xl font-black uppercase tracking-tighter mb-2">Vault Ready</h1>
                  <p className="font-bold text-gray-500 uppercase tracking-widest">Share these details with your customer</p>
                </div>

                <BrutalistCard className="bg-black text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 bg-[#00FF00] text-black font-black text-[10px] uppercase tracking-tighter rotate-45 translate-x-4 -translate-y-2">
                    Single Use
                  </div>
                  <div className="space-y-6">
                    <div>
                      <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Bank Name</p>
                      <p className="text-xl font-black uppercase">{activeWaybill.bankName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Account Number</p>
                      <div className="flex items-center justify-between">
                        <p className="text-4xl font-black tracking-tighter">{activeWaybill.virtualAccount}</p>
                        <button 
                          onClick={handleCopyAccount}
                          className="p-2 bg-[#00FF00] text-black border-2 border-black hover:translate-x-[-2px] hover:translate-y-[-2px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-0 active:translate-y-0"
                        >
                          <Copy size={20} />
                        </button>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-white/20">
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-bold uppercase text-gray-400">Amount to Pay</p>
                        <p className="text-2xl font-black">₦{(activeWaybill.itemValue + activeWaybill.riderFee + 100).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </BrutalistCard>

                <div className="space-y-4">
                  <BrutalistButton 
                    onClick={handleShareWhatsApp}
                    className="w-full py-4 flex items-center justify-center gap-2"
                  >
                    <Smartphone size={24} />
                    Share to WhatsApp
                  </BrutalistButton>
                  <BrutalistButton variant="secondary" className="w-full py-4" onClick={() => setCurrentScreen('dashboard')}>
                    Back to Dashboard
                  </BrutalistButton>
                </div>

                <div className="p-4 bg-blue-100 border-2 border-black flex gap-3 items-start">
                  <ShieldCheck className="shrink-0" />
                  <p className="text-xs font-bold uppercase leading-tight">
                    This account is linked to Waybill {activeWaybill.id}. You will receive a WhatsApp notification the moment payment is confirmed.
                  </p>
                </div>
              </motion.div>
            )}

            {currentScreen === 'onboarding' && (
              <motion.div
                key="onboarding"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto space-y-8"
              >
                <div className="text-center">
                  <h1 className="text-6xl font-black uppercase tracking-tighter mb-4 italic">Welcome to <br /> <span className="text-[#00FF00]">FareEase</span></h1>
                  <p className="font-bold text-gray-500 uppercase tracking-widest">Complete your business profile to start routing</p>
                </div>

                <BrutalistCard>
                  <form className="space-y-8" onSubmit={handleOnboarding}>
                    <div className="space-y-4">
                      <h3 className="font-black uppercase text-xl border-b-4 border-black inline-block">1. Business Identity</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-gray-500">Business Name (CAC)</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Luxe Fabrics NG" 
                            className="w-full p-4 border-2 border-black font-bold focus:bg-[#00FF00] focus:outline-none"
                            value={onboardingData.businessName}
                            onChange={(e) => setOnboardingData({...onboardingData, businessName: e.target.value})}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-gray-500">Identity Type</label>
                          <select 
                            className="w-full p-4 border-2 border-black font-bold bg-white focus:bg-[#00FF00] focus:outline-none"
                            value={onboardingData.identityType}
                            onChange={(e) => setOnboardingData({...onboardingData, identityType: e.target.value})}
                          >
                            <option value="BVN">BVN (11 Digits)</option>
                            <option value="NIN">NIN (11 Digits)</option>
                            <option value="RC_NUMBER">RC Number (Business)</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-gray-500">Identity Number</label>
                        <input 
                          type="text" 
                          placeholder="Enter Number" 
                          className="w-full p-4 border-2 border-black font-bold focus:bg-[#00FF00] focus:outline-none"
                          value={onboardingData.identityNumber}
                          onChange={(e) => setOnboardingData({...onboardingData, identityNumber: e.target.value})}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-black uppercase text-xl border-b-4 border-black inline-block">2. Settlement Bank</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-gray-500">Select Bank</label>
                          <select 
                            className="w-full p-4 border-2 border-black font-bold bg-white focus:bg-[#00FF00] focus:outline-none"
                            value={onboardingData.bankName}
                            onChange={(e) => setOnboardingData({...onboardingData, bankName: e.target.value})}
                            required
                          >
                            <option value="">Select Bank</option>
                            <option value="058">GTBank</option>
                            <option value="011">First Bank</option>
                            <option value="057">Zenith Bank</option>
                            <option value="044">Access Bank</option>
                            <option value="033">UBA</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-gray-500">Account Number</label>
                          <input 
                            type="text" 
                            placeholder="10 Digits" 
                            className="w-full p-4 border-2 border-black font-bold focus:bg-[#00FF00] focus:outline-none"
                            value={onboardingData.accountNumber}
                            onChange={(e) => setOnboardingData({...onboardingData, accountNumber: e.target.value})}
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-6 bg-gray-100 border-2 border-black border-dashed text-center">
                      <p className="font-black uppercase text-sm mb-4">Upload CAC Document / ID</p>
                      <div className="w-full h-32 border-4 border-black border-dotted flex flex-col items-center justify-center cursor-pointer hover:bg-white transition-colors">
                        <Plus size={32} />
                        <span className="text-xs font-bold uppercase mt-2">Drag & Drop or Click</span>
                      </div>
                    </div>

                    <BrutalistButton className="w-full py-4 text-xl">
                      Complete Verification
                    </BrutalistButton>
                  </form>
                </BrutalistCard>
              </motion.div>
            )}

            {currentScreen === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-3xl mx-auto space-y-8"
              >
                <div className="flex justify-between items-end">
                  <div>
                    <h1 className="text-5xl font-black uppercase tracking-tighter">Business Profile</h1>
                    <p className="font-bold text-gray-500 uppercase tracking-widest">Your verified routing identity</p>
                  </div>
                  <BrutalistButton variant="secondary">Edit Profile</BrutalistButton>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <BrutalistCard className="md:col-span-1 flex flex-col items-center text-center">
                    <div className="w-32 h-32 border-4 border-black mb-4 rotate-3 overflow-hidden">
                      <img src={user.user_metadata?.avatar_url || "https://picsum.photos/seed/vendor/200/200"} alt="Vendor" referrerPolicy="no-referrer" />
                    </div>
                    <h2 className="font-black uppercase text-xl">{vendorProfile?.business_name || user.user_metadata?.full_name}</h2>
                    <p className="text-xs font-bold text-gray-500 uppercase mb-4">Member since 2025</p>
                    <div className="bg-[#00FF00] px-4 py-1 border-2 border-black font-black text-[10px] uppercase italic">{vendorProfile?.kyc_status || 'Level 1'}</div>
                  </BrutalistCard>

                  <BrutalistCard className="md:col-span-2 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-black uppercase text-gray-400">Business Name</p>
                        <p className="font-bold uppercase">{vendorProfile?.business_name || 'Not Set'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-gray-400">{vendorProfile?.identity_type || 'ID'} Number</p>
                        <p className="font-bold uppercase">{vendorProfile?.identity_number || 'Not Set'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-gray-400">Settlement Bank</p>
                        <p className="font-bold uppercase">{vendorProfile?.settlement_bank_code || 'Not Set'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-gray-400">Account Number</p>
                        <p className="font-bold uppercase">{vendorProfile?.settlement_account_number || 'Not Set'}</p>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-gray-100 border-2 border-black">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-xs font-black uppercase flex items-center gap-2">
                          <ShieldCheck size={16} />
                          KYC Verification Status
                        </h4>
                        <StatusBadge status={vendorProfile?.kyc_status?.toLowerCase() || 'pending'} />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase">
                          <div className={`w-3 h-3 rounded-full ${vendorProfile?.kyc_status === 'VERIFIED' ? 'bg-[#00FF00]' : 'bg-gray-300'}`} />
                          Identity Verification
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold uppercase">
                          <div className={`w-3 h-3 rounded-full ${vendorProfile?.kyc_status === 'VERIFIED' ? 'bg-[#00FF00]' : 'bg-gray-300'}`} />
                          Bank Account Linkage
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold uppercase">
                          <div className="w-3 h-3 rounded-full bg-gray-300" />
                          Business Document Review
                        </div>
                      </div>
                      {vendorProfile?.kyc_status !== 'VERIFIED' && (
                        <BrutalistButton variant="secondary" className="w-full mt-4 text-xs py-2">
                          Upgrade to Level 2
                        </BrutalistButton>
                      )}
                    </div>

                    <div className="pt-4 border-t-2 border-black">
                      <p className="text-[10px] font-black uppercase text-gray-400 mb-2">Security Settings</p>
                      <div className="flex items-center gap-4">
                        <div className="flex-1 p-3 bg-gray-100 border-2 border-black font-bold text-xs uppercase">
                          Two-Factor Auth: <span className="text-[#00FF00]">Active</span>
                        </div>
                        <div className="flex-1 p-3 bg-gray-100 border-2 border-black font-bold text-xs uppercase">
                          Withdrawal Lock: <span className="text-[#FF3131]">Disabled</span>
                        </div>
                      </div>
                    </div>
                  </BrutalistCard>
                </div>

                <BrutalistCard className="bg-black text-white">
                  <h3 className="font-black uppercase mb-4 flex items-center gap-2">
                    <CreditCard size={20} className="text-[#00FF00]" />
                    Routing Ledger Summary
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-gray-400">Total Volume</p>
                      <p className="text-xl font-black">₦1.4M</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-gray-400">Success Rate</p>
                      <p className="text-xl font-black text-[#00FF00]">99.8%</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-gray-400">Riders Used</p>
                      <p className="text-xl font-black">42</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-gray-400">Fees Paid</p>
                      <p className="text-xl font-black">₦4,200</p>
                    </div>
                  </div>
                </BrutalistCard>
              </motion.div>
            )}

            {currentScreen === 'trust' && (
              <motion.div
                key="trust"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-2xl mx-auto space-y-8"
              >
                <div className="text-center">
                  <h1 className="text-5xl font-black uppercase tracking-tighter mb-4">Trust Lookup</h1>
                  <p className="font-bold text-gray-500 uppercase tracking-widest">Verify rider reputation before dispatch</p>
                </div>

                <BrutalistCard>
                  <form onSubmit={handleTrustSearch} className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Enter Rider Account Number (OPay/PalmPay)"
                        className="w-full pl-12 pr-4 py-4 border-2 border-black font-bold focus:bg-[#00FF00] focus:outline-none transition-colors"
                      />
                    </div>
                    <BrutalistButton>Check</BrutalistButton>
                  </form>
                </BrutalistCard>

                {trustResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <BrutalistCard className={
                      trustResult.trustScore === 'high' ? 'bg-[#00FF00]' : 
                      trustResult.trustScore === 'low' ? 'bg-yellow-300' : 'bg-[#FF3131] text-white'
                    }>
                      <div className="flex items-start justify-between mb-8">
                        <div className="flex gap-4 items-center">
                          <div className="w-20 h-20 bg-white border-4 border-black rotate-3 overflow-hidden">
                            <img src={`https://picsum.photos/seed/${trustResult.account}/100/100`} alt="Rider" referrerPolicy="no-referrer" />
                          </div>
                          <div>
                            <h2 className="text-4xl font-black uppercase tracking-tighter">{trustResult.name}</h2>
                            <p className={`font-bold uppercase tracking-widest text-sm ${trustResult.trustScore === 'none' ? 'text-white/80' : 'text-black/60'}`}>
                              {trustResult.account}
                            </p>
                          </div>
                        </div>
                        {trustResult.trustScore === 'high' ? (
                          <div className="bg-black text-[#00FF00] px-4 py-2 border-2 border-black font-black uppercase italic">Trusted Rider</div>
                        ) : (
                          <div className="bg-white text-black px-4 py-2 border-2 border-black font-black uppercase italic">Unverified</div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <div className="p-4 border-2 border-black bg-white/20">
                          <p className="text-[10px] font-black uppercase mb-1">Drops</p>
                          <p className="text-3xl font-black">{trustResult.drops}</p>
                        </div>
                        <div className="p-4 border-2 border-black bg-white/20">
                          <p className="text-[10px] font-black uppercase mb-1">Vendors</p>
                          <p className="text-3xl font-black">{trustResult.vendors}</p>
                        </div>
                        <div className="p-4 border-2 border-black bg-white/20">
                          <p className="text-[10px] font-black uppercase mb-1">Rating</p>
                          <p className="text-3xl font-black">4.9</p>
                        </div>
                        <div className="p-4 border-2 border-black bg-white/20">
                          <p className="text-[10px] font-black uppercase mb-1">Speed</p>
                          <p className="text-3xl font-black">Fast</p>
                        </div>
                      </div>

                      {trustResult.trustScore === 'high' ? (
                        <div className="flex items-center gap-3 font-bold uppercase text-sm">
                          <ShieldCheck size={24} />
                          <span>Highly Reliable. Recommended for high-value items.</span>
                        </div>
                      ) : trustResult.trustScore === 'none' ? (
                        <div className="flex items-center gap-3 font-bold uppercase text-sm">
                          <ShieldAlert size={24} />
                          <span>Zero History. Instruct rider to drop ID as physical collateral.</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 font-bold uppercase text-sm">
                          <Clock size={24} />
                          <span>Limited History. Exercise caution for items over ₦50k.</span>
                        </div>
                      )}
                    </BrutalistCard>
                  </motion.div>
                )}
              </motion.div>
            )}

            {currentScreen === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                <div className="flex justify-between items-end">
                  <h1 className="text-5xl font-black uppercase tracking-tighter">History</h1>
                  <div className="flex gap-2">
                    <BrutalistButton variant="secondary" className="py-2 px-4 text-xs">Export CSV</BrutalistButton>
                    <BrutalistButton variant="secondary" className="py-2 px-4 text-xs">Filter</BrutalistButton>
                  </div>
                </div>

                <BrutalistCard className="overflow-x-auto p-0">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-black text-white uppercase text-xs tracking-widest">
                        <th className="p-4 text-left border-r border-white/20">Waybill ID</th>
                        <th className="p-4 text-left border-r border-white/20">Customer</th>
                        <th className="p-4 text-left border-r border-white/20">Value</th>
                        <th className="p-4 text-left border-r border-white/20">Rider</th>
                        <th className="p-4 text-left border-r border-white/20">Status</th>
                        <th className="p-4 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody className="font-bold text-sm">
                      {waybills.length > 0 ? waybills.map((wb) => (
                        <tr key={wb.id} className="border-b-2 border-black hover:bg-gray-50">
                          <td className="p-4 border-r-2 border-black">{wb.id}</td>
                          <td className="p-4 border-r-2 border-black uppercase">{wb.customer_name}</td>
                          <td className="p-4 border-r-2 border-black">₦{wb.item_value.toLocaleString()}</td>
                          <td className="p-4 border-r-2 border-black">{wb.rider_name}</td>
                          <td className="p-4 border-r-2 border-black">
                            <StatusBadge status={wb.status} />
                          </td>
                          <td className="p-4">
                            <button className="p-2 border-2 border-black hover:bg-[#00FF00] transition-colors">
                              <ExternalLink size={16} />
                            </button>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-gray-400 uppercase italic">No waybills found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </BrutalistCard>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Floating Action Button (Mobile) */}
      {currentScreen !== 'create' && (
        <button 
          onClick={() => setCurrentScreen('create')}
          className="lg:hidden fixed bottom-8 right-8 w-16 h-16 bg-[#00FF00] border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center active:translate-x-[2px] active:translate-y-[2px] active:shadow-none z-50"
        >
          <Plus size={32} strokeWidth={3} />
        </button>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <FareEaseApp />
    </ErrorBoundary>
  );
}
