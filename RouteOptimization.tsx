import React, { useState, useEffect } from 'react';
import { Grid, Paper, Typography, Box, Button, TextField, MenuItem, Chip } from '@mui/material';
import OptimizationMap from '../components/OptimizationMap';
import RouteParameters from '../components/RouteParameters';
import RouteAnalytics from '../components/RouteAnalytics';
import ShipmentsList from '../components/ShipmentsList';
import { fetchAvailableShipments, optimizeRoutes } from '../services/routeService';

const RouteOptimization = () => {
  const [availableShipments, setAvailableShipments] = useState([]);
  const [selectedShipments, setSelectedShipments] = useState([]);
  const [optimizationParameters, setOptimizationParameters] = useState({
    prioritize: 'balanced', // 'time', 'fuel', 'cost', 'balanced'
    constraints: {
      maxDelay: 120, // minutes
      maxDetour: 15, // percentage
      weightLimit: true,
      volumeLimit: true,
      driverHours: true
    },
    pooling: true,
    avoidZones: [],
    preferredRoutes: []
  });
  const [optimizedRoutes, setOptimizedRoutes] = useState(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  
  useEffect(() => {
    const loadShipments = async () => {
      const shipments = await fetchAvailableShipments();
      setAvailableShipments(shipments);
    };
    
    loadShipments();
  }, []);
  
  const handleShipmentSelect = (shipment) => {
    setSelectedShipments(prev => {
      if (prev.find(s => s.id === shipment.id)) {
        return prev.filter(s => s.id !== shipment.id);
      } else {
        return [...prev, shipment];
      }
    });
  };
  
  const handleParameterChange = (parameter, value) => {
    setOptimizationParameters(prev => ({
      ...prev,
      [parameter]: value
    }));
  };
  
  const handleConstraintChange = (constraint, value) => {
    setOptimizationParameters(prev => ({
      ...prev,
      constraints: {
        ...prev.constraints,
        [constraint]: value
      }
    }));
  };
  
  const handleOptimize = async () => {
    setIsOptimizing(true);
    try {
      const result = await optimizeRoutes(
        selectedShipments.map(s => s.id),
        optimizationParameters
      );
      setOptimizedRoutes(result);
    } catch (error) {
      console.error("Optimization failed:", error);
      // Handle error
    } finally {
      setIsOptimizing(false);
    }
  };
  
  return (
    <Box sx={{ flexGrow: 1, padding: 3 }}>
      <Typography variant="h4" gutterBottom>
        Route Intelligence & Optimization
      </Typography>
      
      <Grid container spacing={3}>
        {/* Left panel - Shipment selection */}
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2, height: '80vh', overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom>
              Available Shipments
            </Typography>
            
            <ShipmentsList 
              shipments={availableShipments}
              selectedShipments={selectedShipments}
              onShipmentSelect={handleShipmentSelect}
            />
            
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Selected: {selectedShipments.length} shipments
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {selectedShipments.map(shipment => (
                  <Chip 
                    key={shipment.id}
                    label={`${shipment.id.slice(0, 6)} - ${shipment.destination.city}`}
                    onDelete={() => handleShipmentSelect(shipment)}
                    color="primary"
                    size="small"
                  />
                ))}
              </Box>
            </Box>
          </Paper>
        </Grid>
        
        {/* Center panel - Map */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '80vh' }}>
            <Typography variant="h6" gutterBottom>
              Route Visualization
            </Typography>
            
            <OptimizationMap 
              shipments={selectedShipments}
              optimizedRoutes={optimizedRoutes}
              avoidZones={optimizationParameters.avoidZones}
              preferredRoutes={optimizationParameters.preferredRoutes}
            />
            
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
              <Button 
                variant="contained" 
                color="primary"
                size="large"
                onClick={handleOptimize}
                disabled={selectedShipments.length === 0 || isOptimizing}
              >
                {isOptimizing ? 'Optimizing...' : 'Calculate Optimal Routes'}
              </Button>
            </Box>
          </Paper>
        </Grid>
        
        {/* Right panel - Parameters & results */}
        <Grid item xs={12} md={3}>
          <Grid container spacing={2} direction="column">
            <Grid item>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Optimization Parameters
                </Typography>
                
                <RouteParameters 
                  parameters={optimizationParameters}
                  onParameterChange={handleParameterChange}
                  onConstraintChange={handleConstraintChange}
                />
              </Paper>
            </Grid>
            
            {optimizedRoutes && (
              <Grid item>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Optimization Results
                  </Typography>
                  
                  <RouteAnalytics 
                    originalMetrics={optimizedRoutes.originalMetrics}
                    optimizedMetrics={optimizedRoutes.optimizedMetrics}
                    savings={optimizedRoutes.savings}
                  />
                </Paper>
              </Grid>
            )}
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};
