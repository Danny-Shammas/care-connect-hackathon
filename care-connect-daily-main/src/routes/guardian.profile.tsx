import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  Pencil,
  Camera,
  Bell,
  Shield,
  Info,
  LogOut,
  ChevronRight,
  Download,
  Trash2,
  UserPlus,
  Users,
  FileText,
  Lock,
  LifeBuoy,
  Phone,
  Mail,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Screen } from "@/components/layout/Screen";
import { GuardianTabBar } from "@/components/layout/GuardianTabBar";
import { BackButton } from "@/components/layout/BackButton";
import { Card } from "@/components/layout/Card";
import { PrimaryButton, SecondaryButton, GhostButton } from "@/components/layout/Buttons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/auth/AuthContext";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/guardian/profile")({
  component: ProfilePage,
});

// --- Page ---------------------------------------------------------------

function ProfilePage() {
  const router = useRouter();
  const auth = useAuth() as unknown as {
    signOut?: () => void | Promise<void>;
    user?: { name?: string; email?: string; phone?: string };
  };

  // Mock identity (auth provider may or may not have these in this template)
  const [name, setName] = useState(auth.user?.name ?? "Sarah Mitchell");
  const email = auth.user?.email ?? "sarah.m@example.com";
  const phone = auth.user?.phone ?? "+1 (415) 555-0148";

  const [editNameOpen, setEditNameOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [confirmDeleteHistory, setConfirmDeleteHistory] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [retentionDays, setRetentionDays] = useState(30);

  const onSignOut = async () => {
    try {
      if (typeof auth.signOut === "function") await auth.signOut();
    } catch {
      // ignore
    }
    toast.success("Signed out");
    router.navigate({ to: "/" });
  };

  return (
    <Screen className="pb-24">
      <header className="flex items-center gap-2 mb-4">
        <BackButton fallback="/guardian/dashboard" />
        <h1 className="text-2xl font-bold">Profile</h1>
      </header>

      <div className="flex flex-col gap-5">
        {/* 1) Account ------------------------------------------------ */}
        <Card>
          <SectionTitle>Your account</SectionTitle>

          <div className="mt-4 flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src="" alt={name} />
                <AvatarFallback className="text-lg font-semibold bg-accent/15 text-accent">
                  {initials(name)}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                aria-label="Change photo"
                onClick={() => toast("Photo upload coming soon")}
                className={cn(
                  "absolute -bottom-1 -right-1 h-9 w-9 rounded-full",
                  "bg-primary text-primary-foreground shadow-warm",
                  "flex items-center justify-center",
                  "ring-2 ring-card",
                )}
              >
                <Camera size={16} />
              </button>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold truncate">{name}</p>
                <button
                  type="button"
                  aria-label="Edit name"
                  onClick={() => setEditNameOpen(true)}
                  className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Pencil size={14} />
                </button>
              </div>
              <p className="text-sm text-muted-foreground truncate">{email}</p>
            </div>
          </div>

          <div className="mt-5 divide-y divide-border border-t border-border">
            <InfoRow icon={<Phone size={16} />} label="Phone" value={phone} locked />
            <InfoRow icon={<Mail size={16} />} label="Email" value={email} />
          </div>
        </Card>

        {/* 2) Connection -------------------------------------------- */}
        <Card>
          <SectionTitle>Connection</SectionTitle>

          <div className="mt-4 flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src="" alt="Eleanor" />
              <AvatarFallback className="text-base font-semibold bg-primary/15 text-primary">
                EM
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold leading-tight">Eleanor Mitchell</p>
              <p className="text-sm text-muted-foreground tabular-nums">
                +1 (415) 555-0182
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Paired since April 1, 2026
              </p>
            </div>
          </div>

          <GhostButton
            type="button"
            onClick={() => setManageOpen(true)}
            className="mt-4 w-full !min-h-11 !text-sm"
          >
            Manage connection
          </GhostButton>
        </Card>

        {/* 3) Notifications ----------------------------------------- */}
        <Card className="!p-0 overflow-hidden">
          <NavRow
            to="/guardian/notifications"
            icon={<Bell size={18} />}
            title="Notifications"
            subtitle="Thresholds and alert types"
          />
        </Card>

        {/* 4) Privacy & data --------------------------------------- */}
        <Card>
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-accent" />
            <SectionTitle as="h2">Privacy & data</SectionTitle>
          </div>

          <div className="mt-5">
            <div className="flex items-baseline justify-between">
              <label htmlFor="retention" className="text-base font-medium">
                Call recordings stored for
              </label>
              <span className="text-base font-semibold tabular-nums">
                {retentionDays} {retentionDays === 1 ? "day" : "days"}
              </span>
            </div>
            <Slider
              id="retention"
              min={7}
              max={90}
              step={1}
              value={[retentionDays]}
              onValueChange={([v]) => setRetentionDays(v)}
              className="mt-3"
            />
            <div className="mt-1.5 flex justify-between text-xs text-muted-foreground tabular-nums">
              <span>7 days</span>
              <span>90 days</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Older recordings are deleted automatically. Transcripts are kept for context.
            </p>
          </div>

          <div className="mt-5 divide-y divide-border border-t border-border">
            <ActionRow
              icon={<Download size={18} />}
              title="Download my data"
              subtitle="Get a copy of your account data"
              onClick={() => {
                // TODO(backend): export user data
                toast.success("We'll email you a download link");
              }}
            />
            <ActionRow
              icon={<Trash2 size={18} />}
              title="Delete all call history"
              subtitle="Recordings, transcripts, and summaries"
              danger
              onClick={() => setConfirmDeleteHistory(true)}
            />
          </div>
        </Card>

        {/* 5) About ------------------------------------------------- */}
        <Card>
          <div className="flex items-center gap-2">
            <Info size={18} className="text-accent" />
            <SectionTitle as="h2">About</SectionTitle>
          </div>

          <div className="mt-3 divide-y divide-border border-t border-border">
            <VersionRow />
            <ExternalRow icon={<FileText size={16} />} title="Terms of service" href="#" />
            <ExternalRow icon={<Lock size={16} />} title="Privacy policy" href="#" />
            <ExternalRow
              icon={<LifeBuoy size={16} />}
              title="Contact support"
              href="mailto:support@careconnect.app"
            />
          </div>
        </Card>

        {/* Future placeholders ------------------------------------- */}
        <section>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2 px-1">
            Coming soon
          </p>
          <div className="flex flex-col gap-3">
            <ComingSoonRow
              icon={<UserPlus size={18} />}
              title="Add another guardian"
              subtitle="Share care with a sibling or partner"
            />
            <ComingSoonRow
              icon={<Users size={18} />}
              title="Add another family member"
              subtitle="Connect with a second parent or relative"
            />
          </div>
        </section>

        {/* 6) Sign out --------------------------------------------- */}
        <SecondaryButton
          type="button"
          onClick={() => setConfirmSignOut(true)}
          className={cn(
            "w-full !bg-transparent !text-danger",
            "border border-danger/30 hover:!bg-danger/5 active:!bg-danger/10",
          )}
        >
          <LogOut size={18} /> Sign out
        </SecondaryButton>
      </div>

      {/* Edit name dialog */}
      <EditNameDialog
        open={editNameOpen}
        onOpenChange={setEditNameOpen}
        initial={name}
        onSave={(v) => {
          setName(v);
          // TODO(backend): persist name
          toast.success("Name updated");
        }}
      />

      {/* Manage connection sheet */}
      <Sheet open={manageOpen} onOpenChange={setManageOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="text-left">
            <SheetTitle>Manage connection</SheetTitle>
            <SheetDescription className="text-sm">
              Disconnecting will stop all calls and clear pairing on both devices.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-5">
            <button
              type="button"
              onClick={() => {
                setManageOpen(false);
                setConfirmDisconnect(true);
              }}
              className={cn(
                "w-full text-left rounded-lg border border-danger/30 bg-danger/5",
                "px-4 py-3 flex items-center gap-3 hover:bg-danger/10 transition-colors",
              )}
            >
              <span className="h-10 w-10 rounded-full bg-danger/10 text-danger flex items-center justify-center">
                <X size={18} />
              </span>
              <span className="flex-1">
                <span className="block text-base font-semibold text-danger">
                  Disconnect from Eleanor
                </span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  You'll need a new pairing code to reconnect.
                </span>
              </span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirm disconnect */}
      <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect from Eleanor?</AlertDialogTitle>
            <AlertDialogDescription>
              This will end check-in calls and remove the pairing on her device too.
              You can reconnect with a new code anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Never mind</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-danger-foreground hover:bg-danger/90"
              onClick={() => {
                // TODO(backend): clear pairing
                toast.success("Disconnected");
                router.navigate({ to: "/pair" });
              }}
            >
              Yes, disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm delete history */}
      <AlertDialog open={confirmDeleteHistory} onOpenChange={setConfirmDeleteHistory}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all call history?</AlertDialogTitle>
            <AlertDialogDescription>
              All recordings, transcripts, and summaries will be permanently removed.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-danger-foreground hover:bg-danger/90"
              onClick={() => {
                // TODO(backend): wipe history
                toast.success("Call history deleted");
              }}
            >
              Delete everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm sign out */}
      <AlertDialog open={confirmSignOut} onOpenChange={setConfirmSignOut}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll need to sign in again to see Eleanor's check-ins.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onSignOut}>Sign out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
          <GuardianTabBar />
    </Screen>
  );
}

