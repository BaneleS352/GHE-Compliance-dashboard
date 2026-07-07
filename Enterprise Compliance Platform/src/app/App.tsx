<<<<<<< Updated upstream
import { useState } from "react";
import { AppShell } from "@/shell/AppShell";
import { LandingScreen } from "@/screens/LandingScreen";
import { NewDeclarationScreen } from "@/screens/NewDeclarationScreen";
import { MyDeclarationsScreen } from "@/screens/MyDeclarationsScreen";
import { ApproverDashboard } from "@/screens/ApproverDashboard";
import { ApprovalQueue } from "@/screens/ApprovalQueue";
import { ApprovalDetail } from "@/screens/ApprovalDetail";
import { DeclarationDetailView } from "@/screens/DeclarationDetailView";
import { SuccessModal } from "@/components/SuccessModal";
import { DraftBanner } from "@/components/DraftBanner";
import { Screen, Role, Declaration } from "@/types/declaration";
=======
<<<<<<< Updated upstream
import image_Hollywood_Group_Logo from '@/imports/Hollywood_Group_Logo.png'
import image_Logo_1 from '@/imports/Logo-1.png'
import { useState, useRef, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import {
  FileText, CheckSquare, Home, Settings, LogOut, Bell,
  ChevronRight, Upload, Eye, Download, X, Check, AlertCircle,
  ArrowLeft, TrendingUp, Clock, DollarSign, Filter, Search,
  ChevronDown, ArrowUp, MoreHorizontal, Send, Gift,
  Menu, ChevronLeft, Paperclip, Trash2, AlertTriangle,
  Sparkles, Star, Building2, Users, Layers,
} from "lucide-react";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";
import logoImg from "@/imports/Logo.png";
import groupLogoImg from "@/imports/Hollywood_Group_Logo.png";
import bannerImg from "@/imports/Button.png";
=======
import { useState } from "react";
import { AppShell } from "../shell/AppShell";
import { LandingScreen } from "../screens/LandingScreen";
import { NewDeclarationScreen } from "../screens/NewDeclarationScreen";
import { MyDeclarationsScreen } from "../screens/MyDeclarationsScreen";
import { ApproverDashboard } from "../screens/ApproverDashboard";
import { ApprovalQueue } from "../screens/ApprovalQueue";
import { ApprovalDetail } from "../screens/ApprovalDetail";
import { DeclarationDetailView } from "../screens/DeclarationDetailView";
import { SuccessModal } from "../components/SuccessModal";
import { DraftBanner } from "../components/DraftBanner";
import { Screen, Role, Declaration } from "../types/declaration";
>>>>>>> Stashed changes
>>>>>>> Stashed changes

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
