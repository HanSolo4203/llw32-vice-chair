"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { MembershipStats } from "@/hooks/useMembershipStats";
import { PdfReportHeader } from "@/components/reports/PdfReportHeader";

type ReportState = {
  stats: MembershipStats | null;
  summary: string;
};

const INITIAL_MONTH = format(new Date(), "yyyy-MM");
const STORAGE_KEY = "rtllw32-membership-report-cache";
const REPORT_EXPORT_WIDTH = 794;
const MIN_EXPORT_SCALE = 2;
const MAX_EXPORT_SCALE = 3;

const COLOR_FALLBACKS: Record<string, string> = {
  "--background": "#ffffff",
  "--foreground": "#0f172a",
  "--card": "#ffffff",
  "--card-foreground": "#0f172a",
  "--popover": "#ffffff",
  "--popover-foreground": "#0f172a",
  "--primary": "#ea580c",
  "--primary-foreground": "#ffffff",
  "--secondary": "#f8fafc",
  "--secondary-foreground": "#0f172a",
  "--muted": "#f8fafc",
  "--muted-foreground": "#64748b",
  "--accent": "#f8fafc",
  "--accent-foreground": "#0f172a",
  "--destructive": "#ef4444",
  "--border": "#e2e8f0",
  "--input": "#e2e8f0",
  "--ring": "#38bdf8",
  "--sidebar": "#ffffff",
  "--sidebar-foreground": "#0f172a",
  "--sidebar-primary": "#1d4ed8",
  "--sidebar-primary-foreground": "#ffffff",
  "--sidebar-accent": "#f8fafc",
  "--sidebar-accent-foreground": "#0f172a",
  "--sidebar-border": "#e2e8f0",
  "--sidebar-ring": "#38bdf8",
};

const TODAY_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

function getTodayLabel(): string {
  return TODAY_FORMATTER.format(new Date());
}

function applyColorFallbacks(): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const root = document.documentElement;
  const previousValues = new Map<string, string>();

  Object.entries(COLOR_FALLBACKS).forEach(([variable, fallback]) => {
    previousValues.set(variable, root.style.getPropertyValue(variable));
    root.style.setProperty(variable, fallback);
  });

  return () => {
    previousValues.forEach((value, variable) => {
      if (value && value.trim().length > 0) {
        root.style.setProperty(variable, value);
      } else {
        root.style.removeProperty(variable);
      }
    });
  };
}

function extractDateOverride(input: string | null | undefined): string | null {
  if (!input) {
    return null;
  }

  const match = input.match(/report[\s_-]*date\s*:\s*(.+)/i);
  if (!match) {
    return null;
  }

  const value = match[1]?.trim();
  return value?.length ? value : null;
}

function sanitizeSummaryContent(summary: string): string {
  if (!summary) {
    return "";
  }

  const greetingRegex =
    /^Mr\. Chairman, Association Council, Honourable Sergeant at Arms, Fellow Tablers, 41['’`]?ers and Guests\.?\s*/i;
  const closingRegex = /\bYours in Round Table,?\s*/gi;

  let result = summary.trim();
  result = result.replace(greetingRegex, "");
  result = result.replace(closingRegex, "");
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}

function getPreviousMonthInput(month: string) {
  try {
    const normalized = month.length === 7 ? `${month}-01` : month;
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      return month;
    }
    const previous = subMonths(parsed, 1);
    return format(previous, "yyyy-MM");
  } catch {
    return month;
  }
}

