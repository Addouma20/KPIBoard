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
      <label className="text-sm text-gray-500">Du</label>
      <input
        type="date"
        value={startDate}
        onChange={(e) => onStartDateChange(e.target.value)}
        disabled={isLoading}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm
                   focus:border-blue-500 focus:outline-none focus:ring-2
                   focus:ring-blue-500/20 transition-colors
                   disabled:cursor-not-allowed disabled:opacity-50"
      />
      <label className="text-sm text-gray-500">au</label>
      <input
        type="date"
        value={endDate}
        onChange={(e) => onEndDateChange(e.target.value)}
        disabled={isLoading}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm
                   focus:border-blue-500 focus:outline-none focus:ring-2
                   focus:ring-blue-500/20 transition-colors
                   disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
};

export default DateRangeSelector;
