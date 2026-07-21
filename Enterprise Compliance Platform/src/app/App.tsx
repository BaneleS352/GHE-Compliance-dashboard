import { useState } from "react";
import { UserProvider, useUser } from "./auth/UserContext";
import { canAccessScreen } from "./auth/authService";
import { AppShell } from "../shell/AppShell";
import { LandingScreen } from "./pages/LandingScreen";
import { NewDeclarationScreen } from "./pages/NewDeclarationScreen";
import { MyDeclarationsScreen } from "./pages/MyDeclarationsScreen";
import { ApproverDashboard } from "./pages/ApproverDashboard";
import { ApprovalQueue } from "./pages/ApprovalQueue";
import { ApprovalDetail } from "./pages/ApprovalDetail";
import { DeclarationDetailView, SupportingDocuments } from "./pages/DeclarationDetailView";
import { WorkflowTimeline } from "./components/WorkflowTimeline";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminUsers } from "./pages/admin/AdminUsers";
import { AdminWorkflows } from "./pages/admin/AdminWorkflows";
import { AdminDropdowns } from "./pages/admin/AdminDropdowns";
import { AdminConfig } from "./pages/admin/AdminConfig";
import { AdminReports } from "./pages/admin/AdminReports";
import { AdminApprovalOptions } from "./pages/admin/AdminApprovalOptions";
import { SuccessModal } from "./components/SuccessModal";
import { DraftBanner } from "./components/DraftBanner";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Screen, Role, Declaration } from "../types/declaration";

function AppInner() {
  const { user, setUser } = useUser();
  const [screen, setScreen]             = useState<Screen>("landing");
  const [selectedDecl, setSelectedDecl] = useState<Declaration | null>(null);
  const [submittedData, setSubmittedData] = useState<Declaration | null>(null);
  const [showSuccess, setShowSuccess]     = useState(false);
  const [showSubmittedView, setShowSubmittedView] = useState(false);
  const [showDraftBanner, setShowDraftBanner]     = useState(false);

  const getRoleForScreen = (s: Screen): Role =>
    s === "admin-dashboard" || s === "admin-users" || s === "admin-workflows" || s === "admin-dropdowns" || s === "admin-config" || s === "admin-reports" || s === "admin-approval-options" ? "admin"
    : s === "approver-dashboard" || s === "approval-queue" || s === "approval-detail" ? "approver"
    : "teamMember";

  const handleLogin = (r: Role, _name: string) => {
    setScreen(r === "admin" ? "admin-dashboard" : r === "approver" ? "approver-dashboard" : "new-declaration");
  };

  const handleSignOut = () => {
    setUser(null);
    setScreen("landing");
    setSelectedDecl(null);
    setSubmittedData(null);
    setShowSuccess(false);
    setShowSubmittedView(false);
  };

  const handleSubmitSuccess = (data: Declaration) => {
    setSubmittedData(data);
    setShowSuccess(true);
    setShowSubmittedView(false);
  };

  const guardedNavigate = (s: Screen) => {
    if (!canAccessScreen(user, s)) {
      setScreen("landing");
      return;
    }
    setScreen(s);
  };

  if (screen === "landing" || screen === "login") {
    return <LandingScreen onEnter={handleLogin} />;
  }

  if (!canAccessScreen(user, screen)) {
    return <LandingScreen onEnter={handleLogin} />;
  }

  return (
    <>
      {showDraftBanner && <DraftBanner onDismiss={() => setShowDraftBanner(false)} />}

      <AppShell role={user?.role || getRoleForScreen(screen)} screen={screen} userName={user?.name || ""} onNavigate={guardedNavigate} onSignOut={handleSignOut} user={user}>
        {screen === "new-declaration" && !showSubmittedView && (
          <NewDeclarationScreen
            onSubmitSuccess={handleSubmitSuccess}
            onDraftSaved={() => setShowDraftBanner(true)}
          />
        )}
        {screen === "new-declaration" && showSubmittedView && submittedData && (
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
            <div className="xl:col-span-3">
              <DeclarationDetailView data={submittedData} onBack={() => setShowSubmittedView(false)} hideDocuments />
            </div>
            <div className="xl:col-span-2 h-full">
              <WorkflowTimeline declarationId={submittedData.id} employee={submittedData.employee} />
            </div>
            <div className="xl:col-span-3">
              <SupportingDocuments data={submittedData} />
            </div>
          </div>
        )}
        {screen === "my-declarations"    && <MyDeclarationsScreen />}
        {screen === "approver-dashboard" && <ApproverDashboard onNavigate={guardedNavigate} onReview={(d) => { setSelectedDecl(d); guardedNavigate("approval-detail"); }} />}
        {screen === "approval-queue"     && (
          <ApprovalQueue onReview={(d) => { setSelectedDecl(d); guardedNavigate("approval-detail"); }} />
        )}
        {screen === "approval-detail" && selectedDecl && (
          <ApprovalDetail declaration={selectedDecl} onBack={() => guardedNavigate("approval-queue")} />
        )}
        {screen === "admin-dashboard" && <AdminDashboard onNavigate={guardedNavigate} />}
        {screen === "admin-users"     && <AdminUsers />}
        {screen === "admin-workflows" && <AdminWorkflows />}
        {screen === "admin-dropdowns" && <AdminDropdowns />}
        {screen === "admin-config"    && <AdminConfig />}
        {screen === "admin-reports"   && <AdminReports />}
        {screen === "admin-approval-options" && <AdminApprovalOptions />}
      </AppShell>

      {showSuccess && submittedData && (
        <SuccessModal
          data={submittedData}
          onClose={() => setShowSuccess(false)}
          onView={() => { setShowSuccess(false); setShowSubmittedView(true); }}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <UserProvider>
      <ErrorBoundary>
        <AppInner />
      </ErrorBoundary>
    </UserProvider>
  );
}
