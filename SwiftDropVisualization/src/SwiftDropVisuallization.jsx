import { useState, useEffect } from 'react';
import { Map, Truck, AlertTriangle, Package, Crosshair, Navigation, Activity, Shield } from 'lucide-react';
import './SwiftDropVisualization.css'; // We'll create this CSS file

export default function SwiftDropVisualization() {
  const [dronePosition, setDronePosition] = useState({ x: 50, y: 50 });
  const [threats, setThreats] = useState([
    { id: 1, x: 30, y: 70, type: 'jamming', active: true },
    { id: 2, x: 70, y: 30, type: 'physical', active: false },
  ]);
  const [supplies, setSupplies] = useState([
    { id: 1, x: 20, y: 20, type: 'medical', delivered: false },
    { id: 2, x: 80, y: 80, type: 'ammo', delivered: false },
  ]);
  const [basePosition] = useState({ x: 10, y: 10 });
  const [destination] = useState({ x: 85, y: 85 });
  const [path, setPath] = useState([]);
  const [routeOptimization, setRouteOptimization] = useState(false);
  const [threatAnalysis, setThreatAnalysis] = useState(false);
  const [supplyTracking, setSupplyTracking] = useState(false);
  const [step, setStep] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [logs, setLogs] = useState([]);

  const addLog = (message) => {
    setLogs(prev => [...prev.slice(-4), message]);
  };

  const toggleThreat = (id) => {
    setThreats(threats.map(threat => 
      threat.id === id ? { ...threat, active: !threat.active } : threat
    ));
  };

  const activateThreat = () => {
    const inactiveThreat = threats.find(t => !t.active);
    if (inactiveThreat) {
      toggleThreat(inactiveThreat.id);
      addLog(`Alert: ${inactiveThreat.type} threat detected at sector ${inactiveThreat.x},${inactiveThreat.y}`);
      if (threatAnalysis) {
        addLog("AI Threat Analysis: Calculating optimal route diversion");
        recalculatePath();
      }
    }
  };

  const resetSimulation = () => {
    setDronePosition({ x: basePosition.x, y: basePosition.y });
    setStep(0);
    setSupplies(supplies.map(s => ({ ...s, delivered: false })));
    setLogs([]);
    recalculatePath();
    addLog("Mission initialized. Calculating optimal route.");
  };
  
  const recalculatePath = () => {
    const newPath = [];
    const start = { ...basePosition };
    newPath.push({ ...start });
    
    let currentPos = { ...start };
    const activeThreats = threats.filter(t => t.active);
    
    supplies.forEach(supply => {
      if (!supply.delivered) {
        const waypoints = generatePathToPoint(currentPos, supply, activeThreats);
        newPath.push(...waypoints);
        currentPos = { x: supply.x, y: supply.y };
      }
    });
    
    const finalPath = generatePathToPoint(currentPos, destination, activeThreats);
    newPath.push(...finalPath);
    
    setPath(newPath);
    return newPath;
  };
  
  const generatePathToPoint = (from, to, activeThreats) => {
    const waypoints = [];
    const delta = { x: to.x - from.x, y: to.y - from.y };
    const steps = Math.max(Math.abs(delta.x), Math.abs(delta.y));
    
    for (let i = 1; i <= steps; i++) {
      const ratio = i / steps;
      let x = from.x + delta.x * ratio;
      let y = from.y + delta.y * ratio;
      
      if (threatAnalysis) {
        activeThreats.forEach(threat => {
          const distance = Math.sqrt(Math.pow(x - threat.x, 2) + Math.pow(y - threat.y, 2));
          if (distance < 15) {
            const avoidAngle = Math.atan2(y - threat.y, x - threat.x);
            x = x + Math.cos(avoidAngle) * (15 - distance);
            y = y + Math.sin(avoidAngle) * (15 - distance);
          }
        });
      }
      
      waypoints.push({ x, y });
    }
    
    return waypoints;
  };

  const startSimulation = () => {
    setSimulationRunning(true);
    resetSimulation();
  };

  const stopSimulation = () => {
    setSimulationRunning(false);
    addLog("Mission paused.");
  };

  useEffect(() => {
    if (!simulationRunning) return;
    
    const interval = setInterval(() => {
      setStep(prev => {
        if (prev < path.length - 1) {
          const newPos = path[prev + 1];
          setDronePosition(newPos);
          
          supplies.forEach((supply, idx) => {
            if (!supply.delivered && 
                Math.abs(newPos.x - supply.x) < 3 && 
                Math.abs(newPos.y - supply.y) < 3) {
              setSupplies(prev => prev.map((s, i) => 
                i === idx ? { ...s, delivered: true } : s
              ));
              addLog(`Supply ${supply.type} delivered successfully.`);
            }
          });
          
          if (prev + 1 === path.length - 1) {
            addLog("Mission completed. Drone returned to base.");
            setSimulationRunning(false);
          }
          
          if (Math.random() < 0.01 * speed) {
            activateThreat();
          }
          
          return prev + 1;
        }
        return prev;
      });
    }, 500 / speed);
    
    return () => clearInterval(interval);
  }, [simulationRunning, path, speed]);

  useEffect(() => {
    if (routeOptimization || threatAnalysis) {
      recalculatePath();
    }
  }, [routeOptimization, threatAnalysis, threats]);

  useEffect(() => {
    recalculatePath();
  }, []);

  return (
    <div className="container">
      <div className="header">
        <div className="title">SwiftDrop Defence Systems</div>
        <div className="button-group">
          <button 
            onClick={startSimulation} 
            disabled={simulationRunning}
            className={`button ${simulationRunning ? 'disabled' : 'start'}`}
          >
            Start
          </button>
          <button 
            onClick={stopSimulation} 
            disabled={!simulationRunning}
            className={`button ${!simulationRunning ? 'disabled' : 'stop'}`}
          >
            Stop
          </button>
          <button 
            onClick={resetSimulation}
            className="button reset"
          >
            Reset
          </button>
        </div>
      </div>
      
      <div className="content">
        <div className="visualization-area">
          {/* Visualization area */}
          <div className="map">
            {/* Draw path */}
            <svg className="path-svg">
              {path.map((point, idx) => idx > 0 && (
                <line 
                  key={idx}
                  x1={`${path[idx-1].x}%`} 
                  y1={`${path[idx-1].y}%`} 
                  x2={`${point.x}%`} 
                  y2={`${point.y}%`} 
                  stroke={threatAnalysis ? "#4299e1" : "#9ae6b4"} 
                  strokeWidth="1"
                  strokeDasharray={threatAnalysis ? "4 2" : "none"}
                />
              ))}
            </svg>
            
            {/* Base */}
            <div className="base" 
                 style={{ left: `calc(${basePosition.x}% - 12px)`, top: `calc(${basePosition.y}% - 12px)` }}>
              <Truck size={16} color="white" />
            </div>
            
            {/* Destination */}
            <div className="destination" 
                 style={{ left: `calc(${destination.x}% - 12px)`, top: `calc(${destination.y}% - 12px)` }}>
              <Map size={16} color="white" />
            </div>
            
            {/* Threats */}
            {threats.map(threat => (
              <div 
                key={threat.id}
                className={`threat ${threat.active ? 'active' : ''}`}
                style={{ 
                  left: `calc(${threat.x}% - 24px)`, 
                  top: `calc(${threat.y}% - 24px)`, 
                }}
              >
                {threat.active && (
                  <div className="threat-icon">
                    <AlertTriangle size={16} color="white" />
                  </div>
                )}
              </div>
            ))}
            
            {/* Supplies */}
            {supplies.map(supply => (
              <div 
                key={supply.id}
                className={`supply ${supply.delivered ? 'delivered' : ''}`}
                style={{ left: `calc(${supply.x}% - 12px)`, top: `calc(${supply.y}% - 12px)` }}
              >
                <Package size={16} color="white" />
              </div>
            ))}
            
            {/* Drone */}
            <div 
              className="drone"
              style={{ 
                left: `calc(${dronePosition.x}% - 16px)`, 
                top: `calc(${dronePosition.y}% - 16px)`,
              }}
            >
              <Crosshair size={20} color="white" />
            </div>
          </div>
        </div>
        
        <div className="sidebar">
          <div className="panel">
            <h3 className="panel-title">AI Capabilities</h3>
            <div className="checkbox-list">
              <div className="checkbox-item">
                <input 
                  type="checkbox" 
                  id="routeOpt" 
                  checked={routeOptimization} 
                  onChange={() => setRouteOptimization(!routeOptimization)}
                />
                <label htmlFor="routeOpt">
                  <Navigation size={16} className="icon" /> 
                  Route Optimization
                </label>
              </div>
              <div className="checkbox-item">
                <input 
                  type="checkbox" 
                  id="threatAnalysis" 
                  checked={threatAnalysis} 
                  onChange={() => setThreatAnalysis(!threatAnalysis)}
                />
                <label htmlFor="threatAnalysis">
                  <Shield size={16} className="icon" /> 
                  Threat Analysis
                </label>
              </div>
              <div className="checkbox-item">
                <input 
                  type="checkbox" 
                  id="supplyTracking" 
                  checked={supplyTracking} 
                  onChange={() => setSupplyTracking(!supplyTracking)}
                />
                <label htmlFor="supplyTracking">
                  <Package size={16} className="icon" /> 
                  Supply Tracking
                </label>
              </div>
            </div>
          </div>
          
          <div className="panel">
            <h3 className="panel-title">Simulation Controls</h3>
            <div className="speed-control">
              <label>Speed</label>
              <input 
                type="range" 
                min="1" 
                max="5" 
                value={speed} 
                onChange={(e) => setSpeed(parseInt(e.target.value))}
              />
              <div className="speed-value">{speed}x</div>
            </div>
            <div className="threat-button">
              <button 
                onClick={activateThreat}
                className="button threat-trigger"
              >
                Trigger Random Threat
              </button>
            </div>
          </div>
          
          <div className="panel">
            <h3 className="panel-title">
              <Activity size={16} className="icon" /> 
              Mission Log
            </h3>
            <div className="log-area">
              {logs.length > 0 ? logs.map((log, idx) => (
                <div key={idx} className="log-entry">{log}</div>
              )) : (
                <div className="log-empty">No activity yet</div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="footer">
        <p>This 2D visualization demonstrates SwiftDrop Defence Systems' software-based approach to military logistics. The simulation shows how our AI algorithms optimize routes, analyze threats, and ensure efficient supply delivery in contested environments.</p>
      </div>
    </div>
  );
}