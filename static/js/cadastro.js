    document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("formCadastro");
    const nome = document.getElementById("nome");
    const email = document.getElementById("email");
    const senha = document.getElementById("senha");
    const confirmar = document.getElementById("confirmarSenha");
    const mensagem = document.getElementById("mensagemSenha");
    const botao = document.getElementById("btnCadastrar");

    const regras = {
        tamanho: valor => valor.length >= 8,
        maiuscula: valor => /[A-Z]/.test(valor),
        minuscula: valor => /[a-z]/.test(valor),
        numero: valor => /\d/.test(valor),
        simbolo: valor => /[^A-Za-z0-9]/.test(valor)
    };

    function validar() {
        const valor = senha.value;

        Object.entries(regras).forEach(([nomeRegra, teste]) => {
            const elemento = document.getElementById(
                `req-${nomeRegra}`
            );

            const valido = teste(valor);

            elemento.classList.toggle("valid", valido);
            elemento.classList.toggle("invalid", !valido);

            elemento.querySelector(".status-icon").textContent =
                valido ? "✓" : "○";
        });

        const senhaValida = Object.values(regras)
            .every(teste => teste(valor));

        confirmar.disabled = !senhaValida;

        const toggleConfirmar = document.querySelector(
            '[data-target="confirmarSenha"]'
        );

        if (toggleConfirmar) {
            toggleConfirmar.disabled = !senhaValida;
        }

        if (!senhaValida) {
            confirmar.value = "";
            mensagem.textContent =
                "🔒 Complete os requisitos para liberar.";
            mensagem.className = "mensagem-senha";
        } else if (!confirmar.value) {
            mensagem.textContent = "Agora confirme sua senha.";
            mensagem.className = "mensagem-senha";
        } else if (confirmar.value === valor) {
            mensagem.textContent = "✓ As senhas coincidem!";
            mensagem.className = "mensagem-senha valid";
        } else {
            mensagem.textContent = "As senhas não coincidem.";
            mensagem.className = "mensagem-senha invalid";
        }

        const dadosValidos =
            nome.value.trim().length >= 2 &&
            email.validity.valid &&
            email.value.trim() !== "" &&
            senhaValida &&
            confirmar.value !== "" &&
            confirmar.value === valor;

        botao.disabled = !dadosValidos;
        confirmar.placeholder = senhaValida
            ? "Repita sua senha"
            : "Complete os requisitos primeiro";
    }

    [nome, email, senha, confirmar].forEach(campo => {
        campo.addEventListener("input", validar);
    });

    document.querySelectorAll(".toggle-password")
        .forEach(botaoToggle => {
            botaoToggle.addEventListener("click", () => {
                const campo = document.getElementById(
                    botaoToggle.dataset.target
                );

                if (!campo || campo.disabled) return;

                const visivel = campo.type === "text";
                campo.type = visivel ? "password" : "text";

                botaoToggle.textContent = visivel
                    ? "Mostrar"
                    : "Ocultar";

                botaoToggle.setAttribute(
                    "aria-pressed",
                    String(!visivel)
                );
            });
        });

    form.addEventListener("submit", event => {
        validar();

        if (botao.disabled || !form.checkValidity()) {
            event.preventDefault();
            form.reportValidity();
        }
    });

    validar();
});
