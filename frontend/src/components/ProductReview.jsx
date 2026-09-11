import React, { useState } from 'react';
import { Sparkles, Edit2, Check, IndianRupee, Tag, ShieldCheck, Image as ImageIcon, Send, ArrowLeft } from 'lucide-react';

export default function ProductReview({ sessionData, priceData, onPublish, onBack, loading }) {
  const listing = sessionData?.listing_draft || {};
  const facts = sessionData?.extracted_facts || {};
  const recPrice = priceData?.recommended_price || sessionData?.recommended_price || 0;

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: listing.name || facts.product_name || 'Handcrafted Artisan Product',
    description: listing.description || facts.description || '',
    category: listing.category || facts.category || 'Handicrafts',
    craft_story: listing.craft_story || facts.craft_story || '',
    price: recPrice,
    image_url: sessionData?.photo_url || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800',
    tags: (listing.tags || ['Handmade', 'Artisan', 'Authentic']).join(', '),
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePublishSubmit = (e) => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      description: formData.description,
      category: formData.category,
      craft_story: formData.craft_story,
      price: parseFloat(formData.price) || recPrice,
      image_url: formData.image_url,
      tags: typeof formData.tags === 'string' ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean) : formData.tags,
    };
    onPublish(payload);
  };

  return (
    <div className="space-y-6 bg-slate-900/90 p-6 rounded-2xl border border-amber-500/30 text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-xl font-bold text-amber-300 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            Final Product Review & Verification
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Inspect AI-generated listing prose, craft story, and confirmed facts before publishing to the marketplace.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsEditing(!isEditing)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 flex items-center gap-1.5 transition-all"
        >
          <Edit2 className="w-3.5 h-3.5" />
          {isEditing ? 'Preview Mode' : 'Edit Listing Fields'}
        </button>
      </div>

      <form onSubmit={handlePublishSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Image Preview & Confirmed Facts */}
          <div className="space-y-4">
            <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 aspect-square group">
              <img
                src={formData.image_url}
                alt={formData.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.src = 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800';
                }}
              />
              <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-slate-700 text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> AI Verified Facts
              </div>
            </div>

            {isEditing && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5 text-amber-400" /> Image URL
                </label>
                <input
                  type="text"
                  name="image_url"
                  value={formData.image_url}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:ring-1 focus:ring-amber-400 outline-none"
                />
              </div>
            )}

            {/* Extracted Confirmed Facts List */}
            <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Provenancer & Facts
              </h4>
              {Object.entries(facts).map(([key, val]) => {
                if (typeof val === 'object' && val !== null) {
                  return (
                    <div key={key} className="text-xs flex justify-between items-center py-1 border-b border-slate-800/60">
                      <span className="text-slate-400 capitalize">{key.replace('_', ' ')}:</span>
                      <div className="text-right">
                        <span className="text-slate-200 font-medium">{val.value || val.answer || JSON.stringify(val)}</span>
                        <span className="ml-1.5 text-[9px] bg-emerald-500/10 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">
                          {val.provenance || 'ARTISAN_CONFIRMED'}
                        </span>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={key} className="text-xs flex justify-between items-center py-1 border-b border-slate-800/60">
                    <span className="text-slate-400 capitalize">{key.replace('_', ' ')}:</span>
                    <span className="text-slate-200 font-medium">{String(val)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Title, Craft Story, Prose, Price */}
          <div className="lg:col-span-2 space-y-4">
            {/* Product Name */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Product Title</label>
              {isEditing ? (
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-semibold focus:ring-1 focus:ring-amber-400 outline-none"
                  required
                />
              ) : (
                <h2 className="text-xl font-bold text-slate-100">{formData.name}</h2>
              )}
            </div>

            {/* Price & Category Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Listing Price (₹)</label>
                {isEditing ? (
                  <div className="relative">
                    <IndianRupee className="w-4 h-4 text-amber-400 absolute left-3 top-2.5" />
                    <input
                      type="number"
                      name="price"
                      min="1"
                      step="1"
                      value={formData.price}
                      onChange={handleChange}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-amber-300 font-bold focus:ring-1 focus:ring-amber-400 outline-none"
                      required
                    />
                  </div>
                ) : (
                  <div className="text-2xl font-extrabold text-amber-400 flex items-center">
                    <IndianRupee className="w-5 h-5 text-amber-400" />
                    {Number(formData.price).toLocaleString('en-IN')}
                    {formData.price !== recPrice && (
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        (Custom Override)
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Category</label>
                {isEditing ? (
                  <input
                    type="text"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:ring-1 focus:ring-amber-400 outline-none"
                  />
                ) : (
                  <span className="inline-block bg-slate-800 text-amber-300 text-xs px-3 py-1.5 rounded-lg border border-slate-700 font-medium">
                    {formData.category}
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Product Description</label>
              {isEditing ? (
                <textarea
                  name="description"
                  rows={4}
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 focus:ring-1 focus:ring-amber-400 outline-none leading-relaxed"
                />
              ) : (
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/50 p-3 rounded-xl border border-slate-800 whitespace-pre-line">
                  {formData.description}
                </p>
              )}
            </div>

            {/* Craft Story */}
            <div>
              <label className="block text-xs font-medium text-amber-300 mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Cultural & Craft Story
              </label>
              {isEditing ? (
                <textarea
                  name="craft_story"
                  rows={3}
                  value={formData.craft_story}
                  onChange={handleChange}
                  className="w-full bg-amber-950/20 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-200 focus:ring-1 focus:ring-amber-400 outline-none leading-relaxed"
                />
              ) : (
                <div className="bg-gradient-to-r from-amber-950/30 via-purple-950/20 to-amber-950/30 p-3 rounded-xl border border-amber-500/30 text-xs text-amber-200/90 leading-relaxed">
                  {formData.craft_story || 'No craft story generated.'}
                </div>
              )}
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-slate-400" /> Marketplace Tags
              </label>
              {isEditing ? (
                <input
                  type="text"
                  name="tags"
                  value={formData.tags}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:ring-1 focus:ring-amber-400 outline-none"
                  placeholder="Handmade, Wooden, Traditional"
                />
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {(typeof formData.tags === 'string' ? formData.tags.split(',') : formData.tags).map((t, idx) => (
                    <span key={idx} className="bg-slate-800 text-slate-300 text-[11px] px-2.5 py-0.5 rounded-full border border-slate-700">
                      #{t.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            disabled={loading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dynamic Pricing
          </button>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all transform active:scale-95"
          >
            {loading ? (
              <span>Publishing Product...</span>
            ) : (
              <>
                <Send className="w-4 h-4" /> Publish Product to Marketplace
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
