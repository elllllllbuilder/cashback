require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const twilio = require("twilio");
const cron = require("node-cron");
const os = require("os");
const db = require("../config/database"); 

const app = express();
const port = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || "secretcashkey";


app.use(cors());
app.use(express.json());

console.log("✅ Servidor iniciado!");

// Middleware de autenticação
const autenticar = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Acesso negado. Faça login." });

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.admin = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: "Token inválido." });
    }
};

exports.login = async (req, res) => {
    const { email, senha } = req.body;

    try {
        const [rows] = await db.execute("SELECT * FROM administradores WHERE email = ?", [email]);

        if (rows.length === 0) {
            return res.status(401).json({ message: "E-mail ou senha incorretos." });
        }

        const admin = rows[0]; // Obtém o primeiro resultado
        const senhaValida = await bcrypt.compare(senha, admin.senha);

        if (!senhaValida) {
            return res.status(401).json({ message: "E-mail ou senha incorretos." });
        }

        // ✅ Agora inclui o nome do administrador
        const token = jwt.sign({ adminId: admin.id }, "seuSegredoSuperSecreto", { expiresIn: "8h" });

        res.json({
            token,
            nome: admin.nome // 🔥 Adicionando o nome do admin na resposta
        });

    } catch (error) {
        console.error("Erro ao fazer login:", error);
        res.status(500).json({ message: "Erro interno no servidor." });
    }
};

// ✅ Agora inclui funcao no botao X para excluir cliente no dashboar

app.delete("/clientes/:telefone", (req, res) => {
    const { telefone } = req.params;

    db.query("DELETE FROM transacoes WHERE telefone = ?", [telefone], (err) => {
        if (err) {
            console.error("Erro ao deletar transações:", err);
            return res.status(500).json({ error: "Erro ao deletar transações do cliente." });
        }

        db.query("DELETE FROM clientes WHERE telefone = ?", [telefone], (err, result) => {
            if (err) {
                console.error("Erro ao deletar cliente:", err);
                return res.status(500).json({ error: "Erro ao deletar cliente." });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: "Cliente não encontrado." });
            }

            res.json({ message: "Cliente excluído com sucesso!" });
        });
    });
});

// ✅ Edicao de clientes no dashboard

app.put("/clientes/:telefone", autenticar, (req, res) => {
    const { telefone } = req.params;
    const { novoNome, novoTelefone, novoEmail, novoSaldo } = req.body;
    const adminId = req.admin.adminId;

    db.query(
        "SELECT * FROM clientes WHERE telefone = ? AND admin_id = ?",
        [telefone, adminId],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });

            if (result.length === 0) {
                return res.status(404).json({ message: "Cliente não encontrado para este administrador." });
            }

            const cliente = result[0];

            const nomeFinal = novoNome || cliente.nome;
            const telefoneFinal = novoTelefone || cliente.telefone;
            const emailFinal = novoEmail || cliente.email;
            const saldoFinal = novoSaldo !== undefined ? novoSaldo : cliente.cashback;

            db.query(
                "UPDATE clientes SET nome = ?, telefone = ?, email = ?, cashback = ? WHERE telefone = ? AND admin_id = ?",
                [nomeFinal, telefoneFinal, emailFinal, saldoFinal, telefone, adminId],
                (err) => {
                    if (err) return res.status(500).json({ error: err.message });

                    res.json({ message: "Cliente atualizado com sucesso!" });
                }
            );
        }
    );
});



// 🔹 Rota para Registrar um Administrador
app.post("/register", [
    body("nome").notEmpty(),
    body("email").isEmail(),
    body("senha").isLength({ min: 6 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { nome, email, senha } = req.body;
    const hashSenha = await bcrypt.hash(senha, 10);

    db.query("INSERT INTO administradores (nome, email, senha) VALUES (?, ?, ?)", 
        [nome, email, hashSenha], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Administrador registrado com sucesso!" });
        }
    );
});

// 🔹 Rota para Login
app.post("/login", async (req, res) => {
    const { email, senha } = req.body;

    db.query("SELECT * FROM administradores WHERE email = ?", [email], async (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        if (result.length === 0) return res.status(401).json({ message: "E-mail ou senha incorretos." });

        const admin = result[0];
        const senhaCorreta = await bcrypt.compare(senha, admin.senha);

        if (!senhaCorreta) return res.status(401).json({ message: "E-mail ou senha incorretos." });

        const token = jwt.sign({ adminId: admin.id, email: admin.email }, SECRET_KEY, { expiresIn: "2h" });

        res.json({ token });
    });
});

// 🔹 Rota para buscar clientes do admin logado
app.get("/clientes/:telefone", autenticar, (req, res) => {
    const adminId = req.admin.adminId; // Obtém o ID do administrador logado
    const { telefone } = req.params;

    db.query(
        "SELECT * FROM clientes WHERE telefone = ? AND admin_id = ?",
        [telefone, adminId], // 🔹 Filtra os clientes pelo ADMIN
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });

            if (result.length > 0) {
                res.json(result[0]);
            } else {
                res.status(404).json({ message: "Cliente não encontrado" });
            }
        }
    );
});


