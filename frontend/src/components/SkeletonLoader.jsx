import React from 'react';

/**
 * Shimmer animation classes for realistic, premium skeleton loading
 */
export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-[#E8E2D9] overflow-hidden shadow-xs flex flex-col justify-between animate-pulse">
      <div>
        {/* Image Box (Aspect 4:5) */}
        <div className="relative aspect-[4/5] bg-gradient-to-br from-stone-200 via-stone-100 to-stone-200 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
          {/* Wishlist & Tag placeholders */}
          <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-stone-300/70" />
          <div className="absolute bottom-2 left-2 w-16 h-4 rounded bg-stone-300/80" />
        </div>

        {/* Text & Meta Skeleton */}
        <div className="p-3 space-y-2">
          {/* Artisan Subtitle */}
          <div className="h-2.5 bg-stone-200 rounded w-1/2" />
          {/* Product Title */}
          <div className="h-3.5 bg-stone-200 rounded w-4/5" />

          {/* Price & Stock Badge */}
          <div className="flex items-center justify-between pt-1">
            <div className="h-4 bg-stone-300 rounded w-14" />
            <div className="h-3.5 bg-stone-200 rounded w-16" />
          </div>

          <div className="h-2 bg-stone-100 rounded w-3/4 pt-0.5" />
        </div>
      </div>

      {/* Button Skeleton */}
      <div className="p-3 pt-0">
        <div className="w-full h-8 bg-stone-200 rounded-lg" />
      </div>
    </div>
  );
}

export function TrendingCardSkeleton() {
  return (
    <div className="bg-white p-2.5 rounded-xl border border-[#E8E2D9] shadow-xs animate-pulse space-y-2 shrink-0 w-36 sm:w-44">
      <div className="relative rounded-lg overflow-hidden h-28 bg-stone-200">
        <div className="absolute top-1.5 left-1.5 w-8 h-3.5 rounded bg-stone-300" />
      </div>
      <div className="h-3 bg-stone-200 rounded w-3/4" />
      <div className="flex justify-between items-center">
        <div className="h-3 bg-stone-300 rounded w-10" />
        <div className="h-2 bg-stone-200 rounded w-12" />
      </div>
    </div>
  );
}

export function WishlistCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-[#E8E2D9] p-4 shadow-xs animate-pulse space-y-4 flex flex-col justify-between">
      <div className="space-y-3">
        {/* 4:3 Image */}
        <div className="aspect-4/3 rounded-xl overflow-hidden bg-stone-200 relative">
          <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-stone-300" />
        </div>
        {/* Title & Artisan */}
        <div className="h-3 bg-stone-200 rounded w-1/3" />
        <div className="h-4 bg-stone-300 rounded w-3/4" />
        {/* Price & Badge */}
        <div className="flex items-center justify-between pt-2">
          <div className="h-5 bg-stone-300 rounded w-20" />
          <div className="h-4 bg-stone-200 rounded w-16" />
        </div>
      </div>
      {/* Actions */}
      <div className="pt-2 border-t border-stone-100 flex gap-2">
        <div className="h-9 bg-stone-200 rounded-xl flex-1" />
        <div className="h-9 bg-stone-200 rounded-xl w-10" />
      </div>
    </div>
  );
}

export function ProductListRowSkeleton() {
  return (
    <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-pulse">
      <div className="flex items-center space-x-4">
        <div className="w-16 h-16 rounded-xl bg-stone-200 shrink-0" />
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <div className="h-3.5 bg-stone-300 rounded w-36" />
            <div className="h-3 bg-stone-200 rounded w-16" />
          </div>
          <div className="h-2.5 bg-stone-100 rounded w-60" />
          <div className="h-2.5 bg-stone-200 rounded w-40" />
        </div>
      </div>
      <div className="flex space-x-2 self-end sm:self-center">
        <div className="w-8 h-8 bg-stone-200 rounded-lg" />
        <div className="w-8 h-8 bg-stone-200 rounded-lg" />
      </div>
    </div>
  );
}
