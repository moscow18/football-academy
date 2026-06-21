import { getBranchColorIndex } from '../../lib/utils';

/** Status badge for entities */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'status-success',
    inactive: 'status-critical',
    suspended: 'status-warning',
    present: 'status-success',
    absent: 'status-critical',
    late: 'status-warning',
    paid: 'status-success',
    partial: 'status-warning',
    unpaid: 'status-critical',
  };
  const labels: Record<string, string> = {
    active: 'نشط',
    inactive: 'غير نشط',
    suspended: 'موقوف',
    present: 'حاضر',
    absent: 'غائب',
    late: 'متأخر',
    paid: 'مدفوع',
    partial: 'جزئي',
    unpaid: 'غير مدفوع',
  };
  return (
    <span className={`badge badge-md ${map[status] || 'status-neutral'}`}>
      {labels[status] || status}
    </span>
  );
}

/** Branch-colored badge */
export function BranchBadge({ branchId, branchName }: { branchId: string; branchName: string }) {
  const idx = getBranchColorIndex(branchId);
  return (
    <span className={`branch-badge branch-badge-${idx}`}>
      {branchName}
    </span>
  );
}

/** Low stock warning badge */
export function LowStockBadge() {
  return (
    <span className="badge badge-md bg-purple-50 text-purple-700 border border-purple-200">
      ⚠ مخزون منخفض
    </span>
  );
}