export default function MembershipReportPage() {
  const [month, setMonth] = useState<string>(INITIAL_MONTH);
  const [report, setReport] = useState<ReportState>({ stats: null, summary: "" });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<string>("");
  const [customReportDate, setCustomReportDate] = useState<string | null>(null);
  const [reportingPeriod, setReportingPeriod] = useState<string>(getTodayLabel());
  const [reportingPeriodTouched, setReportingPeriodTouched] = useState<boolean>(false);
  const [activeAction, setActiveAction] = useState<"generate" | "regenerate" | null>(
    null,
  );
  const [hasGeneratedContent, setHasGeneratedContent] = useState<boolean>(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const reportDate = useMemo(() => {
    if (customReportDate) {
      return customReportDate;
    }

    try {
      const base = month.length === 7 ? `${month}-01` : month;
      return format(new Date(base), "do MMMM yyyy");
    } catch {
      return "";
    }
  }, [customReportDate, month]);

  const letterParagraphs = useMemo(() => {
    const trimmed = report.summary?.trim();
    if (!trimmed) {
      return [];
    }

    const paragraphs = trimmed
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 0);

    if (paragraphs.length === 0) {
      return paragraphs;
    }

    const openingSalutation =
      "Mr. Chairman, Association Council, Honourable Sergeant at Arms, Fellow Tablers, 41'ers and Guests";

    if (!paragraphs[0].toLowerCase().startsWith("mr. chairman")) {
      return [openingSalutation, ...paragraphs];
    }

    paragraphs[0] = openingSalutation;
    return paragraphs;
  }, [report.summary]);

  useEffect(() => {
    if (!reportingPeriodTouched) {
      const next =
        reportDate && reportDate.trim().length > 0 ? reportDate : getTodayLabel();
      setReportingPeriod(next);
    }
  }, [reportDate, reportingPeriodTouched]);

  useEffect(() => {
    setReportingPeriodTouched(false);
  }, [month, customReportDate]);

  const persistState = useCallback(
    (
      nextReport: ReportState,
      monthValue: string,
      ideasValue: string,
      reportingPeriodValue: string,
    ) => {
      if (typeof window === "undefined") {
        return;
      }

      const sanitizedSummary = sanitizeSummaryContent(nextReport.summary);

      if (!nextReport.stats || sanitizedSummary.length === 0) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }

      setHasGeneratedContent(true);
      const payload = JSON.stringify({
        month: monthValue,
        stats: nextReport.stats,
        summary: sanitizedSummary,
        ideas: ideasValue,
        reportingPeriod: reportingPeriodValue,
      });
      window.localStorage.setItem(STORAGE_KEY, payload);
    },
    [],
  );

  const handleGenerate = useCallback(
    async (
      selectedMonth: string,
      options?: { mode?: "generate" | "regenerate"; ideas?: string },
    ) => {
      const guidance = options?.ideas ?? ideas;
      const monthForStats = getPreviousMonthInput(selectedMonth);

      setLoading(true);
      setActiveAction(options?.mode ?? "generate");
      setError(null);

      try {
        const response = await fetch("/api/membership-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            month: monthForStats,
            ideas: guidance ? guidance.trim() : undefined,
          }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.error ?? "Failed to generate report.");
        }

        const { stats, summary } = (await response.json()) as {
          stats: MembershipStats;
          summary: string;
        };

        const sanitizedSummary = sanitizeSummaryContent(summary ?? "");
        const nextReport: ReportState = {
          stats,
          summary: sanitizedSummary,
        };

        setReport(nextReport);
        const derivedPeriod = (() => {
          if (customReportDate && customReportDate.trim().length > 0) {
            return customReportDate;
          }
          try {
            const base = selectedMonth.length === 7 ? `${selectedMonth}-01` : selectedMonth;
            return format(new Date(base), "do MMMM yyyy");
          } catch {
            return getTodayLabel();
          }
        })();
        setReportingPeriod(derivedPeriod);
        setReportingPeriodTouched(false);
        persistState(nextReport, selectedMonth, guidance ?? "", derivedPeriod);
      } catch (cause) {
        console.error("Failed to generate membership report", cause);
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to generate membership report right now.",
        );
      } finally {
        setLoading(false);
        setActiveAction(null);
      }
    },
    [ideas, persistState],
  );

  const handleGenerateClick = useCallback(() => {
    void handleGenerate(month, { mode: "generate" });
  }, [handleGenerate, month]);

  const handleRegenerateClick = useCallback(() => {
    if (!report.stats) {
      void handleGenerate(month, { mode: "generate" });
      return;
    }
    void handleGenerate(month, { mode: "regenerate" });
  }, [handleGenerate, month, report.stats]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleClearSummary = useCallback(() => {
    setReport((previous) => ({
      stats: previous.stats,
      summary: "",
    }));
    setHasGeneratedContent(false);
    setReportingPeriod(getTodayLabel());
    setReportingPeriodTouched(false);

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const handleDownloadPDF = useCallback(async () => {
    if (!reportRef.current) {
      return;
    }

    let restoreColors: (() => void) | null = null;
    let previousWidth = "";
    let previousMaxWidth = "";
    let previousBorder = "";
    let previousBorderRadius = "";
    let previousBoxShadow = "";
    let previousMargin = "";

    try {
      restoreColors = applyColorFallbacks();
      const element = reportRef.current;
      previousWidth = element.style.width;
      previousMaxWidth = element.style.maxWidth;
      previousBorder = element.style.border;
      previousBorderRadius = element.style.borderRadius;
      previousBoxShadow = element.style.boxShadow;
      previousMargin = element.style.margin;

      element.style.width = `${REPORT_EXPORT_WIDTH}px`;
      element.style.maxWidth = `${REPORT_EXPORT_WIDTH}px`;
      element.style.border = "none";
      element.style.borderRadius = "0";
      element.style.boxShadow = "none";
      element.style.margin = "0 auto";

      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(element, {
        scale: Math.min(
          MAX_EXPORT_SCALE,
          Math.max(MIN_EXPORT_SCALE, window.devicePixelRatio || MIN_EXPORT_SCALE),
        ),
        backgroundColor: "#ffffff",
        useCORS: true,
      });

      const imageData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "pt", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const headerMargin = 0;
      const availableHeight = pageHeight - headerMargin;
      const imageProps = pdf.getImageProperties(imageData);
      const pdfHeight = (imageProps.height * pageWidth) / imageProps.width;
      if (pdfHeight <= availableHeight) {
        pdf.addImage(imageData, "PNG", 0, headerMargin, pageWidth, pdfHeight, undefined, "FAST");
      } else {
        let currentOffset = 0;

        while (currentOffset < pdfHeight) {
          pdf.addImage(
            imageData,
            "PNG",
            0,
            headerMargin - currentOffset,
            pageWidth,
            pdfHeight,
            undefined,
            "FAST",
          );

          currentOffset += availableHeight;

          if (currentOffset < pdfHeight) {
            pdf.addPage();
          }
        }
      }

      const monthLabel = (() => {
        if (reportingPeriod) {
          return reportingPeriod.replace(/[^\w]+/g, "_");
        }
        if (reportDate) {
          return reportDate.replace(/[^\w]+/g, "_");
        }
        if (report.stats?.monthName && report.stats?.year) {
          return `${report.stats.monthName}_${report.stats.year}`;
        }
        try {
          const base = month.length === 7 ? `${month}-01` : month;
          return format(new Date(base), "MMMM_yyyy");
        } catch {
          return "Latest";
        }
      })();

      pdf.save(`RTL32_Membership_Report_${monthLabel}.pdf`);
    } catch (downloadError) {
      console.error("Failed to download membership report PDF", downloadError);
    } finally {
      if (reportRef.current) {
        reportRef.current.style.width = previousWidth;
        reportRef.current.style.maxWidth = previousMaxWidth;
        reportRef.current.style.border = previousBorder;
        reportRef.current.style.borderRadius = previousBorderRadius;
        reportRef.current.style.boxShadow = previousBoxShadow;
        reportRef.current.style.margin = previousMargin;
      }
      restoreColors?.();
    }
  }, [month, report.stats, reportDate, reportingPeriod]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const storedValue = window.localStorage.getItem(STORAGE_KEY);
      if (!storedValue) {
        return;
      }

      const parsed = JSON.parse(storedValue) as {
        month?: string;
        stats?: MembershipStats;
        summary?: string;
        ideas?: string;
        reportingPeriod?: string;
      };

      if (parsed?.stats) {
        const sanitizedSummary = sanitizeSummaryContent(parsed.summary ?? "");

        setReport({
          stats: parsed.stats,
          summary: sanitizedSummary,
        });

        if (parsed.month) {
          setMonth(parsed.month);
        }

        if (parsed.ideas !== undefined) {
          const ideasValue = parsed.ideas ?? "";
          setIdeas(ideasValue);
          setCustomReportDate(extractDateOverride(ideasValue));
        }

        if (parsed.reportingPeriod) {
          setReportingPeriod(parsed.reportingPeriod);
          setReportingPeriodTouched(true);
        } else {
          setReportingPeriod(getTodayLabel());
          setReportingPeriodTouched(false);
        }

        setHasGeneratedContent(Boolean(sanitizedSummary));
      }
    } catch (loadError) {
      console.warn("Failed to restore membership report cache", loadError);
    }
  }, []);

  useEffect(() => {
    if (!report.stats || !hasGeneratedContent) {
      return;
    }
    persistState(report, month, ideas, reportingPeriod);
  }, [ideas, month, persistState, report, hasGeneratedContent, reportingPeriod]);

  const keyMetrics = useMemo(() => {
    if (!report.stats) {
      return null;
    }

    const formatPercent = (value: number) =>
      Number.isFinite(value) ? `${value.toFixed(1)}%` : "0.0%";

    const metrics = [
      { label: "Active Tablers", value: report.stats.activeMembers.toLocaleString() },
      {
        label: "Attended Last Meeting",
        value: report.stats.attendedLastMeeting.toLocaleString(),
      },
      { label: "Attendance Rate", value: formatPercent(report.stats.attendanceRate) },
      { label: "Yearly Average", value: formatPercent(report.stats.yearlyAverage) },
      { label: "Pipeliners", value: report.stats.pipeliners.toLocaleString() },
    ];

    return (
      <div className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#f97316]">
          Key Metrics Snapshot – {report.stats.monthName} {report.stats.year}
        </p>
        <div className="mt-4 grid gap-x-10 gap-y-2 text-[13px] text-[#1a1a1a] sm:grid-cols-2">
          {metrics.map((metric) => (
            <div key={metric.label} className="flex justify-between gap-4">
              <span className="font-semibold uppercase tracking-wider text-[#555]">
                {metric.label}
              </span>
              <span className="font-semibold text-[#1a1a1a]">{metric.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }, [report.stats]);

  return (
    <div className="min-h-screen bg-[#f1f5f9] pb-16 pt-8 text-[#0f172a] print:min-h-fit print:bg-white print:p-0">
      <div className="page-shell flex w-full flex-col gap-responsive print:max-w-none print:px-0 print:py-0 lg:flex-row">
        <section className="flex w-full flex-col gap-responsive print:hidden lg:max-w-sm">
          <Card className="border border-[#e2e8f0] shadow-none">
            <CardContent className="flex flex-col gap-4 p-6">
              <div className="flex flex-col gap-2">
                <Label htmlFor="report-month">Select Month</Label>
                <input
                  id="report-month"
                  type="month"
                  value={month}
                  max={INITIAL_MONTH}
                  className="rounded-md border border-[#e2e8f0] bg-white px-3 py-2 text-sm shadow-sm focus:border-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#e2e8f0]"
                  onChange={(event) => setMonth(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleGenerateClick} disabled={loading}>
                  {loading && activeAction === "generate" ? "Generating..." : "Generate"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleRegenerateClick}
                  disabled={loading || !report.stats}
                >
                  {loading && activeAction === "regenerate" ? "Regenerating..." : "Regenerate"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadPDF}
                  disabled={!report.summary}
                >
                  Download PDF
                </Button>
                <Button type="button" variant="ghost" onClick={handlePrint} disabled={!report.summary}>
                  Print
                </Button>
              </div>
            </CardContent>
          </Card>

        <Card className="border border-[#e2e8f0] shadow-none">
          <CardHeader className="border-b border-[#f1f5f9] pb-4">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-[#475569]">
              Reporting Period
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 p-6">
            <input
              type="text"
              value={reportingPeriod}
              onChange={(event) => {
                setReportingPeriod(event.target.value);
                setReportingPeriodTouched(true);
              }}
              placeholder="e.g. 12 June 2025"
              className="w-full rounded-md border border-[#e2e8f0] bg-white px-4 py-3 text-sm leading-relaxed text-[#1e293b] shadow-sm focus:border-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#e2e8f0]"
            />
            <p className="text-xs text-[#64748b]">
              Displayed beneath the report title. Defaults to today or the selected month, but you
              can customise it with any wording (e.g. &ldquo;Quarter 2, 2025&rdquo;).
            </p>
          </CardContent>
        </Card>

          <Card className="border border-[#e2e8f0] shadow-none">
            <CardHeader className="border-b border-[#f1f5f9] pb-4">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-[#475569]">
                Talking Points for AI
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 p-6">
              <textarea
                value={ideas}
                onChange={(event) => {
                  const value = event.target.value;
                  setIdeas(value);
                  setCustomReportDate(extractDateOverride(value));
                  persistState(report, month, value, reportingPeriod);
                }}
                placeholder="Add achievements, special mentions, or themes you want the AI to include."
                rows={5}
                className="w-full resize-y rounded-md border border-[#e2e8f0] bg-white px-4 py-3 text-sm leading-relaxed text-[#1e293b] shadow-sm focus:border-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#e2e8f0]"
              />
              <p className="text-xs text-[#64748b]">
                These notes are optional. The AI will weave them into the next generated summary.
              </p>
            </CardContent>
          </Card>

          <Card className="border border-[#e2e8f0] shadow-none">
            <CardHeader className="border-b border-[#f1f5f9] pb-4">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-[#475569]">
                Vice Chairman&apos;s Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-6">
              <textarea
                value={report.summary}
                onChange={(event) =>
                  setReport((previous) => ({
                    stats: previous.stats,
                    summary: sanitizeSummaryContent(event.target.value),
                  }))
                }
                rows={10}
                className="w-full resize-y rounded-md border border-[#e2e8f0] bg-white px-4 py-3 text-sm leading-relaxed text-[#1e293b] shadow-sm focus:border-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#e2e8f0]"
              />
              <div className="flex flex-wrap justify-end gap-3">
                <Button type="button" variant="outline" onClick={handleClearSummary} disabled={!report.summary}>
                  Clear Summary
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleRegenerateClick}
                  disabled={loading}
                >
                  {loading && activeAction === "regenerate" ? "Regenerating..." : "Regenerate"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </section>

        <section className="flex-1 print:w-full">
          <div
            ref={reportRef}
            id="report"
            className="mx-auto w-full max-w-3xl rounded-lg border border-[#e2e8f0] bg-white px-10 py-10 shadow-lg print:mx-0 print:max-w-none print:rounded-none print:border-0 print:shadow-none print:px-0 print:py-0"
            style={{ fontFamily: '"Calibri","Arial","Helvetica",sans-serif' }}
          >
            <div className="flex flex-col gap-6">
              <PdfReportHeader
                title="Membership Report"
                reportingPeriod={reportingPeriod || reportDate || "Reporting Period"}
              />
              <div className="mt-4 flex flex-col gap-4 text-[13px] leading-relaxed text-[#202020]">
                {letterParagraphs.length > 0 ? (
                  letterParagraphs.map((paragraph, index) => (
                    <p key={index} className="whitespace-pre-line">
                      {paragraph}
                    </p>
                  ))
                ) : (
                  <p className="italic text-[#666666]">
                    Generate or enter a summary to populate this section. The AI generated report
                    will appear here.
                  </p>
                )}
              </div>

              {keyMetrics}

              <div className="mt-10 text-[13px] leading-relaxed text-[#1a1a1a]">
                <p className="mt-4">
                  With nothing more to report, I would like to put my report up for adoption.
                </p>
                <p className="mt-4 font-semibold uppercase tracking-wide">YIT,</p>
                <p className="mt-6 font-semibold uppercase tracking-wide">Richard Ellis</p>
                <p className="uppercase tracking-wide text-[#555555]">
                  Vice Chairman, Round Table Lilongwe 32
                </p>
              </div>

              <div className="text-center text-[12px] uppercase tracking-[0.6em] text-[#666666]">
                Adopt | Adapt | Improve
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}


