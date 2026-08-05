import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase/client";

export default function UsersManagement() {
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    project_id: "",

    can_view: true,
    can_add: true,
    can_edit: false,
    can_delete: false,

    can_pages_dashboard: true,
    can_campaigns: false,
    can_delegates: false,
    can_delegate_profits: false,
    can_user_orders: false,
    can_add_user_order: false,
    can_user_profits: false,
    can_wallet: false,
    can_balance: false,
    can_order_bot: false,
    can_reports: false,

    is_active: true,
    profit_percent: 0,
  });

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      setLoading(true);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: projectsData } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: membersData } = await supabase
        .from("project_members")
        .select("*");

      setUsers(profiles || []);
      setProjects(projectsData || []);
      setMembers(membersData || []);
    } catch (err) {
      console.error(err);
      alert(err.message || "فشل تحميل المستخدمين");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({
      email: "",
      password: "",
      full_name: "",
      project_id: "",

      can_view: true,
      can_add: true,
      can_edit: false,
      can_delete: false,

      can_pages_dashboard: true,
      can_campaigns: false,
      can_delegates: false,
      can_delegate_profits: false,
      can_user_orders: false,
      can_add_user_order: false,
      can_user_profits: false,
      can_wallet: false,
      can_balance: false,
      can_order_bot: false,
      can_reports: false,

      is_active: true,
      profit_percent: 0,
    });
  }

  async function createUser(e) {
    e.preventDefault();

    if (!form.email.trim()) return alert("اكتب الإيميل");
    if (!form.password.trim()) return alert("اكتب كلمة المرور");
    if (!form.project_id) return alert("اختر المشروع");

    try {
      setSaving(true);

      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password.trim(),
        options: {
          data: {
            full_name: form.full_name.trim(),
            role: "user",
          },
        },
      });

      if (error) throw error;

      const userId = data?.user?.id;
      if (!userId) {
        throw new Error("تم إنشاء الحساب لكن لم يتم إرجاع معرف المستخدم");
      }

      await supabase.from("profiles").upsert({
        id: userId,
        email: form.email.trim(),
        full_name: form.full_name.trim() || form.email.trim(),
        role: "user",
        is_active: form.is_active,
        created_at: new Date().toISOString(),
      });

      const { error: memberError } = await supabase
        .from("project_members")
        .upsert({
          project_id: form.project_id,
          user_id: userId,

          can_view: form.can_view,
          can_add: form.can_add,
          can_edit: form.can_edit,
          can_delete: form.can_delete,

          can_pages_dashboard: form.can_pages_dashboard,
          can_campaigns: form.can_campaigns,
          can_delegates: form.can_delegates,
          can_delegate_profits: form.can_delegate_profits,
          can_user_orders: form.can_user_orders,
          can_add_user_order: form.can_add_user_order,
          can_user_profits: form.can_user_profits,
          can_wallet: form.can_wallet,
          can_balance: form.can_balance,
          can_order_bot: form.can_order_bot,
          can_reports: form.can_reports,

          is_active: form.is_active,
          profit_percent: Number(form.profit_percent || 0),
        });

      if (memberError) throw memberError;

      resetForm();

      alert("تم إنشاء المستخدم وربطه بالمشروع");
      await loadAll();
    } catch (err) {
      console.error(err);
      alert(err.message || "فشل إنشاء المستخدم");
    } finally {
      setSaving(false);
    }
  }

  async function toggleUserActive(user) {
    try {
      const next = !user.is_active;

      const { error } = await supabase
        .from("profiles")
        .update({ is_active: next })
        .eq("id", user.id);

      if (error) throw error;

      await supabase
        .from("project_members")
        .update({ is_active: next })
        .eq("user_id", user.id);

      await loadAll();
    } catch (err) {
      console.error(err);
      alert(err.message || "فشل تحديث حالة المستخدم");
    }
  }

  async function updateMember(memberId, patch) {
    try {
      const { error } = await supabase
        .from("project_members")
        .update(patch)
        .eq("id", memberId);

      if (error) throw error;

      await loadAll();
    } catch (err) {
      console.error(err);
      alert(err.message || "فشل تحديث الصلاحيات");
    }
  }

  const userRows = useMemo(() => {
    return users
      .filter((u) => u.role !== "admin")
      .map((user) => {
        const userMembers = members.filter((m) => m.user_id === user.id);

        return {
          ...user,
          memberships: userMembers,
        };
      });
  }, [users, members]);

  return (
    <div className="space-y-3" dir="rtl">
      <div className="bg-gradient-to-l from-blue-700 to-slate-950 border border-blue-500/20 rounded-xl p-3">
        <h1 className="text-lg font-black text-white">إدارة المستخدمين</h1>
        <p className="text-[11px] text-blue-100 mt-1">
          إنشاء حسابات وربط المستخدمين بالمشاريع وتحديد الصلاحيات.
        </p>
      </div>

      <form
        onSubmit={createUser}
        className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-3"
      >
        <h2 className="text-sm font-black text-white">إضافة مستخدم جديد</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Input
            label="اسم المستخدم"
            value={form.full_name}
            onChange={(v) => setForm({ ...form, full_name: v })}
          />

          <Input
            label="الإيميل"
            type="email"
            value={form.email}
            onChange={(v) => setForm({ ...form, email: v })}
          />

          <Input
            label="كلمة المرور"
            type="password"
            value={form.password}
            onChange={(v) => setForm({ ...form, password: v })}
          />

          <label className="space-y-1 block">
            <span className="block text-[10px] text-slate-400 font-bold">
              المشروع
            </span>
            <select
              value={form.project_id}
              onChange={(e) => setForm({ ...form, project_id: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 h-9 text-[12px] text-white outline-none"
            >
              <option value="">اختر المشروع</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name || project.title || project.type}
                </option>
              ))}
            </select>
          </label>

          <Input
            label="نسبة الربح %"
            type="number"
            value={form.profit_percent}
            onChange={(v) => setForm({ ...form, profit_percent: v })}
          />
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-2 space-y-2">
          <h3 className="text-[11px] font-black text-white">
            صلاحيات عامة
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Check
              label="مشاهدة"
              checked={form.can_view}
              onChange={(v) => setForm({ ...form, can_view: v })}
            />

            <Check
              label="إضافة"
              checked={form.can_add}
              onChange={(v) => setForm({ ...form, can_add: v })}
            />

            <Check
              label="تعديل"
              checked={form.can_edit}
              onChange={(v) => setForm({ ...form, can_edit: v })}
            />

            <Check
              label="حذف"
              checked={form.can_delete}
              onChange={(v) => setForm({ ...form, can_delete: v })}
            />

            <Check
              label="الحساب فعال"
              checked={form.is_active}
              onChange={(v) => setForm({ ...form, is_active: v })}
            />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-2 space-y-2">
          <h3 className="text-[11px] font-black text-white">
            صلاحيات تبويبات بيجاتي
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Check
              label="الرئيسية"
              checked={form.can_pages_dashboard}
              onChange={(v) =>
                setForm({ ...form, can_pages_dashboard: v })
              }
            />

            <Check
              label="الحملات"
              checked={form.can_campaigns}
              onChange={(v) => setForm({ ...form, can_campaigns: v })}
            />

            <Check
              label="المندوبين"
              checked={form.can_delegates}
              onChange={(v) => setForm({ ...form, can_delegates: v })}
            />

            <Check
              label="أرباح المندوب"
              checked={form.can_delegate_profits}
              onChange={(v) =>
                setForm({ ...form, can_delegate_profits: v })
              }
            />

            <Check
              label="طلبات المندوبين"
              checked={form.can_user_orders}
              onChange={(v) => setForm({ ...form, can_user_orders: v })}
            />

            <Check
              label="إضافة طلب"
              checked={form.can_add_user_order}
              onChange={(v) => setForm({ ...form, can_add_user_order: v })}
            />

            <Check
              label="أرباح الطلبات"
              checked={form.can_user_profits}
              onChange={(v) => setForm({ ...form, can_user_profits: v })}
            />

            <Check
              label="محفظتي"
              checked={form.can_wallet}
              onChange={(v) => setForm({ ...form, can_wallet: v })}
            />

            <Check
              label="الرصيد"
              checked={form.can_balance}
              onChange={(v) => setForm({ ...form, can_balance: v })}
            />

            <Check
              label="بوت الطلبات"
              checked={form.can_order_bot}
              onChange={(v) => setForm({ ...form, can_order_bot: v })}
            />

            <Check
              label="التقارير"
              checked={form.can_reports}
              onChange={(v) => setForm({ ...form, can_reports: v })}
            />
          </div>
        </div>

        <button
          disabled={saving}
          className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[12px] font-black"
        >
          {saving ? "جاري الإنشاء..." : "إنشاء المستخدم وربطه بالمشروع"}
        </button>
      </form>

      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-slate-800">
          <h2 className="text-sm font-black text-white">المستخدمون</h2>

          <button
            onClick={loadAll}
            className="bg-slate-800 hover:bg-slate-700 px-3 h-8 rounded-md text-[10px] font-black text-white"
          >
            تحديث
          </button>
        </div>

        {loading ? (
          <Empty text="جاري تحميل المستخدمين..." />
        ) : userRows.length === 0 ? (
          <Empty text="لا يوجد مستخدمون" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="p-2 text-right">المستخدم</th>
                  <th className="p-2 text-right">الإيميل</th>
                  <th className="p-2 text-right">الحالة</th>
                  <th className="p-2 text-right">المشاريع</th>
                  <th className="p-2 text-right">إجراء</th>
                </tr>
              </thead>

              <tbody>
                {userRows.map((user) => (
                  <tr
                    key={user.id}
                    className="border-t border-slate-800 text-slate-200"
                  >
                    <td className="p-2 font-black">
                      {user.full_name || user.name || "مستخدم"}
                    </td>

                    <td className="p-2">{user.email || "-"}</td>

                    <td className="p-2">
                      <span
                        className={`px-2 py-1 rounded-md border text-[9px] font-black ${
                          user.is_active === false
                            ? "bg-red-500/10 text-red-400 border-red-500/30"
                            : "bg-green-500/10 text-green-400 border-green-500/30"
                        }`}
                      >
                        {user.is_active === false ? "متوقف" : "فعال"}
                      </span>
                    </td>

                    <td className="p-2 min-w-[680px]">
                      <div className="space-y-1">
                        {user.memberships.length === 0 ? (
                          <span className="text-slate-500">
                            غير مربوط بمشروع
                          </span>
                        ) : (
                          user.memberships.map((member) => {
                            const project = projects.find(
                              (p) => p.id === member.project_id
                            );

                            return (
                              <div
                                key={member.id}
                                className="bg-slate-900 border border-slate-800 rounded-lg p-2 space-y-2"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-black text-white">
                                    {project?.name || project?.title || "مشروع"}
                                  </span>

                                  <SmallCheck
                                    label="عرض"
                                    checked={member.can_view}
                                    onChange={(v) =>
                                      updateMember(member.id, { can_view: v })
                                    }
                                  />

                                  <SmallCheck
                                    label="إضافة"
                                    checked={member.can_add}
                                    onChange={(v) =>
                                      updateMember(member.id, { can_add: v })
                                    }
                                  />

                                  <SmallCheck
                                    label="تعديل"
                                    checked={member.can_edit}
                                    onChange={(v) =>
                                      updateMember(member.id, { can_edit: v })
                                    }
                                  />

                                  <SmallCheck
                                    label="حذف"
                                    checked={member.can_delete}
                                    onChange={(v) =>
                                      updateMember(member.id, { can_delete: v })
                                    }
                                  />

                                  <input
                                    type="number"
                                    value={member.profit_percent || 0}
                                    onChange={(e) =>
                                      updateMember(member.id, {
                                        profit_percent: Number(
                                          e.target.value || 0
                                        ),
                                      })
                                    }
                                    className="w-20 bg-slate-950 border border-slate-700 rounded-md px-2 h-7 text-white"
                                  />

                                  <span className="text-slate-500">%</span>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-2">
                                  <SmallCheck
                                    label="الرئيسية"
                                    checked={member.can_pages_dashboard}
                                    onChange={(v) =>
                                      updateMember(member.id, {
                                        can_pages_dashboard: v,
                                      })
                                    }
                                  />

                                  <SmallCheck
                                    label="الحملات"
                                    checked={member.can_campaigns}
                                    onChange={(v) =>
                                      updateMember(member.id, {
                                        can_campaigns: v,
                                      })
                                    }
                                  />

                                  <SmallCheck
                                    label="المندوبين"
                                    checked={member.can_delegates}
                                    onChange={(v) =>
                                      updateMember(member.id, {
                                        can_delegates: v,
                                      })
                                    }
                                  />

                                  <SmallCheck
                                    label="أرباح المندوب"
                                    checked={member.can_delegate_profits}
                                    onChange={(v) =>
                                      updateMember(member.id, {
                                        can_delegate_profits: v,
                                      })
                                    }
                                  />

                                  <SmallCheck
                                    label="طلبات المندوبين"
                                    checked={member.can_user_orders}
                                    onChange={(v) =>
                                      updateMember(member.id, {
                                        can_user_orders: v,
                                      })
                                    }
                                  />

                                  <SmallCheck
                                    label="إضافة طلب"
                                    checked={member.can_add_user_order}
                                    onChange={(v) =>
                                      updateMember(member.id, {
                                        can_add_user_order: v,
                                      })
                                    }
                                  />

                                  <SmallCheck
                                    label="أرباح الطلبات"
                                    checked={member.can_user_profits}
                                    onChange={(v) =>
                                      updateMember(member.id, {
                                        can_user_profits: v,
                                      })
                                    }
                                  />

                                  <SmallCheck
                                    label="محفظتي"
                                    checked={member.can_wallet}
                                    onChange={(v) =>
                                      updateMember(member.id, { can_wallet: v })
                                    }
                                  />

                                  <SmallCheck
                                    label="الرصيد"
                                    checked={member.can_balance}
                                    onChange={(v) =>
                                      updateMember(member.id, {
                                        can_balance: v,
                                      })
                                    }
                                  />

                                  <SmallCheck
                                    label="بوت الطلبات"
                                    checked={member.can_order_bot}
                                    onChange={(v) =>
                                      updateMember(member.id, {
                                        can_order_bot: v,
                                      })
                                    }
                                  />

                                  <SmallCheck
                                    label="التقارير"
                                    checked={member.can_reports}
                                    onChange={(v) =>
                                      updateMember(member.id, {
                                        can_reports: v,
                                      })
                                    }
                                  />
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </td>

                    <td className="p-2">
                      <button
                        onClick={() => toggleUserActive(user)}
                        className={`px-3 h-8 rounded-md text-[10px] font-black ${
                          user.is_active === false
                            ? "bg-green-600 text-white"
                            : "bg-red-600 text-white"
                        }`}
                      >
                        {user.is_active === false ? "تفعيل" : "إيقاف"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text" }) {
  return (
    <label className="space-y-1 block">
      <span className="block text-[10px] text-slate-400 font-bold">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 h-9 text-[12px] text-white outline-none focus:border-blue-500"
      />
    </label>
  );
}

function Check({ label, checked, onChange }) {
  return (
    <label className="bg-slate-900 border border-slate-800 rounded-lg px-3 h-9 flex items-center gap-2 text-[11px] text-white font-bold">
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function SmallCheck({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-1 text-[9px] text-slate-300 whitespace-nowrap">
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function Empty({ text }) {
  return (
    <div className="p-6 text-center text-[11px] text-slate-400">
      {text}
    </div>
  );
}