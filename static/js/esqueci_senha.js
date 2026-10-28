
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("formRecuperacao");
    const email = document.getElementById("email");
    const botao = document.getElementById("btnRecuperar");

    if (!form || !email || !botao) return;

    const textoOriginal = botao.textContent.trim();

    email.addEventListener("input", () => {
        email.setCustomValidity("");
    });

    form.addEventListener("submit", event => {
        email.value = email.value.trim();

        if (!form.checkValidity()) {
            event.preventDefault();
            form.reportValidity();
            return;
        }

        if (form.dataset.enviando === "true") {
            event.preventDefault();
            return;
        }

        form.dataset.enviando = "true";
        botao.disabled = true;
        botao.textContent = "Enviando código...";
    });

    window.addEventListener("pageshow", () => {
        form.dataset.enviando = "false";
        botao.disabled = false;
        botao.textContent = textoOriginal;
    });
});
