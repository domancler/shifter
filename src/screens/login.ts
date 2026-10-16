
import { el } from "../ui";
import { go } from "../router";
import { showToast } from "../toast";

export function loginScreen(): HTMLElement {
    const status = el("p", {
        className: "login-status",
        text: "",
    });

    return el("main", { className: "screen login-screen" }, [
        el("header", { className: "brand-header login-header" }, [
            el("div", { className: "login-logo", text: "S" }),
            el("h1", { text: "Shifter" }),
            el("p", {
                className: "muted",
                text: "Il tuo programmato, senza complicazioni.",
            }),
        ]),

        el("section", { className: "login-panel" }, [
            el("h2", { text: "Bentornato!" }),
            el("p", {
                className: "muted",
                text: "Accedi per gestire il tuo programmato.",
            }),

            el("button", {
                className: "login-google-button",
                onClick: () => {
                    showToast(
                        "L'accesso con Google sarà disponibile prossimamente.",
                        "info",
                        "Ci siamo quasi!",
                    );
                },
            }, [
                (() => {
                    const icon = document.createElement("span");
                    icon.className = "login-google-icon";

                    icon.innerHTML = `
                <svg viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z"/>
                <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"/>
                <path fill="#FBBC05" d="M12.6 27.7a12 12 0 0 1 0-7.4V15H5.8a20 20 0 0 0 0 18l6.8-5.3Z"/>
                <path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6.1 29.5 4 24 4A20 20 0 0 0 5.8 15l6.8 5.3c1.6-4.8 6.1-8.2 11.4-8.2Z"/>
                </svg>
            `;

                    return icon;
                })(),
                el("span", { text: "Accedi con Google" }),
            ]),

            status,

            el("div", { className: "login-separator" }, [
                el("span", { text: "oppure" }),
            ]),

            el("button", {
                className: "login-continue-button",
                text: "Continua senza accedere",
                onClick: () => go("menu"),
            }),
        ]),

        el("p", {
            className: "footer-note login-footer",
            text: "Accesso Google non ancora attivo.",
        }),
    ]);
}
