import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Phone, LogOut, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Screen } from "@/components/layout/Screen";
import { BackButton } from "@/components/layout/BackButton";
import { Card } from "@/components/layout/Card";
import { PrimaryButton, SecondaryButton, GhostButton } from "@/components/layout/Buttons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/elder/settings")({
  component: ElderSettingsScreen,
});

// TODO(backend): replace with real pairing + profile fetch from Lovable Cloud
const guardian = {
  name: "Sarah Mitchell",
  relationship: "Your daughter",
  phone: "(415) 555-0182",
  avatarUrl: "",
};
const elder = {
  phone: "(415) 555-0144",
};

function ElderSettingsScreen() {
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    // TODO(backend): clear pairing in Lovable Cloud (delete pairing row, revoke realtime)
    await new Promise((r) => setTimeout(r, 600));
    toast("You've been disconnected", {
      description: "You can reconnect any time with a new code.",
    });
    navigate({ to: "/pair" });
  };

  const handleSignOut = () => {
    // TODO(backend): sign out of Lovable Cloud auth
    toast("Signed out");
    navigate({ to: "/" });
  };

  return (
    <Screen ui="elder">
      {/* Top bar */}
      <div className="flex items-center gap-2 pt-2 pb-4">
        <BackButton fallback="/elder/home" />
        <h1 className="text-2xl font-semibold">Settings</h1>
      </div>

      <div className="flex flex-col gap-5 pb-8">
        {/* Card 1: Connected with */}
        <Card>
          <p className="text-base uppercase tracking-wide text-text-secondary font-semibold mb-4">
            Connected with
          </p>
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 shrink-0">
              <AvatarImage src={guardian.avatarUrl} alt={guardian.name} />
              <AvatarFallback className="text-xl bg-primary/20 text-accent">
                {guardian.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-[22px] font-semibold leading-tight">{guardian.name}</p>
              <p className="text-[18px] text-text-secondary mt-1">{guardian.relationship}</p>
              <p className="text-[18px] font-mono mt-3 tracking-wide">{guardian.phone}</p>
            </div>
          </div>
          <GhostButton
            onClick={() => setConfirmOpen(true)}
            className="mt-5 w-full text-danger border-danger/40"
          >
            <UserMinus size={22} />
            Disconnect
          </GhostButton>
        </Card>

        {/* Card 2: Your phone number */}
        <Card>
          <p className="text-base uppercase tracking-wide text-text-secondary font-semibold mb-3">
            Your phone number
          </p>
          <div className="flex items-center gap-3">
            <Phone size={24} className="text-accent" />
            <p className="text-[22px] font-mono tracking-wide">{elder.phone}</p>
          </div>
        </Card>

        {/* Card 3: Sign out */}
        <SecondaryButton
          onClick={handleSignOut}
          className="w-full border-2 border-danger/50 text-danger bg-transparent hover:bg-danger/5"
        >
          <LogOut size={22} />
          Sign out
        </SecondaryButton>

        {/* Footer */}
        <p className="text-center text-sm text-text-secondary/70 mt-6">
          CareConnect • v1.0
        </p>
      </div>

      {/* Disconnect confirmation modal */}
      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="disconnect-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-[max(env(safe-area-inset-top),1rem)]"
          style={{ animation: "fadeInUp 200ms ease-out" }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !disconnecting) setConfirmOpen(false);
          }}
        >
          <div
            className="w-full max-w-screen-sm bg-card rounded-2xl p-7 shadow-warm"
            style={{ animation: "scaleIn 200ms ease-out" }}
          >
            <h2 id="disconnect-title" className="text-[28px] font-bold leading-tight">
              Are you sure?
            </h2>
            <p className="text-[20px] leading-relaxed text-text-secondary mt-4">
              {guardian.name.split(" ")[0]} won't be able to check in on you anymore.
              You can always reconnect later with a new code.
            </p>
            <div className="flex flex-col gap-3 mt-7">
              <PrimaryButton
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="w-full bg-danger text-danger-foreground hover:brightness-105"
                style={{ minHeight: 64, fontSize: 22 }}
              >
                {disconnecting ? "Disconnecting..." : "Yes, disconnect"}
              </PrimaryButton>
              <GhostButton
                onClick={() => setConfirmOpen(false)}
                disabled={disconnecting}
                className="w-full"
                style={{ minHeight: 64, fontSize: 22 }}
              >
                Never mind
              </GhostButton>
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}
