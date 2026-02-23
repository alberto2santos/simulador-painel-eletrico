/**
 * chart-controller.js
 * Gerencia a instância do Chart.js e as atualizações do gráfico.
 * @author Alberto Luiz
 */

const ChartController = (() => {

  let chartInstance = null;

  const CHART_CONFIG = {
    borderColor:       '#4a9eff',
    peakColor:         'rgba(255, 152, 0, 0.9)',
    nominalColor:      'rgba(74, 158, 255, 0.9)',
    fillGradientStart: 'rgba(74, 158, 255, 0.3)',
    fillGradientEnd:   'rgba(74, 158, 255, 0.0)',
  };

  /**
   * Inicializa o gráfico com dados vazios (estado parado).
   */
  function init() {
    const ctx = document.getElementById('currentChart').getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, CHART_CONFIG.fillGradientStart);
    gradient.addColorStop(1, CHART_CONFIG.fillGradientEnd);

    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: SimulatorEngine.generateTimeLabels(),
        datasets: [{
          label: 'Corrente (A)',
          data: new Array(60).fill(0),
          borderColor: CHART_CONFIG.borderColor,
          backgroundColor: gradient,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.4,
          fill: true,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 1200,
          easing: 'easeInOutCubic',
        },
        interaction: {
          intersect: false,
          mode: 'index',
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f1923',
            borderColor: '#1e3a5a',
            borderWidth: 1,
            titleColor: '#4a9eff',
            bodyColor: '#e0f0ff',
            titleFont: { family: 'Share Tech Mono', size: 11 },
            bodyFont:  { family: 'Share Tech Mono', size: 12 },
            callbacks: {
              label: ctx => ` ${ctx.parsed.y.toFixed(1)} A`,
            },
          },
        },
        scales: {
          x: {
            grid:  { color: 'rgba(30,58,90,0.5)', lineWidth: 0.5 },
            ticks: { color: '#3a5a7a', font: { family: 'Share Tech Mono', size: 10 }, maxTicksLimit: 10 },
          },
          y: {
            beginAtZero: true,
            suggestedMax: 180,
            grid:  { color: 'rgba(30,58,90,0.5)', lineWidth: 0.5 },
            ticks: {
              color: '#3a5a7a',
              font: { family: 'Share Tech Mono', size: 10 },
              callback: val => `${val}A`,
            },
          },
        },
      },
    });
  }

  /**
   * Atualiza o gráfico com a curva de partida correta.
   * @param {'direct'|'star-triangle'} mode
   */
  function updateForStart(mode) {
    if (!chartInstance) return;

    const data = mode === 'star-triangle'
      ? SimulatorEngine.generateStarTriangleCurve()
      : SimulatorEngine.generateDirectStartCurve();

    const maxVal        = Math.max(...data);
    const peakThreshold = SimulatorEngine.MOTOR_PARAMS.nominalCurrent * 5;

    const pointColors = data.map(v =>
      v > peakThreshold ? CHART_CONFIG.peakColor : CHART_CONFIG.nominalColor
    );

    chartInstance.data.datasets[0].data                = data;
    chartInstance.data.datasets[0].pointBackgroundColor = pointColors;
    chartInstance.data.datasets[0].borderColor          = CHART_CONFIG.borderColor;
    chartInstance.options.scales.y.suggestedMax         = Math.ceil(maxVal * 1.1);
    chartInstance.update('active');
  }

  /**
   * Reseta o gráfico para o estado parado (linha em zero).
   */
  function reset() {
    if (!chartInstance) return;
    chartInstance.data.datasets[0].data         = new Array(60).fill(0);
    chartInstance.options.scales.y.suggestedMax = 180;
    chartInstance.update('default');
  }

  return { init, updateForStart, reset };

})();