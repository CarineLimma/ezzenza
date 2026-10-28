document.addEventListener("DOMContentLoaded", () => {

    const $ = (id) => document.getElementById(id);

    if (!$("calendarDays") || !$("scheduleTimeline")) return;

    const modal = $("appointmentModal");
    const form = $("appointmentForm");
    const overlay = $("detailsOverlay");

    const state = {
        date: new Date(),
        month: new Date(),
        items: [],
        filter: "all",
        current: null
    };

    state.date.setHours(12, 0, 0, 0);

    state.month = new Date(
        state.date.getFullYear(),
        state.date.getMonth(),
        1,
        12
    );

    const statusNames = {
        pending: "Pendente",
        confirmed: "Confirmado",
        cancelled: "Cancelado",
        completed: "Concluído"
    };

    function dateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function prettyDate(key) {
        return new Date(`${key}T12:00:00`)
            .toLocaleDateString("pt-BR");
    }

    function currency(value) {
        return Number(value).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });
    }

    function safe(value) {
        return String(value ?? "").replace(
            /[&<>"']/g,
            char => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            }[char])
        );
    }

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

    async function load() {
        try {
            const dados = await api("/api/agendamentos");

            state.items = Array.isArray(dados)
                ? dados
                : dados.agendamentos || [];

            render();

        } catch (error) {
            console.error("Erro ao carregar agendamentos:", error);
            alert(error.message);
            render();
        }
    }

    function render() {
        const year = state.month.getFullYear();
        const month = state.month.getMonth();

        $("currentMonth").textContent =
            state.month.toLocaleDateString("pt-BR", {
                month: "long",
                year: "numeric"
            });

        const start = new Date(year, month, 1).getDay();
        const days = new Date(year, month + 1, 0).getDate();
        const calendar = $("calendarDays");

        calendar.innerHTML = "";

        for (let i = 0; i < start; i++) {
            const empty = document.createElement("span");
            empty.className = "calendar-empty";
            calendar.append(empty);
        }

        for (let day = 1; day <= days; day++) {
            const key = dateKey(new Date(year, month, day, 12));
            const button = document.createElement("button");

            button.type = "button";
            button.className = "calendar-day";
            button.textContent = day;

            if (key === dateKey(state.date)) {
                button.classList.add("selected");
            }

            if (state.items.some(a => a.data === key)) {
                button.classList.add("has-appointment");
            }

            button.addEventListener("click", () => {
                state.date = new Date(`${key}T12:00:00`);
                render();
            });

            calendar.append(button);
        }

        const key = dateKey(state.date);

        $("selectedDateTitle").textContent =
            `Agenda de ${prettyDate(key)}`;

        const todayItems = state.items
            .filter(a => a.data === key)
            .sort((a, b) => a.horario.localeCompare(b.horario));

        const timeline = $("scheduleTimeline");

        if (todayItems.length === 0) {
            timeline.innerHTML = "<p>Nenhum agendamento para esta data.</p>";
        } else {
            timeline.innerHTML = todayItems.map(a => `
                <div class="schedule-entry">
                    <strong>${safe(a.horario)}</strong>
                    <span>${safe(a.cliente_nome)}</span>
                    <span>${safe(a.procedimento)}</span>
                    <span>${safe(statusNames[a.status] || a.status)}</span>
                </div>
            `).join("");
        }

        const shown = todayItems.filter(a =>
            state.filter === "all" || a.status === state.filter
        );

        const tbody = $("appointmentsTableBody");

        if (shown.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7">Nenhum atendimento encontrado.</td>
                </tr>
            `;
        } else {
            tbody.innerHTML = shown.map(a => `
                <tr>
                    <td>${safe(a.horario)}</td>
                    <td>${safe(a.cliente_nome)}</td>
                    <td>${safe(a.procedimento)}</td>
                    <td>${safe(a.duracao)} min</td>
                    <td>${currency(a.valor)}</td>
                    <td>
                        <span class="status ${safe(a.status)}">
                            ${safe(statusNames[a.status] || a.status)}
                        </span>
                    </td>
                    <td>
                        <button
                            type="button"
                            class="view-button"
                            data-id="${Number(a.id)}">
                            Ver detalhes
                        </button>
                    </td>
                </tr>
            `).join("");
        }
    }

    $("previousMonth").addEventListener("click", () => {
        state.month = new Date(
            state.month.getFullYear(),
            state.month.getMonth() - 1,
            1,
            12
        );
        render();
    });

    $("nextMonth").addEventListener("click", () => {
        state.month = new Date(
            state.month.getFullYear(),
            state.month.getMonth() + 1,
            1,
            12
        );
        render();
    });

    $("todayButton").addEventListener("click", () => {
        state.date = new Date();
        state.date.setHours(12, 0, 0, 0);

        state.month = new Date(
            state.date.getFullYear(),
            state.date.getMonth(),
            1,
            12
        );

        render();
    });

    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            state.filter = btn.dataset.filter;

            document.querySelectorAll(".filter-btn").forEach(button => {
                button.classList.toggle("active-filter", button === btn);
            });

            render();
        });
    });

    if (modal && form) {
        $("btnNewAppointment").addEventListener("click", () => {
            form.reset();
            $("appointmentDate").value = dateKey(state.date);
            modal.hidden = false;
            $("appointmentClient").focus();
        });

        $("closeAppointment").addEventListener("click", () => {
            modal.hidden = true;
        });

        $("cancelAppointment").addEventListener("click", () => {
            modal.hidden = true;
        });

        modal.addEventListener("click", event => {
            if (event.target === modal) modal.hidden = true;
        });

        form.addEventListener("submit", async event => {
            event.preventDefault();

            if (!form.reportValidity()) return;

            const data = Object.fromEntries(new FormData(form).entries());

            try {
                await api("/api/agendamentos", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data)
                });

                modal.hidden = true;

                state.date = new Date(`${data.data}T12:00:00`);
                state.month = new Date(
                    state.date.getFullYear(),
                    state.date.getMonth(),
                    1,
                    12
                );

                await load();

            } catch (error) {
                alert(error.message);
            }
        });
    }

    $("appointmentsTableBody").addEventListener("click", event => {
        const btn = event.target.closest(".view-button");

        if (!btn) return;

        const agendamento = state.items.find(
            item => Number(item.id) === Number(btn.dataset.id)
        );

        if (!agendamento) return;

        state.current = agendamento;

        $("detailClient").textContent = agendamento.cliente_nome;
        $("detailPhone").textContent = agendamento.telefone || "Telefone não informado";
        $("detailProcedure").textContent = agendamento.procedimento;
        $("detailDate").textContent = prettyDate(agendamento.data);
        $("detailTime").textContent = agendamento.horario;
        $("detailDuration").textContent = `${agendamento.duracao} minutos`;
        $("detailValue").textContent = currency(agendamento.valor);
        $("detailStatus").value = agendamento.status;

        const initials = agendamento.cliente_nome
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(nome => nome[0])
            .join("")
            .toUpperCase();

        const avatar = document.querySelector(".client-avatar");
        if (avatar) avatar.textContent = initials;

        overlay.hidden = false;
    });

    $("closeDetails").addEventListener("click", () => {
        overlay.hidden = true;
    });

    overlay.addEventListener("click", event => {
        if (event.target === overlay) overlay.hidden = true;
    });

    $("saveStatus").addEventListener("click", async () => {
        if (!state.current) return;

        try {
            await api(`/api/agendamentos/${state.current.id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: $("detailStatus").value })
            });

            overlay.hidden = true;
            await load();

        } catch (error) {
            alert(error.message);
        }
    });

    $("sendWhatsApp").addEventListener("click", () => {
        const agendamento = state.current;

        if (!agendamento) return;

        const phone = String(agendamento.telefone || "").replace(/\D/g, "");

        if (!phone) {
            alert("Cadastre o telefone da cliente primeiro.");
            return;
        }

        const number = (phone.length === 10 || phone.length === 11)
            ? `55${phone}`
            : phone;

        const mensagem =
            `Olá, ${agendamento.cliente_nome}! 🌸\n\n` +
            `Passando para confirmar seu agendamento na Essenza.\n\n` +
            `📅 Data: ${prettyDate(agendamento.data)}\n` +
            `🕒 Horário: ${agendamento.horario}\n` +
            `✨ Procedimento: ${agendamento.procedimento}\n\n` +
            `Podemos confirmar sua presença?`;

        window.open(
            `https://wa.me/${number}?text=${encodeURIComponent(mensagem)}`,
            "_blank",
            "noopener,noreferrer"
        );
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            if (modal) modal.hidden = true;
            overlay.hidden = true;
        }
    });

    render();
    load();

});