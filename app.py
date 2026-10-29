import os
import re
import json
import math
import sqlite3

from pathlib import Path
from datetime import datetime
from decimal import Decimal, InvalidOperation
from urllib.parse import urlencode
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash, check_password_hash

from flask import (
    Flask,
    render_template,
    request,
    redirect,
    url_for,
    jsonify,
    flash,
    session,
    abort
)

BASE_DIR = Path(__file__).resolve().parent
DATABASE = BASE_DIR / "essenza.db"

load_dotenv(BASE_DIR / ".env")

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")

if not app.config["SECRET_KEY"]:
    raise RuntimeError("SECRET_KEY não configurada no .env" )


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def criar_tabela_configuracoes():
    conn = get_db()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS configuracoes (
                id INTEGER PRIMARY KEY,
                dados TEXT NOT NULL DEFAULT '{}'
            )
        """)
        conn.execute("""
            INSERT OR IGNORE INTO configuracoes (id, dados)
            VALUES (1, '{}')
        """)
        conn.commit()
    finally:
        conn.close()


def criar_tabela_usuarios():
    conn = get_db()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS usuarios_auth (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                senha_hash TEXT NOT NULL,
                criado_em TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
    finally:
        conn.close()


def inicializar_tabela_clientes():
    conn = get_db()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS clientes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                telefone TEXT NOT NULL,
                email TEXT DEFAULT '',
                data_nascimento TEXT DEFAULT '',
                observacoes TEXT DEFAULT '',
                status TEXT NOT NULL DEFAULT 'active',
                criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
            )
        """)
        conn.commit()
    finally:
        conn.close()


def criar_tabela_procedimentos():
    conn = get_db()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS procedimentos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                categoria TEXT NOT NULL DEFAULT '',
                duracao INTEGER NOT NULL,
                valor REAL NOT NULL,
                descricao TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'active',
                criado_em TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
    finally:
        conn.close()


def inicializar_financeiro():
    conn = get_db()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS financeiro (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tipo TEXT NOT NULL CHECK (tipo IN ('income', 'expense')),
                data TEXT NOT NULL,
                descricao TEXT NOT NULL,
                categoria TEXT NOT NULL DEFAULT '',
                valor REAL NOT NULL CHECK (valor > 0),
                status TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'paid')),
                forma_pagamento TEXT NOT NULL DEFAULT '',
                cliente TEXT NOT NULL DEFAULT '',
                vencimento TEXT NOT NULL DEFAULT '',
                observacoes TEXT NOT NULL DEFAULT '',
                criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
    finally:
        conn.close()


criar_tabela_configuracoes()
criar_tabela_usuarios()
inicializar_tabela_clientes()
criar_tabela_procedimentos()
inicializar_financeiro()


def login_required():
    if not session.get("usuario_id"):
        return redirect(url_for("login"))
    return None


@app.route("/")
def index():
    guard = login_required()
    if guard:
        return guard
    return render_template("index.html", usuario_nome=session.get("usuario_nome", ""))


@app.route("/agendamentos")
def agendamentos():
    guard = login_required()
    if guard:
        return guard
    return render_template("agendamentos.html", usuario_nome=session.get("usuario_nome", ""))


@app.route("/clientes")
def clientes():
    guard = login_required()
    if guard:
        return guard
    return render_template("clientes.html", usuario_nome=session.get("usuario_nome", ""))


@app.route("/procedimentos")
def procedimentos():
    guard = login_required()
    if guard:
        return guard
    return render_template("procedimentos.html", usuario_nome=session.get("usuario_nome", ""))


@app.route("/financeiro")
def financeiro():
    guard = login_required()
    if guard:
        return guard
    return render_template("financeiro.html", usuario_nome=session.get("usuario_nome", ""))


@app.route("/configuracoes")
def configuracoes():
    guard = login_required()
    if guard:
        return guard
    return render_template("configuracoes.html", usuario_nome=session.get("usuario_nome", ""))


