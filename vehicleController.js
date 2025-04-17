
const Vehicle = require('../models/vehicle');
const { publishToKafka } = require('../utils/kafka');
const { calculateDistance, calculateETA } = require('../utils/calculations');

/**
 * Get all vehicles with filtering
 */
exports.getAllVehicles = async (req, res) => {
  try {
    const query = {};
    
    // Apply filters from query parameters
    if (req.query.type) {
      query.type = req.query.type;
    }
    
    if (req.query.status) {
      query.status = req.query.status;
    }
    
    // Geospatial query
    if (req.query.nearLat && req.query.nearLng && req.query.maxDistance) {
      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(req.query.nearLng), parseFloat(req.query.nearLat)]
          },
          $maxDistance: parseInt(req.query.maxDistance) * 1000 // Convert km to meters
        }
      };
    }
    
    // Capacity requirements
    if (req.query.minWeight) {
      query['capacity.weight'] = { $gte: parseFloat(req.query.minWeight) };
    }
    
    if (req.query.minVolume) {
      query['capacity.volume'] = { $gte: parseFloat(req.query.minVolume) };
    }
    
    // Feature requirements
    if (req.query.temperatureControl === 'true') {
      query['features.temperatureControl'] = true;
    }
    
    const vehicles = await Vehicle.find(query)
      .populate('driver', 'name contactInfo')
      .populate('assignedShipments', 'reference status');
    
    return res.status(200).json({
      success: true,
      count: vehicles.length,
      data: vehicles
    });
  } catch (error) {
    console.error('Error getting vehicles:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

/**
 * Get a single vehicle by ID
 */
exports.getVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id)
      .populate('driver', 'name contactInfo')
      .populate('assignedShipments', 'reference status origin destination');
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: vehicle
    });
  } catch (error) {
    console.error('Error getting vehicle:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

/**
 * Create a new vehicle
 */
exports.createVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.create(req.body);
    
    // Publish event to Kafka
    publishToKafka('vehicle_events', {
      type: 'vehicle_created',
      vehicleId: vehicle._id.toString(),
      vehicleType: vehicle.type,
      timestamp: new Date()
    });
    
    return res.status(201).json({
      success: true,
      data: vehicle
    });
  } catch (error) {
    console.error('Error creating vehicle:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        error: messages
      });
    }
    
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

/**
 * Update a vehicle
 */
exports.updateVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found'
      });
    }
    
    // Publish event to Kafka
    publishToKafka('vehicle_events', {
      type: 'vehicle_updated',
      vehicleId: vehicle._id.toString(),
      timestamp: new Date(),
      changes: Object.keys(req.body)
    });
    
    return res.status(200).json({
      success: true,
      data: vehicle
    });
  } catch (error) {
    console.error('Error updating vehicle:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        error: messages
      });
    }
    
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

/**
 * Update vehicle location and telemetry
 */
exports.updateVehicleLocation = async (req, res) => {
  try {
    const { longitude, latitude, speed, heading, timestamp } = req.body;
    
    if (!longitude || !latitude) {
      return res.status(400).json({
        success: false,
        error: 'Longitude and latitude are required'
      });
    }
    
    const vehicle = await Vehicle.findById(req.params.id);
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found'
      });
    }
    
    // Update location and telemetry
    vehicle.location.coordinates = [longitude, latitude];
    
    if (speed !== undefined) {
      vehicle.telemetry.speed = speed;
    }
    
    if (heading !== undefined) {
      vehicle.telemetry.heading = heading;
    }
    
    await vehicle.save();
    
    // Publish event to Kafka
    publishToKafka('vehicle_telemetry', {
      vehicleId: vehicle._id.toString(),
      location: [longitude, latitude],
      speed: vehicle.telemetry.speed,
      heading: vehicle.telemetry.heading,
      timestamp: timestamp || new Date()
    });
    
    return res.status(200).json({
      success: true,
      data: {
        vehicleId: vehicle._id,
        location: vehicle.location,
        telemetry: vehicle.telemetry
      }
    });
  } catch (error) {
    console.error('Error updating vehicle location:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

/**
 * Delete a vehicle
 */
exports.deleteVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found'
      });
    }
    
    if (vehicle.assignedShipments && vehicle.assignedShipments.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete vehicle with assigned shipments'
      });
    }
    
    await vehicle.remove();
    
    // Publish event to Kafka
    publishToKafka('vehicle_events', {
      type: 'vehicle_deleted',
      vehicleId: req.params.id,
      timestamp: new Date()
    });
    
    return res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};
