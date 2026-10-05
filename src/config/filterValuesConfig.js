// Predefined filter values to avoid excessive querying.
// Structure: { "layerName": { "FIELD_NAME": ["value1","value2", ...] } }
// Use exact layer name as returned by the service.

const filterValuesConfig = {
  "data_comercial": {
    "CATEGORY": ["Retail", "Wholesale", "Online"],
    "SEGMENT": ["A", "B", "C"]
  },
  "proyectos": {
    "ESTADO": ["Activo", "Inactivo"],
    "TIPO": ["Residencial", "Comercial", "Industrial"]
  }
};

export default filterValuesConfig;
