const fs = require('fs');
const mensagens = require('../config.json').mensagensRespostas;

function responder(client, msg) {
    const texto = msg.body.toLowerCase();
    for (const chave in mensagens) {
        if (texto.includes(chave)) {
            msg.reply(mensagens[chave]);
            return;
        }
    }
}

module.exports = { responder };
