const fs = require('fs');
const { parseISO, format, subHours, isBefore } = require('date-fns');

function agendarMensagens(client) {
    const pacientes = JSON.parse(fs.readFileSync('./pacientes.json', 'utf-8'));
    pacientes.forEach(paciente => {
        const dataConsulta = parseISO(paciente.data);
        const horarioEnvio = subHours(dataConsulta, 2);

        const delay = horarioEnvio.getTime() - Date.now();
        if (isBefore(new Date(), dataConsulta) && delay > 0) {
            setTimeout(() => {
                client.sendMessage(paciente.numero, `Olá ${paciente.nome}, lembrete da sua consulta às ${format(dataConsulta, 'HH:mm')}!`);
            }, delay);
        }
    });
}

module.exports = { agendarMensagens };
