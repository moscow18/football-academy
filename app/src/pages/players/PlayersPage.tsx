import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useBranch } from '../../contexts/BranchContext';
import { useToast } from '../../contexts/ToastContext';
import { formatMoney, formatMonth, formatDate, buildWhatsAppLink } from '../../lib/utils';
import { Search, Plus, Download, Edit2, Trash2, Users } from 'lucide-react';
import { PageLoading, EmptyState } from '../../components/ui/LoadingSpinner';
import Modal from '../../components/ui/Modal';
import ConfirmModal from '../../components/ui/ConfirmModal';
import type { Player, Group } from '../../lib/types';
import { useRealtimeRefresh } from '../../lib/useRealtimeRefresh';
import * as XLSX from 'xlsx';

const PAGE_SIZE = 50;

export default function PlayersPage() {
  const navigate = useNavigate();
  const { branchFilter, branches } = useBranch();
  const { toast } = useToast();

  const [players, setPlayers] = useState<Player[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterBirthYear, setFilterBirthYear] = useState('');
  const [filterPaymentType, setFilterPaymentType] = useState('');

  const queryIdRef = useRef(0);

  // Modal & Delete State
  const [showForm, setShowForm] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<any>(null);
  const [playerToDelete, setPlayerToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Bulk Selection & Delete
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [bulkGroup, setBulkGroup] = useState('');
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [form, setForm] = useState<{
    full_name: string; phone: string; parent_phone: string; date_of_birth: string;
    group_id: string; branch_id: string;
    fee_amount: string; fee_amount_periodic: string; notes: string; status: 'active' | 'inactive' | 'suspended';
    payment_type: string; photo_url: string; birth_year: string; registration_date: string;
  }>({
    full_name: '', phone: '', parent_phone: '', date_of_birth: '',
    group_id: '', branch_id: '',
    fee_amount: '', fee_amount_periodic: '', notes: '', status: 'active',
    payment_type: 'monthly', photo_url: '', birth_year: '2009',
    registration_date: new Date().toISOString().split('T')[0],
  });

  const loadGroups = useCallback(async () => {
    let q = supabase.from('groups').select('*');
    if (branchFilter) q = q.eq('branch_id', branchFilter);
    const { data } = await q.order('name');
    setGroups(data || []);
  }, [branchFilter]);

  const loadPlayers = useCallback(async () => {
    const queryId = ++queryIdRef.current;
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let q = supabase
      .from('players')
      .select('*, groups(name), branches(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (branchFilter) q = q.eq('branch_id', branchFilter);
    if (debouncedSearch) q = q.or(`full_name.ilike.%${debouncedSearch}%,player_code.ilike.%${debouncedSearch}%`);
    if (filterGroup) q = q.eq('group_id', filterGroup);
    if (filterStatus) q = q.eq('status', filterStatus);
    if (filterPaymentType) q = q.eq('payment_type', filterPaymentType);
    if (filterBirthYear) {
      q = q.gte('date_of_birth', `${filterBirthYear}-01-01`).lte('date_of_birth', `${filterBirthYear}-12-31`);
    }

    const { data, count, error } = await q;

    if (queryId !== queryIdRef.current) return;

    if (error) {
      toast('error', `خطأ في تحميل اللاعبين: ${error.message || ''}`);
      console.error('Supabase error loading players:', error);
    } else {
      const mapped = (data || []).map((p: Record<string, unknown>) => ({
        ...p,
        group_name: (p.groups as Record<string, string>)?.name,
        branch_name: (p.branches as Record<string, string>)?.name,
      })) as Player[];
      setPlayers(mapped);
      setTotal(count || 0);
    }
    setLoading(false);
    setInitialLoading(false);
  }, [page, branchFilter, debouncedSearch, filterGroup, filterStatus, filterPaymentType, filterBirthYear, toast]);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { loadPlayers(); }, [loadPlayers]);

  // ⚡ Realtime: auto-refresh when players change
  useRealtimeRefresh(['players'], loadPlayers);

  useEffect(() => { 
    setPage(0); 
    setSelectedPlayers([]); 
  }, [debouncedSearch, filterGroup, filterStatus, filterPaymentType, filterBirthYear, branchFilter]);

  function togglePlayerSelection(id: string) {
    setSelectedPlayers(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  }

  function toggleSelectAll() {
    if (selectedPlayers.length === players.length) {
      setSelectedPlayers([]);
    } else {
      setSelectedPlayers(players.map(p => p.id));
    }
  }

  async function handleBulkAssignGroup() {
    if (!bulkGroup || selectedPlayers.length === 0) return;
    setIsBulkSaving(true);
    const { error } = await supabase.from('players').update({ group_id: bulkGroup }).in('id', selectedPlayers);
    setIsBulkSaving(false);
    
    if (error) {
      toast('error', 'حدث خطأ أثناء نقل اللاعبين');
      return;
    }
    
    toast('success', `تم نقل ${selectedPlayers.length} لاعب إلى المجموعة بنجاح`);
    setSelectedPlayers([]);
    setBulkGroup('');
    loadPlayers();
  }

  function openAddForm() {
    setEditingPlayer(null);
    setForm({
      full_name: '', phone: '', parent_phone: '', date_of_birth: '',
      group_id: '', branch_id: branchFilter || '',
      fee_amount: '', fee_amount_periodic: '', notes: '', status: 'active',
      payment_type: 'monthly', photo_url: '', birth_year: '2009',
      registration_date: new Date().toISOString().split('T')[0],
    });
    setShowForm(true);
  }

  function openEditForm(player: any) {
    setEditingPlayer(player);
    setForm({
      full_name: player.full_name,
      phone: player.phone || '',
      parent_phone: player.parent_phone || '',
      date_of_birth: player.date_of_birth || '',
      group_id: player.group_id || '',
      branch_id: player.branch_id,
      fee_amount: String(player.fee_amount || 0),
      fee_amount_periodic: String(player.fee_amount_periodic || 0),
      notes: player.notes || '',
      status: player.status,
      payment_type: player.payment_type || 'monthly',
      photo_url: player.photo_url || '',
      birth_year: player.date_of_birth ? player.date_of_birth.substring(0, 4) : '2009',
      registration_date: player.registration_date || new Date().toISOString().split('T')[0],
    });
    setShowForm(true);
  }

  async function savePlayer() {
    if (isSaving) return;
    if (!form.full_name || !form.branch_id) {
      toast('error', 'يرجى إدخال اسم اللاعب واختيار الفرع');
      return;
    }
    
    setIsSaving(true);
    try {
    // No password required for adding/editing players
    const dateOfBirth = form.date_of_birth || `${form.birth_year}-01-01`;

    const payload = {
      full_name: form.full_name,
      phone: form.phone || null,
      parent_phone: form.parent_phone || null,
      date_of_birth: dateOfBirth,
      group_id: form.group_id || null,
      branch_id: form.branch_id,
      fee_amount: Number(form.fee_amount) || 0,
      fee_amount_periodic: Number(form.fee_amount_periodic) || 0,
      notes: form.notes || null,
      status: form.status,
      payment_type: form.payment_type,
      photo_url: form.photo_url || null,
      registration_date: form.registration_date || new Date().toISOString().split('T')[0],
    };

    if (editingPlayer) {
      const { error } = await supabase.from('players').update(payload).eq('id', editingPlayer.id);
      if (error) { toast('error', 'خطأ في تحديث اللاعب'); return; }
      toast('success', 'تم تحديث بيانات اللاعب بنجاح');
    } else {
      const { data: insertedPlayer, error } = await supabase.from('players').insert(payload).select().single();
      if (error) { toast('error', 'خطأ في إضافة اللاعب: ' + error.message); return; }

      // ⚡ AUTO PAYMENT FOR NEW PLAYER BASED ON CLOSING DAY RULE
      const feeAmount = Number(payload.fee_amount || 0);
      if (feeAmount > 0 && insertedPlayer) {
        const regDateStr = payload.registration_date || new Date().toISOString().split('T')[0];
        const regDate = new Date(regDateStr);
        const regDay = regDate.getDate();
        let targetYear = regDate.getFullYear();
        let targetMonthNum = regDate.getMonth() + 1; // 1-indexed

        const targetBranch = branches.find(b => b.id === payload.branch_id);
        const closingDay = targetBranch?.closing_day || (targetBranch?.name?.includes('الثلاثي') ? 20 : 30);

        // If registered after closing day -> shift to next month
        if (regDay > closingDay) {
          targetMonthNum += 1;
          if (targetMonthNum > 12) {
            targetMonthNum = 1;
            targetYear += 1;
          }
        }

        const periodCovered = `${targetYear}-${String(targetMonthNum).padStart(2, '0')}`;

        await supabase.from('payments').insert({
          player_id: insertedPlayer.id,
          branch_id: insertedPlayer.branch_id,
          amount: feeAmount,
          payment_date: regDateStr,
          method: 'cash',
          period_covered: periodCovered,
          notes: `تسديد تلقائي لاشتراك بداية اللاعب لشهر ${formatMonth(periodCovered)}`,
        });

        toast('success', `تم إضافة اللاعب وتسجيل سداد شهر (${formatMonth(periodCovered)}) تلقائياً ✅`);
      } else {
        toast('success', 'تم إضافة اللاعب بنجاح');
      }
    }
    } finally {
      setIsSaving(false);
    }
    setShowForm(false);
    loadPlayers();
  }

  async function confirmDeleteSinglePlayer() {
    if (!playerToDelete) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('players').delete().eq('id', playerToDelete.id);
      if (error) { toast('error', `خطأ في حذف اللاعب: ${error.message}`); return; }
      toast('success', `تم حذف اللاعب "${playerToDelete.name}" وجميع بياناته بنجاح`);
      setPlayerToDelete(null);
      loadPlayers();
    } finally {
      setIsDeleting(false);
    }
  }

  async function confirmBulkDelete() {
    if (selectedPlayers.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const { error } = await supabase.from('players').delete().in('id', selectedPlayers);
      if (error) { toast('error', `خطأ أثناء حذف اللاعبين المحددين: ${error.message}`); return; }
      toast('success', `تم حذف ${selectedPlayers.length} لاعب بنجاح`);
      setSelectedPlayers([]);
      setShowBulkDeleteConfirm(false);
      loadPlayers();
    } finally {
      setIsBulkDeleting(false);
    }
  }


  function exportExcel() {
    const wsData = players.map(p => ({
      'الكود': p.player_code,
      'الاسم': p.full_name,
      'الهاتف': p.phone || '',
      'هاتف ولي الأمر': p.parent_phone || '',
      'المجموعة': p.group_name || '',
      'الحالة': p.status === 'active' ? 'نشط' : p.status === 'inactive' ? 'غير نشط' : 'موقوف',
      'الاشتراك الشهري': p.fee_amount,
      'الاشتراك الدوري': p.fee_amount_periodic || 0,
      'نوع الاشتراك': p.payment_type === 'quarterly' ? 'دوري' : 'شهري',
      'تاريخ التسجيل': p.registration_date,
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'اللاعبين');
    XLSX.writeFile(wb, `players_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast('success', 'تم تصدير الملف بنجاح');
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3 mb-5 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Search size={16} />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الكود..."
            className="input-field pl-10"
          />
        </div>
        <select
          value={filterGroup}
          onChange={(e) => setFilterGroup(e.target.value)}
          className="input-field w-auto min-w-[150px]"
        >
          <option value="">كل المجموعات</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="input-field w-auto min-w-[150px]"
        >
          <option value="">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="inactive">غير نشط</option>
          <option value="suspended">موقوف</option>
        </select>
        <select
          value={filterPaymentType}
          onChange={(e) => setFilterPaymentType(e.target.value)}
          className="input-field w-auto min-w-[150px]"
        >
          <option value="">كل أنواع الاشتراكات</option>
          <option value="monthly">اشتراك شهري</option>
          <option value="quarterly">لاعبين الدوري (دوري)</option>
        </select>
        <select
          value={filterBirthYear}
          onChange={(e) => setFilterBirthYear(e.target.value)}
          className="input-field w-auto min-w-[150px]"
        >
          <option value="">كل الفئات العمرية</option>
          {Array.from({ length: 14 }, (_, i) => 2009 + i).map(year => (
            <option key={year} value={year}>مواليد {year}</option>
          ))}
        </select>
        <button onClick={openAddForm} className="btn btn-primary shadow-sm">
          <Plus size={16} /> إضافة لاعب
        </button>
        <button onClick={exportExcel} className="btn btn-secondary shadow-sm">
          <Download size={16} /> تصدير Excel
        </button>
      </div>

      {/* Bulk Action Bar */}
      {selectedPlayers.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 flex flex-wrap items-center justify-between gap-3 animate-fade-in font-arabic">
          <div className="text-sm font-bold text-emerald-800">
            تم تحديد <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-md font-mono">{selectedPlayers.length}</span> لاعب
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer"
            >
              <Trash2 size={14} /> حذف اللاعبين المحددين
            </button>
            <button
              onClick={() => setSelectedPlayers([])}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              إلغاء التحديد
            </button>
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="text-sm text-slate-500 mb-3 font-medium font-arabic">
        إجمالي: <strong className="text-slate-900 font-tabular">{total.toLocaleString('en-US')}</strong> لاعب
        {totalPages > 1 && ` — صفحة ${(page + 1)} من ${totalPages}`}
      </div>

      {/* Table */}
      {initialLoading ? (
        <PageLoading />
      ) : (
        <div className={`transition-opacity duration-200 ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
          {players.length === 0 ? (
            <EmptyState icon={<Users size={48} />} title="لا يوجد لاعبين" subtitle="قم بتغيير فلاتر البحث أو أضف لاعبين جدد للبدء" />
          ) : (
            <div className="bg-white rounded-xl flex flex-col overflow-hidden shadow-sm border border-slate-200 relative">
              {loading && (
                <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px] flex items-center justify-center z-10">
                  <div className="w-8 h-8 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin"></div>
                </div>
              )}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-right">
                  <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="w-10 text-center">
                    <input 
                      type="checkbox" 
                      checked={players.length > 0 && selectedPlayers.length === players.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-4 text-slate-500 font-bold text-sm text-right font-arabic">الكود</th>
                  <th className="px-6 py-4 text-slate-500 font-bold text-sm font-arabic">الاسم</th>
                  <th className="px-6 py-4 text-slate-500 font-bold text-sm font-arabic">المجموعة</th>
                  {!branchFilter && <th className="px-6 py-4 text-slate-500 font-bold text-sm font-arabic">الفرع</th>}
                  <th className="px-6 py-4 text-slate-500 font-bold text-sm font-arabic">الهاتف</th>
                  <th className="px-6 py-4 text-slate-500 font-bold text-sm font-arabic">الحالة</th>
                  <th className="px-6 py-4 text-slate-500 font-bold text-sm font-arabic">الفئة</th>
                  <th className="px-6 py-4 text-slate-500 font-bold text-sm font-arabic">تاريخ التسجيل</th>
                  <th className="px-6 py-4 text-slate-500 font-bold text-sm text-left">الاشتراك</th>
                  <th className="px-6 py-4 text-slate-500 font-bold text-sm text-center font-arabic">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {players.map(p => (
                  <tr key={p.id} className={`transition-colors ${selectedPlayers.includes(p.id) ? 'bg-emerald-50/50' : 'hover:bg-slate-50'}`}>
                    <td className="text-center px-2">
                      <input 
                        type="checkbox" 
                        checked={selectedPlayers.includes(p.id)}
                        onChange={() => togglePlayerSelection(p.id)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-tabular font-medium text-sm">{p.player_code}</td>
                    <td className="px-6 py-4">
                      <Link to={`/players/${p.id}`} className="flex items-center gap-3">
                        {p.photo_url ? (
                          <img src={p.photo_url} alt={p.full_name} className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                            {p.full_name.charAt(0)}
                          </div>
                        )}
                        <span className="font-bold text-slate-800 font-arabic line-clamp-1 hover:text-emerald-700 transition-colors">{p.full_name}</span>
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-slate-200 font-arabic">
                        {p.group_name || '—'}
                      </span>
                    </td>
                    {!branchFilter && <td className="px-6 py-4 text-slate-500 text-sm font-medium">{p.branch_name || '—'}</td>}
                    <td className="px-6 py-4 font-tabular text-slate-600 text-sm">{p.phone || '—'}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold w-fit ${
                          p.status === 'active' ? 'bg-emerald-50 text-emerald-700' 
                          : p.status === 'suspended' ? 'bg-amber-50 text-amber-700' 
                          : 'bg-red-50 text-red-700'
                        }`}>
                          {p.status === 'active' ? 'نشط' : p.status === 'suspended' ? 'موقوف' : 'غير نشط'}
                        </span>
                        <span className="text-xs text-slate-500 font-bold font-arabic">
                          {p.payment_type === 'quarterly' ? 'دوري / سنوي' : 'شهري'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-tabular text-sm font-medium">
                      {p.date_of_birth ? `${new Date().getFullYear() - parseInt(p.date_of_birth.substring(0,4))} سنة (مواليد ${p.date_of_birth.substring(0,4)})` : '—'}
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-tabular text-sm font-medium">{formatDate(p.registration_date)}</td>
                    <td className="px-6 py-4 text-left font-arabic">
                      <div className="flex flex-col items-start gap-0.5">
                        {Number(p.fee_amount) > 0 && (
                          <div className="font-bold text-slate-800 font-tabular text-sm">
                            {formatMoney(p.fee_amount)} <span className="text-[10px] text-slate-400 font-medium font-arabic">شهري</span>
                          </div>
                        )}
                        {Number(p.fee_amount_periodic) > 0 && (
                          <div className="font-bold text-emerald-600 font-tabular text-sm">
                            {formatMoney(p.fee_amount_periodic)} <span className="text-[10px] text-emerald-400 font-medium font-arabic">دوري</span>
                          </div>
                        )}
                        {!(Number(p.fee_amount) > 0) && !(Number(p.fee_amount_periodic) > 0) && (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => {
                          const phone = p.parent_phone || p.phone;
                          if (!phone) { toast('error', 'لا يوجد رقم هاتف مسجل للاعب'); return; }
                          const msg = `مرحباً بك في أكاديمية VFC، نذكركم بموعد سداد الاشتراك للاعب ${p.full_name}.`;
                          window.open(buildWhatsAppLink(phone, msg), '_blank');
                        }} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="إرسال تذكير واتساب">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                        </button>
                        <button onClick={() => navigate('/payments')} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="تسديد الاشتراك">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                        </button>
                        <button onClick={() => openEditForm(p)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="تعديل">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => setPlayerToDelete({ id: p.id, name: p.full_name })} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="حذف نهائي">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="block md:hidden divide-y divide-slate-100">
            {players.map(p => (
              <div key={p.id} className={`p-4 flex flex-col gap-3 transition-colors ${selectedPlayers.includes(p.id) ? 'bg-emerald-50/50' : 'hover:bg-slate-50'}`}>
                {/* Top row: Checkbox, Photo, Name & Code */}
                <div className="flex items-start gap-3">
                  <input 
                    type="checkbox" 
                    checked={selectedPlayers.includes(p.id)}
                    onChange={() => togglePlayerSelection(p.id)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer mt-1"
                  />
                  <Link to={`/players/${p.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                    {p.photo_url ? (
                      <img src={p.photo_url} alt={p.full_name} className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold shrink-0 font-arabic">
                        {p.full_name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 font-arabic text-base truncate hover:text-emerald-700 transition-colors">{p.full_name}</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">{p.player_code}</div>
                    </div>
                  </Link>
                  {/* Actions buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => {
                      const phone = p.parent_phone || p.phone;
                      if (!phone) { toast('error', 'لا يوجد رقم هاتف مسجل للاعب'); return; }
                      const msg = `مرحباً بك في أكاديمية VFC، نذكركم بموعد سداد الاشتراك للاعب ${p.full_name}.`;
                      window.open(buildWhatsAppLink(phone, msg), '_blank');
                    }} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="إرسال تذكير واتساب">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                    </button>
                    <button onClick={() => navigate('/payments')} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="تسديد الاشتراك">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                    </button>
                    <button onClick={() => openEditForm(p)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="تعديل">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => setPlayerToDelete({ id: p.id, name: p.full_name })} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="حذف نهائي">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Middle row: Details */}
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 font-arabic pt-2 border-t border-slate-50">
                  <div>
                    <span className="text-slate-400 font-medium">المجموعة:</span>{' '}
                    <span className="font-bold text-slate-700">{p.group_name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">الهاتف:</span>{' '}
                    <span className="font-mono text-slate-700">{p.phone || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">السن / المواليد:</span>{' '}
                    <span className="font-bold text-slate-700">
                      {p.date_of_birth ? `${new Date().getFullYear() - parseInt(p.date_of_birth.substring(0,4))} سنة (مواليد ${p.date_of_birth.substring(0,4)})` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">تاريخ التسجيل:</span>{' '}
                    <span className="font-mono text-slate-700">{formatDate(p.registration_date)}</span>
                  </div>
                </div>

                {/* Bottom row: Status and Subscription Price */}
                <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      p.status === 'active' ? 'bg-emerald-50 text-emerald-700' 
                      : p.status === 'suspended' ? 'bg-amber-50 text-amber-700' 
                      : 'bg-red-50 text-red-700'
                    }`}>
                      {p.status === 'active' ? 'نشط' : p.status === 'suspended' ? 'موقوف' : 'غير نشط'}
                    </span>
                    <span className="text-xs text-slate-500 font-bold font-arabic">
                      {p.payment_type === 'quarterly' ? 'دوري / سنوي' : 'شهري'}
                    </span>
                  </div>
                  <div className="text-left font-arabic">
                    {Number(p.fee_amount) > 0 && (
                      <div className="font-bold text-slate-800 font-tabular text-sm">
                        {formatMoney(p.fee_amount)} <span className="text-[10px] text-slate-400 font-medium font-arabic">شهري</span>
                      </div>
                    )}
                    {Number(p.fee_amount_periodic) > 0 && (
                      <div className="font-bold text-emerald-600 font-tabular text-sm">
                        {formatMoney(p.fee_amount_periodic)} <span className="text-[10px] text-emerald-400 font-medium font-arabic">دوري</span>
                      </div>
                    )}
                    {!(Number(p.fee_amount) > 0) && !(Number(p.fee_amount_periodic) > 0) && (
                      <span className="text-slate-400">—</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 p-4 border-t border-slate-200">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="btn btn-secondary px-3 py-1.5"
              >
                السابق
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const startPage = Math.max(0, Math.min(page - 2, totalPages - 5));
                const pg = startPage + i;
                return (
                  <button
                    key={pg}
                    onClick={() => setPage(pg)}
                    className={`min-w-[36px] h-9 flex items-center justify-center rounded-md font-tabular font-semibold transition-colors cursor-pointer ${pg === page ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    {pg + 1}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="btn btn-secondary px-3 py-1.5"
              >
                التالي
              </button>
            </div>
          )}

          {/* Bulk Actions Floating Bar */}
          {selectedPlayers.length > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl z-50 flex items-center gap-6 animate-fade-in border border-slate-700">
              <div className="font-bold font-arabic">
                تم تحديد <span className="text-emerald-400 text-lg mx-1 tabular-nums">{selectedPlayers.length}</span> لاعب
              </div>
              <div className="flex items-center gap-2">
                <select 
                  value={bulkGroup} 
                  onChange={e => setBulkGroup(e.target.value)}
                  className="bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm font-arabic focus:border-emerald-500 outline-none"
                >
                  <option value="">-- نقل إلى مجموعة --</option>
                  {groups.filter(g => !branchFilter || g.branch_id === branchFilter).map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
                <button 
                  onClick={handleBulkAssignGroup}
                  disabled={!bulkGroup || isBulkSaving}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors cursor-pointer"
                >
                  {isBulkSaving ? 'جاري النقل...' : 'تأكيد النقل'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )}

      {/* Add/Edit Player Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingPlayer ? 'تعديل لاعب' : 'إضافة لاعب جديد'} size="lg" footer={
        <>
          <button onClick={savePlayer} disabled={isSaving} className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer">
            {isSaving ? 'جاري الحفظ...' : editingPlayer ? 'حفظ التعديلات' : 'إضافة اللاعب'}
          </button>
          <button onClick={() => setShowForm(false)} disabled={isSaving} className="px-5 py-2.5 border-2 border-slate-200 rounded-lg font-bold text-sm hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer">
            إلغاء
          </button>
        </>
      }>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="form-label">الاسم بالكامل *</label>
            <input value={form.full_name} onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))}
              className="input-field" placeholder="اسم اللاعب" />
          </div>
          <div>
            <label className="form-label">الفرع *</label>
            <select value={form.branch_id} onChange={(e) => setForm(f => ({ ...f, branch_id: e.target.value }))}
              className="input-field">
              <option value="">اختر الفرع</option>
              {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

              <div>
                <label className="form-label">نوع الاشتراك الحالي *</label>
                <select value={form.payment_type} onChange={(e) => setForm(f => ({ ...f, payment_type: e.target.value }))} className="input-field">
                  <option value="monthly">شهري</option>
                  <option value="quarterly">دوري / سنوي (كل 3 شهور)</option>
                </select>
              </div>
              <div>
                <label className="form-label">الاشتراك الشهري (ج.م)</label>
                <input type="number" value={form.fee_amount} onChange={(e) => setForm(f => ({ ...f, fee_amount: e.target.value }))}
                  className="input-field font-tabular" placeholder="مثال: 500" dir="ltr" />
              </div>
              <div>
                <label className="form-label">الاشتراك الدوري (ج.م)</label>
                <input type="number" value={form.fee_amount_periodic} onChange={(e) => setForm(f => ({ ...f, fee_amount_periodic: e.target.value }))}
                  className="input-field font-tabular" placeholder="مثال: 1200" dir="ltr" />
              </div>
          <div>
            <label className="form-label">رقم الهاتف</label>
            <input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
              className="input-field font-tabular" placeholder="01xxxxxxxxx" dir="ltr" />
          </div>
          <div>
            <label className="form-label">هاتف ولي الأمر</label>
            <input value={form.parent_phone} onChange={(e) => setForm(f => ({ ...f, parent_phone: e.target.value }))}
              className="input-field font-tabular" placeholder="01xxxxxxxxx" dir="ltr" />
          </div>
          <div>
            <label className="form-label">الفئة العمرية (سنة الميلاد) *</label>
            <select value={form.birth_year} onChange={(e) => setForm(f => ({ ...f, birth_year: e.target.value }))} className="input-field">
              {Array.from({ length: 14 }, (_, i) => 2009 + i).map(year => (
                <option key={year} value={year}>مواليد {year} (فئة U-{new Date().getFullYear() - year})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">تاريخ الميلاد (اختياري)</label>
            <input type="date" value={form.date_of_birth} onChange={(e) => setForm(f => ({ ...f, date_of_birth: e.target.value }))}
              className="input-field font-tabular" />
          </div>
          <div>
            <label className="form-label">تاريخ التسجيل والاشتراك *</label>
            <input type="date" value={form.registration_date} onChange={(e) => setForm(f => ({ ...f, registration_date: e.target.value }))}
              className="input-field font-tabular" />
          </div>
          <div>
            <label className="form-label">صورة اللاعب (من الجهاز)</label>
            <div className="flex items-center gap-3">
              {form.photo_url && (
                <img src={form.photo_url} alt="Preview" className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500" />
              )}
              <input 
                type="file" 
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setForm(f => ({ ...f, photo_url: reader.result as string }));
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                className="input-field p-1.5" 
              />
            </div>
          </div>
          <div>
            <label className="form-label">فريق التدريب / المجموعة (اختياري)</label>
            <select value={form.group_id} onChange={(e) => setForm(f => ({ ...f, group_id: e.target.value }))}
              className="input-field">
              <option value="">بدون فريق</option>
              {groups.filter(g => !form.branch_id || g.branch_id === form.branch_id).map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          {editingPlayer && (
            <div>
              <label className="form-label">الحالة</label>
              <select value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value as 'active' | 'inactive' | 'suspended' }))}
                className="input-field">
                <option value="active">نشط</option>
                <option value="inactive">غير نشط</option>
                <option value="suspended">موقوف</option>
              </select>
            </div>
          )}
          <div className="md:col-span-2">
            <label className="form-label">ملاحظات</label>
            <textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              className="input-field resize-none h-20" placeholder="ملاحظات إضافية..." />
          </div>
        </div>
      </Modal>

      {/* Confirm Single Delete Modal */}
      <ConfirmModal
        isOpen={!!playerToDelete}
        onClose={() => setPlayerToDelete(null)}
        onConfirm={confirmDeleteSinglePlayer}
        title="تأكيد حذف اللاعب نهائياً"
        message={`هل أنت متأكد من حذف اللاعب "${playerToDelete?.name}" تماماً من النظام؟\nسيؤدي هذا إلى حذف اللاعب وكوده وجميع سجلات الحضور والمدفوعات والفواتير المرتبطة به نهائياً.`}
        confirmText="نعم، احذف اللاعب"
        cancelText="إلغاء الإجراء"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Confirm Bulk Delete Modal */}
      <ConfirmModal
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        onConfirm={confirmBulkDelete}
        title="تأكيد الحذف الجماعي للاعبين"
        message={`هل أنت متأكد من حذف ${selectedPlayers.length} لاعب محدد تماماً من النظام؟\nسيتم حذف جميع سجلاتهم وحساباتهم نهائياً ولن يمكنك التراجع.`}
        confirmText={`نعم، احذف ${selectedPlayers.length} لاعب`}
        cancelText="إلغاء"
        variant="danger"
        isLoading={isBulkDeleting}
      />
    </div>
  );
}