@app.route("/login", methods=["GET", "POST"])
def login():
    if session.get("usuario_id"):
        return redirect(url_for("index"))

    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        senha = request.form.get("senha", "")

        conn = get_db()
        try:
            usuario = conn.execute(
                "SELECT id, nome, senha_hash FROM usuarios_auth WHERE email = ?",
                (email,)
            ).fetchone()
        finally:
            conn.close()
        
       
        if not usuario or not check_password_hash(usuario["senha_hash"], senha):
            flash("E-mail ou senha incorretos.", "error")
            return redirect(url_for("login"))

        session.clear()
        session["usuario_id"] = usuario["id"]
        session["usuario_nome"] = usuario["nome"]

        proxima = request.args.get("next")
        return redirect(proxima if proxima else url_for("index"))

    return render_template("login.html")


@app.route("/logout")
@app.route("/sair", methods=["GET", "POST"])
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/esqueci_senha", methods=["GET", "POST"])
def esqueci_senha():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        if not email:
            return render_template("esqueci_senha.html", aviso="Informe um e-mail válido.")
        return render_template("esqueci_senha.html",
                               aviso="O envio do código de recuperação ainda não está configurado.")
    return render_template("esqueci_senha.html")


@app.route("/cadastro", methods=["GET", "POST"])
def cadastro():
    if request.method == "POST":
        nome = request.form.get("nome", "").strip()
        email = request.form.get("email", "").strip().lower()
        senha = request.form.get("senha", "")
        confirmar = request.form.get("confirmar_senha", "")

        if len(nome) < 2 or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            flash("Informe um nome e e-mail válidos.", "error")
            return redirect(url_for("cadastro"))

        senha_valida = (
            len(senha) >= 8
            and re.search(r"[A-Z]", senha)
            and re.search(r"[a-z]", senha)
            and re.search(r"\d", senha)
            and re.search(r"[^A-Za-z0-9]", senha)
        )

        if not senha_valida:
            flash("A senha precisa ter 8+ caracteres, letra maiúscula, minúscula, número e símbolo.", "error")
            return redirect(url_for("cadastro"))

        if senha != confirmar:
            flash("As senhas não coincidem.", "error")
            return redirect(url_for("cadastro"))

        conn = get_db()
        try:
            conn.execute(
                "INSERT INTO usuarios_auth (nome, email, senha_hash) VALUES (?, ?, ?)",
                (nome, email, generate_password_hash(senha))
            )
            conn.commit()
        except sqlite3.IntegrityError:
            flash("Este e-mail já está cadastrado.", "error")
            return redirect(url_for("cadastro"))
        finally:
            conn.close()

        flash("Conta criada! Faça seu login.", "success")
        return redirect(url_for("login"))

    return render_template("cadastro.html")


