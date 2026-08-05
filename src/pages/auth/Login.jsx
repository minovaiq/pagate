import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase/client";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  async function handleLogin(e) {
    e.preventDefault();

    setNotice("");

    if (!email.trim() || !password.trim()) {
      setNotice("اكتب الإيميل والباسورد");
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setNotice("فشل تسجيل الدخول");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.role === "admin") {
        navigate("/dashboard");
        return;
      }

      const { data: member, error: memberError } = await supabase
        .from("project_members")
        .select("project_id")
        .eq("user_id", user.id)
        .eq("can_view", true)
        .limit(1)
        .maybeSingle();

      if (memberError) throw memberError;

      if (member?.project_id) {
        navigate(`/projects/${member.project_id}`);
        return;
      }

      await supabase.auth.signOut();
      setNotice("هذا الحساب غير مرتبط بأي مشروع. تواصل مع الأدمن لتفعيل الحساب.");
    } catch (err) {
      console.log(err);
      setNotice(err.message || "فشل تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-3"
    >
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl"
      >
        <div className="text-center mb-4">
          <h1 className="text-lg font-black">تسجيل الدخول</h1>
          <p className="text-[10px] text-slate-500 mt-1">
            نظام إدارة المشاريع والحسابات
          </p>
        </div>

        {notice && (
          <div className="bg-red-950 border border-red-800 text-red-200 rounded-lg p-2 mb-2 text-[10px] text-center">
            {notice}
          </div>
        )}

        <div className="space-y-2">
          <input
            type="email"
            placeholder="الإيميل"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 h-10 text-[12px] outline-none focus:border-blue-600"
          />

          <input
            type="password"
            placeholder="الباسورد"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 h-10 text-[12px] outline-none focus:border-blue-600"
          />

          <button
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg h-10 text-[12px] font-black"
          >
            {loading ? "جاري الدخول..." : "دخول"}
          </button>
        </div>
      </form>
    </div>
  );
}