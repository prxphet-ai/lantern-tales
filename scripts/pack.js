// Packages the desktop program: node scripts/pack.js <win32|darwin|linux> <x64|arm64>
const { packager } = require("@electron/packager");
const path = require("path");
const [platform = process.platform, arch = process.arch] = process.argv.slice(2);
const root = path.join(__dirname, "..");
packager({
  dir: root, out: path.join(root, "dist"), platform, arch, overwrite: true, asar: false, prune: true,
  name: "Lantern Tales", executableName: platform === "linux" ? "lantern-tales" : "Lantern Tales",
  icon: platform === "win32" ? path.join(root, "www/icons/icon.ico") : platform === "darwin" ? path.join(root, "build/icon.icns") : undefined,
  appBundleId: "app.lanterntales",
  ignore: [/^\/dist/, /^\/scripts/, /^\/build/, /^\/\.github/, /^\/README/, /^\/www\/\.nojekyll/],
}).then((out) => console.log("built", out.join(", "))).catch((e) => { console.error(e); process.exit(1); });