@app.route("/api/configuracoes", methods=["GET", "POST"])
def api_configuracoes():
    conn = get_db()
    try:
        if request.method == "GET":
            registro = conn.execute(
                "SELECT dados FROM configuracoes WHERE id = 1"
            ).fetchone()
            dados = json.loads(registro["dados"]) if registro else {}
            return jsonify(dados)

        if not request.is_json:
            return jsonify({"sucesso": False, "mensagem": "Envie os dados em JSON."}), 415

        dados = request.get_json(silent=True)

        if not isinstance(dados, dict):
            return jsonify({"sucesso": False, "mensagem": "Dados inválidos."}), 400

        campos_texto = {
            "clinicName", "clinicPhone", "clinicEmail",
            "clinicDocument", "clinicCity", "clinicAddress",
            "clinicDescription", "openingTime", "closingTime",
            "lunchStart", "lunchEnd", "appointmentInterval",
            "defaultAppointmentStatus", "whatsappNumber",
            "confirmationMessage", "pixKey", "pixHolder",
            "systemDisplayName", "primaryColor", "secondaryColor"
        }

        campos_booleanos = {
            "allowFutureAppointments", "preventDoubleBooking",
            "useCustomMessage", "manualPaymentConfirmation"
        }

        campos_listas = {"workingDays", "acceptedPayments"}
        permitidos = campos_texto | campos_booleanos | campos_listas

        campos_desconhecidos = set(dados) - permitidos
        if campos_desconhecidos:
            return jsonify({
                "sucesso": False,
                "mensagem": "Campos não reconhecidos: " + ", ".join(sorted(campos_desconhecidos))
            }), 400

        for chave, valor in dados.items():
            if chave in campos_texto:
                if not isinstance(valor, str) or len(valor) > 5000:
                    return jsonify({"sucesso": False, "mensagem": f"Campo inválido: {chave}"}), 400
            elif chave in campos_booleanos:
                if not isinstance(valor, bool):
                    return jsonify({"sucesso": False, "mensagem": f"Campo inválido: {chave}"}), 400
            elif chave in campos_listas:
                if not isinstance(valor, list) or not all(isinstance(i, str) for i in valor):
                    return jsonify({"sucesso": False, "mensagem": f"Campo inválido: {chave}"}), 400

        if "clinicName" in dados and not dados["clinicName"].strip():
            return jsonify({"sucesso": False, "mensagem": "Informe o nome da clínica."}), 400

        registro = conn.execute(
            "SELECT dados FROM configuracoes WHERE id = 1"
        ).fetchone()
        anteriores = json.loads(registro["dados"]) if registro else {}
        anteriores.update(dados)

        conn.execute("""
            INSERT INTO configuracoes (id, dados)
            VALUES (1, ?)
            ON CONFLICT(id) DO UPDATE SET dados = excluded.dados
        """, (json.dumps(anteriores, ensure_ascii=False),))
        conn.commit()

        return jsonify({"sucesso": True, "mensagem": "Configurações salvas com sucesso!"})

    except (sqlite3.Error, ValueError, TypeError):
        app.logger.exception("Erro ao processar configurações")
        return jsonify({"sucesso": False, "mensagem": "Erro ao salvar ou carregar configurações."}), 500
    finally:
        conn.close()


@app.route("/api/agendamentos", methods=["GET"])
def listar_agendamentos():
    conn = get_db()
    try:
        registros = conn.execute(
            "SELECT * FROM agendamentos ORDER BY data, horario"
        ).fetchall()
        return jsonify([dict(r) for r in registros])
    finally:
        conn.close()


