"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  AlertTriangleIcon,
  ArrowDownToLineIcon,
  DatabaseIcon,
  DownloadIcon,
  Loader2Icon,
  SaveIcon,
  SettingsIcon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";

import { useSettings, CLEAR_DATA_PASSWORD } from "@/hooks/useSettings";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type SettingsFormState = {
  goodThreshold: number;
  warningThreshold: number;
  emailNotifications: boolean;
  defaultLocation: string;
};

const INITIAL_FORM: SettingsFormState = {
  goodThreshold: 80,
  warningThreshold: 60,
  emailNotifications: true,
  defaultLocation: "",
};

export default function SettingsPage() {
  const {
    values,
    loading,
    saving,
    stats,
    statsLoading,
    actionInFlight,
    saveSettings,
    backupAllData,
    importFromBackup,
    clearAllData,
    refresh,
  } = useSettings();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [formState, setFormState] = useState<SettingsFormState>(INITIAL_FORM);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearPassword, setClearPassword] = useState("");

  useEffect(() => {
    setFormState({
      goodThreshold: values.goodThreshold,
      warningThreshold: values.warningThreshold,
      emailNotifications: values.emailNotifications,
      defaultLocation: values.defaultLocation,
    });
  }, [values]);

  const thresholdsValid = useMemo(
    () =>
      Number.isFinite(formState.goodThreshold) &&
      Number.isFinite(formState.warningThreshold) &&
      formState.goodThreshold >= 0 &&
      formState.warningThreshold >= 0 &&
      formState.goodThreshold <= 100 &&
      formState.warningThreshold <= 100 &&
      formState.goodThreshold >= formState.warningThreshold,
    [formState.goodThreshold, formState.warningThreshold],
  );

  const handleSave = async () => {
    if (!thresholdsValid) {
      toast.error("Please ensure thresholds are between 0 and 100, and good ≥ warning.");
      return;
    }

    try {
      await saveSettings(formState);
      toast.success("Settings saved successfully.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save settings right now.",
      );
    }
  };

  const handleBackup = async () => {
    try {
      await backupAllData();
      toast.success("Backup generated successfully.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Backup failed.");
    }
  };

  const handleTriggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const payload = JSON.parse(text) as Record<string, unknown>;
      await importFromBackup(payload);
      toast.success(`Import completed from ${file.name}.`);
      await refresh();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to import backup. Please ensure JSON format is correct.",
      );
    } finally {
      event.target.value = "";
    }
  };

  const handleOpenClearDialog = () => {
    setClearPassword("");
    setClearDialogOpen(true);
  };

  const handleConfirmClear = async () => {
    try {
      await clearAllData(clearPassword.trim());
      setClearDialogOpen(false);
      setClearPassword("");
      toast.success("All data cleared successfully.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to clear data.");
    }
  };

  const handleToggleNotifications = () => {
    setFormState((previous) => ({
      ...previous,
      emailNotifications: !previous.emailNotifications,
    }));
  };

  const currentDate = format(new Date(), "dd MMM yyyy");

  return (
    <div className="bg-slate-50/70 pb-16 pt-8">
      <div className="page-shell section-stack">
        <header className="flex flex-col gap-responsive border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-slate-900">
            <div className="flex size-10 items-center justify-center rounded-lg bg-slate-900 text-white">
              <SettingsIcon className="size-5" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Settings & Portfolio Handover</h1>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            Fine-tune attendance rules, manage operational notifications, and safeguard the Round Table portfolio with robust backup and restoration tools.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          Last refreshed: {currentDate}
        </div>
      </header>

      <section className="grid gap-responsive lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900">
              General Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="section-stack">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="goodThreshold">Good attendance threshold (%)</Label>
                <Input
                  id="goodThreshold"
                  type="number"
                  min={0}
                  max={100}
                  value={formState.goodThreshold}
                  onChange={(event) =>
                    setFormState((previous) => ({
                      ...previous,
                      goodThreshold: Number(event.target.value),
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Members at or above this percentage are considered in good standing.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="warningThreshold">Warning threshold (%)</Label>
                <Input
                  id="warningThreshold"
                  type="number"
                  min={0}
                  max={100}
                  value={formState.warningThreshold}
                  onChange={(event) =>
                    setFormState((previous) => ({
                      ...previous,
                      warningThreshold: Number(event.target.value),
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Members below this level will surface in the &ldquo;at risk&rdquo; list.
                </p>
              </div>
            </div>

            <div className="section-stack">
              <Label>Notification Preferences</Label>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Email notifications</p>
                  <p className="text-xs text-muted-foreground">
                    Receive summaries and reminders for upcoming meetings and attendance insights.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleNotifications}
                  className={cn(
                    "relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full border transition",
                    formState.emailNotifications
                      ? "border-emerald-500 bg-emerald-500"
                      : "border-slate-300 bg-slate-200",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
                      formState.emailNotifications ? "translate-x-5" : "translate-x-1",
                    )}
                  />
                </button>
              </div>
            </div>

            <div className="section-stack">
              <Label htmlFor="defaultLocation">Default meeting location</Label>
              <Input
                id="defaultLocation"
                placeholder="e.g. Radisson Blu Hotel, Cape Town"
                value={formState.defaultLocation}
                onChange={(event) =>
                  setFormState((previous) => ({
                    ...previous,
                    defaultLocation: event.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Surface this location when scheduling new meetings to speed up event creation.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleSave}
                disabled={saving || loading || !thresholdsValid}
                className="gap-2"
              >
                {saving ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" /> Saving
                  </>
                ) : (
                  <>
                    <SaveIcon className="size-4" /> Save settings
                  </>
                )}
              </Button>
              <Button variant="ghost" className="gap-2" onClick={() => void refresh()}>
                <Loader2Icon className="size-4" />
                Refresh values
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none bg-slate-900 text-slate-50 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <DatabaseIcon className="size-5" />
              Database Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="section-stack">
            <p className="text-sm text-slate-200">
              Snapshot of the current portfolio to make handovers effortless.
            </p>
            <div className="grid gap-3 text-sm">
              {statsLoading ? (
                <div className="flex items-center gap-2 text-slate-300">
                  <Loader2Icon className="size-4 animate-spin" />
                  Calculating totals...
                </div>
              ) : stats ? (
                Object.entries(stats).map(([table, count]) => (
                  <div
                    key={table}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <span className="capitalize text-slate-200">{table.replace("_", " ")}</span>
                    <span className="text-lg font-semibold text-white">{count}</span>
                  </div>
                ))
              ) : (
                <p className="text-slate-300">
                  Unable to load statistics. Try refreshing the page.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-responsive lg:grid-cols-2">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900">
              Data Management
            </CardTitle>
          </CardHeader>
          <CardContent className="section-stack">
            <div className="section-stack rounded-lg border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex items-start gap-3">
                <DownloadIcon className="mt-1 size-4 text-slate-500" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Backup all data</p>
                  <p className="text-xs text-muted-foreground">
                    Generate a complete JSON backup (meets round-table audit standards). File name format: RTL32_Backup_{format(new Date(), "yyyy-MM-dd")}.json
                  </p>
                </div>
              </div>
              <Button
                onClick={handleBackup}
                disabled={actionInFlight}
                className="w-full gap-2"
              >
                {actionInFlight ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    Preparing backup
                  </>
                ) : (
                  <>
                    <ArrowDownToLineIcon className="size-4" />
                    Backup portfolio
                  </>
                )}
              </Button>
            </div>

            <div className="section-stack rounded-lg border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex items-start gap-3">
                <UploadIcon className="mt-1 size-4 text-slate-500" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Import from backup</p>
                  <p className="text-xs text-muted-foreground">
                    Restore data from a previously exported JSON file. Existing records will be upserted by ID.
                  </p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                onChange={handleImport}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={handleTriggerImport}
                disabled={actionInFlight}
                className="gap-2"
              >
                <UploadIcon className="size-4" />
                Select backup file
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-rose-200 bg-rose-50 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-rose-700">
              <AlertTriangleIcon className="size-5" />
              Critical Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="section-stack text-sm text-rose-800">
            <p>
              Clearing data permanently deletes attendance records, members, guests, pipeliners, meetings, and charity events.
              Make sure you have a backup before continuing.
            </p>
            <Button
              variant="destructive"
              onClick={handleOpenClearDialog}
              className="w-full gap-2"
            >
              <AlertTriangleIcon className="size-4" />
              Clear all data
            </Button>
            <p className="text-xs text-rose-600">
              Confirmation password: <span className="font-semibold">{CLEAR_DATA_PASSWORD}</span>
            </p>
          </CardContent>
        </Card>
      </section>

      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear all data</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Enter the confirmation password to proceed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="clear-password">Confirmation password</Label>
            <Input
              id="clear-password"
              type="password"
              value={clearPassword}
              onChange={(event) => setClearPassword(event.target.value)}
              placeholder="Enter confirmation password"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setClearDialogOpen(false)}
              disabled={actionInFlight}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmClear}
              disabled={actionInFlight || clearPassword.trim().length === 0}
              className="gap-2"
            >
              {actionInFlight ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Clearing data
                </>
              ) : (
                <>
                  <AlertTriangleIcon className="size-4" />
                  Confirm
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}


