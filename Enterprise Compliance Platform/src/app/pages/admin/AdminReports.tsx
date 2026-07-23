import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { Table, Thead, Th, Tbody, Tr, Td, COL } from "../../components/table";
import { PURPLE, formatRand, GRADIENT_PRIMARY } from "../../../config/theme";
import { fetchReports } from "../../../services/reports";
import { exportToExcel, ColumnDef } from "../../utils/excelExport";

type ReportType = "High-Value Gifts Report" | "Counterparty Concentration Report";

const REPORTS: Array<{ title: ReportType; desc: string }> = [
  { title: "High-Value Gifts Report", desc: "Employee-level summary for declarations valued at R2,000 and above in the selected period." },
  { title: "Counterparty Concentration Report", desc: "Counterparty totals and concentration for the selected period." },
];

export function AdminReports() {
  const [reportType, setReportType] = useState<ReportType>("High-Value Gifts Report");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [department, setDepartment] = useState("All Departments");
  const [status, setStatus] = useState("All Statuses");
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [counterpartyData, setCounterpartyData] = useState<any[]>([]);
  const [highValueData, setHighValueData] = useState<any[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const params = useMemo(() => {
    const next: Record<string, string> = {};
    if (startDate) next.startDate = startDate;
    if (endDate) next.endDate = endDate;
    if (department !== "All Departments") next.department = department;
    if (status !== "All Statuses") next.status = status;
    return next;
  }, [startDate, endDate, department, status]);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReports(params);
      setCounterpartyData(data.counterpartyData);
      setHighValueData(data.highValueData);
      setDepartments(data.departments);
      setGeneratedAt(new Date().toLocaleString("en-ZA"));
    } catch {
      setError("Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleGenerate();
  }, []);

  const activeRows = reportType === "High-Value Gifts Report" ? highValueData : counterpartyData;

  const exportColumns: ColumnDef[] = reportType === "High-Value Gifts Report"
    ? [
        { header: "Employee", key: "employee", width: 22 },
        { header: "Line Manager", key: "lineManager", width: 22 },
        { header: "Declarations", key: "declarationCount", width: 14 },
        { header: "Total Value", key: "totalValue", width: 14 },
        { header: "Average Value", key: "averageValue", width: 14 },
        { header: "Total G", key: "totalGift", width: 10 },
        { header: "Total H", key: "totalHospitality", width: 10 },
        { header: "Total E", key: "totalEntertainment", width: 10 },
        { header: "Most Frequent Supplier", key: "mostFrequentSupplier", width: 28 },
      ]
    : [
        { header: "Counterparty", key: "counterparty", width: 26 },
        { header: "Declarations", key: "count", width: 14 },
        { header: "Total Value", key: "totalValue", width: 14 },
        { header: "Average Value", key: "avgValue", width: 14 },
      ];

  const handleExportExcel = async () => {
    await exportToExcel({
      fileName: `${reportType.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}`,
      sheetName: reportType.slice(0, 31),
      title: reportType,
      meta: [["Generated", new Date().toLocaleString("en-ZA")], ["Records", String(activeRows.length)]],
      columns: exportColumns,
      rows: activeRows,
    });
  };

  const handleExportPdf = async () => {
    if (activeRows.length === 0) return;
    const el = tableRef.current;
    if (!el) return;
    try {
      const canvas = await html2canvas(el, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("l", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${reportType.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      const pdf = new jsPDF("l", "mm", "a4");
      pdf.setFontSize(16);
      pdf.text(reportType, 14, 18);
      pdf.setFontSize(10);
      pdf.text(`Generated: ${new Date().toLocaleString("en-ZA")}`, 14, 26);
      let y = 36;
      const lines = reportType === "High-Value Gifts Report"
        ? highValueData.map((row) => `${row.employee} | ${row.lineManager} | ${row.declarationCount} | ${formatRand(row.totalValue)} | Avg ${formatRand(row.averageValue)} | G ${row.totalGift} H ${row.totalHospitality} E ${row.totalEntertainment} | ${row.mostFrequentSupplier}`)
        : counterpartyData.map((row) => `${row.counterparty} | ${row.count} declarations | ${formatRand(row.totalValue)} | Avg ${formatRand(row.avgValue)}`);
      lines.forEach((line) => {
        if (y > 190) { pdf.addPage(); y = 20; }
        pdf.text(line.slice(0, 250), 14, y);
        y += 7;
      });
      pdf.save(`${reportType.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Operational Management Reports" subtitle="Generate and export focused operational reports." />

      <div className="-mt-2 mb-2 flex items-center gap-4">
        <div className="flex gap-1 rounded-xl bg-muted/60 p-1">
          {REPORTS.map((report) => (
            <button
              key={report.title}
              onClick={() => setReportType(report.title)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                reportType === report.title
                  ? "bg-white text-purple-900 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {report.title}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">|</p>
        <p className="text-sm text-muted-foreground">{REPORTS.find((report) => report.title === reportType)?.desc}</p>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <button onClick={handleExportExcel} className="flex h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"><Download size={14} /> Export Excel</button>
            <button onClick={handleExportPdf} className="flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 hover:bg-red-100"><Download size={14} /> Export PDF</button>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Start Date</label>
            <input type="date" className="table-filter-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">End Date</label>
            <input type="date" className="table-filter-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Department</label>
            <select className="table-filter-select" value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option>All Departments</option>
              {departments.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Status</label>
            <select className="table-filter-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option>All Statuses</option>
              <option>Draft</option>
              <option>Pending</option>
              <option>Approved</option>
              <option>Declined</option>
              <option>Escalated</option>
              <option>Info Requested</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={handleGenerate} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white" style={{ background: GRADIENT_PRIMARY }}>
              <FileText size={14} /> {loading ? "Generating..." : "Generate Report"}
            </button>
          </div>
        </div>
      </Card>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {generatedAt && reportType === "High-Value Gifts Report" && (
        <Card className="overflow-x-auto p-0"><div ref={tableRef}>
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h3 className="text-sm font-bold text-foreground">High-Value Gifts Report</h3>
            <span className="text-xs text-muted-foreground">Generated {generatedAt}</span>
          </div>
          <Table>
            <Thead>
              {["Employee", "Line Manager", "Declarations", "Total Value", "Average Value", "Total G", "Total H", "Total E", "Most Frequent Supplier"].map((label) => (
                <Th key={label}>{label}</Th>
              ))}
            </Thead>
            <Tbody>
              {highValueData.length === 0 ? (
                <Tr><Td colSpan={9} className="py-10 text-center">No records for the selected range.</Td></Tr>
              ) : highValueData.map((row) => (
                <Tr key={row.employee}>
                  <Td className={COL.EMPLOYEE}>{row.employee}</Td>
                  <Td className={COL.DEPARTMENT}>{row.lineManager}</Td>
                  <Td className={COL.TABULAR_NUMS}>{row.declarationCount}</Td>
                  <Td className={COL.VALUE}>{formatRand(row.totalValue)}</Td>
                  <Td className={COL.TABULAR_NUMS}>{formatRand(row.averageValue)}</Td>
                  <Td className={COL.TABULAR_NUMS}>{row.totalGift}</Td>
                  <Td className={COL.TABULAR_NUMS}>{row.totalHospitality}</Td>
                  <Td className={COL.TABULAR_NUMS}>{row.totalEntertainment}</Td>
                  <Td className={COL.TEXT_MUTED}>{row.mostFrequentSupplier}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div></Card>
      )}

    </div>
  );
}
