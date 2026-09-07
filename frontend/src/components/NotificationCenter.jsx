import React from 'react';
import { useNotification } from '../context/NotificationContext';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export default function NotificationCenter() {
  const { notifications, removeNotification } = useNotification();

  if (!notifications || notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col space-y-2 max-w-sm w-full px-4 pointer-events-none">
      {notifications.map((n) => {
        let bgClass = 'bg-slate-900 text-white border-slate-700';
        let Icon = Info;
        let iconColor = 'text-blue-400';

        if (n.type === 'success') {
          bgClass = 'bg-emerald-950/90 text-emerald-100 border-emerald-800/60';
          Icon = CheckCircle2;
          iconColor = 'text-emerald-400';
        } else if (n.type === 'error') {
          bgClass = 'bg-rose-950/90 text-rose-100 border-rose-800/60';
          Icon = AlertCircle;
          iconColor = 'text-rose-400';
        } else if (n.type === 'warning') {
          bgClass = 'bg-amber-950/90 text-amber-100 border-amber-800/60';
          Icon = AlertTriangle;
          iconColor = 'text-amber-400';
        }

        return (
          <div
            key={n.id}
            className={`pointer-events-auto p-3.5 rounded-xl border backdrop-blur-md shadow-xl flex items-start space-x-3 transition-all duration-300 transform translate-y-0 ${bgClass}`}
            role="alert"
          >
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} />
            <div className="flex-1 text-xs font-medium leading-relaxed break-words">
              {n.message}
            </div>
            <button
              onClick={() => removeNotification(n.id)}
              className="text-slate-400 hover:text-white p-0.5 rounded-lg transition-colors cursor-pointer"
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
