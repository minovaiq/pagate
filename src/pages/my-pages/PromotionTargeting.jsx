import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase/client";


const IRAQ_GEOJSON_SOURCES = [
  "https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_IRQ_1.json",
  "https://super-duper.fr/geojson/prov/gadm41_IRQ_1.json",
];

const GADM_NAME_TO_KEY = {
  "Dihok": "duhok",
  "Arbil": "erbil",
  "As-Sulaymaniyah": "sulaymaniyah",
  "Ninawa": "nineveh",
  "At-Ta'mim": "kirkuk",
  "Sala ad-Din": "salahaddin",
  "Diyala": "diyala",
  "Al-Anbar": "anbar",
  "Baghdad": "baghdad",
  "Karbala'": "karbala",
  "Babil": "babil",
  "Wasit": "wasit",
  "Al-Qadisiyah": "qadisiyah",
  "An-Najaf": "najaf",
  "Maysan": "maysan",
  "Dhi-Qar": "dhiqar",
  "Al-Muthannia": "muthanna",
  "Al-Basrah": "basra",
};

const GOVERNORATES = [
  { key: "duhok", name: "دهوك", aliases: ["دهوك", "دهۆك", "dohuk", "duhok", "زاخو", "عقرة", "عقرا"] },
  { key: "erbil", name: "أربيل", aliases: ["اربيل", "أربيل", "هولير", "هەولێر", "erbil", "hawler", "شقلاوة", "كويسنجق"] },
  { key: "sulaymaniyah", name: "السليمانية", aliases: ["السليمانية", "سليمانية", "سلێمانی", "sulaymaniyah", "sulaimaniyah"] },
  { key: "halabja", name: "حلبجة", aliases: ["حلبجة", "حلبچه", "هەڵەبجە", "halabja"] },
  { key: "nineveh", name: "نينوى", aliases: ["نينوى", "نينوا", "الموصل", "موصل", "nineveh", "mosul", "تلعفر", "سنجار", "الحمدانية", "القيارة"] },
  { key: "kirkuk", name: "كركوك", aliases: ["كركوك", "التأميم", "kirkuk", "الحويجة", "داقوق", "دبس", "التون كوبري"] },
  { key: "salahaddin", name: "صلاح الدين", aliases: ["صلاح الدين", "صلاحالدين", "تكريت", "سامراء", "بلد", "بيجي", "الشرقاط", "الدور", "طوز خورماتو", "salah al din", "salahaddin", "tikrit"] },
  { key: "diyala", name: "ديالى", aliases: ["ديالى", "ديالا", "بعقوبة", "المقدادية", "الخالص", "خانقين", "جلولاء", "diyala", "baqubah"] },
  { key: "anbar", name: "الأنبار", aliases: ["الانبار", "الأنبار", "انبار", "الرمادي", "فلوجة", "الفلوجة", "القائم", "حديثة", "هيت", "الرطبة", "anbar", "ramadi", "fallujah"] },
  { key: "baghdad", name: "بغداد", aliases: ["بغداد", "baghdad", "الكرخ", "الرصافة", "الاعظمية", "الأعظمية", "الكاظمية", "المنصور", "مدينة الصدر", "الدورة"] },
  { key: "karbala", name: "كربلاء", aliases: ["كربلاء", "كربلا", "karbala", "الهندية", "عين التمر"] },
  { key: "babil", name: "بابل", aliases: ["بابل", "الحلة", "حلة", "المسيب", "المحاويل", "الهاشمية", "babylon", "babil", "hillah"] },
  { key: "wasit", name: "واسط", aliases: ["واسط", "الكوت", "كوت", "الصويرة", "النعمانية", "الحي", "بدرة", "wasit", "kut"] },
  { key: "qadisiyah", name: "القادسية", aliases: ["القادسية", "قادسية", "الديوانية", "ديوانية", "الشامية", "عفك", "qadisiyah", "diwaniyah"] },
  { key: "najaf", name: "النجف", aliases: ["النجف", "نجف", "الكوفة", "المناذرة", "المشخاب", "najaf", "kufa"] },
  { key: "maysan", name: "ميسان", aliases: ["ميسان", "العمارة", "عمارة", "المجر الكبير", "علي الغربي", "maysan", "amara"] },
  { key: "dhiqar", name: "ذي قار", aliases: ["ذي قار", "ذيقار", "الناصرية", "ناصرية", "الشطرة", "سوق الشيوخ", "الرفاعي", "dhi qar", "nasiriyah"] },
  { key: "muthanna", name: "المثنى", aliases: ["المثنى", "مثنى", "السماوة", "سماوة", "الرميثة", "الخضر", "muthanna", "samawah"] },
  { key: "basra", name: "البصرة", aliases: ["البصرة", "بصرة", "الزبير", "أبو الخصيب", "ابو الخصيب", "القرنة", "الفاو", "شط العرب", "basra", "basrah"] },
];

