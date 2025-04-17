const shipmentModel = require('./models/shipmentModel');
const routeOptimization = require('./RouteOptimization');
const kafkaProducer = require('./kafka').producer;

class OrderPoolingService {
  constructor() {
    this.poolingThreshold = 15; // km - maximum distance between deliveries to consider pooling
    this.poolingTimeWindow = 60; // minutes - time window for pooling orders
  }
  
  /**
   * Find orders that can be pooled together based on location and time window
   * @param {string} regionId - The delivery region ID
   * @return {Array} - Array of pooled order groups
   */
  async findPoolingCandidates(regionId) {
    // Get pending orders for the region
    const pendingOrders = await shipmentModel.find({
      status: 'pending',
      region: regionId,
      scheduledDeliveryTime: {
        $gte: new Date(),
        $lte: new Date(Date.now() + this.poolingTimeWindow * 60000)
      }
    });
    
    // If not enough orders for pooling
    if (pendingOrders.length < 2) return [];
    
    // Group orders by proximity
    const orderGroups = [];
    const processedOrders = new Set();
    
    for (const order of pendingOrders) {
      if (processedOrders.has(order.id)) continue;
      
      const currentGroup = [order];
      processedOrders.add(order.id);
      
      for (const potentialMatch of pendingOrders) {
        if (processedOrders.has(potentialMatch.id)) continue;
        
        // Calculate distance between delivery locations
        const distance = this.calculateDistance(
          order.deliveryLocation.coordinates,
          potentialMatch.deliveryLocation.coordinates
        );
        
        // Check if within pooling threshold
        if (distance <= this.poolingThreshold) {
          currentGroup.push(potentialMatch);
          processedOrders.add(potentialMatch.id);
        }
      }
      
      // Only add groups with multiple orders
      if (currentGroup.length > 1) {
        orderGroups.push(currentGroup);
      }
    }
    
    return orderGroups;
  }
  
  /**
   * Merge orders into a single shipment
   * @param {Array} orderGroup - Group of orders to merge
   * @return {Object} - The created batch shipment
   */
  async createPooledShipment(orderGroup) {
    // Calculate optimal route for the pooled shipment
    const deliveryPoints = orderGroup.map(order => ({
      id: order.id,
      coordinates: order.deliveryLocation.coordinates,
      weight: order.weight,
      priority: order.priority
    }));
    
    const optimizedRoute = await routeOptimization.optimizeDeliverySequence(deliveryPoints);
    
    // Create a batch shipment
    const batchShipment = await shipmentModel.create({
      type: 'batch',
      status: 'ready',
      orders: orderGroup.map(order => order.id),
      route: optimizedRoute,
      totalWeight: orderGroup.reduce((sum, order) => sum + order.weight, 0),
      created: new Date(),
      estimatedDeliveryTime: this.calculateEstimatedDeliveryTime(optimizedRoute)
    });
    
    // Update individual orders
    await Promise.all(orderGroup.map(order => 
      shipmentModel.updateOne(
        { _id: order.id },
        { $set: { status: 'batched', batchId: batchShipment.id } }
      )
    ));
    
    // Publish to Kafka for real-time tracking
    await kafkaProducer.send({
      topic: 'shipment-updates',
      messages: [{
        key: batchShipment.id,
        value: JSON.stringify({
          type: 'BATCH_CREATED',
          batchId: batchShipment.id,
          orderCount: orderGroup.length,
          timestamp: new Date()
        })
      }]
    });
    
    return batchShipment;
  }
  
  /**
   * Calculate distance between two coordinates using Haversine formula
   * @param {Array} coordA - [longitude, latitude]
   * @param {Array} coordB - [longitude, latitude]
   * @return {number} - Distance in kilometers
   */
  calculateDistance(coordA, coordB) {
    const [lonA, latA] = coordA;
    const [lonB, latB] = coordB;
    
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(latB - latA);
    const dLon = this.toRadians(lonB - lonA);
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRadians(latA)) * Math.cos(this.toRadians(latB)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return distance;
  }
  
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }
  
  /**
   * Calculate estimated delivery time based on route
   * @param {Object} route - Optimized route information
   * @return {Date} - Estimated delivery completion time
   */
  calculateEstimatedDeliveryTime(route) {
    const averageTimePerStop = 10; // minutes
    const averageSpeed = 30; // km/h
    
    // Calculate total travel time in minutes
    const travelTimeMinutes = (route.totalDistance / averageSpeed) * 60;
    
    // Add time for each delivery stop
    const deliveryTimeMinutes = route.sequence.length * averageTimePerStop;
    
    // Total time in milliseconds
    const totalTimeMs = (travelTimeMinutes + deliveryTimeMinutes) * 60 * 1000;
    
    return new Date(Date.now() + totalTimeMs);
  }
}

module.exports = new OrderPoolingService();