// --- Subcomponents ------------------------------------------------------

function SectionTitle({
  children,
  as: As = "h2",
}: {
  children: React.ReactNode;
  as?: "h2" | "h3";
}) {
  return <As className="text-lg font-semibold">{children}</As>;
}

function InfoRow({
  icon,
  label,
  value,
  locked,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  locked?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-3 first:pt-3">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <span className="text-sm text-muted-foreground w-20 shrink-0">{label}</span>
      <span className="flex-1 text-sm text-foreground tabular-nums truncate">{value}</span>
      {locked && (
        <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
          <Lock size={12} /> Locked
        </span>
      )}
    </div>
  );
}

/**
 * Hidden dev menu: 5 quick taps on the version number seeds demo data.
 * No visible affordance — by design, only used live during demos.
 */
function VersionRow() {
  const [taps, setTaps] = useState(0);
  const onTap = () => {
    const next = taps + 1;
    setTaps(next);
    if (next >= 5) {
      // Lazy-load to keep this off the critical path
      import("@/lib/seedDemoData").then(({ seedDemoData }) => {
        seedDemoData();
        toast.success("Demo data loaded", {
          description: "Eleanor + 14 days of calls + 1 alert seeded.",
        });
      });
      setTaps(0);
    } else if (next >= 3) {
      toast(`${5 - next} more…`, { duration: 800 });
    }
    window.setTimeout(() => setTaps((t) => (t === next ? 0 : t)), 1500);
  };
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label="App version"
      className="flex w-full items-center gap-3 py-3 first:pt-3 text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="text-sm text-muted-foreground w-20 shrink-0">Version</span>
      <span className="flex-1 text-sm text-foreground tabular-nums truncate">1.0.0 (build 42)</span>
    </button>
  );
}

