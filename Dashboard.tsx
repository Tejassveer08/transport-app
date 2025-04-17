import React, { useState, useEffect } from 'react';
import { Grid, Paper, Typography, Box, Button, Tabs, Tab } from '@mui/material';
import MapComponent from '../components/MapComponent';
import ShipmentOverview from '../components/ShipmentOverview';
import AlertCenter from '../components/AlertCenter';
import KpiDashboard from '../components/KpiDashboard';
import { useWebSocket } from '../contexts/WebSocketContext';
import { fetchDashboardData } from '../services/dashboardService';

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const { lastMessage } = useWebSocket();

  useEffect(() => {
    const loadDashboardData = async () => {
      const data = await fetchDashboardData();
      setDashboardData(data);
    };
    
    loadDashboardData();
    
    // Set up polling for regular updates
    const interval = setInterval(loadDashboardData, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (lastMessage) {
      // Handle real-time updates from WebSocket
      const update = JSON.parse(lastMessage.data);
      if (update.type === 'DASHBOARD_UPDATE') {
        // Update relevant parts of dashboard data
        setDashboardData(prevData => ({
          ...prevData,
          ...update.payload
        }));
      }
    }
  }, [lastMessage]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  if (!dashboardData) return <div>Loading dashboard...</div>;

  return (
    <Box sx={{ flexGrow: 1, padding: 3 }}>
      <Typography variant="h4" gutterBottom>
        Command & Control Center
      </Typography>
      
      <Tabs value={activeTab} onChange={handleTabChange}>
        <Tab label="Operational Overview" />
        <Tab label="Defense Logistics" />
        <Tab label="Commercial Shipments" />
        <Tab label="Crisis Management" />
      </Tabs>
      
      <Box sx={{ mt: 3 }}>
        <Grid container spacing={3}>
          {/* Interactive Map with all active shipments */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2, height: 600 }}>
              <Typography variant="h6" gutterBottom>
                Live Fleet & Shipment Map
              </Typography>
              <MapComponent 
                vehicles={dashboardData.vehicles}
                shipments={dashboardData.shipments}
                incidents={dashboardData.incidents}
                weatherOverlays={dashboardData.weatherData}
                trafficOverlays={dashboardData.trafficData}
                showDrones={true}
              />
            </Paper>
          </Grid>
          
          {/* Status panels and KPIs */}
          <Grid item xs={12} md={4}>
            <Grid container spacing={3} direction="column">
              <Grid item>
                <Paper sx={{ p: 2 }}>
                  <KpiDashboard 
                    activeShipments={dashboardData.kpis.activeShipments}
                    onTimePerformance={dashboardData.kpis.onTimePerformance}
                    fleetUtilization={dashboardData.kpis.fleetUtilization}
                    fuelEfficiency={dashboardData.kpis.fuelEfficiency}
                    carbonFootprint={dashboardData.kpis.carbonFootprint}
                  />
                </Paper>
              </Grid>
              <Grid item>
                <Paper sx={{ p: 2 }}>
                  <AlertCenter alerts={dashboardData.alerts} />
                </Paper>
              </Grid>
            </Grid>
          </Grid>
          
          {/* Shipment Overview Table */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <ShipmentOverview 
                shipments={dashboardData.recentShipments} 
                showPriority={true}
              />
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};
