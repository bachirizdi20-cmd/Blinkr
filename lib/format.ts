export function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (!Number.isFinite(timestamp)) return '';
  if (diffSec < 60) return 'الآن';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin.toLocaleString('ar')} د`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour.toLocaleString('ar')} س`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay.toLocaleString('ar')} ي`;
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 5) return `${diffWeek.toLocaleString('ar')} أ`;
  const date = new Date(timestamp);
  return date.toLocaleDateString('ar', { month: 'short', day: 'numeric' });
}

export function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('ar', { hour: 'numeric', minute: '2-digit' });
}
