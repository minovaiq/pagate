import { NavLink, Outlet, useNavigate } from "react-router-dom";

import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  BarChart3,
  LogOut,
} from "lucide-react";

import { supabase } from "../lib/supabase";

const links = [
  {
    to: "/",
    label: "الرئيسية",
    icon: LayoutDashboard,
  },

  {
    to: "/transactions",
    label: "إضافة حركة",
    icon: ArrowLeftRight,
  },

  {
    to: "/wallets",
    label: "المحافظ",
    icon: Wallet,
  },

  {
    to: "/reports",
    label: "التقارير",
    icon: BarChart3,
  },
];

export default function Layout() {
  const navigate = useNavigate();

  async function logout() {
    await supabase.auth.signOut();

    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-24 md:pb-0">
      {/* HEADER */}

      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black">
              Five Star Finance
            </h1>

            <p className="text-[11px] text-gray-500">
              نظام السيطرة المالية
            </p>
          </div>

          <button
            onClick={logout}
            className="bg-red-50 hover:bg-red-100 text-red-600 rounded-xl px-3 py-2 text-sm font-bold flex items-center gap-2"
          >
            <LogOut size={17} />

            خروج
          </button>
        </div>
      </header>

      {/* CONTENT */}

      <div className="max-w-7xl mx-auto md:grid md:grid-cols-[220px_1fr] gap-4 p-4">
        {/* SIDEBAR */}

        <aside className="hidden md:block">
          <div className="card sticky top-20">
            <nav className="space-y-2">
              {links.map((item) => {
                const Icon =
                  item.icon;

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={
                      item.to ===
                      "/"
                    }
                    className={({
                      isActive,
                    }) =>
                      `
                      flex
                      items-center
                      gap-3
                      px-3
                      py-3
                      rounded-2xl
                      text-sm
                      font-bold
                      transition

                      ${
                        isActive
                          ? "bg-blue-600 text-white"
                          : "text-gray-700 hover:bg-gray-100"
                      }
                    `
                    }
                  >
                    <Icon
                      size={18}
                    />

                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* MAIN */}

        <main>
          <Outlet />
        </main>
      </div>

      {/* MOBILE NAV */}

      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t z-50">
        <div className="grid grid-cols-4">
          {links.map((item) => {
            const Icon =
              item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={
                  item.to ===
                  "/"
                }
                className={({
                  isActive,
                }) =>
                  `
                  py-2
                  flex
                  flex-col
                  items-center
                  gap-1
                  text-[10px]
                  font-bold

                  ${
                    isActive
                      ? "text-blue-600"
                      : "text-gray-500"
                  }
                `
                }
              >
                <Icon
                  size={18}
                />

                {item.label}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}