"use client";

import {
  type ChangeEvent,
  type DragEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PdfReportHeader } from "@/components/reports/PdfReportHeader";

type ProjectReport = {
  projectName: string;
  date: string;
  fundsRaised: string;
  attendees: string;
  summary: string;
};

const TODAY_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-MW", {
  style: "currency",
  currency: "MWK",
  minimumFractionDigits: 2,
});

function getTodayLabel(): string {
  return TODAY_FORMATTER.format(new Date());
}

const SUPPORTED_TYPES = [
  "application/pdf",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/jpg",
];

const REPORT_EXPORT_WIDTH = 794;
const MIN_EXPORT_SCALE = 2;
const MAX_EXPORT_SCALE = 3;

function isSupportedFile(file: File) {
  if (file.type && SUPPORTED_TYPES.includes(file.type)) {
    return true;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "pdf":
      return true;
    case "png":
    case "jpg":
    case "jpeg":
      return true;
    case "txt":
      return true;
    default:
      return false;
  }
}

function fileKey(file: File) {
  return [file.name, file.size, file.lastModified].join(":");
}

function formatValue(value: string, fallback: string) {
  return value?.trim().length ? value.trim() : fallback;
}

function formatCurrency(value: number) {
  const formatted = CURRENCY_FORMATTER.format(Math.abs(value));
  return value < 0 ? `(${formatted})` : formatted;
}

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

