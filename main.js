// Lantern Tales desktop program: serves the app's files from inside the program and opens a window.
const { app, BrowserWindow, protocol, net, shell, Menu } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

const root = path.join(__dirname, "www");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 360, minHeight: 500,
    title: "Lantern Tales", backgroundColor: "#11161f",
    icon: path.join(root, "icons", "icon-512.png"),
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: true },
  });
  // links open in the normal browser
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (ev, url) => { if (!url.startsWith("app://")) { ev.preventDefault(); shell.openExternal(url); } });
  win.loadURL("app://lantern/index.html");
}

app.whenReady().then(() => {
  protocol.handle("app", (req) => {
    let p = decodeURIComponent(new URL(req.url).pathname);
    if (p === "/" || !p) p = "/index.html";
    const file = path.normalize(path.join(root, p));
    if (!file.startsWith(root)) return new Response("Not found", { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  if (process.platform !== "darwin") Menu.setApplicationMenu(null);
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
