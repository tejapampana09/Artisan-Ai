import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, Trash2, ArrowRight, ShieldCheck, MapPin, Plus, Minus, 
  CheckCircle2, Sparkles, Truck, Lock, CreditCard, QrCode, Building, 
  Banknote, Download, ArrowLeft, Check, Receipt, ChevronRight, RefreshCw, Package
} from 'lucide-react';
import { placeOrder } from '../api/index.js';
import { useNotification } from '../context/NotificationContext';

export function getStoredCart() {
  try {
    const raw = localStorage.getItem('artisan_ai_cart');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredCart(cartItems) {
  try {
    localStorage.setItem('artisan_ai_cart', JSON.stringify(cartItems));
    window.dispatchEvent(new Event('artisan_cart_updated'));
  } catch {}
}

export function addToCart(product, quantity = 1) {
  const current = getStoredCart();
  const existingIdx = current.findIndex(i => i.product.id === product.id);
  if (existingIdx >= 0) {
    current[existingIdx].quantity += quantity;
  } else {
    current.push({ product, quantity });
  }
  saveStoredCart(current);
}

// Dynamically load Razorpay SDK
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function CartView({ user, onSelectMode, onOpenAuth }) {
  const notify = useNotification();
  const [cartItems, setCartItems] = useState(getStoredCart());
  const [checkoutStep, setCheckoutStep] = useState(1); // 1: Cart, 2: Address, 3: Confirmation

  // Shipping Form State
  const [shippingInfo, setShippingInfo] = useState({
    fullName: user?.name || '',
    phone: user?.phone || '',
    address: user?.location || '',
    city: '',
    state: '',
    pincode: ''
  });

  // Payment Selection State
  const [paymentMethod, setPaymentMethod] = useState('UPI'); // 'UPI' | 'CARD' | 'NETBANKING' | 'COD' | 'RAZORPAY'
  const [upiVpa, setUpiVpa] = useState('teja@okicici');
  const [cardDetails, setCardDetails] = useState({
    number: '4532 •••• •••• 8892',
    name: user?.name || 'Teja Pampana',
    expiry: '08/28',
    cvv: '•••'
  });
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');

  const [placingOrder, setPlacingOrder] = useState(false);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [receiptTxId, setReceiptTxId] = useState('');

  useEffect(() => {
    setCartItems(getStoredCart());
  }, []);

  const handleUpdateQuantity = (productId, delta) => {
    const updated = cartItems.map(item => {
      if (item.product.id === productId) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean);

    setCartItems(updated);
    saveStoredCart(updated);
  };

  const handleRemoveItem = (productId) => {
    const updated = cartItems.filter(item => item.product.id !== productId);
    setCartItems(updated);
    saveStoredCart(updated);
    notify.info('Item removed from cart');
  };

  const subtotal = cartItems.reduce((sum, item) => sum + (item.product.price || 0) * item.quantity, 0);
  const shipping = subtotal > 1500 || cartItems.length === 0 ? 0 : 99;
  const total = subtotal + shipping;

  const fullDeliveryAddress = `${shippingInfo.address}, ${shippingInfo.city}, ${shippingInfo.state} - ${shippingInfo.pincode}`;

  // Payments are disabled for the local prototype. Submit the order directly.
  const placeOrderDirectly = async () => {
    if (!user) {
      onOpenAuth('LOGIN');
      return;
    }
    if (cartItems.length === 0) return;

    setPlacingOrder(true);
    const placedList = [];
    try {
      for (const item of cartItems) {
        const res = await placeOrder({
          product_id: item.product.id,
          buyer_name: shippingInfo.fullName,
          buyer_phone: shippingInfo.phone,
          quantity: item.quantity,
          delivery_address: fullDeliveryAddress,
          payment_method: 'NOT_REQUIRED'
        });
        placedList.push({
          ...item,
          order_id: res?.id || Math.floor(1000 + Math.random() * 9000)
        });
      }

      setCompletedOrders(placedList);
      setReceiptTxId('Not required');
      saveStoredCart([]);
      setCartItems([]);
      window.dispatchEvent(new CustomEvent('artisan_notification_refresh'));
      setCheckoutStep(3);
      notify.success('🎉 Order confirmed! The artisan has been notified.');
    } catch (err) {
      notify.error('Order placement failed: ' + (err.message || 'Error occurred'));
    } fontally: {
      setPlacingOrder(false);
    }
  };

  // Launch Live Razorpay Standard Checkout SDK Modal
  const handleRazorpayGateway = async () => {
    if (!user) {
      onOpenAuth('LOGIN');
      return;
    }

    setPlacingOrder(true);
    const scriptLoaded = await loadRazorpayScript();

    if (!scriptLoaded) {
      notify.warning("Razorpay SDK offline, falling back to simulated secure checkout.");
      placeOrderDirectly();
      return;
    }

    const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_ArtisanAI2026';

    const options = {
      key: razorpayKey,
      amount: total * 100, // Amount in paise
      currency: "INR",
      name: "Artisan AI Marketplace",
      description: `Direct Artisan Purchase (${cartItems.length} Craft Items)`,
      image: "/artisan-logo.png",
      handler: function (response) {
        placeOrderDirectly();
      },
      prefill: {
        name: shippingInfo.fullName,
        email: user.email || 'buyer@artisan.ai',
        contact: shippingInfo.phone
      },
      theme: {
        color: "#A6533B"
      },
      modal: {
        ondismiss: function () {
          setPlacingOrder(false);
          notify.info("Razorpay payment modal closed");
        }
      }
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      placeOrderDirectly();
    }
  };

  const handleCheckoutSubmit = (e) => {
    e.preventDefault();
    placeOrderDirectly();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 font-sans">
      {/* Header Banner */}
      <div className="bg-[#FAF9F6] border border-[#E8E5DF] rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs uppercase tracking-widest text-[#A6533B] font-extrabold block">
            DIRECT ARTISAN FAIR-TRADE CHECKOUT
          </span>
          <h1 className="text-2xl sm:text-4xl font-bold text-[#1C1C1C] tracking-tight mt-0.5">
            {checkoutStep === 3 ? 'Order Confirmation' : 'Shopping Cart & Checkout'}
          </h1>
          <p className="text-xs sm:text-sm text-[#6B6B6B] mt-1">
            {checkoutStep === 1 && 'Review items in your shopping bag and proceed to shipping.'}
            {checkoutStep === 2 && 'Enter delivery address and recipient details.'}
            {checkoutStep === 3 && 'Your order is confirmed. No payment is required for this local demo.'}
          </p>
        </div>
        <button
          onClick={() => onSelectMode('BUY')}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-white border border-[#E8E5DF] text-xs font-semibold text-[#1C1C1C] hover:border-[#A6533B] hover:text-[#A6533B] transition-all cursor-pointer shadow-xs"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Continue Shopping</span>
        </button>
      </div>

      {/* Wizard Progress Steps Bar */}
      {checkoutStep < 3 && cartItems.length > 0 && (
        <div className="bg-white border border-[#E8E5DF] rounded-2xl p-4 flex items-center justify-between max-w-2xl mx-auto text-xs font-bold text-[#6B6B6B]">
          <button 
            onClick={() => setCheckoutStep(1)}
            className={`flex items-center space-x-2 cursor-pointer ${checkoutStep >= 1 ? 'text-[#A6533B]' : ''}`}
          >
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${checkoutStep >= 1 ? 'bg-[#A6533B] text-white' : 'bg-stone-100'}`}>1</span>
            <span className="hidden sm:inline">Bag Review</span>
          </button>

          <ChevronRight className="w-4 h-4 text-stone-300" />

          <button 
            onClick={() => setCheckoutStep(2)}
            className={`flex items-center space-x-2 cursor-pointer ${checkoutStep >= 2 ? 'text-[#A6533B]' : ''}`}
          >
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${checkoutStep >= 2 ? 'bg-[#A6533B] text-white' : 'bg-stone-100'}`}>2</span>
            <span className="hidden sm:inline">Shipping Address</span>
          </button>

        </div>
      )}

      {/* STEP 4: DIGITAL ORDER RECEIPT & TAX INVOICE */}
      {checkoutStep === 3 ? (
        <div className="bg-white border border-[#E8E5DF] rounded-3xl p-6 sm:p-10 max-w-3xl mx-auto space-y-8 shadow-xl">
          <div className="text-center space-y-3 border-b border-[#E8E5DF] pb-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <span className="text-[11px] font-extrabold uppercase tracking-widest px-3 py-1 bg-amber-50 text-[#A6533B] rounded-full border border-amber-200">
              ORDER CONFIRMATION
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1C1C1C]">
              Order Confirmed!
            </h2>
            <p className="text-xs text-[#6B6B6B]">
              Payment: <span className="font-bold text-[#1C1C1C]">Not required for this local demo</span>
            </p>
          </div>

          {/* Invoice Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#FAF9F6] p-5 rounded-2xl border border-[#E8E5DF] text-xs">
            <div>
              <span className="font-bold text-[#6B6B6B] block">Delivered To:</span>
              <span className="font-bold text-[#1C1C1C] text-sm block mt-0.5">{shippingInfo.fullName}</span>
              <p className="text-[#6B6B6B] mt-1 leading-relaxed">{fullDeliveryAddress}</p>
              <p className="text-[#6B6B6B] mt-0.5">Phone: {shippingInfo.phone}</p>
            </div>

            <div>
              <span className="font-bold text-[#6B6B6B] block">Order Summary:</span>
              <div className="mt-1 space-y-1">
                <p><span className="text-[#6B6B6B]">Payment:</span> <span className="font-bold text-[#A6533B]">Not required</span></p>
                <p><span className="text-[#6B6B6B]">Estimated Delivery:</span> <span className="font-bold text-[#1C1C1C]">3 - 5 Business Days</span></p>
                <p><span className="text-[#6B6B6B]">Craft Guarantee:</span> <span className="font-semibold text-emerald-800">100% Handcrafted Fair Trade</span></p>
              </div>
            </div>
          </div>

          {/* Purchased Items List */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-[#1C1C1C] flex items-center space-x-2">
              <Receipt className="w-4 h-4 text-[#A6533B]" />
              <span>Itemized Order Summary</span>
            </h3>

            <div className="border border-[#E8E5DF] rounded-2xl divide-y divide-[#E8E5DF] overflow-hidden text-xs">
              {completedOrders.map((item, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between gap-4 bg-white">
                  <div className="flex items-center space-x-3">
                    <img 
                      src={item.product.image_url} 
                      alt={item.product.title} 
                      className="w-12 h-12 rounded-xl object-cover border border-[#E8E5DF]"
                    />
                    <div>
                      <h4 className="font-bold text-[#1C1C1C] line-clamp-1">{item.product.title}</h4>
                      <p className="text-[11px] text-[#6B6B6B]">
                        Qty: {item.quantity} × ₹{item.product.price?.toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                  <span className="font-black text-[#A6533B] text-sm">
                    ₹{(item.product.price * item.quantity).toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => onSelectMode('ORDERS')}
              className="flex-1 py-3 bg-[#A6533B] hover:bg-[#88412F] text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center space-x-2"
            >
              <Package className="w-4 h-4" />
              <span>Track Orders in Account Portal</span>
            </button>
            <button
              onClick={() => {
                window.print();
              }}
              className="py-3 px-6 bg-white border border-[#E8E5DF] hover:border-[#A6533B] text-[#1C1C1C] font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-2"
            >
              <Download className="w-4 h-4 text-[#A6533B]" />
              <span>Print Tax Receipt</span>
            </button>
          </div>
        </div>
      ) : cartItems.length === 0 ? (
        /* EMPTY CART VIEW */
        <div className="bg-white p-12 rounded-2xl border border-dashed border-[#E8E5DF] text-center space-y-4">
          <div className="w-14 h-14 bg-amber-50 text-[#A6533B] rounded-2xl border border-amber-200/60 flex items-center justify-center mx-auto">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#1C1C1C]">Your Cart is Empty</h3>
            <p className="text-xs text-[#6B6B6B] max-w-sm mx-auto">
              Explore authentic Kalamkari sarees, Etikoppaka wooden toys, and Jaipur Blue Pottery in the marketplace.
            </p>
          </div>
          <button
            onClick={() => onSelectMode('BUY')}
            className="px-6 py-2.5 bg-[#A6533B] hover:bg-[#88412F] text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Explore Marketplace
          </button>
        </div>
      ) : (
        /* ACTIVE CHECKOUT WIZARD STEPS */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Left Column (Step Content) */}
          <div className="lg:col-span-8 space-y-6">
            {/* STEP 1: CART ITEMS REVIEW */}
            {checkoutStep === 1 && (
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <div 
                    key={item.product.id}
                    className="bg-white rounded-2xl border border-[#E8E5DF] p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-20 h-20 rounded-xl bg-[#FAF9F6] border border-[#E8E5DF] overflow-hidden shrink-0">
                        <img 
                          src={item.product.image_url || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400'} 
                          alt={item.product.title} 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-50 text-[#A6533B] border border-[#E8E5DF]">
                          {item.product.category || 'Handicraft'}
                        </span>
                        <h3 className="font-bold text-sm text-[#1C1C1C] mt-1 line-clamp-1">{item.product.title}</h3>
                        <p className="text-xs font-black text-[#A6533B] mt-0.5">₹{item.product.price?.toLocaleString('en-IN')}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-6 shrink-0 self-end sm:self-center">
                      <div className="flex items-center space-x-2 bg-[#FAF9F6] border border-[#E8E5DF] rounded-xl p-1">
                        <button
                          onClick={() => handleUpdateQuantity(item.product.id, -1)}
                          className="p-1 text-[#1C1C1C] hover:bg-white rounded-lg transition-colors cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-bold w-6 text-center">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateQuantity(item.product.id, 1)}
                          className="p-1 text-[#1C1C1C] hover:bg-white rounded-lg transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <span className="text-sm font-black text-[#1C1C1C] w-20 text-right">
                        ₹{((item.product.price || 0) * item.quantity).toLocaleString('en-IN')}
                      </span>

                      <button
                        onClick={() => handleRemoveItem(item.product.id)}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* STEP 2: SHIPPING & DELIVERY DETAILS */}
            {checkoutStep === 2 && (
              <div className="bg-white rounded-2xl border border-[#E8E5DF] p-6 sm:p-8 space-y-6 shadow-xs">
                <h2 className="font-bold text-lg text-[#1C1C1C] flex items-center space-x-2 border-b border-[#E8E5DF] pb-4">
                  <MapPin className="w-5 h-5 text-[#A6533B]" />
                  <span>Delivery Address & Recipient Details</span>
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-[#1C1C1C] mb-1">Full Name</label>
                    <input
                      type="text"
                      value={shippingInfo.fullName}
                      onChange={(e) => setShippingInfo({ ...shippingInfo, fullName: e.target.value })}
                      className="w-full p-3 rounded-xl border border-[#E8E5DF] focus:border-[#A6533B] bg-[#FAF9F6]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#1C1C1C] mb-1">Mobile Phone Number</label>
                    <input
                      type="text"
                      value={shippingInfo.phone}
                      onChange={(e) => setShippingInfo({ ...shippingInfo, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="w-full p-3 rounded-xl border border-[#E8E5DF] focus:border-[#A6533B] bg-[#FAF9F6]"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-[#1C1C1C] mb-1">Street Address / House No / Landmark</label>
                    <textarea
                      rows={2}
                      value={shippingInfo.address}
                      onChange={(e) => setShippingInfo({ ...shippingInfo, address: e.target.value })}
                      className="w-full p-3 rounded-xl border border-[#E8E5DF] focus:border-[#A6533B] bg-[#FAF9F6]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#1C1C1C] mb-1">City / District</label>
                    <input
                      type="text"
                      value={shippingInfo.city}
                      onChange={(e) => setShippingInfo({ ...shippingInfo, city: e.target.value })}
                      className="w-full p-3 rounded-xl border border-[#E8E5DF] focus:border-[#A6533B] bg-[#FAF9F6]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#1C1C1C] mb-1">State & Pincode</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={shippingInfo.state}
                        onChange={(e) => setShippingInfo({ ...shippingInfo, state: e.target.value })}
                        className="w-full p-3 rounded-xl border border-[#E8E5DF] focus:border-[#A6533B] bg-[#FAF9F6]"
                        required
                      />
                      <input
                        type="text"
                        value={shippingInfo.pincode}
                        onChange={(e) => setShippingInfo({ ...shippingInfo, pincode: e.target.value })}
                        className="w-full p-3 rounded-xl border border-[#E8E5DF] focus:border-[#A6533B] bg-[#FAF9F6]"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: PAYMENT GATEWAY SELECTION */}
            {checkoutStep === 3 && (
              <div className="bg-white rounded-2xl border border-[#E8E5DF] p-6 sm:p-8 space-y-6 shadow-xs">
                <h2 className="font-bold text-lg text-[#1C1C1C] flex items-center space-x-2 border-b border-[#E8E5DF] pb-4">
                  <CreditCard className="w-5 h-5 text-[#A6533B]" />
                  <span>Select Payment Gateway</span>
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Option 1: Instant UPI */}
                  <div
                    onClick={() => setPaymentMethod('UPI')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start space-x-3 ${
                      paymentMethod === 'UPI' ? 'border-[#A6533B] bg-amber-50/40 ring-1 ring-[#A6533B]' : 'border-[#E8E5DF] hover:border-stone-400'
                    }`}
                  >
                    <QrCode className="w-5 h-5 text-[#A6533B] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-[#1C1C1C]">UPI / GPay / PhonePe / QR</h4>
                      <p className="text-[11px] text-[#6B6B6B] mt-0.5">Instant zero-fee scan & pay via BHIM UPI</p>
                    </div>
                  </div>

                  {/* Option 2: Cards */}
                  <div
                    onClick={() => setPaymentMethod('CARD')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start space-x-3 ${
                      paymentMethod === 'CARD' ? 'border-[#A6533B] bg-amber-50/40 ring-1 ring-[#A6533B]' : 'border-[#E8E5DF] hover:border-stone-400'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 text-[#A6533B] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-[#1C1C1C]">Credit / Debit Cards</h4>
                      <p className="text-[11px] text-[#6B6B6B] mt-0.5">Visa, Mastercard, RuPay & Diners</p>
                    </div>
                  </div>

                  {/* Option 3: NetBanking */}
                  <div
                    onClick={() => setPaymentMethod('NETBANKING')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start space-x-3 ${
                      paymentMethod === 'NETBANKING' ? 'border-[#A6533B] bg-amber-50/40 ring-1 ring-[#A6533B]' : 'border-[#E8E5DF] hover:border-stone-400'
                    }`}
                  >
                    <Building className="w-5 h-5 text-[#A6533B] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-[#1C1C1C]">NetBanking</h4>
                      <p className="text-[11px] text-[#6B6B6B] mt-0.5">HDFC, ICICI, SBI, Axis & 50+ Banks</p>
                    </div>
                  </div>

                  {/* Option 4: Cash on Delivery */}
                  <div
                    onClick={() => setPaymentMethod('COD')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start space-x-3 ${
                      paymentMethod === 'COD' ? 'border-[#A6533B] bg-amber-50/40 ring-1 ring-[#A6533B]' : 'border-[#E8E5DF] hover:border-stone-400'
                    }`}
                  >
                    <Banknote className="w-5 h-5 text-[#A6533B] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-[#1C1C1C]">Cash on Delivery (COD)</h4>
                      <p className="text-[11px] text-[#6B6B6B] mt-0.5">Pay in cash upon doorstep delivery</p>
                    </div>
                  </div>

                  {/* Option 5: Razorpay SDK Gateway */}
                  <div
                    onClick={() => setPaymentMethod('RAZORPAY')}
                    className={`sm:col-span-2 p-4 rounded-2xl border cursor-pointer transition-all flex items-start space-x-3 ${
                      paymentMethod === 'RAZORPAY' ? 'border-[#A6533B] bg-amber-50/40 ring-1 ring-[#A6533B]' : 'border-[#E8E5DF] hover:border-stone-400'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      R
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-[#1C1C1C]">Razorpay Official Checkout Popup</h4>
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                          LIVE SDK
                        </span>
                      </div>
                      <p className="text-[11px] text-[#6B6B6B] mt-0.5">Opens authentic Razorpay modal with standard gateways</p>
                    </div>
                  </div>
                </div>

                {/* Sub-form inputs based on selected payment method */}
                <div className="p-4 bg-[#FAF9F6] rounded-2xl border border-[#E8E5DF] text-xs space-y-3">
                  {paymentMethod === 'UPI' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#1C1C1C]">Scan QR or enter UPI VPA Handle</span>
                        <span className="text-[10px] text-[#356B4A] font-bold">Instant Verification</span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="w-24 h-24 bg-white border border-[#E8E5DF] rounded-xl p-1.5 shrink-0 flex items-center justify-center">
                          <img 
                            src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=artisan.ai@icici&pn=ArtisanAI&am=100" 
                            alt="UPI QR Code" 
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <label className="block text-[11px] font-semibold text-[#6B6B6B]">UPI VPA ID</label>
                          <input
                            type="text"
                            value={upiVpa}
                            onChange={(e) => setUpiVpa(e.target.value)}
                            placeholder="username@upi or phone@gpay"
                            className="w-full p-2.5 bg-white rounded-xl border border-[#E8E5DF]"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'CARD' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="block font-semibold text-[#6B6B6B] mb-1">Card Number</label>
                          <input
                            type="text"
                            value={cardDetails.number}
                            onChange={(e) => setCardDetails({ ...cardDetails, number: e.target.value })}
                            className="w-full p-2.5 bg-white rounded-xl border border-[#E8E5DF]"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-[#6B6B6B] mb-1">Expiry Date</label>
                          <input
                            type="text"
                            value={cardDetails.expiry}
                            onChange={(e) => setCardDetails({ ...cardDetails, expiry: e.target.value })}
                            className="w-full p-2.5 bg-white rounded-xl border border-[#E8E5DF]"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-[#6B6B6B] mb-1">CVV Security Code</label>
                          <input
                            type="password"
                            value={cardDetails.cvv}
                            onChange={(e) => setCardDetails({ ...cardDetails, cvv: e.target.value })}
                            className="w-full p-2.5 bg-white rounded-xl border border-[#E8E5DF]"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'NETBANKING' && (
                    <div className="space-y-2">
                      <label className="block font-semibold text-[#6B6B6B]">Select Your Bank</label>
                      <select
                        value={selectedBank}
                        onChange={(e) => setSelectedBank(e.target.value)}
                        className="w-full p-2.5 bg-white rounded-xl border border-[#E8E5DF] text-xs font-semibold"
                      >
                        <option value="HDFC Bank">HDFC Bank</option>
                        <option value="ICICI Bank">ICICI Bank</option>
                        <option value="State Bank of India">State Bank of India (SBI)</option>
                        <option value="Axis Bank">Axis Bank</option>
                        <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                      </select>
                    </div>
                  )}

                  {paymentMethod === 'COD' && (
                    <p className="text-xs text-[#6B6B6B] leading-relaxed">
                      💵 Cash will be collected by the logistics delivery agent at the time of package delivery. Please keep exact change ready.
                    </p>
                  )}

                  {paymentMethod === 'RAZORPAY' && (
                    <p className="text-xs text-[#6B6B6B] leading-relaxed">
                      ⚡ Clicking "Pay & Place Order" will open Razorpay's official secure payment window supporting all major Indian banks, wallets, and UPI apps.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Summary Column */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl border border-[#E8E5DF] p-6 space-y-6 shadow-xs">
              <h2 className="font-bold text-base text-[#1C1C1C] border-b border-[#E8E5DF] pb-3">
                Order Summary
              </h2>

              <div className="space-y-2.5 text-xs text-[#6B6B6B]">
                <div className="flex justify-between">
                  <span>Subtotal ({cartItems.length} items)</span>
                  <span className="font-bold text-[#1C1C1C]">₹{subtotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Direct Craft Shipping</span>
                  <span className="font-bold text-[#356B4A]">{shipping === 0 ? 'FREE' : `₹${shipping}`}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#E8E5DF] text-sm text-[#1C1C1C]">
                  <span className="font-bold">Total Amount Payable</span>
                  <span className="font-black text-lg text-[#A6533B]">₹{total.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Guarantees */}
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/60 text-[11px] text-[#A6533B] space-y-1">
                <span className="font-bold flex items-center">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                  Protected Fair Margin Guarantee
                </span>
                <p className="text-[10px] text-[#6B6B6B]">
                  100% of the artisan cost + minimum 20% margin goes directly to the master creator.
                </p>
              </div>

              {/* Wizard Navigation Buttons */}
              <div className="space-y-2">
                {checkoutStep === 1 && (
                  <button
                    onClick={() => {
                      if (!user) {
                        onOpenAuth('LOGIN');
                        return;
                      }
                      setCheckoutStep(2);
                    }}
                    className="w-full py-3.5 bg-[#A6533B] hover:bg-[#88412F] text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <span>Proceed to Delivery Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {checkoutStep === 2 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCheckoutStep(1)}
                      className="py-3 px-4 bg-white border border-[#E8E5DF] hover:bg-stone-50 text-[#1C1C1C] font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      onClick={placeOrderDirectly}
                      disabled={placingOrder}
                      className="flex-1 py-3.5 bg-[#A6533B] hover:bg-[#88412F] disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      {placingOrder ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Place Order</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {checkoutStep === 3 && (
                  <div className="space-y-2">
                    <button
                      disabled={placingOrder}
                      onClick={handleCheckoutSubmit}
                      className="w-full py-3.5 bg-[#A6533B] hover:bg-[#88412F] text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      {placingOrder ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span>Pay & Place Order (₹{total.toLocaleString('en-IN')})</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setCheckoutStep(2)}
                      className="w-full py-2 bg-white text-[#6B6B6B] hover:text-[#1C1C1C] font-bold text-[11px] cursor-pointer"
                    >
                      ← Back to Address Details
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
