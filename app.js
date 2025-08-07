const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const cron = require('node-cron');

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { args: ['--no-sandbox'] },
});

const usuariosAtendidos = new Set();

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

client.on('qr', async (qr) => {
  try {
    const qrImage = await qrcode.toDataURL(qr); // Converte o QR em base64
    console.log(qrImage); // Railway vai exibir como imagem automaticamente
  } catch (err) {
    console.error('Erro ao gerar QR Code:', err);
  }
});


client.on('ready', () => {
  console.log('🤖 Bot está pronto!');
});

client.on('message', async (message) => {
  const numero = message.from;
  const content = message.body.toLowerCase();

  // Envia mensagem de boas-vindas e formulário só no primeiro contato
  if (!usuariosAtendidos.has(numero)) {
    usuariosAtendidos.add(numero);

    await message.reply(
`👋 Olá! Seja bem-vindo(a) ao atendimento da clínica.

Você pode agendar sua consulta diretamente por aqui digitando:

*agendar Nome|Telefone|YYYY-MM-DD HH:MM*

📋 Ou, se preferir:
- Formulário de Paciente: https://forms.gle/YcXhsKHPF97aqQ7A8
- Formulário de Psicólogo Colaborador: https://forms.gle/95ArwknvsPdWipzp7`
    );
    return;
  }

  const hora = new Date().getHours();
  if (['oi', 'olá', 'bom dia', 'boa tarde', 'boa noite'].some(p => content.includes(p))) {
    if (hora < 12) return message.reply('🌅 Bom dia! Como posso ajudar?');
    if (hora < 18) return message.reply('☀️ Boa tarde! Precisa de ajuda com seu agendamento?');
    return message.reply('🌙 Boa noite! Fico à disposição para agendarmos sua consulta.');
  }

  if (content.startsWith('agendar')) {
    try {
      const [, dados] = content.split(' ');
      const [nome, telefone, dataHora] = dados.split('|');

      await pool.query(
        'INSERT INTO consultas (nome, telefone, datahora) VALUES ($1, $2, $3)',
        [nome, telefone, dataHora]
      );

      return message.reply(`✅ Consulta agendada para *${nome}* em *${dataHora}* com sucesso!`);
    } catch (err) {
      console.error('Erro ao agendar:', err);
      return message.reply('❌ Erro ao agendar. Use o formato: agendar Nome|Telefone|YYYY-MM-DD HH:MM');
    }
  }
});

// Lembrete automático 2h antes da consulta
cron.schedule('* * * * *', async () => {
  const agora = new Date();
  const daqui2h = new Date(agora.getTime() + 2 * 60 * 60 * 1000);
  const iso = daqui2h.toISOString().slice(0, 16);
  const dataFormatada = iso.replace('T', ' ');

  try {
    const { rows } = await pool.query(
      "SELECT * FROM consultas WHERE to_char(datahora, 'YYYY-MM-DD HH24:MI') = $1",
      [dataFormatada]
    );

    for (const consulta of rows) {
      const contato = consulta.telefone.replace(/\D/g, '') + '@c.us';
      const texto = `📅 Olá ${consulta.nome}, lembrete: sua consulta está agendada para hoje às ${new Date(consulta.datahora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
      await client.sendMessage(contato, texto);
      console.log(`✅ Lembrete enviado para ${consulta.nome}`);
    }
  } catch (err) {
    console.error('Erro ao enviar lembretes:', err);
  }
});

client.initialize();
client.on('disconnected', (reason) => {
  console.log('🤖 Bot desconectado:', reason);
  usuariosAtendidos.clear(); // Limpa o set de usuários atendidos
  client.initialize(); // Re-inicializa o cliente
});