import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { RefreshCcw, Map, Package, Clock, TrendingUp, AlertTriangle, Send, Car } from 'lucide-react';

// Mock data - in a real app this would come from your API
const mockPerformanceData = [
  { name: 'Jan', onTime: 89, delayed: 11 },
  { name: 'Feb', onTime: 92, delayed: 8 },
  { name: 'Mar', onTime: 88, delayed: 12 },
  { name: 'Apr', onTime: 94, delayed: 6 },
  { name: 'May', onTime: 91, delayed: 9 },
  { name: 'Jun', onTime: 96, delayed: 4 },
];

const mockDeliveryMethods = [
  { name: 'Standard Vehicle', value: 65 },
  { name: 'Drone Delivery', value: 20 },
  { name: 'Autonomous Vehicle', value: 15 },
];

const mockShipmentTypes = [
  { name: 'Commercial', value: 45 },
  { name: 'Defense', value: 30 },
  { name: 'Consumer', value: 25 },
];

const mockRouteEfficiency = [
  { date: '10/1', efficiency: 82, pooling: 30 },
  { date: '10/2', efficiency: 86, pooling: 35 },
  { date: '10/3', efficiency: 84, pooling: 40 },
  { date: '10/4', efficiency: 90, pooling: 50 },
  { date: '10/5', efficiency: 89, pooling: 55 },
  { date: '10/6', efficiency: 94, pooling: 60 },
  { date: '10/7', efficiency: 93, pooling: 62 },
];

// Colors for pie charts
const DELIVERY_COLORS = ['#60a5fa', '#34d399', '#a78bfa'];
const SHIPMENT_COLORS = ['#60a5fa', '#f59e0b', '#34d399'];

