interface Props {
  label: string;
  value: string;
  className?: string;
}

export default function StatCard({ label, value, className = '' }: Props) {
  return (
    <div className={`text-center ${className}`}>
      <div className="text-text-muted text-[10px] font-mono uppercase">{label}</div>
      <div className="text-white text-sm font-mono tabular-nums">{value}</div>
    </div>
  );
}
