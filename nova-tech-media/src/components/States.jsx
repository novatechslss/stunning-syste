export function Skeleton({ lines = 3, height = 16 }) {
  return (
    <div className="skeleton-wrap" aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height, width: `${100 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function GridSkeleton({ count = 6 }) {
  return (
    <div className="media-grid" aria-label="Loading media" role="status">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card media-card">
          <div className="skeleton" style={{ height: 140 }} />
          <div className="skeleton" style={{ height: 14, marginTop: 12, width: '70%' }} />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="empty card">
      {Icon && <Icon size={34} aria-hidden="true" />}
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