export default function ProjectsReportPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [report, setReport] = useState<ProjectReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [talkingPoints, setTalkingPoints] = useState<string>("");
  const [reportingPeriod, setReportingPeriod] = useState<string>(getTodayLabel());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const golfDayBreakdown = useMemo(() => {
    const grossTotal = 29_040_000;
    const rtCollections = 17_400_000;
    const lspcaCollections = 11_640_000;
    const expenses = 546_612.5;
    const netAfterExpenses = grossTotal - expenses;
    const sharePerPartner = netAfterExpenses / 2;
    const lspcaAllocation = 11_640_000;
    const rtlw32Net = sharePerPartner - lspcaAllocation;

    return {
      grossTotal,
      rtCollections,
      lspcaCollections,
      expenses,
      netAfterExpenses,
      sharePerPartner,
      lspcaAllocation,
      rtlw32Net,
      rows: [
        { label: "Gross Proceeds", value: grossTotal },
        { label: "Less Expenses", value: -expenses },
        { label: "Net After Expenses", value: netAfterExpenses },
        { label: "Share Per Partner (50%)", value: sharePerPartner },
        { label: "Amount Payable to LSPCA", value: lspcaAllocation },
      ],
    };
  }, []);

  const summaryParagraphs = useMemo(() => {
    const summary = report?.summary?.trim();
    if (!summary) {
      return [];
    }

    const paragraphs = summary
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
  }, [report?.summary]);

  const handleFilesAdded = useCallback(
    (incoming: FileList | File[]) => {
      const nextFiles = Array.from(incoming);
      if (!nextFiles.length) {
        return;
      }

      setFiles((previous) => {
        const existingKeys = new Set(previous.map(fileKey));
        let rejectedType = false;
        const uniqueNewFiles = nextFiles.filter((file) => {
          if (!isSupportedFile(file)) {
            rejectedType = true;
            return false;
          }
          const key = fileKey(file);
          if (existingKeys.has(key)) {
            return false;
          }
          existingKeys.add(key);
          return true;
        });

        if (rejectedType) {
          setError(
            "One or more files were skipped because their format is not supported. Please upload PDF, JPG/PNG images, or plain text files.",
          );
        }

        return [...previous, ...uniqueNewFiles];
      });
    },
    [],
  );

  const handleFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (!event.target.files) {
        return;
      }
      handleFilesAdded(event.target.files);
      event.target.value = "";
    },
    [handleFilesAdded],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (event.dataTransfer.files?.length) {
        handleFilesAdded(event.dataTransfer.files);
      }
    },
    [handleFilesAdded],
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setFiles((previous) => previous.filter((_, currentIndex) => currentIndex !== index));
  }, []);

  const handleClearFiles = useCallback(() => {
    setFiles([]);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!files.length) {
      setError("Please upload at least one document to analyse.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });
      if (talkingPoints.trim().length > 0) {
        formData.append("talkingPoints", talkingPoints.trim());
      }

      const response = await fetch("/api/analyze-projects", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? "Failed to analyse documents.");
      }

      const result = (await response.json()) as ProjectReport;
      setReport({
        projectName: formatValue(result.projectName, "Not specified"),
        date: formatValue(result.date, "Not specified"),
        fundsRaised: formatValue(result.fundsRaised, "Not specified"),
        attendees: formatValue(result.attendees, "Not specified"),
        summary: formatValue(result.summary, ""),
      });
    } catch (analysisError) {
      console.error("Failed to analyse documents", analysisError);
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : "Unable to analyse documents at this time.",
      );
    } finally {
      setLoading(false);
    }
  }, [files, talkingPoints]);

  const handleSummaryChange = useCallback((value: string) => {
    setReport((previous) => {
      if (!previous) {
        return {
          projectName: "Not specified",
          date: "Not specified",
          fundsRaised: "Not specified",
          attendees: "Not specified",
          summary: value,
        };
      }

      return {
        ...previous,
        summary: value,
      };
    });
  }, []);

  const handlePrint = useCallback(() => {
    window.print();
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

      pdf.save("RTL32_Projects_Report.pdf");
    } catch (downloadError) {
      console.error("Failed to download projects report PDF", downloadError);
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
  }, []);

  const stats = useMemo(() => {
    const data: { label: string; value: string }[] = [
      { label: "Project Name", value: report?.projectName ?? "Awaiting analysis" },
      { label: "Date", value: report?.date ?? "Awaiting analysis" },
      { label: "Funds Raised", value: report?.fundsRaised ?? "Awaiting analysis" },
      { label: "Attendees", value: report?.attendees ?? "Awaiting analysis" },
    ];

    return (
      <div className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#f97316]">
          Project Highlights
        </p>
        <div className="mt-4 grid gap-x-10 gap-y-2 text-[13px] text-[#1a1a1a] sm:grid-cols-2">
          {data.map((item) => (
            <div key={item.label} className="flex justify-between gap-4">
              <span className="font-semibold uppercase tracking-wider text-[#555]">
                {item.label}
              </span>
              <span className="font-semibold text-[#1a1a1a]">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }, [report]);

  const reportDateLabel = report?.date?.trim().length
    ? report.date
    : reportingPeriod || "Reporting Period";

  return (
    <div className="min-h-screen bg-[#f1f5f9] pb-16 pt-8 text-[#0f172a] print:min-h-fit print:bg-white print:p-0">
      <div className="page-shell flex w-full flex-col gap-responsive print:max-w-none print:px-0 print:py-0 lg:flex-row">
        <section className="flex w-full flex-col gap-responsive print:hidden lg:max-w-sm">
          <Card className="border border-[#e2e8f0] shadow-none">
            <CardHeader className="border-b border-[#f1f5f9] pb-4">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-[#475569]">
                Upload Project Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 p-6">
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="rounded-lg border border-dashed border-[#94a3b8] bg-[#f8fafc] px-4 py-6 text-center text-sm text-[#475569]"
              >
                <p className="font-semibold text-[#1e293b]">Drag &amp; drop files here</p>
                <p className="mt-1 text-xs text-[#64748b]">
                  PDF, JPG/PNG images, or plain text files.
                </p>
                <div className="mt-4 flex justify-center">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Browse Files
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={SUPPORTED_TYPES.join(",")}
                  className="hidden"
                  onChange={handleFileInputChange}
                />
              </div>

              {files.length > 0 ? (
                <div className="rounded-md border border-[#e2e8f0] bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#475569]">
                    Selected Files
                  </p>
                  <ul className="mt-3 flex max-h-40 flex-col gap-2 overflow-y-auto text-xs text-[#1e293b]">
                    {files.map((file, index) => (
                      <li
                        key={`${file.name}-${file.lastModified}-${index}`}
                        className="flex items-center justify-between gap-3 rounded border border-[#f1f5f9] bg-[#f8fafc] px-3 py-2"
                      >
                        <span className="truncate font-medium">{file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          onClick={() => handleRemoveFile(index)}
                        >
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex justify-end">
                    <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={handleClearFiles}>
                      Clear Files
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-[#cbd5f5] bg-[#f8fafc] px-3 py-2 text-xs text-[#64748b]">
                  No files selected yet. Add multiple documents to give the AI as much context as
                  possible.
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                <Button type="button" onClick={handleAnalyze} disabled={loading}>
                  {loading ? "Analysing..." : "Analyse Documents"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadPDF}
                  disabled={!report?.summary}
                >
                  Download PDF
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handlePrint}
                  disabled={!report?.summary}
                >
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
                onChange={(event) => setReportingPeriod(event.target.value)}
                placeholder="e.g. 12 June 2025"
                className="w-full rounded-md border border-[#e2e8f0] bg-white px-4 py-3 text-sm leading-relaxed text-[#1e293b] shadow-sm focus:border-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#e2e8f0]"
              />
              <p className="text-xs text-[#64748b]">
                This appears beneath the report title. Defaults to today, but you can set any custom
                wording (e.g. “Quarter 2, 2025”).
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
                value={talkingPoints}
                onChange={(event) => setTalkingPoints(event.target.value)}
                rows={5}
                placeholder="Optional guidance for the AI. Mention key achievements, updates, or themes to weave into the generated summary."
                className="w-full resize-y rounded-md border border-[#e2e8f0] bg-white px-4 py-3 text-sm leading-relaxed text-[#1e293b] shadow-sm focus:border-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#e2e8f0]"
              />
              <p className="text-xs text-[#64748b]">
                These notes help the AI emphasise what matters most. They aren&apos;t printed in the
                final report.
              </p>
            </CardContent>
          </Card>

          <Card className="border border-[#e2e8f0] shadow-none">
            <CardHeader className="border-b border-[#f1f5f9] pb-4">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-[#475569]">
                Project Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-6">
              <textarea
                value={report?.summary ?? ""}
                onChange={(event) => handleSummaryChange(event.target.value)}
                rows={10}
                placeholder="The professional summary generated by the AI will appear here. Feel free to edit before printing."
                className="w-full resize-y rounded-md border border-[#e2e8f0] bg-white px-4 py-3 text-sm leading-relaxed text-[#1e293b] shadow-sm focus:border-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#e2e8f0]"
              />
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
            id="report"
            ref={reportRef}
            className="mx-auto w-full max-w-3xl rounded-lg border border-[#e2e8f0] bg-white px-10 py-10 shadow-lg print:mx-0 print:max-w-none print:rounded-none print:border-0 print:shadow-none print:px-0 print:py-0"
            style={{ fontFamily: '"Calibri","Arial","Helvetica",sans-serif' }}
          >
            <div className="flex flex-col gap-6">
              <PdfReportHeader title="Projects Report" reportingPeriod={reportDateLabel} />

              <div className="mt-4 flex flex-col gap-4 text-[13px] leading-relaxed text-[#202020]">
                {summaryParagraphs.length > 0 ? (
                  summaryParagraphs.map((paragraph, index) => (
                    <p key={index} className="whitespace-pre-line">
                      {paragraph}
                    </p>
                  ))
                ) : (
                  <p className="italic text-[#666666]">
                    Upload project documents and run the analysis to generate a tailored summary for
                    this report.
                  </p>
                )}
              </div>

              {stats}

              <div className="mt-10 rounded-lg border border-[#e2e8f0] bg-[#f8fafc]">
                <div className="border-b border-[#e2e8f0] bg-white px-6 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#f97316]">
                    Golf Day Project
                  </p>
                  <p className="mt-1 text-[13px] text-[#475569]">
                    Financial snapshot for the Charity Golf Day fundraiser based on the figures you
                    provided.
                  </p>
                </div>
                <div className="grid gap-x-10 gap-y-3 px-6 py-5 text-[13px] text-[#1a1a1a] sm:grid-cols-2">
                  {golfDayBreakdown.rows.map((item) => (
                    <div key={item.label} className="flex justify-between gap-4">
                      <span className="font-semibold uppercase tracking-wider text-[#555]">
                        {item.label}
                      </span>
                      <span className="font-semibold text-[#1a1a1a]">
                        {formatCurrency(item.value)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-[#e2e8f0] bg-white px-6 py-4 text-[13px] text-[#1a1a1a]">
                  <p className="font-semibold uppercase tracking-wide text-[#1a1a1a]">
                    Round Table Lilongwe 32 Net Proceeds:
                    <span className="ml-2 text-[#1d4ed8]">
                      {formatCurrency(golfDayBreakdown.rtlw32Net)}
                    </span>
                  </p>
                  <p className="mt-2 text-xs text-[#64748b]">
                    Contributions referenced: RT LLW32 collected{" "}
                    {formatCurrency(golfDayBreakdown.rtCollections)} and LSPCA collected{" "}
                    {formatCurrency(golfDayBreakdown.lspcaCollections)}.
                  </p>
                </div>
              </div>

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


