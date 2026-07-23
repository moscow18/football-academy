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
import { Plus, ShoppingCart, Package, RefreshCw } from 'lucide-react';

export default function KitsPage() {
  const { branchFilter, branches } = useBranch();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [items, setItems] = useState<KitItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Quick sell modal (per-item)
  const [sellItem, setSellItem] = useState<KitItem | null>(null);
  const [playerSearch, setPlayerSearch] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [sellForm, setSellForm] = useState({
    player_id: '', size: '', quantity: '1', amount_paid: '',
  });
  const [selectedPlayerName, setSelectedPlayerName] = useState('');

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
    toast('success', 'تم إضافة المنتج بنجاح ✅');
    setShowItemForm(false);
    loadItems();
  }

  async function doRestock() {
    if (!showRestock || !restockQty) return;
    const qty = Number(restockQty);
    const { error } = await supabase.from('kit_items')
      .update({ stock_quantity: showRestock.stock_quantity + qty })
      .eq('id', showRestock.id);
    if (error) { toast('error', 'خطأ في التحديث'); return; }

    await supabase.from('expenses').insert({
      branch_id: showRestock.branch_id,
      category: 'kits_stock',
      amount: showRestock.cost_price * qty,
      notes: `إعادة تخزين: ${showRestock.item_name} × ${qty}`,
      recorded_by: profile?.id,
    });

    toast('success', `تم إضافة ${qty} قطعة وتسجيل المصروف ✅`);
    setShowRestock(null);
    setRestockQty('');
    loadItems();
  }

  // Quick sell from item card
  function openQuickSell(item: KitItem) {
    setSellItem(item);
    setSellForm({ player_id: '', size: '', quantity: '1', amount_paid: String(item.sale_price) });
    setPlayerSearch('');
    setSelectedPlayerName('');
    setPlayers([]);
  }

  async function confirmSell() {
    if (!sellItem || !sellForm.player_id) {
      toast('error', 'يرجى اختيار اللاعب أولاً');
      return;
    }
    const { error } = await supabase.rpc('sell_kit_item', {
      p_kit_item_id: sellItem.id,
      p_player_id: sellForm.player_id,
      p_branch_id: sellItem.branch_id,
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

    toast('success', `تم بيع ${sellItem.item_name} للاعب ${selectedPlayerName} بنجاح ✅`);
    setSellItem(null);
    setSellForm({ player_id: '', size: '', quantity: '1', amount_paid: '' });
    setPlayerSearch('');
    setSelectedPlayerName('');
    loadItems();
  }

  const lowStockItems = items.filter(i => i.stock_quantity <= i.low_stock_threshold);
  const totalStockValue = items.reduce((sum, i) => sum + (i.sale_price * i.stock_quantity), 0);

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6 animate-fade-in font-[Cairo] pb-12">

      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            👕 إدارة الأطقم واللبس الرياضي
          </h1>
          <p className="text-slate-500 text-sm font-semibold mt-1">
            إدارة المخزون وبيع الأطقم والملابس الرياضية للاعبين
          </p>
        </div>

        <button
          onClick={() => { setItemForm(f => ({ ...f, branch_id: branchFilter || '' })); setShowItemForm(true); }}
          className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-extrabold text-sm transition-all shadow-md flex items-center gap-2 cursor-pointer hover:scale-105 active:scale-95"
        >
          <Plus size={18} />
          <span>إضافة منتج جديد</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-purple-700 font-extrabold">إجمالي المنتجات</span>
            <Package size={20} className="text-purple-600" />
          </div>
          <div className="text-3xl font-extrabold text-purple-900 font-tabular">{items.length}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-emerald-700 font-extrabold">قيمة المخزون (بسعر البيع)</span>
            <ShoppingCart size={20} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-900 font-tabular">{formatMoney(totalStockValue)} <span className="text-xs">ج.م</span></div>
        </div>
        {lowStockItems.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-amber-700 font-extrabold">⚠️ مخزون منخفض</span>
            </div>
            <div className="text-3xl font-extrabold text-amber-900 font-tabular">{lowStockItems.length} <span className="text-xs font-bold">منتج</span></div>
            <div className="flex flex-wrap gap-1 mt-2">
              {lowStockItems.slice(0, 3).map(i => (
                <span key={i.id} className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                  {i.item_name} ({i.stock_quantity})
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Product Cards Grid */}
      {items.length === 0 ? (
        <EmptyState icon="👕" title="لا توجد منتجات" subtitle="أضف منتجات للمتجر من الزر أعلاه" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {items.map(item => {
            const isLow = item.stock_quantity <= item.low_stock_threshold;
            const catIcon = item.category === 'kit' ? '👕' : item.category === 'training_wear' ? '🏃‍♂️' : item.category === 'accessories' ? '🎒' : '📦';
            return (
              <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm hover:shadow-md transition-all flex flex-col relative group">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="w-14 h-14 bg-purple-50 rounded-xl flex items-center justify-center text-3xl border border-purple-100">
                    {catIcon}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setShowRestock(item); setRestockQty(''); }}
                      className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer border border-blue-100"
                      title="إعادة تخزين"
                    >
                      <RefreshCw size={16} />
                    </button>
                  </div>
                </div>

                {/* Name */}
                <h3 className="text-lg md:text-xl font-extrabold text-slate-900 mb-1">{item.item_name}</h3>
                <div className="text-xs text-slate-500 font-bold mb-1">{KIT_CATEGORY_LABELS[item.category]}</div>
                {item.branch_name && (
                  <div className="text-[10px] text-slate-400 font-bold mb-4">📍 {item.branch_name}</div>
                )}

                {/* Price & Stock */}
                <div className="mt-auto pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-emerald-700 font-extrabold text-xl font-tabular">
                      {formatMoney(item.sale_price)} <span className="text-xs text-slate-500">ج.م</span>
                    </div>
                    <div className={`px-3 py-1.5 rounded-full text-xs font-extrabold ${
                      isLow ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      متوفر: <span className="font-tabular">{item.stock_quantity}</span>
                    </div>
                  </div>

                  {/* Quick Sell Button */}
                  <button
                    onClick={() => openQuickSell(item)}
                    disabled={item.stock_quantity === 0}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-extrabold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ShoppingCart size={18} />
                    بيع سريع
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========= Quick Sell Modal ========= */}
      <Modal
        isOpen={!!sellItem}
        onClose={() => setSellItem(null)}
        title={`🛒 بيع سريع — ${sellItem?.item_name || ''}`}
        footer={
          <div className="flex gap-2 justify-end">
            <button
              onClick={confirmSell}
              disabled={!sellForm.player_id}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl font-extrabold text-sm cursor-pointer transition-all shadow-sm"
            >
              ✅ تأكيد البيع
            </button>
            <button
              onClick={() => setSellItem(null)}
              className="px-5 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 cursor-pointer hover:bg-slate-50"
            >
              إلغاء
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          {/* Product Info Card */}
          {sellItem && (
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 flex items-center justify-between">
              <div>
                <div className="font-extrabold text-purple-900 text-base">{sellItem.item_name}</div>
                <div className="text-xs text-purple-600 font-bold">متوفر: {sellItem.stock_quantity} قطعة</div>
              </div>
              <div className="text-xl font-extrabold text-purple-800 font-tabular">
                {formatMoney(sellItem.sale_price)} ج.م
              </div>
            </div>
          )}

          {/* Player Search */}
          <div>
            <label className="block text-sm font-extrabold text-slate-700 mb-2">👤 اختر اللاعب *</label>
            <input
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
              placeholder="🔍 اكتب اسم أو كود اللاعب..."
              className="w-full py-3 px-4 border-2 border-slate-200 rounded-xl text-sm focus:border-purple-500 focus:outline-none transition-colors"
            />
            {players.length > 0 && (
              <div className="mt-2 border border-slate-200 rounded-xl max-h-40 overflow-y-auto shadow-sm">
                {players.map(p => (
                  <button key={p.id} onClick={() => {
                    setSellForm(f => ({ ...f, player_id: p.id }));
                    setPlayerSearch(`${p.full_name} (${p.player_code})`);
                    setSelectedPlayerName(p.full_name);
                    setPlayers([]);
                  }}
                  className="w-full text-right px-4 py-3 text-sm hover:bg-purple-50 border-none cursor-pointer font-[Cairo] bg-white font-bold transition-colors">
                    {p.full_name} <span className="text-slate-400 text-xs font-mono">({p.player_code})</span>
                  </button>
                ))}
              </div>
            )}
            {selectedPlayerName && (
              <div className="mt-2 text-xs font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 inline-flex items-center gap-1">
                ✅ تم اختيار: {selectedPlayerName}
              </div>
            )}
          </div>

          {/* Size, Quantity, Price */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">المقاس</label>
              <select
                value={sellForm.size}
                onChange={(e) => setSellForm(f => ({ ...f, size: e.target.value }))}
                className="w-full py-3 px-3 border-2 border-slate-200 rounded-xl text-sm focus:border-purple-500 focus:outline-none cursor-pointer"
              >
                <option value="">اختر</option>
                {sellItem?.size_options?.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">الكمية</label>
              <input
                type="number" min="1" value={sellForm.quantity}
                onChange={(e) => {
                  const qty = Number(e.target.value) || 1;
                  setSellForm(f => ({ ...f, quantity: e.target.value, amount_paid: sellItem ? String(sellItem.sale_price * qty) : f.amount_paid }));
                }}
                className="w-full py-3 px-3 border-2 border-slate-200 rounded-xl text-sm focus:border-purple-500 focus:outline-none font-tabular" dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">المبلغ (ج.م)</label>
              <input
                type="number" value={sellForm.amount_paid}
                onChange={(e) => setSellForm(f => ({ ...f, amount_paid: e.target.value }))}
                className="w-full py-3 px-3 border-2 border-slate-200 rounded-xl text-sm focus:border-purple-500 focus:outline-none font-tabular" dir="ltr"
              />
            </div>
          </div>

          {/* Total */}
          {sellItem && (
            <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between border border-slate-200">
              <span className="text-sm font-bold text-slate-600">💰 الإجمالي:</span>
              <span className="text-2xl font-extrabold text-purple-800 font-tabular">
                {formatMoney(sellItem.sale_price * (Number(sellForm.quantity) || 1))} ج.م
              </span>
            </div>
          )}
        </div>
      </Modal>

      {/* ========= Add Item Modal ========= */}
      <Modal isOpen={showItemForm} onClose={() => setShowItemForm(false)} title="➕ إضافة منتج جديد" size="lg" footer={
        <div className="flex gap-2 justify-end">
          <button onClick={saveItem} className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-extrabold text-sm cursor-pointer transition-all shadow-sm">إضافة ✅</button>
          <button onClick={() => setShowItemForm(false)} className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold cursor-pointer hover:bg-slate-50">إلغاء</button>
        </div>
      }>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold mb-1 text-slate-700">اسم المنتج *</label>
            <input value={itemForm.item_name} onChange={(e) => setItemForm(f => ({ ...f, item_name: e.target.value }))}
              className="w-full py-3 px-3 border-2 border-slate-200 rounded-xl text-sm focus:border-purple-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1 text-slate-700">الفرع *</label>
            <select value={itemForm.branch_id} onChange={(e) => setItemForm(f => ({ ...f, branch_id: e.target.value }))}
              className="w-full py-3 px-3 border-2 border-slate-200 rounded-xl text-sm focus:border-purple-500 focus:outline-none cursor-pointer">
              <option value="">اختر</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1 text-slate-700">الفئة</label>
            <select value={itemForm.category} onChange={(e) => setItemForm(f => ({ ...f, category: e.target.value as KitCategory }))}
              className="w-full py-3 px-3 border-2 border-slate-200 rounded-xl text-sm focus:border-purple-500 focus:outline-none cursor-pointer">
              {Object.entries(KIT_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1 text-slate-700">المقاسات (مفصولة بفاصلة)</label>
            <input value={itemForm.size_options} onChange={(e) => setItemForm(f => ({ ...f, size_options: e.target.value }))}
              className="w-full py-3 px-3 border-2 border-slate-200 rounded-xl text-sm focus:border-purple-500 focus:outline-none" dir="ltr" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1 text-slate-700">سعر التكلفة (ج.م)</label>
            <input type="number" value={itemForm.cost_price} onChange={(e) => setItemForm(f => ({ ...f, cost_price: e.target.value }))}
              className="w-full py-3 px-3 border-2 border-slate-200 rounded-xl text-sm focus:border-purple-500 focus:outline-none font-tabular" dir="ltr" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1 text-slate-700">سعر البيع * (ج.م)</label>
            <input type="number" value={itemForm.sale_price} onChange={(e) => setItemForm(f => ({ ...f, sale_price: e.target.value }))}
              className="w-full py-3 px-3 border-2 border-slate-200 rounded-xl text-sm focus:border-purple-500 focus:outline-none font-tabular" dir="ltr" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1 text-slate-700">الكمية المتوفرة</label>
            <input type="number" value={itemForm.stock_quantity} onChange={(e) => setItemForm(f => ({ ...f, stock_quantity: e.target.value }))}
              className="w-full py-3 px-3 border-2 border-slate-200 rounded-xl text-sm focus:border-purple-500 focus:outline-none font-tabular" dir="ltr" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1 text-slate-700">حد التنبيه (المخزون)</label>
            <input type="number" value={itemForm.low_stock_threshold} onChange={(e) => setItemForm(f => ({ ...f, low_stock_threshold: e.target.value }))}
              className="w-full py-3 px-3 border-2 border-slate-200 rounded-xl text-sm focus:border-purple-500 focus:outline-none font-tabular" dir="ltr" />
          </div>
        </div>
      </Modal>

      {/* ========= Restock Modal ========= */}
      <Modal isOpen={!!showRestock} onClose={() => setShowRestock(null)} title={`📦 إعادة تخزين: ${showRestock?.item_name || ''}`} footer={
        <div className="flex gap-2 justify-end">
          <button onClick={doRestock} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-extrabold text-sm cursor-pointer transition-all shadow-sm">تخزين ✅</button>
          <button onClick={() => setShowRestock(null)} className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold cursor-pointer hover:bg-slate-50">إلغاء</button>
        </div>
      }>
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
            <p className="text-sm text-blue-800 font-bold">المخزون الحالي: <strong className="font-tabular">{showRestock?.stock_quantity}</strong> — سعر التكلفة: <strong className="font-tabular">{formatMoney(showRestock?.cost_price || 0)}</strong> ج.م</p>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1 text-slate-700">الكمية المضافة *</label>
            <input type="number" min="1" value={restockQty} onChange={(e) => setRestockQty(e.target.value)}
              className="w-full py-3 px-3 border-2 border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none font-tabular" dir="ltr" />
          </div>
          {restockQty && showRestock && (
            <div className="bg-rose-50 p-3 rounded-xl border border-rose-200 text-sm font-bold text-rose-700">
              💰 تكلفة الشراء: <strong className="font-tabular">{formatMoney(showRestock.cost_price * Number(restockQty))}</strong> ج.م (سيتم تسجيلها كمصروف)
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
