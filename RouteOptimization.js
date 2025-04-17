const axios = require('axios');
const turf = require('@turf/turf');
const redisClient = require('./redis');
const { getTrafficData } = require('./trafficService');
const { getWeatherData } = require('./weatherService');

class RouteOptimizationService {
  constructor() {
    this.cacheExpiry = 300; // Cache route calculations for 5 minutes
    this.apiKey = process.env.ROUTING_API_KEY;
    this.baseUrl = 'https://api.routingservice.com/v1';
  }
  
  /**
   * Optimize delivery route for multiple stops
   * @param {Array} stops - Array of delivery locations
   * @param {Object} options - Route options (priority, vehicle type, etc)
   * @return {Object} - Optimized route information
   */
  async optimizeDeliverySequence(stops, options = {}) {
    const cacheKey = `route:${JSON.stringify(stops)}:${JSON.stringify(options)}`;
    
    // Check cache first
    const cachedRoute = await redisClient.get(cacheKey);
    if (cachedRoute) {
      return JSON.parse(cachedRoute);
    }
    
    // Get real-time traffic data
    const trafficData = await getTrafficData(
      this.getBoundingBox(stops.map(stop => stop.coordinates))
    );
    
    // Get weather data for the area
    const weatherData = await getWeatherData(
      this.getCentroid(stops.map(stop => stop.coordinates))
    );
    
    // Prepare options for route calculation
    const routeOptions = {
      ...options,
      stops: stops.map(stop => ({
        id: stop.id,
        coordinates: stop.coordinates,
        serviceTime: this.calculateServiceTime(stop),
        priority: stop.priority || 'normal'
      })),
      trafficConditions: this.processTrafficData(trafficData),
      weatherConditions: weatherData,
      vehicleType: options.vehicleType || 'standard',
      avoidTolls: options.avoidTolls || false,
      avoidHighways: options.avoidHighways || false,
      departureTime: options.departureTime || new Date()
    };
    
    // Special handling for defense/military shipments
    if (options.securityLevel === 'high' || options.shipmentType === 'military') {
      routeOptions.alternateRoutes = 3; // Generate backup routes
      routeOptions.secureRouting = true; // Enable secure routing protocols
      routeOptions.avoidHighRiskAreas = true;
      routeOptions.escortRequired = options.escortRequired || false;
    }
    
    try {
      // Call routing API for optimization
      const response = await axios.post(
        `${this.baseUrl}/optimize-route`,
        routeOptions,
        { headers: { 'Authorization': `Bearer ${this.apiKey}` } }
      );
      
      const optimizedRoute = {
        sequence: response.data.sequence,
        routeGeometry: response.data.routeGeometry,
        legs: response.data.legs,
        totalDistance: response.data.totalDistance,
        totalDuration: response.data.totalDuration,
        departureTime: response.data.departureTime,
        arrivalTime: response.data.arrivalTime,
        trafficDelayMinutes: response.data.trafficDelayMinutes,
        alternateRoutes: response.data.alternateRoutes || []
      };
      
      // Cache the result
      await redisClient.set(
        cacheKey, 
        JSON.stringify(optimizedRoute),
        'EX',
        this.cacheExpiry
      );
      
      return optimizedRoute;
    } catch (error) {
      console.error('Route optimization error:', error);
      throw new Error('Failed to optimize route: ' + error.message);
    }
  }
  
  /**
   * Calculate estimated service time at stop based on shipment details
   * @param {Object} stop - Stop information
   * @return {number} - Service time in minutes
   */
  calculateServiceTime(stop) {
    // Base service time
    let serviceTime = 5; // minutes
    
    // Add time based on weight
    if (stop.weight) {
      serviceTime += Math.ceil(stop.weight / 10); // 1 minute per 10kg
    }
    
    // Add time based on volume
    if (stop.volume) {
      serviceTime += Math.ceil(stop.volume / 0.5); // 1 minute per 0.5 cubic meters
    }
    
    // Add time for signature requirement
    if (stop.requiresSignature) {
      serviceTime += 3;
    }
    
    // Add time for security checks for high-value or military shipments
    if (stop.securityLevel === 'high' || stop.shipmentType === 'military') {
      serviceTime += 15;
    }
    
    return serviceTime;
  }
  
  /**
   * Get bounding box for a set of coordinates
   * @param {Array} coordinates - Array of [lon, lat] coordinates
   * @return {Array} - Bounding box [minLon, minLat, maxLon, maxLat]
   */
  getBoundingBox(coordinates) {
    const points = coordinates.map(coord => turf.point(coord));
    const featureCollection = turf.featureCollection(points);
    const bbox = turf.bbox(featureCollection);
    return bbox;
  }
  
