import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, User, ShoppingBag, Heart, MessageSquare, LogOut, Package, 
  MapPin, Store, ShieldCheck, ChevronRight, RefreshCw, 
  Trash2, ExternalLink, CheckCircle2, Clock,
  Send, Truck, Check
} from 'lucide-react';
import { getOrders, getEnquiries, getProducts, logoutUser, replyToEnquiry, updateOrderStatus } from '../api/index.js';
import { getSavedProductIds, removeSavedProductId } from '../services/offlineSync';
import { useNotification } from '../context/NotificationContext';

const TRACKING_STEPS = [
  { key: 'CONFIRMED', label: 'Confirmed', labelTe: 'ఖరారైంది' },
  { key: 'PROCESSING', label: 'Packed', labelTe: 'ప్యాక్ అయింది' },
  { key: 'SHIPPED', label: 'In Transit', labelTe: 'రవాణాలో ఉంది' },
  { key: 'DELIVERED', label: 'Delivered', labelTe: 'చేరింది' }
];

const getStepIndex = (status) => {
  switch ((status || '').toUpperCase()) {
    case 'CONFIRMED': return 0;
    case 'PROCESSING': return 1;
    case 'SHIPPED': return 2;
    case 'DELIVERED': return 3;
    default: return -1;
  }
};

