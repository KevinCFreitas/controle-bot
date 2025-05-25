# Imagem base com Node.js e Chrome
FROM zenika/alpine-chrome:with-node

# Criar diretório de app
WORKDIR /app

# Copiar arquivos
COPY . .

# Instalar dependências
RUN npm install

# Expor a porta
EXPOSE 8000

# Comando para iniciar
CMD ["node", "app.js"]