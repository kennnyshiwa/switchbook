import { fetchThereminGoatCatalog, syncForceCurveCatalog } from '../src/lib/force-curves'
async function main() { const catalog = await fetchThereminGoatCatalog(); console.log(await syncForceCurveCatalog(catalog.revision, catalog.entries)) }
main().catch(error => { console.error(error); process.exitCode = 1 })
