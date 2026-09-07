import React, { useState } from 'react';
import { X, Sparkles, Check, AlertCircle } from 'lucide-react';

const CATEGORIES = [
  'Kalamkari',
  'Wooden Toys',
  'Blue Pottery',
  'Bidriware',
  'Pochampally Ikat',
  'Terracotta',
  'Handloom',
  'Other'
];

export default function CreateProductModal({ isOpen, onClose, onCreated }) {
  const [formData, setFormData] = useState({
    title: '',
    category: 'Kalamkari',
    description: '',
    craft_story: '',
    materials: '',
    price: '',
    stock: 1,
    material_cost: '',
    labour_cost: '',
    packaging_cost: '',
    min_margin_pct: 0.20,
    image_url: '',
    status: 'PUBLISHED'
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : parseFloat(value)) : value,
    }));
  };

  const mat = Number(formData.material_cost) || 0;
  const lab = Number(formData.labour_cost) || 0;
  const pkg = Number(formData.packaging_cost) || 0;
  const costBasis = mat + lab + pkg;
  const minFairPrice = costBasis > 0 ? Math.round(costBasis * (1 + (Number(formData.min_margin_pct) || 0.20))) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!formData.price || Number(formData.price) <= 0) {
      setError('A valid listing price is required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        ...formData,
        price: Number(formData.price),
        stock: Number(formData.stock) || 1,
        material_cost: mat,
        labour_cost: lab,
        packaging_cost: pkg,
        image_url: formData.image_url.trim() || null
      };
      await onCreated(payload);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create product');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 pb-20 sm:p-4 sm:pb-4">
      <div className="bg-white rounded-3xl max-w-xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Add New Artisan Craft</h3>
            <p className="text-xs text-slate-500">Record craft details, materials, and protected cost basis</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-1 my-3 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Craft Title *</label>
              <input
                type="text"
                name="title"
                required
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g. Hand-painted Kalamkari Dupatta"
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Craft Category</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              name="description"
              rows="2"
              value={formData.description}
              onChange={handleChange}
              placeholder="Brief details about the piece..."
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Craft Story & Tradition</label>
            <textarea
              name="craft_story"
              rows="2"
              value={formData.craft_story}
              onChange={handleChange}
              placeholder="The heritage story, techniques used, time invested..."
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Materials Used</label>
              <input
                type="text"
                name="materials"
                value={formData.materials}
                onChange={handleChange}
                placeholder="e.g. Pure Mulberry Silk, Natural Dyes"
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Stock Quantity</label>
              <input
                type="number"
                name="stock"
                min="0"
                value={formData.stock}
                onChange={handleChange}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Cost Basis Structure Box */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-amber-900">Protected Cost Basis</span>
              <span className="text-xs font-semibold text-amber-800">Min. Fair Price: ₹{minFairPrice}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] text-slate-600">Material (₹)</label>
                <input
                  type="number"
                  name="material_cost"
                  min="0"
                  placeholder="0"
                  value={formData.material_cost}
                  onChange={handleChange}
                  className="w-full text-xs border border-amber-200 rounded-lg px-2 py-1.5 bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600">Labour (₹)</label>
                <input
                  type="number"
                  name="labour_cost"
                  min="0"
                  placeholder="0"
                  value={formData.labour_cost}
                  onChange={handleChange}
                  className="w-full text-xs border border-amber-200 rounded-lg px-2 py-1.5 bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600">Packaging (₹)</label>
                <input
                  type="number"
                  name="packaging_cost"
                  min="0"
                  placeholder="0"
                  value={formData.packaging_cost}
                  onChange={handleChange}
                  className="w-full text-xs border border-amber-200 rounded-lg px-2 py-1.5 bg-white"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Listing Price (₹) *</label>
              <input
                type="number"
                name="price"
                min="0"
                required
                placeholder="e.g. 2400"
                value={formData.price}
                onChange={handleChange}
                className="w-full text-sm font-bold border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Image URL</label>
              <input
                type="text"
                name="image_url"
                placeholder="https://... (or leave blank)"
                value={formData.image_url}
                onChange={handleChange}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-600"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-sm transition-all disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Save & Publish Craft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
