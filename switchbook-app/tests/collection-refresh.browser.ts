import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'node:http'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'

// Render the actual collection, controls, virtual grid, and master-add pages.
// Stub external routing/auth and secondary widgets, not their state handlers.
const stubs: Record<string, string> = {
  'next/navigation': `const router = {refresh:()=>{window.refreshes++},push:()=>{},replace:()=>{}}; export const useRouter=()=>router; const params=new URLSearchParams(); export const useSearchParams=()=>params;`,
  'next-auth/react': `export const useSession=()=>({data:{user:{id:'test-user'}},status:'authenticated'});`,
  'next/link': `import React from 'react'; export default function Link({children,...props}) { return <a {...props}>{children}</a> }`,
  'next/image': `import React from 'react'; export default function Image(props) { return <img {...props}/> }`,
  '@/contexts/ThemeContext': `export const useTheme=()=>({theme:'light'});`,
  '@/utils/switchScores': `export const hasSwitchScoreData=name=>window.slowScores?new Promise(resolve=>window.pendingScores.push({name,resolve})):Promise.resolve(true);`,
  'SwitchCard': `import React from 'react'; export default function Card({switch:item,onDelete,onSelectionChange}) { return <article data-testid="switch-card">{item.name}<button onClick={onSelectionChange}>Select {item.name}</button><button onClick={()=>onDelete(item.id)}>Delete {item.name}</button></article> }`,
  'SwitchTable': `import React from 'react'; export default function Table({switches}) { return <div>{switches.map(item=><article data-testid="switch-card" key={item.id}>{item.name}</article>)}</div> }`,
  'AddSwitchModal': `import React from 'react'; export default function Add({onSwitchAdded}) { return <button onClick={()=>onSwitchAdded(window.newSwitch)}>Save test switch</button> }`,
  'EditSwitchModal': `export default ()=>null;`,
  'CompareForceCurvesButton': `export default ()=>null;`,
  'ForceCurvesButton': `export default ()=>null;`,
  'SwitchScoresButton': `export default ()=>null;`,
  'ImageCarousel': `export default ()=>null;`,
  'AnimatedCounter': `import React from 'react'; export default ({value})=><span>{value}</span>;`,
  'SwitchesDBComparison': `export default ()=>null;`,
  'LinkToCollectionDialog': `export default ()=>null;`,
  'VirtualSwitchList': `import React from 'react'; export default function List({switches,onSwitchClick}) {return <div>{switches.map(s=><button key={s.id} onClick={()=>onSwitchClick(s)}>Open {s.name}</button>)}</div>}`, 
  'MasterSwitchDetailsPopup': `import React from 'react'; export default function Popup({switchItem,onAddToCollection}) { return <button onClick={()=>onAddToCollection(switchItem.id)}>{switchItem.inCollection?'In Collection':'Add to Collection'}</button> }`,
}

const fixtureSource = `
import React from 'react'; import {createRoot} from 'react-dom/client';
import Collection from './src/components/SwitchCollection';
import Browse from './src/app/switches/browse/page-client';
import Detail from './src/app/switches/[id]/page-client';
import Bulk from './src/app/dashboard/bulk-upload/page';
window.refreshes=0; window.pendingScores=[];
window.newSwitch={id:'new-1',name:'New Jade',createdAt:'2026-10-25T12:00:00Z',images:[],personalTags:[]};
const first={id:'old-1',name:'Existing Switch',createdAt:'2026-10-24T12:00:00Z',images:[],personalTags:[]};
const root=createRoot(document.getElementById('root'));
const empty={};
window.showCollection=(rows=[first])=>root.render(<Collection switches={rows} userId="test-user" showForceCurves={false} forceCurvePreferences={[]} initialForceCurvesByMasterSwitchId={empty}/>);
window.showBrowse=()=>root.render(<Browse/>);
window.showBulk=()=>root.render(<Bulk/>);
const params=Promise.resolve({id:'master-1'}), search=Promise.resolve({});
window.showDetail=()=>root.render(<Detail params={params} searchParams={search}/>);
window.showCollection();
`

const master = { id: 'master-1', name: 'Crystal Jade', status: 'APPROVED', inCollection: false, inWishlist: false, userCount: 0, viewCount: 0, images: [], createdAt: '2026-10-24T12:00:00Z', submittedBy: { id: 'author', username: 'author' } }

