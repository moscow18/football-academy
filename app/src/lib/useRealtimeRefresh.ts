import { useEffect, useRef } from 'react';
import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Custom hook to subscribe to Supabase Realtime changes on specified tables.
 * When any INSERT, UPDATE, or DELETE happens on the given tables,
 * the provided callback is called to refresh data.
 * 
 * @param tables - Array of table names to subscribe to
 * @param callback - Function to call when changes are detected
 * @param enabled - Whether the subscription is active (default: true)
 */
export function useRealtimeRefresh(
  tables: string[],
  callback: () => void,
  enabled: boolean = true
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled || tables.length === 0) return;

    const channels: RealtimeChannel[] = [];

    for (const table of tables) {
      const channel = supabase
        .channel(`realtime-${table}-${Math.random().toString(36).slice(2)}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          () => {
            callbackRef.current();
          }
        )
        .subscribe();

      channels.push(channel);
    }

    return () => {
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  }, [tables.join(','), enabled]);
}
