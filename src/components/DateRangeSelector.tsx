import React from 'react';

interface DateRangeSelectorProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  isLoading?: boolean;
}

const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  isLoading = false,
}) => {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-300 font-medium">Du</label>
      <input
        type="date"
        value={startDate}
        onChange={(e) => onStartDateChange(e.target.value)}
        disabled={isLoading}
        aria-label="Date de début"
        className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-200
                   focus:border-orange-500 focus:outline-none focus:ring-2
                   focus:ring-orange-500/30 transition-colors
                   disabled:cursor-not-allowed disabled:opacity-50"
      />
      <label className="text-sm text-gray-300 font-medium">au</label>
      <input
        type="date"
        value={endDate}
        onChange={(e) => onEndDateChange(e.target.value)}
        disabled={isLoading}
        aria-label="Date de fin"
        className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-200
                   focus:border-orange-500 focus:outline-none focus:ring-2
                   focus:ring-orange-500/30 transition-colors
                   disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
};

export default DateRangeSelector;
