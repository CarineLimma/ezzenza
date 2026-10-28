document.addEventListener("DOMContentLoaded", () => {

    const $ = (id) => document.getElementById(id);
    const form = $("settingsForm");

    if (!form) return;

    async function api(url, options = {}) {
        const response = await fetch(url, {
            credentials: "same-origin",
            ...options
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                payload.erro ||
                `Erro ${response.status}: operação não concluída.`
            );
        }

        return payload;
    }

    function showFeedback(mensagem, tipo = "sucesso") {
        let toast = document.getElementById("settingsToast");

        if (!toast) {
            toast = document.createElement("div");
            toast.id = "settingsToast";
            toast.style.cssText = `
                position: fixed;
                bottom: 30px;
                right: 30px;
                padding: 14px 22px;
                border-radius: 10px;
                font-size: 13px;
                font-weight: 600;
                z-index: 9999;
                transition: opacity 0.4s ease;
            `;
            document.body.appendChild(toast);
        }

        toast.textContent = mensagem;
        toast.style.background = tipo === "sucesso" ? "#4C7958" : "#A45D60";
        toast.style.color = "white";
        toast.style.opacity = "1";

        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => {
            toast.style.opacity = "0";
        }, 3000);
    }

    async function loadSettings() {
        try {
            const dados = await api("/api/configuracoes");

            const fields = [
                "clinicName", "clinicPhone", "clinicEmail", "clinicDocument",
                "clinicCity", "clinicAddress", "clinicDescription",
                "openingTime", "closingTime", "lunchStart", "lunchEnd",
                "appointmentInterval", "defaultAppointmentStatus",
                "whatsappNumber", "confirmationMessage",
                "pixKey", "pixHolder", "systemDisplayName"
            ];

            fields.forEach(id => {
                const el = $(id);
                if (el && dados[id] !== undefined) el.value = dados[id];
            });

            const checkboxFields = [
                "allowFutureAppointments", "preventDoubleBooking",
                "useCustomMessage", "manualPaymentConfirmation"
            ];

            checkboxFields.forEach(id => {
                const el = $(id);
                if (el && dados[id] !== undefined) {
                    el.checked = dados[id] === true || dados[id] === "true" || dados[id] === 1;
                }
            });

            if (dados.workingDays) {
                const days = Array.isArray(dados.workingDays)
                    ? dados.workingDays
                    : String(dados.workingDays).split(",");

                form.querySelectorAll("input[name='workingDays']").forEach(cb => {
                    cb.checked = days.includes(cb.value);
                });
            }

            if (dados.acceptedPayments) {
                const payments = Array.isArray(dados.acceptedPayments)
                    ? dados.acceptedPayments
                    : String(dados.acceptedPayments).split(",");

                form.querySelectorAll("input[name='acceptedPayments']").forEach(cb => {
                    cb.checked = payments.includes(cb.value);
                });
            }

        } catch (error) {
            console.warn("Não foi possível carregar as configurações:", error.message);
        }
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const data = Object.fromEntries(new FormData(form).entries());

        data.workingDays = Array.from(
            form.querySelectorAll("input[name='workingDays']:checked")
        ).map(cb => cb.value).join(",");

        data.acceptedPayments = Array.from(
            form.querySelectorAll("input[name='acceptedPayments']:checked")
        ).map(cb => cb.value).join(",");

        data.allowFutureAppointments =
            $("allowFutureAppointments")?.checked ? "true" : "false";

        data.preventDoubleBooking =
            $("preventDoubleBooking")?.checked ? "true" : "false";

        data.useCustomMessage =
            $("useCustomMessage")?.checked ? "true" : "false";

        data.manualPaymentConfirmation =
            $("manualPaymentConfirmation")?.checked ? "true" : "false";

        try {
            await api("/api/configuracoes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });

            showFeedback("Configurações salvas com sucesso!");

        } catch (error) {
            showFeedback("Erro ao salvar: " + error.message, "erro");
        }
    });

    const navLinks = document.querySelectorAll(".settings-navigation a");

    navLinks.forEach(link => {
        link.addEventListener("click", () => {
            navLinks.forEach(l => l.classList.remove("active"));
            link.classList.add("active");
        });
    });

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id;
                navLinks.forEach(link => {
                    link.classList.toggle(
                        "active",
                        link.getAttribute("href") === `#${id}`
                    );
                });
            }
        });
    }, { threshold: 0.4 });

    document.querySelectorAll(".settings-card[id]").forEach(section => {
        observer.observe(section);
    });

    loadSettings();

});