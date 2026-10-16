export const WINDOW_COLOR_SCHEME_CHANNEL = "window:color-scheme:set";

/** Follow Canvas appearance only for the main window's native Windows/Linux chrome. */
export function registerWindowAppearanceIpc({
  ipcMain,
  nativeTheme,
  getMainWindow,
  platform = process.platform,
}) {
  ipcMain.on(WINDOW_COLOR_SCHEME_CHANNEL, (event, appearance) => {
    if (platform !== "win32" && platform !== "linux") return;
    if (appearance !== "light" && appearance !== "dark") return;
    const win = getMainWindow();
    if (!win || win.isDestroyed() || event.sender !== win.webContents) return;
    nativeTheme.themeSource = appearance;
  });
}
