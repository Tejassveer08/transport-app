// models/vehicle.js - Vehicle data model
const mongoose = require('mongoose');

const VehicleSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['truck', 'van', 'autonomous', 'drone'],
    required: true
  },
  name: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['idle', 'loading', 'in-transit', 'delivering', 'returning', 'maintenance'],
    default: 'idle'
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    // Only required for non-autonomous vehicles
    required: function() {
      return this.type !== 'autonomous' && this.type !== 'drone';
    }
  },
  capacity: {
    weight: { type: Number, required: true }, // kg
    volume: { type: Number, required: true }  // cubic meters
  },
  fuel: {
    type: { type: String, enum: ['diesel', 'gasoline', 'electric', 'hybrid'] },
    level: { type: Number, required: true }, // percentage
    efficiency: { type: Number, required: true } // km/l or km/kWh
  },
  maintenance: {
    lastService: { type: Date, required: true },
    nextService: { type: Date, required: true },
    status: { type: String, enum: ['good', 'attention', 'critical'], default: 'good' }
  },
  telemetry: {
    speed: { type: Number, default: 0 }, // km/h
    heading: { type: Number }, // degrees
    altitude: { type: Number }, // meters, important for drones
    temperature: { type: Number } // engine/battery temperature
  },
  assignedShipments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shipment'
  }],
  route: {
    path: {
      type: {
        type: String,
        enum: ['LineString'],
        default: 'LineString'
      },
      coordinates: {
        type: [[Number]], // array of [longitude, latitude] points
        default: []
      }
    },
    stops: [{
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
      address: { type: String },
      scheduledArrival: { type: Date },
      estimatedArrival: { type: Date },
      type: { type: String, enum: ['pickup', 'delivery', 'waypoint'] }
    }],
    status: {
      type: String,
      enum: ['scheduled', 'in-progress', 'completed', 'delayed', 'cancelled'],
      default: 'scheduled'
      }
  },
  features: {
    autonomousCapable: { type: Boolean, default: false },
    temperatureControl: { type: Boolean, default: false },
    securityFeatures: { type: [String] }, // ['gps-tracking', 'alarm', 'immobilizer', etc.]
    specializedEquipment: { type: [String] } // ['crane', 'lift-gate', 'refrigeration', etc.]
  },
  // For drones only
  droneSpecifics: {
    maxFlightTime: { type: Number }, // minutes
    maxRange: { type: Number }, // kilometers
    maxAltitude: { type: Number }, // meters
    camera: {
      equipped: { type: Boolean, default: true },
      resolution: { type: String } // '4K', '1080p', etc.
    },
    payloadCapacity: { type: Number } // kg
  }
}, { timestamps: true });

// Index for geospatial queries
VehicleSchema.index({ location: '2dsphere' });

// Virtual for calculating estimated range based on fuel level and efficiency
VehicleSchema.virtual('estimatedRange').get(function() {
  if (this.fuel && this.fuel.level && this.fuel.efficiency) {
    return this.fuel.level * this.fuel.efficiency;
  }
  return 0;
});

// Method to update vehicle location
VehicleSchema.methods.updateLocation = function(longitude, latitude) {
  this.location.coordinates = [longitude, latitude];
  return this.save();
};

// Method to check if vehicle is suitable for a shipment
VehicleSchema.methods.isSuitableForShipment = function(shipment) {
  // Check if vehicle has enough capacity
  if (shipment.dimensions.weight > this.capacity.weight ||
      shipment.dimensions.volume > this.capacity.volume) {
    return false;
  }
  
  // Check if vehicle has required features
  if (shipment.requirements.temperatureControlled && !this.features.temperatureControl) {
    return false;
  }
  
  // Additional checks based on shipment requirements
  
  return true;
};

