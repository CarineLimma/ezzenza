
import sqlite3

conn = sqlite3.connect("essenza.db")

conn.execute("""
    CREATE TABLE IF NOT EXISTS agendamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_nome TEXT NOT NULL,
        telefone TEXT NOT NULL,
        procedimento TEXT NOT NULL,
        data TEXT NOT NULL,
        horario TEXT NOT NULL,
        duracao INTEGER NOT NULL,
        valor REAL NOT NULL,
        status TEXT DEFAULT 'pending'
    )
""")

conn.commit()
conn.close()

print("Tabela de agendamentos criada!")
