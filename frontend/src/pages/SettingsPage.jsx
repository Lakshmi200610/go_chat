import { useState, useEffect } from "react";
import { useThemeStore } from "../store/useThemeStore";
import { Volume2, VolumeX, MessageSquare } from "lucide-react";

const THEMES = [
  "light",
  "dark",
  "cupcake",
  "bumblebee",
  "emerald",
  "corporate",
  "synthwave",
  "retro",
  "cyberpunk",
  "valentine",
  "halloween",
  "garden",
  "forest",
  "aqua",
  "lofi",
  "pastel",
  "fantasy",
  "wireframe",
  "black",
  "luxury",
  "dracula",
  "cmyk",
  "autumn",
  "business",
  "acid",
  "lemonade",
  "night",
  "coffee",
  "winter",
  "dim",
  "nord",
  "sunset",
];

const SettingsPage = () => {
  const { theme, setTheme } = useThemeStore();
  const [isMuted, setIsMuted] = useState(localStorage.getItem("chat-muted") === "true");
  const [isTypingMuted, setIsTypingMuted] = useState(
    localStorage.getItem("chat-typing-muted") === "true"
  );

  const handleMuteToggle = (e) => {
    const val = e.target.checked;
    setIsMuted(val);
    localStorage.setItem("chat-muted", String(val));
  };

  const handleTypingMuteToggle = (e) => {
    const val = e.target.checked;
    setIsTypingMuted(val);
    localStorage.setItem("chat-typing-muted", String(val));
  };

  return (
    <div className="min-h-screen pt-20 bg-base-200">
      <div className="max-w-4xl mx-auto p-4 py-8 space-y-6">
        <div className="bg-base-100 rounded-2xl p-6 shadow-xl space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-xl font-bold">Settings</h1>
            <p className="text-sm text-base-content/60">Customize your chat interface experience</p>
          </div>

          {/* Sound Preferences Section */}
          <div className="border-t border-base-300 pt-6 space-y-4">
            <h2 className="text-md font-semibold flex items-center gap-2">
              <Volume2 className="w-5 h-5" /> Sound Preferences
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Notification sound toggle */}
              <div className="flex items-center justify-between bg-base-200 p-4 rounded-xl border border-base-300">
                <div>
                  <div className="font-medium text-sm">Notification Sounds</div>
                  <div className="text-xs text-base-content/60">Play sound alert on new messages</div>
                </div>
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={!isMuted}
                  onChange={(e) => handleMuteToggle({ target: { checked: !e.target.checked } })}
                />
              </div>

              {/* Typing click sound toggle */}
              <div className="flex items-center justify-between bg-base-200 p-4 rounded-xl border border-base-300">
                <div>
                  <div className="font-medium text-sm">Typing Audio Clicks</div>
                  <div className="text-xs text-base-content/60">Play click sounds when contacts are typing</div>
                </div>
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={!isTypingMuted}
                  onChange={(e) =>
                    handleTypingMuteToggle({ target: { checked: !e.target.checked } })
                  }
                />
              </div>
            </div>
          </div>

          {/* Themes Section */}
          <div className="border-t border-base-300 pt-6 space-y-4">
            <div>
              <h2 className="text-md font-semibold">Themes</h2>
              <p className="text-xs text-base-content/60">Choose a color palette for your interface</p>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {THEMES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`
                    group flex flex-col items-center gap-1.5 p-2 rounded-lg transition-colors
                    ${theme === t ? "bg-base-300 ring-2 ring-primary" : "hover:bg-base-200"}
                  `}
                >
                  <div className="w-full h-8 rounded-md overflow-hidden flex" data-theme={t}>
                    <div className="w-1/4 bg-primary" />
                    <div className="w-1/4 bg-secondary" />
                    <div className="w-1/4 bg-accent" />
                    <div className="w-1/4 bg-neutral" />
                  </div>
                  <span className="text-[10px] font-semibold truncate w-full text-center">
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Theme Mockup Preview */}
          <div className="border-t border-base-300 pt-6">
            <h3 className="text-sm font-semibold mb-3">Live Theme Preview</h3>
            <div className="border border-base-300 rounded-xl overflow-hidden shadow-lg bg-base-100">
              <div className="p-4 bg-base-200 flex items-center justify-between border-b border-base-300">
                <div className="flex items-center gap-2">
                  <div className="avatar placeholder">
                    <div className="bg-primary text-primary-content rounded-full w-8 h-8">
                      <span className="text-xs font-semibold">JD</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold">John Doe</div>
                    <div className="text-[10px] text-green-500">Online</div>
                  </div>
                </div>
              </div>

              {/* Chat Body Mockup */}
              <div className="p-4 space-y-3 min-h-[140px] bg-base-100">
                <div className="chat chat-start">
                  <div className="chat-bubble bg-base-200 text-base-content text-xs">
                    Hey! How do you like the new theme?
                  </div>
                </div>
                <div className="chat chat-end">
                  <div className="chat-bubble chat-bubble-primary text-xs">
                    It looks absolutely stunning! Loving the glassmorphic designs too.
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
