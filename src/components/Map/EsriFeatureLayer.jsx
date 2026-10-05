import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet'; // assuming you are using react-leaflet
import L from 'leaflet';
import * as Esri from 'esri-leaflet'; // Import Esri leaflet namespaces

// styleFunc: (properties, geometryType) => Leaflet style options
// where: optional where clause string passed to the feature layer query
export default function EsriFeatureLayer({ url, visible = true, options = {}, styleFunc = null, where = null }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!map || !url) return;

    // Use the imported Esri object safely, or fallback to L.esri if loaded via CDN
    const esriNamespace = Esri?.featureLayer ? Esri : L.esri;

    if (!esriNamespace) {
      console.error("Esri Leaflet plugin is not loaded.");
      return;
    }

    // Build options, allow passed-in options to take precedence
    const opts = { url, ...options };

    // Apply where clause if provided
    if (where) {
      opts.where = where;
    }

    // If a style function is provided, wire it up to style and pointToLayer
    if (styleFunc) {
      opts.style = function (feature) {
        try {
          // feature may be a GeoJSON feature - properties and geometry.type
          const props = feature && feature.properties ? feature.properties : {};
          const geomType = feature && feature.geometry ? feature.geometry.type : null;
          return styleFunc(props, geomType) || {};
        } catch (e) {
          return {};
        }
      };

      opts.pointToLayer = function (geojson, latlng) {
        try {
          const props = (geojson && geojson.properties) || {};
          const geomType = geojson && geojson.geometry ? geojson.geometry.type : 'Point';
          const styleOptions = styleFunc(props, geomType) || {};
          // Use circleMarker for point styling (radius, fillColor, etc.)
          return L.circleMarker(latlng, styleOptions);
        } catch (e) {
          return L.circleMarker(latlng);
        }
      };
    }

    // Create the esri feature layer safely
    const layer = esriNamespace.featureLayer(opts);
    layerRef.current = layer;

    if (visible) {
      layer.addTo(map);
    }

    // feature layer added to map

    return () => {
      try {
        layer.remove();
      } catch (e) {
        // ignore
      }
    };
    // recreate when url, map, styleFunc, where or options change
  }, [map, url, styleFunc, where, JSON.stringify(options)]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !map) return;
    if (visible) {
      if (!map.hasLayer(layer)) layer.addTo(map);
    } else {
      if (map.hasLayer(layer)) layer.remove();
    }
  }, [visible, map]);

  return null;
}
