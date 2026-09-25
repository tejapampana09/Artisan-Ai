import React from 'react';
import { Store, Lock } from 'lucide-react';

export default function Footer({ onSelectMode, onOpenAuth, user }) {
  const handleNav = (mode) => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    onSelectMode(mode);
  };

  const handleSellerClick = () => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    if (user) {
      onSelectMode('SELL');
    } else {
      onOpenAuth('SELL_REGISTER');
    }
  };

  return (
    <footer className="hidden md:block mt-16 border-t border-[#E8E2D9] bg-[#FAF7F2] pt-12 pb-8 text-sm text-[#6B6B6B]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 pb-10 border-b border-[#E8E2D9]">
        {/* Brand & Slogan Column */}
        <div className="space-y-3">
          <div 
            onClick={() => handleNav('HOME')}
            className="flex items-center space-x-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-md bg-white border border-[#E8E2D9] p-1 flex items-center justify-center shrink-0">
              <img src="/artisan-logo.png" alt="Artisan AI Logo" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-lg tracking-tight text-[#1C1C1C] group-hover:text-[#A6533B] transition-colors">
              ARTISAN AI
            </span>
          </div>
          <p className="text-xs text-[#6B6B6B] leading-relaxed max-w-xs">
            From the best of Indian Creators directly to you. Direct fair-trade marketplace for authentic handloom & rural heritage crafts.
          </p>
        </div>

        {/* Shop & Orders Column */}
        <div className="space-y-2.5">
          <h4 className="font-bold text-[#1C1C1C] text-xs uppercase tracking-wider">Shop & Orders</h4>
          <ul className="space-y-2 text-xs">
            <li>
              <button onClick={() => handleNav('BUY')} className="hover:text-[#A6533B] transition-colors cursor-pointer">
                All Products
              </button>
            </li>
            <li>
              <button onClick={() => { window.scrollTo(0,0); onOpenAuth('ORDERS'); }} className="hover:text-[#A6533B] transition-colors cursor-pointer text-[#1C1C1C] font-bold">
                📦 My Orders
              </button>
            </li>
            <li>
              <button onClick={() => { window.scrollTo(0,0); onOpenAuth('WISHLIST'); }} className="hover:text-[#A6533B] transition-colors cursor-pointer text-[#1C1C1C] font-bold">
                ❤️ My Wishlist
              </button>
            </li>
            <li>
              <button onClick={() => handleNav('COLLECTIONS')} className="hover:text-[#A6533B] transition-colors cursor-pointer">
                Heritage Collections
              </button>
            </li>
            <li>
              <button onClick={() => handleNav('CRAFT_MAP')} className="hover:text-[#A6533B] transition-colors cursor-pointer font-bold text-[#A6533B]">
                🗺️ Interactive Craft Map
              </button>
            </li>
            <li>
              <button onClick={() => handleNav('STORY')} className="hover:text-[#A6533B] transition-colors cursor-pointer">
                Our Story & Artisans
              </button>
            </li>
          </ul>
        </div>

        {/* Support Column */}
        <div className="space-y-2.5">
          <h4 className="font-bold text-[#1C1C1C] text-xs uppercase tracking-wider">Support</h4>
          <ul className="space-y-2 text-xs">
            <li>
              <button 
                onClick={() => handleNav('CONTACT')} 
                className="hover:text-[#A6533B] transition-colors cursor-pointer text-left"
              >
                Contact Us & Help
              </button>
            </li>
            <li>
              <button 
                onClick={() => handleNav('TERMS')} 
                className="hover:text-[#A6533B] transition-colors cursor-pointer text-left"
              >
                Terms of Service
              </button>
            </li>
            <li>
              <button 
                onClick={() => handleNav('PRIVACY')} 
                className="hover:text-[#A6533B] transition-colors cursor-pointer text-left"
              >
                Privacy Policy
              </button>
            </li>
            <li>
              <button 
                onClick={() => handleNav('REFUND')} 
                className="hover:text-[#A6533B] transition-colors cursor-pointer text-left"
              >
                Cancellation & Refund
              </button>
            </li>
            <li>
              <button 
                onClick={() => handleNav('ADMIN')}
                className="hover:text-[#A6533B] transition-colors cursor-pointer text-[#1C1C1C] font-semibold"
              >
                🛡️ Admin Portal
              </button>
            </li>
          </ul>
        </div>

        {/* Partners Column */}
        <div className="space-y-2.5">
          <h4 className="font-bold text-[#1C1C1C] text-xs uppercase tracking-wider">Partners</h4>
          <ul className="space-y-2 text-xs">
            <li>
              <button 
                onClick={() => handleNav('BECOME_ARTISAN')}
                className="inline-flex items-center space-x-2 text-[#A6533B] font-bold hover:underline transition-all cursor-pointer"
              >
                <Store className="w-4 h-4" />
                <span>Become an Artisan / Onboarding</span>
              </button>
            </li>
            <li>
              <button 
                onClick={handleSellerClick}
                className="hover:text-[#A6533B] text-[#1C1C1C] font-medium transition-colors cursor-pointer text-left"
              >
                {user && (user.role === 'ARTISAN' || user.role === 'ADMIN') ? 'Open Seller Studio →' : 'Seller Studio Login →'}
              </button>
            </li>
            <li className="text-[#6B6B6B] text-[11px] leading-relaxed pt-1">
              Are you an Indian craftsman? Join Artisan AI to list your catalog with Voice AI in 5 regional languages.
            </li>
          </ul>
        </div>
      </div>

      {/* Copyright & 100% Secure Payments Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-4 text-center">
        <p className="text-xs text-[#6B6B6B]">
          © 2026 Artisan AI Marketplace. All rights reserved.
        </p>

        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-[#1C1C1C]">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span>100% SECURE PAYMENTS</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <span className="px-2.5 py-1 rounded bg-white border border-[#E8E2D9] text-[10px] font-bold text-[#1C1C1C]">VISA / Mastercard</span>
            <span className="px-2.5 py-1 rounded bg-white border border-[#E8E2D9] text-[10px] font-bold text-[#1C1C1C]">Net Banking</span>
            <span className="px-2.5 py-1 rounded bg-white border border-[#E8E2D9] text-[10px] font-bold text-[#1C1C1C]">UPI (GooglePay / PhonePe)</span>
            <span className="px-2.5 py-1 rounded bg-white border border-[#E8E2D9] text-[10px] font-bold text-[#A6533B]">Razorpay</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
