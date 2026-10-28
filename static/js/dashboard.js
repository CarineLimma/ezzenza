    document.addEventListener("DOMContentLoaded", () => {
    const $ = (id) => document.getElementById(id);

    const API_AGENDAMENTOS = "/api/agendamentos";
    const API_CLIENTES = "/api/clientes";

    let agendamentos = [];
    let linhaSelecionada = null;
    let filtroAtual = "all";
    let carregando = false;

    const moeda = (valor) =>
        Number(valor || 0).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });

    const hojeLocal = () => {
        const data = new Date();

        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, "0");
        const dia = String(data.getDate()).padStart(2, "0");

        return `${ano}-${mes}-${dia}`;
    };

    const texto = (valor) => String(valor ?? "");

    function atualizarSaudacao() {
        const hora = new Date().getHours();
        const nome = document.body.dataset.usuarioNome || "";

        let saudacao = "Bom dia";

        if (hora >= 12 && hora < 18) {
            saudacao = "Boa tarde";
        } else if (hora >= 18 || hora < 5) {
            saudacao = "Boa noite";
        }

        if ($("saudacao")) {
            $("saudacao").textContent = nome
                ? `${saudacao}, ${nome}!`
                : `${saudacao}! Bem-vinda à Essenza.`;
        }

        if ($("dataAtual")) {
            $("dataAtual").textContent =
                new Date().toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                });
        }

        if ($("agendaData")) {
            $("agendaData").textContent =
                new Date().toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric"
                });
        }
    }

    function criarElemento(tag, classe, conteudo) {
        const elemento = document.createElement(tag);

        if (classe) {
            elemento.className = classe;
        }

        if (conteudo !== undefined) {
            elemento.textContent = texto(conteudo);
        }

        return elemento;
    }

    function statusTexto(status) {
        const nomes = {
            pending: "Pendente",
            confirmed: "Confirmado",
            completed: "Concluído",
            cancelled: "Cancelado"
        };

        return nomes[status] || status;
    }

    function agendamentosHoje() {
        const hoje = hojeLocal();

        return agendamentos
            .filter((agendamento) => agendamento.data === hoje)
            .sort((a, b) =>
                texto(a.horario).localeCompare(texto(b.horario))
            );
    }

    function atualizarResumo() {
        const hoje = agendamentosHoje();

        const confirmados = hoje.filter(
            (a) => a.status === "confirmed"
        );

        const pendentes = hoje.filter(
            (a) => a.status === "pending"
        );

        const cancelados = hoje.filter(
            (a) => a.status === "cancelled"
        );

        const faturamento = hoje
            .filter((a) => a.status !== "cancelled")
            .reduce(
                (total, a) => total + Number(a.valor || 0),
                0
            );

        if ($("totalAppointments")) {
            $("totalAppointments").textContent = hoje.length;
        }

        if ($("confirmedAppointmentsText")) {
            $("confirmedAppointmentsText").textContent =
                `${confirmados.length} confirmados`;
        }

        if ($("totalPending")) {
            $("totalPending").textContent = pendentes.length;
        }

        if ($("totalRevenue")) {
            $("totalRevenue").textContent = moeda(faturamento);
        }

        if ($("summaryConfirmed")) {
            $("summaryConfirmed").textContent = confirmados.length;
        }

        if ($("summaryPending")) {
            $("summaryPending").textContent = pendentes.length;
        }

        if ($("summaryCancelled")) {
            $("summaryCancelled").textContent = cancelados.length;
        }

        const proximo = hoje.find((a) => {
            return (
                a.status !== "cancelled" &&
                a.status !== "completed" &&
                texto(a.horario) >=
                    new Date().toTimeString().slice(0, 5)
            );
        });

        if ($("nextClient")) {
            $("nextClient").textContent = proximo
                ? proximo.cliente_nome
                : "Nenhum próximo atendimento";
        }

        if ($("nextProcedure")) {
            $("nextProcedure").textContent = proximo
                ? proximo.procedimento
                : "Agenda atualizada";
        }

        if ($("nextTime")) {
            $("nextTime").textContent = proximo
                ? proximo.horario
                : "--:--";
        }

        const btnProximo = $("btnProximoDetalhes");

        if (btnProximo) {
            btnProximo.disabled = !proximo;

            btnProximo.onclick = proximo
                ? () => abrirDetalhes(proximo.id)
                : null;
        }
    }

    function renderizarTabela() {
        const tabela = $("appointmentsTable");

        if (!tabela) return;

        const antigos = tabela.querySelectorAll(
            ".appointment-row, .dashboard-empty"
        );

        antigos.forEach((elemento) => elemento.remove());

        let lista = agendamentosHoje();

        if (filtroAtual !== "all") {
            lista = lista.filter(
                (a) => a.status === filtroAtual
            );
        }

        if (!lista.length) {
            const vazio = criarElemento(
                "div",
                "dashboard-empty",
                "Nenhum atendimento encontrado para este filtro."
            );

            vazio.style.padding = "26px 18px";
            vazio.style.textAlign = "center";
            vazio.style.color = "#95817b";

            tabela.appendChild(vazio);
            return;
        }

        lista.forEach((agendamento) => {
            const linha = criarElemento(
                "div",
                "table-row appointment-row"
            );

            linha.dataset.id = agendamento.id;
            linha.dataset.status = agendamento.status;

            linha.appendChild(
                criarElemento(
                    "span",
                    "",
                    agendamento.horario
                )
            );

            linha.appendChild(
                criarElemento(
                    "span",
                    "",
                    agendamento.cliente_nome
                )
            );

            linha.appendChild(
                criarElemento(
                    "span",
                    "",
                    agendamento.procedimento
                )
            );

            linha.appendChild(
                criarElemento(
                    "span",
                    "",
                    moeda(agendamento.valor)
                )
            );

            linha.appendChild(
                criarElemento(
                    "span",
                    `status ${agendamento.status}`,
                    statusTexto(agendamento.status)
                )
            );

            const acoes = criarElemento("div", "actions");

            const editar = criarElemento(
                "button",
                "edit-button",
                "Editar"
            );

            editar.type = "button";

            editar.addEventListener("click", () => {
                abrirEdicao(agendamento.id);
            });

            const ver = criarElemento(
                "button",
                "view-button",
                "Ver"
            );

            ver.type = "button";

            ver.addEventListener("click", () => {
                abrirDetalhes(agendamento.id);
            });

            acoes.appendChild(editar);
            acoes.appendChild(ver);

            linha.appendChild(acoes);
            tabela.appendChild(linha);
        });
    }

    function buscarAgendamento(id) {
        return agendamentos.find(
            (agendamento) =>
                String(agendamento.id) === String(id)
        );
    }

    function abrirDetalhes(id) {
        const agendamento = buscarAgendamento(id);

        if (!agendamento) {
            alert("Agendamento não encontrado.");
            return;
        }

        $("modalCliente").textContent =
            agendamento.cliente_nome;

        $("modalProcedimento").textContent =
            agendamento.procedimento;

        $("modalHorario").textContent =
            agendamento.horario;

        $("modalValor").textContent =
            moeda(agendamento.valor);

        $("modalStatus").textContent =
            statusTexto(agendamento.status);

        $("modalDetalhes").hidden = false;
    }

    function fecharDetalhes() {
        if ($("modalDetalhes")) {
            $("modalDetalhes").hidden = true;
        }
    }

    function abrirEdicao(id) {
        const agendamento = buscarAgendamento(id);

        if (!agendamento) {
            alert("Agendamento não encontrado no banco.");
            return;
        }

        linhaSelecionada = agendamento;

        $("editarId").value = agendamento.id;
        $("editarCliente").value =
            agendamento.cliente_nome || "";

        $("editarTelefone").value =
            agendamento.telefone || "";

        $("editarProcedimento").value =
            agendamento.procedimento || "";

        $("editarData").value =
            agendamento.data || "";

        $("editarHorario").value =
            texto(agendamento.horario).slice(0, 5);

        $("editarDuracao").value =
            agendamento.duracao ?? 60;

        $("editarValor").value =
            agendamento.valor ?? 0;

        $("editarStatus").value =
            agendamento.status || "pending";

        $("modalEditar").hidden = false;
    }

    function fecharEdicao() {
        if ($("modalEditar")) {
            $("modalEditar").hidden = true;
        }

        linhaSelecionada = null;

        if ($("formEditarAgendamento")) {
            $("formEditarAgendamento").reset();
        }
    }

    async function salvarEdicao(evento) {
        evento.preventDefault();

        const formulario = $("formEditarAgendamento");

        if (!formulario.reportValidity()) return;

        const id = $("editarId").value;

        if (!/^[1-9]\d*$/.test(id)) {
            alert("O agendamento não possui um ID válido.");
            return;
        }

        const dados = {
            cliente_nome: $("editarCliente").value.trim(),
            telefone: $("editarTelefone").value.trim(),
            procedimento: $("editarProcedimento").value.trim(),
            data: $("editarData").value,
            horario: $("editarHorario").value,
            duracao: Number($("editarDuracao").value),
            valor: Number($("editarValor").value),
            status: $("editarStatus").value
        };

        const botao = formulario.querySelector(
            'button[type="submit"]'
        );

        try {
            if (botao) {
                botao.disabled = true;
                botao.textContent = "Salvando...";
            }

            const resposta = await fetch(
                `${API_AGENDAMENTOS}/${id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify(dados)
                }
            );

            const resultado = await resposta.json();

            if (!resposta.ok || resultado.sucesso === false) {
                throw new Error(
                    resultado.erro ||
                    resultado.mensagem ||
                    `Erro HTTP ${resposta.status}`
                );
            }

            fecharEdicao();

            await carregarDashboard();

            alert("Agendamento atualizado com sucesso!");

        } catch (erro) {
            console.error("Erro ao salvar agendamento:", erro);

            alert(
                "Não foi possível salvar: " + erro.message
            );

        } finally {
            if (botao) {
                botao.disabled = false;
                botao.textContent = "Salvar alterações";
            }
        }
    }

    async function carregarClientes() {
        try {
            const resposta = await fetch(API_CLIENTES, {
                cache: "no-store"
            });

            if (!resposta.ok) return;

            const clientes = await resposta.json();

            if (Array.isArray(clientes) && $("totalClients")) {
                $("totalClients").textContent = clientes.length;
            }
        } catch (erro) {
            console.error("Erro ao carregar clientes:", erro);
        }
    }

    async function carregarDashboard() {
        if (carregando) return;

        carregando = true;

        try {
            const resposta = await fetch(API_AGENDAMENTOS, {
                headers: {
                    Accept: "application/json"
                },
                cache: "no-store"
            });

            if (!resposta.ok) {
                throw new Error(
                    `Erro ao carregar agendamentos: ${resposta.status}`
                );
            }

            const dados = await resposta.json();

            if (!Array.isArray(dados)) {
                throw new Error(
                    "A API não retornou uma lista de agendamentos."
                );
            }

            agendamentos = dados;

            renderizarTabela();
            atualizarResumo();

        } catch (erro) {
            console.error("Erro ao carregar Dashboard:", erro);

            const tabela = $("appointmentsTable");

            if (tabela) {
                tabela.querySelectorAll(
                    ".appointment-row, .dashboard-empty"
                ).forEach((elemento) => elemento.remove());

                const aviso = criarElemento(
                    "div",
                    "dashboard-empty",
                    "Não foi possível carregar os agendamentos. Verifique o servidor."
                );

                aviso.style.padding = "24px";
                tabela.appendChild(aviso);
            }

        } finally {
            carregando = false;
        }

        await carregarClientes();
    }


    document.querySelectorAll(".filter-btn").forEach(
        (botao) => {
            botao.addEventListener("click", () => {
                document.querySelectorAll(
                    ".filter-btn"
                ).forEach((item) => {
                    item.classList.remove("active-filter");
                });

                botao.classList.add("active-filter");

                filtroAtual = botao.dataset.filter || "all";

                renderizarTabela();
            });
        }
    );


    $("fecharDetalhes")?.addEventListener(
        "click",
        fecharDetalhes
    );

    $("btnFecharDetalhes")?.addEventListener(
        "click",
        fecharDetalhes
    );


    $("fecharEdicao")?.addEventListener(
        "click",
        fecharEdicao
    );

    $("cancelarEdicao")?.addEventListener(
        "click",
        fecharEdicao
    );


    $("formEditarAgendamento")?.addEventListener(
        "submit",
        salvarEdicao
    );


    $("modalDetalhes")?.addEventListener(
        "click",
        (evento) => {
            if (evento.target === $("modalDetalhes")) {
                fecharDetalhes();
            }
        }
    );

    $("modalEditar")?.addEventListener(
        "click",
        (evento) => {
            if (evento.target === $("modalEditar")) {
                fecharEdicao();
            }
        }
    );



    document.addEventListener("keydown", (evento) => {
        if (evento.key !== "Escape") return;

        fecharDetalhes();
        fecharEdicao();
    });



    atualizarSaudacao();
    carregarDashboard();

    setInterval(atualizarSaudacao, 60000);
    setInterval(carregarDashboard, 60000);
});
