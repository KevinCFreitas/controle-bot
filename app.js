const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode'); // gera base64 p/ exibir o QR no Railway
const { Pool } = require('pg');
const dotenv = require('dotenv');
const cron = require('node-cron');

dotenv.config();

// ===== DB (Postgres) =====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ===== WhatsApp Client =====
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
});

// Quem já recebeu boas-vindas
const usuariosAtendidos = new Set();

// Estado do fluxo guiado: numero -> { stage, nome, telefone, dataHora }
const fluxos = new Map();

// ===== QR Code em base64 no log (Railway renderiza como imagem) =====
client.on('qr', async (qr) => {
  try {
    const qrImage = await qrcode.toDataURL(qr);
    console.log(qrImage);
  } catch (err) {
    console.error('Erro ao gerar QR Code:', err);
  }
});

client.on('ready', () => {
  console.log('🤖 Bot está pronto!');
});

// ===== Util =====
const soNumeros = (s) => s.replace(/\D/g, '');
const formatoDataHoraValido = (s) => /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$/.test(s);

// ===== Mensagens =====
const msgBoasVindas = `
👋 Olá! Seja bem-vindo(a) ao atendimento da clínica.

Você pode agendar sua consulta de dois jeitos:

1) **Fluxo guiado (recomendado)**
   👉 Digite *agendar* e eu te guio passo a passo.

2) **Comando direto**
   ✍️ *agendar Nome|Telefone|YYYY-MM-DD HH:MM*

📋 Ou, se preferir preencher um formulário:
- Formulário de Paciente: https://forms.gle/WkTUb4GG6GLbA5HJ7
- Formulário de Psicólogo Colaborador: https://forms.gle/ea9ZxwVjqqiqGPhZ9
`.trim();

const msgAjudaFormato = `
📝 Para agendar por comando, use:
*agendar Nome|Telefone|YYYY-MM-DD HH:MM*

Exemplo:
agendar Maria Silva|55999999999|2025-08-12 15:00

Se preferir, digite apenas *agendar* que eu te guio passo a passo.
`.trim();

// ===== Handler principal =====
client.on('message', async (message) => {
  const numero = message.from;
  const texto = message.body.trim();
  const content = texto.toLowerCase();

  // Fluxo: cancelar
  if (content === 'cancelar') {
    if (fluxos.has(numero)) {
      fluxos.delete(numero);
      return message.reply('❎ Fluxo de agendamento cancelado. Quando quiser, digite *agendar* novamente.');
    }
  }

  // Primeira interação: manda boas-vindas uma única vez
  if (!usuariosAtendidos.has(numero)) {
    usuariosAtendidos.add(numero);
    await message.reply(msgBoasVindas);
    return;
  }

  // Respostas de saudação rápidas
  if (['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite'].some(p => content.includes(p))) {
    const hora = new Date().getHours();
    if (hora < 12) return message.reply('🌅 Bom dia! Como posso ajudar?');
    if (hora < 18) return message.reply('☀️ Boa tarde! Precisa de ajuda com seu agendamento?');
    return message.reply('🌙 Boa noite! Fico à disposição para agendarmos sua consulta.');
  }

  // ===== FLUXO GUIADO =====
  if (content === 'agendar') {
    fluxos.set(numero, { stage: 'nome' });
    return message.reply('✍️ Qual é o *seu nome completo*? (ou digite *cancelar* p/ sair)');
  }

  const fluxo = fluxos.get(numero);
  if (fluxo) {
    if (fluxo.stage === 'nome') {
      fluxo.nome = texto;
      fluxo.stage = 'telefone';
      return message.reply('📞 Agora me informe seu *telefone* (somente números).');
    }

    if (fluxo.stage === 'telefone') {
      const tel = soNumeros(texto);
      if (tel.length < 10) {
        return message.reply('⚠️ Telefone inválido. Envie somente números (DDD + número).');
      }
      fluxo.telefone = tel;
      fluxo.stage = 'data';
      return message.reply('📅 Ótimo! Envie a *data e hora* no formato: YYYY-MM-DD HH:MM\nEx: 2025-08-12 15:00');
    }

    if (fluxo.stage === 'data') {
      if (!formatoDataHoraValido(texto)) {
        return message.reply('⚠️ Formato inválido. Use: YYYY-MM-DD HH:MM (ex: 2025-08-12 15:00)');
      }

      fluxo.dataHora = texto;

      try {
        await pool.query(
          'INSERT INTO consultas (nome, telefone, datahora) VALUES ($1, $2, $3)',
          [fluxo.nome, fluxo.telefone, fluxo.dataHora]
        );
        fluxos.delete(numero);
        return message.reply(`✅ Consulta agendada para *${fluxo.nome}* em *${fluxo.dataHora}* com sucesso!`);
      } catch (err) {
        console.error('Erro ao agendar (fluxo):', err);
        fluxos.delete(numero);
        return message.reply('❌ Erro ao agendar. Pode tentar novamente digitando *agendar*.');
      }
    }
  }

  // ===== COMANDO DIRETO =====
  if (content.startsWith('agendar')) {
    const partes = texto.split(' ');
    if (partes.length < 2 || !partes[1].includes('|')) {
      return message.reply(msgAjudaFormato);
    }

    try {
      const [, dados] = texto.split(' ');
      const [nome, telefone, dataHora] = dados.split('|');

      if (!nome || !telefone || !dataHora) {
        return message.reply(msgAjudaFormato);
      }
      if (!formatoDataHoraValido(dataHora)) {
        return message.reply('⚠️ Data/hora inválidas. Use: YYYY-MM-DD HH:MM (ex: 2025-08-12 15:00)');
      }

      await pool.query(
        'INSERT INTO consultas (nome, telefone, datahora) VALUES ($1, $2, $3)',
        [nome.trim(), soNumeros(telefone), dataHora.trim()]
      );

      return message.reply(`✅ Consulta agendada para *${nome.trim()}* em *${dataHora.trim()}* com sucesso!`);
    } catch (err) {
      console.error('Erro ao agendar:', err);
      return message.reply('❌ Erro ao agendar. Use o formato: agendar Nome|Telefone|YYYY-MM-DD HH:MM');
    }
  }

  // Ajuda
  if (content === 'ajuda' || content === 'menu') {
    return message.reply(msgBoasVindas);
  }

  // Padrão
  return message.reply('❓ Não entendi. Digite *agendar* para iniciar o agendamento, ou *ajuda* para ver as opções.');
});

// ===== Lembrete automático 2h antes =====
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
      const contato = soNumeros(consulta.telefone) + '@c.us';
      const horaTxt = new Date(consulta.datahora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const texto = `📅 Olá ${consulta.nome}, lembrete: sua consulta está agendada para hoje às ${horaTxt}.`;
      await client.sendMessage(contato, texto);
      console.log(`✅ Lembrete enviado para ${consulta.nome}`);
    }
  } catch (err) {
    console.error('Erro ao enviar lembretes:', err);
  }
});

// ===== Reconectar se cair =====
client.on('disconnected', (reason) => {
  console.log('🤖 Bot desconectado:', reason);
  usuariosAtendidos.clear();
  client.initialize();
});

client.initialize();
