import React from 'react';
import { cn } from '../lib/utils';

export const Logo = ({ showText = false }: { showText?: boolean }) => (
  <div className={cn("flex items-center gap-3", showText ? "flex-row" : "flex-col")}>
    <div className="relative w-12 h-12 flex items-center justify-center">
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm overflow-visible">
        {/* Extra sketchy background lines */}
        <path d="M20,15 L25,10 M85,30 L90,35 M20,85 L25,90" stroke="currentColor" strokeWidth="1" className="text-[var(--border)]" />
        
        {/* Hand-drawn paper effect with more "sketchy" feel */}
        <path 
          d="M22,12 C25,10 62,11 65,12 L88,35 C89,38 88,82 87,85 C85,88 25,89 22,87 C20,85 21,15 22,12 Z" 
          fill="white" 
          stroke="currentColor" 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className="fill-white text-black dark:text-white"
        />
        
        {/* Sketchy double border effect */}
        <path 
          d="M24,14 C27,12 60,13 63,14 L86,37 C87,40 86,80 85,83 C83,86 27,87 24,85" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="1" 
          strokeLinecap="round" 
          className="text-[var(--border)]"
        />

        {/* Folded corner */}
        <path d="M65,12 L65,35 L88,35" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-black dark:text-white" />
        
        {/* Red Scribbles - more vibrant and sketchy */}
        <path d="M30,42 Q45,38 60,42 T75,40" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" className="opacity-80" />
        <path d="M32,52 Q42,48 55,52 T70,50" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" className="opacity-80" />
        <path d="M30,62 Q48,58 65,62 T72,60" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" className="opacity-80" />

        {/* Crumbs/Shavings */}
        <circle cx="82" cy="78" r="1.5" fill="currentColor" className="text-black dark:text-white" />
        <circle cx="88" cy="82" r="1" fill="currentColor" className="text-black dark:text-white" />
        <circle cx="78" cy="85" r="1.2" fill="currentColor" className="text-black dark:text-white" />

        {/* Eraser - tilted and detailed */}
        <g transform="translate(45, 55) rotate(-25)">
          {/* Blue part */}
          <path 
            d="M0,5 Q0,0 5,0 L20,0 L20,30 L5,30 Q0,30 0,25 Z" 
            fill="#3b82f6" 
            stroke="currentColor" 
            strokeWidth="2" 
            className="text-black dark:text-white"
          />
          {/* White part */}
          <path 
            d="M20,0 L35,0 Q40,0 40,5 L40,25 Q40,30 35,30 L20,30 Z" 
            fill="white" 
            stroke="currentColor" 
            strokeWidth="2" 
            className="text-black dark:text-white"
          />
          {/* Eraser texture lines */}
          <path d="M25,5 L25,25" stroke="currentColor" strokeWidth="1" opacity="0.2" className="text-black dark:text-white" />
          <path d="M30,5 L30,25" stroke="currentColor" strokeWidth="1" opacity="0.2" className="text-black dark:text-white" />
        </g>
      </svg>
    </div>
    {showText && (
      <span className="text-2xl font-hand tracking-wide text-black dark:text-white">Smart EDT</span>
    )}
  </div>
);
