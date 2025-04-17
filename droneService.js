// services/droneService.js - Drone management service
const Drone = require('../models/vehicle'); // Using the Vehicle model with type=drone
const DroneCommand = require('../models/droneCommand');
const { publishToKafka } = require('../utils/kafka');
const { calculateDistance } = require('../utils/calculations');
const WebSocket = require('ws');

// Store active drone command connections
const droneConnections = new Map();

/**
 * Fetch all drones
 */
exports.fetchDrones = async (filters = {}) => {
  try {
    const query = {
      type: 'drone'
    };
    
    // Apply additional filters
    if (filters.status) {
      query.status = filters.status;
    }
    
    if (filters.available) {
      query.status = 'idle';
    }
    
    const drones = await Drone.find(query);
    
    // Add connection status
    return drones.map(drone => ({
      ...drone.toObject(),
      connected: droneConnections.has(drone._id.toString())
    }));
  } catch (error) {
    console.error('Error fetching drones:', error);
    throw error;
  }
};

/**
 * Assign a mission to a drone
 * @param {string} droneId - The ID of the drone
 * @param {Object} missionData - Mission parameters
 */
exports.assignDroneMission = async (droneId, missionData) => {
  try {
    const drone = await Drone.findById(droneId);
    
    if (!drone) {
      throw new Error('Drone not found');
    }
    
    if (drone.type !== 'drone') {
      throw new Error('Vehicle is not a drone');
    }
    
    if (drone.status !== 'idle' && drone.status !== 'returning') {
      throw new Error('Drone is not available for mission assignment');
    }
    
    // Create drone command
    const command = new DroneCommand({
      droneId,
      type: missionData.type, // 'surveillance', 'delivery', 'reconnaissance'
      parameters: missionData.parameters,
      status: 'pending',
      priority: missionData.priority || 'normal'
    });
    
    await command.save();
    
    // Update drone status
    drone.status = 'in-transit';
    
    // Set drone route based on mission
    if (missionData.type === 'surveillance') {
      // For surveillance, set a patrol route
      drone.route = {
        path: {
          type: 'LineString',
          coordinates: missionData.parameters.waypoints
        },
        stops: missionData.parameters.waypoints.map((waypoint, index) => ({
          location: {
            type: 'Point',
            coordinates: waypoint
          },
          type: 'waypoint',
          scheduledArrival: new Date(Date.now() + (index * 10 * 60000)) // 10 min intervals
        }))
      };
    } else if (missionData.type === 'delivery') {
      // For delivery, set pickup and delivery
      drone.route = {
        path: {
          type: 'LineString',
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
