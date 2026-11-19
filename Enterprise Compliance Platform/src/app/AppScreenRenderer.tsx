import { lazy, Suspense } from "react";
import type { Declaration, Screen } from "@/types/declaration";

const NewDeclarationScreen = lazy(() => import("@/app/pages/NewDeclarationScreen").then((module) => ({ default: module.NewDeclarationScreen })));
const MyDeclarationsScreen = lazy(() => import("@/app/pages/MyDeclarationsScreen").then((module) => ({ default: module.MyDeclarationsScreen })));
const ApproverDashboard = lazy(() => import("@/app/pages/ApproverDashboard").then((module) => ({ default: module.ApproverDashboard })));
const ApprovalQueue = lazy(() => import("@/app/pages/ApprovalQueue").then((module) => ({ default: module.ApprovalQueue })));
const ApprovalDetail = lazy(() => import("@/app/pages/ApprovalDetail").then((module) => ({ default: module.ApprovalDetail })));
const AdminDashboard = lazy(() => import("@/app/pages/admin/AdminDashboard").then((module) => ({ default: module.AdminDashboard })));
const AdminUsers = lazy(() => import("@/app/pages/admin/AdminUsers").then((module) => ({ default: module.AdminUsers })));
const AdminWorkflows = lazy(() => import("@/app/pages/admin/AdminWorkflows").then((module) => ({ default: module.AdminWorkflows })));
const AdminDropdownOptions = lazy(() => import("@/app/pages/admin/AdminDropdownOptions").then((module) => ({ default: module.AdminDropdownOptions })));
const AdminConfig = lazy(() => import("@/app/pages/admin/AdminConfig").then((module) => ({ default: module.AdminConfig })));
const AdminReports = lazy(() => import("@/app/pages/admin/AdminReports").then((module) => ({ default: module.AdminReports })));
const AdminApprovalOptions = lazy(() => import("@/app/pages/admin/AdminApprovalOptions").then((module) => ({ default: module.AdminApprovalOptions })));

interface AppScreenRendererProps {
  screen: Screen;
  editingDraft: Declaration | null;
  selectedDeclaration: Declaration | null;
  showSubmittedView: boolean;
  submittedData: Declaration | null;
  onNavigate: (screen: Screen) => void;
  onSubmitSuccess: (data: Declaration) => void;
  onDraftSaved: () => void;
  onEditDraft: (declaration: Declaration) => void;
  onReview: (declaration: Declaration) => void;
  onBackFromApproval: () => void;
  onBackFromSubmitted: () => void;
}

export function AppScreenRenderer({
  screen, editingDraft, selectedDeclaration, showSubmittedView, submittedData,
  onNavigate, onSubmitSuccess, onDraftSaved, onEditDraft, onReview, onBackFromApproval, onBackFromSubmitted,
}: AppScreenRendererProps) {
  const content = (() => {
    if (screen === "new-declaration" && !showSubmittedView) {
      return <NewDeclarationScreen onSubmitSuccess={onSubmitSuccess} onDraftSaved={onDraftSaved} draft={editingDraft} />;
    }
    if (screen === "new-declaration" && showSubmittedView && submittedData) {
      return <ApprovalDetail declaration={submittedData} onBack={onBackFromSubmitted} readOnly />;
    }
    if (screen === "my-declarations") return <MyDeclarationsScreen onEditDraft={onEditDraft} />;
    if (screen === "approver-dashboard") return <ApproverDashboard onNavigate={onNavigate} onReview={onReview} />;
    if (screen === "approval-queue") return <ApprovalQueue onReview={onReview} />;
    if (screen === "approval-detail" && selectedDeclaration) return <ApprovalDetail declaration={selectedDeclaration} onBack={onBackFromApproval} />;
    if (screen === "admin-dashboard") return <AdminDashboard onNavigate={onNavigate} />;
    if (screen === "admin-users") return <AdminUsers />;
    if (screen === "admin-workflows") return <AdminWorkflows />;
    if (screen === "admin-dropdown-options") return <AdminDropdownOptions />;
    if (screen === "admin-config") return <AdminConfig />;
    if (screen === "admin-reports") return <AdminReports />;
    if (screen === "admin-approval-options") return <AdminApprovalOptions />;
    return null;
  })();

  return <Suspense fallback={<div role="status" className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">Loading page…</div>}>{content}</Suspense>;
}
