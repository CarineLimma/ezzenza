document.addEventListener("DOMContentLoaded", () => {
     const $ = id => document.getElementById(id);

    const tabela = $("proceduresTableBody");
    const formulario = $("procedureForm");
    const modalForm = $("procedureModal");
    const modalDetalhes = $("procedureDetailsOverlay");
    const busca = $("searchProcedure");
    const filtro = $("filterProcedureStatus");

    let procedimentos = [];
    let procedimentoAtual = null;

    if (!tabela || !formulario || !modalForm || !modalDetalhes) {
        console.error(
            "Essenza: elementos da página Procedimentos não encontrados."
        );
        return;
    }

    const moeda = valor =>
        Number(valor || 0).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });

    function mostrarErro(erro) {
        console.error("Erro em Procedimentos:", erro);
        alert(erro.message || "Ocorreu um erro inesperado.");
    }

    async function api(url, options = {}) {
        const resposta = await fetch(url, {
            credentials: "same-origin",
            ...options
        });

        const dados = await resposta.json().catch(() => ({}));

        if (!resposta.ok) {
            throw new Error(
                dados.erro ||
                `Erro ${resposta.status} ao acessar ${url}`
            );
        }

        return dados;
    }

   

    function fecharModais() {
        modalForm.hidden = true;
        modalDetalhes.hidden = true;
    }

    function abrirModal(modal) {
        fecharModais();
        modal.hidden = false;

        const campo = modal.querySelector(
            'input:not([type="hidden"]), select, button'
        );

        campo?.focus();
    }

 

    function atualizarResumo() {
        const total = procedimentos.length;

        const ativos = procedimentos.filter(
            p => p.status === "active"
        ).length;

        const inativos = procedimentos.filter(
            p => p.status === "inactive"
        ).length;

        $("totalProcedures").textContent = total;
        $("activeProcedures").textContent = ativos;
        $("inactiveProcedures").textContent = inativos;
    }


    function criarCelula(linha, valor) {
        const td = document.createElement("td");
        td.textContent = String(valor ?? "");
        linha.appendChild(td);
        return td;
    }

    function renderizarProcedimentos() {
        tabela.replaceChildren();

        const termo = (busca?.value || "")
            .trim()
            .toLocaleLowerCase("pt-BR");

        const statusFiltro = filtro?.value || "all";

        const filtrados = procedimentos.filter(p => {
            const conteudo = [
                p.nome,
                p.categoria,
                p.descricao
            ].join(" ").toLocaleLowerCase("pt-BR");

            const correspondeBusca = conteudo.includes(termo);

            const correspondeStatus =
                statusFiltro === "all" ||
                p.status === statusFiltro;

            return correspondeBusca && correspondeStatus;
        });

        if (!filtrados.length) {
            const linha = document.createElement("tr");

            const celula = criarCelula(
                linha,
                "Nenhum procedimento encontrado."
            );

            celula.colSpan = 6;
            tabela.appendChild(linha);
            return;
        }

        filtrados.forEach(procedimento => {
            const linha = document.createElement("tr");
            linha.dataset.id = procedimento.id;

            const nome = criarCelula(
                linha,
                procedimento.nome
            );

            nome.style.fontWeight = "600";

            criarCelula(
                linha,
                procedimento.categoria || "Não informada"
            );

            criarCelula(
                linha,
                `${procedimento.duracao} minutos`
            );

            criarCelula(
                linha,
                moeda(procedimento.valor)
            );

            // STATUS

            const tdStatus = document.createElement("td");
            const status = document.createElement("span");

            const inativo = procedimento.status === "inactive";

            status.className = `status ${
                inativo ? "inactive" : "active"
            }`;

            status.textContent = inativo ? "Inativo" : "Ativo";

            tdStatus.appendChild(status);
            linha.appendChild(tdStatus);

            // BOTÕES

            const tdAcoes = document.createElement("td");
            const acoes = document.createElement("div");

            acoes.className = "actions";

            [
                ["Ver", "view", "view-procedure"],
                ["Editar", "edit", "edit-procedure"],
                ["Excluir", "delete", "delete-procedure"]
            ].forEach(([nomeBotao, acao, classe]) => {
                const botao = document.createElement("button");

                botao.type = "button";
                botao.textContent = nomeBotao;
                botao.className = classe;
                botao.dataset.id = procedimento.id;
                botao.dataset.action = acao;

                acoes.appendChild(botao);
            });

            tdAcoes.appendChild(acoes);
            linha.appendChild(tdAcoes);
            tabela.appendChild(linha);
        });
    }
    async function carregarProcedimentos() {
        try {
            const dados = await api("/api/procedimentos");

            procedimentos = Array.isArray(dados)
                ? dados
                : dados.procedimentos || [];

            renderizarProcedimentos();
            atualizarResumo();

        } catch (erro) {
            mostrarErro(erro);
        }
    }



    function novoProcedimento() {
        procedimentoAtual = null;

        formulario.reset();

        $("procedureId").value = "";

        $("procedureModalTitle").textContent =
            "Novo procedimento";

        abrirModal(modalForm);
        $("procedureName").focus();
    }

    $("btnNewProcedure")?.addEventListener(
        "click",
        novoProcedimento
    );


    function buscarPorId(id) {
        return procedimentos.find(
            p => Number(p.id) === Number(id)
        );
    }


    function visualizarProcedimento(id) {
        const p = buscarPorId(id);
        if (!p) return;

        procedimentoAtual = p;

        $("detailProcedureName").textContent = p.nome;

        $("detailProcedureDescription").textContent =
            p.descricao || "Nenhuma descrição informada.";

        $("detailProcedureCategory").textContent =
            p.categoria || "Não informada";

        $("detailProcedureDuration").textContent =
            `${p.duracao} minutos`;

        $("detailProcedurePrice").textContent =
            moeda(p.valor);

        $("detailProcedureStatus").textContent =
            p.status === "inactive" ? "Inativo" : "Ativo";

        abrirModal(modalDetalhes);
    }

 

    function editarProcedimento(id) {
        const p = buscarPorId(id);
        if (!p) return;

        procedimentoAtual = p;

        $("procedureId").value = p.id;
        $("procedureName").value = p.nome || "";

        $("procedureCategory").value =
            p.categoria || "";

        $("procedureDuration").value = p.duracao;
        $("procedurePrice").value = p.valor;

        $("procedureStatus").value =
            p.status || "active";

        $("procedureDescription").value =
            p.descricao || "";

        $("procedureModalTitle").textContent =
            "Editar procedimento";

        abrirModal(modalForm);
        $("procedureName").focus();
    }

 

    async function excluirProcedimento(id) {
        const p = buscarPorId(id);
        if (!p) return;

        const confirmou = confirm(
            `Deseja realmente excluir "${p.nome}"?`
        );

        if (!confirmou) return;

        try {
            await api(`/api/procedimentos/${id}`, {
                method: "DELETE"
            });

            await carregarProcedimentos();

        } catch (erro) {
            mostrarErro(erro);
        }
    }

   

    tabela.addEventListener("click", evento => {
        const botao = evento.target.closest(
            "button[data-id]"
        );

        if (!botao) return;

        const id = Number(botao.dataset.id);

        if (!id) return;

        switch (botao.dataset.action) {
            case "view":
                visualizarProcedimento(id);
                break;

            case "edit":
                editarProcedimento(id);
                break;

            case "delete":
                excluirProcedimento(id);
                break;
        }
    });


    $("editSelectedProcedure")?.addEventListener(
        "click",
        () => {
            if (procedimentoAtual) {
                editarProcedimento(procedimentoAtual.id);
            }
        }
    );

  

    formulario.addEventListener("submit", async evento => {
        evento.preventDefault();

        if (!formulario.reportValidity()) return;

        const dados = {
            nome: $("procedureName").value.trim(),

            categoria: $("procedureCategory").value,

            duracao: Number(
                $("procedureDuration").value
            ),

            valor: Number(
                $("procedurePrice").value
            ),

            status: $("procedureStatus").value,

            descricao: $("procedureDescription").value.trim()
        };

        const editando = procedimentoAtual !== null;

        const url = editando
            ? `/api/procedimentos/${procedimentoAtual.id}`
            : "/api/procedimentos";

        const botaoSalvar = formulario.querySelector(
            'button[type="submit"]'
        );

        try {
            botaoSalvar.disabled = true;

            await api(url, {
                method: editando ? "PUT" : "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(dados)
            });

            fecharModais();
            await carregarProcedimentos();

        } catch (erro) {
            mostrarErro(erro);

        } finally {
            botaoSalvar.disabled = false;
        }
    });


    busca?.addEventListener(
        "input",
        renderizarProcedimentos
    );

    filtro?.addEventListener(
        "change",
        renderizarProcedimentos
    );

 

    $("closeProcedureModal")?.addEventListener(
        "click",
        fecharModais
    );

    $("cancelProcedure")?.addEventListener(
        "click",
        fecharModais
    );

    $("closeProcedureDetails")?.addEventListener(
        "click",
        fecharModais
    );

    [modalForm, modalDetalhes].forEach(modal => {
        modal.addEventListener("click", evento => {
            if (evento.target === modal) {
                fecharModais();
            }
        });
    });

    document.addEventListener("keydown", evento => {
        if (evento.key === "Escape") {
            fecharModais();
        }
    });
    carregarProcedimentos();
});
