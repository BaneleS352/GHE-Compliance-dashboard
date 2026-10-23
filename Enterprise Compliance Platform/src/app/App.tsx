import { useEffect, useState, useCallback } from "react";
import { UserProvider, useUser } from "@/app/auth/UserContext";
import { AppShell } from "@/shell/AppShell";
import { LandingScreen } from "@/app/pages/LandingScreen";
import { AppScreenRenderer } from "@/app/AppScreenRenderer";
import { SuccessModal } from "@/app/components/SuccessModal";
import { DraftBanner } from "@/app/components/DraftBanner";
import { ErrorBoundary } from "@/app/components/ErrorBoundary";
import { Screen, Declaration } from "@/types/declaration";
import { Toaster } from "sonner";
import { canNavigateTo, landingScreenForUser, roleForScreen } from "@/app/screenPolicy";

function AppInner() {
  const { user, logout } = useUser();
  const [screen, setScreen] = useState<Screen>("landing");
  const [selectedDecl, setSelectedDecl] = useState<Declaration | null>(null);
  const [submittedData, setSubmittedData] = useState<Declaration | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showSubmittedView, setShowSubmittedView] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [editingDraft, setEditingDraft] = useState<Declaration | null>(null);

  useEffect(() => {
    if (!showSubmittedView) return;
    const scrollToTop = () => {
      const main = document.querySelector("main") as HTMLElement | null;
      if (main) {
        main.scrollTo({ top: 0, behavior: "auto" });
      } else {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    };
    scrollToTop();
    const id = setTimeout(scrollToTop, 100);
    return () => clearTimeout(id);
  }, [showSubmittedView]);

  const handleSignOut = () => {
    logout();
    setScreen("landing");
    setSelectedDecl(null);
    setSubmittedData(null);
    setShowSuccess(false);
    setShowSubmittedView(false);
  };

  // After provider sign-in the authenticated user lands here with no explicit
  // navigation event (there is no login callback anymore): route by role,
  // mirroring the old quick-login destinations.
  useEffect(() => {
    if (!user) return;
    setScreen((current) => {
      if (current !== "landing" && current !== "login") return current;
      return landingScreenForUser(user);
    });
  }, [user]);

  const handleSubmitSuccess = useCallback((data: Declaration) => {
    setSubmittedData(data);
    setShowSuccess(true);
    setShowSubmittedView(false);
  }, []);

  const guardedNavigate = (s: Screen) => {
    if (s === "new-declaration") setEditingDraft(null);
    if (!canNavigateTo(user, s)) {
      setScreen("landing");
      return;
    }
    setScreen(s);
  };

  if (screen === "landing" || screen === "login") {
    return <LandingScreen />;
  }

  if (!user || !canNavigateTo(user, screen)) {
    return <LandingScreen />;
  }

  return (
    <>
      {showDraftBanner && <DraftBanner onDismiss={() => setShowDraftBanner(false)} />}

      <AppShell role={user?.role || roleForScreen(screen)} screen={screen} userName={user?.name || ""} onNavigate={guardedNavigate} onSignOut={handleSignOut} user={user}>
        <AppScreenRenderer
          screen={screen}
          editingDraft={editingDraft}
          selectedDeclaration={selectedDecl}
          showSubmittedView={showSubmittedView}
          submittedData={submittedData}
          onNavigate={guardedNavigate}
          onSubmitSuccess={(data) => { setEditingDraft(null); handleSubmitSuccess(data); }}
          onDraftSaved={() => setShowDraftBanner(true)}
          onEditDraft={(declaration) => { setEditingDraft(declaration); setScreen("new-declaration"); }}
          onReview={(declaration) => { setSelectedDecl(declaration); guardedNavigate("approval-detail"); }}
          onBackFromApproval={() => guardedNavigate("approval-queue")}
          onBackFromSubmitted={() => setShowSubmittedView(false)}
        />
      </AppShell>

      {showSuccess && submittedData && (
        <SuccessModal
          data={submittedData}
          onClose={() => setShowSuccess(false)}
          onView={() => {
            setShowSuccess(false);
            setShowSubmittedView(true);
          }}
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
        <Toaster position="top-center" richColors closeButton />
      </ErrorBoundary>
    </UserProvider>
  );
}
