import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Box } from '@mui/material';
import { mapVehicleTypeToIcon, mapIncidentTypeToIcon } from '../utils/mapHelpers';

const MapComponent = ({ 
  vehicles, 
  shipments, 
  incidents, 
  weatherOverlays, 
  trafficOverlays,
  showDrones
}) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  
  useEffect(() => {
    if (!map.current) {
      mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [-95.7129, 37.0902], // US center
        zoom: 4
      });
      
      // Add controls
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
      map.current.addControl(new mapboxgl.FullscreenControl());
      
      // Add event listeners
      map.current.on('load', () => {
        // Add map layers here (traffic, weather, etc.)
        addTrafficLayer();
        addWeatherLayer();
      });
    }
    
    // Update vehicle markers
    if (vehicles && map.current) {
      updateVehicleMarkers();
    }
    
    // Update incident markers
    if (incidents && map.current) {
      updateIncidentMarkers();
    }
    
    return () => {
      // Cleanup if needed
    };
  }, [vehicles, incidents, weatherOverlays, trafficOverlays]);
  
  const addTrafficLayer = () => {
    if (!map.current.getSource('traffic')) {
      map.current.addSource('traffic', {
        type: 'geojson',
        data: trafficOverlays
      });
      
      map.current.addLayer({
        id: 'traffic-layer',
        type: 'line',
        source: 'traffic',
        paint: {
          'line-color': [
            'match',
            ['get', 'congestion'],
            'low', '#4CAF50',
            'moderate', '#FFC107',
            'high', '#FF5722',
            'severe', '#F44336',
            '#BDBDBD'
          ],
          'line-width': 3
        }
      });
    } else {
      map.current.getSource('traffic').setData(trafficOverlays);
    }
  };
  
  const addWeatherLayer = () => {
    if (!map.current.getSource('weather')) {
      map.current.addSource('weather', {
        type: 'geojson',
        data: weatherOverlays
      });
      
      map.current.addLayer({
        id: 'weather-layer',
        type: 'fill',
        source: 'weather',
        paint: {
          'fill-color': [
            'match',
            ['get', 'severity'],
            'minor', 'rgba(255, 255, 0, 0.2)',
            'moderate', 'rgba(255, 165, 0, 0.3)',
            'severe', 'rgba(255, 0, 0, 0.4)',
            'rgba(0, 0, 255, 0.1)'
          ],
          'fill-outline-color': 'rgba(0, 0, 0, 0.1)'
        }
      });
    } else {
      map.current.getSource('weather').setData(weatherOverlays);
    }
  };
  
  const updateVehicleMarkers = () => {
    // Remove existing markers
    const existingMarkers = document.querySelectorAll('.vehicle-marker');
    existingMarkers.forEach(marker => marker.remove());
    
    // Add new markers
    vehicles.forEach(vehicle => {
      const el = document.createElement('div');
      el.className = 'vehicle-marker';
      el.style.backgroundImage = `url(${mapVehicleTypeToIcon(vehicle.type)})`;
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.backgroundSize = 'contain';
      
      // Add color indicator for status
      el.style.borderBottom = `3px solid ${
        vehicle.status === 'on-time' ? '#4CAF50' :
        vehicle.status === 'delayed' ? '#FFC107' :
        vehicle.status === 'stopped' ? '#F44336' : '#BDBDBD'
      }`;
      
      // Create popup
      const popup = new mapboxgl.Popup({ offset: 25 })
        .setHTML(`
          <strong>${vehicle.name}</strong><br>
          Status: ${vehicle.status}<br>
          Driver: ${vehicle.driver}<br>
          Cargo: ${vehicle.cargo}<br>
          ETA: ${vehicle.eta}
        `);
      
      // Add marker to map
      new mapboxgl.Marker(el)
        .setLngLat([vehicle.longitude, vehicle.latitude])
        .setPopup(popup)
        .addTo(map.current);
    });
  };
  
  const updateIncidentMarkers = () => {
    // Similar to updateVehicleMarkers but for incidents
  };
  
  return (
    <Box ref={mapContainer} sx={{ width: '100%', height: '100%' }} />
  );
};
