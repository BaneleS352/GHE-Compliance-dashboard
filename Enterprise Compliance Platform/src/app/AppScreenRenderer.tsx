import { NewDeclarationScreen } from "@/app/pages/NewDeclarationScreen";
import { MyDeclarationsScreen } from "@/app/pages/MyDeclarationsScreen";
import { ApproverDashboard } from "@/app/pages/ApproverDashboard";
import { ApprovalQueue } from "@/app/pages/ApprovalQueue";
import { ApprovalDetail } from "@/app/pages/ApprovalDetail";
import { AdminDashboard } from "@/app/pages/admin/AdminDashboard";
import { AdminUsers } from "@/app/pages/admin/AdminUsers";
import { AdminWorkflows } from "@/app/pages/admin/AdminWorkflows";
import { AdminDropdownOptions } from "@/app/pages/admin/AdminDropdownOptions";
import { AdminConfig } from "@/app/pages/admin/AdminConfig";
import { AdminReports } from "@/app/pages/admin/AdminReports";
import { AdminApprovalOptions } from "@/app/pages/admin/AdminApprovalOptions";
import type { Declaration, Screen, User } from "@/types/declaration";

interface AppScreenRendererProps {
  screen: Screen;
  user: User;
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
  screen, user, editingDraft, selectedDeclaration, showSubmittedView, submittedData,
  onNavigate, onSubmitSuccess, onDraftSaved, onEditDraft, onReview, onBackFromApproval, onBackFromSubmitted,
}: AppScreenRendererProps) {
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
}
