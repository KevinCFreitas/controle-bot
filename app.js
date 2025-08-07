// app.js
const express = require('express');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

/* ========================
   Postgres (Railway)
   ======================== */
const isInternal =
  process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway.internal');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isInternal ? false : { rejectUnauthorized: false },
});

// Garante a tabela
async function ensureTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS consultas (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      telefone TEXT NOT NULL,
      turno TEXT NOT NULL,
      horario TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `;
  await pool.query(sql);
}

/* ========================
   WhatsApp Client
   ======================== */
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

let lastQrDataUrl = ''; // para a rota /qr

client.on('qr', async (qr) => {
  try {
    lastQrDataUrl = await qrcode.toDataURL(qr);
    console.log('⚠️  Escaneie este QR Code:');
    console.log(lastQrDataUrl); // aparece no log do Railway
  } catch (err) {
    console.error('Erro ao gerar QR Code:', err);
  }
});

client.on('ready', async () => {
  console.log('✅ WhatsApp conectado!');
  try {
    await ensureTable();
    console.log('🗄️  Tabela "consultas" verificada/ok.');
  } catch (e) {
    console.error('Erro ao garantir tabela:', e);
  }
});

client.on('disconnected', (reason) => {
  console.log('🔌 Bot desconectado:', reason);
  client.initialize();
});

client.initialize();

/* ========================
   Fluxo guiado de agendamento
   ======================== */

// estados por usuário
const sessions = new Map();

// horários disponíveis
const horarios = {
  manha: ['08:00', '09:00', '10:00', '11:00'],
  tarde: ['13:00', '14:00', '15:00', '16:00', '17:00'],
  noite: ['18:00', '19:00', '20:00', '21:00'],
};

const links = {
  paciente: 'https://forms.gle/WkTUb4GG6GLbA5HJ7',
  psicologo: 'https://forms.gle/ea9ZxwVjqqiqGPhZ9',
};

function limparNumero(n) {
  return (n || '').replace(/\D/g, '');
}

function inicioTexto() {
  return (
`👋 Olá! Seja bem-vindo(a) à *MindSync*.

Posso te ajudar a **agendar sua primeira sessão** agora mesmo.  
Basta enviar *agendar* para começarmos, ou escolha uma opção:

1️⃣ Sou *Paciente* (abrir formulário)  
2️⃣ Sou *Psicólogo(a)* (abrir formulário)  

Comandos úteis:
• *menu* – voltar ao início  
• *cancelar* – cancelar o agendamento atual`
  );
}

function textoTurnos() {
  return (
`Perfeito! Agora me diga qual turno você prefere:

1️⃣ *Manhã*  
2️⃣ *Tarde*  
3️⃣ *Noite*

Digite o número do turno.`
  );
}

function textoHorarios(turnoKey) {
  const items = horarios[turnoKey].map((h) => `▪ ${h}`).join('\n');
  const leg = turnoKey === 'manha' ? 'manhã' : turnoKey;
  return (
`Esses são os horários disponíveis *à ${leg}* nesta semana:

${items}

Digite o *horário exato* (ex.: 14:00).`
  );
}

client.on('message', async (message) => {
  const chatId = message.from;
  const body = (message.body || '').trim();
  const lower = body.toLowerCase();

  // atalhos sempre disponíveis
  if (lower === 'menu') return message.reply(inicioTexto());
  if (lower === 'cancelar') {
    sessions.delete(chatId);
    return message.reply('❌ Agendamento cancelado. Se quiser recomeçar, digite *agendar*.');
  }

  // atalhos para formulários
  if (lower === '1' || lower.includes('paciente')) {
    return message.reply(
      `📝 Formulário do *Paciente*: ${links.paciente}\n\nSe preferir, digite *agendar* para realizar o agendamento por aqui mesmo.`
    );
  }
  if (lower === '2' || lower.includes('psicólogo') || lower.includes('psicologo')) {
    return message.reply(
      `🧑‍⚕️ Formulário do *Psicólogo(a)*: ${links.psicologo}\n\nSe quiser falar com a gente por aqui, posso te ajudar 😉`
    );
  }

  // início do fluxo guiado
  if (lower === 'agendar' || ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite'].some(w => lower.includes(w))) {
    sessions.set(chatId, { step: 'nome' });
    return message.reply(
      `Ótimo! Vamos agendar sua sessão 😊\n\nQual é o seu *nome completo*?`
    );
  }

  // se já tem sessão aberta, seguimos no passo
  const sess = sessions.get(chatId);
  if (!sess) {
    // sem sessão em andamento → mostra menu
    return message.reply(inicioTexto());
  }

  // Máquina de estados simples
  try {
    if (sess.step === 'nome') {
      if (body.length < 3) return message.reply('Pode me dizer seu *nome completo*, por favor?');
      sess.nome = body;
      sess.step = 'telefone';
      return message.reply(`Valeu, *${sess.nome}*! 📱\nAgora me informe seu *telefone* (apenas números).`);
    }

    if (sess.step === 'telefone') {
      const digits = limparNumero(body);
      if (digits.length < 10 || digits.length > 13) {
        return message.reply('Hmm, esse telefone parece inválido. Envie apenas números (ex.: 11987654321).');
      }
      sess.telefone = digits;
      sess.step = 'turno';
      return message.reply(textoTurnos());
    }

    if (sess.step === 'turno') {
      let turnoKey = null;
      if (['1', 'manha', 'manhã'].includes(lower)) turnoKey = 'manha';
      if (['2', 'tarde'].includes(lower)) turnoKey = 'tarde';
      if (['3', 'noite'].includes(lower)) turnoKey = 'noite';
      if (!turnoKey) return message.reply('Por favor, digite *1*, *2* ou *3* para escolher o turno.');

      sess.turno = turnoKey;
      sess.step = 'horario';
      return message.reply(textoHorarios(turnoKey));
    }

    if (sess.step === 'horario') {
      const h = body;
      const lista = horarios[sess.turno];
      if (!lista.includes(h)) {
        return message.reply(`Esse horário não está na lista. Escolha um dos horários informados.\n\n${textoHorarios(sess.turno)}`);
      }
      sess.horario = h;
      sess.step = 'confirmar';
      return message.reply(
        `Confere pra mim, por favor:\n\n👤 *Nome:* ${sess.nome}\n📱 *Telefone:* ${sess.telefone}\n🕒 *Turno:* ${sess.turno}\n⏰ *Horário:* ${sess.horario}\n\nSe estiver tudo certo, responda *confirmar*.\nPara alterar, responda *cancelar* e comece novamente.`
      );
    }

    if (sess.step === 'confirmar') {
      if (lower !== 'confirmar') {
        return message.reply('Para concluir, responda *confirmar* ou *cancelar* para recomeçar.');
      }

      // salva no banco
      await pool.query(
        'INSERT INTO consultas (nome, telefone, turno, horario) VALUES ($1, $2, $3, $4)',
        [sess.nome, sess.telefone, sess.turno, sess.horario]
      );

      sessions.delete(chatId);

      return message.reply(
        `✅ *Agendamento confirmado!*\n\n👤 ${sess.nome}\n📱 ${sess.telefone}\n🕒 ${sess.turno}\n⏰ ${sess.horario}\n\nNossa equipe vai te chamar por aqui para finalizar os detalhes. Qualquer coisa, digite *menu*.`
      );
    }

    // fallback
    return message.reply('Não entendi. Digite *menu* para ver as opções ou *agendar* para começar.');
  } catch (err) {
    console.error('Erro no fluxo:', err);
    sessions.delete(chatId);
    return message.reply('😅 Opa, algo deu errado aqui. Tente digitar *agendar* de novo ou *menu*.');
  }
});

/* ========================
   Servidor para /qr
   ======================== */
const app = express();
app.get('/qr', (_req, res) => {
  if (!lastQrDataUrl) {
    return res.status(200).send('QR Code ainda não gerado. Aguarde e atualize.');
  }
  const html = `
    <html>
      <body style="display:flex;height:100vh;align-items:center;justify-content:center;background:#111;color:#eee;font-family:sans-serif">
        <div style="text-align:center">
          <h2>Escaneie o QR Code no WhatsApp</h2>
          <img src="${lastQrDataUrl}" style="width:300px;height:300px;border:8px solid #222;border-radius:12px" />
          <p style="opacity:.7">Se expirar, reinicie o deploy ou aguarde novo QR aparecer nos logs.</p>
        </div>
      </body>
    </html>
  `;
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`🌐 Web ativo em porta ${PORT}. Veja o QR em /qr`);
});
