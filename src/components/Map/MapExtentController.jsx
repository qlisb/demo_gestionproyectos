import { useEffect } from 'react';
import L from 'leaflet';
import * as Esri from 'esri-leaflet';

// Component performs side-effects on the passed map instance
export default function MapExtentController({ map, featureService, selectedLayers = new Set(), layerDetails = {}, selectedProject, panEnabled }) {
  useEffect(() => {
    // Important visibility log: warn level so it is visible even if info logs are filtered
    console.warn(`[MapExtentController] useEffect run map=${!!map} selectedProject=${selectedProject} selectedLayers=${Array.from(selectedLayers||[]).join(',')}`);
    if (!map) return;

    let cancelled = false;

    async function computeAndApply() {
      try {

        if (!selectedProject) {
          // No project selected: only enforce panEnabled state (lock/unlock map view)
          if (!panEnabled) console.info('[MapExtentController] locking map interactions (no project selected)');
          else console.info('[MapExtentController] unlocking map interactions (no project selected)');
          try {
            if (!panEnabled) {
              const currentBounds = map.getBounds && map.getBounds();
              if (currentBounds && currentBounds.isValid && currentBounds.isValid()) {
                map.setMaxBounds(currentBounds.pad ? currentBounds.pad(0.01) : currentBounds);
              }
              if (map.dragging) map.dragging.disable();
              if (map.scrollWheelZoom) map.scrollWheelZoom.disable();
              if (map.doubleClickZoom) map.doubleClickZoom.disable();
              if (map.boxZoom) map.boxZoom.disable();
              if (map.keyboard) map.keyboard.disable();
              if (map.touchZoom) map.touchZoom.disable();
            } else {
              map.setMaxBounds && map.setMaxBounds(null);
              if (map.dragging) map.dragging.enable();
              if (map.scrollWheelZoom) map.scrollWheelZoom.enable();
              if (map.doubleClickZoom) map.doubleClickZoom.enable();
              if (map.boxZoom) map.boxZoom.enable();
              if (map.keyboard) map.keyboard.enable();
              if (map.touchZoom) map.touchZoom.enable();
            }
          } catch (e) { console.warn('failed to (un)lock map interactions', e); }
          return;
        }

        // First: pre-lock/unlock interactions immediately so user cannot move map while we compute and zoom
        try {
          if (!panEnabled) {
            console.info('[MapExtentController] pre-locking map interactions (before computing bounds)');
            if (map.dragging) map.dragging.disable();
            if (map.scrollWheelZoom) map.scrollWheelZoom.disable();
            if (map.doubleClickZoom) map.doubleClickZoom.disable();
            if (map.boxZoom) map.boxZoom.disable();
            if (map.keyboard) map.keyboard.disable();
            if (map.touchZoom) map.touchZoom.disable();
          } else {
            console.info('[MapExtentController] ensuring interactions enabled before computing bounds');
            if (map.dragging) map.dragging.enable();
            if (map.scrollWheelZoom) map.scrollWheelZoom.enable();
            if (map.doubleClickZoom) map.doubleClickZoom.enable();
            if (map.boxZoom) map.boxZoom.enable();
            if (map.keyboard) map.keyboard.enable();
            if (map.touchZoom) map.touchZoom.enable();
          }
        } catch (e) { console.warn('failed to apply pre-lock/unlock', e); }

        const where = `PROYECTO='${String(selectedProject).replace(/'/g, "''")}'`;
        console.info(`[MapExtentController] computing bounds for project="${selectedProject}"`);
        const layerIds = Array.from(selectedLayers || []);
        const boundsList = [];

        // helper: query the ArcGIS REST 'query' endpoint with returnExtentOnly=true and convert to Leaflet bounds
        async function queryExtentFromRest(layerUrl, whereClause) {
          try {
            const qUrl = `${layerUrl}/query?where=${encodeURIComponent(whereClause)}&returnExtentOnly=true&f=json`;
            const res = await fetch(qUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (!data || !data.extent) return null;
            const extent = data.extent;
            const sr = extent.spatialReference || {};

            // helper: convert WebMercator (3857 / 102100) to lat/lng
            function webMercatorToLatLng(x, y) {
              const R = 20037508.342789244;
              const lon = (x / R) * 180;
              let lat = (y / R) * 180;
              lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
              return { lat, lon };
            }

            let sw, ne;
            const xmin = extent.xmin, ymin = extent.ymin, xmax = extent.xmax, ymax = extent.ymax;
            if (sr.wkid === 4326 || sr.latestWkid === 4326) {
              // coordinates are lon/lat
              sw = L.latLng(ymin, xmin);
              ne = L.latLng(ymax, xmax);
            } else {
              // assume WebMercator / meters: convert to lon/lat
              const swll = webMercatorToLatLng(xmin, ymin);
              const nell = webMercatorToLatLng(xmax, ymax);
              sw = L.latLng(swll.lat, swll.lon);
              ne = L.latLng(nell.lat, nell.lon);
            }

            const bounds = L.latLngBounds(sw, ne);
            return bounds;
          } catch (e) {
            return null;
          }
        }

        for (const id of layerIds) {
          const details = layerDetails && layerDetails[id];
          const hasField = details && (details.fields || []).some(f => (f.name || f.fieldName) === 'PROYECTO');

          // Only compute extents automatically for the 'proyectos' layer(s) that contain the PROYECTO field.
          if (!hasField) {
            console.info(`[MapExtentController] skipping layer ${id} - does not contain PROYECTO field (automatic zoom only for proyectos)`);
            continue;
          }
          const url = `${featureService}/${id}`;
          try {
            const fl = Esri.featureLayer({ url });
            // try to get bounds via esri-leaflet query().bounds()
            let b = null;
            try {
              // Prefer a direct REST extent query which is more reliable than esri-leaflet bounds()
              b = await queryExtentFromRest(url, where);
            } catch (e) {
              b = null;
            }

            // If no bounds returned, fallback to querying features and computing geometry bounds ourselves
            if (!(b && b.isValid && b.isValid())) {
              try {
                console.info('[MapExtentController] falling back to querying geometries for layer', id);
                // query features (supports promise or callback style)
                const queryFeaturesFromLayer = (layer, whereClause) => {
                  return new Promise((resolve, reject) => {
                    try {
                      const q = layer.query().where(whereClause);
                      if (q && typeof q.run === 'function') {
                        const maybePromise = q.run();
                        if (maybePromise && typeof maybePromise.then === 'function') {
                          maybePromise.then(res => resolve(res.features || [])).catch(reject);
                        } else {
                          q.run((err, res) => {
                            if (err) return reject(err);
                            resolve(res && res.features ? res.features : []);
                          });
                        }
                      } else {
                        reject(new Error('run() not available on query object'));
                      }
                    } catch (err) { reject(err); }
                  });
                };

                const features = await queryFeaturesFromLayer(fl, where);
                if (Array.isArray(features) && features.length > 0) {
                  for (const feat of features) {
                    try {
                      const gb = L.geoJSON(feat).getBounds();
                      if (gb && gb.isValid && gb.isValid()) boundsList.push(gb);
                    } catch (e) {
                      // ignore individual feature geometry errors
                    }
                  }
                }
              } catch (e) {
                console.warn('geometry fallback query failed for layer', id, e);
              }
            }
            else {
              // bounds returned successfully
              if (b && b.isValid && b.isValid()) boundsList.push(b);
            }
          } catch (e) {
            // ignore layer query errors but log for visibility
            console.warn('extent query failed for layer', id, e);
          }
        }

        if (cancelled) return;

        if (boundsList.length === 0) {
          console.info(`[MapExtentController] no bounds found for project="${selectedProject}"`);
          return;
        }

        // combine bounds
        let combined = boundsList[0];
        for (let i = 1; i < boundsList.length; i++) combined.extend(boundsList[i]);

        // apply to map
        try {
          // prepare extent info for logging
          const sw = combined.getSouthWest ? combined.getSouthWest() : null;
          const ne = combined.getNorthEast ? combined.getNorthEast() : null;
          const bbox = (combined.toBBoxString && typeof combined.toBBoxString === 'function') ? combined.toBBoxString() : (sw && ne ? `${sw.lng},${sw.lat},${ne.lng},${ne.lat}` : null);
          console.info(`[MapExtentController] computed extent for project="${selectedProject}" bbox=${bbox} SW=${sw ? `${sw.lat},${sw.lng}` : 'n/a'} NE=${ne ? `${ne.lat},${ne.lng}` : 'n/a'}`);
          map.fitBounds(combined.pad(0.5));
          console.info('[MapExtentController] fitBounds applied');
        } catch (e) {
          console.warn('fitBounds failed', e);
        }

        // Restrict panning and zoom if panEnabled is false
        if (!panEnabled) {
          try {
            map.setMaxBounds(combined.pad(0.05));
            if (map.dragging) map.dragging.disable();
            if (map.scrollWheelZoom) map.scrollWheelZoom.disable();
            if (map.doubleClickZoom) map.doubleClickZoom.disable();
            if (map.boxZoom) map.boxZoom.disable();
            if (map.keyboard) map.keyboard.disable();
            if (map.touchZoom) map.touchZoom.disable();
          } catch (e) {
            console.warn('failed to restrict map interactions', e);
          }
        } else {
          // ensure interactions enabled and no restrictive bounds
          try {
            map.setMaxBounds(null);
            if (map.dragging) map.dragging.enable();
            if (map.scrollWheelZoom) map.scrollWheelZoom.enable();
            if (map.doubleClickZoom) map.doubleClickZoom.enable();
            if (map.boxZoom) map.boxZoom.enable();
            if (map.keyboard) map.keyboard.enable();
            if (map.touchZoom) map.touchZoom.enable();
          } catch (e) { console.warn('failed to enable interactions', e); }
        }

      } catch (e) {
        console.error('MapExtentController error', e);
      }
    }

    computeAndApply();

    return () => { cancelled = true; };
  }, [map, featureService, selectedLayers, layerDetails, selectedProject, panEnabled]);

  return null;
}