function NavRow({
  to,
  icon,
  title,
  subtitle,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <Link
      to={to as never}
      className="flex items-center gap-3 px-4 py-4 hover:bg-muted/50 transition-colors"
    >
      <span className="h-10 w-10 rounded-full bg-accent/10 text-accent flex items-center justify-center">
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-base font-medium">{title}</span>
        {subtitle && (
          <span className="block text-xs text-muted-foreground mt-0.5">{subtitle}</span>
        )}
      </span>
      <ChevronRight size={18} className="text-muted-foreground" />
    </Link>
  );
}

function ActionRow({
  icon,
  title,
  subtitle,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 py-3 text-left hover:bg-muted/40 -mx-1 px-1 rounded-md transition-colors"
    >
      <span
        className={cn(
          "h-10 w-10 rounded-full flex items-center justify-center",
          danger ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent",
        )}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span
          className={cn("block text-base font-medium", danger && "text-danger")}
        >
          {title}
        </span>
        {subtitle && (
          <span className="block text-xs text-muted-foreground mt-0.5">{subtitle}</span>
        )}
      </span>
      <ChevronRight size={18} className="text-muted-foreground" />
    </button>
  );
}

function ExternalRow({
  icon,
  title,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      className="flex items-center gap-3 py-3 hover:bg-muted/40 -mx-1 px-1 rounded-md transition-colors"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 text-sm text-foreground">{title}</span>
      <ChevronRight size={16} className="text-muted-foreground" />
    </a>
  );
}

function ComingSoonRow({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div
      className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 flex items-center gap-3 opacity-70"
      aria-disabled
    >
      <span className="h-10 w-10 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-base font-medium text-foreground/80">{title}</span>
        <span className="block text-xs text-muted-foreground mt-0.5">{subtitle}</span>
      </span>
      <span className="rounded-pill bg-background border border-border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Coming soon
      </span>
    </div>
  );
}

// --- Edit name dialog --------------------------------------------------

function EditNameDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: string;
  onSave: (v: string) => void;
}) {
  const [value, setValue] = useState(initial);

  // Reset when reopened
  if (open && value === "" && initial) {
    // no-op: keep simple, user can retype
  }

  return (
    <AlertDialog open={open} onOpenChange={(v) => {
      onOpenChange(v);
      if (v) setValue(initial);
    }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Edit name</AlertDialogTitle>
          <AlertDialogDescription>
            This is what Eleanor sees on her device.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="mt-2">
          <Label htmlFor="name-input" className="sr-only">Name</Label>
          <Input
            id="name-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Your name"
            className="h-11 text-base"
            autoFocus
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              const trimmed = value.trim();
              if (!trimmed) {
                toast.error("Name cannot be empty");
                return;
              }
              onSave(trimmed);
            }}
          >
            <Check size={16} className="mr-1" /> Save
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// --- Helpers ----------------------------------------------------------

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

// Use the PrimaryButton import to avoid unused warning if dead-code paths drop it
void PrimaryButton;
