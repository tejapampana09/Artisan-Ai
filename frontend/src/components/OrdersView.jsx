import React, { useState, useEffect, useCallback } from 'react';
import { 
  Package, ShoppingBag, Store, CheckCircle2, Clock, Truck, RefreshCw, 
  ExternalLink, ChevronRight, AlertCircle, MapPin
} from 'lucide-react';
import { getOrders, updateOrderStatus } from '../api/index.js';
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

export default function OrdersView({ user, onSelectMode, onOpenAuth }) {
  const notify = useNotification();
  const [orderSubTab, setOrderSubTab] = useState('PURCHASES'); // 'PURCHASES' | 'SALES'
  const [buyerOrders, setBuyerOrders] = useState([]);
  const [sellerOrders, setSellerOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  const isArtisan = user?.role === 'ARTISAN';

  const loadOrders = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      if (isArtisan) {
        const [myPurchases, mySales] = await Promise.all([
          getOrders('buyer'),
          getOrders('seller')
        ]);
        setBuyerOrders(myPurchases || []);
        setSellerOrders(mySales || []);
      } else {
        const myPurchases = await getOrders('buyer');
        setBuyerOrders(myPurchases || []);
        setSellerOrders([]);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  }, [isArtisan]);

  useEffect(() => {
    loadOrders(true);
    const interval = setInterval(() => loadOrders(false), 20000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    setUpdatingOrderId(orderId);
    try {
      const updatedOrd = await updateOrderStatus(orderId, newStatus);
      setSellerOrders(prev => prev.map(o => o.id === orderId ? updatedOrd : o));
      setBuyerOrders(prev => prev.map(o => o.id === orderId ? updatedOrd : o));
      window.dispatchEvent(new CustomEvent('artisan_notification_refresh'));
      notify.success(`Order status updated to ${newStatus}`);
    } catch (err) {
      notify.error('Failed to update status: ' + (err.message || 'Error occurred'));
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const currentList = orderSubTab === 'PURCHASES' ? buyerOrders : sellerOrders;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 font-sans">
      {/* Editorial Header */}
      <div className="bg-[#FAF7F2] border border-[#E8E2D9] rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xs">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-[#8C3F2B]/10 text-[#8C3F2B] text-[10px] font-bold tracking-wider uppercase">
            <span>📦 Orders & Logistics</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#1C1C1C] tracking-tight">
            Order Management & Live Tracking
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 font-medium leading-relaxed">
            Track direct fair-trade craft orders with real-time status updates and logistics confirmation.
          </p>
        </div>
        <button
          onClick={() => loadOrders(true)}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white border border-[#E8E2D9] text-xs font-bold text-[#1C1C1C] hover:border-[#A6533B] hover:text-[#A6533B] transition-all cursor-pointer shadow-2xs shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#A6533B]' : ''}`} />
          <span>Refresh Live Status</span>
        </button>
      </div>

      {/* Seller vs Buyer Toggle Tabs (for Artisans) */}
      {isArtisan && (
        <div className="flex bg-white p-1 rounded-xl border border-[#E8E2D9] w-fit shadow-2xs">
          <button
            onClick={() => setOrderSubTab('PURCHASES')}
            className={`px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              orderSubTab === 'PURCHASES'
                ? 'bg-[#1C1C1C] text-white shadow-xs'
                : 'text-[#6B6B6B] hover:text-[#1C1C1C] hover:bg-[#FAF7F2]'
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-[#A6533B]" />
            <span>My Craft Purchases ({buyerOrders.length})</span>
          </button>
          <button
            onClick={() => setOrderSubTab('SALES')}
            className={`px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              orderSubTab === 'SALES'
                ? 'bg-[#A6533B] text-white shadow-xs'
                : 'text-[#6B6B6B] hover:text-[#1C1C1C] hover:bg-[#FAF7F2]'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Studio Sales ({sellerOrders.length})</span>
          </button>
        </div>
      )}

      {/* Orders List Container */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white p-12 rounded-2xl border border-[#E8E2D9] text-center space-y-3 shadow-2xs">
            <div className="w-8 h-8 border-3 border-[#A6533B] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-stone-600 font-medium">Fetching live order records...</p>
          </div>
        ) : currentList.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-dashed border-[#E8E2D9] text-center space-y-4 shadow-2xs">
            <div className="w-14 h-14 bg-amber-50 text-[#A6533B] rounded-2xl border border-amber-200/60 flex items-center justify-center mx-auto">
              <Package className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#1C1C1C]">
                {orderSubTab === 'PURCHASES' ? 'No Craft Purchases Yet' : 'No Studio Sales Yet'}
              </h3>
              <p className="text-xs text-stone-600 max-w-sm mx-auto">
                {orderSubTab === 'PURCHASES' 
                  ? 'Explore the marketplace to order authentic handcrafted crafts directly from master artisans.' 
                  : 'Your studio listings will show customer orders here when buyers place pre-orders.'}
              </p>
            </div>
            {orderSubTab === 'PURCHASES' && (
              <button
                onClick={() => onSelectMode('BUY')}
                className="px-6 py-2.5 bg-[#A6533B] hover:bg-[#88412F] text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs"
              >
                Explore Marketplace
              </button>
            )}
          </div>
        ) : (
          currentList.map((ord) => {
            const stepIdx = getStepIndex(ord.status);
            return (
              <div key={ord.id} className="bg-white rounded-2xl border border-[#E8E2D9] p-6 space-y-6 shadow-2xs hover:border-[#A6533B]/60 transition-all">
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E8E2D9] pb-4 gap-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-sm text-[#1C1C1C]">Order #{ord.order_number || ord.id}</span>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-50/80 text-[#A6533B] border border-[#E8E2D9]">
                        {ord.status || 'CONFIRMED'}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B6B6B] mt-0.5">
                      Placed on {ord.created_at ? new Date(ord.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Today'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-[#6B6B6B] block">Total Amount</span>
                    <span className="text-lg font-black text-[#A6533B]">₹{(ord.total_price || ord.price || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Content Row */}
                <div className="flex items-start space-x-4">
                  <div className="w-16 h-16 rounded-xl bg-[#FAF7F2] border border-[#E8E2D9] overflow-hidden shrink-0">
                    <img 
                      src={ord.product?.image_url || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400'} 
                      alt={ord.product?.title || 'Craft'} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-[#1C1C1C] truncate">{ord.product?.title || ord.product_title || 'Handcrafted Heritage Art'}</h4>
                    <p className="text-xs text-[#6B6B6B] mt-0.5">Qty: {ord.quantity || 1} • Craft Category: {ord.product?.category || 'Handicraft'}</p>
                    {ord.delivery_address && (
                      <p className="text-xs text-[#6B6B6B] flex items-center mt-1">
                        <MapPin className="w-3.5 h-3.5 text-[#A6533B] mr-1 shrink-0" />
                        <span className="truncate">{ord.delivery_address}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Status Timeline */}
                <div className="bg-[#FAF7F2] p-4 rounded-xl border border-[#E8E2D9]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B6B6B] mb-3">Delivery Status Timeline</p>
                  <div className="grid grid-cols-4 gap-2">
                    {TRACKING_STEPS.map((step, sIdx) => {
                      const isDone = sIdx <= stepIdx;
                      return (
                        <div key={step.key} className="text-center space-y-1">
                          <div className={`h-2 rounded-full transition-all ${isDone ? 'bg-[#A6533B]' : 'bg-[#E8E2D9]'}`} />
                          <span className={`text-[10px] font-bold block ${isDone ? 'text-[#1C1C1C]' : 'text-[#6B6B6B]'}`}>
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Seller Actions */}
                {isArtisan && orderSubTab === 'SALES' && (
                  <div className="flex items-center justify-between pt-2 border-t border-[#E8E2D9]">
                    <span className="text-xs text-[#6B6B6B] font-medium">Update Logistics Status:</span>
                    <div className="flex items-center space-x-2">
                      {['PROCESSING', 'SHIPPED', 'DELIVERED'].map((st) => (
                        <button
                          key={st}
                          disabled={updatingOrderId === ord.id}
                          onClick={() => handleUpdateOrderStatus(ord.id, st)}
                          className={`text-xs font-semibold px-3 py-1 rounded-lg border transition-all cursor-pointer ${
                            ord.status === st 
                              ? 'bg-[#A6533B] text-white border-[#A6533B]' 
                              : 'bg-white border-[#E8E2D9] text-[#1C1C1C] hover:border-[#A6533B]'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