test('collection changes appear without a reload and master adds invalidate cached navigation', async t => {
  const result = await build({
    stdin: { contents: fixtureSource, resolveDir: process.cwd(), sourcefile: 'collection-fixture.tsx', loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'ui-boundaries', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => {
        const leaf = args.path.split('/').pop()!
        const key = Object.hasOwn(stubs, args.path) ? args.path : Object.hasOwn(stubs, leaf) ? leaf : null
        if (key) return { path: key, namespace: 'stub' }
      })
      builder.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents: stubs[args.path], loader: 'tsx', resolveDir: process.cwd() }))
    } }]
  })
  const server = createServer((req,res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type','application/javascript'); res.end(result.outputFiles[0].text) }
    else { res.setHeader('Content-Type','text/html'); res.end('<div id="root"></div><script src="/bundle.js"></script>') }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve())))
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_CHROMIUM_PATH })
  t.after(() => browser.close())
  const page = await browser.newPage()
  const errors: string[] = []
  page.on('pageerror', error=>errors.push(error.message))
  const address = server.address() as { port: number }
  await page.goto(`http://127.0.0.1:${address.port}`)
  const cards = page.locator('[data-testid="switch-card"]')
  await cards.filter({hasText:'Existing Switch'}).waitFor()

  // RSC refresh/back-navigation can update props without remounting the client.
  await page.getByRole('button',{name:'Select Existing Switch'}).click()
  await page.evaluate(() => (window as any).showCollection([(window as any).newSwitch]))
  await cards.filter({hasText:'New Jade'}).waitFor({timeout:3000})
  assert.equal(await cards.filter({hasText:'Existing Switch'}).count(),0)
  assert.match(await page.locator('body').innerText(), /Your Switches \(1\)/)

  // Empty -> first switch and additional switches use the same local live state.
  await page.evaluate(() => (window as any).showCollection([]))
  await page.getByRole('button',{name:'Add your first switch',exact:true}).click()
  await page.getByRole('button',{name:'Save test switch'}).click()
  await cards.filter({hasText:'New Jade'}).waitFor()
  assert.match(await page.locator('body').innerText(), /Collection Statistics/)
  await page.evaluate(() => { (window as any).newSwitch={...(window as any).newSwitch,id:'new-2',name:'Another Switch'} })
  await page.getByRole('button',{name:'Add Switch',exact:true}).click()
  await page.getByRole('button',{name:'Save test switch'}).click()
  await cards.filter({hasText:'Another Switch'}).waitFor()
  assert.equal(await cards.count(),2)
  assert.match(await page.locator('body').innerText(), /Your Switches \(2\)/)

  await page.getByTitle('Table view',{exact:true}).click()
  await page.evaluate(() => (window as any).showCollection([{...(window as any).newSwitch,name:'Table Addition'}]))
  await cards.filter({hasText:'Table Addition'}).waitFor()
  await page.getByTitle('Grid view',{exact:true}).click()
  await page.evaluate(() => (window as any).showCollection([(window as any).newSwitch]))
  await cards.filter({hasText:'Another Switch'}).waitFor()

  // Do not discard a user's active search when fresh server rows arrive.
  await page.getByPlaceholder(/Search by name/).fill('Another')
  await page.evaluate(() => (window as any).showCollection([(window as any).newSwitch,{id:'other',name:'Filtered Out',createdAt:'2026-10-24',images:[],personalTags:[]}]))
  await cards.filter({hasText:'Another Switch'}).waitFor()
  assert.equal(await cards.filter({hasText:'Filtered Out'}).count(),0)

  // A slow filter pass must not restore old rows after newer props arrive.
  await page.getByPlaceholder(/Search by name/).fill('')
  await page.evaluate(() => { (window as any).slowScores=true; (window as any).showCollection([{id:'slow-old',name:'Old Slow',createdAt:'2026-10-24',images:[],personalTags:[]}]) })
  await page.getByRole('button',{name:/^Filters/}).click()
  await page.locator('select').filter({has:page.locator('option',{hasText:'With Scorecards'})}).selectOption('true')
  await page.waitForFunction(()=>(window as any).pendingScores.some((p:any)=>p.name==='Old Slow'))
  await page.evaluate(() => (window as any).showCollection([{id:'slow-new',name:'New Slow',createdAt:'2026-10-25',images:[],personalTags:[]}]))
  await page.waitForFunction(()=>(window as any).pendingScores.some((p:any)=>p.name==='New Slow'))
  await page.evaluate(() => (window as any).pendingScores.filter((p:any)=>p.name==='New Slow').forEach((p:any)=>p.resolve(true)))
  await cards.filter({hasText:'New Slow'}).waitFor()
  await page.evaluate(() => (window as any).pendingScores.filter((p:any)=>p.name==='Old Slow').forEach((p:any)=>p.resolve(true)))
  await page.waitForTimeout(100)
  assert.equal(await cards.filter({hasText:'Old Slow'}).count(),0)
  assert.equal(await cards.filter({hasText:'New Slow'}).count(),1)

  let failAdd=false
  await page.route('**/api/**', async route => {
    const url=new URL(route.request().url())
    if(url.pathname.endsWith('/add-to-collection')) return route.fulfill({status:failAdd?500:200,json:failAdd?{error:'Test failure'}:{switchId:'new-1'}})
    if(url.pathname==='/api/master-switches') return route.fulfill({json:{switches:[master]}})
    if(url.pathname==='/api/master-switches/master-1') return route.fulfill({json:master})
    if(url.pathname==='/api/switches' && route.request().method()==='POST') return route.fulfill({json:{id:'bulk-1'}})
    return route.fulfill({json:[]})
  })
  page.on('dialog',dialog=>dialog.dismiss())
  for(const mode of ['Browse','Detail']) {
    await page.evaluate(mode => { (window as any).refreshes=0; (window as any)['show'+mode]() },mode)
    if(mode==='Browse') await page.getByRole('button',{name:'Open Crystal Jade'}).click()
    failAdd=true
    await page.getByRole('button',{name:'Add to Collection',exact:true}).click()
    await page.waitForTimeout(100)
    assert.equal(await page.evaluate(()=>(window as any).refreshes),0, 'failed adds must not invalidate or claim success')
    failAdd=false
    await page.getByRole('button',{name:'Add to Collection',exact:true}).click()
    await page.waitForFunction(()=>(window as any).refreshes===1)
  }
  await page.evaluate(() => { (window as any).refreshes=0; (window as any).showBulk() })
  await page.locator('input[type="file"]').setInputFiles({name:'switches.csv',mimeType:'text/csv',buffer:Buffer.from('name\nBulk Test\n')})
  await page.getByRole('button',{name:'Continue to Preview'}).click()
  await page.getByRole('button',{name:/Import 1 of 1 Switches/}).click()
  await page.getByRole('heading',{name:'Import Complete!'}).waitFor()
  assert.equal(await page.evaluate(()=>(window as any).refreshes),1)
  assert.deepEqual(errors,[])
})
