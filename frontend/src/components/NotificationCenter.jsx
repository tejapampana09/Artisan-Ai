import React from 'react';
import { useNotification } from '../context/NotificationContext';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export default function NotificationCenter() {
  const { notifications, removeNotification } = useNotification();

  if (!notifications || notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col space-y-2 max-w-sm w-full px-4 pointer-events-none">
      {notifications.map((n) => {
        let bgClass = 'bg-white text-[#171717] border-[#E7E7E2]';
        let Icon = Info;
        let iconColor = 'text-[#176B4D]';

        if (n.type === 'success') {
          bgClass = 'bg-emerald-50 text-emerald-950 border-emerald-200';
          Icon = CheckCircle2;
          iconColor = 'text-[#176B4D]';
        } else if (n.type === 'error') {
          bgClass = 'bg-red-50 text-red-950 border-red-200';
          Icon = AlertCircle;
          iconColor = 'text-red-600';
        } else if (n.type === 'warning') {
          bgClass = 'bg-amber-50 text-amber-950 border-amber-200';
          Icon = AlertTriangle;
          iconColor = 'text-amber-700';
        }

        return (
          <div
            key={n.id}
            className={`pointer-events-auto p-4 rounded-2xl border shadow-lg flex items-start space-x-3 transition-all duration-300 ${bgClass}`}
            role="alert"
          >
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} />
            <div className="flex-1 text-xs font-semibold leading-snug break-words">
              {n.message}
            </div>
            <button
              onClick={() => removeNotification(n.id)}
              className="text-[#666666] hover:text-[#171717] p-0.5 rounded-lg transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
