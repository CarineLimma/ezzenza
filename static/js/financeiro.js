document.addEventListener("DOMContentLoaded", () => {

    const $ = (id) => document.getElementById(id);

    if (!$("transactionsTableBody") || !$("financeMonth")) return;

    const transactions = [];

    let currentId = null;

    const moeda = (valor) =>
        Number(valor || 0).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });

    const dataBR = (valor) => {
        if (!valor) return "Não informada";
        const partes = String(valor).slice(0, 10).split("-");
        if (partes.length !== 3) return valor;
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    };

    const hoje = () => {
        const d = new Date();
        const ano = d.getFullYear();
        const mes = String(d.getMonth() + 1).padStart(2, "0");
        const dia = String(d.getDate()).padStart(2, "0");
        return `${ano}-${mes}-${dia}`;
    };

    const mesFiltro = () => $("financeMonth").value;

    const typeLabels = {
        income: "Receita",
        expense: "Despesa"
    };

    const statusLabels = {
        paid: "Recebido / Pago",
        pending: "Pendente"
    };

    const methodLabels = {
        pix: "Pix",
        card: "Cartão",
        cash: "Dinheiro",
        transfer: "Transferência",
        "": "Não informada"
    };

    function updateSummary() {
        const mes = mesFiltro();

        const filtradas = transactions.filter(t =>
            !mes || (t.transactionDate || "").startsWith(mes)
        );

        const income = filtradas
            .filter(t => t.transactionType === "income" && t.transactionStatus === "paid")
            .reduce((s, t) => s + Number(t.transactionValue || 0), 0);

        const expenses = filtradas
            .filter(t => t.transactionType === "expense" && t.transactionStatus === "paid")
            .reduce((s, t) => s + Number(t.transactionValue || 0), 0);

        const balance = income - expenses;

        const pending = filtradas
            .filter(t => t.transactionType === "income" && t.transactionStatus === "pending")
            .reduce((s, t) => s + Number(t.transactionValue || 0), 0);

        const pix = filtradas
            .filter(t => t.paymentMethod === "pix" && t.transactionStatus === "paid")
            .reduce((s, t) => s + Number(t.transactionValue || 0), 0);

        const card = filtradas
            .filter(t => t.paymentMethod === "card" && t.transactionStatus === "paid")
            .reduce((s, t) => s + Number(t.transactionValue || 0), 0);

        const cash = filtradas
            .filter(t => t.paymentMethod === "cash" && t.transactionStatus === "paid")
            .reduce((s, t) => s + Number(t.transactionValue || 0), 0);

        if ($("totalIncome")) $("totalIncome").textContent = moeda(income);
        if ($("totalExpenses")) $("totalExpenses").textContent = moeda(expenses);
        if ($("totalBalance")) $("totalBalance").textContent = moeda(balance);
        if ($("totalPendingPayments")) $("totalPendingPayments").textContent = moeda(pending);

        if ($("summaryIncome")) $("summaryIncome").textContent = moeda(income);
        if ($("summaryExpenses")) $("summaryExpenses").textContent = moeda(expenses);
        if ($("summaryBalance")) $("summaryBalance").textContent = moeda(balance);

        if ($("pixTotal")) $("pixTotal").textContent = moeda(pix);
        if ($("cardTotal")) $("cardTotal").textContent = moeda(card);
        if ($("cashTotal")) $("cashTotal").textContent = moeda(cash);
    }

    function renderTransactions() {
        const mes = mesFiltro();
        const tipo = $("filterTransactionType").value;
        const tbody = $("transactionsTableBody");

        const filtradas = transactions.filter(t => {
            const mesOk = !mes || (t.transactionDate || "").startsWith(mes);
            const tipoOk = tipo === "all" || t.transactionType === tipo;
            return mesOk && tipoOk;
        });

        if (filtradas.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; padding: 2rem; opacity: .5;">
                        Nenhuma movimentação encontrada.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtradas.map(t => `
            <tr data-id="${t.id}">
                <td>${dataBR(t.transactionDate)}</td>
                <td>${t.transactionDescription}</td>
                <td>${t.transactionCategory || "—"}</td>
                <td>
                    <span class="transaction-type ${t.transactionType}">
                        ${typeLabels[t.transactionType] || t.transactionType}
                    </span>
                </td>
                <td>${moeda(t.transactionValue)}</td>
                <td>
                    <span class="status ${t.transactionStatus}">
                        ${statusLabels[t.transactionStatus] || t.transactionStatus}
                    </span>
                </td>
                <td>
                    <button type="button" class="view-transaction" data-id="${t.id}">Ver</button>
                </td>
            </tr>
        `).join("");
    }

    function renderPending() {
        const mes = mesFiltro();
        const tbody = $("pendingPaymentsBody");

        const pendentes = transactions.filter(t =>
            t.transactionType === "income" &&
            t.transactionStatus === "pending" &&
            (!mes || (t.transactionDate || "").startsWith(mes))
        );

        if (pendentes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center; padding: 2rem; opacity: .5;">
                        Nenhum pagamento pendente.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = pendentes.map(t => `
            <tr data-id="${t.id}">
                <td>${t.transactionDescription}</td>
                <td>${t.transactionCategory || "—"}</td>
                <td>${dataBR(t.transactionDate)}</td>
                <td>${moeda(t.transactionValue)}</td>
                <td><span class="status pending">Pendente</span></td>
                <td>
                    <button type="button" class="confirm-payment" data-id="${t.id}">
                        Confirmar pagamento
                    </button>
                </td>
            </tr>
        `).join("");
    }

    function render() {
        renderTransactions();
        renderPending();
        updateSummary();
    }

    render();

    $("financeMonth").addEventListener("change", render);
    $("filterTransactionType").addEventListener("change", renderTransactions);

    const overlay = $("transactionDetailsOverlay");
    const modal = $("transactionModal");
    const form = $("transactionForm");

    function openDetails(id) {
        const t = transactions.find(t => t.id === id);
        if (!t || !overlay) return;

        $("detailDescription").textContent = t.transactionDescription;
        $("detailTransactionDate").textContent = dataBR(t.transactionDate);
        $("detailTransactionType").textContent = typeLabels[t.transactionType] || t.transactionType;
        $("detailTransactionValue").textContent = moeda(t.transactionValue);
        $("detailTransactionStatus").textContent = statusLabels[t.transactionStatus] || t.transactionStatus;
        $("detailPaymentMethod").textContent = methodLabels[t.paymentMethod] ?? "Não informada";

        overlay.hidden = false;

        const editBtn = $("editSelectedTransaction");
        if (editBtn) {
            editBtn.onclick = () => {
                overlay.hidden = true;
                openModal(id);
            };
        }
    }

    $("closeTransactionDetails")?.addEventListener("click", () => {
        overlay.hidden = true;
    });

    overlay?.addEventListener("click", event => {
        if (event.target === overlay) overlay.hidden = true;
    });

    function openModal(id = null) {
        if (!modal || !form) return;

        form.reset();
        currentId = id;

        $("transactionModalTitle").textContent = id ? "Editar movimentação" : "Nova movimentação";
        $("transactionId").value = id ?? "";
        $("transactionDate").value = hoje();

        if (id) {
            const t = transactions.find(t => t.id === id);
            if (t) {
                $("transactionDescription").value = t.transactionDescription;
                $("transactionType").value = t.transactionType;
                $("transactionCategory").value = t.transactionCategory || "";
                $("transactionValue").value = t.transactionValue;
                $("transactionDate").value = t.transactionDate;
                $("transactionStatus").value = t.transactionStatus;
                $("paymentMethod").value = t.paymentMethod || "";
                $("transactionNotes").value = t.transactionNotes || "";
            }
        }

        modal.hidden = false;
        $("transactionDescription").focus();
    }

    function closeModal() {
        if (modal) modal.hidden = true;
    }

    $("btnNewTransaction")?.addEventListener("click", () => openModal());
    $("closeTransactionModal")?.addEventListener("click", closeModal);
    $("cancelTransaction")?.addEventListener("click", closeModal);

    modal?.addEventListener("click", event => {
        if (event.target === modal) closeModal();
    });

    form?.addEventListener("submit", event => {
        event.preventDefault();

        const id = $("transactionId").value ? Number($("transactionId").value) : null;

        const data = {
            transactionDescription: $("transactionDescription").value.trim(),
            transactionType: $("transactionType").value,
            transactionCategory: $("transactionCategory").value,
            transactionValue: $("transactionValue").value,
            transactionDate: $("transactionDate").value,
            transactionStatus: $("transactionStatus").value,
            paymentMethod: $("paymentMethod").value,
            transactionNotes: $("transactionNotes").value.trim()
        };

        if (id) {
            const index = transactions.findIndex(t => t.id === id);
            if (index !== -1) Object.assign(transactions[index], data);
        } else {
            const newId = transactions.length
                ? Math.max(...transactions.map(t => t.id)) + 1
                : 1;
            transactions.push({ id: newId, ...data });
        }

        render();
        closeModal();
    });

    $("transactionsTableBody")?.addEventListener("click", event => {
        const btn = event.target.closest(".view-transaction");
        if (btn) openDetails(Number(btn.dataset.id));
    });

    $("pendingPaymentsBody")?.addEventListener("click", event => {
        const btn = event.target.closest(".confirm-payment");
        if (!btn) return;

        const id = Number(btn.dataset.id);
        const t = transactions.find(t => t.id === id);
        if (!t) return;

        if (confirm(`Confirmar pagamento de ${moeda(t.transactionValue)}?`)) {
            t.transactionStatus = "paid";
            render();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeModal();
            if (overlay) overlay.hidden = true;
        }
    });

});