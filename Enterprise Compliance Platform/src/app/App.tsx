import { useState } from "react";
import { AppShell } from "../shell/AppShell";
import { LandingScreen } from "./pages/LandingScreen";
import { NewDeclarationScreen } from "./pages/NewDeclarationScreen";
import { MyDeclarationsScreen } from "./pages/MyDeclarationsScreen";
import { ApproverDashboard } from "./pages/ApproverDashboard";
import { ApprovalQueue } from "./pages/ApprovalQueue";
import { ApprovalDetail } from "./pages/ApprovalDetail";
import { DeclarationDetailView } from "./pages/DeclarationDetailView";
import { SuccessModal } from "./components/SuccessModal";
import { DraftBanner } from "./components/DraftBanner";
import { Screen, Role, Declaration } from "../types/declaration";


export default function App() {
  const [screen, setScreen]             = useState<Screen>("landing");
  const [role, setRole]                 = useState<Role>("teamMember");
  const [userName, setUserName]         = useState("");
  const [selectedDecl, setSelectedDecl] = useState<Declaration | null>(null);
  const [submittedData, setSubmittedData] = useState<Record<string, string> | null>(null);
  const [showSuccess, setShowSuccess]     = useState(false);
  const [showSubmittedView, setShowSubmittedView] = useState(false);
  const [showDraftBanner, setShowDraftBanner]     = useState(false);

  const handleLogin = (r: Role, name: string) => {
    setRole(r);
    setUserName(name);
    setScreen(r === "approver" ? "approver-dashboard" : "new-declaration");
  };

  const handleSignOut = () => {
    setScreen("landing");
    setUserName("");
    setSelectedDecl(null);
    setSubmittedData(null);
    setShowSuccess(false);
    setShowSubmittedView(false);
  };

  const handleSubmitSuccess = (data: Record<string, string>) => {
    setSubmittedData(data);
    setShowSuccess(true);
    setShowSubmittedView(false);
  };

  if (screen === "landing" || screen === "login") {
    return <LandingScreen onEnter={handleLogin} />;
  }

  return (
    <>
      {showDraftBanner && <DraftBanner onDismiss={() => setShowDraftBanner(false)} />}

      <AppShell role={role} screen={screen} userName={userName} onNavigate={setScreen} onSignOut={handleSignOut}>
        {screen === "new-declaration" && !showSubmittedView && (
          <NewDeclarationScreen
            onSubmitSuccess={handleSubmitSuccess}
            onDraftSaved={() => setShowDraftBanner(true)}
          />
        )}
        {screen === "new-declaration" && showSubmittedView && submittedData && (
          <DeclarationDetailView data={submittedData} onBack={() => setShowSubmittedView(false)} />
        )}
        {screen === "my-declarations"    && <MyDeclarationsScreen />}
        {screen === "approver-dashboard" && <ApproverDashboard onNavigate={setScreen} />}
        {screen === "approval-queue"     && (
          <ApprovalQueue onReview={(d) => { setSelectedDecl(d); setScreen("approval-detail"); }} />
        )}
        {screen === "approval-detail" && selectedDecl && (
          <ApprovalDetail declaration={selectedDecl} onBack={() => setScreen("approval-queue")} />
        )}
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
