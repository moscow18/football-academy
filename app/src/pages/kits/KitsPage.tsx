import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useBranch } from '../../contexts/BranchContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { formatMoney } from '../../lib/utils';
import { PageLoading, EmptyState } from '../../components/ui/LoadingSpinner';
import Modal from '../../components/ui/Modal';
import type { KitItem, KitCategory, Player } from '../../lib/types';
import { KIT_CATEGORY_LABELS } from '../../lib/types';
import { useRealtimeRefresh } from '../../lib/useRealtimeRefresh';

export default function KitsPage() {
  const { branchFilter, branches } = useBranch();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [items, setItems] = useState<KitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'inventory' | 'sell'>('inventory');

  // Add item form
  const [showItemForm, setShowItemForm] = useState(false);
  const [itemForm, setItemForm] = useState({
    branch_id: '', item_name: '', category: 'kit' as KitCategory,
    size_options: 'S,M,L,XL', cost_price: '', sale_price: '',
    stock_quantity: '', low_stock_threshold: '5',
  });

  // Restock form
  const [showRestock, setShowRestock] = useState<KitItem | null>(null);
  const [restockQty, setRestockQty] = useState('');

  // Sell form
  const [playerSearch, setPlayerSearch] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [sellForm, setSellForm] = useState({
    player_id: '', kit_item_id: '', size: '', quantity: '1', amount_paid: '',
  });
  const [selectedItem, setSelectedItem] = useState<KitItem | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('kit_items').select('*, branches(name)').order('item_name');
    if (branchFilter) q = q.eq('branch_id', branchFilter);
    const { data } = await q;
    const mapped = (data || []).map((k: Record<string, unknown>) => ({
      ...k,
      branch_name: (k.branches as Record<string, string>)?.name,
    })) as KitItem[];
    setItems(mapped);
    setLoading(false);
  }, [branchFilter]);

  useEffect(() => { loadItems(); }, [loadItems]);

  // ⚡ Realtime: auto-refresh when kit_items changes
  useRealtimeRefresh(['kit_items'], loadItems);

  // Player search for sell
  useEffect(() => {
    if (!playerSearch) { setPlayers([]); return; }
    const timer = setTimeout(async () => {
      let q = supabase.from('players').select('id, full_name, player_code, branch_id').eq('status', 'active');
      if (branchFilter) q = q.eq('branch_id', branchFilter);
      q = q.or(`full_name.ilike.%${playerSearch}%,player_code.ilike.%${playerSearch}%`).limit(10);
      const { data } = await q;
      setPlayers(data as Player[] || []);
    }, 300);
    return () => clearTimeout(timer);
  }, [playerSearch, branchFilter]);

  async function saveItem() {
    if (!itemForm.branch_id || !itemForm.item_name || !itemForm.sale_price) {
      toast('error', 'يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    const { error } = await supabase.from('kit_items').insert({
      branch_id: itemForm.branch_id,
      item_name: itemForm.item_name,
      category: itemForm.category,
      size_options: itemForm.size_options.split(',').map(s => s.trim()),
      cost_price: Number(itemForm.cost_price) || 0,
      sale_price: Number(itemForm.sale_price),
      stock_quantity: Number(itemForm.stock_quantity) || 0,
      low_stock_threshold: Number(itemForm.low_stock_threshold) || 5,
    });
    if (error) { toast('error', 'خطأ في إضافة المنتج'); return; }
    toast('success', 'تم إضافة المنتج');
    setShowItemForm(false);
    loadItems();
  }

  async function doRestock() {
    if (!showRestock || !restockQty) return;
    const qty = Number(restockQty);
    // Update stock
    const { error } = await supabase.from('kit_items')
      .update({ stock_quantity: showRestock.stock_quantity + qty })
      .eq('id', showRestock.id);
    if (error) { toast('error', 'خطأ في التحديث'); return; }

    // Log as expense (kits_stock category)
    await supabase.from('expenses').insert({
      branch_id: showRestock.branch_id,
      category: 'kits_stock',
      amount: showRestock.cost_price * qty,
      notes: `إعادة تخزين: ${showRestock.item_name} × ${qty}`,
      recorded_by: profile?.id,
    });

    toast('success', `تم إضافة ${qty} قطعة وتسجيل المصروف`);
    setShowRestock(null);
    setRestockQty('');
    loadItems();
  }

  async function sellKit() {
    if (!sellForm.player_id || !sellForm.kit_item_id) {
      toast('error', 'يرجى اختيار اللاعب والمنتج');
      return;
    }

    const { error } = await supabase.rpc('sell_kit_item', {
      p_kit_item_id: sellForm.kit_item_id,
      p_player_id: sellForm.player_id,
      p_branch_id: selectedItem?.branch_id || branchFilter,
      p_size: sellForm.size,
      p_quantity: Number(sellForm.quantity) || 1,
      p_amount_paid: Number(sellForm.amount_paid) || 0,
      p_notes: '',
      p_recorded_by: profile?.id,
    });

    if (error) {
      if (error.message.includes('Insufficient stock')) {
        toast('error', 'المخزون غير كافٍ');
      } else {
        toast('error', 'خطأ في عملية البيع: ' + error.message);
      }
      return;
    }

    toast('success', 'تم بيع المنتج بنجاح');
    setSellForm({ player_id: '', kit_item_id: '', size: '', quantity: '1', amount_paid: '' });
    setPlayerSearch('');
    setSelectedItem(null);
    loadItems();
  }

  const lowStockItems = items.filter(i => i.stock_quantity <= i.low_stock_threshold);

  if (loading) return <PageLoading />;

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-slate-100 rounded-lg p-1 max-w-md">
        <button onClick={() => setTab('inventory')}
          className={`flex-1 py-2 px-4 rounded-md font-semibold text-sm transition-all cursor-pointer border-none font-[Cairo] ${tab === 'inventory' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>
          📦 المخزون
        </button>
        <button onClick={() => setTab('sell')}
          className={`flex-1 py-2 px-4 rounded-md font-semibold text-sm transition-all cursor-pointer border-none font-[Cairo] ${tab === 'sell' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>
          🛒 بيع طقم
        </button>
      </div>

      {tab === 'inventory' && (
        <div>
          {/* Low stock warning */}
          {lowStockItems.length > 0 && (
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-5">
              <div className="font-bold text-violet-700 text-sm mb-2">⚠ منتجات بمخزون منخفض ({lowStockItems.length})</div>
              <div className="flex flex-wrap gap-2">
                {lowStockItems.map(i => (
                  <span key={i.id} className="text-xs bg-violet-100 text-violet-700 px-2 py-1 rounded-full font-semibold">
                    {i.item_name} ({i.stock_quantity})
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-slate-500">{items.length} منتج</span>
            <button onClick={() => { setItemForm(f => ({ ...f, branch_id: branchFilter || '' })); setShowItemForm(true); }}
              className="py-2 px-4 bg-emerald-600 text-white rounded-lg font-bold text-sm cursor-pointer">+ إضافة منتج</button>
          </div>

          {items.length === 0 ? (
            <EmptyState icon="👕" title="لا توجد منتجات" subtitle="أضف منتجات للمتجر" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {items.map(item => {
                const isLow = item.stock_quantity <= item.low_stock_threshold;
                return (
                  <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col relative">
                    <div className="flex justify-between items-start mb-3">
                      <div className="w-12 h-12 bg-slate-50 rounded-lg flex items-center justify-center text-2xl border border-slate-100">
                        {item.category === 'kit' ? '👕' : item.category === 'training_wear' ? '🏃‍♂️' : item.category === 'accessories' ? '🎒' : '📦'}
                      </div>
                      <button onClick={() => { setShowRestock(item); setRestockQty(''); }} className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 transition-colors">
                        ✎
                      </button>
                    </div>
                    
                    <h3 className="text-lg font-bold text-slate-800 font-arabic mb-1">{item.item_name}</h3>
                    <div className="text-sm text-slate-500 font-arabic mb-4">{KIT_CATEGORY_LABELS[item.category]}</div>
                    
                    <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div className="text-emerald-700 font-extrabold text-lg font-tabular">{formatMoney(item.sale_price)} <span className="text-xs">ج.م</span></div>
                      <div className={`px-3 py-1 rounded-full text-xs font-bold font-arabic ${isLow ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                        توفر: <span className="font-tabular">{item.stock_quantity}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'sell' && (
        <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl">
          <h4 className="font-bold text-lg text-slate-800 mb-5">🛒 بيع طقم للاعب</h4>
          <div className="space-y-4">
            {/* Player search */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">بحث عن اللاعب (بالاسم أو الكود) *</label>
              <input value={playerSearch} onChange={(e) => setPlayerSearch(e.target.value)}
                placeholder="اكتب اسم أو كود اللاعب..."
                className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-emerald-500 focus:outline-none" />
              {players.length > 0 && (
                <div className="mt-2 border border-slate-200 rounded-lg max-h-40 overflow-y-auto">
                  {players.map(p => (
                    <button key={p.id} onClick={() => {
                      setSellForm(f => ({ ...f, player_id: p.id }));
                      setPlayerSearch(`${p.full_name} (${p.player_code})`);
                      setPlayers([]);
                    }}
                    className="w-full text-right px-3 py-2 text-sm hover:bg-emerald-50 border-none cursor-pointer font-[Cairo] bg-white">
                      {p.full_name} <span className="text-slate-400 text-xs">({p.player_code})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Item selection */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">المنتج *</label>
              <select value={sellForm.kit_item_id} onChange={(e) => {
                const item = items.find(i => i.id === e.target.value);
                setSelectedItem(item || null);
                setSellForm(f => ({
                  ...f,
                  kit_item_id: e.target.value,
                  amount_paid: item ? String(item.sale_price * (Number(f.quantity) || 1)) : '',
                }));
              }}
              className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-emerald-500 focus:outline-none">
                <option value="">اختر المنتج</option>
                {items.filter(i => i.stock_quantity > 0).map(i => (
                  <option key={i.id} value={i.id}>{i.item_name} — {formatMoney(i.sale_price)} ج.م (متوفر: {i.stock_quantity})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-slate-700">المقاس</label>
                <select value={sellForm.size} onChange={(e) => setSellForm(f => ({ ...f, size: e.target.value }))}
                  className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-emerald-500 focus:outline-none">
                  <option value="">اختر</option>
                  {selectedItem?.size_options?.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-slate-700">الكمية</label>
                <input type="number" min="1" value={sellForm.quantity} onChange={(e) => {
                  const qty = Number(e.target.value) || 1;
                  setSellForm(f => ({ ...f, quantity: e.target.value, amount_paid: selectedItem ? String(selectedItem.sale_price * qty) : f.amount_paid }));
                }}
                className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-emerald-500 focus:outline-none tabular-nums" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-slate-700">المبلغ المدفوع</label>
                <input type="number" value={sellForm.amount_paid} onChange={(e) => setSellForm(f => ({ ...f, amount_paid: e.target.value }))}
                  className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-emerald-500 focus:outline-none tabular-nums" dir="ltr" />
              </div>
            </div>

            {/* Total display */}
            {selectedItem && (
              <div className="bg-slate-50 rounded-lg p-4 flex items-center justify-between">
                <span className="text-sm text-slate-600">الإجمالي:</span>
                <span className="text-xl font-extrabold text-emerald-700 tabular-nums">
                  {formatMoney(selectedItem.sale_price * (Number(sellForm.quantity) || 1))} ج.م
                </span>
              </div>
            )}

            <button onClick={sellKit}
              className="w-full py-3 bg-emerald-600 text-white rounded-lg font-bold text-base hover:bg-emerald-700 transition-all cursor-pointer shadow-sm">
              ✅ تأكيد البيع
            </button>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      <Modal isOpen={showItemForm} onClose={() => setShowItemForm(false)} title="إضافة منتج جديد" size="lg" footer={
        <><button onClick={saveItem} className="px-5 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm cursor-pointer">إضافة</button>
          <button onClick={() => setShowItemForm(false)} className="px-5 py-2 border border-slate-200 rounded-lg text-sm cursor-pointer">إلغاء</button></>
      }>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="block text-sm font-semibold mb-1">اسم المنتج *</label>
            <input value={itemForm.item_name} onChange={(e) => setItemForm(f => ({ ...f, item_name: e.target.value }))}
              className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-emerald-500 focus:outline-none" /></div>
          <div><label className="block text-sm font-semibold mb-1">الفرع *</label>
            <select value={itemForm.branch_id} onChange={(e) => setItemForm(f => ({ ...f, branch_id: e.target.value }))}
              className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-emerald-500 focus:outline-none">
              <option value="">اختر</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select></div>
          <div><label className="block text-sm font-semibold mb-1">الفئة</label>
            <select value={itemForm.category} onChange={(e) => setItemForm(f => ({ ...f, category: e.target.value as KitCategory }))}
              className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-emerald-500 focus:outline-none">
              {Object.entries(KIT_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <div><label className="block text-sm font-semibold mb-1">المقاسات (مفصولة بفاصلة)</label>
            <input value={itemForm.size_options} onChange={(e) => setItemForm(f => ({ ...f, size_options: e.target.value }))}
              className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-emerald-500 focus:outline-none" dir="ltr" /></div>
          <div><label className="block text-sm font-semibold mb-1">سعر التكلفة</label>
            <input type="number" value={itemForm.cost_price} onChange={(e) => setItemForm(f => ({ ...f, cost_price: e.target.value }))}
              className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-emerald-500 focus:outline-none tabular-nums" dir="ltr" /></div>
          <div><label className="block text-sm font-semibold mb-1">سعر البيع *</label>
            <input type="number" value={itemForm.sale_price} onChange={(e) => setItemForm(f => ({ ...f, sale_price: e.target.value }))}
              className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-emerald-500 focus:outline-none tabular-nums" dir="ltr" /></div>
          <div><label className="block text-sm font-semibold mb-1">الكمية المتوفرة</label>
            <input type="number" value={itemForm.stock_quantity} onChange={(e) => setItemForm(f => ({ ...f, stock_quantity: e.target.value }))}
              className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-emerald-500 focus:outline-none tabular-nums" dir="ltr" /></div>
          <div><label className="block text-sm font-semibold mb-1">حد التنبيه</label>
            <input type="number" value={itemForm.low_stock_threshold} onChange={(e) => setItemForm(f => ({ ...f, low_stock_threshold: e.target.value }))}
              className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-emerald-500 focus:outline-none tabular-nums" dir="ltr" /></div>
        </div>
      </Modal>

      {/* Restock Modal */}
      <Modal isOpen={!!showRestock} onClose={() => setShowRestock(null)} title={`إعادة تخزين: ${showRestock?.item_name || ''}`} footer={
        <><button onClick={doRestock} className="px-5 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm cursor-pointer">تخزين</button>
          <button onClick={() => setShowRestock(null)} className="px-5 py-2 border border-slate-200 rounded-lg text-sm cursor-pointer">إلغاء</button></>
      }>
        <div>
          <p className="text-sm text-slate-500 mb-3">المخزون الحالي: <strong>{showRestock?.stock_quantity}</strong> — سعر التكلفة: <strong className="tabular-data">{formatMoney(showRestock?.cost_price || 0)}</strong></p>
          <label className="block text-sm font-semibold mb-1">الكمية المضافة</label>
          <input type="number" min="1" value={restockQty} onChange={(e) => setRestockQty(e.target.value)}
            className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg font-[Cairo] text-sm focus:border-emerald-500 focus:outline-none tabular-nums" dir="ltr" />
          {restockQty && showRestock && (
            <p className="text-sm text-slate-500 mt-2">تكلفة الشراء: <strong className="text-red-500 tabular-nums">{formatMoney(showRestock.cost_price * Number(restockQty))}</strong> ج.م (سيتم تسجيلها كمصروف)</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
