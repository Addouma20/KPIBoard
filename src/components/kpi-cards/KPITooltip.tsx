import React from 'react';

interface KPITooltipProps {
  text: string;
  children: React.ReactNode;
}

const KPITooltip: React.FC<KPITooltipProps> = ({ text, children }) => (
  <span className="relative group inline-flex items-center gap-1 cursor-help">
    {children}
    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-500 text-[9px] font-bold leading-none">?</span>
    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-gray-800 text-white text-xs leading-relaxed whitespace-pre-line w-64 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-lg pointer-events-none">
      {text}
      <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
    </span>
  </span>
);

export default KPITooltip;
