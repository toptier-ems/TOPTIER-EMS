import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

const TZ = 'Asia/Manila'; // Philippine Standard Time (GMT+8)

function formatPST(date: Date): string {
  return date.toLocaleTimeString('en-PH', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatPSTDate(date: Date): string {
  return date.toLocaleDateString('en-PH', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' });
}

export default function TimeClock() {
  const [time, setTime] = useState(() => formatPST(new Date()));
  const [dateStr, setDateStr] = useState(() => formatPSTDate(new Date()));

  useEffect(() => {
    const t = setInterval(() => {
      const now = new Date();
      setTime(formatPST(now));
      setDateStr(formatPSTDate(now));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex items-center gap-2 text-sm text-gray-400">
      <Clock className="w-4 h-4" />
      <span title="Philippine Standard Time (GMT+8)">
        {dateStr} {time} PST
      </span>
    </div>
  );
}
