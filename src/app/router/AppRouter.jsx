import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase/client";

import Login from "../../pages/auth/Login.jsx";
import Dashboard from "../../pages/dashboard/Dashboard.jsx";
import Reports from "../../pages/dashboard/Reports.jsx";
import Settings from "../../pages/dashboard/Settings.jsx";
import FinanceAIChat from "../../pages/dashboard/FinanceAIChat.jsx";
import CreateProject from "../../pages/admin/CreateProject.jsx";
import ProjectsManagement from "../../pages/admin/ProjectsManagement.jsx";
import ProjectDetails from "../../pages/projects/ProjectDetails.jsx";
import ClientDetails from "../../pages/marketing-company/ClientDetails.jsx";

import UserOrdersDashboard from "../../pages/user-orders/UserOrdersDashboard";
import MyOrders from "../../pages/user-orders/MyOrders";
import MyProfits from "../../pages/user-orders/MyProfits";
import AddOrder from "../../pages/user-orders/AddOrder";

export default function AppRouter() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;
        setSession(session || null);
      } catch (err) {
        console.log(err);
      } finally {
        if (mounted) setCheckingSession(false);
      }
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, sessionData) => {
      if (!mounted) return;
      setSession(sessionData || null);
      setCheckingSession(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (checkingSession) return <LoadingScreen />;

  return (
    <Routes>
      <Route
        path="/"
        element={session ? <HomeRedirect /> : <Login />}
      />

      <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
      <Route path="/reports" element={<AdminRoute><Reports /></AdminRoute>} />
      <Route path="/settings" element={<AdminRoute><Settings /></AdminRoute>} />
      <Route path="/finance-ai" element={<AdminRoute><FinanceAIChat /></AdminRoute>} />
      <Route path="/create-project" element={<AdminRoute><CreateProject /></AdminRoute>} />
      <Route path="/projects" element={<AdminRoute><ProjectsManagement /></AdminRoute>} />

      <Route path="/projects/:id" element={<ProtectedProjectRoute><ProjectDetails /></ProtectedProjectRoute>} />
      <Route path="/projects/:id/orders" element={<ProtectedProjectRoute><UserOrdersDashboardWrapper /></ProtectedProjectRoute>} />
      <Route path="/projects/:id/my-orders" element={<ProtectedProjectRoute><MyOrdersWrapper /></ProtectedProjectRoute>} />
      <Route path="/projects/:id/my-profits" element={<ProtectedProjectRoute><MyProfitsWrapper /></ProtectedProjectRoute>} />
      <Route path="/projects/:id/add-order" element={<ProtectedProjectRoute><AddOrderWrapper /></ProtectedProjectRoute>} />

      <Route path="/clients/:id" element={<ProtectedClientRoute><ClientDetails /></ProtectedClientRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function HomeRedirect() {
  const [loading, setLoading] = useState(true);
  const [to, setTo] = useState("/");

  useEffect(() => {
    redirect();
  }, []);

  async function redirect() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;

      if (!user) {
        setTo("/");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.role === "admin") {
        setTo("/dashboard");
        return;
      }

      const { data: member } = await supabase
        .from("project_members")
        .select("project_id")
        .eq("user_id", user.id)
        .eq("can_view", true)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (member?.project_id) {
        setTo(`/projects/${member.project_id}`);
        return;
      }

      setTo("/");
    } catch (err) {
      console.log(err);
      setTo("/");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingScreen />;
  return <Navigate to={to} replace />;
}

function UserOrdersDashboardWrapper() {
  return <ProjectComponent component="dashboard" />;
}

function MyOrdersWrapper() {
  return <ProjectComponent component="orders" />;
}

function MyProfitsWrapper() {
  return <ProjectComponent component="profits" />;
}

function AddOrderWrapper() {
  return <ProjectComponent component="add-order" />;
}

function ProjectComponent({ component }) {
  const [project, setProject] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProject();
  }, []);

  async function loadProject() {
    try {
      const projectId = window.location.pathname
        .split("/projects/")[1]
        ?.split("/")[0];

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;

      if (!user || !projectId) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const admin = profile?.role === "admin";
      setIsAdmin(admin);

      const { data: projectData } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();

      setProject(projectData || null);

      if (!admin) {
        const { data: member } = await supabase
          .from("project_members")
          .select("*")
          .eq("project_id", projectId)
          .eq("user_id", user.id)
          .maybeSingle();

        setPermissions(member || {});
      }
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingScreen />;
  if (!project) return <Navigate to="/" replace />;

  if (component === "dashboard") {
    return <UserOrdersDashboard project={project} permissions={permissions} isAdmin={isAdmin} />;
  }

  if (component === "orders") {
    return <MyOrders project={project} permissions={permissions} isAdmin={isAdmin} />;
  }

  if (component === "profits") {
    return <MyProfits project={project} permissions={permissions} isAdmin={isAdmin} />;
  }

  if (component === "add-order") {
    return <AddOrder project={project} permissions={permissions} isAdmin={isAdmin} />;
  }

  return null;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      جاري التحقق...
    </div>
  );
}

function AdminRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;

      if (!user) {
        setAllowed(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      setAllowed(profile?.role === "admin");
    } catch (err) {
      console.log(err);
      setAllowed(false);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingScreen />;
  if (!allowed) return <Navigate to="/" replace />;

  return children;
}

function ProtectedProjectRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    try {
      const projectId = window.location.pathname
        .split("/projects/")[1]
        ?.split("/")[0];

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;

      if (!user || !projectId) {
        setAllowed(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.role === "admin") {
        setAllowed(true);
        return;
      }

      const { data: member } = await supabase
        .from("project_members")
        .select("id")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .eq("can_view", true)
        .eq("is_active", true)
        .maybeSingle();

      setAllowed(!!member);
    } catch (err) {
      console.log(err);
      setAllowed(false);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingScreen />;
  if (!allowed) return <Navigate to="/" replace />;

  return children;
}

function ProtectedClientRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    checkClientAccess();
  }, []);

  async function checkClientAccess() {
    try {
      const clientId = window.location.pathname.split("/clients/")[1];

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;

      if (!user || !clientId) {
        setAllowed(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("id, project_id")
        .eq("id", clientId)
        .maybeSingle();

      if (clientError || !client?.project_id) {
        setAllowed(false);
        return;
      }

      if (profile?.role === "admin") {
        setAllowed(true);
        return;
      }

      const { data: member } = await supabase
        .from("project_members")
        .select("id")
        .eq("project_id", client.project_id)
        .eq("user_id", user.id)
        .eq("can_view", true)
        .eq("is_active", true)
        .maybeSingle();

      setAllowed(!!member);
    } catch (err) {
      console.log(err);
      setAllowed(false);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingScreen />;
  if (!allowed) return <Navigate to="/" replace />;

  return children;
}