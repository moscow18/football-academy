import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { Branch } from '../lib/types';

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

export function BranchProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  // For admin/coach: locked to their branch. For owner: from URL param.
  const isOwner = profile?.role === 'owner';
  const lockedBranchId = !isOwner ? profile?.branch_id : null;

  const urlBranch = searchParams.get('branch');
  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(
    lockedBranchId || urlBranch || null
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

  // Sync URL param for owner
  useEffect(() => {
    if (isOwner && urlBranch !== selectedBranchId) {
      setSelectedBranchIdState(urlBranch || null);
    }
  }, [urlBranch, isOwner, selectedBranchId]);

  const setBranchId = useCallback((id: string | null) => {
    if (!isOwner) return; // admin/coach can't switch
    setSelectedBranchIdState(id);
    const newParams = new URLSearchParams(searchParams);
    if (id) {
      newParams.set('branch', id);
    } else {
      newParams.delete('branch');
    }
    setSearchParams(newParams, { replace: true });
  }, [isOwner, searchParams, setSearchParams]);

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
