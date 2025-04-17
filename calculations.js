utils/calculations.js - Continuing the utility functions for calculations
/**
 * Calculate distance between two points using Haversine formula
 * @param {Array} point1 - [longitude, latitude] of first point
 * @param {Array} point2 - [longitude, latitude] of second point
 * @returns {Number} Distance in kilometers
 */
exports.calculateDistance = (point1, point2) => {
  const [lon1, lat1] = point1;
  const [lon2, lat2] = point2;
  
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return distance;
};

/**
 * Calculate fuel consumption based on distance and vehicle efficiency
 * @param {Number} distance - Distance in kilometers
 * @param {Number} efficiency - Fuel efficiency (L/km or kWh/km)
 * @returns {Number} Fuel consumption in liters or kWh
 */
exports.calculateFuelConsumption = (distance, efficiency) => {
  return distance * efficiency;
};

/**
 * Calculate estimated time of arrival
 * @param {Array} originPoint - [longitude, latitude] of origin
 * @param {Array} destinationPoint - [longitude, latitude] of destination
 * @param {Number} averageSpeed - Average speed in km/h
 * @param {Date} startTime - Departure time
 * @returns {Date} Estimated time of arrival
 */
exports.calculateETA = (originPoint, destinationPoint, averageSpeed, startTime) => {
  const distance = exports.calculateDistance(originPoint, destinationPoint);
  const timeInHours = distance / averageSpeed;
  const timeInMilliseconds = timeInHours * 60 * 60 * 1000;
  
  const eta = new Date(startTime.getTime() + timeInMilliseconds);
  return eta;
};

/**
 * Calculate carbon emissions based on fuel consumption and fuel type
 * @param {Number} fuelConsumption - Fuel consumption in liters or kWh
 * @param {String} fuelType - Type of fuel (diesel, gasoline, electric, hybrid)
 * @returns {Number} Carbon emissions in kg CO2
 */
exports.calculateCarbonEmissions = (fuelConsumption, fuelType) => {
  // CO2 emission factors (kg CO2 per liter or kWh)
  const emissionFactors = {
    diesel: 2.68,
    gasoline: 2.31,
    electric: 0.5, // Depends on electricity source
    hybrid: 1.8
  };
  
  return fuelConsumption * (emissionFactors[fuelType] || 2.3);
};

/**
 * Helper function to convert degrees to radians
 */
function toRadians(degrees) {
  return degrees * Math.PI / 180;
}
