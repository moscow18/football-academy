import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { Branch } from '../lib/types';

const STORAGE_KEY = 'vfc_selected_branch';

interface BranchState {
  branches: Branch[];
  selectedBranchId: string | null; // null = "all branches"
  selectedBranch: Branch | null;
  setBranchId: (id: string | null) => void;
  loading: boolean;
  /** Get the effective branch filter for queries — returns branch_id or undefined for all */
  branchFilter: string | undefined;
}

const BranchContext = createContext<BranchState | undefined>(undefined);

function getSavedBranch(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function saveBranch(id: string | null) {
  try {
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch { /* ignore */ }
}

export function BranchProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  // For admin/coach: locked to their branch. For owner: from localStorage.
  const isOwner = profile?.role === 'owner';
  const lockedBranchId = !isOwner ? profile?.branch_id : null;

  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(
    lockedBranchId || getSavedBranch() || null
  );

  // Fetch branches
  useEffect(() => {
    async function loadBranches() {
      const { data } = await supabase
        .from('branches')
        .select('*')
        .order('created_at', { ascending: true });
      setBranches(data || []);
      setLoading(false);
    }
    if (profile) {
      loadBranches();
    }
  }, [profile]);

  // Sync with profile changes (lock for admin/coach)
  useEffect(() => {
    if (lockedBranchId) {
      setSelectedBranchIdState(lockedBranchId);
    }
  }, [lockedBranchId]);

  const setBranchId = useCallback((id: string | null) => {
    if (!isOwner) return; // admin/coach can't switch
    setSelectedBranchIdState(id);
    saveBranch(id);
  }, [isOwner]);

  const selectedBranch = branches.find(b => b.id === selectedBranchId) || null;
  const branchFilter = lockedBranchId || selectedBranchId || undefined;

  return (
    <BranchContext.Provider value={{
      branches,
      selectedBranchId: lockedBranchId || selectedBranchId,
      selectedBranch,
      setBranchId,
      loading,
      branchFilter,
    }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranch must be used within BranchProvider');
  return ctx;
}
