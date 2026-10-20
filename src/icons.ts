const paths = {
  add: '<path d="M12 4v16M4 12h16"/>',
  photo: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 3 3 3-4 5 6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/>',
  document: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8m-8 4h8"/>',
  word: '<path fill="#41a5ee" stroke="none" d="M15 2h6a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2h-6z"/><path fill="#2b7cd3" stroke="none" d="M10 4h8v16h-8z"/><path fill="#185abd" stroke="none" d="m2 6 11-2v16L2 18z"/><text x="3.2" y="16.5" fill="#fff" stroke="none" font-family="Arial,sans-serif" font-size="12" font-weight="700">W</text>',
  upload: '<path d="M12 15V3m0 0L7 8m5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  download: '<path d="M12 3v12m0 0 5-5m-5 5-5-5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  checkList: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 9 1.5 1.5L12 8m1 2h3M8 16h1m3 0h4"/>',
  note: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16.5 9"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
  warning: '<path d="M10.3 4.3 2.8 17.2A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.8L13.7 4.3a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 3h.01"/>',
  close: '<path d="m18 6-12 12M6 6l12 12"/>',
  arrowUp: '<path d="m5 12 7-7 7 7M12 19V5"/>',
  arrowLeft: '<path d="m15 18-6-6 6-6M9 12h11"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
  moon: '<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>',
  pdf: '<path fill="#ef4444" stroke="none" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path fill="#fff" stroke="none" d="M14 2v6h6"/><path d="M7 14h10M7 17h10" stroke="#fff"/>',
} as const;

export type IconName = keyof typeof paths;

export function createIcon(name: IconName, className = "ui-icon"): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2.1");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add(className);
  svg.innerHTML = paths[name];
  return svg;
}

const googleCalendarMarkup = '<path fill="#4285f4" d="M22 4.5v6H10v11H4V6.5a2.0059 2.0059 0 0 1 2-2z"/><polygon fill="#ea4435" points="22 27.5 22 21.5 28 21.5 22 27.5"/><rect width="6" height="12" x="22" y="9.5" fill="#ffba00"/><rect width="6" height="12" x="13" y="18.5" fill="#00ac47" transform="rotate(90 16 24.5)"/><path fill="#0066da" d="M28 6.5v4h-6v-6h4a2.0059 2.0059 0 0 1 2 2"/><path fill="#188038" d="M10 21.5v6H6a2.0059 2.0059 0 0 1-2-2v-4z"/><path fill="#4285f4" d="M15.69 17.09c0 .89-.66 1.79-2.15 1.79a3.0026 3.0026 0 0 1-1.52-.39l-.08-.06.29-.82.13.08a2.3554 2.3554 0 0 0 1.17.34 1.191 1.191 0 0 0 .88-.31.8586.8586 0 0 0 .25-.65c-.01-.73-.68-.99-1.31-.99h-.54v-.81h.54c.45 0 1.12-.22 1.12-.82 0-.45-.31-.71-.85-.71a1.8865 1.8865 0 0 0-1.04.34l-.14.1-.28-.79.07-.06a2.834 2.834 0 0 1 1.53-.45c1.19 0 1.72.73 1.72 1.45a1.4369 1.4369 0 0 1-.81 1.3 1.52 1.52 0 0 1 1.04 1.5Z"/><polygon fill="#4285f4" points="18.71 12.98 18.71 18.79 17.73 18.79 17.73 14 16.79 14.51 16.58 13.69 17.95 12.98 18.71 12.98"/>';

const brandIconUrls = {
  microsoftWord:
    "https://res.cdn.office.net/files/fabric-cdn-prod_20251117.001/assets/brand-icons/product/png/word_48x1.png",
} as const;

export function createGoogleCalendarIcon(className = "ui-brand-icon"): HTMLImageElement {
  const image = document.createElement("img");
  image.className = className;
  image.src = "https://img.icons8.com/plasticine/100/google-calendar--v1.png";
  image.alt = "";
  image.loading = "lazy";
  image.addEventListener("error", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 32 32");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.classList.add(className);
    svg.innerHTML = googleCalendarMarkup;
    image.replaceWith(svg);
  }, { once: true });
  return image;
}

export function createChecklistBrandIcon(): HTMLImageElement {
  const image = document.createElement("img");
  image.className = "ui-brand-icon";
  image.src = "https://img.icons8.com/pulsar-color/48/checklist.png";
  image.alt = "";
  image.loading = "lazy";
  image.addEventListener("error", () => {
    image.replaceWith(createIcon("checkList"));
  }, { once: true });
  return image;
}

export function createBackupBrandIcon(): HTMLImageElement {
  const image = document.createElement("img");
  image.className = "ui-brand-icon";
  image.src = "https://img.icons8.com/arcade/64/downloads-folder.png";
  image.alt = "";
  image.loading = "lazy";
  image.addEventListener("error", () => {
    image.replaceWith(createIcon("download"));
  }, { once: true });
  return image;
}

export function createPdfBrandIcon(): HTMLImageElement {
  const image = document.createElement("img");
  image.className = "ui-brand-icon";
  image.src = "https://img.icons8.com/color/48/pdf.png";
  image.alt = "";
  image.loading = "lazy";
  image.addEventListener("error", () => {
    image.replaceWith(createIcon("pdf"));
  }, { once: true });
  return image;
}

export function createImportFileIcon(): HTMLImageElement {
  const image = document.createElement("img");
  image.className = "ui-brand-icon";
  image.src = "https://img.icons8.com/pulsar-color/48/import-file.png";
  image.alt = "";
  image.loading = "lazy";
  image.addEventListener("error", () => {
    image.replaceWith(createIcon("upload"));
  }, { once: true });
  return image;
}

export function createGoogleAssistantIcon(): HTMLImageElement {
  const image = document.createElement("img");
  image.className = "google-status-assistant";
  image.src = "https://img.icons8.com/color/48/google-assistant--v1.png";
  image.alt = "";
  image.setAttribute("aria-hidden", "true");
  image.loading = "lazy";
  image.addEventListener("error", () => {
    image.replaceWith(createIcon("info", "google-status-assistant-fallback"));
  }, { once: true });
  return image;
}

export function createPhotoScanIcon(): HTMLImageElement {
  const image = document.createElement("img");
  image.className = "ui-brand-icon";
  image.src = "https://img.icons8.com/parakeet/48/portrait-mode-scanning.png";
  image.alt = "";
  image.loading = "lazy";
  image.addEventListener("error", () => {
    image.replaceWith(createIcon("photo"));
  }, { once: true });
  return image;
}

export function createBrandIcon(
  name: keyof typeof brandIconUrls,
  alt: string,
): HTMLImageElement {
  const image = document.createElement("img");
  image.className = "ui-brand-icon";
  image.src = name === "microsoftWord"
    ? "https://img.icons8.com/color/48/microsoft-word-2019--v2.png"
    : brandIconUrls[name];
  image.alt = alt;
  image.loading = "lazy";
  image.addEventListener("error", () => {
    image.replaceWith(createIcon("word"));
  }, { once: true });
  return image;
}

export function setButtonIconLabel(
  button: HTMLButtonElement,
  iconName: IconName,
  label: string,
): void {
  button.replaceChildren(createIcon(iconName), document.createTextNode(label));
  button.classList.add("button-with-icon");
}
