import React, { useState } from 'react';
import { X, Sparkles, Tag, ShieldCheck, Edit3, Save, Trash2 } from 'lucide-react';

export default function ProductDetailModal({ product, isOpen, onClose, onUpdated, onDelete }) {
  if (!isOpen || !product) return null;

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    title: product.title,
    price: product.price,
    stock: product.stock,
    description: product.description || '',
    craft_story: product.craft_story || '',
    materials: product.materials || '',
    material_cost: product.material_cost,
    labour_cost: product.labour_cost,
    packaging_cost: product.packaging_cost,
  });
  const [saving, setSaving] = useState(false);

  const costBasis = (formData.material_cost || 0) + (formData.labour_cost || 0) + (formData.packaging_cost || 0);
  const minFairPrice = Math.round(costBasis * (1 + (product.min_margin_pct || 0.20)));

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdated(product.id, formData);
      setIsEditing(false);
    } catch (err) {
      alert('Error updating product: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex justify-between items-start pb-4 border-b border-slate-100">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              {product.category}
            </span>
            <h3 className="text-lg font-bold text-slate-900 mt-1">{product.title}</h3>
          </div>
          <div className="flex items-center space-x-2">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center space-x-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center space-x-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save'}</span>
              </button>
            )}
            <button
              onClick={() => {
                if (confirm('Are you sure you want to delete this craft?')) {
                  onDelete(product.id);
                  onClose();
                }
              }}
              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
              title="Delete Craft"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Image & Price Banner */}
          <div>
            <img
              src={product.image_url || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop&q=80'}
              alt={product.title}
              className="w-full h-56 rounded-xl object-cover border border-slate-200 shadow-xs"
            />
            <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Stock Available:</span>
                {isEditing ? (
                  <input
                    type="number"
                    name="stock"
                    value={formData.stock}
                    onChange={handleChange}
                    className="w-20 border rounded px-1 text-right text-xs"
                  />
                ) : (
                  <strong className="text-slate-800">{product.stock} units</strong>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Selling Price:</span>
                {isEditing ? (
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    className="w-20 border rounded px-1 text-right text-xs font-bold text-amber-700"
                  />
                ) : (
                  <strong className="text-amber-700 font-bold">₹{product.price.toLocaleString('en-IN')}</strong>
                )}
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Min Fair Price:</span>
                <strong>₹{minFairPrice.toLocaleString('en-IN')}</strong>
              </div>
            </div>
          </div>

          {/* Details & Story */}
          <div className="space-y-3 text-xs">
            <div>
              <span className="font-semibold text-slate-700 block mb-1">Description</span>
              {isEditing ? (
                <textarea
                  name="description"
                  rows="2"
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full border rounded-lg p-2 text-xs"
                />
              ) : (
                <p className="text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {product.description || 'No description entered.'}
                </p>
              )}
            </div>

            <div>
              <span className="font-semibold text-slate-700 block mb-1">Heritage & Craft Story</span>
              {isEditing ? (
                <textarea
                  name="craft_story"
                  rows="3"
                  value={formData.craft_story}
                  onChange={handleChange}
                  className="w-full border rounded-lg p-2 text-xs"
                />
              ) : (
                <p className="text-slate-600 bg-amber-50/50 p-2.5 rounded-lg border border-amber-100 leading-relaxed italic">
                  "{product.craft_story || 'No craft story attached.'}"
                </p>
              )}
            </div>

            <div>
              <span className="font-semibold text-slate-700 block mb-1">Materials</span>
              {isEditing ? (
                <input
                  type="text"
                  name="materials"
                  value={formData.materials}
                  onChange={handleChange}
                  className="w-full border rounded-lg p-2 text-xs"
                />
              ) : (
                <p className="text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  {product.materials || 'Traditional artisan materials'}
                </p>
              )}
            </div>

            {/* Cost Breakdown */}
            <div className="bg-slate-100 p-2.5 rounded-xl text-[11px] text-slate-600 space-y-1">
              <div className="font-bold text-slate-800 flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Deterministic Cost Basis:</span>
              </div>
              <div className="grid grid-cols-3 gap-1 pt-1 text-center">
                <div className="bg-white p-1 rounded border border-slate-200">
                  <span className="block text-[10px] text-slate-400">Material</span>
                  <span className="font-semibold">₹{product.material_cost}</span>
                </div>
                <div className="bg-white p-1 rounded border border-slate-200">
                  <span className="block text-[10px] text-slate-400">Labour</span>
                  <span className="font-semibold">₹{product.labour_cost}</span>
                </div>
                <div className="bg-white p-1 rounded border border-slate-200">
                  <span className="block text-[10px] text-slate-400">Packaging</span>
                  <span className="font-semibold">₹{product.packaging_cost}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
