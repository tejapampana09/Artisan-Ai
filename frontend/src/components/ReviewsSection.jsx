import React, { useState, useEffect } from 'react';
import { Star, ShieldCheck, MessageSquare, Send } from 'lucide-react';
import { getProductReviews, createProductReview } from '../api/trust.js';
import { useNotification } from '../context/NotificationContext.jsx';

export default function ReviewsSection({ productId, user, product }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { addNotification } = useNotification();

  const isSellerOwner = user && product && product.seller_id === user.id;

  useEffect(() => {
    if (productId) {
      fetchReviews();
    }
  }, [productId]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const data = await getProductReviews(productId);
      setReviews(data);
    } catch (err) {
      console.error('Failed to load reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const newReview = await createProductReview(productId, { rating, comment });
      setReviews([newReview, ...reviews]);
      setComment('');
      addNotification('Review submitted successfully! Thank you for supporting artisans. ⭐', 'success');
    } catch (err) {
      addNotification('Failed to submit review: ' + (err.message || 'Error'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const avgRating = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : 0;

  return (
    <div className="mt-4 pt-4 border-t border-[#E8E5DF] space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <MessageSquare className="w-4 h-4 text-[#A6533B]" />
          <h4 className="font-bold text-[#1C1C1C] text-xs uppercase tracking-wider">
            Verified Buyer Reviews & Ratings
          </h4>
        </div>
        {reviews.length > 0 && (
          <div className="flex items-center space-x-1.5 bg-[#FAF9F6] px-2.5 py-0.5 rounded border border-[#E8E5DF] text-xs font-bold text-[#1C1C1C]">
            <Star className="w-3.5 h-3.5 text-amber-500 fill-current" />
            <span>{avgRating} / 5</span>
            <span className="text-[#6B6B6B] text-[10px]">({reviews.length})</span>
          </div>
        )}
      </div>

      {/* Review List */}
      {loading ? (
        <p className="text-xs text-[#6B6B6B]">Loading reviews...</p>
      ) : reviews.length === 0 ? (
        <div className="p-3 bg-[#FAF9F6] rounded-md text-center text-xs text-[#6B6B6B] border border-[#E8E5DF]">
          No buyer reviews yet. Be the first verified buyer to leave a review!
        </div>
      ) : (
        <div className="space-y-2.5 max-h-44 overflow-y-auto pr-1">
          {reviews.map((rev) => (
            <div key={rev.id} className="p-2.5 bg-[#FAF9F6] rounded-md border border-[#E8E5DF] text-xs space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-[#1C1C1C]">{rev.buyer_name}</span>
                  {rev.verified_purchase && (
                    <span className="flex items-center text-[10px] font-semibold text-[#356B4A] bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                      <ShieldCheck className="w-3 h-3 text-[#356B4A] mr-0.5" />
                      Verified Purchase
                    </span>
                  )}
                </div>
                <div className="flex text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3 h-3 ${i < rev.rating ? 'fill-current' : 'text-slate-300'}`}
                    />
                  ))}
                </div>
              </div>
              {rev.comment && <p className="text-[#6B6B6B] leading-snug">{rev.comment}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Add Review Form or Seller Self-Review Prohibition Notice */}
      {isSellerOwner ? (
        <div className="p-3 bg-[#FAF9F6] rounded-md border border-[#E8E5DF] text-[#1C1C1C] text-xs space-y-1">
          <div className="flex items-center space-x-1.5 font-bold text-[#A6533B]">
            <ShieldCheck className="w-4 h-4 text-[#A6533B] shrink-0" />
            <span>Self-Review Prohibited</span>
          </div>
          <p className="text-[11px] text-[#6B6B6B] leading-snug">
            As the master artisan of this craft item, you cannot post reviews on your own product. Reviews are reserved for verified buyers.
          </p>
        </div>
      ) : user && (
        <form onSubmit={handleSubmitReview} className="p-3 bg-[#FAF9F6] rounded-md border border-[#E8E5DF] space-y-2 text-xs">
          <span className="font-bold text-[#1C1C1C] block text-[11px]">Write a Verified Buyer Review</span>
          <div className="flex items-center space-x-2">
            <span className="text-[#6B6B6B] text-[11px]">Rating:</span>
            <div className="flex space-x-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-0.5 cursor-pointer hover:scale-110 transition-transform"
                >
                  <Star className={`w-4 h-4 ${star <= rating ? 'text-amber-500 fill-current' : 'text-slate-300'}`} />
                </button>
              ))}
            </div>
          </div>
          <div className="flex space-x-2">
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your feedback on craft quality..."
              className="flex-1 p-2 rounded-md border border-[#E8E5DF] bg-white text-xs text-[#1C1C1C] focus:border-[#A6533B] focus:outline-none"
              required
            />
            <button
              type="submit"
              disabled={submitting}
              className="px-3 py-2 bg-[#A6533B] hover:bg-[#88412F] text-white font-semibold rounded-md flex items-center space-x-1 text-xs cursor-pointer transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
