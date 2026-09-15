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
        const orderRes = await placeOrder({
          product_id: product.id,
          buyer_name: formData.buyer_name,
          quantity: formData.quantity,
          delivery_address: formData.delivery_address,
          payment_method: 'UPI',
          payment_tx_id: null
        });
        window.dispatchEvent(new CustomEvent('artisan_notification_refresh'));
        onSuccess(`Order #${orderRes?.id || ''} placed successfully for ${formData.quantity} unit(s) of "${product.title}"!`);
      } else {
        await submitEnquiry({
          product_id: product.id,
          buyer_name: formData.buyer_name,
          buyer_phone: formData.buyer_phone,
          quantity: formData.quantity,
          message: formData.message
        });
        window.dispatchEvent(new CustomEvent('artisan_notification_refresh'));
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-md max-w-md w-full p-6 shadow-xl border border-[#E8E5DF]">
        <div className="flex justify-between items-center pb-3 border-b border-[#E8E5DF]">
          <div className="flex items-center space-x-2">
            {isOrder ? (
              <ShoppingBag className="w-5 h-5 text-[#A6533B]" />
            ) : (
              <Send className="w-5 h-5 text-[#A6533B]" />
            )}
            <h3 className="font-bold text-[#1C1C1C] text-sm">
              {isOrder ? 'CHECKOUT — DIRECT ORDER' : 'SUBMIT B2B ENQUIRY'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-[#6B6B6B] hover:text-[#1C1C1C] rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product preview */}
        <div className="mt-4 p-3 bg-[#FAF9F6] rounded-md border border-[#E8E5DF] flex items-center space-x-3">
          <img src={product.image_url} alt={product.title} className="w-12 h-12 rounded object-cover" />
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-semibold text-[#1C1C1C] truncate">{product.title}</h4>
            <p className="text-[11px] text-[#6B6B6B]">₹{product.price} / unit • In Stock: {product.stock}</p>
          </div>
        </div>

        {user && product.seller_id === user.id ? (
          <div className="mt-4 p-5 rounded-md bg-[#FAF9F6] border border-[#E8E5DF] text-center space-y-3">
            <div className="w-10 h-10 mx-auto rounded-md bg-amber-50 flex items-center justify-center text-[#A6533B]">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-[#1C1C1C] text-sm">Self-Purchase Disabled</h4>
              <p className="text-xs text-[#6B6B6B] mt-1 leading-relaxed">
                You are registered as the artisan creator of this craft. Artisans cannot purchase or submit enquiries for their own listed crafts.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-md bg-[#1C1C1C] hover:bg-[#A6533B] text-white font-medium text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        ) : !user ? (
          <div className="mt-4 p-5 rounded-md bg-[#FAF9F6] border border-[#E8E5DF] text-center space-y-4">
            <div className="w-10 h-10 mx-auto rounded-md bg-amber-50 flex items-center justify-center text-[#A6533B]">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-[#1C1C1C] text-sm">Sign In Required</h4>
              <p className="text-xs text-[#6B6B6B] mt-1 leading-relaxed">
                Please sign in to your account to place your direct artisan order or submit a bulk enquiry.
              </p>
            </div>
            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 px-3 rounded-md border border-[#E8E5DF] text-[#1C1C1C] font-medium text-xs hover:bg-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAuth?.();
                }}
                className="flex-1 py-2.5 px-4 rounded-md bg-[#A6533B] hover:bg-[#88412F] text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Sign In / Register
              </button>
            </div>
          </div>
        ) : isOrder && product.stock <= 0 ? (
          <div className="mt-4 p-5 rounded-md bg-rose-50 border border-rose-200 text-center space-y-3">
            <div className="w-10 h-10 mx-auto rounded-md bg-rose-100 flex items-center justify-center text-rose-600">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-[#1C1C1C] text-sm">Craft Out of Stock</h4>
              <p className="text-xs text-[#6B6B6B] mt-1.5 leading-relaxed">
                All ready units of this craft have been sold out. You can submit a custom pre-order enquiry to the master artisan!
              </p>
            </div>
            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 px-3 rounded-md border border-[#E8E5DF] text-[#1C1C1C] font-medium text-xs hover:bg-white transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentMode('ENQUIRY');
                  setFormData(prev => ({ ...prev, quantity: 5 }));
                }}
                className="flex-1 py-2.5 px-4 rounded-md bg-[#A6533B] hover:bg-[#88412F] text-white font-semibold text-xs transition-colors cursor-pointer inline-flex items-center justify-center space-x-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Pre-Order</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-xs">
            <div>
              <label className="block font-medium text-[#1C1C1C] mb-1">Full Name</label>
              <input
                type="text"
                required
                value={formData.buyer_name}
                placeholder="Enter your full name"
                onChange={(e) => setFormData({ ...formData, buyer_name: e.target.value })}
                className="w-full border border-[#E8E5DF] rounded-md px-3 py-2 text-xs text-[#1C1C1C] focus:border-[#A6533B] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-[#1C1C1C] mb-1">Phone Number</label>
                <input
                  type="text"
                  required
                  value={formData.buyer_phone}
                  placeholder="+91 98765 43210"
                  onChange={(e) => setFormData({ ...formData, buyer_phone: e.target.value })}
                  className="w-full border border-[#E8E5DF] rounded-md px-3 py-2 text-xs text-[#1C1C1C] focus:border-[#A6533B] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-medium text-[#1C1C1C] mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  max={isOrder ? Math.max(1, product.stock) : 500}
                  required
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                  className="w-full border border-[#E8E5DF] rounded-md px-3 py-2 text-xs text-[#1C1C1C] text-right font-bold focus:border-[#A6533B] focus:outline-none"
                />
              </div>
            </div>

            {isOrder ? (
              <div>
                <label className="block font-medium text-[#1C1C1C] mb-1">Delivery Address</label>
                <textarea
                  rows="2"
                  required
                  value={formData.delivery_address}
                  placeholder="Enter complete shipping address..."
                  onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                  className="w-full border border-[#E8E5DF] rounded-md p-2.5 text-xs text-[#1C1C1C] focus:border-[#A6533B] focus:outline-none"
                />
              </div>
            ) : (
              <div>
                <label className="block font-medium text-[#1C1C1C] mb-1">Enquiry Specifications</label>
                <textarea
                  rows="2"
                  value={formData.message}
                  placeholder="Describe custom specifications..."
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full border border-[#E8E5DF] rounded-md p-2.5 text-xs text-[#1C1C1C] focus:border-[#A6533B] focus:outline-none"
                />
              </div>
            )}

            {/* Order Summary & Total */}
            <div className="p-3.5 rounded-md bg-[#FAF9F6] border border-[#E8E5DF] space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#6B6B6B] font-medium">{isOrder ? 'Total Amount:' : 'Estimated Total:'}</span>
                <span className="font-bold text-[#1C1C1C] text-base">₹{totalPrice.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-xs font-medium text-[#6B6B6B] hover:text-[#1C1C1C]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 text-xs font-semibold text-white bg-[#A6533B] hover:bg-[#88412F] rounded-md transition-colors cursor-pointer"
              >
                {submitting ? 'Submitting...' : isOrder ? 'PLACE ORDER' : 'Send B2B Enquiry'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
