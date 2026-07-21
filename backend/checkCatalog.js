const axios = require('axios');

async function checkCatalog() {
  const url = 'http://localhost:5000/api/roles/catalog?mode=all';
  try {
    const res = await axios.get(url);
    const villas = res.data.villas;
    const units = res.data.units;
    console.log(`Fetched ${villas.length} villas and ${units.length} units`);
    
    const target = 'bc080343-f248-442e-9d37-bfd3134d6280';
    
    const villaMatch = villas.find(v => (v.GlobalID && v.GlobalID.includes(target)) || (v.arcgisId && v.arcgisId.includes(target)));
    if (villaMatch) console.log("Found in Villas:", villaMatch.GlobalID);
    
    const unitMatch = units.find(u => (u.GlobalID && u.GlobalID.includes(target)) || (u.arcgisId && u.arcgisId.includes(target)));
    if (unitMatch) console.log("Found in Units:", unitMatch.OBJECTID);
    
    if (!villaMatch && !unitMatch) {
      console.log("NOT FOUND in catalog at all!");
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}
checkCatalog();
