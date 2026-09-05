# API - E-commerce de Moda Fitness

API REST desenvolvida em Node.js com Express, Sequelize e MySQL para gerenciar as operações de um e-commerce de moda fitness.

## Tecnologias Utilizadas
- Node.js & Express
- Sequelize ORM (MySQL)
- Bcrypt (Criptografia de senhas)
- Dotenv (Gerenciamento de variáveis de ambiente)
- Nodemon (Desenvolvimento)

## Arquitetura (MVC)
O projeto segue o padrão arquitetural **MVC**:
- `controllers/`: Regras de negócio e lógica das rotas.
- `models/`: Definição das tabelas do banco de dados (Users, Products, Variants, Orders, OrderItems).
- `routes/`: Endpoints da API.
- `helpers/`: Validações e funções auxiliares.
- `db/`: Conexão com o banco de dados MySQL.

## Como Executar o Projeto

1. Clone o repositório:
   ```bash
   git clone <https://github.com/marytt1/api_web_10.git>
2. Instale as dependências:
   ```bash
   npm install
3. Crie um arquivo .env na raiz baseado nas suas configurações locais do MySQL:
   DB_NAME=loja_db   
   DB_USER=root    
   DB_PASSWORD=sua_senha    
   DB_HOST=localhost    
   DB_PORT=3306   
5. Inicie o servidor
   ```bash
   npm start
