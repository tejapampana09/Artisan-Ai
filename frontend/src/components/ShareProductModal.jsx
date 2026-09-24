import React, { useState } from 'react';
import { X, Check, Copy, Share2, MessageCircle, Globe, Sparkles, ExternalLink } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';

function InstagramIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
    </svg>
  );
}

export default function ShareProductModal({ product, isOpen, onClose }) {
  const notify = useNotification();
  const [copied, setCopied] = useState(false);
  const [captionCopied, setCaptionCopied] = useState(false);

  if (!isOpen || !product) return null;

  // Build clean canonical product URL
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://artisanai.in';
  const shareUrl = `${origin}/#craft-${product.id}`;

  const artisanName = product.artisan_name || product.seller?.name || 'an Indian Master Artisan';
  const priceStr = `₹${Number(product.price).toLocaleString('en-IN')}`;

  // Pre-formatted WhatsApp message
  const whatsappMessage = `✨ *Discover Authentic Handcrafted Heritage* ✨\n\n` +
    `Check out this stunning *${product.title}* created by *${artisanName}*!\n\n` +
    `🏷️ *Price:* ${priceStr}\n` +
    `📍 *Category:* ${product.category || 'Traditional Crafts'}\n` +
    `🇮🇳 *100% Authentic Indian Artisan Creation*\n\n` +
    `👉 View craft details & support the artisan directly:\n${shareUrl}`;

  // Pre-formatted Instagram / Social Caption
  const instagramCaption = `Supporting genuine Indian artisans! Look at this gorgeous ${product.title} handcrafted by ${artisanName} (${priceStr}).\n\n` +
    `Explore & buy directly on Artisan AI:\n${shareUrl}\n\n` +
    `#ArtisanAI #HandcraftedInIndia #VocalForLocal #IndianCrafts #${(product.category || 'Handicrafts').replace(/\s+/g, '')}`;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const input = document.createElement('input');
        input.value = shareUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      notify.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      notify.error('Unable to copy link to clipboard');
    }
  };

  const handleCopyCaption = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(instagramCaption);
      }
      setCaptionCopied(true);
      notify.success('Caption & link copied for Instagram!');
      setTimeout(() => setCaptionCopied(false), 2500);
    } catch {
      notify.error('Unable to copy caption');
    }
  };

  const handleWhatsAppShare = () => {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    notify.info('Opening WhatsApp...');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${product.title} by ${artisanName}`,
          text: `Check out this authentic handmade ${product.title} on Artisan AI!`,
          url: shareUrl,
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="bg-[#FAF7F2] w-full max-w-md rounded-2xl shadow-2xl border border-[#E8E2D9] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E8E2D9] flex items-center justify-between bg-white">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-[#933D1E]/10 flex items-center justify-center text-[#933D1E]">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#2A1E17]">Share Handcrafted Heritage</h3>
              <p className="text-[11px] text-[#6B5B51]">Help this artisan reach more patrons across India</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-stone-100 text-stone-500 hover:text-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Product Preview Card */}
        <div className="p-4 bg-stone-50/50 border-b border-[#E8E2D9]">
          <div className="flex items-center space-x-3 bg-white p-2.5 rounded-xl border border-[#E8E2D9] shadow-xs">
            <img
              src={product.image_url || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=300'}
              alt={product.title}
              className="w-14 h-14 rounded-lg object-cover border border-[#E8E2D9] shrink-0"
            />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold text-[#933D1E] uppercase tracking-wider block">
                {artisanName}
              </span>
              <h4 className="text-xs font-bold text-[#2A1E17] truncate">{product.title}</h4>
              <div className="flex items-center space-x-2 mt-0.5">
                <span className="text-xs font-extrabold text-[#2A1E17]">{priceStr}</span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">
                  {product.category}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Share Channels */}
        <div className="p-5 space-y-3.5">
          {/* WhatsApp Direct Share */}
          <button
            onClick={handleWhatsAppShare}
            className="w-full py-3 px-4 bg-[#25D366] hover:bg-[#20BD5A] text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-between transition-all cursor-pointer group active:scale-[0.99]"
          >
            <div className="flex items-center space-x-3">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 fill-current" />
              </div>
              <div className="text-left">
                <div className="font-bold">Share on WhatsApp</div>
                <div className="text-[10px] text-white/80 font-normal">Send product details directly to family & friends</div>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-white/80 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Instagram / Story Caption Copy */}
          <button
            onClick={handleCopyCaption}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-between transition-all cursor-pointer active:scale-[0.99]"
          >
            <div className="flex items-center space-x-3">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                <InstagramIcon className="w-4 h-4" />
              </div>

              <div className="text-left">
                <div className="font-bold">{captionCopied ? 'Caption Copied!' : 'Copy Instagram Story / Post Caption'}</div>
                <div className="text-[10px] text-white/80 font-normal">Pre-filled hashtags & story link for Instagram</div>
              </div>
            </div>
            {captionCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-white/80" />}
          </button>

          {/* Native Share (Mobile) */}
          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
            <button
              onClick={handleNativeShare}
              className="w-full py-2.5 px-4 bg-white hover:bg-stone-100 text-[#2A1E17] font-semibold text-xs rounded-xl border border-[#E8E2D9] flex items-center justify-center space-x-2 transition-colors cursor-pointer shadow-xs"
            >
              <Share2 className="w-3.5 h-3.5 text-[#933D1E]" />
              <span>More Sharing Options (System Dialog)</span>
            </button>
          )}

          {/* Direct Copy Link Input */}
          <div className="pt-2">
            <label className="text-[11px] font-semibold text-[#6B5B51] block mb-1">
              Direct Product Link
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-white border border-[#E8E2D9] rounded-xl px-3 py-2 text-xs text-[#2A1E17] font-mono truncate focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="px-3.5 py-2 bg-[#933D1E] hover:bg-[#7E3216] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center space-x-1 shrink-0 shadow-xs"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-white" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="px-5 py-3 bg-[#F4EBE1]/60 border-t border-[#E8E2D9] text-center">
          <p className="text-[11px] text-[#6B5B51] flex items-center justify-center space-x-1">
            <Sparkles className="w-3 h-3 text-[#933D1E]" />
            <span>Every share directly empowers rural craftspeople across India.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
