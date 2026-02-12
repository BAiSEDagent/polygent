import AnimatedNumber from './AnimatedNumber';

interface Props {
  label: string;
  value: number;
  format?: (n: number) => string;
  className?: string;
}

export default function StatCard({ label, value, format, className = '' }: Props) {
  return (
    <div className={`px-4 py-2 border border-border bg-surface ${className}`}>
      <div className="text-[10px] uppercase tracking-widest text-text-muted font-mono">{label}</div>
      <AnimatedNumber value={value} format={format} className="text-lg text-text-primary" />
    </div>
  );
}
