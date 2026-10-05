import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
// Removed 'import L from 'leaflet'' since we use the direct esri-leaflet hook/function imports
import { dynamicMapLayer } from 'esri-leaflet';

export default function EsriDynamicLayer({ url, show = null, opacity = 1, params = {} }) {
    const map = useMap();
    const ref = useRef(null);

    useEffect(() => {
        if (!map || !url) return;

        // If a FeatureServer URL was passed, convert to MapServer for dynamic rendering
        let dynamicUrl = url;
        try {
            if (typeof url === 'string' && url.toLowerCase().includes('/featureserver')) {
                dynamicUrl = url.replace(/FeatureServer/i, 'MapServer');
            }
        } catch (e) {
            dynamicUrl = url;
        }

        const options = {
            url: dynamicUrl,
            opacity,
        };

        // esri-leaflet expects an array of layer IDs for options.layers (e.g., [0, 1, 2])
        if (show != null) {
            options.layers = Array.isArray(show) ? show : [show];
        }

        if (params && Object.keys(params).length) {
            options.params = params;
        }

        // creating dynamic layer
        // Call dynamicMapLayer directly instead of L.esri.dynamicMapLayer
        const layer = dynamicMapLayer(options).addTo(map);
        ref.current = layer;
        // added dynamic layer to map

        return () => {
            if (ref.current && map) {
                try {
                    map.removeLayer(ref.current);
                } catch (e) {
                    // ignore teardown errors
                }
            }
        };
    }, [map, url]);

    useEffect(() => {
        const layer = ref.current;
        if (!layer) return;

        try {
            if (show != null && layer.setLayers) {
                // esri-leaflet's setLayers updates visible layers using an array of IDs
                const layersArray = Array.isArray(show) ? show : [show];
                // set layers on dynamic layer
                layer.setLayers(layersArray);
            }

            if (layer.setOpacity) {
                // set opacity on dynamic layer
                layer.setOpacity(opacity);
            }

            if (params && Object.keys(params).length && layer.setParams) {
                // update dynamic layer params
                layer.setParams(params);
            }
        } catch (e) {
            // ignore update errors
        }
    }, [show, opacity, params]);

    return null;
}
