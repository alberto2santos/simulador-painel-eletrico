/**
 * simulator.js
 * Contém a lógica de simulação de corrente para
 * partida Direta e Estrela-Triângulo.
 */

const SimulatorEngine = (() => {

  /**
   * Parâmetros base do motor simulado (15 CV / 11 kW, 380V)
   */
  const MOTOR_PARAMS = {
    nominalCurrent:  21.0,   // Ampères
    nominalPower:    11.0,   // kW
    voltage:         380,    // V
    directPeakRatio: 7,      // Pico = 7x a nominal na partida direta
    starPeakRatio:   2.5,    // Pico ~2.5x na partida estrela-triângulo
    rampUpTime:      2000,   // ms até estabilizar
    starToTriTime:   3000,   // ms para comutação estrela → triângulo
  };

  /**
   * Gera o perfil de corrente para partida DIRETA.
   * Simula a curva realista: pico alto → queda brusca → estabilização.
   * @param {number} points - Número de pontos do gráfico
   * @returns {number[]}
   */
  function generateDirectStartCurve(points = 60) {
    const { nominalCurrent, directPeakRatio } = MOTOR_PARAMS;
    const peak = nominalCurrent * directPeakRatio;
    const curve = [];

    for (let i = 0; i < points; i++) {
      const t = i / points;

      if (t < 0.05) {
        // Rampa de subida rápida
        curve.push(parseFloat((peak * (t / 0.05)).toFixed(2)));
      } else if (t < 0.15) {
        // Pico com leve oscilação
        const decay = 1 - ((t - 0.05) / 0.10) * 0.65;
        const noise = (Math.random() - 0.5) * 8;
        curve.push(parseFloat((peak * decay + noise).toFixed(2)));
      } else if (t < 0.35) {
        // Queda até nominal
        const progress = (t - 0.15) / 0.20;
        const val = peak * 0.35 - (peak * 0.35 - nominalCurrent) * progress;
        const noise = (Math.random() - 0.5) * 3;
        curve.push(parseFloat((val + noise).toFixed(2)));
      } else {
        // Regime nominal com pequena variação
        const noise = (Math.random() - 0.5) * 1.5;
        curve.push(parseFloat((nominalCurrent + noise).toFixed(2)));
      }
    }

    return curve;
  }

  /**
   * Gera o perfil de corrente para partida ESTRELA-TRIÂNGULO.
   * Inclui: pico na estrela → estabilização parcial → pico na comutação → nominal.
   * @param {number} points
   * @returns {number[]}
   */
  function generateStarTriangleCurve(points = 60) {
    const { nominalCurrent, starPeakRatio } = MOTOR_PARAMS;
    const starPeak = nominalCurrent * starPeakRatio;
    const switchPeak = nominalCurrent * 4.5; // Pico menor na comutação
    const curve = [];

    for (let i = 0; i < points; i++) {
      const t = i / points;

      if (t < 0.06) {
        // Subida inicial em estrela
        curve.push(parseFloat((starPeak * (t / 0.06)).toFixed(2)));
      } else if (t < 0.20) {
        // Operação em estrela, corrente ~60% nominal
        const starNominal = nominalCurrent * 0.6;
        const decay = 1 - ((t - 0.06) / 0.14) * 0.7;
        const noise = (Math.random() - 0.5) * 4;
        curve.push(parseFloat((starPeak * decay + noise).toFixed(2)));
      } else if (t < 0.25) {
        // Operação estabilizada em estrela
        const noise = (Math.random() - 0.5) * 2;
        curve.push(parseFloat((nominalCurrent * 0.58 + noise).toFixed(2)));
      } else if (t < 0.28) {
        // COMUTAÇÃO: queda momentânea + novo pico em triângulo
        const progress = (t - 0.25) / 0.03;
        const val = nominalCurrent * 0.58 + (switchPeak - nominalCurrent * 0.58) * Math.sin(progress * Math.PI);
        curve.push(parseFloat(val.toFixed(2)));
      } else if (t < 0.40) {
        // Amortecimento após comutação
        const decay = 1 - ((t - 0.28) / 0.12) * 0.78;
        const noise = (Math.random() - 0.5) * 3;
        curve.push(parseFloat((switchPeak * decay + noise).toFixed(2)));
      } else {
        // Regime nominal em triângulo
        const noise = (Math.random() - 0.5) * 1.2;
        curve.push(parseFloat((nominalCurrent + noise).toFixed(2)));
      }
    }

    return curve;
  }

  /**
   * Gera os labels de tempo para o eixo X do gráfico.
   * @param {number} points
   * @param {number} totalSeconds
   * @returns {string[]}
   */
  function generateTimeLabels(points = 60, totalSeconds = 10) {
    return Array.from({ length: points }, (_, i) =>
      `${((i / points) * totalSeconds).toFixed(1)}s`
    );
  }

  return {
    MOTOR_PARAMS,
    generateDirectStartCurve,
    generateStarTriangleCurve,
    generateTimeLabels,
  };

})();