@app.route("/api/agendamentos", methods=["POST"])
def criar_agendamento():
    dados = request.get_json(silent=True)

    if not isinstance(dados, dict):
        return jsonify({"erro": "Envie os dados em formato JSON."}), 400

    for campo in ["cliente_nome", "telefone", "procedimento", "data", "horario", "duracao", "valor"]:
        if dados.get(campo) is None or str(dados[campo]).strip() == "":
            return jsonify({"erro": f"O campo {campo} é obrigatório."}), 400

    try:
        data = datetime.strptime(dados["data"], "%Y-%m-%d").date()
        horario = datetime.strptime(dados["horario"], "%H:%M").time()
        duracao = int(dados["duracao"])
        valor = float(dados["valor"])
        if duracao <= 0 or valor < 0:
            raise ValueError
    except (ValueError, TypeError, OverflowError):
        return jsonify({"erro": "Data, horário, duração ou valor inválido."}), 400

    telefone = re.sub(r"\D", "", str(dados["telefone"]))
    if len(telefone) not in (10, 11, 12, 13):
        return jsonify({"erro": "Informe um telefone válido com DDD."}), 400

    status = dados.get("status", "pending")
    if status not in ("pending", "confirmed"):
        return jsonify({"erro": "Status inicial inválido."}), 400

    conn = get_db()
    try:
        cursor = conn.execute("""
            INSERT INTO agendamentos
            (cliente_nome, telefone, procedimento, data, horario, duracao, valor, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            str(dados["cliente_nome"]).strip(),
            telefone,
            str(dados["procedimento"]).strip(),
            data.isoformat(),
            horario.strftime("%H:%M"),
            duracao,
            valor,
            status
        ))
        conn.commit()
        return jsonify({"sucesso": True, "id": cursor.lastrowid, "mensagem": "Agendamento cadastrado!"}), 201
    except sqlite3.Error:
        app.logger.exception("Erro ao cadastrar agendamento")
        return jsonify({"erro": "Não foi possível salvar o agendamento."}), 500
    finally:
        conn.close()


@app.route("/api/agendamentos/<int:id>", methods=["GET"])
def consultar_agendamento(id):
    conn = get_db()
    try:
        ag = conn.execute("SELECT * FROM agendamentos WHERE id = ?", (id,)).fetchone()
        if ag is None:
            return jsonify({"erro": "Agendamento não encontrado"}), 404
        return jsonify(dict(ag))
    finally:
        conn.close()


@app.route("/api/agendamentos/<int:id>", methods=["PUT"])
def atualizar_agendamento(id):
    dados = request.get_json(silent=True)

    if not isinstance(dados, dict):
        return jsonify({"erro": "Dados inválidos."}), 400

    try:
        data = datetime.strptime(dados["data"], "%Y-%m-%d").date()
        horario = datetime.strptime(dados["horario"], "%H:%M").time()
        duracao = int(dados["duracao"])
        valor = float(dados["valor"])
        if duracao <= 0 or valor < 0:
            raise ValueError
    except (ValueError, TypeError, KeyError):
        return jsonify({"erro": "Data, horário, duração ou valor inválido."}), 400

    if dados.get("status") not in ("pending", "confirmed", "cancelled", "completed"):
        return jsonify({"erro": "Status inválido."}), 400

    conn = get_db()
    try:
        cursor = conn.execute("""
            UPDATE agendamentos
            SET cliente_nome = ?, telefone = ?, procedimento = ?,
                data = ?, horario = ?, duracao = ?, valor = ?, status = ?
            WHERE id = ?
        """, (
            str(dados["cliente_nome"]).strip(),
            str(dados["telefone"]).strip(),
            str(dados["procedimento"]).strip(),
            data.isoformat(),
            horario.strftime("%H:%M"),
            duracao,
            valor,
            dados["status"],
            id
        ))
        if cursor.rowcount == 0:
            return jsonify({"erro": "Agendamento não encontrado."}), 404
        conn.commit()
        return jsonify({"sucesso": True, "mensagem": "Agendamento atualizado!"})
    except sqlite3.Error:
        app.logger.exception("Erro ao atualizar agendamento")
        return jsonify({"erro": "Não foi possível atualizar o agendamento."}), 500
    finally:
        conn.close()


@app.route("/api/agendamentos/<int:id>/status", methods=["PATCH"])
def alterar_status(id):
    dados = request.get_json(silent=True)

    if not isinstance(dados, dict):
        return jsonify({"erro": "Dados inválidos."}), 400

    status = dados.get("status")
    if status not in ("pending", "confirmed", "cancelled", "completed"):
        return jsonify({"erro": "Status inválido."}), 400

    conn = get_db()
    try:
        cursor = conn.execute(
            "UPDATE agendamentos SET status = ? WHERE id = ?", (status, id)
        )
        if cursor.rowcount == 0:
            return jsonify({"erro": "Agendamento não encontrado."}), 404
        conn.commit()
        return jsonify({"sucesso": True, "mensagem": "Status atualizado!"})
    finally:
        conn.close()


@app.route("/api/agendamentos/<int:id>/confirmar", methods=["POST"])
def confirmar_agendamento(id):
    conn = get_db()
    try:
        ag = conn.execute("SELECT id FROM agendamentos WHERE id = ?", (id,)).fetchone()
        if ag is None:
            return jsonify({"erro": "Agendamento não encontrado"}), 404
        conn.execute("UPDATE agendamentos SET status = 'confirmed' WHERE id = ?", (id,))
        conn.commit()
        return jsonify({"sucesso": True, "mensagem": "Agendamento confirmado!"})
    finally:
        conn.close()


def formatar_data(data):
    try:
        return datetime.strptime(data, "%Y-%m-%d").strftime("%d/%m/%Y")
    except ValueError:
        return data


@app.route("/confirmar_whatsapp/<int:id>", methods=["POST"])
def confirmar_whatsapp(id):
    conn = get_db()
    try:
        ag = conn.execute("SELECT * FROM agendamentos WHERE id = ?", (id,)).fetchone()
    finally:
        conn.close()

    if ag is None:
        abort(404, description="Agendamento não encontrado")

    mensagem = (
        f"Olá, {ag['cliente_nome']}! 🌸\n\n"
        f"Passando para lembrar do seu agendamento na Essenza.\n\n"
        f"📅 Data: {formatar_data(ag['data'])}\n"
        f"🕐 Horário: {ag['horario']}\n"
        f"✨ Procedimento: {ag['procedimento']}\n\n"
        f"Confirma sua presença? 😊"
    )

    numero = re.sub(r"\D", "", ag["telefone"])
    if not numero.startswith("55"):
        numero = "55" + numero

    if len(numero) not in (12, 13):
        abort(400, description="Telefone inválido")

    return redirect(f"https://wa.me/{numero}?{urlencode({'text': mensagem})}")


@app.route("/api/dashboard", methods=["GET"])
def dados_dashboard():
    hoje = datetime.now().strftime("%Y-%m-%d")
    conn = get_db()
    try:
        registros = conn.execute(
            "SELECT * FROM agendamentos WHERE data = ? ORDER BY horario", (hoje,)
        ).fetchall()
        lista = [dict(r) for r in registros]

        confirmados = sum(1 for a in lista if a["status"] == "confirmed")
        pendentes = sum(1 for a in lista if a["status"] == "pending")
        cancelados = sum(1 for a in lista if a["status"] == "cancelled")
        faturamento = sum(float(a["valor"] or 0) for a in lista if a["status"] != "cancelled")

        return jsonify({
            "data": hoje,
            "total_agendamentos": len(lista),
            "confirmados": confirmados,
            "pendentes": pendentes,
            "cancelados": cancelados,
            "faturamento_previsto": faturamento,
            "agendamentos": lista
        })
    except sqlite3.Error:
        app.logger.exception("Erro ao carregar dashboard")
        return jsonify({"erro": "Não foi possível carregar o dashboard."}), 500
    finally:
        conn.close()


def validar_dados_cliente(dados):
    if not isinstance(dados, dict):
        return None, "Envie os dados em formato JSON."

    nome = str(dados.get("nome") or "").strip()
    telefone = str(dados.get("telefone") or "").strip()
    email = str(dados.get("email") or "").strip()
    nascimento = str(dados.get("data_nascimento") or "").strip()
    observacoes = str(dados.get("observacoes") or "").strip()
    status = dados.get("status", "active")

    if not nome:
        return None, "Informe o nome da cliente."

    numero = re.sub(r"\D", "", telefone)
    if len(numero) not in (10, 11, 12, 13):
        return None, "Informe um telefone válido com DDD."

    if email and ("@" not in email or "." not in email.split("@")[-1]):
        return None, "Informe um e-mail válido."

    if nascimento:
        try:
            datetime.strptime(nascimento, "%Y-%m-%d")
        except ValueError:
            return None, "Data de nascimento inválida."

    if status not in ("active", "inactive"):
        return None, "Status inválido."

    return (nome, telefone, email, nascimento, observacoes, status), None


@app.route("/api/clientes", methods=["GET", "POST"])
def api_clientes():
    if request.method == "POST":
        dados, erro = validar_dados_cliente(request.get_json(silent=True))
        if erro:
            return jsonify({"erro": erro}), 400

        conn = get_db()
        try:
            cursor = conn.execute("""
                INSERT INTO clientes (nome, telefone, email, data_nascimento, observacoes, status)
                VALUES (?, ?, ?, ?, ?, ?)
            """, dados)
            conn.commit()
            return jsonify({"sucesso": True, "id": cursor.lastrowid, "mensagem": "Cliente cadastrada!"}), 201
        except sqlite3.Error:
            app.logger.exception("Erro ao cadastrar cliente")
            return jsonify({"erro": "Não foi possível salvar a cliente."}), 500
        finally:
            conn.close()

    conn = get_db()
    try:
        registros = conn.execute(
            "SELECT * FROM clientes ORDER BY nome COLLATE NOCASE"
        ).fetchall()
        return jsonify([dict(r) for r in registros])
    except sqlite3.Error:
        app.logger.exception("Erro ao listar clientes")
        return jsonify({"erro": "Não foi possível carregar as clientes."}), 500
    finally:
        conn.close()


@app.route("/api/clientes/<int:id>", methods=["GET", "PUT", "DELETE"])
def api_cliente_por_id(id):
    conn = get_db()
    try:
        registro = conn.execute("SELECT * FROM clientes WHERE id = ?", (id,)).fetchone()
        if registro is None:
            return jsonify({"erro": "Cliente não encontrada."}), 404

        if request.method == "GET":
            return jsonify(dict(registro))

        if request.method == "DELETE":
            conn.execute("DELETE FROM clientes WHERE id = ?", (id,))
            conn.commit()
            return jsonify({"sucesso": True, "mensagem": "Cliente excluída!"})

        dados, erro = validar_dados_cliente(request.get_json(silent=True))
        if erro:
            return jsonify({"erro": erro}), 400

        conn.execute("""
            UPDATE clientes
            SET nome = ?, telefone = ?, email = ?, data_nascimento = ?, observacoes = ?, status = ?
            WHERE id = ?
        """, (*dados, id))
        conn.commit()
        return jsonify({"sucesso": True, "mensagem": "Cliente atualizada!"})

    except sqlite3.Error:
        app.logger.exception("Erro na operação de cliente")
        return jsonify({"erro": "Não foi possível concluir a operação."}), 500
    finally:
        conn.close()


def validar_procedimento(dados):
    if not isinstance(dados, dict):
        return None, "Dados inválidos."

    nome = str(dados.get("nome") or "").strip()
    categoria = str(dados.get("categoria") or "").strip()
    descricao = str(dados.get("descricao") or "").strip()
    status = dados.get("status", "active")

    if not nome:
        return None, "Informe o nome do procedimento."
    if len(nome) > 120:
        return None, "Nome muito longo."
    if len(categoria) > 80 or len(descricao) > 2000:
        return None, "Categoria ou descrição muito longa."

    try:
        duracao_bruta = dados.get("duracao")
        duracao = int(duracao_bruta)
        if isinstance(duracao_bruta, bool) or float(duracao_bruta) != duracao:
            raise ValueError
        valor = float(dados.get("valor"))
        if duracao <= 0 or duracao > 1440 or not math.isfinite(valor) or valor < 0:
            raise ValueError
    except (TypeError, ValueError, OverflowError):
        return None, "Duração ou valor inválido."

    if status not in ("active", "inactive"):
        return None, "Status inválido."

    return (nome, categoria, duracao, round(valor, 2), descricao, status), None


@app.route("/api/procedimentos", methods=["GET", "POST"])
def api_procedimentos():
    conn = get_db()
    try:
        if request.method == "GET":
            registros = conn.execute(
                "SELECT * FROM procedimentos ORDER BY nome COLLATE NOCASE"
            ).fetchall()
            return jsonify([dict(r) for r in registros])

        dados, erro = validar_procedimento(request.get_json(silent=True))
        if erro:
            return jsonify({"erro": erro}), 400

        cursor = conn.execute("""
            INSERT INTO procedimentos (nome, categoria, duracao, valor, descricao, status)
            VALUES (?, ?, ?, ?, ?, ?)
        """, dados)
        conn.commit()
        return jsonify({"sucesso": True, "id": cursor.lastrowid, "mensagem": "Procedimento cadastrado!"}), 201
    except sqlite3.Error:
        app.logger.exception("Erro na API de procedimentos")
        return jsonify({"erro": "Erro ao acessar procedimentos."}), 500
    finally:
        conn.close()


@app.route("/api/procedimentos/<int:id>", methods=["GET", "PUT", "DELETE"])
def api_procedimento_por_id(id):
    conn = get_db()
    try:
        registro = conn.execute("SELECT * FROM procedimentos WHERE id = ?", (id,)).fetchone()
        if registro is None:
            return jsonify({"erro": "Procedimento não encontrado."}), 404

        if request.method == "GET":
            return jsonify(dict(registro))

        if request.method == "DELETE":
            conn.execute("DELETE FROM procedimentos WHERE id = ?", (id,))
            conn.commit()
            return jsonify({"sucesso": True, "mensagem": "Procedimento excluído!"})

        dados, erro = validar_procedimento(request.get_json(silent=True))
        if erro:
            return jsonify({"erro": erro}), 400

        conn.execute("""
            UPDATE procedimentos
            SET nome = ?, categoria = ?, duracao = ?, valor = ?, descricao = ?, status = ?
            WHERE id = ?
        """, (*dados, id))
        conn.commit()
        return jsonify({"sucesso": True, "mensagem": "Procedimento atualizado!"})

    except sqlite3.Error:
        app.logger.exception("Erro ao consultar ou alterar procedimento")
        return jsonify({"erro": "Não foi possível concluir a operação."}), 500
    finally:
        conn.close()


def validar_movimentacao(dados):
    if not isinstance(dados, dict):
        return None, "Envie os dados em formato JSON."

    tipo = str(dados.get("tipo") or "").strip()
    data = str(dados.get("data") or "").strip()
    descricao = str(dados.get("descricao") or "").strip()
    categoria = str(dados.get("categoria") or "").strip()
    status = str(dados.get("status") or "pending").strip()
    forma_pagamento = str(dados.get("forma_pagamento") or "").strip()
    cliente = str(dados.get("cliente") or "").strip()
    vencimento = str(dados.get("vencimento") or "").strip()
    observacoes = str(dados.get("observacoes") or "").strip()

    if tipo not in ("income", "expense"):
        return None, "Tipo de movimentação inválido."
    if not descricao:
        return None, "Informe a descrição."
    if len(descricao) > 200:
        return None, "Descrição muito longa."
    if len(categoria) > 80:
        return None, "Categoria muito longa."
    if len(cliente) > 120:
        return None, "Nome da cliente muito longo."
    if len(observacoes) > 5000:
        return None, "Observações muito longas."
    if status not in ("pending", "paid"):
        return None, "Status inválido."
    if forma_pagamento not in ("", "pix", "card", "cash", "transfer", "other"):
        return None, "Forma de pagamento inválida."

    try:
        datetime.strptime(data, "%Y-%m-%d")
        if vencimento:
            datetime.strptime(vencimento, "%Y-%m-%d")
    except ValueError:
        return None, "Data ou vencimento inválido."

    try:
        valor_original = dados.get("valor")
        if isinstance(valor_original, bool):
            raise InvalidOperation
        valor_decimal = Decimal(str(valor_original))
        if not valor_decimal.is_finite() or valor_decimal <= 0 or valor_decimal.as_tuple().exponent < -2:
            raise InvalidOperation
        valor_centavos = int(valor_decimal * 100)
        if valor_centavos > 10**12:
            raise InvalidOperation
        valor = valor_centavos / 100
    except (InvalidOperation, TypeError, ValueError):
        return None, "Informe um valor monetário válido."

    return (tipo, data, descricao, categoria, valor, status, forma_pagamento, cliente, vencimento, observacoes), None


@app.route("/api/financeiro", methods=["GET", "POST"])
def api_financeiro():
    if request.method == "POST":
        valores, erro = validar_movimentacao(request.get_json(silent=True))
        if erro:
            return jsonify({"erro": erro}), 400

        conn = get_db()
        try:
            cursor = conn.execute("""
                INSERT INTO financeiro
                (tipo, data, descricao, categoria, valor, status, forma_pagamento, cliente, vencimento, observacoes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, valores)
            conn.commit()
            return jsonify({"sucesso": True, "id": cursor.lastrowid, "mensagem": "Movimentação cadastrada!"}), 201
        except sqlite3.Error:
            app.logger.exception("Erro ao cadastrar movimentação")
            return jsonify({"erro": "Não foi possível salvar a movimentação."}), 500
        finally:
            conn.close()

    conn = get_db()
    try:
        registros = conn.execute(
            "SELECT * FROM financeiro ORDER BY data DESC, id DESC"
        ).fetchall()
        return jsonify([dict(r) for r in registros])
    except sqlite3.Error:
        app.logger.exception("Erro ao listar movimentações")
        return jsonify({"erro": "Não foi possível carregar o Financeiro."}), 500
    finally:
        conn.close()


@app.route("/api/financeiro/<int:id>", methods=["GET", "PUT", "DELETE"])
def api_financeiro_por_id(id):
    conn = get_db()
    try:
        registro = conn.execute("SELECT * FROM financeiro WHERE id = ?", (id,)).fetchone()
        if registro is None:
            return jsonify({"erro": "Movimentação não encontrada."}), 404

        if request.method == "GET":
            return jsonify(dict(registro))

        if request.method == "DELETE":
            conn.execute("DELETE FROM financeiro WHERE id = ?", (id,))
            conn.commit()
            return jsonify({"sucesso": True, "mensagem": "Movimentação excluída!"})

        valores, erro = validar_movimentacao(request.get_json(silent=True))
        if erro:
            return jsonify({"erro": erro}), 400

        conn.execute("""
            UPDATE financeiro
            SET tipo = ?, data = ?, descricao = ?, categoria = ?, valor = ?,
                status = ?, forma_pagamento = ?, cliente = ?, vencimento = ?, observacoes = ?
            WHERE id = ?
        """, (*valores, id))
        conn.commit()
        return jsonify({"sucesso": True, "mensagem": "Movimentação atualizada!"})

    except sqlite3.Error:
        app.logger.exception("Erro na operação financeira")
        return jsonify({"erro": "Não foi possível concluir a operação."}), 500
    finally:
        conn.close()


@app.route("/api/financeiro/<int:id>/status", methods=["PATCH"])
def atualizar_status_financeiro(id):
    dados = request.get_json(silent=True)

    if not isinstance(dados, dict):
        return jsonify({"erro": "Envie os dados em formato JSON."}), 400

    status = dados.get("status")
    if status not in ("pending", "paid"):
        return jsonify({"erro": "Status inválido."}), 400

    conn = get_db()
    try:
        cursor = conn.execute(
            "UPDATE financeiro SET status = ? WHERE id = ?", (status, id)
        )
        if cursor.rowcount == 0:
            return jsonify({"erro": "Movimentação não encontrada."}), 404
        conn.commit()
        return jsonify({"sucesso": True, "mensagem": "Pagamento atualizado!"})
    except sqlite3.Error:
        app.logger.exception("Erro ao atualizar pagamento")
        return jsonify({"erro": "Não foi possível atualizar o pagamento."}), 500
    finally:
        conn.close()


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=500,
        debug=True
        )