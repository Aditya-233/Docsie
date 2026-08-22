export type ClassValue = string | number | boolean | undefined | null | Record<string, any> | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
    const classes: string[] = [];
    for (const input of inputs) {
        if (!input) continue;
        if (typeof input === "string" || typeof input === "number") classes.push(String(input));
        else if (Array.isArray(input)) { const inner = cn(...input); if (inner) classes.push(inner); }
        else if (typeof input === "object") { for (const [k, v] of Object.entries(input)) if (v) classes.push(k); }
    }
    return classes.join(" ");
}

export function formatDate(timestamp: number | string | Date): string {
    const date = new Date(timestamp), diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined });
}

export function downloadBlob(blob: Blob, filename: string): void {
    if (typeof window === "undefined") return;
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

export function extractSpaRedirectTarget(param?: string | null): string | null {
    if (!param) return null;
    let d = param; try { d = decodeURIComponent(param); } catch { }
    return (d.startsWith("/") && !d.startsWith("//") && !d.includes("\\") && !d.startsWith("/\\")) ? d : null;
}
export function buildSpaRedirectUrl(pathname: string, search = "", hash = "", repo = "/Docsie"): string {
    const p = pathname || "/", isR = p === repo || p.startsWith(`${repo}/`), pre = isR ? repo : "", sub = (isR ? p.slice(repo.length) : p).replace(/^(?!\/)/, "/");
    return `${pre}/?p=${encodeURIComponent(sub + search + hash)}`;
}
export function resolveHistoryPath(target: string, current: string, repo = "/Docsie"): string {
    return (current === repo || current.startsWith(`${repo}/`) ? repo : "") + target;
}
