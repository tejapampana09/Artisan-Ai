import React, { useState, useEffect } from 'react';
import { X, ShoppingBag, Send, CheckCircle2, ShieldCheck, Package } from 'lucide-react';
import { placeOrder, submitEnquiry } from '../api/index.js';
import { useNotification } from '../context/NotificationContext';

export default function BuyerOrderModal({ product, mode = 'ORDER', isOpen, onClose, onSuccess, user, onOpenAuth }) {
  const notify = useNotification();
  const [currentMode, setCurrentMode] = useState(mode);

  useEffect(() => {
    setCurrentMode(mode);
  }, [mode, isOpen]);

  const isOrder = currentMode === 'ORDER';
  const [formData, setFormData] = useState({
    buyer_name: user?.name || '',
    buyer_phone: user?.phone || '',
    quantity: isOrder ? 1 : 10,
    delivery_address: user?.location || '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !product) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      onClose();
      onOpenAuth?.();
      return;
    }
    if (user && product.seller_id === user.id) {
      notify.warning("Self-purchase not allowed: Artisans cannot purchase their own listed crafts.");
      return;
    }
    if (isOrder && product.stock <= 0) {
      notify.warning("This craft is currently out of stock for direct checkout. Please submit a pre-order enquiry instead.");
      return;
    }
    setSubmitting(true);
    try {
      if (isOrder) {
        await placeOrder({
          product_id: product.id,
          buyer_name: formData.buyer_name,
          quantity: formData.quantity,
          delivery_address: formData.delivery_address
        });
        onSuccess(`Order placed successfully for ${formData.quantity} unit(s) of "${product.title}"!`);
      } else {
        await submitEnquiry({
          product_id: product.id,
          buyer_name: formData.buyer_name,
          buyer_phone: formData.buyer_phone,
          quantity: formData.quantity,
          message: formData.message
        });
        onSuccess(`Wholesale enquiry submitted for ${formData.quantity} units to artisan!`);
      }
      onClose();
    } catch (err) {
      if (err.message && (err.message.includes('401') || err.message.includes('Unauthorized'))) {
        notify.warning('Please sign in to place your order or submit an enquiry.');
        onClose();
        onOpenAuth?.();
      } else {
        notify.error('Action failed: ' + err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const totalPrice = product.price * formData.quantity;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            {isOrder ? (
              <ShoppingBag className="w-5 h-5 text-indigo-600" />
            ) : (
              <Send className="w-5 h-5 text-amber-600" />
            )}
            <h3 className="font-bold text-slate-900 text-sm">
              {isOrder ? 'Place Direct Artisan Order' : 'Submit B2B Bulk Enquiry'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product preview */}
        <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center space-x-3">
          <img src={product.image_url} alt={product.title} className="w-12 h-12 rounded-lg object-cover" />
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-slate-900 truncate">{product.title}</h4>
            <p className="text-[11px] text-slate-500">₹{product.price} / unit • In Stock: {product.stock}</p>
          </div>
        </div>

        {user && product.seller_id === user.id ? (
          <div className="mt-4 p-5 rounded-2xl bg-amber-50 border border-amber-200 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Self-Purchase Disabled (మీ స్వంత ఉత్పత్తి)</h4>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                You are registered as the artisan creator of this craft. Artisans cannot purchase or submit enquiries for their own listed crafts.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                Got It / Close
              </button>
            </div>
          </div>
        ) : !user ? (
          <div className="mt-4 p-5 rounded-2xl bg-amber-50 border border-amber-200 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Sign In Required to Proceed</h4>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Please sign in to your account to place your direct artisan order or submit a bulk enquiry with live delivery updates.
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 px-3 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAuth?.();
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                Sign In / Register
              </button>
            </div>
          </div>
        ) : isOrder && product.stock <= 0 ? (
          <div className="mt-4 p-5 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Craft Out of Stock (ప్రస్తుతం అందుబాటులో లేదు)</h4>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                All ready units of this craft have been sold out. Direct instant checkout is temporarily unavailable.
              </p>
              <p className="text-xs text-amber-800 font-medium mt-1">
                You can submit a custom pre-order enquiry to the master artisan to craft a fresh batch for you!
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 px-3 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-white transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentMode('ENQUIRY');
                  setFormData(prev => ({ ...prev, quantity: 5 }));
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer inline-flex items-center justify-center space-x-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Pre-Order</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Your Name</label>
            <input
              type="text"
              required
              value={formData.buyer_name}
              placeholder="Enter your full name"
              onChange={(e) => setFormData({ ...formData, buyer_name: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                required
                value={formData.buyer_phone}
                placeholder="+91 98765 43210"
                onChange={(e) => setFormData({ ...formData, buyer_phone: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                max={isOrder ? Math.max(1, product.stock) : 500}
                required
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-right font-bold"
              />
            </div>
          </div>

          {isOrder ? (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Delivery Address</label>
              <textarea
                rows="2"
                required
                value={formData.delivery_address}
                placeholder="Enter complete shipping address (street, city, pin code)..."
                onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                className="w-full border border-slate-200 rounded-xl p-2.5"
              />
            </div>
          ) : (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Enquiry Specifications / Timeline</label>
              <textarea
                rows="2"
                value={formData.message}
                placeholder="Describe wholesale requirements, custom specifications, or expected delivery timeline..."
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full border border-slate-200 rounded-xl p-2.5"
              />
            </div>
          )}

          {/* Pricing summary & Dynamic UPI QR Section */}
          <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-indigo-950 font-semibold">{isOrder ? 'Order Total:' : 'Estimated Order Value:'}</span>
              <span className="font-bold text-indigo-900 text-sm">₹{totalPrice.toLocaleString('en-IN')}</span>
            </div>

            {isOrder && (
              <div className="pt-2 border-t border-indigo-200/60 text-center space-y-2">
                <span className="text-[11px] font-bold text-indigo-900 flex items-center justify-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Instant Direct Artisan UPI Payment QR Code</span>
                </span>
                
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 bg-white p-3 rounded-xl border border-indigo-100 shadow-2xs">
                  <div className="relative p-1 bg-white rounded-lg border border-slate-200 shadow-xs">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                        `upi://pay?pa=artisan@upi&pn=${encodeURIComponent('Artisan Handcraft Hub')}&am=${totalPrice}&cu=INR&tn=${encodeURIComponent('Artisan AI Order #' + product.id)}`
                      )}`}
                      alt="UPI Payment QR Code"
                      className="w-28 h-28 object-contain rounded"
                    />
                  </div>

                  <div className="text-left space-y-1.5 min-w-0">
                    <span className="text-[10px] text-slate-500 font-medium block">Scan with any UPI App:</span>
                    <div className="flex flex-wrap gap-1.5">
                      <a
                        href={`upi://pay?pa=artisan@upi&pn=${encodeURIComponent('Artisan Handcraft')}&am=${totalPrice}&cu=INR&tn=${encodeURIComponent('Artisan AI Order #' + product.id)}`}
                        className="px-2.5 py-1 text-[10px] font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-2xs"
                      >
                        ⚡ PhonePe
                      </a>
                      <a
                        href={`upi://pay?pa=artisan@upi&pn=${encodeURIComponent('Artisan Handcraft')}&am=${totalPrice}&cu=INR&tn=${encodeURIComponent('Artisan AI Order #' + product.id)}`}
                        className="px-2.5 py-1 text-[10px] font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-2xs"
                      >
                        ⚡ GPay
                      </a>
                      <a
                        href={`upi://pay?pa=artisan@upi&pn=${encodeURIComponent('Artisan Handcraft')}&am=${totalPrice}&cu=INR&tn=${encodeURIComponent('Artisan AI Order #' + product.id)}`}
                        className="px-2.5 py-1 text-[10px] font-bold bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors shadow-2xs"
                      >
                        ⚡ Paytm
                      </a>
                    </div>
                    <p className="text-[10px] text-emerald-700 font-semibold flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>100% Direct to Artisan Account (Zero Platform Cut)</span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 font-medium text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`px-5 py-2 font-bold text-white rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer ${
                isOrder ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {submitting ? 'Submitting...' : isOrder ? 'Confirm & Place Order ₹' + totalPrice : 'Send B2B Enquiry'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
