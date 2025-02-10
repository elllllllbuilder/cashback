# Documentação Completa do Cashback App

## 1. Visão Geral
O **Cashback App** é um sistema de gestão de cashback para lojas físicas, onde administradores podem registrar clientes, adicionar saldo de cashback, permitir o uso do saldo acumulado e visualizar o histórico de transações. O sistema também possui um painel administrativo com relatórios e funcionalidades de gestão de clientes.

## 2. Tecnologias Utilizadas
### **Front-end:**
- **Linguagem:** JavaScript (React.js)
- **Bibliotecas:**
  - React Router Dom (Gerenciamento de rotas)
  - Axios (Requisições HTTP)
  - React Bootstrap (Componentes estilizados)
  - CSS personalizado
- **Hospedagem:** Netlify

### **Back-end:**
- **Linguagem:** Node.js (Express.js)
- **Banco de Dados:** MySQL
- **Bibliotecas:**
  - bcryptjs (Hash de senhas)
  - jsonwebtoken (Autenticação via JWT)
  - express-validator (Validação de dados)
- **Hospedagem:** Railway

## 3. Funcionalidades do Sistema

### **3.1. Autenticação e Controle de Acesso**
- Login de administradores com e-mail e senha
- Proteção de rotas com JWT
- Logout seguro

### **3.2. Cadastro e Gerenciamento de Clientes**
- Consulta de clientes pelo telefone
- Cadastro de novos clientes (nome, telefone e e-mail)
- Edição de dados do cliente
- Exclusão de clientes

### **3.3. Cashback**
- Adicionar saldo de cashback ao cliente
- Permitir o uso do saldo acumulado
- Visualização do histórico de transações
- Cálculo e exibição do total de cashback no sistema

### **3.4. Dashboard Administrativo**
- Exibição do total de cashback disponível
- Listagem de clientes cadastrados
- Busca por nome ou telefone
- Ações rápidas (editar, excluir e consultar saldo)

### **3.5. Integração com WhatsApp**
- Botão para notificar clientes sobre o saldo pelo WhatsApp

## 4. Como Modificar o Sistema

### **4.1. Modificar a Interface**
- Os arquivos do front-end estão na pasta **frontend/src**
- A navbar e layout estão no **Navbar.jsx**
- As telas principais estão na pasta **pages/**

### **4.2. Modificar Funcionalidades**
- O back-end está estruturado em **server.js** e os controladores estão na pasta **controllers/**
- Para alterar regras de negócio, edite os endpoints em **routes/**
- Para modificar o banco de dados, acesse **database.js**

### **4.3. Adicionar um Novo Administrador**
1. Acesse o MySQL e use o seguinte comando para inserir um administrador:
   ```sql
   INSERT INTO administradores (email, senha, nome) VALUES ('novo@email.com', 'SENHA_HASH', 'Nome Admin');
   ```
2. Gere o hash da senha usando bcryptjs (https://bcrypt-generator.com/) antes de salvar.

## 5. URLs e Credenciais
- **Front-end:**  https://app.netlify.com/
- **Back-end:** https://railway.com/
- **Banco de Dados:** MySQL no Godaddy
- **Senha das Outlets:** loja@outlet.com / 1234

→ Aplicação dominio padrão: https://endearing-heliotrope-d1777c.netlify.app/
→ Aplicação dominio oficial: https://app.backcash.site/
→ Site: https://backcash.online/