  /**
   * Get centroid for a set of coordinates
   * @param {Array} coordinates - Array of [lon, lat] coordinates
   * @return {Array} - Centroid [lon, lat]
   */
  getCentroid(coordinates) {
    const points = coordinates.map(coord => turf.point(coord));
    const featureCollection = turf.featureCollection(points);
    const center = turf.center(featureCollection);
    return center.geometry.coordinates;
  }
  
  /**
   * Process traffic data into a format usable for routing
   * @param {Object} trafficData - Raw traffic data
   * @return {Object} - Processed traffic conditions
   */
  processTrafficData(trafficData) {
    // Transform traffic data into route segments with delay factors
    const segments = trafficData.incidents.map(incident => ({
      startCoord: incident.coordinates[0],
      endCoord: incident.coordinates[1],
      delayFactor: this.calculateDelayFactor(incident.severity),
      description: incident.description
    }));
    
    return {
      overallCondition: trafficData.overallCondition,
      segments,
      lastUpdated: trafficData.timestamp
    };
  }
  
  /**
   * Calculate delay factor based on traffic severity
   * @param {string} severity - Traffic severity (low, medium, high, severe)
   * @return {number} - Delay multiplier
   */
  calculateDelayFactor(severity) {
    switch (severity.toLowerCase()) {
      case 'low': return 1.1;
      case 'medium': return 1.3;
      case 'high': return 1.7;
      case 'severe': return 2.5;
      default: return 1.0;
    }
  }
  
  /**
   * Generate alternative routes for high-priority or military shipments
   * @param {Object} primaryRoute - Primary optimized route
   * @param {Object} options - Routing options
   * @return {Array} - Array of alternative routes
   */
  async generateAlternativeRoutes(primaryRoute, options) {
    // Request alternative routes from routing API
    const response = await axios.post(
      `${this.baseUrl}/alternative-routes`,
      {
        originalRoute: primaryRoute.routeGeometry,
        maxAlternatives: options.alternativeCount || 2,
        minDeviationFactor: 0.3, // Minimum 30% difference from primary route
        maxDeviationFactor: 0.7, // Maximum 70% difference from primary route
        prioritizeRoadTypes: options.secureRouting ? ['major', 'highway'] : undefined
      },
      { headers: { 'Authorization': `Bearer ${this.apiKey}` } }
    );
    
    return response.data.alternatives;
  }
  
  /**
   * Update route with real-time information (traffic, weather, incidents)
   * @param {Object} route - Current route
   * @return {Object} - Updated route with real-time conditions
   */
  async updateRouteWithRealTimeData(route) {
    const boundingBox = this.getRouteBoundingBox(route.routeGeometry);
    
    // Get updated traffic and weather
    const [trafficData, weatherData] = await Promise.all([
      getTrafficData(boundingBox),
      getWeatherData(this.getCentroid(route.routeGeometry.coordinates))
    ]);
    
    // Check if rerouting is needed due to significant changes
    const needsRerouting = this.checkIfReroutingNeeded(route, trafficData, weatherData);
    
    if (needsRerouting) {
      // Recreate the route with current conditions
      const stops = route.sequence.map(stop => ({
        id: stop.id,
        coordinates: stop.coordinates,
        serviceTime: stop.serviceTime,
        priority: stop.priority
      }));
      
      // Use original options with updated conditions
      return this.optimizeDeliverySequence(stops, {
        departureTime: new Date(),
        vehicleType: route.vehicleType,
        securityLevel: route.securityLevel
      });
    } else {
      // Just update ETAs without rerouting
      return this.recalculateETAs(route, trafficData, weatherData);
    }
  }
  
  /**
   * Check if rerouting is needed based on current conditions
   * @param {Object} route - Current route
   * @param {Object} trafficData - Current traffic data
   * @param {Object} weatherData - Current weather data
   * @return {boolean} - Whether rerouting is needed
   */
  checkIfReroutingNeeded(route, trafficData, weatherData) {
    // Check for severe traffic incidents on the route
    const severeTrafficOnRoute = trafficData.incidents.some(incident => {
      return incident.severity === 'severe' && this.isIncidentOnRoute(incident, route);
    });
    
    // Check for severe weather
    const severeWeather = weatherData.condition === 'storm' || 
                          weatherData.condition === 'blizzard' ||
                          weatherData.visibility < 200;
    
    // Check for significant delay
    const significantDelay = trafficData.overallCondition === 'severe' &&
                             this.calculateNewETA(route, trafficData) - route.arrivalTime > 30 * 60 * 1000; // 30 minutes
    
    return severeTrafficOnRoute || severeWeather || significantDelay;
  }
  
