import React from 'react';

export default function SplashScreen({ fadeOut = false }) {
  return (
    <div className={`fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center px-4 transition-opacity duration-1000 ease-out ${fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      <div className="flex flex-col items-center justify-center text-center space-y-4 max-w-sm w-full">
        {/* Brand Logo */}
        <div className="w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center">
          <img 
            src="/artisan-logo.png" 
            alt="Artisan AI Logo" 
            className="w-full h-full object-contain"
          />
        </div>

        {/* Brand Text */}
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Artisan <span className="text-amber-600">AI</span>
          </h1>
          <p className="text-xs font-semibold text-slate-500 tracking-widest uppercase">
            Rural Craft Commerce & Intelligence
          </p>
        </div>
      </div>
    </div>
  );
}
