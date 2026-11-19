// Test persistence and API retrieval of filament_stock collection
async function run() {
  const testSpool = {
    id: `spool_test_${Date.now()}`,
    brand: "eSUN",
    material: "PLA+",
    color: "#A03CF7",
    colorName: "Purple",
    weightG: 1000,
    spoolQty: 1,
    costPerSpool: 75,
    location: "A1 • P2S",
    createdAt: new Date().toISOString()
  };

  console.log("1. Inserting test spool via POST /api/data...");
  const postRes = await fetch("http://localhost:3000/api/data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      collection: "filament_stock",
      id: testSpool.id,
      data: testSpool
    })
  });
  const postJson = await postRes.json();
  if (!postJson.success) {
    throw new Error(`Failed to POST filament_stock: ${JSON.stringify(postJson)}`);
  }
  console.log("POST success:", postJson);

  console.log("2. Fetching GET /api/data to verify filament_stock collection exists...");
  const getRes = await fetch("http://localhost:3000/api/data");
  const getJson = await getRes.json();
  const filamentStock = getJson.collections?.filament_stock;

  if (!filamentStock) {
    throw new Error("collections.filament_stock is undefined in GET /api/data response!");
  }

  const found = filamentStock.find(s => s.id === testSpool.id);
  if (!found) {
    throw new Error(`Test spool ${testSpool.id} not found in collections.filament_stock!`);
  }
  console.log("Found test spool in GET /api/data:", found);

  console.log("3. Cleaning up test spool via DELETE /api/data...");
  const delRes = await fetch("http://localhost:3000/api/data", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      collection: "filament_stock",
      id: testSpool.id
    })
  });
  const delJson = await delRes.json();
  console.log("Cleanup success:", delJson);
  console.log("ALL TESTS PASSED!");
}

run().catch(err => {
  console.error("TEST FAILED:", err.message);
  process.exit(1);
});
