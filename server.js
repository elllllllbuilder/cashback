const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const os = require("os");
const ngrok = require("ngrok");

const app = express();
const port = 3000;

// 🔗 Conectar ao banco de dados MySQL na nuvem
const db = mysql.createPool({
    host: "artfato.online",
    user: "cashback",
    password: "cashback@10",
    database: "cashback",
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});


app.use(cors());
app.use(express.json());

console.log("✅ Servidor iniciado e cron carregado!");


app.post("/clientes/:telefone/cashback", (req, res) => {
    const { telefone } = req.params;
    const { valor } = req.body;

    // Verifica se o cliente existe
    db.query("SELECT * FROM clientes WHERE telefone = ?", [telefone], (err, result) => {
        if (err) {
            console.error("Erro ao buscar cliente:", err);
            return res.status(500).json({ error: "Erro ao buscar cliente." });
        }

        if (result.length === 0) {
            return res.status(404).json({ message: "Cliente não encontrado" });
        }

        // Atualiza o saldo do cliente
        db.query(
            "UPDATE clientes SET cashback = cashback + ? WHERE telefone = ?",
            [valor, telefone],
            (err) => {
                if (err) {
                    console.error("Erro ao atualizar saldo:", err);
                    return res.status(500).json({ error: "Erro ao atualizar saldo." });
                }

                // ✅ Salva a transação no histórico
                db.query(
                    "INSERT INTO transacoes (telefone, tipo, valor, data) VALUES (?, 'adicionado', ?, NOW())",
                    [telefone, valor],
                    (err) => {
                        if (err) {
                            console.error("Erro ao registrar transação:", err);
                            return res.status(500).json({ error: "Erro ao registrar transação." });
                        }

                        console.log(`✅ Cashback de R$${valor} adicionado e registrado no histórico.`);
                        res.json({
                            message: `Cashback de R$${valor} adicionado com sucesso e registrado no histórico!`
                        });
                    }
                );
            }
        );
    });
});



// 🟢 Rota para buscar um cliente pelo telefone
app.get("/clientes/:telefone", (req, res) => {
    const { telefone } = req.params;
    db.query("SELECT * FROM clientes WHERE telefone = ?", [telefone], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (result.length > 0) {
            res.json(result[0]);
        } else {
            res.status(404).json({ message: "Cliente não encontrado" });
        }
    });
});

// 🟢 Rota para cadastrar um novo cliente
app.post("/clientes", (req, res) => {
    const { telefone, nome, email } = req.body;
    db.query("INSERT INTO clientes (telefone, nome, email) VALUES (?, ?, ?)",
        [telefone, nome, email],
        (err, result) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: "Cliente cadastrado com sucesso!", id: result.insertId });
        }
    );
});

// 🟢 Rota para adicionar cashback a um cliente e salvar no histórico
app.post("/clientes/:telefone/cashback", (req, res) => {
    const { telefone } = req.params;
    const { valor } = req.body;

    db.query("SELECT * FROM clientes WHERE telefone = ?", [telefone], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        if (result.length === 0) {
            return res.status(404).json({ message: "Cliente não encontrado" });
        }

        // Atualiza o saldo do cliente
        db.query(
            "UPDATE clientes SET cashback = cashback + ? WHERE telefone = ?",
            [valor, telefone],
            (err) => {
                if (err) return res.status(500).json({ error: err.message });

                // ✅ Salvar a transação no histórico
                db.query(
                    "INSERT INTO transacoes (telefone, tipo, valor, data) VALUES (?, 'adicionado', ?, NOW())",
                    [telefone, valor],
                    (err) => {
                        if (err) return res.status(500).json({ error: err.message });

                        res.json({
                            message: `Cashback de R$${valor} adicionado com sucesso!`
                        });
                    }
                );
            }
        );
    });
});




// 🟢 Rota para consultar o saldo de cashback de um cliente
app.get("/clientes/:telefone/cashback", (req, res) => {
    const { telefone } = req.params;

    db.query("SELECT cashback FROM clientes WHERE telefone = ?", [telefone], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        if (result.length === 0) {
            return res.status(404).json({ message: "Cliente não encontrado" });
        }

        res.json({ telefone, cashback: result[0].cashback });
    });
});

