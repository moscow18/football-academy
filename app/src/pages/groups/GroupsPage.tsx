import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useBranch } from '../../contexts/BranchContext';
import { useToast } from '../../contexts/ToastContext';
import { PageLoading, EmptyState } from '../../components/ui/LoadingSpinner';
import Modal from '../../components/ui/Modal';
import { Users, Edit2, Trash2, Clock, Search } from 'lucide-react';
import { BranchBadge } from '../../components/ui/Badge';

interface Group {
  id: string;
  name: string;
  coach_id: string | null;
  branch_id: string;
  schedule_days: string[];
  schedule_time: string | null;
  branch_name?: string;
  coach_name?: string;
}

const DAYS_OF_WEEK = [
  { id: 'saturday', name: 'السبت' },
  { id: 'sunday', name: 'الأحد' },
  { id: 'monday', name: 'الإثنين' },
  { id: 'tuesday', name: 'الثلاثاء' },
  { id: 'wednesday', name: 'الأربعاء' },
  { id: 'thursday', name: 'الخميس' },
  { id: 'friday', name: 'الجمعة' },
];

export default function GroupsPage() {
  const { branchFilter, branches } = useBranch();
  const { toast } = useToast();
  
  const [groups, setGroups] = useState<Group[]>([]);
  const [coaches, setCoaches] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [showForm, setShowForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  
  const [form, setForm] = useState({
    name: '',
    branch_id: '',
    coach_id: '',
    schedule_time: '',
    schedule_days: [] as string[]
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    
    // Load Groups
    let q = supabase
      .from('groups')
      .select('*, branches(name), users(full_name)');
      
    if (branchFilter) {
      q = q.eq('branch_id', branchFilter);
    }
    
    const { data: gData } = await q;
    
    const mappedGroups = (gData || []).map((g: any) => ({
      ...g,
      branch_name: g.branches?.name,
      coach_name: g.users?.full_name
    }));
    
    setGroups(mappedGroups);

    // Load Coaches for dropdown
    const { data: cData } = await supabase
      .from('users')
      .select('id, full_name, branch_id')
      .eq('role', 'coach');
      
    setCoaches(cData?.map(c => ({ id: c.id, name: c.full_name })) || []);
    setLoading(false);
  }, [branchFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  function openAddForm() {
    setEditingGroup(null);
    setForm({
      name: '',
      branch_id: branchFilter || (branches[0]?.id || ''),
      coach_id: '',
      schedule_time: '',
      schedule_days: []
    });
    setShowForm(true);
  }

  function openEditForm(g: Group) {
    setEditingGroup(g);
    setForm({
      name: g.name,
      branch_id: g.branch_id,
      coach_id: g.coach_id || '',
      schedule_time: g.schedule_time || '',
      schedule_days: g.schedule_days || []
    });
    setShowForm(true);
  }

  function toggleDay(dayId: string) {
    setForm(prev => {
      const days = prev.schedule_days.includes(dayId)
        ? prev.schedule_days.filter(d => d !== dayId)
        : [...prev.schedule_days, dayId];
      return { ...prev, schedule_days: days };
    });
  }

  async function saveGroup() {
    if (!form.name || !form.branch_id) {
      toast('error', 'يرجى إدخال اسم الفريق والفرع');
      return;
    }

    const payload = {
      name: form.name,
      branch_id: form.branch_id,
      coach_id: form.coach_id || null,
      schedule_time: form.schedule_time || null,
      schedule_days: form.schedule_days
    };

    if (editingGroup) {
      const { error } = await supabase.from('groups').update(payload).eq('id', editingGroup.id);
      if (error) { toast('error', 'حدث خطأ أثناء التحديث'); return; }
      toast('success', 'تم التحديث بنجاح');
    } else {
      const { error } = await supabase.from('groups').insert(payload);
      if (error) { toast('error', 'حدث خطأ أثناء الإضافة'); return; }
      toast('success', 'تم الإضافة بنجاح');
    }

    setShowForm(false);
    loadData();
  }

  async function deleteGroup(id: string) {
    if (!confirm('هل أنت متأكد من حذف هذا الفريق؟ سيؤدي هذا إلى إزالة ربط اللاعبين بهذا الفريق ولن يتم حذف اللاعبين.')) return;
    const { error } = await supabase.from('groups').delete().eq('id', id);
    if (error) { toast('error', 'حدث خطأ أثناء الحذف'); return; }
    toast('success', 'تم الحذف بنجاح');
    loadData();
  }

  const filteredGroups = groups.filter(g => 
    g.name.includes(searchQuery) || 
    (g.coach_name && g.coach_name.includes(searchQuery))
  );

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 font-arabic flex items-center gap-2">
            <Users className="text-emerald-600" /> إدارة الفرق التدريبية
          </h2>
          <p className="text-slate-500 text-sm mt-1">تحديد المجموعات وتعيين المدربين ومواعيد التدريب</p>
        </div>
        <button onClick={openAddForm} className="btn btn-primary shadow-lg shadow-emerald-500/20 whitespace-nowrap">
          + إضافة فريق / مجموعة
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="ابحث عن فريق أو مدرب..." 
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl py-3 pr-12 pl-4 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow shadow-sm font-arabic"
        />
      </div>

      {filteredGroups.length === 0 ? (
        <EmptyState 
          icon={<Users size={48} className="text-slate-300 mb-4" />} 
          title="لا توجد فرق" 
          subtitle="قم بإضافة الفرق وتقسيم اللاعبين حسب المدرب أو الفئة العمرية" 
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGroups.map(g => (
            <div key={g.id} className="premium-card p-6 flex flex-col group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-bl-full -z-10 transition-transform group-hover:scale-150" />
              
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-slate-800 font-arabic flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex justify-center items-center font-bold text-xs shrink-0">
                    {g.name.charAt(0)}
                  </div>
                  {g.name}
                </h3>
                {!branchFilter && <BranchBadge branchId={g.branch_id} branchName={g.branch_name || ''} />}
              </div>

              <div className="space-y-3 mt-auto">
                <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="w-6 h-6 rounded bg-blue-100 text-blue-700 flex justify-center items-center shrink-0"><Users size={14} /></span>
                  <span className="font-semibold text-sm">الكابتن:</span>
                  <span className="text-slate-800 font-bold truncate text-sm">{g.coach_name || 'لم يحدد'}</span>
                </div>
                
                <div className="flex items-start gap-2 text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="w-6 h-6 rounded bg-amber-100 text-amber-700 flex justify-center items-center shrink-0"><Clock size={14} /></span>
                  <div className="flex-1">
                    <div className="font-semibold text-sm mb-1">المواعيد:</div>
                    <div className="flex flex-wrap gap-1">
                      {g.schedule_days.length > 0 ? g.schedule_days.map(d => (
                        <span key={d} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-xs shadow-sm font-arabic">
                          {DAYS_OF_WEEK.find(x => x.id === d)?.name}
                        </span>
                      )) : <span className="text-xs text-slate-400">لا توجد أيام</span>}
                    </div>
                    {g.schedule_time && (
                      <div className="text-xs font-bold text-emerald-700 mt-1.5 tabular-nums dir-ltr text-right">
                        {g.schedule_time}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-5 pt-4 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEditForm(g)} className="flex-1 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors flex items-center justify-center gap-1">
                  <Edit2 size={16} /> تعديل
                </button>
                <button onClick={() => deleteGroup(g.id)} className="flex-1 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-1">
                  <Trash2 size={16} /> حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Group Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingGroup ? "تعديل بيانات الفريق" : "إضافة فريق تدريبي جديد"} footer={
        <>
          <button onClick={saveGroup} className="btn btn-primary px-6">حفظ</button>
          <button onClick={() => setShowForm(false)} className="btn btn-secondary px-6">إلغاء</button>
        </>
      }>
        <div className="grid grid-cols-1 gap-5">
          <div>
            <label className="form-label">اسم الفريق / الفئة العمرية *</label>
            <input value={form.name} onChange={(e) => setForm(f => ({...f, name: e.target.value}))} className="input-field" placeholder="مثال: فريق مواليد 2009 / فريق الكابتن أحمد" />
          </div>
          
          <div>
            <label className="form-label">الفرع *</label>
            <select value={form.branch_id} onChange={(e) => setForm(f => ({...f, branch_id: e.target.value}))} className="input-field" disabled={!!branchFilter}>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div>
            <label className="form-label">المدرب المسؤول</label>
            <select value={form.coach_id} onChange={(e) => setForm(f => ({...f, coach_id: e.target.value}))} className="input-field">
              <option value="">-- بدون مدرب محدد --</option>
              {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="form-label mb-2 block">أيام التدريب</label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map(day => {
                const isActive = form.schedule_days.includes(day.id);
                return (
                  <button 
                    key={day.id} 
                    onClick={() => toggleDay(day.id)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border-2 ${
                      isActive 
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm' 
                        : 'bg-white border-slate-200 text-slate-500 hover:border-emerald-300'
                    }`}
                  >
                    {day.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="form-label">موعد التدريب (توقيت)</label>
            <input type="time" value={form.schedule_time} onChange={(e) => setForm(f => ({...f, schedule_time: e.target.value}))} className="input-field" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