const Vehicle = mongoose.model('Vehicle', VehicleSchema);
module.exports = Vehicle;






          coordinates: [
            drone.location.coordinates,
            missionData.parameters.pickup,
            missionData.parameters.delivery
          ]
        },
        stops: [
          {
            location: {
              type: 'Point',
              coordinates: missionData.parameters.pickup
            },
            type: 'pickup',
            scheduledArrival: new Date(Date.now() + 15 * 60000) // 15 min
          },
          {
            location: {
              type: 'Point',
              coordinates: missionData.parameters.delivery
            },
            type: 'delivery',
            scheduledArrival: new Date(Date.now() + 30 * 60000) // 30 min
          }
        ]
      };
    }
    
    await drone.save();
    
    // Send command to drone if connected
    const connection = droneConnections.get(droneId);
    if (connection && connection.readyState === WebSocket.OPEN) {
      connection.send(JSON.stringify({
        type: 'MISSION_ASSIGNMENT',
        commandId: command._id.toString(),
        missionData
      }));
    }
    
    // Publish event to Kafka
    publishToKafka('drone_commands', {
      droneId,
      commandId: command._id.toString(),
      type: 'mission_assigned',
      timestamp: new Date(),
      missionType: missionData.type
    });
    
    return { 
      success: true,
      drone: drone.toObject(),
      command: command.toObject()
    };
  } catch (error) {
    console.error('Error assigning drone mission:', error);
    throw error;
  }
};

/**
 * Recall a drone from its current mission
 * @param {string} droneId - The ID of the drone
 */
exports.recallDrone = async (droneId) => {
  try {
    const drone = await Drone.findById(droneId);
    
    if (!drone) {
      throw new Error('Drone not found');
    }
    
    if (drone.type !== 'drone') {
      throw new Error('Vehicle is not a drone');
    }
    
    if (drone.status === 'idle') {
      throw new Error('Drone is already idle');
    }
    
    // Find active command for this drone
    const activeCommand = await DroneCommand.findOne({
      droneId,
      status: { $in: ['pending', 'in-progress'] }
    });
    
    if (activeCommand) {
      activeCommand.status = 'aborted';
      await activeCommand.save();
    }
    
    // Update drone status
    drone.status = 'returning';
    
    // Set return route
    drone.route = {
      path: {
        type: 'LineString',
        coordinates: [
          drone.location.coordinates,
          [0, 0] // Home base coordinates - would be stored in config
        ]
      },
      stops: [
        {
          location: {
            type: 'Point',
            coordinates: [0, 0] // Home base
          },
          type: 'waypoint',
          scheduledArrival: new Date(Date.now() + 20 * 60000) // 20 min
        }
      ]
    };
    
    await drone.save();
    
    // Send recall command to drone if connected
    const connection = droneConnections.get(droneId);
    if (connection && connection.readyState === WebSocket.OPEN) {
      connection.send(JSON.stringify({
        type: 'DRONE_RECALL',
        timestamp: new Date()
      }));
    }
    
    // Publish event to Kafka
    publishToKafka('drone_commands', {
      droneId,
      type: 'drone_recalled',
      timestamp: new Date()
    });
    
    return { 
      success: true,
      drone: drone.toObject()
    };
  } catch (error) {
    console.error('Error recalling drone:', error);
    throw error;
  }
};

/**
 * Register a drone connection
 * @param {string} droneId - The ID of the drone
 * @param {WebSocket} connection - The WebSocket connection
 */
exports.registerDroneConnection = (droneId, connection) => {
  droneConnections.set(droneId, connection);
  
  // Set up disconnect handler
  connection.on('close', () => {
    droneConnections.delete(droneId);
    
    // Publish disconnection event
    publishToKafka('drone_status', {
      droneId,
      type: 'connection_lost',
      timestamp: new Date()
    });
  });
  
  // Publish connection event
  publishToKafka('drone_status', {
    droneId,
    type: 'connected',
    timestamp: new Date()
  });
};

// utils/calculations.js - Utility functions for calculations
/**
 * Calculate distance between two points using Haversine formula
 * @
