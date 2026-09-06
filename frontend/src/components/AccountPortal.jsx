import React, { useState, useEffect } from 'react';
import { 
  X, User, ShoppingBag, Heart, MessageSquare, LogOut, Package, 
  MapPin, Phone, Mail, Store, ShieldCheck, ChevronRight, RefreshCw, 
  Trash2, ExternalLink, Sparkles, CheckCircle2, Clock
} from 'lucide-react';
import { getOrders, getEnquiries, getProducts, logoutUser } from '../api';
import { getSavedProductIds, removeSavedProductId } from '../services/offlineSync';

export default function AccountPortal({ user, onClose, onAuthChange, onNavigateMode }) {
  const [activeTab, setActiveTab] = useState('ORDERS'); // 'ORDERS' | 'WISHLIST' | 'ENQUIRIES' | 'PROFILE'
  const [orders, setOrders] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [wishlistProducts, setWishlistProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAccountData = async () => {
    setLoading(true);
    try {
      const [allOrders, allEnqs, allProds] = await Promise.all([
        getOrders(),
        getEnquiries(),
        getProducts()
      ]);

      // Filter orders where user is the buyer
      setOrders(allOrders || []);
      setEnquiries(allEnqs || []);

      // Load saved wishlist crafts
      const savedIds = getSavedProductIds(user?.id);
      const favs = (allProds || []).filter(p => savedIds.includes(p.id));
      setWishlistProducts(favs);
    } catch (err) {
      console.error('Failed to load account details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccountData();
  }, [user]);

  const handleRemoveWishlist = (productId) => {
    removeSavedProductId(user?.id, productId);
    setWishlistProducts(prev => prev.filter(p => p.id !== productId));
  };

  const handleLogout = () => {
    logoutUser();
    onAuthChange(null);
    onClose();
  };

  const isArtisan = user?.role === 'ARTISAN';

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
              {orders.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1 ${
                  activeTab === 'ORDERS' ? 'bg-amber-100 text-amber-900' : 'bg-white/20 text-white'
                }`}>
                  {orders.length}
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
              {enquiries.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1 ${
                  activeTab === 'ENQUIRIES' ? 'bg-amber-100 text-amber-900' : 'bg-white/20 text-white'
                }`}>
                  {enquiries.length}
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
              {/* TAB 1: MY ORDERS */}
              {activeTab === 'ORDERS' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">Your Direct Orders (మీ ఆర్డర్‌లు)</h4>
                      <p className="text-[11px] text-slate-500">Track real-time artisan shipments and purchase history</p>
                    </div>
                    <button 
                      onClick={loadAccountData} 
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                      title="Refresh Orders"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {orders.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                      <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700">
                        <ShoppingBag className="w-6 h-6" />
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-800 text-sm">No Orders Placed Yet (ఇంకా ఆర్డర్‌లు లేవు)</h5>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                          Directly support traditional artisans by purchasing genuine handcrafted goods from the marketplace.
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
                    <div className="space-y-2.5">
                      {orders.map((ord) => (
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
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-extrabold text-xs sm:text-sm text-slate-900 block">
                                ₹{ord.total_price.toLocaleString('en-IN')}
                              </span>
                              <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200 mt-0.5">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Confirmed</span>
                              </span>
                            </div>
                          </div>

                          {ord.delivery_address && (
                            <div className="pt-1 text-[11px] text-slate-600 flex items-start space-x-1 bg-white p-2 rounded-xl border border-slate-100">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                              <span className="truncate">Delivery To: {ord.delivery_address}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
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
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">Wholesale Enquiries (ఎన్‌క్వైరీలు)</h4>
                      <p className="text-[11px] text-slate-500">Custom bulk orders and artisan negotiations</p>
                    </div>
                    <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                      {enquiries.length} leads
                    </span>
                  </div>

                  {enquiries.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                      <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                        <MessageSquare className="w-6 h-6" />
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-800 text-sm">No Enquiries Submitted Yet</h5>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                          Need custom sizes, bespoke craftsmanship, or wholesale lots? Submit enquiries directly to master artisans.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {enquiries.map((enq) => (
                        <div key={enq.id} className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition-all space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <h5 className="font-bold text-xs sm:text-sm text-slate-900">{enq.product_title || `Craft #${enq.product_id}`}</h5>
                              <p className="text-[11px] text-slate-500">Requested Quantity: <strong>{enq.quantity} units</strong></p>
                            </div>
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200 shrink-0">
                              Awaiting Response
                            </span>
                          </div>

                          {enq.message && (
                            <p className="text-xs text-slate-700 italic bg-white p-2.5 rounded-xl border border-slate-200/60 leading-relaxed">
                              "{enq.message}"
                            </p>
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
