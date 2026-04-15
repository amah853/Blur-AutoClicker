import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  captureHotkey,
  captureMouseHotkey,
  captureWheelHotkey,
  formatHotkeyForDisplay,
  getKeyboardLayoutMap,
  type HotkeyDisplayLabels,
} from "../hotkeys";
import { useTranslation, type TranslationKey } from "../i18n";

interface Props {
  value: string;
  onChange: (next: string) => void;
  className: string;
  style?: React.CSSProperties;
}

export default function HotkeyCaptureInput({
  value,
  onChange,
  className,
  style,
}: Props) {
  const [listening, setListening] = useState(false);
  const [layoutMap, setLayoutMap] =
    useState<Awaited<ReturnType<typeof getKeyboardLayoutMap>>>(null);
  const { t } = useTranslation();

  useEffect(() => {
    let active = true;

    getKeyboardLayoutMap().then((map) => {
      if (active) {
        setLayoutMap(map);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    invoke("set_hotkey_capture_active", { active: listening }).catch((err) => {
      console.error("Failed to toggle hotkey capture state:", err);
    });

    return () => {
      if (!listening) return;

      invoke("set_hotkey_capture_active", { active: false }).catch((err) => {
        console.error("Failed to clear hotkey capture state:", err);
      });
    };
  }, [listening]);

  const hotkeyLabels = useMemo<HotkeyDisplayLabels>(() => {
    const keyCodes = [
      "up",
      "down",
      "left",
      "right",
      "pageup",
      "pagedown",
      "backspace",
      "delete",
      "insert",
      "home",
      "end",
      "enter",
      "tab",
      "space",
      "escape",
      "esc",
      "mouseleft",
      "mouseright",
      "mousemiddle",
      "mouse4",
      "mouse5",
      "scrollup",
      "scrolldown",
      "numpad0",
      "numpad1",
      "numpad2",
      "numpad3",
      "numpad4",
      "numpad5",
      "numpad6",
      "numpad7",
      "numpad8",
      "numpad9",
      "numpadadd",
      "numpadsubtract",
      "numpadmultiply",
      "numpaddivide",
      "numpaddecimal",
      "numpadenter",
    ] as const;

    return {
      empty: t("hotkey.empty"),
      modifiers: {
        ctrl: t("hotkey.modifier.ctrl"),
        alt: t("hotkey.modifier.alt"),
        shift: t("hotkey.modifier.shift"),
        super: t("hotkey.modifier.super"),
      },
      keys: Object.fromEntries(
        keyCodes.map((code) => [
          code,
          t(`hotkey.key.${code}` as TranslationKey),
        ]),
      ),
    };
  }, [t]);

  const displayText = useMemo(
    () =>
      listening
        ? t("hotkey.pressKeys")
        : formatHotkeyForDisplay(value, layoutMap, hotkeyLabels),
    [hotkeyLabels, layoutMap, listening, t, value],
  );

  const acceptHotkey = (
    nextHotkey: string | null,
    target: HTMLInputElement,
  ) => {
    if (!nextHotkey) return;
    onChange(nextHotkey);
    setListening(false);
    target.blur();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.key === "Escape") {
      setListening(false);
      event.currentTarget.blur();
      return;
    }

    if (
      (event.key === "Backspace" || event.key === "Delete") &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.shiftKey &&
      !event.metaKey
    ) {
      onChange("");
      setListening(false);
      event.currentTarget.blur();
      return;
    }

    acceptHotkey(
      captureHotkey({
        key: event.key,
        code: event.code,
        location: event.location,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        metaKey: event.metaKey,
      }),
      event.currentTarget,
    );
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLInputElement>) => {
    // Left click (button 0) is used to start listening — don't capture it
    // if no modifier is present.
    if (!listening) return;

    if (event.button === 0) {
      const hasModifier =
        event.ctrlKey || event.altKey || event.shiftKey || event.metaKey;
      if (!hasModifier) return;
    }

    event.preventDefault();
    event.stopPropagation();
    acceptHotkey(captureMouseHotkey(event), event.currentTarget);
  };

  const handleWheel = (event: React.WheelEvent<HTMLInputElement>) => {
    if (!listening) return;

    event.preventDefault();
    event.stopPropagation();
    acceptHotkey(captureWheelHotkey(event), event.currentTarget);
  };

  const handleContextMenu = (event: React.MouseEvent<HTMLInputElement>) => {
    // Prevent context menu when listening so right-click can be captured
    if (listening) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <input
      type="text"
      className={className}
      value={displayText}
      readOnly
      onFocus={() => setListening(true)}
      onBlur={() => setListening(false)}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
      spellCheck={false}
      style={style}
    />
  );
}
