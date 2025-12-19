
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameStatus, Point } from './types';
import { 
  ROTATION_SPEED, 
  INITIAL_X_PERCENT,
  INITIAL_Y_PERCENT,
  GOAL_X_PERCENT,
  GOAL_Y_PERCENT,
  GOAL_RADIUS,
  GLIDER_WIDTH,
  GLIDER_HEIGHT,
  MAX_TRAIL_LENGTH,
  MIN_ANGLE,
  MAX_ANGLE,
  COLORS
} from './constants';
import { getCycloidPoints } from './utils';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number>(0);
  const keysPressed = useRef<Set<string>>(new Set());

  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [status, setStatus] = useState<GameStatus>(GameStatus.IDLE);
  const [finishTime, setFinishTime] = useState<number | null>(null);
  
  const [displayAngle, setDisplayAngle] = useState(0.4); 
  const [currentTotalV, setCurrentTotalV] = useState(0);

  const posRef = useRef<Point>({ x: 0, y: 0 });
  const angleRef = useRef<number>(0.4); 
  const trailRef = useRef<Point[]>([]);
  const startTimeRef = useRef<number>(0);
  const startYRef = useRef<number>(0);

  const getInitialPos = useCallback(() => ({
    x: dimensions.width * INITIAL_X_PERCENT,
    y: dimensions.height * INITIAL_Y_PERCENT
  }), [dimensions]);

  const getGoalPos = useCallback(() => ({
    x: dimensions.width * GOAL_X_PERCENT,
    y: dimensions.height * GOAL_Y_PERCENT
  }), [dimensions]);

  const initPositions = useCallback((resetAngle = true) => {
    const start = getInitialPos();
    posRef.current = { ...start };
    startYRef.current = start.y;
    if (resetAngle) {
      angleRef.current = 0.4;
      setDisplayAngle(0.4);
    }
    setCurrentTotalV(0);
    trailRef.current = [];
    setFinishTime(null);
  }, [getInitialPos]);

  useEffect(() => {
    initPositions(status === GameStatus.IDLE);
  }, [dimensions, initPositions]);

  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const startGame = () => {
    const start = getInitialPos();
    posRef.current = { ...start };
    startYRef.current = start.y;
    trailRef.current = [];
    setFinishTime(null);
    startTimeRef.current = Date.now();
    setStatus(GameStatus.FLYING);
  };

  const resetToIdle = () => {
    setStatus(GameStatus.IDLE);
    initPositions(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (status === GameStatus.SUCCESS) resetToIdle();
        else if (status === GameStatus.IDLE) startGame();
        else resetToIdle();
      }
      keysPressed.current.add(e.code);
    };
    const handleKeyUp = (e: KeyboardEvent) => keysPressed.current.delete(e.code);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [status, initPositions]);

  const updatePhysics = () => {
    // 시작 전 및 비행 중 각도 조절 (Momentum 방향 결정)
    if (status === GameStatus.IDLE || status === GameStatus.FLYING) {
      const sens = status === GameStatus.IDLE ? 0.5 : 1.0;
      if (keysPressed.current.has('ArrowLeft')) angleRef.current += ROTATION_SPEED * sens;
      if (keysPressed.current.has('ArrowRight')) angleRef.current -= ROTATION_SPEED * sens;
      angleRef.current = Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, angleRef.current));
      setDisplayAngle(angleRef.current);
    }

    if (status !== GameStatus.FLYING) return;

    // 1. 에너지 보존 법칙 적용 (Potential Energy -> Kinetic Energy)
    // 중력 상수 g를 조절하여 전체적인 속도 밸런스를 맞춤 (0.4)
    const g = 0.42; 
    const deltaY = Math.max(0, posRef.current.y - startYRef.current);
    
    // v = sqrt(2gh). 초기 속도 0.8 부여
    const velocityMagnitude = Math.sqrt(2 * g * deltaY) + 0.8;
    setCurrentTotalV(velocityMagnitude);

    // 2. 각도에 따른 속도 벡터 투영 (Momentum Projection)
    // theta=0 일 때 수평(왼쪽), theta=PI/2 일 때 수직(아래)
    const theta = angleRef.current;
    
    // vx = v * cos(theta), vy = v * sin(theta)
    // 강하를 통해 얻은 큰 v값이 theta가 작아질수록 vx에 집중됨 (속도 이점)
    const vx = -velocityMagnitude * Math.cos(theta); 
    const vy = velocityMagnitude * Math.sin(theta);

    // 3. 위치 업데이트
    posRef.current.x += vx;
    posRef.current.y += vy;

    trailRef.current.push({ ...posRef.current });
    if (trailRef.current.length > MAX_TRAIL_LENGTH) trailRef.current.shift();

    // 4. 충돌 검사
    const goal = getGoalPos();
    const distToGoal = Math.sqrt(
      Math.pow(posRef.current.x - goal.x, 2) + Math.pow(posRef.current.y - goal.y, 2)
    );

    if (distToGoal < GOAL_RADIUS) {
      setFinishTime((Date.now() - startTimeRef.current) / 1000);
      setStatus(GameStatus.SUCCESS);
    } else if (
      posRef.current.x < -200 || posRef.current.x > dimensions.width + 200 ||
      posRef.current.y > dimensions.height + 200 || posRef.current.y < -200
    ) {
      resetToIdle();
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    const goal = getGoalPos();
    const start = getInitialPos();
    
    // 이론적 사이클로이드 가이드 (Brachistochrone)
    const cycloidGuide = getCycloidPoints(start, goal, 120);
    ctx.beginPath();
    ctx.setLineDash([5, 10]);
    ctx.strokeStyle = COLORS.CYAN;
    ctx.globalAlpha = 0.15;
    ctx.lineWidth = 1;
    ctx.moveTo(cycloidGuide[0].x, cycloidGuide[0].y);
    cycloidGuide.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // 목표 지점
    ctx.beginPath();
    ctx.arc(goal.x, goal.y, GOAL_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.EMERALD;
    ctx.lineWidth = 2;
    ctx.setLineDash([2, 2]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLORS.EMERALD;
    ctx.font = '900 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TARGET_ZONE', goal.x, goal.y + 5);

    // 비행 궤적
    if (trailRef.current.length > 1) {
      ctx.beginPath();
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const grad = ctx.createLinearGradient(start.x, start.y, goal.x, goal.y);
      grad.addColorStop(0, COLORS.PURPLE);
      grad.addColorStop(1, COLORS.CYAN);
      ctx.strokeStyle = grad;
      ctx.moveTo(trailRef.current[0].x, trailRef.current[0].y);
      for (let i = 1; i < trailRef.current.length; i++) {
        ctx.lineTo(trailRef.current[i].x, trailRef.current[i].y);
      }
      ctx.stroke();
    }

    // 글라이더 렌더링
    ctx.save();
    ctx.translate(posRef.current.x, posRef.current.y);
    ctx.rotate(Math.PI - angleRef.current);
    
    // 속도에 따른 글로우 효과
    ctx.shadowBlur = status === GameStatus.FLYING ? 10 + currentTotalV : 10;
    ctx.shadowColor = COLORS.CYAN;
    
    ctx.fillStyle = COLORS.WHITE;
    ctx.fillRect(-GLIDER_WIDTH/2, -GLIDER_HEIGHT/2, GLIDER_WIDTH, GLIDER_HEIGHT);
    
    // 헤드
    ctx.beginPath();
    ctx.moveTo(GLIDER_WIDTH/2, -GLIDER_HEIGHT/2);
    ctx.lineTo(GLIDER_WIDTH/2 + 15, 0);
    ctx.lineTo(GLIDER_WIDTH/2, GLIDER_HEIGHT/2);
    ctx.fill();

    if (status === GameStatus.FLYING) {
      // 운동 에너지 시각화 (제트)
      ctx.fillStyle = COLORS.CYAN;
      const thrust = (currentTotalV / 15) * 30;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(-GLIDER_WIDTH/2, -GLIDER_HEIGHT/2);
      ctx.lineTo(-GLIDER_WIDTH/2 - thrust - Math.random() * 5, 0);
      ctx.lineTo(-GLIDER_WIDTH/2, GLIDER_HEIGHT/2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  };

  const loop = useCallback(() => {
    updatePhysics();
    draw();
    requestRef.current = requestAnimationFrame(loop);
  }, [status, dimensions, displayAngle]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [loop]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#020617] text-slate-200 font-sans tracking-tight">
      <canvas ref={canvasRef} width={dimensions.width} height={dimensions.height} className="absolute inset-0" />

      {/* 대시보드 */}
      <div className="absolute top-10 left-10 p-8 bg-slate-900/40 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 w-80 shadow-2xl z-10 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>
        
        <div className="flex items-center gap-3 mb-8">
          <div className={`w-2 h-2 rounded-full ${status === GameStatus.FLYING ? 'bg-rose-500 animate-ping' : 'bg-cyan-500'}`}></div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Momentum Engine</h2>
        </div>

        <div className="space-y-8">
          <div>
            <div className="flex justify-between items-baseline mb-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Energy</span>
              <span className="text-3xl font-mono font-black text-white">{(currentTotalV * 10).toFixed(0)}</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-400 transition-all duration-100" style={{ width: `${Math.min(100, (currentTotalV / 25) * 100)}%` }}></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-950/60 rounded-2xl border border-white/5">
              <div className="text-[9px] text-slate-500 font-bold mb-1 uppercase tracking-tighter">Pitch Angle</div>
              <div className="text-xl font-mono font-bold text-slate-100">{(angleRef.current * (180/Math.PI)).toFixed(0)}°</div>
            </div>
            <div className="p-4 bg-slate-950/60 rounded-2xl border border-white/5">
              <div className="text-[9px] text-slate-500 font-bold mb-1 uppercase tracking-tighter">Glide Adv.</div>
              <div className="text-xl font-mono font-bold text-emerald-400">{(Math.cos(angleRef.current) * 100).toFixed(0)}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* 준비 화면 */}
      {status === GameStatus.IDLE && (
        <div className="absolute inset-x-0 bottom-24 flex items-center justify-center z-20">
          <div className="text-center bg-slate-900/80 backdrop-blur-2xl p-12 px-20 rounded-[4rem] border border-white/10 shadow-2xl scale-110">
            <h1 className="text-6xl font-black text-white italic tracking-tighter mb-4 uppercase leading-none">
              MOMENTUM<br/><span className="text-cyan-500">CONSERVATION</span>
            </h1>
            <p className="text-slate-400 text-[11px] font-medium leading-relaxed mb-10 uppercase tracking-[0.2em]">
              강하를 통해 에너지를 비축하고,<br/>
              <span className="text-white">수평 전환</span>으로 속도 이점을 극대화하세요.
            </p>
            <div className="flex flex-col items-center gap-6">
              <button 
                onClick={startGame}
                className="px-16 py-6 bg-white text-black font-black text-[11px] tracking-[0.6em] rounded-full hover:bg-cyan-400 transition-all shadow-2xl active:scale-95"
              >
                INITIALIZE (SPACE)
              </button>
              <div className="flex gap-4 text-[9px] font-bold text-slate-500 tracking-widest animate-pulse">
                <span>[←/→] ADJUST START PITCH</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 완료 화면 */}
      {status === GameStatus.SUCCESS && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#020617]/90 backdrop-blur-3xl z-50">
          <div className="text-center p-24">
            <div className="text-cyan-400 text-[10px] font-black tracking-[1em] mb-10 uppercase opacity-50">Mission Sequence Success</div>
            <div className="text-[12rem] font-mono font-black text-white leading-none tracking-tighter mb-16 drop-shadow-[0_0_50px_rgba(34,211,238,0.3)]">
              {finishTime?.toFixed(3)}s
            </div>
            <button 
              onClick={resetToIdle}
              className="px-16 py-6 border-2 border-white/20 text-white font-black text-xs tracking-[0.5em] rounded-full hover:bg-white hover:text-black transition-all uppercase"
            >
              Analyze & Re-Entry
            </button>
          </div>
        </div>
      )}

      {/* 워터마크 */}
      <div className="absolute bottom-10 w-full text-center opacity-10 select-none pointer-events-none">
        <div className="text-[10px] font-black tracking-[1.5em] text-slate-400 uppercase italic">Gravitational Potential • Kinetic Energy Transfer • Brachistochrone</div>
      </div>
    </div>
  );
};

export default App;
