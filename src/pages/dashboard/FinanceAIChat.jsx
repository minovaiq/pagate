import { useEffect, useRef, useState } from "react";
import { supabase } from "../../services/supabase/client";

export default function FinanceAIChat() {
  const bottomRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [providers, setProviders] = useState([]);
  const [selectedProviderId, setSelectedProviderId] = useState("");

  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [checkingModels, setCheckingModels] = useState(false);
  const [providerStatus, setProviderStatus] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    loadHistory();
    loadProviders();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function loadProviders() {
    try {
      setLoadingProviders(true);

      const { data, error } = await supabase
        .from("ai_providers")
        .select("id,name,provider,model,enabled,sort_order")
        .eq("enabled", true)
        .order("sort_order", { ascending: true });

      if (error) throw error;

      const list = data || [];
      setProviders(list);

      if (list.length > 0 && !selectedProviderId) {
        setSelectedProviderId(String(list[0].id));
      }
    } catch (err) {
      console.log(err);
      setError(err.message || "فشل تحميل موديلات AI");
    } finally {
      setLoadingProviders(false);
    }
  }

  async function checkProvidersAvailability() {
    if (providers.length === 0) return;

    setCheckingModels(true);
    setProviderStatus({});

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      for (const provider of providers) {
        setProviderStatus((prev) => ({
          ...prev,
          [provider.id]: "checking",
        }));

        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/finance-ai-chat`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                Authorization: `Bearer ${
                  session?.access_token ||
                  import.meta.env.VITE_SUPABASE_ANON_KEY
                }`,
              },
              body: JSON.stringify({
                question: "جاوب بكلمة واحدة فقط: جاهز",
                providerId: provider.id,
                checkOnly: true,
              }),
            }
          );

          const result = await response.json();

          setProviderStatus((prev) => ({
            ...prev,
            [provider.id]:
              response.ok && result?.success ? "available" : "failed",
          }));
        } catch {
          setProviderStatus((prev) => ({
            ...prev,
            [provider.id]: "failed",
          }));
        }
      }
    } finally {
      setCheckingModels(false);
    }
  }

  async function loadHistory() {
    try {
      setLoadingHistory(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from("ai_chat_history")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(30);

      if (error) throw error;

      const history = (data || []).flatMap((item) => [
        {
          role: "user",
          content: item.question,
          created_at: item.created_at,
        },
        {
          role: "assistant",
          content: item.answer,
          created_at: item.created_at,
          provider: item.provider,
          model: item.model,
        },
      ]);

      setMessages(history);
    } catch (err) {
      console.log(err);
      setError(err.message || "فشل تحميل سجل الذكاء الاصطناعي");
    } finally {
      setLoadingHistory(false);
    }
  }

  async function askAI(e) {
    e.preventDefault();

    const cleanQuestion = question.trim();

    if (!cleanQuestion) return;
    if (loading) return;

    if (!selectedProviderId) {
      setError("اختر موديل AI أولاً");
      return;
    }

    setError("");

    const selectedProvider = providers.find(
      (item) => String(item.id) === String(selectedProviderId)
    );

    const userMessage = {
      role: "user",
      content: cleanQuestion,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/finance-ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${
              session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY
            }`,
          },
          body: JSON.stringify({
            question: cleanQuestion,
            providerId: selectedProviderId,
          }),
        }
      );

      const text = await response.text();

      let result = null;

      try {
        result = JSON.parse(text);
      } catch {
        result = { raw: text };
      }

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.error ||
            result?.raw ||
            "فشل الاتصال بالذكاء الاصطناعي"
        );
      }

      const aiMessage = {
        role: "assistant",
        content: result.answer || "ماكو جواب",
        created_at: new Date().toISOString(),
        provider: result.provider || selectedProvider?.provider,
        model: result.model || selectedProvider?.model,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      console.log(err);

      const failMessage = {
        role: "assistant",
        content:
          "صار خطأ أثناء تحليل البيانات. تأكد من ai_providers والـ API Key والموديل المختار.",
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, failMessage]);
      setError(err.message || "فشل سؤال الذكاء الاصطناعي");
    } finally {
      setLoading(false);
    }
  }

  function quickAsk(text) {
    setQuestion(text);
  }

  async function clearLocalChat() {
    const ok = confirm("مسح المحادثة من الشاشة فقط؟");
    if (!ok) return;

    setMessages([]);
  }

  const selectedProvider = providers.find(
    (item) => String(item.id) === String(selectedProviderId)
  );

  return (
    <div dir="rtl" className="min-h-screen bg-slate-950 text-white p-2">
      <div className="max-w-[1200px] mx-auto h-[calc(100vh-16px)] flex flex-col gap-2">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-2 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.location.href = "/dashboard"}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md px-3 h-8 text-[10px] font-black"
            >
              ← الرئيسية
            </button>

            <div>
              <h1 className="text-sm font-black">المساعد المالي الذكي</h1>

              <p className="text-[9px] text-slate-500">
                اسأل عن الأرباح، المخاطر، الصرفيات، الديون، وخطة العمل
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            <select
              value={selectedProviderId}
              onChange={(e) => setSelectedProviderId(e.target.value)}
              disabled={loadingProviders || loading}
              className="bg-slate-950 border border-slate-800 rounded-md px-2 h-8 text-[9px] outline-none min-w-[230px]"
            >
              {loadingProviders ? (
                <option>تحميل الموديلات...</option>
              ) : providers.length === 0 ? (
                <option>لا توجد موديلات مفعلة</option>
              ) : (
                providers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {statusIcon(providerStatus[item.id])} {item.name} -{" "}
                    {item.model}
                  </option>
                ))
              )}
            </select>

            <button
              type="button"
              onClick={loadProviders}
              disabled={loadingProviders || loading}
              className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-md px-2 h-8 text-[9px] font-black"
            >
              تحديث
            </button>

            <button
              type="button"
              onClick={checkProvidersAvailability}
              disabled={checkingModels || loading || providers.length === 0}
              className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 rounded-md px-2 h-8 text-[9px] font-black"
            >
              {checkingModels ? "فحص..." : "فحص الموديلات"}
            </button>

            <button
              type="button"
              onClick={clearLocalChat}
              className="bg-slate-800 hover:bg-slate-700 rounded-md px-3 h-8 text-[9px] font-black"
            >
              مسح الشاشة
            </button>
          </div>
        </div>

        {selectedProvider && (
          <div className="bg-cyan-950/40 border border-cyan-900 rounded-lg p-2 flex items-center justify-between gap-2 flex-wrap">
            <div>
              <p className="text-[9px] text-cyan-200">
                الموديل الحالي:
                <span className="font-black text-white mx-1">
                  {statusIcon(providerStatus[selectedProvider.id])}{" "}
                  {selectedProvider.name}
                </span>
              </p>

              <p className="text-[8px] text-cyan-400">
                Provider: {selectedProvider.provider} — Model:{" "}
                {selectedProvider.model}
              </p>
            </div>

            <span
              className={`rounded-md px-2 py-1 text-[8px] font-black ${
                providerStatus[selectedProvider.id] === "available"
                  ? "bg-emerald-700"
                  : providerStatus[selectedProvider.id] === "failed"
                  ? "bg-red-700"
                  : providerStatus[selectedProvider.id] === "checking"
                  ? "bg-yellow-700"
                  : "bg-cyan-700"
              }`}
            >
              {statusText(providerStatus[selectedProvider.id])}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
          <QuickButton
            title="حلل وضعي المالي"
            onClick={() =>
              quickAsk("حلل وضعي المالي اليوم واذكر أهم المخاطر والفرص")
            }
          />

          <QuickButton
            title="خطة أسبوعية"
            onClick={() =>
              quickAsk("اعطني خطة عمل للأسبوع القادم حسب بيانات مشاريعي")
            }
          />

          <QuickButton
            title="أين أقلل الصرف؟"
            onClick={() =>
              quickAsk("وين أكدر أقلل الصرفيات بدون ما أضر الشغل؟")
            }
          />

          <QuickButton
            title="المخاطر"
            onClick={() =>
              quickAsk("شنو أكبر المخاطر المالية الحالية عندي؟")
            }
          />
        </div>

        {error && (
          <div className="bg-red-950 border border-red-800 rounded-lg p-2 text-[10px] text-red-200">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto bg-slate-900 border border-slate-800 rounded-lg p-2">
          {loadingHistory ? (
            <div className="h-full flex items-center justify-center text-[10px] text-slate-500">
              جاري تحميل المحادثة...
            </div>
          ) : messages.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-2">
              {messages.map((msg, index) => (
                <ChatBubble key={index} message={msg} />
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-blue-950 border border-blue-800 rounded-lg p-2 max-w-[85%]">
                    <p className="text-[10px] text-blue-200">
                      الذكاء الاصطناعي يحلل بياناتك...
                    </p>

                    {selectedProvider && (
                      <p className="text-[8px] text-blue-400 mt-1">
                        {selectedProvider.name} — {selectedProvider.model}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <form
          onSubmit={askAI}
          className="bg-slate-900 border border-slate-800 rounded-lg p-2"
        >
          <div className="grid grid-cols-[1fr_auto] gap-1">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="اكتب سؤالك... مثال: نكمل خطتنا السابقة؟"
              rows={2}
              className="bg-slate-950 border border-slate-800 rounded-md px-2 py-2 text-[11px] outline-none resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  askAI(e);
                }
              }}
            />

            <button
              disabled={loading || !question.trim() || !selectedProviderId}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md px-4 text-[10px] font-black"
            >
              {loading ? "..." : "إرسال"}
            </button>
          </div>

          <p className="text-[8px] text-slate-500 mt-1">
            Enter للإرسال — Shift + Enter لسطر جديد
          </p>
        </form>
      </div>
    </div>
  );
}

function QuickButton({ title, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md h-9 text-[9px] font-black text-slate-200"
    >
      {title}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="text-3xl mb-2">🤖</div>

        <h2 className="text-sm font-black mb-1">اسأل مساعدك المالي</h2>

        <p className="text-[10px] text-slate-500 leading-5">
          يقدر يحلل مشاريعك، يحدد المخاطر، يقترح خطة أسبوعية، ويساعدك
          تكمل خططك وأفكارك كمحادثة ذكية.
        </p>
      </div>
    </div>
  );
}

function ChatBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`rounded-lg p-2 max-w-[88%] border ${
          isUser
            ? "bg-emerald-950 border-emerald-800"
            : "bg-slate-950 border-slate-800"
        }`}
      >
        <div className="flex items-center gap-1 mb-1 flex-wrap">
          <span
            className={`text-[8px] font-black ${
              isUser ? "text-emerald-300" : "text-blue-300"
            }`}
          >
            {isUser ? "أنت" : "AI"}
          </span>

          {!isUser && message.model && (
            <span className="bg-blue-900 text-blue-200 rounded px-1 text-[7px]">
              {message.provider || "ai"} / {message.model}
            </span>
          )}

          <span className="text-[8px] text-slate-600">
            {formatTime(message.created_at)}
          </span>
        </div>

        <div className="text-[11px] leading-6 whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    </div>
  );
}

function statusIcon(status) {
  if (status === "available") return "✅";
  if (status === "failed") return "❌";
  if (status === "checking") return "⏳";
  return "○";
}

function statusText(status) {
  if (status === "available") return "متاح";
  if (status === "failed") return "غير متاح";
  if (status === "checking") return "جاري الفحص";
  return "لم يتم الفحص";
}

function formatTime(value) {
  if (!value) return "";

  try {
    return new Date(value).toLocaleTimeString("ar-IQ", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}