export default function AccountPortal({ user, onClose, onAuthChange, onNavigateMode }) {
  const notify = useNotification();
  const [activeTab, setActiveTab] = useState('ORDERS'); // 'ORDERS' | 'WISHLIST' | 'ENQUIRIES' | 'PROFILE'
  const [orderSubTab, setOrderSubTab] = useState('PURCHASES'); // 'PURCHASES' | 'SALES'
  const [enquirySubTab, setEnquirySubTab] = useState('SENT'); // 'SENT' | 'RECEIVED'
  const [buyerOrders, setBuyerOrders] = useState([]);
  const [sellerOrders, setSellerOrders] = useState([]);
  const [buyerEnquiries, setBuyerEnquiries] = useState([]);
  const [sellerEnquiries, setSellerEnquiries] = useState([]);
  const [wishlistProducts, setWishlistProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [replyTexts, setReplyTexts] = useState({});
  const [editingReply, setEditingReply] = useState({});
  const [replyingEnquiryId, setReplyingEnquiryId] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  const isArtisan = user?.role === 'ARTISAN';

  const loadAccountData = useCallback(async () => {
    setLoading(true);
    try {
      if (isArtisan) {
        const [myPurchases, mySales, mySentEnqs, myRecvEnqs, allProds] = await Promise.all([
          getOrders('buyer'),
          getOrders('seller'),
          getEnquiries('buyer'),
          getEnquiries('seller'),
          getProducts()
        ]);
        setBuyerOrders(myPurchases || []);
        setSellerOrders(mySales || []);
        setBuyerEnquiries(mySentEnqs || []);
        setSellerEnquiries(myRecvEnqs || []);

        const savedIds = getSavedProductIds(user?.id);
        const favs = (allProds || []).filter(p => savedIds.includes(p.id));
        setWishlistProducts(favs);
      } else {
        const [myPurchases, mySentEnqs, allProds] = await Promise.all([
          getOrders('buyer'),
          getEnquiries('buyer'),
          getProducts()
        ]);
        setBuyerOrders(myPurchases || []);
        setSellerOrders([]);
        setBuyerEnquiries(mySentEnqs || []);
        setSellerEnquiries([]);

        const savedIds = getSavedProductIds(user?.id);
        const favs = (allProds || []).filter(p => savedIds.includes(p.id));
        setWishlistProducts(favs);
      }
    } catch (err) {
      console.error('Failed to load account details:', err);
    } finally {
      setLoading(false);
    }
  }, [isArtisan, user?.id]);

  useEffect(() => {
    loadAccountData();
    const interval = setInterval(loadAccountData, 5000);
    return () => clearInterval(interval);
  }, [loadAccountData]);

  const handleRemoveWishlist = (productId) => {
    removeSavedProductId(user?.id, productId);
    setWishlistProducts(prev => prev.filter(p => p.id !== productId));
  };

  const handleLogout = () => {
    logoutUser();
    onAuthChange(null);
    onClose();
  };

  const handleSendReply = async (enquiryId) => {
    const text = replyTexts[enquiryId];
    if (!text || !text.trim()) return;
    setReplyingEnquiryId(enquiryId);
    try {
      const updatedEnq = await replyToEnquiry(enquiryId, text.trim());
      setSellerEnquiries(prev => prev.map(e => e.id === enquiryId ? updatedEnq : e));
      setBuyerEnquiries(prev => prev.map(e => e.id === enquiryId ? updatedEnq : e));
      setEditingReply(prev => ({ ...prev, [enquiryId]: false }));
      notify.success('Reply sent successfully');
    } catch (err) {
      notify.error('Failed to send reply: ' + (err.message || 'Error occurred'));
    } finally {
      setReplyingEnquiryId(null);
    }
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    setUpdatingOrderId(orderId);
    try {
      const updatedOrd = await updateOrderStatus(orderId, newStatus);
      setSellerOrders(prev => prev.map(o => o.id === orderId ? updatedOrd : o));
      setBuyerOrders(prev => prev.map(o => o.id === orderId ? updatedOrd : o));
      notify.success(`Order status updated to ${newStatus}`);
    } catch (err) {
      notify.error('Failed to update status: ' + (err.message || 'Error occurred'));
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-150">
        {/* Account Header */}
        <div className="bg-gradient-to-r from-amber-700 via-orange-600 to-amber-600 p-5 text-white">
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-xl font-black text-white shadow-inner shrink-0">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-base sm:text-lg text-white truncate">{user?.name}</h3>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-900/40 text-amber-200 border border-amber-300/40">
                    {user?.role || 'BUYER'}
                  </span>
                </div>
                <p className="text-xs text-amber-100 truncate">{user?.email || user?.phone || 'Authentic User'}</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-1.5 text-amber-200 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              title="Close Account"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Navigation Menu */}
          <div className="mt-5 grid grid-cols-4 gap-1 bg-black/20 p-1 rounded-2xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab('ORDERS')}
              className={`py-2 px-1 rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center sm:space-x-1.5 cursor-pointer ${
                activeTab === 'ORDERS' 
                  ? 'bg-white text-slate-900 shadow-md font-bold' 
                  : 'text-amber-100 hover:text-white hover:bg-white/10'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[11px] sm:text-xs truncate">My Orders</span>
              {(buyerOrders.length > 0 || (isArtisan && sellerOrders.length > 0)) && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1 ${
                  activeTab === 'ORDERS' ? 'bg-amber-100 text-amber-900' : 'bg-white/20 text-white'
                }`}>
                  {buyerOrders.length + (isArtisan ? sellerOrders.length : 0)}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('WISHLIST')}
              className={`py-2 px-1 rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center sm:space-x-1.5 cursor-pointer ${
                activeTab === 'WISHLIST' 
                  ? 'bg-white text-slate-900 shadow-md font-bold' 
                  : 'text-amber-100 hover:text-white hover:bg-white/10'
              }`}
            >
              <Heart className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[11px] sm:text-xs truncate">Wishlist</span>
              {wishlistProducts.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1 ${
                  activeTab === 'WISHLIST' ? 'bg-rose-100 text-rose-900' : 'bg-white/20 text-white'
                }`}>
                  {wishlistProducts.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('ENQUIRIES')}
              className={`py-2 px-1 rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center sm:space-x-1.5 cursor-pointer ${
                activeTab === 'ENQUIRIES' 
                  ? 'bg-white text-slate-900 shadow-md font-bold' 
                  : 'text-amber-100 hover:text-white hover:bg-white/10'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[11px] sm:text-xs truncate">Enquiries</span>
              {(buyerEnquiries.length > 0 || (isArtisan && sellerEnquiries.length > 0)) && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1 ${
                  activeTab === 'ENQUIRIES' ? 'bg-amber-100 text-amber-900' : 'bg-white/20 text-white'
                }`}>
                  {buyerEnquiries.length + (isArtisan ? sellerEnquiries.length : 0)}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('PROFILE')}
              className={`py-2 px-1 rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center sm:space-x-1.5 cursor-pointer ${
                activeTab === 'PROFILE' 
                  ? 'bg-white text-slate-900 shadow-md font-bold' 
                  : 'text-amber-100 hover:text-white hover:bg-white/10'
              }`}
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[11px] sm:text-xs truncate">Profile</span>
            </button>
          </div>
        </div>

        {/* Tab Contents */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-600" />
              <span className="text-xs">Loading account data...</span>
            </div>
          ) : (
            <>
              {/* TAB 1: ORDERS (DISTINGUISHED BUYER PURCHASES VS SELLER SALES) */}
              {activeTab === 'ORDERS' && (
                <div className="space-y-3">
                  {/* Artisan Sub-Tabs if user is a seller */}
                  {isArtisan && (
                    <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setOrderSubTab('PURCHASES')}
                        className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                          orderSubTab === 'PURCHASES'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        <ShoppingBag className="w-3.5 h-3.5 text-indigo-600" />
                        <span>My Purchases (నేను కొన్నవి)</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-50 text-indigo-800 font-extrabold">
                          {buyerOrders.length}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setOrderSubTab('SALES')}
                        className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                          orderSubTab === 'SALES'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        <Store className="w-3.5 h-3.5 text-amber-600" />
                        <span>Studio Sales (వచ్చిన ఆర్డర్లు)</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-900 font-extrabold">
                          {sellerOrders.length}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Header Title */}
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">
                        {!isArtisan || orderSubTab === 'PURCHASES' 
                          ? 'Your Craft Purchases (మీరు కొనుగోలు చేసినవి)' 
                          : 'Customer Orders for Your Crafts (మీకు వచ్చిన ఆర్డర్లు)'}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {!isArtisan || orderSubTab === 'PURCHASES'
                          ? 'Track authentic handmade creations ordered from master artisans'
                          : 'Orders placed by marketplace buyers for your handcrafted creations'}
                      </p>
                    </div>
                    <button 
                      onClick={loadAccountData} 
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                      title="Refresh Orders"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Order Cards List */}
                  {(!isArtisan || orderSubTab === 'PURCHASES') ? (
                    buyerOrders.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                        <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700">
                          <ShoppingBag className="w-6 h-6" />
                        </div>
                        <div>
                          <h5 className="font-bold text-slate-800 text-sm">No Purchases Yet (ఇంకా ఏమీ కొనలేదు)</h5>
                          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                            Support rural master artisans by ordering authentic handmade crafts directly from the marketplace.
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            onClose();
                            onNavigateMode?.('BUY');
                          }}
                          className="mt-2 inline-flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl text-xs font-bold shadow-md hover:from-amber-500 hover:to-orange-500 transition-all cursor-pointer"
                        >
                          <span>Explore Marketplace</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {buyerOrders.map((ord) => {
                          const currentIdx = getStepIndex(ord.status);
                          return (
                            <div key={ord.id} className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition-all space-y-2">
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex items-center space-x-3">
                                  {ord.product_image ? (
                                    <img src={ord.product_image} alt={ord.product_title} className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0" />
                                  ) : (
                                    <div className="w-12 h-12 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-800 font-bold shrink-0">
                                      <Package className="w-6 h-6 text-amber-700" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <h5 className="font-bold text-xs sm:text-sm text-slate-900 truncate">{ord.product_title}</h5>
                                    <p className="text-[11px] text-slate-500">
                                      Order #{ord.id} • {ord.quantity} unit(s) • ₹{ord.unit_price} / unit
                                    </p>
                                    {ord.seller_name && (
                                      <p className="text-[10px] font-semibold text-amber-800">
                                        Master Artisan: {ord.seller_name}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="font-extrabold text-xs sm:text-sm text-slate-900 block">
                                    ₹{ord.total_price.toLocaleString('en-IN')}
                                  </span>
                                  <span className={`inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full border mt-0.5 ${
                                    ord.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                                    ord.status === 'SHIPPED' ? 'bg-indigo-100 text-indigo-800 border-indigo-300' :
                                    ord.status === 'PROCESSING' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                                    'bg-slate-200 text-slate-800 border-slate-300'
                                  }`}>
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>{ord.status}</span>
                                  </span>
                                </div>
                              </div>

                              {/* Delivery Address */}
                              {ord.delivery_address && (
                                <div className="pt-1 text-[11px] text-slate-600 flex items-start space-x-1 bg-white p-2 rounded-xl border border-slate-100">
                                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                  <span className="truncate">Shipping to: {ord.delivery_address}</span>
                                </div>
                              )}

                              {/* Flipkart-Style Visual Delivery Progress Bar */}
                              <div className="w-full mt-2 p-2 bg-white rounded-xl border border-slate-200">
                                <div className="flex items-center justify-between relative">
                                  {TRACKING_STEPS.map((step, idx) => {
                                    const isDone = currentIdx > idx || ord.status === 'DELIVERED';
                                    const isCurrent = currentIdx === idx;
                                    return (
                                      <div key={step.key} className="flex-1 flex flex-col items-center relative z-10">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                                          isDone 
                                            ? 'bg-emerald-600 text-white' 
                                            : isCurrent 
                                              ? 'bg-amber-500 text-white ring-3 ring-amber-100 animate-pulse' 
                                              : 'bg-slate-200 text-slate-500'
                                        }`}>
                                          {isDone ? <Check className="w-3.5 h-3.5" /> : (idx + 1)}
                                        </div>
                                        <span className={`text-[10px] font-bold mt-1 text-center ${
                                          isCurrent ? 'text-amber-700 font-extrabold' : isDone ? 'text-emerald-700' : 'text-slate-400'
                                        }`}>
                                          {step.label}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : (
                    sellerOrders.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                        <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700">
                          <Store className="w-6 h-6" />
                        </div>
                        <div>
                          <h5 className="font-bold text-slate-800 text-sm">No Customer Orders Yet</h5>
                          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                            When buyers purchase crafts from your studio catalog, incoming fulfillment orders will appear here.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {sellerOrders.map((ord) => {
                          const currentIdx = getStepIndex(ord.status);
                          return (
                            <div key={ord.id} className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition-all space-y-2">
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex items-center space-x-3">
                                  {ord.product_image ? (
                                    <img src={ord.product_image} alt={ord.product_title} className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0" />
                                  ) : (
                                    <div className="w-12 h-12 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-800 font-bold shrink-0">
                                      <Package className="w-6 h-6 text-amber-700" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <h5 className="font-bold text-xs sm:text-sm text-slate-900 truncate">{ord.product_title}</h5>
                                    <p className="text-[11px] text-slate-500">
                                      Buyer: <strong>{ord.buyer_name}</strong> {ord.buyer_phone ? `(${ord.buyer_phone})` : ''}
                                    </p>
                                    <p className="text-[10px] text-slate-500">
                                      Quantity: {ord.quantity} unit(s) • ₹{ord.unit_price} each
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="font-extrabold text-xs sm:text-sm text-emerald-800 block">
                                    + ₹{ord.total_price.toLocaleString('en-IN')}
                                  </span>
                                  <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200 mt-0.5">
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    <span>{ord.status}</span>
                                  </span>
                                </div>
                              </div>

                              {ord.delivery_address && (
                                <div className="pt-1 text-[11px] text-slate-600 flex items-start space-x-1 bg-white p-2 rounded-xl border border-slate-100">
                                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                  <span className="truncate">Deliver to: {ord.delivery_address}</span>
                                </div>
                              )}

                              {/* Flipkart-Style Delivery Tracker & Controls */}
                              <div className="w-full mt-2 p-2 bg-white rounded-xl border border-slate-200">
                                <div className="flex items-center justify-between relative">
                                  {TRACKING_STEPS.map((step, idx) => {
                                    const isDone = currentIdx > idx || ord.status === 'DELIVERED';
                                    const isCurrent = currentIdx === idx;
                                    return (
                                      <div key={step.key} className="flex-1 flex flex-col items-center relative z-10">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                                          isDone 
                                            ? 'bg-emerald-600 text-white' 
                                            : isCurrent 
                                              ? 'bg-amber-500 text-white ring-3 ring-amber-100 animate-pulse' 
                                              : 'bg-slate-200 text-slate-500'
                                        }`}>
                                          {isDone ? <Check className="w-3.5 h-3.5" /> : (idx + 1)}
                                        </div>
                                        <span className={`text-[10px] font-bold mt-1 text-center ${
                                          isCurrent ? 'text-amber-700 font-extrabold' : isDone ? 'text-emerald-700' : 'text-slate-400'
                                        }`}>
                                          {step.label}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>

                                <div className="mt-2.5 pt-2 border-t border-slate-100 flex justify-end">
                                  {ord.status === 'CONFIRMED' && (
                                    <button
                                      onClick={() => handleUpdateOrderStatus(ord.id, 'PROCESSING')}
                                      disabled={updatingOrderId === ord.id}
                                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-[11px] rounded-lg shadow-2xs transition-all flex items-center space-x-1 cursor-pointer"
                                    >
                                      <Package className="w-3 h-3" />
                                      <span>Mark as Packed 📦</span>
                                    </button>
                                  )}
                                  {ord.status === 'PROCESSING' && (
                                    <button
                                      onClick={() => handleUpdateOrderStatus(ord.id, 'SHIPPED')}
                                      disabled={updatingOrderId === ord.id}
                                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-[11px] rounded-lg shadow-2xs transition-all flex items-center space-x-1 cursor-pointer"
                                    >
                                      <Truck className="w-3 h-3" />
                                      <span>Dispatch & Ship 🚚</span>
                                    </button>
                                  )}
                                  {ord.status === 'SHIPPED' && (
                                    <button
                                      onClick={() => handleUpdateOrderStatus(ord.id, 'DELIVERED')}
                                      disabled={updatingOrderId === ord.id}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-[11px] rounded-lg shadow-2xs transition-all flex items-center space-x-1 cursor-pointer"
                                    >
                                      <Check className="w-3 h-3" />
                                      <span>Mark Delivered ✅</span>
                                    </button>
                                  )}
                                  {ord.status === 'DELIVERED' && (
                                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                                      Completed ✅
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}
                </div>
              )}

              {/* TAB 2: WISHLIST */}
              {activeTab === 'WISHLIST' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">Your Saved Wishlist (విష్‌లిస్ట్)</h4>
                      <p className="text-[11px] text-slate-500">Handcrafted pieces you have saved for later</p>
                    </div>
                    <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                      {wishlistProducts.length} saved
                    </span>
                  </div>

                  {wishlistProducts.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                      <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600">
                        <Heart className="w-6 h-6" />
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-800 text-sm">Wishlist is Empty (విష్‌లిస్ట్ ఖాళీగా ఉంది)</h5>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                          Tap the heart icon on any craft while exploring the marketplace to save your favorites here.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          onClose();
                          onNavigateMode?.('BUY');
                        }}
                        className="mt-2 inline-flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl text-xs font-bold shadow-md hover:from-amber-500 hover:to-orange-500 transition-all cursor-pointer"
                      >
                        <span>Browse Marketplace</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {wishlistProducts.map((prod) => (
                        <div key={prod.id} className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition-all flex items-center justify-between gap-3">
                          <div className="flex items-center space-x-3 min-w-0">
                            <img src={prod.image_url} alt={prod.title} className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0" />
                            <div className="min-w-0">
                              <h5 className="font-bold text-xs sm:text-sm text-slate-900 truncate">{prod.title}</h5>
                              <p className="text-[11px] text-slate-500">{prod.category} • ₹{prod.price}</p>
                              <span className={`text-[10px] font-bold ${prod.stock > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                                {prod.stock > 0 ? `${prod.stock} in stock` : 'Out of Stock'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            <button
                              onClick={() => {
                                onClose();
                                onNavigateMode?.('BUY');
                              }}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                            >
                              View Craft
                            </button>
                            <button
                              onClick={() => handleRemoveWishlist(prod.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Remove from wishlist"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: MY ENQUIRIES */}
              {activeTab === 'ENQUIRIES' && (
                <div className="space-y-3">
                  {/* Artisan Sub-Tabs if user is a seller */}
                  {isArtisan && (
                    <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setEnquirySubTab('SENT')}
                        className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                          enquirySubTab === 'SENT'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                        <span>My Sent Enquiries (నేను పంపినవి)</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-50 text-indigo-800 font-extrabold">
                          {buyerEnquiries.length}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEnquirySubTab('RECEIVED')}
                        className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                          enquirySubTab === 'RECEIVED'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        <Store className="w-3.5 h-3.5 text-amber-600" />
                        <span>Received Leads (వచ్చిన విచారణలు)</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-900 font-extrabold">
                          {sellerEnquiries.length}
                        </span>
                      </button>
                    </div>
                  )}

                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">
                        {!isArtisan || enquirySubTab === 'SENT' 
                          ? 'Wholesale / Custom Enquiries Sent (మీరు పంపినవి)' 
                          : 'Inquiries Received From Buyers (కస్టమర్ విచారణలు)'}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {!isArtisan || enquirySubTab === 'SENT'
                          ? 'Custom bulk requests and pre-orders you sent to artisans'
                          : 'Wholesale requests received for your studio crafts'}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                      {(!isArtisan || enquirySubTab === 'SENT') ? buyerEnquiries.length : sellerEnquiries.length} leads
                    </span>
                  </div>

                  {(!isArtisan || enquirySubTab === 'SENT') ? (
                    buyerEnquiries.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                        <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                          <MessageSquare className="w-6 h-6" />
                        </div>
                        <div>
                          <h5 className="font-bold text-slate-800 text-sm">No Enquiries Sent Yet</h5>
                          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                            Need custom sizes, bespoke craftsmanship, or wholesale lots? Submit enquiries directly to master artisans.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {buyerEnquiries.map((enq) => (
                          <div key={enq.id} className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition-all space-y-2">
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <h5 className="font-bold text-xs sm:text-sm text-slate-900">{enq.product_title || `Craft #${enq.product_id}`}</h5>
                                <p className="text-[11px] text-slate-500">
                                  Quantity: <strong>{enq.quantity} units requested</strong>
                                  {enq.seller_name && ` • Artisan: ${enq.seller_name}`}
                                </p>
                              </div>
                              <span className="text-[10px] font-bold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200 shrink-0">
                                Sent to Artisan
                              </span>
                            </div>

                            {enq.message && (
                              <p className="text-xs text-slate-700 italic bg-white p-2.5 rounded-xl border border-slate-200/60 leading-relaxed">
                                "{enq.message}"
                              </p>
                            )}

                            {/* Artisan Response Display */}
                            {enq.artisan_reply ? (
                              <div className="p-2.5 bg-indigo-50/90 border border-indigo-200 rounded-xl">
                                <span className="text-[11px] font-bold text-indigo-900 flex items-center">
                                  <MessageSquare className="w-3.5 h-3.5 text-indigo-600 inline mr-1" />
                                  Artisan Response / కళాకారుడి స్పందన:
                                </span>
                                <p className="text-xs text-indigo-950 font-semibold mt-0.5">"{enq.artisan_reply}"</p>
                                {enq.replied_at && (
                                  <p className="text-[10px] text-indigo-500 mt-0.5">
                                    Replied: {new Date(enq.replied_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="p-2 bg-amber-50/80 border border-amber-200 rounded-xl">
                                <p className="text-[11px] text-amber-800 font-medium flex items-center space-x-1">
                                  <Clock className="w-3 h-3 text-amber-600 inline mr-1" />
                                  <span>Awaiting Artisan Response / కళాకారుడి సమాధానం కోసం వేచి ఉంది</span>
                                </p>
                              </div>
                            )}

                            <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                              <span>Contact: {enq.buyer_phone}</span>
                              {enq.created_at && (
                                <span>{new Date(enq.created_at).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    sellerEnquiries.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                        <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700">
                          <Store className="w-6 h-6" />
                        </div>
                        <div>
                          <h5 className="font-bold text-slate-800 text-sm">No Buyer Enquiries Yet</h5>
                          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                            Customer wholesale leads and bulk enquiries for your crafts will appear here.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {sellerEnquiries.map((enq) => (
                          <div key={enq.id} className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition-all space-y-2">
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <h5 className="font-bold text-xs sm:text-sm text-slate-900">{enq.product_title || `Craft #${enq.product_id}`}</h5>
                                <p className="text-[11px] text-slate-500">
                                  Buyer: <strong>{enq.buyer_name}</strong> • Phone: {enq.buyer_phone}
                                </p>
                                <p className="text-[10px] text-amber-800 font-bold">
                                  Bulk Request: {enq.quantity} units
                                </p>
                              </div>
                              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200 shrink-0">
                                Customer Lead
                              </span>
                            </div>

                            {enq.message && (
                              <p className="text-xs text-slate-700 italic bg-white p-2.5 rounded-xl border border-slate-200/60 leading-relaxed">
                                "{enq.message}"
                              </p>
                            )}

                            {/* Reply Input for Artisan */}
                            {enq.artisan_reply && !editingReply[enq.id] ? (
                              <div className="p-2.5 bg-indigo-50/90 border border-indigo-200 rounded-xl">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-indigo-900 flex items-center">
                                    <MessageSquare className="w-3 h-3 text-indigo-600 inline mr-1" />
                                    Your Response / మీ స్పందన:
                                  </span>
                                  <button 
                                    onClick={() => setEditingReply(prev => ({ ...prev, [enq.id]: true }))}
                                    className="text-[10px] font-bold text-indigo-700 hover:underline cursor-pointer"
                                  >
                                    Edit Response
                                  </button>
                                </div>
                                <p className="text-xs text-indigo-950 font-medium mt-0.5">"{enq.artisan_reply}"</p>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2 pt-1">
                                <input
                                  type="text"
                                  placeholder="Type response to buyer (e.g. Yes, ready in 10 days / ధర వివరాలు)..."
                                  value={replyTexts[enq.id] !== undefined ? replyTexts[enq.id] : (enq.artisan_reply || '')}
                                  onChange={(e) => setReplyTexts(prev => ({ ...prev, [enq.id]: e.target.value }))}
                                  className="flex-1 px-3 py-1 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 bg-white"
                                />
                                <button
                                  onClick={() => handleSendReply(enq.id)}
                                  disabled={replyingEnquiryId === enq.id || !(replyTexts[enq.id] !== undefined ? replyTexts[enq.id] : (enq.artisan_reply || '')).trim()}
                                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center space-x-1 shrink-0"
                                >
                                  <Send className="w-3 h-3" />
                                  <span>{replyingEnquiryId === enq.id ? 'Sending...' : 'Reply'}</span>
                                </button>
                              </div>
                            )}

                            <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                              <span>Phone: {enq.buyer_phone}</span>
                              {enq.created_at && (
                                <span>{new Date(enq.created_at).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>
              )}

              {/* TAB 4: PROFILE */}
              {activeTab === 'PROFILE' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] uppercase font-bold text-amber-800 tracking-wider">Account Role</span>
                      <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                        {isArtisan ? 'Master Artisan (చేతివృత్తిదారుడు)' : 'Verified Buyer (కొనుగోలుదారు)'}
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {isArtisan 
                          ? 'Creator permissions enabled: AI Studio, Pricing Engine, and Inventory Management.' 
                          : 'Buyer permissions enabled: Direct Checkout, B2B Enquiries, and Wishlist tracking.'}
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-amber-200 flex items-center justify-center text-amber-800 font-bold shrink-0">
                      <ShieldCheck className="w-6 h-6 text-amber-700" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-slate-400 block text-[11px]">Full Name</span>
                      <span className="font-bold text-slate-800">{user?.name}</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-slate-400 block text-[11px]">Email Address</span>
                      <span className="font-bold text-slate-800">{user?.email || 'Not provided'}</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-slate-400 block text-[11px]">Phone Number</span>
                      <span className="font-bold text-slate-800">{user?.phone || 'Not provided'}</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-slate-400 block text-[11px]">Craft / Specialization</span>
                      <span className="font-bold text-slate-800">{user?.craft || 'Handmade Crafts'}</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 sm:col-span-2">
                      <span className="text-slate-400 block text-[11px]">Location / Craft Cluster</span>
                      <span className="font-bold text-slate-800">{user?.location || 'India'}</span>
                    </div>
                  </div>

                  {/* Mode Navigation Shortcuts */}
                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <span className="text-xs font-semibold text-slate-600 block">Workspace Navigation:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {isArtisan && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onNavigateMode?.('SELL');
                          }}
                          className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold text-xs transition-colors cursor-pointer"
                        >
                          <div className="flex items-center space-x-2">
                            <Store className="w-4 h-4 text-amber-700" />
                            <span>Open Artisan Studio</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-amber-600" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onNavigateMode?.('BUY');
                        }}
                        className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 text-indigo-900 font-bold text-xs transition-colors cursor-pointer"
                      >
                        <div className="flex items-center space-x-2">
                          <ShoppingBag className="w-4 h-4 text-indigo-700" />
                          <span>Open Buyer Marketplace</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-indigo-600" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Account Footer with Sign Out */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <span className="text-[11px] text-slate-500">
            Secure Session • Artisan AI Enterprise
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-600" />
            <span>Sign Out (లాగ్ అవుట్)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
