import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { theme } from './theme';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import FleetManagement from './pages/FleetManagement';
import RouteOptimization from './pages/RouteOptimization';
import ShipmentTracking from './pages/ShipmentTracking';
import DroneControl from './pages/DroneControl';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Login from './pages/Login';
import AuthGuard from './components/AuthGuard';

const App = () => {
  return (
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <WebSocketProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<AuthGuard><MainLayout /></AuthGuard>}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/fleet" element={<FleetManagement />} />
                <Route path="/routes" element={<RouteOptimization />} />
                <Route path="/tracking" element={<ShipmentTracking />} />
                <Route path="/drones" element={<DroneControl />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Routes>
          </WebSocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};
