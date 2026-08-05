import { useState } from "react";

import PromotionTransactions from "./PromotionTransactions";
import PromotionBalances from "./PromotionBalances";
import ServiceTransactions from "./ServiceTransactions";
import Expenses from "./Expenses";
import Campaigns from "./Campaigns";
import ServicesAnalytics from "./ServicesAnalytics";
import MarketingReports from "./MarketingReports";

const formatNumberInput=v=>String(v??"").replace(/\D/g,"").replace(/\B(?=(\d{3})+(?!\d))/g,",");
const parseNumberInput=v=>String(v??"").replace(/,/g,"").replace(/\D/g,"");
export default function MarketingTabs({
  project,
  canAdd,
  canEdit,
  canDelete,
  canReports,
}) {
  const [activeTab, setActiveTab] = useState("promotion");

  const tabs = [
    { id: "promotion", label: "الترويج", show: true },
    { id: "balances", label: "أمانات الترويج", show: true },
    { id: "services", label: "الخدمات", show: true },
    { id: "expenses", label: "الصرف", show: true },
    { id: "campaigns", label: "الحملات", show: true },
    { id: "analytics", label: "التحليل", show: canReports },
    { id: "reports", label: "التقارير", show: canReports },
  ].filter((tab) => tab.show);

  return (
    <div className="space-y-2">
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-1 overflow-x-auto text-slate-900 dark:text-white">
        <div className="flex gap-1 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-3
                h-8
                rounded-md
                text-[10px]
                font-black
                whitespace-nowrap
                ${
                  activeTab === tab.id
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "promotion" && (
        <PromotionTransactions
          project={project}
          canAdd={canAdd}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}

      {activeTab === "balances" && (
        <PromotionBalances
          project={project}
          canAdd={canAdd}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}

      {activeTab === "services" && (
        <ServiceTransactions
          project={project}
          canAdd={canAdd}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}

      {activeTab === "expenses" && (
        <Expenses
          project={project}
          canAdd={canAdd}
          canDelete={canDelete}
        />
      )}

      {activeTab === "campaigns" && (
        <Campaigns
          project={project}
          canAdd={canAdd}
          canDelete={canDelete}
        />
      )}

      {activeTab === "analytics" && canReports && (
        <ServicesAnalytics project={project} />
      )}

      {activeTab === "reports" && canReports && (
        <MarketingReports project={project} canDelete={canDelete} />
      )}
    </div>
  );
}