// 🔹 Rota para cadastrar um novo cliente
app.post("/clientes", autenticar, async (req, res) => {
    const { telefone, nome, email } = req.body;
    const adminId = req.admin.adminId;

    // 🔎 Verifica se o telefone já existe para o mesmo admin
    db.query(
        "SELECT * FROM clientes WHERE telefone = ? AND admin_id = ?",
        [telefone, adminId],
        async (err, result) => {
            if (err) return res.status(500).json({ error: err.message });

            if (result.length > 0) {
                return res.status(400).json({ message: "Este telefone já está cadastrado para o seu usuário." });
            }

            // ✅ Se não existe, insere o novo cliente
            db.query(
                "INSERT INTO clientes (telefone, nome, email, admin_id) VALUES (?, ?, ?, ?)",
                [telefone, nome, email, adminId],
                (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: "Cliente cadastrado com sucesso!" });
                }
            );
        }
    );
});

// 🔹 Rota para adicionar cashback e salvar no histórico
app.post("/clientes/:telefone/cashback", autenticar, (req, res) => {
    const { telefone } = req.params;
    const { valor } = req.body;
    const adminId = req.admin.adminId;

    db.query(
        "UPDATE clientes SET cashback = cashback + ? WHERE telefone = ? AND admin_id = ?",
        [valor, telefone, adminId],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Cliente não encontrado para este administrador." });
            }

            db.query(
                "INSERT INTO transacoes (telefone, tipo, valor, data, admin_id) VALUES (?, 'adicionado', ?, NOW(), ?)",
                [telefone, valor, adminId],
                (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: `Cashback de R$${valor} adicionado com sucesso!` });
                }
            );
        }
    );
});


// 🔹 Rota para usar cashback
app.post("/clientes/:telefone/use-cashback", autenticar, (req, res) => {
    const { telefone } = req.params;
    const { valor } = req.body;
    const adminId = req.admin.adminId;

    db.query(
        "SELECT cashback FROM clientes WHERE telefone = ? AND admin_id = ?",
        [telefone, adminId],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });

            if (result.length === 0) {
                return res.status(404).json({ message: "Cliente não encontrado para este administrador." });
            }

            const saldoAtual = Number(result[0]?.cashback) || 0;
            if (saldoAtual < valor) return res.status(400).json({ message: "Saldo insuficiente." });

            db.query(
                "UPDATE clientes SET cashback = cashback - ? WHERE telefone = ? AND admin_id = ?",
                [valor, telefone, adminId],
                (err) => {
                    if (err) return res.status(500).json({ error: err.message });

                    db.query(
                        "INSERT INTO transacoes (telefone, tipo, valor, data, admin_id) VALUES (?, 'usado', ?, NOW(), ?)",
                        [telefone, valor, adminId],
                        (err) => {
                            if (err) return res.status(500).json({ error: err.message });
                            res.json({ message: `Cashback de R$${valor} usado!` });
                        }
                    );
                }
            );
        }
    );
});


// 🔹 Rota para buscar histórico de transações
app.get("/clientes/:telefone/transacoes", autenticar, (req, res) => {
    const { telefone } = req.params;
    const adminId = req.admin.adminId;

    db.query(
        "SELECT * FROM transacoes WHERE telefone = ? AND admin_id = ? ORDER BY data DESC",
        [telefone, adminId],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(result);
        }
    );
});


// 🔹 Cron job para notificação a cada 10 dias
cron.schedule("0 0 */10 * *", async () => {
    db.query("SELECT nome, telefone, cashback FROM clientes WHERE cashback > 0", (err, results) => {
        if (err) return console.error("Erro ao buscar clientes:", err);

        results.forEach(cliente => {
            const mensagem = `Oi ${cliente.nome}! Você tem R$${cliente.cashback.toFixed(2)} de cashback disponível! 💰`;
            enviarMensagemWhatsApp(cliente.telefone, mensagem);
        });
    });
});

// 🔹 Função para enviar mensagem via Twilio
const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
const enviarMensagemWhatsApp = async (telefone, mensagem) => {
    try {
        await twilioClient.messages.create({
            body: mensagem,
            from: `whatsapp:${process.env.TWILIO_NUMBER}`,
            to: `whatsapp:+55${telefone}`
        });
    } catch (error) {
        console.error("Erro ao enviar mensagem:", error.message);
    }
};

app.get("/clientes", autenticar, (req, res) => {
    const adminId = req.admin.adminId; // Obtém o ID do administrador logado

    db.query("SELECT * FROM clientes WHERE admin_id = ?", [adminId], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result);
    });
});


app.get("/dashboard", autenticar, (req, res) => {
    const adminId = req.admin.adminId; // Obtém o ID do administrador logado

    db.query(
        "SELECT SUM(cashback) AS total FROM clientes WHERE admin_id = ?",
        [adminId], // 🔹 Filtra apenas os clientes do administrador logado
        (err, result) => {
            if (err) {
                console.error("Erro ao buscar total de cashback:", err);
                return res.status(500).json({ error: "Erro no servidor ao buscar total de cashback." });
            }

            const totalCashback = result[0].total || 0; // Se for null, retorna 0
            console.log(`🔹 Total de cashback do admin ${adminId}: R$ ${totalCashback}`);

            res.json({ total: totalCashback });
        }
    );
});


// Iniciar servidor
app.listen(port, () => {
    console.log(`🚀 Servidor rodando na porta ${port}`);
});