// خريطة مبسطة للمحافظات؛ الهدف منها عرض توزيع الطلبات بصرياً داخل لوحة التحكم.
const MAP_REGIONS = {
  duhok: "58,22 111,16 133,37 114,59 68,57 48,40",
  erbil: "118,59 165,44 198,58 187,94 146,104 113,86",
  sulaymaniyah: "188,68 226,62 248,82 237,108 205,115 181,101",
  halabja: "205,115 237,108 245,124 224,137 204,126",
  nineveh: "48,58 116,59 142,103 126,145 70,153 40,112",
  kirkuk: "142,105 186,95 205,128 185,158 142,153 126,144",
  salahaddin: "83,154 142,154 185,159 178,205 128,218 91,196",
  diyala: "184,158 224,134 247,153 238,202 199,218 177,204",
  anbar: "24,130 84,154 91,197 128,219 112,274 54,291 18,239",
  baghdad: "128,219 178,205 199,219 191,248 151,258 119,243",
  karbala: "105,247 149,258 147,287 108,298 88,274",
  babil: "149,258 190,248 204,277 180,302 146,288",
  wasit: "200,220 238,202 254,236 247,289 207,302 180,301 204,277",
  qadisiyah: "147,289 180,303 182,336 145,347 121,322",
  najaf: "88,274 108,299 145,288 121,322 144,347 111,378 72,343",
  maysan: "208,302 248,289 266,318 256,357 218,363 184,336",
  dhiqar: "145,348 183,336 218,364 207,399 162,405 135,382",
  muthanna: "73,344 111,379 135,383 161,406 138,438 86,431 58,393",
  basra: "208,365 256,358 272,391 253,433 218,452 188,422 207,399",
};

const STATUS_LABELS = {
  pending: "جديد",
  processing: "قيد التجهيز",
  delivered: "واصل",
  returned: "راجع",
  cancelled: "ملغي",
};

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectGovernorate(order) {
  // يدعم حقل المحافظة مستقبلاً إن تمت إضافته، ويعمل حالياً من العنوان.
  const source = normalizeText(
    [order.governorate, order.province, order.city, order.address]
      .filter(Boolean)
      .join(" ")
  );

  if (!source) return null;

  for (const governorate of GOVERNORATES) {
    if (
      governorate.aliases.some((alias) =>
        source.includes(normalizeText(alias))
      )
    ) {
      return governorate.key;
    }
  }

  return null;
}

function getFillLevel(count, maxCount) {
  if (!count || !maxCount) return "fill-slate-900";
  const ratio = count / maxCount;
  if (ratio >= 0.75) return "fill-blue-500";
  if (ratio >= 0.5) return "fill-blue-600";
  if (ratio >= 0.25) return "fill-blue-700";
  return "fill-blue-900";
}

