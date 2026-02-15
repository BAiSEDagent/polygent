export default function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="text-center">
      <div className="font-mono font-bold text-white text-sm">{value}</div>
      <div className="text-[10px] text-gray-600 tracking-wider">{label}</div>
    </div>
  );
}
