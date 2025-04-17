const Shipment = require('../models/shipment');
const Vehicle = require('../models/vehicle');
const { publishToKafka } = require('../utils/kafka');
const { calculateDistance, calculateETA } = require('../utils/calculations');

/**
 * Get all shipments with filtering
 */
exports.getAllShipments = async (req, res) => {
  try {
    const query = {};
    
    // Apply filters from query parameters
    if (req.query.status) {
      query.status = req.query.status;
    }
    
    if (req.query.type) {
      query.type = req.query.type;
    }
    
    if (req.query.priority) {
      query.priority = req.query.priority;
    }
    
    if (req.query.customer) {
      query['customer.name'] = { $regex: req.query.customer, $options: 'i' };
    }
    
    // Date range filters
    if (req.query.pickupAfter) {
      query['scheduling.requestedPickup'] = { 
        $gte: new Date(req.query.pickupAfter) 
      };
    }
    
    if (req.query.pickupBefore) {
      if (!query['scheduling.requestedPickup']) {
        query['scheduling.requestedPickup'] = {};
      }
      query['scheduling.requestedPickup'].$lte = new Date(req.query.pickupBefore);
    }
    
    // Location-based filters
    if (req.query.originCity) {
      query['origin.city'] = req.query.originCity;
    }
    
    if (req.query.destinationCity) {
      query['destination.city'] = req.query.destinationCity;
    }
    
    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;
    
    const shipments = await Shipment.find(query)
      .populate('tracking.assignedVehicle', 'name type status')
      .sort({ 'scheduling.requestedPickup': 1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Shipment.countDocuments(query);
    
    return res.status(200).json({
      success: true,
      count: shipments.length,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalResults: total
      },
      data: shipments
    });
  } catch (error) {
    console.error('Error getting shipments:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

/**
 * Get a single shipment by ID
 */
exports.getShipment = async (req, res) => {
  try {
    const shipment = await Shipment.findById(req.params.id)
      .populate('tracking.assignedVehicle', 'name type status location telemetry');
    
    if (!shipment) {
      return res.status(404).json({
        success: false,
        error: 'Shipment not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: shipment
    });
  } catch (error) {
    console.error('Error getting shipment:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

/**
 * Create a new shipment
 */
exports.createShipment = async (req, res) => {
  try {
    // Generate a unique reference number
    if (!req.body.reference) {
      req.body.reference = `SHP-${Date.now().toString().substring(7)}`;
    }
    
    const shipment = await Shipment.create(req.body);
    
    // Publish event to Kafka
    publishToKafka('shipment_events', {
      type: 'shipment_created',
      shipmentId: shipment._id.toString(),
      reference: shipment.reference,
      priority: shipment.priority,
      timestamp: new Date()
    });
    
    return res.status(201).json({
      success: true,
      data: shipment
    });
  } catch (error) {
    console.error('Error creating shipment:', error);
    
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
 * Update a shipment
 */
exports.updateShipment = async (req, res) => {
  try {
    const shipment = await Shipment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!shipment) {
      return res.status(404).json({
        success: false,
        error: 'Shipment not found'
      });
    }
    
    // Publish event to Kafka
    publishToKafka('shipment_events', {
      type: 'shipment_updated',
      shipmentId: shipment._id.toString(),
      reference: shipment.reference,
      timestamp: new Date(),
      changes: Object.keys(req.body)
    });
    
    return res.status(200).json({
      success: true,
      data: shipment
    });
  } catch (error) {
    console.error('Error updating shipment:', error);
    
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
 * Assign a vehicle to a shipment
 */
exports.assignVehicle = async (req, res) => {
  try {
    const { vehicleId } = req.body;
    
    if (!vehicleId) {
      return res.status(400).json({
        success: false,
        error: 'Vehicle ID is required'
      });
    }
    
    const shipment = await Shipment.findById(req.params.id);
    
    if (!shipment) {
      return res.status(404).json({
        success: false,
        error: 'Shipment not found'
      });
    }
    
    const vehicle = await Vehicle.findById(vehicleId);
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found'
      });
    }
    
    // Check if the vehicle is available
    if (vehicle.status !== 'idle' && vehicle.status !== 'loading') {
      return res.status(400).json({
        success: false,
        error: 'Vehicle is not available for assignment'
      });
    }
    
    // Check if the vehicle is suitable for the shipment
    if (!vehicle.isSuitableForShipment(shipment)) {
      return res.status(400).json({
        success: false,
        error: 'Vehicle is not suitable for this shipment'
      });
    }
    
    // Update shipment
    shipment.status = 'assigned';
    shipment.tracking.assignedVehicle = vehicleId;
    shipment.tracking.currentLocation = vehicle.location;
    shipment.tracking.currentLocation.updatedAt = new Date();
    
    // Update vehicle
    vehicle.status = 'loading';
    vehicle.assignedShipments.push(shipment._id);
    
    // Create a route plan
    const originPoint = shipment.origin.coordinates.coordinates;
    const destinationPoint = shipment.destination.coordinates.coordinates;
    const vehiclePoint = vehicle.location.coordinates;
    
    // Calculate ETAs
    const now = new Date();
    const pickupETA = calculateETA(vehiclePoint, originPoint, 60, now); // 60 km/h avg speed
    const deliveryETA = calculateETA(originPoint, destinationPoint, 60, pickupETA);
    
    // Set route on vehicle
    vehicle.route = {
      path: {
        type: 'LineString',
        coordinates: [vehiclePoint, originPoint, destinationPoint]
      },
      stops: [
        {
          location: {
            type: 'Point',
            coordinates: originPoint
          },
          address: shipment.origin.address,
          scheduledArrival: shipment.scheduling.requestedPickup,
          estimatedArrival: pickupETA,
          type: 'pickup'
        },
        {
          location: {
            type: 'Point',
            coordinates: destinationPoint
          },
          address: shipment.destination.address,
          scheduledArrival: shipment.scheduling.requestedDelivery,
          estimatedArrival: deliveryETA,
          type: 'delivery'
        }
      ],
      status: 'scheduled'
    };
    
    // Update shipment scheduling
    shipment.scheduling.estimatedPickup = pickupETA;
    shipment.scheduling.estimatedDelivery = deliveryETA;
    
    // Save both documents
    await Promise.all([
      shipment.save(),
      vehicle.save()
    ]);
    
    // Publish event to Kafka
    publishToKafka('shipment_events', {
      type: 'vehicle_assigned',
      shipmentId: shipment._id.toString(),
      vehicleId: vehicle._id.toString(),
      reference: shipment.reference,
      estimatedPickup: pickupETA,
      estimatedDelivery: deliveryETA,
      timestamp: new Date()
    });
    
    return res.status(200).json({
      success: true,
      data: {
        shipment,
        vehicle: {
          _id: vehicle._id,
          name: vehicle.name,
          type: vehicle.type,
          status: vehicle.status
        }
      }
    });
  } catch (error) {
    console.error('Error assigning vehicle to shipment:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

/**
 * Update shipment status
 */
exports.updateStatus = async (req, res) => {
  try {
    const { status, location, notes } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }
    
    const shipment = await Shipment.findById(req.params.id);
    
    if (!shipment) {
      return res.status(404).json({
        success: false,
        error: 'Shipment not found'
      });
    }
    
    // Update status
    shipment.status = status;
    
    // Update the location if provided
    if (location && location.coordinates) {
      shipment.tracking.currentLocation = {
        type: 'Point',
        coordinates: location.coordinates,
        updatedAt: new Date()
      };
    }
    
    // Add notes if provided
    if (notes) {
      shipment.notes.push({
        text: notes,
        author: req.user ? req.user._id : undefined,
        timestamp: new Date()
      });
    }
    
    // Update timestamps based on status
    if (status === 'in-transit') {
      shipment.scheduling.actualPickup = new Date();
    } else if (status === 'delivered') {
      shipment.scheduling.actualDelivery = new Date();
      
      // If vehicle is assigned, update its status
      if (shipment.tracking.assignedVehicle) {
        const vehicle = await Vehicle.findById(shipment.tracking.assignedVehicle);
        if (vehicle) {
          // Remove this shipment from the vehicle's assigned shipments
          vehicle.assignedShipments = vehicle.assignedShipments.filter(
            id => id.toString() !== shipment._id.toString()
          );
          
          // If no more shipments, set vehicle status to idle
          if (vehicle.assignedShipments.length === 0) {
            vehicle.status = 'returning';
          }
          
          await vehicle.save();
        }
      }
    }
    
    await shipment.save();
    
    // Publish event to Kafka
    publishToKafka('shipment_events', {
      type: 'status_updated',
      shipmentId: shipment._id.toString(),
      reference: shipment.reference,
      status,
      timestamp: new Date()
    });
    
    return res.status(200).json({
      success: true,
      data: shipment
    });
  } catch (error) {
    console.error('Error updating shipment status:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};
