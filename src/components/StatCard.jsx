export default function StatCard({ title, value, note }) {
  return (
    <div className="card">
      <p className="text-xs font-bold text-gray-500">{title}</p>
      <h3 className="text-2xl font-black mt-1">{value}</h3>
      {note && <p className="text-[11px] text-gray-700 dark:text-gray-300 mt-1">{note}</p>}
    </div>
  );
} 