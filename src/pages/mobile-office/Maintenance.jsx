import { useState } from "react";
import ScreenStock from "./ScreenStock";

export default function Maintenance({
  project,
  canAdd = true,
  canEdit = true,
  canDelete = true,
}) {
  const [activeSubTab, setActiveSubTab] = useState("screens");

  return (
    <div className="space-y-2">
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-1 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          <SubTabButton
            label="الشاشات"
            active={activeSubTab === "screens"}
            onClick={() => setActiveSubTab("screens")}
            color="bg-cyan-600"
          />
        </div>
      </div>

      {activeSubTab === "screens" && (
        <ScreenStock
          project={project}
          canAdd={canAdd}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}
    </div>
  );
}

function SubTabButton({ label, active, onClick, color }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 h-8 rounded-md text-[10px] font-black whitespace-nowrap ${
        active ? `${color} text-white` : "bg-slate-900 text-slate-400"
      }`}
    >
      {label}
    </button>
  );
}
