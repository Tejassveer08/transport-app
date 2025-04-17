import React, { useState, useEffect } from 'react';
import { Grid, Paper, Typography, Box, Button, Tabs, Tab, Switch, FormControlLabel } from '@mui/material';
import DroneMap from '../components/DroneMap';
import DroneList from '../components/DroneList';
import DroneDetailPanel from '../components/DroneDetailPanel';
import DroneAssignmentModal from '../components/DroneAssignmentModal';
import { fetchDrones, assignDroneMission, recallDrone } from '../services/droneService';

const DroneControl = () => {
  const [drones, setDrones] = useState([]);
  const [selectedDrone, setSelectedDrone] = useState(null);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [autoTrackingEnabled, setAutoTrackingEnabled] = useState(true);
  
  useEffect(() => {
    const loadDrones = async () => {
      const dronesData = await fetchDrones();
      setDrones(dronesData);
      
      // Select first drone by default if available
      if (dronesData.length > 0 && !selectedDrone) {
        setSelectedDrone(dronesData[0]);
      }
    };
    
    loadDrones();
    const interval = setInterval(loadDrones, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  const handleDroneSelect = (drone) => {
    setSelectedDrone(drone);
  };
  
  const handleAssignMission = async (missionData) => {
    await assignDroneMission(selectedDrone.id, missionData);
    setIsAssignmentModalOpen(false);
    
    // Refresh drones data
    const updatedDrones = await fetchDrones();
    setDrones(updatedDrones);
    
    // Update selected drone
    const updatedSelectedDrone = updatedDrones.find(d => d.id === selectedDrone.id);
    if (updatedSelectedDrone) {
      setSelectedDrone(updatedSelectedDrone);
    }
  };
  
  const handleRecallDrone = async () => {
    await recallDrone(selectedDrone.id);
    
    // Refresh drones data
    const updatedDrones = await fetchDrones();
    setDrones(updatedDrones);
    
    // Update selected drone
    const updatedSelectedDrone = updatedDrones.find(d => d.id === selectedDrone.id);
    if (updatedSelectedDrone) {
      setSelectedDrone(updatedSelectedDrone);
    }
  };
  
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };
  
  return (
    <Box sx={{ flexGrow: 1, padding: 3 }}>
      <Typography variant="h4" gutterBottom>
        Drone Oversight Network
      </Typography>
      
      <Tabs value={activeTab} onChange={handleTabChange}>
        <Tab label="Surveillance Operations" />
        <Tab label="Delivery Operations" />
        <Tab label="Maintenance" />
        <Tab label="Analytics" />
      </Tabs>
      
      <Box sx={{ mt: 3 }}>
        <Grid container spacing={3}>
          {/* Drone Fleet List */}
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, height: '75vh', overflow: 'auto' }}>
              <Typography variant="h6" gutterBottom>
                Drone Fleet
              </Typography>
              
              <DroneList 
                drones={drones} 
                selectedDrone={selectedDrone}
                onDroneSelect={handleDroneSelect}
              />
            </Paper>
          </Grid>
          
          {/* Drone Map */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: '75vh' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Live Drone Operations
                </Typography>
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoTrackingEnabled}
                      onChange={(e) => setAutoTrackingEnabled(e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Auto-tracking"
                />
              </Box>
              
              <DroneMap 
                drones={drones}
                selectedDrone={selectedDrone}
                autoTracking={autoTrackingEnabled}
                showTraffic={true}
                showWeather={true}
              />
              
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 2 }}>
                <Button 
                  variant="contained" 
                  color="primary"
                  onClick={() => setIsAssignmentModalOpen(true)}
                  disabled={!selectedDrone}
                >
                  Assign Mission
                </Button>
                
                <Button 
                  variant="outlined" 
                  color="secondary"
                  onClick={handleRecallDrone}
                  disabled={!selectedDrone || selectedDrone.status === 'idle'}
                >
                  Recall Drone
                </Button>
              </Box>
            </Paper>
          </Grid>
          
          {/* Drone Details Panel */}
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, height: '75vh', overflow: 'auto' }}>
              <Typography variant="h6" gutterBottom>
                Drone Details
              </Typography>
              
              {selectedDrone ? (
                <DroneDetailPanel drone={selectedDrone} />
              ) : (
                <Typography variant="body2" color="textSecondary">
                  Select a drone to view details
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Box>
      
      {/* Drone Assignment Modal */}
      <DroneAssignmentModal 
        open={isAssignmentModalOpen}
        onClose={() => setIsAssignmentModalOpen(false)}
        onAssign={handleAssignMission}
        drone={selectedDrone}
      />
    </Box>
  );
};
