import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase/client";

const formatNumberInput=v=>String(v??"").replace(/\D/g,"").replace(/\B(?=(\d{3})+(?!\d))/g,",");
const parseNumberInput=v=>String(v??"").replace(/,/g,"").replace(/\D/g,"");
export default function ServicesAnalytics({ project }) {

  const [services, setServices] = useState([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {

    try {

      setLoading(true);

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("project_id", project.id)
        .eq("type", "income");

      if (error) throw error;

      const grouped = {};

      data.forEach((item) => {

        if (!grouped[item.service_type]) {

          grouped[item.service_type] = {
            service: item.service_type,
            totalIncome: 0,
            totalProfit: 0,
            totalAdSpend: 0,
            operationsCount: 0,
          };

        }

        grouped[item.service_type].totalIncome += Number(
          item.amount_received || 0
        );

        grouped[item.service_type].totalProfit += Number(
          item.company_profit || 0
        );

        grouped[item.service_type].totalAdSpend += Number(
          item.ad_spend_amount || 0
        );

        grouped[item.service_type].operationsCount += 1;

      });

      setServices(Object.values(grouped));

    } catch (err) {

      console.log(err);

    } finally {

      setLoading(false);

    }

  }

  function serviceName(service) {

    switch (service) {

      case "promotion":
        return "ترويج";

      case "programming":
        return "برمجة";

      case "design":
        return "تصميم";

      case "video_editing":
        return "مونتاج";

      case "consulting":
        return "استشارة";

      default:
        return "أخرى";

    }

  }

  return (

    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">

      {/* Header */}

      <div className="flex items-center justify-between mb-2">

        <div>

          <h1 className="text-sm font-black">
            تحليل الخدمات
          </h1>

          <p className="text-[9px] text-slate-300">
            أرباح وأداء كل قسم
          </p>

        </div>

      </div>

      {/* Content */}

      {loading ? (

        <div className="text-center py-6 text-[10px] text-slate-300">
          جاري التحميل...
        </div>

      ) : services.length === 0 ? (

        <div className="text-center py-6 text-[10px] text-slate-300">
          لا توجد بيانات
        </div>

      ) : (

        <div className="grid grid-cols-2 md:grid-cols-3 gap-1">

          {services.map((service) => (

            <div
              key={service.service}
              className="bg-slate-900 border border-slate-800 rounded-md p-2"
            >

              <div className="mb-2">

                <h1 className="text-[11px] font-black leading-none">
                  {serviceName(service.service)}
                </h1>

                <p className="text-[8px] text-slate-300 mt-1">
                  العمليات:
                  <span className="text-white mr-1">
                    {service.operationsCount}
                  </span>
                </p>

              </div>

              <div className="space-y-1">

                <MiniBox
                  title="الدخل"
                  value={service.totalIncome}
                  color="text-green-400"
                />

                <MiniBox
                  title="الربح"
                  value={service.totalProfit}
                  color="text-blue-400"
                />

                <MiniBox
                  title="الترويج"
                  value={service.totalAdSpend}
                  color="text-red-400"
                />

              </div>

            </div>

          ))}

        </div>

      )}

    </div>

  );

}

function MiniBox({
  title,
  value,
  color,
}) {

  return (

    <div className="bg-slate-950 rounded-md p-2">

      <p className="text-[8px] text-slate-300 mb-1">
        {title}
      </p>

      <h2 className={`text-[10px] font-black ${color}`}>
        {Number(value || 0).toLocaleString()}
      </h2>

    </div>

  );

}