export default function AnalyticsDashboard() {
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(false);
  
  // Key metrics
  const [metrics, setMetrics] = useState({
    activeShipments: 124,
    delayedShipments: 8,
    activeDrones: 13,
    activeVehicles: 42,
    pooledDeliveries: 28,
    fuelSaved: 420, // liters
    co2Reduced: 1260, // kg
    onTimePercentage: 94
  });
  
  // Refresh data
  const refreshData = () => {
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setLastUpdated(new Date());
      // In a real app, you would fetch fresh data here
      setIsLoading(false);
    }, 1000);
  };
  
  useEffect(() => {
    // Initial data load
    refreshData();
    
    // Set up real-time update interval
    const interval = setInterval(refreshData, 5 * 60 * 1000); // Refresh every 5 minutes
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-800">Logistics Command Center</h1>
        <div className="flex items-center">
          <span className="text-sm text-gray-500 mr-4">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
          <button 
            onClick={refreshData} 
            className="flex items-center bg-blue-50 text-blue-600 px-3 py-1 rounded hover:bg-blue-100 transition-colors"
            disabled={isLoading}
          >
            <RefreshCcw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>
      
      {/* Dashboard Body */}
      <div className="flex-1 p-6 overflow-auto">
        {/* Tabs */}
        <div className="mb-6 flex border-b">
          <button 
            className={`px-4 py-2 font-medium ${activeTab === 'overview' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`px-4 py-2 font-medium ${activeTab === 'vehicles' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('vehicles')}
          >
            Vehicles & Drones
          </button>
          <button 
            className={`px-4 py-2 font-medium ${activeTab === 'efficiency' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('efficiency')}
          >
            Efficiency Metrics
          </button>
          <button 
            className={`px-4 py-2 font-medium ${activeTab === 'defense' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('defense')}
          >
            Defense Operations
          </button>
        </div>
        
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <div className="flex items-center">
              <div className="bg-blue-50 p-3 rounded-lg">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Active Shipments</p>
                <p className="text-xl font-semibold">{metrics.activeShipments}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <div className="flex items-center">
              <div className="bg-amber-50 p-3 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Delayed Shipments</p>
                <p className="text-xl font-semibold">{metrics.delayedShipments}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <div className="flex items-center">
              <div className="bg-green-50 p-3 rounded-lg">
                <Send className="h-6 w-6 text-green-600" /> {/* Using Send instead of Drone */}
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Active Drones</p>
                <p className="text-xl font-semibold">{metrics.activeDrones}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <div className="flex items-center">
              <div className="bg-purple-50 p-3 rounded-lg">
                <Car className="h-6 w-6 text-purple-600" /> {/* Using Car instead of Truck */}
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Active Vehicles</p>
                <p className="text-xl font-semibold">{metrics.activeVehicles}</p>
              </div>
            </div>
          </div>
        </div>
        
        {activeTab === 'overview' && (
          <>
            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                <h2 className="text-lg font-medium mb-4">Delivery Performance</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={mockPerformanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="onTime" name="On Time" fill="#60a5fa" />
                    <Bar dataKey="delayed" name="Delayed" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                <h2 className="text-lg font-medium mb-4">Delivery Methods</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={mockDeliveryMethods}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {mockDeliveryMethods.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={DELIVERY_COLORS[index % DELIVERY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Shipment Types and Efficiency */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                <h2 className="text-lg font-medium mb-4">Shipment Types</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={mockShipmentTypes}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {mockShipmentTypes.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={SHIPMENT_COLORS[index % SHIPMENT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                <h2 className="text-lg font-medium mb-4">Route Efficiency & Order Pooling</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={mockRouteEfficiency}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="efficiency" name="Route Efficiency %" stroke="#60a5fa" activeDot={{ r: 8 }} />
                    <Line type="monotone" dataKey="pooling" name="Order Pooling %" stroke="#34d399" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
        
        {activeTab === 'efficiency' && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <h2 className="text-lg font-medium mb-6">Sustainability Impact</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <TrendingUp className="h-5 w-5 text-green-600 mr-2" />
                  <h3 className="font-medium">Resource Efficiency</h3>
                </div>
                
                <div className="mt-4">
                  <div className="mb-4">
                    <p className="text-sm text-gray-500 mb-1">Fuel Saved</p>
                    <div className="flex items-center">
                      <span className="text-xl font-semibold">{metrics.fuelSaved} liters</span>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500 mb-1">CO2 Emissions Reduced</p>
                    <div className="flex items-center">
                      <span className="text-xl font-semibold">{metrics.co2Reduced} kg</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="border rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <Package className="h-5 w-5 text-blue-600 mr-2" />
                  <h3 className="font-medium">Order Pooling Statistics</h3>
                </div>
                
                <div className="mt-4">
                  <div className="mb-4">
                    <p className="text-sm text-gray-500 mb-1">Pooled Deliveries</p>
                    <div className="flex items-center">
                      <span className="text-xl font-semibold">{metrics.pooledDeliveries} batches</span>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Delivery Efficiency</p>
                    <div className="flex items-center">
                      <span className="text-xl font-semibold">{metrics.onTimePercentage}%</span>
                      <span className="text-sm text-green-600 ml-2">↑ 3.2%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'vehicles' && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <h2 className="text-lg font-medium mb-4">Fleet Status</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Battery/Fuel
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current Assignment
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">DRN-4581</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Delivery Drone</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Active
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">37.7749, -122.4194</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">74%</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">SH-38291</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">VH-1092</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Electric Van</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Active
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">37.7833, -122.4167</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">43%</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">SH-12042</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">DRN-3319</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Surveillance Drone</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-100 text-amber-800">
                        Charging
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">37.7272, -122.4230</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">12%</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">-</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {activeTab === 'defense' && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <h2 className="text-lg font-medium mb-6">Defense Operations</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-4">Secure Shipment Status</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium">MIL-94205</p>
                      <p className="text-sm text-gray-500">High Priority</p>
                    </div>
                    <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800">
                      In Transit
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium">MIL-76124</p>
                      <p className="text-sm text-gray-500">Standard</p>
                    </div>
                    <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-100 text-blue-800">
                      Preparing
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium">MIL-38569</p>
                      <p className="text-sm text-gray-500">High Priority</p>
                    </div>
                    <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800">
                      In Transit
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-4">Route Security</h3>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <p className="text-sm font-medium">Route Redundancy</p>
                    <p className="text-sm font-medium text-green-600">Active</p>
                  </div>
                  
                  <div className="flex justify-between">
                    <p className="text-sm font-medium">Secure Communications</p>
                    <p className="text-sm font-medium text-green-600">Enabled</p>
                  </div>
                  
                  <div className="flex justify-between">
                    <p className="text-sm font-medium">GPS Scrambling</p>
                    <p className="text-sm font-medium text-green-600">Active</p>
                  </div>
                  
                  <div className="flex justify-between">
                    <p className="text-sm font-medium">Escort Vehicles</p>
                    <p className="text-sm font-medium text-gray-600">3 Active</p>
                  </div>
                  
                  <div className="flex justify-between">
                    <p className="text-sm font-medium">Surveillance Drones</p>
                    <p className="text-sm font-medium text-gray-600">2 Active</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
