import { fetchThereminGoatCatalog, forceCurveSyncRevision, syncForceCurveCatalog } from '../src/lib/force-curves'
async function main() { const catalog = await fetchThereminGoatCatalog(); console.log(await syncForceCurveCatalog(forceCurveSyncRevision(catalog.revision), catalog.entries, { catalogRevision: catalog.revision })) }
main().catch(error => { console.error(error); process.exitCode = 1 })
