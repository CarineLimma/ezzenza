   document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector(".login-form");
    const email = document.getElementById("email");
    const senha = document.getElementById("senha");
    const toggleSenha = document.getElementById("toggleSenha");
    const btnLogin = document.querySelector(".btn-login");

    if (!form || !email || !senha || !toggleSenha || !btnLogin) return;

    toggleSenha.addEventListener("click", () => {
        const visivel = senha.type === "text";

        senha.type = visivel ? "password" : "text";
        toggleSenha.textContent = visivel ? "Mostrar" : "Ocultar";
        toggleSenha.setAttribute("aria-pressed", String(!visivel));
        toggleSenha.setAttribute(
            "aria-label",
            visivel ? "Mostrar senha" : "Ocultar senha"
        );
    });

    email.addEventListener("input", () => {
        email.setCustomValidity("");
    });

    form.addEventListener("submit", event => {
        email.value = email.value.trim();

        if (!email.validity.valid || !senha.value.trim()) {
            event.preventDefault();
            form.reportValidity();
            return;
        }

        if (form.dataset.enviando === "true") {
            event.preventDefault();
            return;
        }

        form.dataset.enviando = "true";

        btnLogin.disabled = true;
        btnLogin.textContent = "Entrando...";
    });

    window.addEventListener("pageshow", () => {
        form.dataset.enviando = "false";
        btnLogin.disabled = false;
        btnLogin.textContent = "Entrar";
    });
});
