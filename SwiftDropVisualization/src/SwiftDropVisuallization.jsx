import { useState, useEffect, useRef } from 'react';
import { Map, Truck, AlertTriangle, Package, Crosshair, Navigation, Activity, Shield, MapPin, Plus, X, Search } from 'lucide-react';
import './SwiftDropVisualization.css'; // CSS file import retained from original

export default function EnhancedSwiftDropVisualization() {
  const [dronePosition, setDronePosition] = useState({ x: 50, y: 50 });
  const [threats, setThreats] = useState([
    { id: 1, x: 30, y: 70, type: 'jamming', active: true },
    { id: 2, x: 70, y: 30, type: 'physical', active: false },
  ]);
  const [supplies, setSupplies] = useState([
    { id: 1, x: 20, y: 20, type: 'medical', delivered: false },
    { id: 2, x: 80, y: 80, type: 'ammo', delivered: false },
  ]);
  const [basePosition, setBasePosition] = useState({ x: 10, y: 10 });
  const [destination, setDestination] = useState({ x: 85, y: 85 });
  const [path, setPath] = useState([]);
  const [routeOptimization, setRouteOptimization] = useState(false);
  const [threatAnalysis, setThreatAnalysis] = useState(false);
  const [supplyTracking, setSupplyTracking] = useState(false);
  const [step, setStep] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  
  // New state for location management
  const [showLocationManager, setShowLocationManager] = useState(false);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationPlacementMode, setLocationPlacementMode] = useState(null); // 'base', 'destination', 'supply'
  const [locationResults, setLocationResults] = useState([]);
  const [customLocations, setCustomLocations] = useState([
    { id: 1, name: 'Forward Operating Base Alpha', lat: 34.0522, lng: -118.2437, type: 'base' },
    { id: 2, name: 'Field Hospital Bravo', lat: 34.0689, lng: -118.4452, type: 'destination' },
    { id: 3, name: 'Supply Depot Charlie', lat: 34.1478, lng: -118.1445, type: 'supply' },
  ]);
  const [mapCenter, setMapCenter] = useState({ lat: 34.0522, lng: -118.2437 }); // Default center (Los Angeles)
  const [mapZoom, setMapZoom] = useState(10);
  const [mapMode, setMapMode] = useState('normal'); // 'normal', 'satellite', 'terrain'
  
  const mapRef = useRef(null);

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

  // Function to search for locations
  const searchLocations = (query) => {
    if (query.length < 3) {
      setLocationResults([]);
      return;
    }
    
    // This would typically be an API call to a geocoding service like Google Places API
    // For this demo, we'll simulate search results based on the query
    const mockResults = [
      { id: 'loc1', name: `${query} City Center`, lat: 34.0522 + Math.random() * 0.1, lng: -118.2437 + Math.random() * 0.1 },
      { id: 'loc2', name: `${query} Airport`, lat: 34.0522 + Math.random() * 0.1, lng: -118.2437 + Math.random() * 0.1 },
      { id: 'loc3', name: `${query} Military Base`, lat: 34.0522 + Math.random() * 0.1, lng: -118.2437 + Math.random() * 0.1 },
    ];
    
    setLocationResults(mockResults);
  };

  // Function to select a location from search results
  const selectLocationFromSearch = (location) => {
    setSelectedLocation(location);
    setLocationResults([]);
    setLocationSearchQuery('');
    
    // Move map to the selected location
    setMapCenter({ lat: location.lat, lng: location.lng });
    setMapZoom(12);
  };

  // Function to add a new location
  const addLocation = (type) => {
    setLocationPlacementMode(type);
    setShowLocationManager(true);
  };

  // Function to save location after placement
  const saveLocation = () => {
    if (!selectedLocation) return;
    
    const newLocation = {
      id: Date.now(),
      name: selectedLocation.name || `New ${locationPlacementMode} location`,
      lat: selectedLocation.lat,
      lng: selectedLocation.lng,
      type: locationPlacementMode
    };
    
    setCustomLocations([...customLocations, newLocation]);
    
    // Update simulation points based on the location type
    if (locationPlacementMode === 'base') {
      setBasePosition(convertGeoToSimCoords(selectedLocation.lat, selectedLocation.lng));
      addLog(`New base established at ${selectedLocation.name}`);
    } else if (locationPlacementMode === 'destination') {
      setDestination(convertGeoToSimCoords(selectedLocation.lat, selectedLocation.lng));
      addLog(`New destination set at ${selectedLocation.name}`);
    } else if (locationPlacementMode === 'supply') {
      const newSupply = { 
        id: Date.now(), 
        x: convertGeoToSimCoords(selectedLocation.lat, selectedLocation.lng).x, 
        y: convertGeoToSimCoords(selectedLocation.lat, selectedLocation.lng).y, 
        type: 'supply', 
        delivered: false 
      };
      setSupplies([...supplies, newSupply]);
      addLog(`New supply point added at ${selectedLocation.name}`);
    }
    
    // Clear selection state
    setSelectedLocation(null);
    setLocationPlacementMode(null);
    setShowLocationManager(false);
    
    // Recalculate path with the new points
    recalculatePath();
  };

  // Function to cancel location placement
  const cancelLocationPlacement = () => {
    setSelectedLocation(null);
    setLocationPlacementMode(null);
    setShowLocationManager(false);
  };

  // Function to handle clicking on the map for location placement
  const handleMapClick = (event) => {
    if (!locationPlacementMode) return;
    
    // In a real implementation, this would get lat/lng from the map click event
    // For this demo, we'll create a simulated point
    const mockLat = mapCenter.lat + (Math.random() * 0.1 - 0.05);
    const mockLng = mapCenter.lng + (Math.random() * 0.1 - 0.05);
    
    setSelectedLocation({
      name: `New ${locationPlacementMode} at ${mockLat.toFixed(4)}, ${mockLng.toFixed(4)}`,
      lat: mockLat,
      lng: mockLng
    });
  };

  // Function to convert geo coordinates to simulation coordinates
  const convertGeoToSimCoords = (lat, lng) => {
    // Simple conversion for demo purposes
    // In a real implementation, this would properly map geographic coordinates to the simulation space
    const x = ((lng + 180) / 360) * 100;
    const y = ((90 - lat) / 180) * 100;
    
    return { x, y };
  };

  // Function to convert simulation coordinates to geo coordinates
  const convertSimCoordsToGeo = (x, y) => {
    const lng = (x / 100) * 360 - 180;
    const lat = 90 - (y / 100) * 180;
    
    return { lat, lng };
  };

  // Function to change map mode
  const changeMapMode = (mode) => {
    setMapMode(mode);
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
          <button 
            onClick={() => setShowLocationManager(!showLocationManager)}
            className={`button ${showLocationManager ? 'active' : ''}`}
          >
            Manage Locations
          </button>
        </div>
      </div>
      
      <div className="content">
        {showLocationManager ? (
          <div className="location-manager">
            <div className="location-manager-header">
              <h3>Location Manager</h3>
              <button onClick={() => setShowLocationManager(false)} className="close-button">
                <X size={16} />
              </button>
            </div>
            
            <div className="map-container" ref={mapRef} onClick={handleMapClick}>
              <div className="mock-map" style={{ backgroundImage: `url(/api/placeholder/800/400)` }}>
                <div className="map-controls">
                  <button onClick={() => changeMapMode('normal')} className={`map-control ${mapMode === 'normal' ? 'active' : ''}`}>
                    Normal
                  </button>
                  <button onClick={() => changeMapMode('satellite')} className={`map-control ${mapMode === 'satellite' ? 'active' : ''}`}>
                    Satellite
                  </button>
                  <button onClick={() => changeMapMode('terrain')} className={`map-control ${mapMode === 'terrain' ? 'active' : ''}`}>
                    Terrain
                  </button>
                </div>
                
                {customLocations.map(loc => (
                  <div 
                    key={loc.id} 
                    className={`map-pin ${loc.type}`}
                    style={{ 
                      left: `${((loc.lng + 180) / 360) * 100}%`, 
                      top: `${((90 - loc.lat) / 180) * 100}%` 
                    }}
                    title={loc.name}
                  >
                    <MapPin size={16} color="white" />
                  </div>
                ))}
                
                {selectedLocation && (
                  <div 
                    className={`map-pin selected ${locationPlacementMode}`}
                    style={{ 
                      left: `${((selectedLocation.lng + 180) / 360) * 100}%`, 
                      top: `${((90 - selectedLocation.lat) / 180) * 100}%` 
                    }}
                    title={selectedLocation.name}
                  >
                    <MapPin size={16} color="white" />
                  </div>
                )}
              </div>
            </div>
            
            <div className="location-search">
              <div className="search-input">
                <Search size={16} />
                <input 
                  type="text" 
                  placeholder="Search for locations..." 
                  value={locationSearchQuery}
                  onChange={(e) => {
                    setLocationSearchQuery(e.target.value);
                    searchLocations(e.target.value);
                  }}
                />
              </div>
              
              {locationResults.length > 0 && (
                <div className="search-results">
                  {locationResults.map(result => (
                    <div 
                      key={result.id} 
                      className="search-result" 
                      onClick={() => selectLocationFromSearch(result)}
                    >
                      <MapPin size={14} />
                      <span>{result.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="location-actions">
              <div className="location-types">
                <button 
                  onClick={() => addLocation('base')} 
                  className={`location-type ${locationPlacementMode === 'base' ? 'active' : ''}`}
                >
                  <Truck size={16} /> Base
                </button>
                <button 
                  onClick={() => addLocation('destination')} 
                  className={`location-type ${locationPlacementMode === 'destination' ? 'active' : ''}`}
                >
                  <Map size={16} /> Destination
                </button>
                <button 
                  onClick={() => addLocation('supply')} 
                  className={`location-type ${locationPlacementMode === 'supply' ? 'active' : ''}`}
                >
                  <Package size={16} /> Supply
                </button>
              </div>
              
              <div className="placement-actions">
                {selectedLocation && (
                  <>
                    <div className="selected-location-info">
                      <strong>{selectedLocation.name}</strong>
                      <div>Lat: {selectedLocation.lat.toFixed(4)}, Lng: {selectedLocation.lng.toFixed(4)}</div>
                    </div>
                    <button onClick={saveLocation} className="button save">Save Location</button>
                    <button onClick={cancelLocationPlacement} className="button cancel">Cancel</button>
                  </>
                )}
              </div>
            </div>
            
            <div className="location-list">
              <h4>Saved Locations</h4>
              {customLocations.map(loc => (
                <div key={loc.id} className="location-item">
                  <div className={`location-type-icon ${loc.type}`}>
                    {loc.type === 'base' && <Truck size={14} />}
                    {loc.type === 'destination' && <Map size={14} />}
                    {loc.type === 'supply' && <Package size={14} />}
                  </div>
                  <div className="location-details">
                    <div className="location-name">{loc.name}</div>
                    <div className="location-coords">
                      {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="visualization-area">
              <div className="map">
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
                
                <div className="base" 
                     style={{ left: `calc(${basePosition.x}% - 12px)`, top: `calc(${basePosition.y}% - 12px)` }}>
                  <Truck size={16} color="white" />
                </div>
                
                <div className="destination" 
                     style={{ left: `calc(${destination.x}% - 12px)`, top: `calc(${destination.y}% - 12px)` }}>
                  <Map size={16} color="white" />
                </div>
                
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
                
                {supplies.map(supply => (
                  <div 
                    key={supply.id}
                    className={`supply ${supply.delivered ? 'delivered' : ''}`}
                    style={{ left: `calc(${supply.x}% - 12px)`, top: `calc(${supply.y}% - 12px)` }}
                  >
                    <Package size={16} color="white" />
                  </div>
                ))}
                
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
          </>
        )}
      </div>
      
      <div className="footer">
        <p>This enhanced visualization demonstrates SwiftDrop Defence Systems' software-based approach to military logistics with real-time location integration. The simulation shows how our AI algorithms optimize routes, analyze threats, and ensure efficient supply delivery in contested environments based on real-world geographic data.</p>
      </div>
    </div>
  );
}