// 🟢 Rota para usar saldo de cashback e salvar no histórico
app.post("/clientes/:telefone/use-cashback", (req, res) => {
    const { telefone } = req.params;
    const { valor } = req.body;

    db.query("SELECT cashback FROM clientes WHERE telefone = ?", [telefone], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        if (result.length === 0) {
            return res.status(404).json({ message: "Cliente não encontrado" });
        }

        const saldoAtual = Number(result[0].cashback) || 0;

        if (saldoAtual < valor) {
            return res.status(400).json({ message: "Saldo insuficiente para usar esse cashback." });
        }

        // Atualiza o saldo do cliente
        db.query(
            "UPDATE clientes SET cashback = cashback - ? WHERE telefone = ?",
            [valor, telefone],
            (err) => {
                if (err) return res.status(500).json({ error: err.message });

                // ✅ Salvar a transação no histórico
                db.query(
                    "INSERT INTO transacoes (telefone, tipo, valor, data) VALUES (?, 'usado', ?, NOW())",
                    [telefone, valor],
                    (err) => {
                        if (err) return res.status(500).json({ error: err.message });

                        res.json({
                            message: `Cashback de R$${valor} usado com sucesso! Saldo restante: R$ ${(saldoAtual - valor).toFixed(2)}`
                        });
                    }
                );
            }
        );
    });
});



// 🟢 Rota para obter o total de cashback disponível no sistema
app.get("/dashboard", (req, res) => {
    db.query("SELECT SUM(cashback) AS total FROM clientes", (err, result) => {
        if (err) {
            console.error("Erro ao buscar total de cashback:", err);
            return res.status(500).json({ error: "Erro no servidor ao buscar total de cashback." });
        }

        const totalCashback = result[0].total || 0; // Se for null, retorna 0
        console.log("Total de cashback no sistema:", totalCashback); // Log para debug

        res.json({ total: totalCashback });
    });
});


// 🟢 Rota para buscar o histórico de transações de um cliente
app.get("/clientes/:telefone/transacoes", (req, res) => {
    const { telefone } = req.params;

    db.query("SELECT * FROM transacoes WHERE telefone = ? ORDER BY data DESC", [telefone], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        // ✅ Convertendo `valor` para número para evitar erros no frontend
        const transacoesFormatadas = result.map(transacao => ({
            ...transacao,
            valor: Number(transacao.valor) // Garante que `valor` é numérico
        }));

        res.json(transacoesFormatadas);
    });
});

const twilio = require("twilio");

// 🟢 Rota para buscar todos os clientes e seus saldos
app.get("/clientes", (req, res) => {
    db.query("SELECT nome, email, telefone, cashback FROM clientes", (err, result) => {
        if (err) {
            console.error("Erro ao buscar clientes:", err);
            return res.status(500).json({ error: "Erro no servidor ao buscar clientes." });
        }
        res.json(result);
    });
});

// 🟢 Rota para atualizar informações do cliente (nome, telefone, email, saldo)
app.put("/clientes/:telefone", (req, res) => {
    const { telefone } = req.params;
    const { novoNome, novoTelefone, novoEmail, novoSaldo } = req.body;

    db.query("SELECT * FROM clientes WHERE telefone = ?", [telefone], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        if (result.length === 0) {
            return res.status(404).json({ message: "Cliente não encontrado" });
        }

        // Pega os valores antigos caso algum campo não seja preenchido
        const cliente = result[0];

        const nomeFinal = novoNome || cliente.nome;
        const telefoneFinal = novoTelefone || cliente.telefone;
        const emailFinal = novoEmail || cliente.email;
        const saldoFinal = novoSaldo !== undefined ? novoSaldo : cliente.cashback;

        db.query(
            "UPDATE clientes SET nome = ?, telefone = ?, email = ?, cashback = ? WHERE telefone = ?",
            [nomeFinal, telefoneFinal, emailFinal, saldoFinal, telefone],
            (err) => {
                if (err) return res.status(500).json({ error: err.message });

                res.json({ message: "Cliente atualizado com sucesso!" });
            }
        );
    });
});

