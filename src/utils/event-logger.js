/**
 * event-logger.js
 * Registra e exibe eventos do sistema no painel de log.
 * @author Alberto Luiz
 */

const EventLogger = (() => {

  const MAX_LOGS = 50;
  let logs       = [];
  let container  = null;

  /**
   * Inicializa o logger buscando o elemento do DOM.
   * Deve ser chamado após o DOMContentLoaded.
   */
  function init() {
    container = document.getElementById('event-log');
  }

  /**
   * Adiciona um novo evento ao log e atualiza o painel.
   * @param {string} event - Mensagem do evento
   */
  function add(event) {
    const timestamp = new Date().toLocaleTimeString('pt-BR');

    logs.unshift({ timestamp, event });   // mais recente primeiro

    if (logs.length > MAX_LOGS) {
      logs.pop();                          // limita a 50 entradas
    }

    _render();
  }

  /**
   * Limpa todos os logs do painel.
   */
  function clear() {
    logs = [];
    _render();
  }

  /**
   * Renderiza a lista de logs no DOM.
   * @private
   */
  function _render() {
    if (!container) return;

    container.innerHTML = logs
      .map(l => `
        <li>
          <span class="log-time">${l.timestamp}</span>
          <span class="log-event">${l.event}</span>
        </li>
      `)
      .join('');
  }

  return { init, add, clear };

})();