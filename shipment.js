
// models/shipment.js - Shipment data model
const mongoose = require('mongoose');

const ShipmentSchema = new mongoose.Schema({
  reference: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['commercial', 'defense', 'humanitarian'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'in-transit', 'delivered', 'cancelled', 'delayed'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['standard', 'express', 'critical', 'military-urgent'],
    default: 'standard'
  },
  customer: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    name: { type: String, required: true },
    contactInfo: {
      email: String,
      phone: String
    }
  },
  origin: {
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: String,
    postalCode: String,
    country: { type: String, required: true },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true
      }
    }
  },
  destination: {
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: String,
    postalCode: String,
    country: { type: String, required: true },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true
      }
    }
  },
  scheduling: {
    requestedPickup: { type: Date, required: true },
    estimatedPickup: Date,
    requestedDelivery: { type: Date, required: true },
    estimatedDelivery: Date,
    actualPickup: Date,
    actualDelivery: Date
  },
  dimensions: {
    weight: { type: Number, required: true }, // kg
    volume: { type: Number, required: true }, // cubic meters
    length: Number, // meters
    width: Number, // meters
    height: Number // meters
  },
  contents: {
    description: { type: String, required: true },
    value: Number, // monetary value
    category: String,
    hazardClass: String,
    itemCount: Number
  },
  requirements: {
    temperatureControlled: { type: Boolean, default: false },
    temperatureRange: {
      min: Number, // celsius
      max: Number // celsius
    },
    handlingInstructions: String,
    securityLevel: {
      type: String,
      enum: ['standard', 'high', 'restricted', 'classified'],
      default: 'standard'
    },
    documentationRequired: [String] // ['customs', 'hazmat', 'insurance', etc.]
  },
  tracking: {
    assignedVehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
    currentLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number] // [longitude, latitude]
      },
      updatedAt: Date
    },
    route: {
      path: {
        type: {
          type: String,
          enum: ['LineString'],
          default: 'LineString'
        },
        coordinates: {
          type: [[Number]] // array of [longitude, latitude] points
        }
      },
      estimatedDuration: Number, // minutes
      estimatedDistance: Number, // kilometers
      waypoints: [{
        location: {
          type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
          },
          coordinates: {
            type: [Number] // [longitude, latitude]
          }
        },
        name: String,
        estimatedArrival: Date,
        actualArrival: Date
      }]
    }
  },
  pooling: {
    isPooled: { type: Boolean, default: false },
    poolId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShipmentPool' },
    position: Number // order in the pool
  },
  billing: {
    cost: Number,
    currency: { type: String, default: 'USD' },
    paid: { type: Boolean, default: false },
    invoiceReference: String
  },
  carbonFootprint: {
    estimated: Number, // kg CO2e
    actual: Number, // kg CO2e
    offsetApplied: { type: Boolean, default: false }
  },
  notes: [{ 
    text: String, 
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Indexes for geospatial queries
ShipmentSchema.index({ 'origin.coordinates': '2dsphere' });
ShipmentSchema.index({ 'destination.coordinates': '2dsphere' });
ShipmentSchema.index({ 'tracking.currentLocation': '2dsphere' });

// Virtual for delivery status percentage
ShipmentSchema.virtual('progressPercentage').get(function() {
  if (this.status === 'delivered') return 100;
  if (this.status === 'pending') return 0;
  
  // Calculate based on route progress
  if (this.tracking && this.tracking.route && 
      this.tracking.currentLocation && this.tracking.route.estimatedDistance) {
    
    // Calculate distance from origin to current location
    // This is a simplified calculation and would need to be more sophisticated in production
    const originPoint = this.origin.coordinates.coordinates;
    const currentPoint = this.tracking.currentLocation.coordinates;
    const destinationPoint = this.destination.coordinates.coordinates;
    
    // Calculate total distance and current progress
    const totalDistance = this.tracking.route.estimatedDistance;
    const coveredDistance = calculateDistance(originPoint, currentPoint);
    
    return Math.min(100, Math.round((coveredDistance / totalDistance) * 100));
  }
  
  return 0;
});

// Helper function to calculate distance between two points
function calculateDistance(point1, point2) {
  // Implementation of Haversine formula or similar would go here
  // This is a placeholder
  return 0;
}

const Shipment = mongoose.model('Shipment', ShipmentSchema);
module.exports = Shipment;

// services/routeService.js - Route optimization service
const Vehicle = require('../models/vehicle');
const Shipment = require('../models/shipment');
const axios = require('axios');
const redis = require('../utils/redis');
const { publishToKafka } = require('../utils/kafka');
const { calculateDistance, calculateFuelConsumption } = require('../utils/calculations');
const { MAPBOX_API_KEY, OPTIMIZATION_SERVICE_URL } = process.env;

/**
 * Fetch all available shipments that need routing
 */
exports.fetchAvailableShipments = async (filters = {}) => {
  try {
    const query = {
      status: { $in: ['pending', 'assigned'] },
      'scheduling.requestedPickup': { $gte: new Date() }
    };
    
    // Apply additional filters
    if (filters.priority) {
      query.priority = filters.priority;
    }
    
    if (filters.type) {
      query.type = filters.type;
    }
    
    if (filters.origin) {
      query['origin.city'] = filters.origin;
    }
    
    if (filters.destination) {
      query['destination.city'] = filters.destination;
    }
    
    const shipments = await Shipment.find(query)
      .sort({ 'scheduling.requestedPickup': 1, priority: -1 })
      .limit(100);
    
    return shipments;
  } catch (error) {
    console.error('Error fetching available shipments:', error);
    throw error;
  }
};

/**
 * Optimize routes for the selected shipments
 * @param {Array} shipmentIds - Array of shipment IDs to optimize
 * @param {Object} parameters - Optimization parameters
 */
exports.optimizeRoutes = async (shipmentIds, parameters) => {
  try {
    // Fetch full shipment data
    const shipments = await Shipment.find({ _id: { $in: shipmentIds } });
    
    if (!shipments.length) {
      throw new Error('No shipments found for optimization');
    }
    
    // Fetch available vehicles
    const vehicles = await findSuitableVehicles(shipments);
    
    if (!vehicles.length) {
      throw new Error('No suitable vehicles available for these shipments');
    }
    
    // Calculate original metrics without optimization
    const originalMetrics = calculateBaseMetrics(shipments);
    
    // Prepare optimization payload
    const optimizationPayload = {
      shipments: shipments.map(s => ({
        id: s._id.toString(),
        origin: s.origin.coordinates.coordinates,
        destination: s.destination.coordinates.coordinates,
        weight: s.dimensions.weight,
        volume: s.dimensions.volume,
        priority: s.priority,
        pickup: s.scheduling.requestedPickup,
        delivery: s.scheduling.requestedDelivery
      })),
      vehicles: vehicles.map(v => ({
        id: v._id.toString(),
        type: v.type,
        location: v.location.coordinates,
        weightCapacity: v.capacity.weight,
        volumeCapacity: v.capacity.volume,
        fuelEfficiency: v.fuel.efficiency
      })),
      parameters: {
        prioritize: parameters.prioritize,
        constraints: parameters.constraints,
        pooling: parameters.pooling,
        avoidZones: parameters.avoidZones,
        preferredRoutes: parameters.preferredRoutes
      }
    };
    
    // Call external optimization service or use internal algorithm
    let optimizationResult;
    
    // Check cache first
    const cacheKey = `route_opt_${JSON.stringify(optimizationPayload)}`;
    const cachedResult = await redis.get(cacheKey);
    
    if (cachedResult) {
      optimizationResult = JSON.parse(cachedResult);
    } else {
      // Call optimization service
      try {
        const response = await axios.post(
          OPTIMIZATION_SERVICE_URL,
          optimizationPayload,
          { timeout: 30000 } // 30 second timeout
        );
        
        optimizationResult = response.data;
        
        // Cache result for 5 minutes
        await redis.set(cacheKey, JSON.stringify(optimizationResult), 'EX', 300);
      } catch (apiError) {
        console.error('External optimization service error:', apiError);
        
        // Fall back to internal optimization algorithm
        optimizationResult = performInternalOptimization(optimizationPayload);
      }
    }
    
    // Process and return optimization results
    const result = {
      originalMetrics,
      optimizedMetrics: optimizationResult.metrics,
      savings: calculateSavings(originalMetrics, optimizationResult.metrics),
      routes: optimizationResult.routes,
      unassignedShipments: optimizationResult.unassignedShipments || []
    };
    
    // Publish optimization event to Kafka
    publishToKafka('route_optimizations', {
      timestamp: new Date(),
      shipmentCount: shipments.length,
      vehicleCount: vehicles.length,
      optimizationParameters: parameters,
      savings: result.savings
    });
    
    return result;
  } catch (error) {
    console.error('Error optimizing routes:', error);
    throw error;
  }
};

/**
 * Find vehicles suitable for the given shipments
 */
async function findSuitableVehicles(shipments) {
  // Calculate total capacity needed
  const totalWeight = shipments.reduce((sum, s) => sum + s.dimensions.weight, 0);
  const totalVolume = shipments.reduce((sum, s) => sum + s.dimensions.volume, 0);
  
  // Check for special requirements
  const requiresTemperatureControl = shipments.some(s => s.requirements.temperatureControlled);
  const securityLevel = Math.max(...shipments.map(s => {
    const levels = { standard: 1, high: 2, restricted: 3, classified: 4 };
    return levels[s.requirements.securityLevel] || 1;
  }));
  
  // Build query for suitable vehicles
  const query = {
    status: 'idle',
    'capacity.weight': { $gte: Math.max(...shipments.map(s => s.dimensions.weight)) },
    'capacity.volume': { $gte: Math.max(...shipments.map(s => s.dimensions.volume)) }
  };
  
  // Add special requirements to query
  if (requiresTemperatureControl) {
    query['features.temperatureControl'] = true;
  }
  
  if (securityLevel >= 3) {
    query['features.securityFeatures'] = { $in: ['gps-tracking', 'alarm'] };
  }
  
  // Find suitable vehicles
  return Vehicle.find(query).limit(20);
}

/**
 * Calculate base metrics for shipments without optimization
 */
function calculateBaseMetrics(shipments) {
  let totalDistance = 0;
  let totalTime = 0;
  let totalFuel = 0;
  let totalCO2 = 0;
  
  // For simplicity, calculate direct distances
  // In a real implementation, this would use actual routes
  shipments.forEach(shipment => {
    const origin = shipment.origin.coordinates.coordinates;
    const destination = shipment.destination.coordinates.coordinates;
    
    const distance = calculateDistance(origin, destination);
    totalDistance += distance;
    
    // Estimate time (assuming 60 km/h average speed)
    const time = distance / 60;
    totalTime += time;
    
    // Estimate fuel (assuming 0.1L/km average consumption)
    const fuel = calculateFuelConsumption(distance, 0.1);
    totalFuel += fuel;
    
    // Estimate CO2 (assuming 2.3 kg CO2 per liter of fuel)
    totalCO2 += fuel * 2.3;
  });
  
  return {
    totalDistance, // kilometers
    totalTime,     // hours
    totalFuel,     // liters
    totalCO2,      // kg
    vehicleCount: shipments.length, // Worst case: one vehicle per shipment
    routeCount: shipments.length
  };
}

/**
 * Calculate savings between original and optimized metrics
 */
function calculateSavings(original, optimized) {
  return {
    distance: original.totalDistance - optimized.totalDistance,
    distancePercentage: ((original.totalDistance - optimized.totalDistance) / original.totalDistance) * 100,
    time: original.totalTime - optimized.time,
    timePercentage: ((original.totalTime - optimized.time) / original.totalTime) * 100,
    fuel: original.totalFuel - optimized.fuel,
    fuelPercentage: ((original.totalFuel - optimized.fuel) / original.totalFuel) * 100,
    co2: original.totalCO2 - optimized.co2,
    co2Percentage: ((original.totalCO2 - optimized.co2) / original.totalCO2) * 100,
    vehicleCount: original.vehicleCount - optimized.vehicleCount
  };
}

/**
 * Perform internal route optimization if external service fails
 */
function performInternalOptimization(optimizationPayload) {
  // This would be a simplified version of the optimization algorithm
  // In a real implementation, this would be much more sophisticated
  
  // Basic implementation - group shipments by proximity of origin/destination
  const { shipments, vehicles, parameters } = optimizationPayload;
  
  // Sort vehicles by capacity (largest first)
  const sortedVehicles = [...vehicles].sort((a, b) => b.weightCapacity - a.weightCapacity);
  
  // Group shipments by proximity
  const shipmentGroups = groupShipmentsByProximity(shipments);
  
  // Assign vehicle routes
  const routes = [];
  let unassignedShipments = [];
  let totalDistance = 0;
  let totalTime = 0;
  let totalFuel = 0;
  let totalCO2 = 0;
  
  shipmentGroups.forEach((group, index) => {
    if (index < sortedVehicles.length) {
      const vehicle = sortedVehicles[index];
      
      // Create route
      const route = {
        vehicleId: vehicle.id,
        shipments: group.map(s => s.id),
        stops: buildRouteStops(group, vehicle),
        metrics: {
          distance: 0,
          time: 0,
          fuel: 0,
          co2: 0
        }
      };
      
      // Calculate route metrics
      route.metrics = calculateRouteMetrics(route.stops, vehicle);
      
      // Update totals
      totalDistance += route.metrics.distance;
      totalTime += route.metrics.time;
      totalFuel += route.metrics.fuel;
      totalCO2 += route.metrics.co2;
      
      routes.push(route);
    } else {
      // Add to unassigned
      unassignedShipments = [...unassignedShipments, ...group.map(s => s.id)];
    }
  });
  
  return {
    routes,
    unassignedShipments,
    metrics: {
      totalDistance,
      time: totalTime,
      fuel: totalFuel,
      co2: totalCO2,
      vehicleCount: routes.length,
      routeCount: routes.length
    }
  };
}

/**
 * Group shipments by proximity of origin/destination
 */
function groupShipmentsByProximity(shipments) {
  // In a real implementation, this would use a clustering algorithm
  // For simplicity, we'll just group by city
  
  const groups = {};
  
  shipments.forEach(shipment => {
    const groupKey = `${shipment.origin[1].toFixed(1)}_${shipment.destination[1].toFixed(1)}`;
    
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    
    groups[groupKey].push(shipment);
  });
  
  return Object.values(groups);
}

/**
 * Build route stops for a group of shipments
 */
function buildRouteStops(shipments, vehicle) {
  let stops = [];
  
  // Start at vehicle location
  stops.push({
    type: 'start',
    location: vehicle.location,
    time: new Date()
  });
  
  // Add all pickups
  shipments.forEach(shipment => {
    stops.push({
      type: 'pickup',
      shipmentId: shipment.id,
      location: shipment.origin,
      time: new Date(shipment.pickup)
    });
  });
  
  // Add all deliveries
  shipments.forEach(shipment => {
    stops.push({
      type: 'delivery',
      shipmentId: shipment.id,
      location: shipment.destination,
      time: new Date(shipment.delivery)
    });
  });
  
  // Sort stops by time
  stops.sort((a, b) => a.time - b.time);
  
  // Calculate estimated times
  for (let i = 1; i < stops.length; i++) {
    const prevStop = stops[i-1];
    const currentStop = stops[i];
    
    const distance = calculateDistance(prevStop.location, currentStop.location);
    const time = distance / 60; // hours at 60 km/h
    
    // Add estimated arrival time
    currentStop.estimatedArrival = new Date(prevStop.estimatedArrival || prevStop.time);
    currentStop.estimatedArrival.setHours(currentStop.estimatedArrival.getHours() + time);
  }
  
  return stops;
}

/**
 * Calculate metrics for a route
 */
function calculateRouteMetrics(stops, vehicle) {
  let distance = 0;
  let time = 0;
  
  for (let i = 1; i < stops.length; i++) {
    const prevStop = stops[i-1];
    const currentStop = stops[i];
    
    const segmentDistance = calculateDistance(prevStop.location, currentStop.location);
    distance += segmentDistance;
    
    const segmentTime = segmentDistance / 60; // hours at 60 km/h
    time += segmentTime;
  }
  
  // Calculate fuel consumption based on vehicle efficiency
  const fuel = distance * (1 / vehicle.fuelEfficiency);
  
  // Calculate CO2 emissions (2.3 kg CO2 per liter of fuel)
  const co2 = fuel * 2.3;
  
  return {
    distance,
    time,
    fuel,
    co2
  };
}

