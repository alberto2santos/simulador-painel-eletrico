/**
 * motor-controller.js
 * Controla a animação visual do motor (rotação e estados visuais).
 */

const MotorController = (() => {

  const rotor       = document.getElementById('rotor');
  const motorSvg    = document.getElementById('motorSvg');
  const motorGlow   = document.getElementById('motorGlow');
  const stateLabel  = document.getElementById('motorStateLabel');

  let rotationAngle = 0;
  let animationId   = null;
  let currentSpeed  = 0;
  let targetSpeed   = 0;
  const MAX_SPEED   = 6; // graus por frame

  /**
   * Loop de animação suave com aceleração/desaceleração.
   */
  function animationLoop() {
    // Interpola velocidade suavemente (efeito de inércia)
    currentSpeed += (targetSpeed - currentSpeed) * 0.04;

    if (currentSpeed > 0.05) {
      rotationAngle = (rotationAngle + currentSpeed) % 360;
      rotor.setAttribute('transform', `translate(100, 100) rotate(${rotationAngle})`);
    }

    animationId = requestAnimationFrame(animationLoop);
  }

  /**
   * Liga o motor — inicia a animação com aceleração gradual.
   */
  function start() {
    targetSpeed = MAX_SPEED;
    motorSvg.classList.add('running');
    motorGlow.classList.add('active');
    stateLabel.textContent = '● OPERANDO';
    stateLabel.className = 'motor-state-label running';
  }

  /**
   * Modo de partida estrela (velocidade reduzida).
   */
  function startStar() {
    targetSpeed = MAX_SPEED * 0.58;
    motorSvg.classList.add('running');
    motorGlow.classList.add('active');
    stateLabel.textContent = '◑ PARTIDA Y';
    stateLabel.className = 'motor-state-label starting';
  }

  /**
   * Transição estrela → triângulo (velocidade plena).
   */
  function switchToTriangle() {
    targetSpeed = MAX_SPEED;
    stateLabel.textContent = '● OPERANDO Δ';
    stateLabel.className = 'motor-state-label running';
  }

  /**
   * Para o motor — desaceleração suave até zerar.
   */
  function stop() {
    targetSpeed = 0;
    motorSvg.classList.remove('running');
    motorGlow.classList.remove('active');
    stateLabel.textContent = '● PARADO';
    stateLabel.className = 'motor-state-label';

    // Aguarda a inércia cessar e cancela o loop
    setTimeout(() => {
      if (targetSpeed === 0) {
        cancelAnimationFrame(animationId);
        animationId = null;
        currentSpeed = 0;
      }
    }, 3000);
  }

  /**
   * Inicializa o loop de animação em standby.
   */
  function init() {
    animationLoop();
  }

  return { init, start, startStar, switchToTriangle, stop };

})();