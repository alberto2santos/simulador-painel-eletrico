/**
 * fault-simulator.js
 * Simula falhas elétricas como sobrecarga e curto-circuito.
 * @author Alberto Luiz
 */

const FaultSimulator = (() => {

  const LIMITS = {
    overload:    26,   // Ampères — acima disso dispara sobrecarga
    shortCircuit: 210,  // Ampères — acima disso dispara curto-circuito
  };

  /**
   * Verifica se a corrente atual ultrapassa o limite de sobrecarga.
   * @param {number} currentValue - Corrente atual em Ampères
   * @param {number} limit - Limite de disparo (padrão: 15A)
   * @returns {{ fault: boolean, type?: string, message?: string }}
   */
  function checkOverload(currentValue, limit = LIMITS.overload) {
    if (currentValue >= LIMITS.shortCircuit) {
      return {
        fault:   true,
        type:    'CURTO-CIRCUITO',
        message: 'Corrente crítica detectada! Proteção acionada imediatamente.',
      };
    }
    if (currentValue > limit) {
      return {
        fault:   true,
        type:    'SOBRECARGA',
        message: 'Corrente acima do limite nominal. Motor desligado por proteção.',
      };
    }
    return { fault: false };
  }

  return { checkOverload };

})();