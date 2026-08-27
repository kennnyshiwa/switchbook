import { fetchThereminGoatCatalog, syncForceCurveCatalog } from '../src/lib/force-curves'
async function main() { const catalog = await fetchThereminGoatCatalog(); console.log(await syncForceCurveCatalog(`${catalog.revision}:formats-v2`, catalog.entries, { catalogRevision: catalog.revision })) }
main().catch(error => { console.error(error); process.exitCode = 1 })
