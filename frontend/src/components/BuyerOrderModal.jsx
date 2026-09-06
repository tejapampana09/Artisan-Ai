import React, { useState } from 'react';
import { X, ShoppingBag, Send, CheckCircle2, ShieldCheck } from 'lucide-react';
import { placeOrder, submitEnquiry } from '../api';

export default function BuyerOrderModal({ product, mode = 'ORDER', isOpen, onClose, onSuccess, user, onOpenAuth }) {
  if (!isOpen || !product) return null;

  const isOrder = mode === 'ORDER';
  const [formData, setFormData] = useState({
    buyer_name: user?.name || '',
    buyer_phone: user?.phone || '',
    quantity: isOrder ? 1 : 10,
    delivery_address: user?.location || '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      onClose();
      onOpenAuth?.();
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
        alert('Please sign in to place your order or submit an enquiry.');
        onClose();
        onOpenAuth?.();
      } else {
        alert('Action failed: ' + err.message);
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

        {!user ? (
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
                max={isOrder ? product.stock : 500}
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

          {/* Pricing summary */}
          <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 flex justify-between items-center text-xs">
            <span className="text-indigo-950 font-semibold">{isOrder ? 'Order Total:' : 'Estimated Order Value:'}</span>
            <span className="font-bold text-indigo-900 text-sm">₹{totalPrice.toLocaleString('en-IN')}</span>
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
              {submitting ? 'Submitting...' : isOrder ? 'Confirm & Pay ₹' + totalPrice : 'Send B2B Enquiry'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
