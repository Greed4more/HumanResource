import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

const KEY = "afterclass-theme";

/** Runs in <head> before paint so the saved theme never flashes. Falls back to the device setting. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${KEY}");if(!t)t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.classList.toggle("light",t==="light");}catch(e){}})();`;

export function ThemeToggle() {
  const [light, setLight] = useState<boolean | null>(null);
  useEffect(() => setLight(document.documentElement.classList.contains("light")), []);

  function toggle() {
    const next = !document.documentElement.classList.contains("light");
    document.documentElement.classList.toggle("light", next);
    try {
      localStorage.setItem(KEY, next ? "light" : "dark");
    } catch {
      /* storage blocked */
    }
    setLight(next);
  }

  const label = light ? "Switch to dark mode" : "Switch to light mode";
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      {light === null ? (
        <span className="size-4" />
      ) : light ? (
        <Moon aria-hidden="true" />
      ) : (
        <Sun aria-hidden="true" />
      )}
    </Button>
  );
}