  /**
   * Check if a traffic incident affects the current route
   * @param {Object} incident - Traffic incident
   * @param {Object} route - Current route
   * @return {boolean} - Whether the incident affects the route
   */
  isIncidentOnRoute(incident, route) {
    // Convert route to LineString
    const routeLine = turf.lineString(route.routeGeometry.coordinates);
    
    // Create incident point or line
    let incidentFeature;
    if (Array.isArray(incident.coordinates[0])) {
      // It's a line segment
      incidentFeature = turf.lineString(incident.coordinates);
    } else {
      // It's a point
      incidentFeature = turf.point(incident.coordinates);
    }
    
    // Check if incident is within buffer distance of route
    const buffer = turf.buffer(routeLine, 0.5, { units: 'kilometers' });
    return turf.booleanWithin(incidentFeature, buffer);
  }
  
  /**
   * Recalculate estimated arrival times based on current conditions
   * @param {Object} route - Current route
   * @param {Object} trafficData - Current traffic data
   * @param {Object} weatherData - Current weather data
   * @return {Object} - Updated route with new ETAs
   */
  recalculateETAs(route, trafficData, weatherData) {
    // Copy route
    const updatedRoute = { ...route };
    
    // Calculate traffic delay factor
    const trafficDelayFactor = this.calculateOverallDelayFactor(trafficData);
    
    // Calculate weather delay factor
    const weatherDelayFactor = this.calculateWeatherDelayFactor(weatherData);
    
    // Combined delay factor
    const totalDelayFactor = trafficDelayFactor * weatherDelayFactor;
    
    // Update leg durations and ETAs
    let currentTime = new Date();
    let cumulativeDelay = 0;
    
    updatedRoute.legs = route.legs.map((leg, index) => {
      const originalDuration = leg.duration;
      const adjustedDuration = originalDuration * totalDelayFactor;
      const delay = adjustedDuration - originalDuration;
      
      cumulativeDelay += delay;
      
      const updatedLeg = {
        ...leg,
        duration: adjustedDuration,
        delay: delay,
        departureTime: currentTime,
        arrivalTime: new Date(currentTime.getTime() + adjustedDuration * 1000)
      };
      
      currentTime = updatedLeg.arrivalTime;
      
      // Add service time at destination
      if (index < route.sequence.length - 1) {
        const stopServiceTime = route.sequence[index + 1].serviceTime * 60; // convert to seconds
        currentTime = new Date(currentTime.getTime() + stopServiceTime * 1000);
      }
      
      return updatedLeg;
    });
    
    // Update total duration and arrival time
    updatedRoute.totalDuration = updatedRoute.legs.reduce((sum, leg) => sum + leg.duration, 0);
    updatedRoute.trafficDelayMinutes = Math.round(cumulativeDelay / 60);
    updatedRoute.arrivalTime = updatedRoute.legs[updatedRoute.legs.length - 1].arrivalTime;
    
    return updatedRoute;
  }
  
  /**
   * Calculate overall delay factor from traffic data
   * @param {Object} trafficData - Traffic data
   * @return {number} - Overall delay factor
   */
  calculateOverallDelayFactor(trafficData) {
    switch (trafficData.overallCondition) {
      case 'free_flow': return 0.9;
      case 'light': return 1.0;
      case 'moderate': return 1.2;
      case 'heavy': return 1.5;
      case 'severe': return 2.0;
      default: return 1.0;
    }
  }
  
  /**
   * Calculate delay factor based on weather conditions
   * @param {Object} weatherData - Weather data
   * @return {number} - Weather delay factor
   */
  calculateWeatherDelayFactor(weatherData) {
    // Base factor
    let factor = 1.0;
    
    // Adjust for precipitation
    if (weatherData.precipitation) {
      if (weatherData.precipitation < 2) factor *= 1.1;
      else if (weatherData.precipitation < 10) factor *= 1.3;
      else factor *= 1.6;
    }
    
    // Adjust for visibility
    if (weatherData.visibility < 1000) factor *= 1.4;
    else if (weatherData.visibility < 5000) factor *= 1.2;
    
    // Adjust for wind
    if (weatherData.windSpeed > 50) factor *= 1.3;
    else if (weatherData.windSpeed > 30) factor *= 1.1;
    
    // Adjust for temperature (ice risk)
    if (weatherData.temperature < 2 && weatherData.temperature > -2) {
      factor *= 1.5; // High risk of ice
    }
    
    return factor;
  }
  
  /**
   * Get bounding box for a route geometry
   * @param {Object} routeGeometry - GeoJSON LineString of route
   * @return {Array} - Bounding box [minLon, minLat, maxLon, maxLat]
   */
  getRouteBoundingBox(routeGeometry) {
    const line = turf.lineString(routeGeometry.coordinates);
    return turf.bbox(line);
  }
}

module.exports = new RouteOptimizationService();
