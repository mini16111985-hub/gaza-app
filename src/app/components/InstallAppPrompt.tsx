"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function InstallAppPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    const isIos =
      /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
      !("standalone" in window.navigator && (window.navigator as any).standalone);

    if (isIos) {
      setShowIosHint(true);
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  if (isInstalled) return null;

  if (!deferredPrompt && !showIosHint) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl">
      <h3 className="text-base font-semibold text-white">Instaliraj aplikaciju</h3>

      {deferredPrompt ? (
        <>
          <p className="mt-2 text-sm text-zinc-300">
            Dodaj Gažu na početni ekran za brži pristup kao prava aplikacija.
          </p>
          <button
            type="button"
            onClick={handleInstall}
            className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white"
          >
            Instaliraj
          </button>
        </>
      ) : showIosHint ? (
        <p className="mt-2 text-sm text-zinc-300">
          Na iPhoneu otvori Share izbornik u Safariju i odaberi{" "}
          <span className="font-semibold text-white">Add to Home Screen</span>.
        </p>
      ) : null}
    </div>
  );
}