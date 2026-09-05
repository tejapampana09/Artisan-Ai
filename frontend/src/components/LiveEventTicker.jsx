import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, ChevronDown, ChevronUp, Database } from 'lucide-react';
import { getEvents } from '../api';

export default function LiveEventTicker({ refreshTrigger }) {
  const [events, setEvents] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchRecentEvents = async () => {
    setLoading(true);
    const data = await getEvents({ limit: 12 });
    setEvents(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchRecentEvents();
  }, [refreshTrigger]);

  const latestEvent = events[0];

  const getBadgeColor = (type) => {
    switch (type) {
      case 'SEARCH': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'VIEW': return 'bg-slate-100 text-slate-800 border-slate-200';
      case 'SAVE': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'ENQUIRY': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'ORDER': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden text-xs">
      <div className="p-3 bg-slate-900 text-slate-200 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Database className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="font-bold text-white text-xs">SQLite Event Store (Market Intelligence Stream)</span>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-mono">
            {events.length} recorded events
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={fetchRecentEvents}
            className="p-1 hover:text-white transition-colors"
            title="Refresh events"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:text-white transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Latest Event Banner */}
      {!isExpanded && latestEvent && (
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2 overflow-hidden">
            <span className="text-[10px] text-slate-400 font-mono">Latest:</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getBadgeColor(latestEvent.event_type)}`}>
              {latestEvent.event_type}
            </span>
            <span className="text-slate-700 truncate max-w-sm">
              {latestEvent.category ? `[${latestEvent.category}]` : ''} {latestEvent.query || latestEvent.metadata_info || `Product #${latestEvent.product_id}`}
            </span>
          </div>
          <span className="text-[10px] text-slate-400">
            {new Date(latestEvent.timestamp).toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* Expanded Live Event Drawer */}
      {isExpanded && (
        <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 p-2">
          {events.length === 0 ? (
            <p className="text-center py-4 text-slate-400">No events captured yet. Search or click a craft above!</p>
          ) : (
            events.map((e) => (
              <div key={e.id} className="py-1.5 px-2 flex items-center justify-between hover:bg-slate-50 rounded-lg">
                <div className="flex items-center space-x-2 overflow-hidden">
                  <span className="text-[10px] font-mono text-slate-400">#{e.id}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getBadgeColor(e.event_type)}`}>
                    {e.event_type}
                  </span>
                  <span className="text-slate-700 font-medium truncate max-w-xs">
                    {e.category && <strong className="text-slate-900 mr-1">[{e.category}]</strong>}
                    {e.query ? `"${e.query}"` : e.metadata_info || `Product ID: ${e.product_id}`}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono ml-2 shrink-0">
                  {new Date(e.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
