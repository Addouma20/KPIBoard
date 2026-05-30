import React from 'react';

interface KPITooltipProps {
  /** Plain text (supports \n line breaks). Use `content` for rich React nodes. */
  text?: string;
  /** Rich React content — takes precedence over `text` */
  content?: React.ReactNode;
  children: React.ReactNode;
}

const KPITooltip: React.FC<KPITooltipProps> = ({ text, content, children }) => (
  <span className="relative group inline-flex items-center gap-1 cursor-help">
    {children}
    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-orange-100 text-orange-600 text-[9px] font-bold leading-none" aria-label="Aide">?</span>
    <span role="tooltip" className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2.5 rounded-xl bg-gray-900 text-white text-xs leading-relaxed w-80 max-w-xs opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-xl pointer-events-none">
      {content ?? <span className="whitespace-pre-line">{text}</span>}
      <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" aria-hidden="true" />
    </span>
  </span>
);

export default KPITooltip;
