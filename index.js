const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const shipmentController = require('../controllers/shipmentController');
const droneService = require('../services/droneService');
const routeService = require('../services/routeService');

// Vehicle routes
router.get('/vehicles', vehicleController.getAllVehicles);
router.get('/vehicles/:id', vehicleController.getVehicle);
router.post('/vehicles', vehicleController.createVehicle);
router.put('/vehicles/:id', vehicleController.updateVehicle);
router.put('/vehicles/:id/location', vehicleController.updateVehicleLocation);
router.delete('/vehicles/:id', vehicleController.deleteVehicle);

// Shipment routes
router.get('/shipments', shipmentController.getAllShipments);
router.get('/shipments/:id', shipmentController.getShipment);
router.post('/shipments', shipmentController.createShipment);
router.put('/shipments/:id', shipmentController.updateShipment);
router.post('/shipments/:id/assign', shipmentController.assignVehicle);
router.put('/shipments/:id/status', shipmentController.updateStatus);

// Drone specific routes
router.get('/drones', async (req, res) => {
  try {
    const drones = await droneService.fetchDrones(req.query);
    return res.status(200).json({
      success: true,
      count: drones.length,
      data: drones
    });
  } catch (error) {
    console.error('Error fetching drones:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

router.post('/drones/:id/mission', async (req, res) => {
  try {
    const result = await droneService.assignDroneMission(req.params.id, req.body);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error assigning drone mission:', error);
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/drones/:id/recall', async (req, res) => {
  try {
    const result = await droneService.recallDrone(req.params.id);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error recalling drone:', error);
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Route optimization
router.post('/routes/optimize', async (req, res) => {
  try {
    const { shipmentIds, parameters
           // Route optimization
router.post('/routes/optimize', async (req, res) => {
  try {
    const { shipmentIds, parameters } = req.body;
    
    if (!shipmentIds || !Array.isArray(shipmentIds) || shipmentIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid shipmentIds array is required'
      });
    }
    
    const optimizedRoute = await routeService.optimizeRoute(shipmentIds, parameters);
    
    return res.status(200).json({
      success: true,
      data: optimizedRoute
    });
  } catch (error) {
    console.error('Error optimizing route:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
});

// Get route estimation
router.get('/routes/estimate', async (req, res) => {
  try {
    const { origin, destination, vehicleType } = req.query;
    
    if (!origin || !destination) {
      return res.status(400).json({
        success: false,
        error: 'Origin and destination are required'
      });
    }
    
    const routeEstimation = await routeService.estimateRoute(origin, destination, vehicleType);
    
    return res.status(200).json({
      success: true,
      data: routeEstimation
    });
  } catch (error) {
    console.error('Error estimating route:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
});

// Analytics routes
router.get('/analytics/fleet', async (req, res) => {
  try {
    const fleetAnalytics = await vehicleController.getFleetAnalytics(req.query);
    
    return res.status(200).json({
      success: true,
      data: fleetAnalytics
    });
  } catch (error) {
    console.error('Error fetching fleet analytics:', error);
    return res.status(500).json({
      success: false, 
      error: 'Server error'
    });
  }
});

router.get('/analytics/shipments', async (req, res) => {
  try {
    const shipmentAnalytics = await shipmentController.getShipmentAnalytics(req.query);
    
    return res.status(200).json({
      success: true,
      data: shipmentAnalytics
    });
  } catch (error) {
    console.error('Error fetching shipment analytics:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Catch-all for undefined routes
router.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`
  });
});

module.exports = router;
