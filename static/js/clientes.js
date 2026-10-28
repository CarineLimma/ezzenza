document.addEventListener("DOMContentLoaded", () => {

    const $ = (id) => document.getElementById(id);

    const clients = [];

    const statusLabels = {
        active: "Ativa",
        inactive: "Inativa"
    };

    const attendanceLabels = {
        atendida: "Atendida",
        faltou: "Faltou",
        reagendar: "Reagendar",
        pendente: "Pendente"
    };

    function initials(nome) {
        return nome
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(n => n[0])
            .join("")
            .toUpperCase();
    }

    function getMonthKey() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }

    function updateCounters() {
        const total = clients.length;
        const mesAtual = getMonthKey();

        const novas = clients.filter(c => {
            if (!c.cadastradoEm) return false;
            return c.cadastradoEm.startsWith(mesAtual);
        }).length;

        const atendidas = clients.filter(c =>
            c.atendimento === "atendida"
        ).length;

        if ($("totalClients")) $("totalClients").textContent = total;
        if ($("newClients")) $("newClients").textContent = novas;
        if ($("attendedClients")) $("attendedClients").textContent = atendidas;
    }

    function renderTable(list) {
        const tbody = $("clientsTableBody");
        if (!tbody) return;

        if (list.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center; padding: 2rem; opacity: .5;">
                        Nenhuma cliente cadastrada ainda.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = list.map(c => `
            <tr data-id="${c.id}">
                <td>
                    <div class="client-cell">
                        <span class="client-initials">${initials(c.nome)}</span>
                        <span>${c.nome}</span>
                    </div>
                </td>
                <td>${c.telefone}</td>
                <td>${c.email || "—"}</td>
                <td>${c.ultimoAtendimento || "—"}</td>
                <td><span class="status ${c.status}">${statusLabels[c.status] || c.status}</span></td>
                <td>
                    <div class="actions">
                        <button type="button" class="view-client" data-id="${c.id}">Ver</button>
                        <button type="button" class="edit-client" data-id="${c.id}">Editar</button>
                    </div>
                </td>
            </tr>
        `).join("");
    }

    renderTable(clients);
    updateCounters();

    const searchInput = $("searchClient");
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            const term = searchInput.value.toLowerCase();
            const filtered = clients.filter(c =>
                c.nome.toLowerCase().includes(term) ||
                c.telefone.includes(term) ||
                (c.email || "").toLowerCase().includes(term)
            );
            renderTable(filtered);
        });
    }

    const detailsOverlay = $("clientDetailsOverlay");

    function openDetails(id) {
        const client = clients.find(c => c.id === id);
        if (!client || !detailsOverlay) return;

        $("detailAvatar").textContent = initials(client.nome);
        $("detailClientName").textContent = client.nome;
        $("detailClientEmail").textContent = client.email || "—";
        $("detailClientPhone").textContent = client.telefone;
        $("detailClientBirth").textContent = client.nascimento || "Não informada";
        $("detailLastVisit").textContent = client.ultimoAtendimento || "—";
        $("detailClientStatus").textContent = statusLabels[client.status] || client.status;

        detailsOverlay.hidden = false;

        const editBtn = $("editSelectedClient");
        if (editBtn) {
            editBtn.onclick = () => {
                detailsOverlay.hidden = true;
                openModal(id);
            };
        }
    }

    $("closeClientDetails")?.addEventListener("click", () => {
        detailsOverlay.hidden = true;
    });

    detailsOverlay?.addEventListener("click", event => {
        if (event.target === detailsOverlay) detailsOverlay.hidden = true;
    });

    const clientModal = $("clientModal");
    const clientForm = $("clientForm");

    function buildModalExtras() {
        if ($("clientAttendance")) return;

        const form = clientForm;

        const attendanceGroup = document.createElement("div");
        attendanceGroup.className = "form-group";
        attendanceGroup.innerHTML = `
            <label for="clientAttendance">Status de atendimento</label>
            <select id="clientAttendance" name="clientAttendance">
                <option value="pendente">Pendente</option>
                <option value="atendida">Atendida</option>
                <option value="faltou">Faltou</option>
                <option value="reagendar">Reagendar</option>
            </select>
        `;

        const deleteGroup = document.createElement("div");
        deleteGroup.className = "form-group";
        deleteGroup.id = "deleteClientGroup";
        deleteGroup.style.display = "none";
        deleteGroup.innerHTML = `
            <button type="button" id="deleteClientBtn"
                style="width:100%; padding: .6rem; background: transparent;
                       border: 1px solid #e07070; color: #e07070;
                       border-radius: 6px; cursor: pointer; font-size: 13px;">
                🗑 Excluir cliente
            </button>
        `;

        const modalActions = form.querySelector(".modal-actions");
        form.insertBefore(attendanceGroup, modalActions);
        form.insertBefore(deleteGroup, modalActions);

        $("deleteClientBtn").addEventListener("click", () => {
            const id = Number($("clientId").value);
            if (!id) return;
            if (!confirm("Tem certeza que deseja excluir esta cliente?")) return;

            const index = clients.findIndex(c => c.id === id);
            if (index !== -1) clients.splice(index, 1);

            renderTable(clients);
            updateCounters();
            closeModal();
        });
    }

    function openModal(id = null) {
        if (!clientModal || !clientForm) return;

        buildModalExtras();
        clientForm.reset();

        $("clientModalTitle").textContent = id ? "Editar cliente" : "Nova cliente";
        $("clientId").value = id ?? "";

        const deleteGroup = $("deleteClientGroup");

        if (id) {
            const client = clients.find(c => c.id === id);
            if (client) {
                $("clientName").value = client.nome;
                $("clientPhone").value = client.telefone;
                $("clientBirth").value = client.nascimento || "";
                $("clientEmail").value = client.email || "";
                $("clientStatus").value = client.status;
                $("clientNotes").value = client.observacoes || "";
                $("clientAttendance").value = client.atendimento || "pendente";
            }
            if (deleteGroup) deleteGroup.style.display = "block";
        } else {
            if (deleteGroup) deleteGroup.style.display = "none";
        }

        clientModal.hidden = false;
        $("clientName").focus();
    }

    function closeModal() {
        if (clientModal) clientModal.hidden = true;
    }

    document.querySelector(".new-appointment")?.addEventListener("click", () => openModal());
    $("closeClientModal")?.addEventListener("click", closeModal);
    $("cancelClient")?.addEventListener("click", closeModal);

    clientModal?.addEventListener("click", event => {
        if (event.target === clientModal) closeModal();
    });

    clientForm?.addEventListener("submit", event => {
        event.preventDefault();

        const id = $("clientId").value ? Number($("clientId").value) : null;

        const today = new Date().toLocaleDateString("pt-BR");

        const atendimento = $("clientAttendance")?.value || "pendente";

        const data = {
            nome: $("clientName").value.trim(),
            telefone: $("clientPhone").value.trim(),
            nascimento: $("clientBirth").value,
            email: $("clientEmail").value.trim(),
            status: $("clientStatus").value,
            observacoes: $("clientNotes").value.trim(),
            atendimento,
            ultimoAtendimento: atendimento === "atendida" ? today : (
                clients.find(c => c.id === id)?.ultimoAtendimento || "—"
            )
        };

        if (id) {
            const index = clients.findIndex(c => c.id === id);
            if (index !== -1) Object.assign(clients[index], data);
        } else {
            const newId = clients.length
                ? Math.max(...clients.map(c => c.id)) + 1
                : 1;

            const mesAtual = getMonthKey();
            clients.push({
                id: newId,
                cadastradoEm: `${mesAtual}-01`,
                ...data
            });
        }

        renderTable(clients);
        updateCounters();
        closeModal();
    });

    $("clientsTableBody")?.addEventListener("click", event => {
        const viewBtn = event.target.closest(".view-client");
        const editBtn = event.target.closest(".edit-client");

        if (viewBtn) openDetails(Number(viewBtn.dataset.id));
        if (editBtn) openModal(Number(editBtn.dataset.id));
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeModal();
            if (detailsOverlay) detailsOverlay.hidden = true;
        }
    });

});