export default function PromotionTargeting({ project }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGovernorate, setSelectedGovernorate] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [mapFeatures, setMapFeatures] = useState([]);
  const [mapSourceReady, setMapSourceReady] = useState(false);

  useEffect(() => {
    loadOrders();

    const channel = supabase
      .channel(`promotion-targeting-${project.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "page_orders" },
        () => loadOrders()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [project.id]);


  useEffect(() => {
    let cancelled = false;

    async function loadAccurateIraqMap() {
      for (const url of IRAQ_GEOJSON_SOURCES) {
        try {
          const response = await fetch(url, { cache: "force-cache" });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const geojson = await response.json();
          const features = Array.isArray(geojson?.features) ? geojson.features : [];

          const mapped = features
            .map((feature) => {
              const gadmName =
                feature?.properties?.NAME_1 ||
                feature?.properties?.name ||
                feature?.properties?.shapeName ||
                "";

              const key = GADM_NAME_TO_KEY[gadmName];
              if (!key || !feature?.geometry) return null;

              return {
                key,
                geometry: feature.geometry,
              };
            })
            .filter(Boolean);

          if (mapped.length >= 17) {
            if (!cancelled) {
              setMapFeatures(mapped);
              setMapSourceReady(true);
            }
            return;
          }
        } catch (error) {
          console.warn("تعذر تحميل مصدر خريطة العراق:", url, error);
        }
      }

      if (!cancelled) {
        setMapFeatures([]);
        setMapSourceReady(false);
      }
    }

    loadAccurateIraqMap();

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadOrders() {
    try {
      setLoading(true);

      // نجلب أولاً جميع المندوبين التابعين لهذا المشروع.
      // الطلبات نفسها مرتبطة بالمستخدم عبر user_id، وليس دائماً بـ delegate_id.
      const { data: delegatesData, error: delegatesError } = await supabase
        .from("delegates")
        .select("id, linked_user_id")
        .eq("project_id", project.id);

      if (delegatesError) throw delegatesError;

      const delegateUserIds = (delegatesData || [])
        .map((delegate) => delegate.linked_user_id)
        .filter(Boolean);

      // 1) الطلبات المرتبطة مباشرة بالمشروع/بيجاتي.
      const { data: directOrders, error: directError } = await supabase
        .from("page_orders")
        .select("*")
        .or(`project_id.eq.${project.id},my_pages_project_id.eq.${project.id}`)
        .order("created_at", { ascending: false });

      if (directError) throw directError;

      // 2) طلبات مستخدمي المندوبين التابعين للمشروع.
      let delegateOrders = [];
      if (delegateUserIds.length > 0) {
        const { data, error } = await supabase
          .from("page_orders")
          .select("*")
          .in("user_id", delegateUserIds)
          .order("created_at", { ascending: false });

        if (error) throw error;
        delegateOrders = data || [];
      }

      // دمج المصدرين ومنع احتساب نفس الطلب مرتين.
      const uniqueOrders = new Map();
      [...(directOrders || []), ...delegateOrders].forEach((order) => {
        uniqueOrders.set(order.id, order);
      });

      const mergedOrders = Array.from(uniqueOrders.values()).sort(
        (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
      );

      console.log("Promotion targeting:", {
        projectId: project.id,
        delegates: (delegatesData || []).length,
        delegateUsers: delegateUserIds.length,
        directOrders: (directOrders || []).length,
        delegateOrders: delegateOrders.length,
        totalOrders: mergedOrders.length,
      });

      setOrders(mergedOrders);
    } catch (err) {
      console.error(err);
      alert(err.message || "فشل تحميل بيانات استهداف الترويج");
    } finally {
      setLoading(false);
    }
  }

  const filteredOrders = useMemo(() => {
    if (statusFilter === "all") return orders;
    return orders.filter((order) => order.status === statusFilter);
  }, [orders, statusFilter]);

  const analytics = useMemo(() => {
    const byGovernorate = Object.fromEntries(
      GOVERNORATES.map((gov) => [
        gov.key,
        {
          ...gov,
          total: 0,
          delivered: 0,
          returned: 0,
          cancelled: 0,
          pending: 0,
          processing: 0,
        },
      ])
    );

    let unknown = 0;

    filteredOrders.forEach((order) => {
      const key = detectGovernorate(order);
      if (!key || !byGovernorate[key]) {
        unknown += 1;
        return;
      }

      const row = byGovernorate[key];
      row.total += 1;
      if (row[order.status] !== undefined) row[order.status] += 1;
    });

    const rows = Object.values(byGovernorate)
      .map((item) => ({
        ...item,
        successRate:
          item.total > 0
            ? Math.round((item.delivered / item.total) * 100)
            : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      rows,
      byGovernorate,
      unknown,
      total: filteredOrders.length,
      maxCount: Math.max(0, ...rows.map((item) => item.total)),
      activeGovernorates: rows.filter((item) => item.total > 0).length,
    };
  }, [filteredOrders]);

  const best = analytics.rows[0];

  const statusCounts = useMemo(() => {
    const counts = {
      pending: 0,
      processing: 0,
      delivered: 0,
      returned: 0,
      cancelled: 0,
    };

    filteredOrders.forEach((order) => {
      if (counts[order.status] !== undefined) counts[order.status] += 1;
    });

    return counts;
  }, [filteredOrders]);

  const percentageOfTotal = (value) =>
    analytics.total > 0 ? ((Number(value || 0) / analytics.total) * 100).toFixed(1) : "0.0";

  const selected = selectedGovernorate
    ? analytics.byGovernorate[selectedGovernorate]
    : null;

  return (
    <div
      className="min-h-full rounded-2xl border border-[#172844] bg-[#07111f] p-3 text-white shadow-[0_20px_70px_rgba(0,0,0,.28)]"
      dir="rtl"
    >
      {/* Header */}
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-blue-500/30 bg-blue-500/10 shadow-[0_0_28px_rgba(59,130,246,.14)]">
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-blue-400" strokeWidth="1.8">
              <circle cx="12" cy="12" r="5.5" />
              <circle cx="12" cy="12" r="2" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          </div>

          <div>
            <h2 className="text-[18px] font-black tracking-tight text-white">استهداف الترويج</h2>
            <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
              توزيع الطلبات حسب المحافظات
            </p>
          </div>
        </div>

        <button
          onClick={loadOrders}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-blue-500/35 bg-blue-500/10 px-4 text-[10px] font-black text-blue-300 transition hover:bg-blue-500/20"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
            <path d="M20 6v5h-5" />
            <path d="M4 18v-5h5" />
            <path d="M18.4 9A7 7 0 0 0 6.5 6.5L4 9M20 15l-2.5 2.5A7 7 0 0 1 5.6 15" />
          </svg>
          تحديث البيانات
        </button>
      </div>

      {/* Filters */}
      <div className="mb-3 rounded-xl border border-[#172844] bg-[#0a1525] p-3">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
          <div className="w-full xl:max-w-[260px]">
            <label className="mb-1 block text-[9px] font-bold text-slate-500">حالة الطلب</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 w-full rounded-lg border border-[#203453] bg-[#081321] px-3 text-[10px] font-bold text-slate-200 outline-none focus:border-blue-500/60"
            >
              <option value="all">كل الحالات</option>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div className="text-[9px] text-slate-500">
            آخر تحديث: الآن
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <DashboardStat
          title="إجمالي الطلبات"
          value={analytics.total}
          percent="100%"
          tone="blue"
          icon="bag"
        />
        <DashboardStat
          title="الطلبات الجديدة"
          value={statusCounts.pending}
          percent={`${percentageOfTotal(statusCounts.pending)}%`}
          tone="green"
          icon="doc"
        />
        <DashboardStat
          title="قيد التجهيز"
          value={statusCounts.processing}
          percent={`${percentageOfTotal(statusCounts.processing)}%`}
          tone="orange"
          icon="box"
        />
        <DashboardStat
          title="تم التوصيل"
          value={statusCounts.delivered}
          percent={`${percentageOfTotal(statusCounts.delivered)}%`}
          tone="emerald"
          icon="check"
        />
        <DashboardStat
          title="المرتجعة"
          value={statusCounts.returned}
          percent={`${percentageOfTotal(statusCounts.returned)}%`}
          tone="red"
          icon="return"
        />
        <DashboardStat
          title="الملغية"
          value={statusCounts.cancelled}
          percent={`${percentageOfTotal(statusCounts.cancelled)}%`}
          tone="slate"
          icon="x"
        />
      </div>

      {loading ? (
        <div className="grid min-h-[560px] place-items-center rounded-xl border border-[#172844] bg-[#081321]">
          <div className="text-center">
            <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-blue-400/20 border-t-blue-400" />
            <p className="text-[10px] font-bold text-slate-500">جاري تحميل بيانات المحافظات...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[360px_minmax(0,1fr)]">
          {/* Ranking */}
          <section className="overflow-hidden rounded-xl border border-[#172844] bg-[#081321]">
            <div className="border-b border-[#172844] px-4 py-3">
              <h3 className="text-[11px] font-black text-white">ترتيب المحافظات حسب عدد الطلبات</h3>
            </div>

            <div className="grid grid-cols-[34px_1fr_74px_78px] border-b border-[#172844] bg-[#0a1728] px-3 py-2 text-[8px] font-black text-slate-400">
              <span>#</span>
              <span>المحافظة</span>
              <span className="text-center">عدد الطلبات</span>
              <span className="text-center">النسبة</span>
            </div>

            <div className="max-h-[650px] overflow-y-auto">
              {analytics.rows.map((item, index) => {
                const share = analytics.total > 0 ? (item.total / analytics.total) * 100 : 0;
                return (
                  <button
                    key={item.key}
                    onClick={() => setSelectedGovernorate(item.key)}
                    className={`group grid w-full grid-cols-[34px_1fr_74px_78px] items-center border-b border-[#13233b] px-3 py-2 text-right transition hover:bg-blue-500/[0.06] ${
                      selectedGovernorate === item.key ? "bg-blue-500/[0.09]" : ""
                    }`}
                  >
                    <span className="text-[9px] font-black text-slate-500">{index + 1}</span>

                    <div className="min-w-0 pl-2">
                      <p className="truncate text-[9px] font-black text-slate-200">{item.name}</p>
                      <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-[#13233b]">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-500"
                          style={{ width: `${Math.max(0, Math.min(100, share))}%` }}
                        />
                      </div>
                    </div>

                    <span className="text-center text-[10px] font-black text-slate-100">
                      {Number(item.total || 0).toLocaleString()}
                    </span>

                    <span className="text-center text-[9px] font-bold text-slate-400">
                      {share.toFixed(1)}%
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Map */}
          <section className="relative min-h-[690px] overflow-hidden rounded-xl border border-[#172844] bg-[radial-gradient(circle_at_55%_45%,rgba(29,78,216,.08),transparent_34%),linear-gradient(180deg,#081321_0%,#07111f_100%)]">
            <div className="flex items-center justify-between border-b border-[#172844] px-4 py-3">
              <div>
                <h3 className="text-[12px] font-black text-white">توزيع الطلبات على خريطة العراق</h3>
                <p className="mt-1 text-[8px] font-semibold text-slate-500">
                  اضغط على أي محافظة لعرض تفاصيل الأداء
                </p>
              </div>
            </div>

            {/* Legend */}
            <div className="absolute right-4 top-[74px] z-10 w-[118px] rounded-xl border border-[#203453] bg-[#091525]/95 p-3 shadow-2xl backdrop-blur">
              <p className="mb-2 text-[8px] font-black text-slate-200">مستوى الطلبات</p>
              <div className="space-y-1.5">
                {[
                  ["#14233b", "0"],
                  ["#1e3a8a", "منخفض"],
                  ["#1d4ed8", "متوسط"],
                  ["#2563eb", "مرتفع"],
                  ["#16a34a", "قوي"],
                  ["#f59e0b", "قوي جداً"],
                  ["#dc2626", "الأعلى"],
                ].map(([color, label]) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded-sm border border-white/10" style={{ backgroundColor: color }} />
                    <span className="text-[7px] font-bold text-slate-400">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex min-h-[620px] items-center justify-center px-3 py-4">
              {mapSourceReady ? (
                <AccurateIraqMap
                  features={mapFeatures}
                  analytics={analytics}
                  selectedGovernorate={selectedGovernorate}
                  onSelect={setSelectedGovernorate}
                />
              ) : (
                <FallbackIraqMap
                  analytics={analytics}
                  selectedGovernorate={selectedGovernorate}
                  onSelect={setSelectedGovernorate}
                />
              )}
            </div>

            {/* Zoom-look controls */}
            <div className="absolute bottom-5 left-4 z-10 overflow-hidden rounded-lg border border-[#203453] bg-[#091525]/95 shadow-xl">
              <button className="grid h-8 w-8 place-items-center border-b border-[#203453] text-lg font-light text-slate-300 hover:bg-white/5">+</button>
              <button className="grid h-8 w-8 place-items-center text-lg font-light text-slate-300 hover:bg-white/5">−</button>
            </div>

            {/* Governorate details popup */}
            {selected && (
              <div className="absolute bottom-5 right-4 z-20 w-[205px] rounded-xl border border-[#2a4265] bg-[#091525]/95 p-3 shadow-2xl backdrop-blur">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,.8)]" />
                    <h4 className="text-[10px] font-black text-white">{selected.name}</h4>
                  </div>
                  <button
                    onClick={() => setSelectedGovernorate(null)}
                    className="grid h-5 w-5 place-items-center rounded text-[12px] text-slate-500 hover:bg-white/5 hover:text-white"
                  >
                    ×
                  </button>
                </div>

                <DetailRow label="إجمالي الطلبات" value={selected.total} color="text-white" />
                <DetailRow label="تم التوصيل" value={selected.delivered} color="text-emerald-400" />
                <DetailRow label="قيد التجهيز" value={selected.processing} color="text-blue-400" />
                <DetailRow label="المرتجعة" value={selected.returned} color="text-orange-400" />
                <DetailRow label="الملغية" value={selected.cancelled} color="text-red-400" />

                <div className="mt-2 border-t border-[#203453] pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-bold text-slate-500">نسبة التوصيل</span>
                    <span className="text-[9px] font-black text-sky-300">{selected.successRate || 0}%</span>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-[#173054] bg-blue-500/[0.035] px-3 py-2.5 text-center">
        <span className="text-[12px]">💡</span>
        <p className="text-[8px] font-bold text-blue-300">
          استخدم هذه البيانات لتحديد المحافظات ذات الأداء العالي والتركيز على زيادة الترويج في المحافظات ذات الطلب المنخفض.
        </p>
      </div>

      {analytics.unknown > 0 && (
        <div className="mt-2 rounded-xl border border-orange-500/20 bg-orange-500/[0.04] px-3 py-2 text-[8px] font-bold leading-5 text-orange-300">
          يوجد {analytics.unknown} طلب لم يتم تحديد محافظته من العنوان. كتابة اسم المحافظة أو القضاء بوضوح تجعل الخريطة أدق.
        </div>
      )}
    </div>
  );
}


function geometryToRings(geometry) {
  if (!geometry) return [];

  if (geometry.type === "Polygon") {
    return [geometry.coordinates || []];
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates || [];
  }

  return [];
}

function collectCoordinates(features) {
  const points = [];

  features.forEach((feature) => {
    geometryToRings(feature.geometry).forEach((polygon) => {
      polygon.forEach((ring) => {
        ring.forEach(([lon, lat]) => {
          if (Number.isFinite(lon) && Number.isFinite(lat)) points.push([lon, lat]);
        });
      });
    });
  });

  return points;
}

function buildProjection(features, width = 600, height = 690, padding = 26) {
  const points = collectCoordinates(features);

  if (!points.length) {
    return {
      project: ([x, y]) => [x, y],
      width,
      height,
    };
  }

  const lons = points.map(([lon]) => lon);
  const lats = points.map(([, lat]) => lat);

  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const lonSpan = Math.max(0.0001, maxLon - minLon);
  const latSpan = Math.max(0.0001, maxLat - minLat);

  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  const scale = Math.min(usableWidth / lonSpan, usableHeight / latSpan);
  const renderedWidth = lonSpan * scale;
  const renderedHeight = latSpan * scale;

  const offsetX = (width - renderedWidth) / 2;
  const offsetY = (height - renderedHeight) / 2;

  return {
    width,
    height,
    project: ([lon, lat]) => [
      offsetX + (lon - minLon) * scale,
      offsetY + (maxLat - lat) * scale,
    ],
  };
}

function geometryToPath(geometry, project) {
  return geometryToRings(geometry)
    .map((polygon) =>
      polygon
        .map((ring) => {
          if (!ring?.length) return "";
          return (
            ring
              .map((point, index) => {
                const [x, y] = project(point);
                return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
              })
              .join(" ") + " Z"
          );
        })
        .join(" ")
    )
    .join(" ");
}

function featureCenter(geometry, project) {
  const all = [];

  geometryToRings(geometry).forEach((polygon) => {
    polygon.forEach((ring) => {
      ring.forEach((point) => all.push(project(point)));
    });
  });

  if (!all.length) return [0, 0];

  return [
    all.reduce((sum, [x]) => sum + x, 0) / all.length,
    all.reduce((sum, [, y]) => sum + y, 0) / all.length,
  ];
}

function AccurateIraqMap({
  features,
  analytics,
  selectedGovernorate,
  onSelect,
}) {
  const projection = useMemo(() => buildProjection(features), [features]);

  return (
    <svg
      viewBox={`0 0 ${projection.width} ${projection.height}`}
      className="h-auto w-full max-w-[650px] drop-shadow-[0_28px_55px_rgba(0,0,0,.42)]"
      role="img"
      aria-label="خريطة العراق الحقيقية حسب حدود المحافظات"
    >
      <defs>
        <filter id="accurateMapGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow
            dx="0"
            dy="3"
            stdDeviation="4"
            floodColor="#2563eb"
            floodOpacity=".20"
          />
        </filter>

        <linearGradient id="mapEdgeGlow" x1="0" x2="1">
          <stop offset="0%" stopColor="#93c5fd" stopOpacity=".55" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity=".85" />
        </linearGradient>
      </defs>

      <g filter="url(#accurateMapGlow)">
        {features.map((feature) => {
          const stats = analytics.byGovernorate[feature.key];
          if (!stats) return null;

          const selected = selectedGovernorate === feature.key;

          return (
            <path
              key={feature.key}
              d={geometryToPath(feature.geometry, projection.project)}
              fill={getMapColor(stats.total, analytics.maxCount)}
              fillRule="evenodd"
              stroke={selected ? "#e0f2fe" : "#72a7d8"}
              strokeWidth={selected ? 2.8 : 1.15}
              vectorEffect="non-scaling-stroke"
              className="cursor-pointer transition-all duration-200 hover:brightness-125"
              onClick={() => onSelect(feature.key)}
            >
              <title>{`${stats.name}: ${stats.total} طلب`}</title>
            </path>
          );
        })}
      </g>

      {features.map((feature) => {
        const stats = analytics.byGovernorate[feature.key];
        if (!stats) return null;

        const [x, y] = featureCenter(feature.geometry, projection.project);

        return (
          <g
            key={`real-label-${feature.key}`}
            pointerEvents="none"
            transform={`translate(${x} ${y})`}
          >
            <text
              x="0"
              y="-4"
              textAnchor="middle"
              fill="#f8fafc"
              fontSize="11"
              fontWeight="800"
              style={{
                paintOrder: "stroke",
                stroke: "#06101d",
                strokeWidth: 3,
                strokeLinejoin: "round",
              }}
            >
              {stats.name}
            </text>
            <text
              x="0"
              y="12"
              textAnchor="middle"
              fill="#ffffff"
              fontSize="15"
              fontWeight="900"
              style={{
                paintOrder: "stroke",
                stroke: "#06101d",
                strokeWidth: 3.2,
                strokeLinejoin: "round",
              }}
            >
              {stats.total}
            </text>
          </g>
        );
      })}

      <path
        d={features
          .map((feature) => geometryToPath(feature.geometry, projection.project))
          .join(" ")}
        fill="none"
        stroke="url(#mapEdgeGlow)"
        strokeWidth="1"
        opacity=".55"
        pointerEvents="none"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function FallbackIraqMap({
  analytics,
  selectedGovernorate,
  onSelect,
}) {
  return (
    <svg
      viewBox="0 0 290 470"
      className="h-auto w-full max-w-[610px] drop-shadow-[0_28px_50px_rgba(0,0,0,.35)]"
      role="img"
      aria-label="خريطة توزيع الطلبات حسب محافظات العراق"
    >
      {GOVERNORATES.map((gov) => {
        const polygon = MAP_REGIONS[gov.key];
        if (!polygon) return null;

        const stats = analytics.byGovernorate[gov.key];
        const selected = selectedGovernorate === gov.key;

        return (
          <polygon
            key={gov.key}
            points={polygon}
            fill={getMapColor(stats.total, analytics.maxCount)}
            stroke={selected ? "#e0f2fe" : "#4b6485"}
            strokeWidth={selected ? 2.4 : 1.15}
            className="cursor-pointer transition-all duration-200 hover:brightness-125"
            onClick={() => onSelect(gov.key)}
          />
        );
      })}

      {GOVERNORATES.map((gov) => {
        const polygon = MAP_REGIONS[gov.key];
        if (!polygon) return null;

        const points = polygon.split(" ").map((p) => p.split(",").map(Number));
        const cx = points.reduce((sum, p) => sum + p[0], 0) / points.length;
        const cy = points.reduce((sum, p) => sum + p[1], 0) / points.length;
        const stats = analytics.byGovernorate[gov.key];

        return (
          <g key={`fallback-label-${gov.key}`} pointerEvents="none">
            <text
              x={cx}
              y={cy - 2}
              textAnchor="middle"
              fill="#f8fafc"
              fontSize="7.1"
              fontWeight="800"
            >
              {gov.name}
            </text>
            <text
              x={cx}
              y={cy + 8}
              textAnchor="middle"
              fill="#ffffff"
              fontSize="8.2"
              fontWeight="900"
            >
              {stats.total}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function getMapColor(count, maxCount) {
  if (!count || !maxCount) return "#14233b";

  const ratio = count / maxCount;

  if (ratio >= 0.85) return "#dc2626";
  if (ratio >= 0.65) return "#f59e0b";
  if (ratio >= 0.45) return "#16a34a";
  if (ratio >= 0.25) return "#2563eb";
  if (ratio >= 0.1) return "#1d4ed8";
  return "#1e3a8a";
}

function DashboardStat({ title, value, percent, tone, icon }) {
  const tones = {
    blue: "border-blue-500/45 bg-blue-500/[0.06] text-blue-400",
    green: "border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-400",
    emerald: "border-green-500/20 bg-green-500/[0.05] text-green-400",
    orange: "border-orange-500/20 bg-orange-500/[0.05] text-orange-400",
    red: "border-red-500/20 bg-red-500/[0.05] text-red-400",
    slate: "border-slate-600/30 bg-slate-500/[0.04] text-slate-400",
  };

  return (
    <div className={`relative overflow-hidden rounded-xl border p-3 ${tones[tone] || tones.blue}`}>
      <div className="absolute -left-5 -top-5 h-20 w-20 rounded-full bg-current opacity-[0.035]" />

      <div className="relative flex items-start justify-between gap-2">
        <div>
          <p className="text-[8px] font-bold text-slate-500">{title}</p>
          <p className="mt-1 text-[20px] font-black leading-none text-white">
            {Number(value || 0).toLocaleString()}
          </p>
          <p className="mt-2 text-[8px] font-black text-current">{percent}</p>
        </div>

        <div className="grid h-8 w-8 place-items-center rounded-lg bg-current/10">
          <StatIcon type={icon} />
        </div>
      </div>
    </div>
  );
}

function StatIcon({ type }) {
  const common = "h-4 w-4 fill-none stroke-current";

  if (type === "check") {
    return <svg viewBox="0 0 24 24" className={common} strokeWidth="1.8"><circle cx="12" cy="12" r="8"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>;
  }

  if (type === "return") {
    return <svg viewBox="0 0 24 24" className={common} strokeWidth="1.8"><path d="M8 7H4v-4"/><path d="M4 7c2-3 5-4 8-4a8 8 0 1 1-7.1 11.7"/></svg>;
  }

  if (type === "x") {
    return <svg viewBox="0 0 24 24" className={common} strokeWidth="1.8"><circle cx="12" cy="12" r="8"/><path d="m9 9 6 6m0-6-6 6"/></svg>;
  }

  if (type === "box") {
    return <svg viewBox="0 0 24 24" className={common} strokeWidth="1.8"><path d="m4 8 8-4 8 4v8l-8 4-8-4Z"/><path d="m4 8 8 4 8-4M12 12v8"/></svg>;
  }

  if (type === "doc") {
    return <svg viewBox="0 0 24 24" className={common} strokeWidth="1.8"><path d="M7 3h7l4 4v14H7Z"/><path d="M14 3v5h5M10 12h5M10 16h5"/></svg>;
  }

  return <svg viewBox="0 0 24 24" className={common} strokeWidth="1.8"><path d="M6 8h12l1 12H5L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/></svg>;
}

function DetailRow({ label, value, color }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[8px] font-bold text-slate-500">{label}</span>
      <span className={`text-[9px] font-black ${color}`}>{Number(value || 0).toLocaleString()}</span>
    </div>
  );
}