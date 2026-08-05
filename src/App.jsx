import { useEffect, useState } from "react";
import AppRouter from "./app/router/AppRouter.jsx";
import { supabase } from "./services/supabase/client";

export default function App() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallModal, setShowInstallModal] = useState(false);

  useEffect(() => {
    trackAppOpen();

    const isInstalled =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    const handler = (e) => {
      e.preventDefault();

      if (!isInstalled) {
        setDeferredPrompt(e);
        setShowInstallModal(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);

    window.addEventListener("appinstalled", async () => {
      await trackInstall();
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  async function trackAppOpen() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      await supabase.from("app_usage_events").insert({
        user_id: user?.id || null,
        event_type: "open",
        device_info: navigator.userAgent,
      });
    } catch (err) {
      console.log(err);
    }
  }

  async function trackInstall() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      await supabase.from("app_usage_events").insert({
        user_id: user?.id || null,
        event_type: "install",
        device_info: navigator.userAgent,
      });
    } catch (err) {
      console.log(err);
    }
  }

  async function installApp() {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();

    const result = await deferredPrompt.userChoice;

    if (result.outcome === "accepted") {
      setShowInstallModal(false);
      setDeferredPrompt(null);
    }
  }

  function continueWithoutInstall() {
    setShowInstallModal(false);
  }

  return (
    <>
      <AppRouter />

      {showInstallModal && deferredPrompt && (
        <div
          dir="rtl"
          className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-3xl border border-blue-800 bg-slate-950 p-5 text-white shadow-2xl">
            <div className="text-center">
              <div className="text-5xl mb-3">📲</div>

              <h1 className="text-xl font-black">
                ثبت التطبيق على جهازك
              </h1>

              <p className="mt-3 text-[13px] leading-7 text-slate-300">
                للحصول على أفضل أداء وإشعارات أسرع وتجربة احترافية،
                قم بتثبيت Finance OS كتطبيق على هاتفك.
              </p>
            </div>

            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={installApp}
                className="w-full h-11 rounded-2xl bg-blue-600 text-[13px] font-black hover:bg-blue-700 transition"
              >
                تثبيت التطبيق الآن
              </button>

              <button
                type="button"
                onClick={continueWithoutInstall}
                className="w-full h-11 rounded-2xl bg-slate-800 text-[12px] font-black hover:bg-slate-700 transition"
              >
                المتابعة بدون تثبيت
              </button>
            </div>

            <div className="mt-4 text-center text-[10px] text-slate-500">
              بعد التثبيت سيعمل التطبيق بشكل أسرع وأسلس.
            </div>
          </div>
        </div>
      )}
    </>
  );
}