// 🟢 Rota para excluir um cliente e todas as suas transações
app.delete("/clientes/:telefone", (req, res) => {
    const { telefone } = req.params;

    // Primeiro, remover as transações associadas ao cliente
    db.query("DELETE FROM transacoes WHERE telefone = ?", [telefone], (err) => {
        if (err) {
            console.error("Erro ao deletar transações:", err);
            return res.status(500).json({ error: "Erro ao deletar transações do cliente." });
        }

        // Depois, remover o próprio cliente
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


// 🟢 Insira suas credenciais Twilio aqui
const accountSid = "AC6762393df4e55d32400274251f0b5d73";
const authToken = "d144c69d9d4dc724a73cd23ec267180b";
const twilioNumber = "+14155238886";

// Inicializa o cliente do Twilio
const client = twilio(accountSid, authToken);

// Função para enviar mensagem no WhatsApp via Twilio

// 🟢 Enviar mensagem no mesmo dia em que o cliente recebe cashback
app.post("/clientes/:telefone/cashback", (req, res) => {
    const { telefone } = req.params;
    const { valor } = req.body;

    db.query("SELECT * FROM clientes WHERE telefone = ?", [telefone], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        if (result.length === 0) {
            return res.status(404).json({ message: "Cliente não encontrado" });
        }

        db.query(
            "UPDATE clientes SET cashback = cashback + ? WHERE telefone = ?",
            [valor, telefone],
            (err) => {
                if (err) return res.status(500).json({ error: err.message });

                // ✅ Enviar mensagem no mesmo dia
                const mensagem = `Oi! Você recebeu R$${valor.toFixed(2)} de cashback! 🎉`;
                enviarMensagemWhatsApp(telefone, mensagem);

               
                

                res.json({ message: `Cashback de R$${valor} adicionado e mensagem enviada!` });
            }
        );
    });
});

const enviarMensagemWhatsApp = async (telefone, mensagem) => {
    const twilio = require("twilio");

    const client = twilio(accountSid, authToken);

    try {
        const response = await client.messages.create({
            body: mensagem,
            from: `whatsapp:${twilioNumber}`,
            to: `whatsapp:+55${telefone}` // ✅ Garante que está no formato correto
        });

        console.log(`📩 Mensagem enviada para ${telefone}: ${mensagem}`);
        return response.sid;
    } catch (error) {
        console.error("❌ Erro ao enviar mensagem:", error.message);
        return null;
    }
};


// Chamar a função de teste
enviarMensagemWhatsApp("12991332677", "🔍 Teste: Se você recebeu essa mensagem, o Twilio está funcionando!");

const cron = require("node-cron");

// ✅ Agendar mensagem a cada 1 minuto (Para Testes) - Depois mude para "0 9 */10 * *" para cada 10 dias
cron.schedule("0 0 */10 * *", async () => {
    console.log("⏳ [CRON] Executando verificação de cashback...");

    db.query("SELECT nome, telefone, cashback FROM clientes WHERE cashback > 0", (err, results) => {
        if (err) {
            console.error("❌ [ERRO] Falha ao buscar clientes:", err);
            return;
        }

        if (results.length === 0) {
            console.log("ℹ️ [CRON] Nenhum cliente com cashback para notificação.");
            return;
        }

        results.forEach(cliente => {
            const nome = cliente.nome;
            const telefone = cliente.telefone;
            const saldo = Number(cliente.cashback || 0).toFixed(2);

            const mensagem = `Oi ${nome}! Você tem R$${saldo} de cashback disponível para gastar na Outlet! 💰`;

            console.log(`📩 [CRON] Enviando mensagem para ${telefone}: ${mensagem}`);
            enviarMensagemWhatsApp(telefone, mensagem)
                .then(() => console.log(`✅ [CRON] Mensagem enviada para ${telefone}`))
                .catch(error => console.error("❌ [ERRO] Falha ao enviar mensagem:", error.message));
        });
    });
});


// Função para obter o IP da máquina onde o servidor está rodando
const getLocalIP = () => {
    const interfaces = os.networkInterfaces();
    for (const interfaceName in interfaces) {
        for (const iface of interfaces[interfaceName]) {
            if (iface.family === "IPv4" && !iface.internal) {
                return iface.address;
            }
        }
    }
    return "IP não encontrado";
};

// Função para iniciar Ngrok automaticamente ao rodar o servidor
(async function startNgrok() {
    try {
      const url = await ngrok.connect(port);
      console.log(`🚀 Backend disponível em: ${url}`);
    } catch (error) {
      console.error("❌ Erro ao iniciar o Ngrok:", error);
    }
  })();

// Iniciar o servidor e exibir o IP no console
app.listen(port, () => {
    console.log(`🚀 Servidor rodando na porta ${port}`);
    console.log(`🌍 IP do servidor: ${getLocalIP()}`);
});
