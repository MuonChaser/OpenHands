// @vitest-environment node
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import {
  registerWindowAppearanceIpc,
  WINDOW_COLOR_SCHEME_CHANNEL,
} from "../../../electron/lib/window-appearance.mjs";

const preload = readFileSync(
  new URL("../../../electron/preload-main.cjs", import.meta.url),
  "utf8",
);

function desktop(platform: NodeJS.Platform = "win32") {
  const ipcMain = new EventEmitter();
  const nativeTheme = { themeSource: "dark" };
  const win = { webContents: {}, isDestroyed: () => false };
  let mainWindow: typeof win | null = win;
  registerWindowAppearanceIpc({
    ipcMain,
    nativeTheme,
    getMainWindow: () => mainWindow,
    platform,
  });
  let shell: { setColorScheme: (appearance: unknown) => void };
  runInNewContext(preload, {
    process: { platform },
    require: () => ({
      contextBridge: {
        exposeInMainWorld: (name: string, value: typeof shell) => {
          if (name === "desktopShell") shell = value;
        },
      },
      ipcRenderer: {
        sendSync: () => false,
        on: () => {},
        send: (channel: string, appearance: unknown) => {
          ipcMain.emit(channel, { sender: win.webContents }, appearance);
        },
      },
    }),
  });
  return {
    ipcMain,
    nativeTheme,
    win,
    setColorScheme: (appearance: unknown) => shell.setColorScheme(appearance),
    closeWindow: () => {
      mainWindow = null;
    },
  };
}

describe("desktop window appearance", () => {
  it.each(["win32", "linux"] as const)(
    "sends palette changes through the real preload and handler on %s",
    (platform) => {
      const app = desktop(platform);

      app.setColorScheme("light");
      expect(app.nativeTheme.themeSource).toBe("light");
      app.setColorScheme("dark");
      expect(app.nativeTheme.themeSource).toBe("dark");
    },
  );

  it("preserves macOS native appearance", () => {
    const app = desktop("darwin");
    app.setColorScheme("light");
    expect(app.nativeTheme.themeSource).toBe("dark");
  });

  it.each(["system", "invalid", null, {}, 1])(
    "rejects an invalid appearance (%j) at the IPC boundary",
    (appearance) => {
      const app = desktop();
      app.setColorScheme(appearance);
      expect(app.nativeTheme.themeSource).toBe("dark");
    },
  );

  it("ignores messages from a splash or popup renderer", () => {
    const app = desktop();
    app.ipcMain.emit(WINDOW_COLOR_SCHEME_CHANNEL, { sender: {} }, "light");
    expect(app.nativeTheme.themeSource).toBe("dark");
  });

  it("ignores messages after the main window closes", () => {
    const app = desktop();
    app.closeWindow();
    app.setColorScheme("light");
    expect(app.nativeTheme.themeSource).toBe("dark");
  });

  it("ignores messages from a destroyed window", () => {
    const app = desktop();
    app.win.isDestroyed = () => true;
    app.setColorScheme("light");
    expect(app.nativeTheme.themeSource).toBe("dark");
  });
});
