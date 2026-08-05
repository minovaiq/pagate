import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase/client";

export default function ActivityLogs() {
  const navigate = useNavigate();

  const today = new Date().toISOString().slice(0, 10);
  const firstDayOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  )
    .toISOString()
    .slice(0, 10);

  const [logs, setLogs] = useState([]);
  const [profiles, setProfiles] = useState([]);

  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(firstDayOfMonth);
  const [toDate, setToDate] = useState(today);
  const [userId, setUserId] = useState("");
  const [actionType, setActionType] = useState("");

  useEffect(() => {
    loadLogs();
    loadProfiles();
  }, [fromDate, toDate, userId, actionType]);

  async function loadProfiles() {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .order("full_name", { ascending: true });

    setProfiles(data || []);
  }

  async function loadLogs() {
    try {
      setLoading(true);

      let query = supabase
        .from("activity_logs")
        .select(`
          *,
          profiles:user_id (
            full_name,
            role
          ),
          projects:project_id (
            name,
            type
          )
        `)
        .gte("created_at", `${fromDate}T00:00:00`)
        .lte("created_at", `${toDate}T23:59:59`)
        .order("created_at", { ascending: false });

      if (userId) {
        query = query.eq("user_id", userId);
      }

      if (actionType) {
        query = query.eq("action_type", actionType);
      }

      const { data, error } = await query;

      if (error) throw error;

      setLogs(data || []);
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل تحميل سجل النشاطات");
    } finally {
      setLoading(false);
    }
  }

  function setTodayFilter() {
    setFromDate(today);
    setToDate(today);
  }

  function setMonthFilter() {
    setFromDate(firstDayOfMonth);
    setToDate(today);
  }

  function actionName(action) {
    switch (action) {
      case "create":
        return "إضافة";
      case "update":
        return "تعديل";
      case "delete":
        return "حذف";
      case "login":
        return "دخول";
      case "logout":
        return "خروج";
      case "permission_change":
        return "صلاحيات";
      default:
        return action || "-";
    }
  }

  function actionColor(action) {
    switch (action) {
      case "create":
        return "bg-green-600";
      case "update":
        return "bg-amber-600";
      case "delete":
        return "bg-red-600";
      case "login":
        return "bg-blue-600";
      case "logout":
        return "bg-slate-600";
      case "permission_change":
        return "bg-purple-600";
      default:
        return "bg-slate-700";
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-950 text-white text-[11px] p-2">
      <div className="max-w-[1400px] mx-auto space-y-2">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-2 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-black">سجل النشاطات</h1>
            <p className="text-[9px] text-slate-500 mt-1">
              متابعة الإضافات والتعديلات والحذف حسب الموظف
            </p>
          </div>

          <button
            onClick={() => navigate("/dashboard")}
            className="bg-slate-800 hover:bg-slate-700 rounded-md px-2 h-7 text-[9px] font-black"
          >
            رجوع
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-2">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-1">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none"
            />

            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none"
            />

            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none"
            >
              <option value="">كل الموظفين</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.full_name || "بدون اسم"} - {profile.role}
                </option>
              ))}
            </select>

            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none"
            >
              <option value="">كل العمليات</option>
              <option value="create">إضافة</option>
              <option value="update">تعديل</option>
              <option value="delete">حذف</option>
              <option value="login">دخول</option>
              <option value="logout">خروج</option>
              <option value="permission_change">صلاحيات</option>
            </select>

            <button
              onClick={setTodayFilter}
              className="bg-blue-600 hover:bg-blue-700 rounded-md h-8 text-[10px] font-black"
            >
              اليوم
            </button>

            <button
              onClick={setMonthFilter}
              className="bg-purple-600 hover:bg-purple-700 rounded-md h-8 text-[10px] font-black"
            >
              هذا الشهر
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
          <StatBox title="عدد النشاطات" value={logs.length} color="text-cyan-400" />
          <StatBox
            title="إضافات"
            value={logs.filter((item) => item.action_type === "create").length}
            color="text-green-400"
          />
          <StatBox
            title="تعديلات"
            value={logs.filter((item) => item.action_type === "update").length}
            color="text-amber-400"
          />
          <StatBox
            title="حذف"
            value={logs.filter((item) => item.action_type === "delete").length}
            color="text-red-400"
          />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-2">
          <h2 className="text-[11px] font-black mb-2">القائمة</h2>

          {loading ? (
            <div className="text-center text-slate-500 py-6 text-[10px]">
              جاري تحميل النشاطات...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center text-slate-500 py-6 text-[10px]">
              لا توجد نشاطات ضمن هذا الفلتر
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="bg-slate-950 border border-slate-800 rounded-md p-2"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <span
                          className={`${actionColor(
                            log.action_type
                          )} rounded-md px-2 py-1 text-[8px] font-black`}
                        >
                          {actionName(log.action_type)}
                        </span>

                        <h3 className="text-[11px] font-black">
                          {log.title || "-"}
                        </h3>
                      </div>

                      <p className="text-[9px] text-slate-500">
                        {log.details || "بدون تفاصيل"}
                      </p>
                    </div>

                    <div className="text-left min-w-[100px]">
                      <p className="text-[9px] font-black">
                        {log.profiles?.full_name || "مستخدم"}
                      </p>

                      <p className="text-[8px] text-slate-500">
                        {new Date(log.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1">
                    <MiniBox
                      title="المشروع"
                      value={log.projects?.name || "-"}
                      color="text-blue-400"
                    />

                    <MiniBox
                      title="الجدول"
                      value={log.table_name || "-"}
                    />

                    <MiniBox
                      title="Record"
                      value={log.record_id || "-"}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBox({ title, value, color }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-2">
      <p className="text-[8px] text-slate-500 mb-1">{title}</p>
      <h2 className={`text-[10px] font-black ${color}`}>{value}</h2>
    </div>
  );
}

function MiniBox({ title, value, color = "text-white" }) {
  return (
    <div className="bg-slate-900 rounded-md p-2">
      <p className="text-[8px] text-slate-500 mb-1 truncate">{title}</p>
      <h2 className={`text-[9px] font-black truncate ${color}`}>
        {value}
      </h2>
    </div>
  );
}