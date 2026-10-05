// Configuration mapping layer names (as reported by the service 'name' property)
// to allowed styling fields and optional predefined symbology.
// Example structure:
// {
//   "Layer Name": {
//     fields: [
//       { name: 'CATEGORY', alias: 'Category', mapping: { 'A': '#ff0000', 'B': '#00ff00' } },
//       { name: 'TYPE', alias: 'Type' } // no mapping -> values will be auto-colored
//     ],
//     allowedSymbology: ['uniqueValue']
//   }
// }

const layerStyleConfig = {
  // Example entries - replace keys with the exact layer 'name' from your service
  "Lotes": {
    fields: [
          { name: "TIPO", alias: "Tipo", mapping: { "PARCELA_CONDOMINIO": "#2b8cbe", "LOTE": "#f03b20" } },
      { name: "AREA_M2", alias: "Area (m2)" }
    ],
        allowedSymbology: ["uniqueValue", "classBreaks"]
  }
};

export default layerStyleConfig;
