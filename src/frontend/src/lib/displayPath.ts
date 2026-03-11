export function displayPath(path: string) {
  const linuxHome = /^\/home\/[^/]+(\/.*)?$/.exec(path);
  if (linuxHome) {
    return `$HOME${linuxHome[1] ?? ""}`;
  }

  const macHome = /^\/Users\/[^/]+(\/.*)?$/.exec(path);
  if (macHome) {
    return `$HOME${macHome[1] ?? ""}`;
  }

  const windowsHome = /^[A-Za-z]:[\\/]+Users[\\/]+[^\\/]+([\\/].*)?$/i.exec(path);
  if (windowsHome) {
    const suffix = (windowsHome[1] ?? "").replace(/\\/g, "/");
    return `$HOME${suffix}`;
  }

  return path;
}
