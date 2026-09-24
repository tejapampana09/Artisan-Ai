import React, { useState, useEffect, useCallback } from 'react';
import { 
  MessageSquare, Store, ShoppingBag, Send, RefreshCw, 
  CheckCircle2, Clock, MapPin, Sparkles, User
} from 'lucide-react';
import { getEnquiries, replyToEnquiry } from '../api/index.js';
import { useNotification } from '../context/NotificationContext';

export default function EnquiriesView({ user, onSelectMode, onOpenAuth }) {
  const notify = useNotification();
  const [enquirySubTab, setEnquirySubTab] = useState('SENT'); // 'SENT' | 'RECEIVED'
  const [buyerEnquiries, setBuyerEnquiries] = useState([]);
  const [sellerEnquiries, setSellerEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyTexts, setReplyTexts] = useState({});
  const [replyingEnquiryId, setReplyingEnquiryId] = useState(null);

  const isArtisan = user?.role === 'ARTISAN';

  const loadEnquiries = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      if (isArtisan) {
        const [mySentEnqs, myRecvEnqs] = await Promise.all([
          getEnquiries('buyer'),
          getEnquiries('seller')
        ]);
        setBuyerEnquiries(mySentEnqs || []);
        setSellerEnquiries(myRecvEnqs || []);
      } else {
        const mySentEnqs = await getEnquiries('buyer');
        setBuyerEnquiries(mySentEnqs || []);
        setSellerEnquiries([]);
      }
    } catch (err) {
      console.error('Failed to load enquiries:', err);
    } finally {
      setLoading(false);
    }
  }, [isArtisan]);

  useEffect(() => {
    loadEnquiries(true);
    const interval = setInterval(() => loadEnquiries(false), 20000);
    return () => clearInterval(interval);
  }, [loadEnquiries]);

  const handleSendReply = async (enquiryId) => {
    const text = replyTexts[enquiryId];
    if (!text || !text.trim()) return;
    setReplyingEnquiryId(enquiryId);
    try {
      const updatedEnq = await replyToEnquiry(enquiryId, text.trim());
      setSellerEnquiries(prev => prev.map(e => e.id === enquiryId ? updatedEnq : e));
      setBuyerEnquiries(prev => prev.map(e => e.id === enquiryId ? updatedEnq : e));
      setReplyTexts(prev => ({ ...prev, [enquiryId]: '' }));
      notify.success('Reply sent successfully to buyer');
    } catch (err) {
      notify.error('Failed to send reply: ' + (err.message || 'Error occurred'));
    } finally {
      setReplyingEnquiryId(null);
    }
  };

  const currentList = enquirySubTab === 'SENT' ? buyerEnquiries : sellerEnquiries;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 font-sans">
      {/* Editorial Header */}
      <div className="bg-[#FAF7F2] border border-[#E8E2D9] rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xs">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-[#8C3F2B]/10 text-[#8C3F2B] text-[10px] font-bold tracking-wider uppercase">
            <span>💬 Custom Pre-Orders & Leads</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#1C1C1C] tracking-tight">
            Artisan Enquiries & Custom Leads
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 font-medium leading-relaxed">
            Direct communications between buyers and master craftspeople for bulk orders and custom handloom requests.
          </p>
        </div>
        <button
          onClick={() => loadEnquiries(true)}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white border border-[#E8E2D9] text-xs font-bold text-[#1C1C1C] hover:border-[#A6533B] hover:text-[#A6533B] transition-all cursor-pointer shadow-2xs shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#A6533B]' : ''}`} />
          <span>Refresh Enquiries</span>
        </button>
      </div>

      {/* Seller vs Buyer Sub Tabs */}
      {isArtisan && (
        <div className="flex bg-white p-1 rounded-xl border border-[#E8E2D9] w-fit shadow-2xs">
          <button
            onClick={() => setEnquirySubTab('SENT')}
            className={`px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              enquirySubTab === 'SENT'
                ? 'bg-[#1C1C1C] text-white shadow-xs'
                : 'text-[#6B6B6B] hover:text-[#1C1C1C] hover:bg-[#FAF7F2]'
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-[#A6533B]" />
            <span>Sent Custom Requests ({buyerEnquiries.length})</span>
          </button>
          <button
            onClick={() => setEnquirySubTab('RECEIVED')}
            className={`px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              enquirySubTab === 'RECEIVED'
                ? 'bg-[#A6533B] text-white shadow-xs'
                : 'text-[#6B6B6B] hover:text-[#1C1C1C] hover:bg-[#FAF7F2]'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Received Studio Leads ({sellerEnquiries.length})</span>
          </button>
        </div>
      )}

      {/* Enquiries List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white p-12 rounded-2xl border border-[#E8E2D9] text-center space-y-3 shadow-2xs">
            <div className="w-8 h-8 border-3 border-[#A6533B] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-stone-600 font-medium">Loading enquiries & bulk leads...</p>
          </div>
        ) : currentList.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-dashed border-[#E8E2D9] text-center space-y-4 shadow-2xs">
            <div className="w-14 h-14 bg-amber-50 text-[#A6533B] rounded-2xl border border-amber-200/60 flex items-center justify-center mx-auto">
              <MessageSquare className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#1C1C1C]">
                {enquirySubTab === 'SENT' ? 'No Custom Enquiries Sent' : 'No Buyer Leads Received'}
              </h3>
              <p className="text-xs text-stone-600 max-w-sm mx-auto">
                {enquirySubTab === 'SENT' 
                  ? 'Send custom pre-order or wholesale bulk requests directly to master artisans from product modal cards.' 
                  : 'Buyer enquiries for bulk orders or custom dimensions will appear here.'}
              </p>
            </div>
          </div>
        ) : (
          currentList.map((enq) => (
            <div key={enq.id} className="bg-white rounded-2xl border border-[#E8E2D9] p-6 space-y-4 shadow-2xs hover:border-[#A6533B]/60 transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E8E2D9] pb-3 gap-2">
                <div>
                  <h4 className="font-bold text-sm text-[#1C1C1C]">{enq.product_title || 'Custom Pre-Order Lead'}</h4>
                  <p className="text-xs text-[#6B6B6B]">
                    {enq.buyer_name ? `From: ${enq.buyer_name}` : 'Wholesale Buyer'} • {enq.created_at ? new Date(enq.created_at).toLocaleDateString('en-IN') : 'Recent'}
                  </p>
                </div>
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded w-fit ${
                  enq.status === 'REPLIED' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50/80 text-[#A6533B] border border-[#E8E2D9]'
                }`}>
                  {enq.status || 'PENDING'}
                </span>
              </div>

              <div className="bg-[#FAF7F2] p-4 rounded-xl border border-[#E8E2D9] space-y-2">
                <p className="text-xs text-[#1C1C1C] leading-relaxed">"{enq.message}"</p>
                {enq.reply && (
                  <div className="mt-3 pt-3 border-t border-[#E8E2D9] space-y-1">
                    <span className="text-[10px] font-bold text-[#A6533B] uppercase block">Artisan Reply:</span>
                    <p className="text-xs text-[#1C1C1C] italic">"{enq.reply}"</p>
                  </div>
                )}
              </div>

              {/* Reply Form for Artisans */}
              {isArtisan && enquirySubTab === 'RECEIVED' && (
                <div className="space-y-2 pt-2">
                  <textarea
                    rows={2}
                    value={replyTexts[enq.id] || ''}
                    onChange={(e) => setReplyTexts({ ...replyTexts, [enq.id]: e.target.value })}
                    placeholder="Type custom price quote or response for buyer..."
                    className="w-full p-3 rounded-xl border border-[#E8E2D9] text-xs focus:outline-none focus:border-[#A6533B] bg-white"
                  />
                  <button
                    disabled={replyingEnquiryId === enq.id}
                    onClick={() => handleSendReply(enq.id)}
                    className="px-4 py-2 bg-[#A6533B] hover:bg-[#88412F] text-white text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer ml-auto shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Reply Quote</span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
